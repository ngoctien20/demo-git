'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {reviewRpcCatalog,EXPECTED_NAMES,PROJECT}=require('./rpc-security-review.cjs');
const publicMetadata={
 save_merchant_product:{
  anon_execute:false,authenticated_execute:true,
  flags:{uses_auth_uid:true,uses_tenant_membership:true,writes_products:true,
   uses_store_membership:false,has_store_id_reference:false}
 },
 qa_owner_pairing:{
  anon_execute:false,authenticated_execute:true,
  flags:{uses_auth_uid:true,uses_tenant_membership:true,
   reads_qa_bot_registry:true,has_qa_dry_run_guard:true,
   uses_store_membership:false,has_store_id_reference:false}
 },
 qa_shop_b_zalo_claim:{
  anon_execute:true,authenticated_execute:false,
  flags:{uses_vault_secret:true,reads_request_headers:true,uses_hmac:true,
    calls_qa_pairing:true,uses_store_membership:false,has_store_id_reference:false}
 }
};
function data(){
 return EXPECTED_NAMES.map(name=>{
  const [schema,fn]=name.split('.');
  const isPub=schema==='public';
  const base=publicMetadata[fn]||{flags:{}};
  return {
    schema,function:fn,owner:'postgres',identity_arguments:'p_tenant text, p_event text',
    security_definer:isPub,locked_empty_search_path:isPub,
    anon_execute:base.anon_execute||false,
    authenticated_execute:base.authenticated_execute||false,
    public_execute:false,flags:{...base.flags}
  };
 });
}
const audit=(r=data(),extra={})=>reviewRpcCatalog({
 source:'SUPABASE_READ_ONLY_RPC_AUDIT',projectRef:PROJECT,rpcs:r,...extra});
test('01 · exact three public and three private helper procedures',()=>{
 assert.equal(EXPECTED_NAMES.length,6);
 assert.equal(EXPECTED_NAMES.filter(x=>x.startsWith('public.')).length,3);
});
test('02 · actual metadata baseline remains blocked for Store migration',()=>{
 const a=audit();assert.equal(a.reviewed,6);
 assert.equal(a.status,'HOSTED_STORE_MIGRATION_BLOCKED');
 assert.equal(a.canApplyRls,false);assert.equal(a.canReplaceFunction,false);
});
test('03 · tenant-only merchant writer is a P0 finding',()=>{
 const a=audit();
 assert.ok(a.blockingFindings.includes('P0_PRODUCT_WRITER_TENANT_ONLY'));
});
test('04 · QA owner pairing is NOT canonical Store permission',()=>{
 assert.ok(audit().blockingFindings.includes('P0_PAIRING_USES_QA_IDENTITY_MAP_NOT_CANONICAL_STORE'));
});
test('05 · anon-definer header/vault gate requires independent live review',()=>{
 assert.ok(audit().blockingFindings.includes(
  'P0_ANON_DEFINER_HEADER_AND_VAULT_GATE_REQUIRES_REAL_INGRESS_REVIEW'));
});
test('06 · no caller inventory, hosted signature or replay proof assumed',()=>{
 const a=audit();
 for(const x of ['ALL_RPC_CALL_SITES_NOT_INDEPENDENTLY_AUDITED',
  'HOST_SIGNATURE_AND_HEADER_PROVENANCE_UNVERIFIED',
  'HOST_EVENT_IDEMPOTENCY_UNVERIFIED'])
  assert.ok(a.blockingFindings.includes(x));
});
test('07 · even passing caller booleans never authorizes a production change',()=>{
 const a=audit(data(),{callerInventoryReviewed:true,
  hostSignatureVerified:true,hostReplayTested:true});
 assert.equal(a.canRevokeExecute,false);assert.equal(a.canDeploy,false);
});
test('08 · wrong project denied',()=>{
 assert.ok(audit(data(),{projectRef:'production'}).blockingFindings
   .includes('PROJECT_SCOPE_MISMATCH'));
});
test('09 · client-passed audit source marker not recognized',()=>{
 assert.ok(audit(data(),{source:'CLIENT_BODY'}).blockingFindings
   .includes('CATALOG_PROVENANCE_NOT_VERIFIED'));
});
test('10 · missing public function cannot count as complete audit',()=>{
 const d=data().filter(x=>x.function!=='save_merchant_product');
 const a=audit(d);
 assert.ok(a.blockingFindings.includes('RPC_MISSING_public.save_merchant_product'));
});
test('11 · overloaded or duplicate function triggers fail-closed',()=>{
 const d=data();d.push({...d[0]});
 assert.ok(audit(d).blockingFindings.includes('RPC_DUPLICATE_OR_OVERLOADED_'+
  d[0].schema+'.'+d[0].function));
});
test('12 · unexpected extra function is never an approved scope',()=>{
 const d=data();d.push({...d[0],function:'dangerous_hidden'});
 assert.ok(audit(d).blockingFindings.includes('UNEXPECTED_RPC_IN_AUDIT'));
});
test('13 · owner drift must be investigated',()=>{
 const d=data();d[0].owner='some_external_role';
 assert.ok(audit(d).blockingFindings.includes('OWNER_OR_PRIVILEGE_DRIFT'));
});
test('14 · PUBLIC EXECUTE grant is independently flagged',()=>{
 const d=data();d[0].public_execute=true;
 assert.ok(audit(d).blockingFindings.includes('PUBLIC_EXECUTE_GRANT_OR_UNKNOWN'));
});
test('15 · merch RPC must not suddenly grant anon execute',()=>{
 const d=data();const f=d.find(x=>x.function==='save_merchant_product');
 f.anon_execute=true;
 assert.ok(audit(d).blockingFindings.includes('UNEXPECTED_EXECUTE_ROLE'));
});
test('16 · claim RPC role drift from anon to authenticated rejected',()=>{
 const d=data();const f=d.find(x=>x.function==='qa_shop_b_zalo_claim');
 f.anon_execute=false;f.authenticated_execute=true;
 assert.ok(audit(d).blockingFindings.includes('UNEXPECTED_EXECUTE_ROLE'));
});
test('17 · missing locked-empty search_path flags a definer risk',()=>{
 const d=data();d[0].locked_empty_search_path=false;
 assert.ok(audit(d).blockingFindings.includes('DEFINER_SEARCH_PATH_NOT_LOCKED'));
});
test('18 · invoker/definer privilege mode drift rejected',()=>{
 const d=data();d[0].security_definer=false;
 assert.ok(audit(d).blockingFindings.includes('SECURITY_MODE_DRIFT'));
});
test('19 · QA private helper must stay invoker not definer',()=>{
 const d=data();const helper=d.find(x=>x.schema==='tien404_r1_qa');
 helper.security_definer=true;
 assert.ok(audit(d).blockingFindings.includes('SECURITY_MODE_DRIFT'));
});
test('20 · QA helper cannot acquire anon or authenticated grants',()=>{
 const d=data();const helper=d.find(x=>x.schema==='tien404_r1_qa');
 helper.anon_execute=true;
 assert.ok(audit(d).blockingFindings.includes('PRIVATE_HELPER_EXPOSED'));
});
test('21 · tenant actor check disappearing from product writer rejected',()=>{
 const d=data();d[0].flags.uses_auth_uid=false;
 assert.ok(audit(d).blockingFindings.includes(
  'EXPECTED_GUARD_OR_WRITE_PATH_NOT_FOUND_uses_auth_uid'));
});
test('22 · product write scope disappearing from audit indicates drift',()=>{
 const d=data();d[0].flags.writes_products=false;
 assert.ok(audit(d).blockingFindings.includes(
  'EXPECTED_GUARD_OR_WRITE_PATH_NOT_FOUND_writes_products'));
});
test('23 · QA dry-run guard disappearing is not an automatic safe release',()=>{
 const d=data();d[1].flags.has_qa_dry_run_guard=false;
 assert.ok(audit(d).blockingFindings.includes(
  'EXPECTED_GUARD_OR_WRITE_PATH_NOT_FOUND_has_qa_dry_run_guard'));
});
test('24 · vault secret gate disappearing is a breaking security change',()=>{
 const d=data();d[2].flags.uses_vault_secret=false;
 assert.ok(audit(d).blockingFindings.includes(
  'EXPECTED_GUARD_OR_WRITE_PATH_NOT_FOUND_uses_vault_secret'));
});
test('25 · claim HMAC guard disappearing is explicitly blocked',()=>{
 const d=data();d[2].flags.uses_hmac=false;
 assert.ok(audit(d).blockingFindings.includes(
  'EXPECTED_GUARD_OR_WRITE_PATH_NOT_FOUND_uses_hmac'));
});
test('26 · locked store guard flags do not constitute independent hosted proof',()=>{
 const d=data();for(const r of d)if(r.schema==='public'){
  r.flags.uses_store_membership=true;r.flags.has_store_id_reference=true;
 }
 const a=audit(d,{callerInventoryReviewed:true,hostSignatureVerified:true,hostReplayTested:true});
 assert.equal(a.canApplyRls,false);
 assert.equal(a.realHostSignatureTested,false);
});
test('27 · metadata output never exposes vault secrets, full function bodies or row IDs',()=>{
 const x=JSON.stringify(audit());
 for(const text of ['CREATE OR REPLACE FUNCTION','vault.decrypted_secrets',
  'DECRYPTED_SECRET','11111111-1111-4111-8111-111111111111',
  'access_token','bearer '])assert.equal(x.includes(text),false,text);
});
test('28 · SQL source is metadata-only; no SELECT decrypted vault or function body output',()=>{
 const src=fs.readFileSync(path.join(__dirname,'RPC_AUDIT_READ_ONLY.sql'),'utf8');
 const lines=src.split('\n').filter(x=>!x.trimStart().startsWith('--'));
 assert.match(lines.join(' '),/WITH audited AS/i);
 assert.equal(/(?:AS function_definition|AS source_code|SELECT\s+decrypted_secret)/i.test(src),false);
 assert.equal(lines.some(l=>/^\s*(INSERT|UPDATE|DELETE|ALTER|GRANT|REVOKE|DROP|TRUNCATE|COPY)\b/i.test(l)),false);
});
test('29 · unsupported audit flag requires review',()=>{
 const d=data();d[0].flags['claimed_admin']=true;
 assert.ok(audit(d).blockingFindings.includes('UNKNOWN_AUDIT_FLAGS'));
});
test('30 · unparseable signature cannot hide a changed overload',()=>{
 const d=data();d[0].identity_arguments=null;
 assert.ok(audit(d).blockingFindings.includes('FUNCTION_SIGNATURE_NOT_RECORDED'));
});
