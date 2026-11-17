'use strict';
/**
 * TIEN404 G0.6 local Node VM regression. Source-only fake HMAC secrets only.
 * This reproduces code nodes + synthetic QA table fixtures without network,
 * credentials, real Page/OA, hosted database or provider send.
 */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const crypto=require('node:crypto');

const sdk=fs.readFileSync(path.join(__dirname,'INACTIVE_SIGNED_CHANNEL_STORE_COMMERCE_SDK.js'),'utf8');
const scripts=[...sdk.matchAll(/jsCode:("(?:\\.|[^"\\])*")/g)].map(m=>JSON.parse(m[1]));
assert.equal(scripts.length,5,'expected generator, verifier, registry gate, commerce and final gate');

const T1='11111111-1111-4111-8111-111111111111';
const T2='22222222-2222-4222-8222-222222222222';
const SA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const SC='cccccccc-cccc-4ccc-8ccc-cccccccccccc';

const REGISTRY=[
 ['MESSENGER','QA_PAGE_A',T1,SA,'QA_BOT_A_V1','ACTIVE',2000000000000],
 ['MESSENGER','QA_PAGE_B',T1,SB,'QA_BOT_B_V1','ACTIVE',2000000000000],
 ['ZALO_OA','QA_OA_B',T1,SB,'QA_BOT_B_V1','ACTIVE',2000000000000],
 ['ZALO_BOT','QA_BOT_ROUTE_A',T1,SA,'QA_BOT_A_V1','ACTIVE',2000000000000],
 ['WEBSITE','QA_WIDGET_C',T2,SC,'QA_BOT_C_V1','ACTIVE',2000000000000],
 ['MESSENGER','QA_PAGE_REVOKED',T1,SA,'QA_BOT_A_V1','REVOKED',2000000000000],
 ['MESSENGER','QA_PAGE_EXPIRED',T1,SA,'QA_BOT_A_V1','ACTIVE',1600000000000]
].map(([provider,installation_ref,tenant_id,store_id,bot_profile_version,binding_status,expires_at_ms])=>({
 provider,installation_ref,tenant_id,store_id,bot_profile_version,binding_status,
 expires_at_ms,registry_version:1,qa_owner_marker:true,qa_only:true,read_only:true,
 approval_scope:'QA_SYNTHETIC_NO_REAL_OWNER'
}));
const CATALOG=[
 [T1,SA,'A002','QA áo mẫu A',159000,5],
 [T1,SA,'A003','QA sản phẩm riêng A',99000,4],
 [T1,SB,'A002','QA hàng mẫu B',259000,2],
 [T2,SC,'A002','QA hàng mẫu C',309000,8]
].map(([tenant_id,store_id,sku,product_name,price_vnd,stock])=>({
 tenant_id,store_id,sku,product_name,price_vnd,stock,
 active:true,catalog_revision:1,qa_only:true
}));
const clone=x=>JSON.parse(JSON.stringify(x));
function execute(js,inputs,refs={}){
 const items=inputs.map(x=>({json:x}));
 const ctx={
  require:(s)=>{if(s==='crypto')return crypto;throw Error('UNAPPROVED_NODE_IMPORT')},
  Buffer,
  $input:Object.freeze({
   first:()=>items[0],
   all:()=>items
  }),
  $:(name)=>{
   if(!Object.hasOwn(refs,name))throw Error('UNKNOWN_REFERENCE_NODE');
   const out=refs[name].map(x=>({json:x}));
   return Object.freeze({first:()=>out[0],all:()=>out});
  }
 };
 const x=vm.runInNewContext('(function(){'+js+'\n})()',ctx,{timeout:1500});
 return clone(x.map(row=>row.json));
}
function fixture({registry=REGISTRY,catalog=CATALOG,mutateCases,mutateAttestations}={}){
 const generated=execute(scripts[0],[{}])[0];
 if(mutateCases)mutateCases(generated.cases);
 const signatures=execute(scripts[1],[generated])[0];
 if(mutateAttestations)mutateAttestations(signatures.attestations);
 const guard=execute(scripts[2],registry)[0];
 const commerce=execute(scripts[3],catalog,{
  'Generate G06 Signed Channel Fixtures':[generated],
  'Verify G06 Native-Shaped QA Signatures':[signatures],
  'Validate G06 Synthetic Installation Registry':[guard],
  'Read G06 QA Installation Registry':registry
 })[0];
 return {generated,signatures,guard,commerce,
  final:()=>execute(scripts[4],[commerce])[0]};
}
function blocked(name,mutation,target,rex){
 test(name,()=>{
  const opts={};opts[target==='registry'?'registry':target==='catalog'?'catalog':'none']=
    target==='registry'?clone(REGISTRY):target==='catalog'?clone(CATALOG):undefined;
  if(target==='registry'||target==='catalog'){
   mutation(opts[target]);
   assert.throws(()=>fixture(opts),rex);
  }else if(target==='case'){
   const x=fixture({mutateCases:mutation});
   assert.throws(()=>x.final(),rex);
  }
 });
}
test('QA workflow SDK has exact 8 manual+Code+Data Table GET-only nodes',()=>{
 assert.equal((sdk.match(/n8n-nodes-base\.manualTrigger/g)||[]).length,1);
 assert.equal((sdk.match(/n8n-nodes-base\.code/g)||[]).length,5);
 assert.equal((sdk.match(/n8n-nodes-base\.dataTable/g)||[]).length,2);
 assert.equal((sdk.match(/operation:'get'/g)||[]).length,2);
 for(const danger of ['n8n-nodes-base.webhook','n8n-nodes-base.httpRequest',
 'n8n-nodes-base.googleSheets','n8n-nodes-base.postgres','n8n-nodes-base.supabase',
 '@n8n/n8n-nodes-langchain','newCredential(','process.env'])
  assert.equal(sdk.includes(danger),false,danger);
});
test('reuse only G05 QA persistent registry and catalog IDs, not DEMO or hosted',()=>{
 assert.ok(sdk.includes('3KfooDe1hXk3yN0r'));
 assert.ok(sdk.includes('qOrmoXfIobogX16d'));
 assert.ok(sdk.includes('QA_SYNTHETIC_NO_REAL_OWNER'));
 assert.equal(sdk.includes('TIEN404_COMMERCE_ORDERS'),false);
});
test('complete 36 signed-shaped native to Store Commerce QA corpus passes',()=>{
 const f=fixture(),r=f.final();
 assert.equal(r.status,'G06_SIGNED_SHAPED_QA_36_OF_36_PASS');
 assert.equal(r.total,36);assert.equal(r.passed,36);
 assert.equal(r.allowed,7);assert.equal(r.denied,28);assert.equal(r.duplicate,1);
 assert.equal(r.provider_sends,0);assert.equal(r.orders_written,0);
 assert.equal(r.stock_written,0);assert.equal(r.hosted_writes,0);
 assert.equal(r.can_publish,false);assert.equal(r.release_status,'HOSTED_NO_GO');
});
test('same-Tenant Shop A/B prices correctly isolated and Zalo OA resolves B',()=>{
 const a=fixture().commerce.results;
 assert.equal(a[0].observed_total_vnd,318000);
 assert.equal(a[1].observed_total_vnd,518000);
 assert.equal(a[2].observed_total_vnd,259000);
 assert.equal(a[3].observed_total_vnd,318000);
 assert.equal(a[4].observed_total_vnd,309000);
 assert.equal(a[5].observed_total_vnd,159000);
 assert.equal(a[6].observed_total_vnd,259000);
});
test('Meta body HMAC tamper is denied',()=>{
 const f=fixture();
 for(const n of [7,8,9]){
  assert.equal(f.commerce.results[n].actual,'DENY',f.commerce.results[n].case_id);
  assert.equal(f.commerce.results[n].observed_total_vnd,null);
 }
});
test('Zalo Bot secret-header violations blocked; header is NOT body integrity proof',()=>{
 const f=fixture();
 for(const n of [10,11])assert.equal(f.commerce.results[n].actual,'DENY');
 assert.equal(f.signatures.attestations[3].reason,'QA_BOT_HEADER_ONLY');
 assert.equal(f.final().real_provider_signature_verified,false);
});
test('Zalo OA fake HMAC rejects missing/wrong QA header and is not native OA proof',()=>{
 const f=fixture();
 for(const n of [12,13])assert.equal(f.commerce.results[n].actual,'DENY');
 assert.equal(f.signatures.attestations[2].reason,'QA_NON_NATIVE_OA_HMAC_ONLY');
 assert.equal(f.final().zalo_oa_hmac_tested,'QA_NON_NATIVE_HMAC_ONLY');
});
test('website QA MAC rejects wrong/missing QA header, not a real user session',()=>{
 const f=fixture();
 for(const n of [14,15])assert.equal(f.commerce.results[n].actual,'DENY');
 assert.equal(f.final().real_cross_channel_identity_verified,false);
});
test('Page/OA expired and revoked bindings refused before Catalog data',()=>{
 const f=fixture();
 for(const n of [16,17,18,19,20])assert.equal(f.commerce.results[n].actual,'DENY');
});
test('tenant/store authority hints in signed input are refused',()=>{
 const f=fixture();
 for(const n of [21,22])assert.equal(f.commerce.results[n].actual,'DENY');
 assert.equal(f.commerce.results[21].reason,'CLIENT_SCOPE_CLAIM');
 assert.equal(f.commerce.results[22].reason,'CLIENT_SCOPE_CLAIM');
});
test('old/future provider message and unknown installation are refused',()=>{
 const f=fixture();
 for(const n of [23,24,25,26,27])assert.equal(f.commerce.results[n].actual,'DENY');
});
test('unsupported order write and cross-Shop SKU denied',()=>{
 const f=fixture();
 for(const n of [28,29,30,31,32,33])assert.equal(f.commerce.results[n].actual,'DENY');
});
test('same signed raw event ID replay denied even across QA case names',()=>{
 const f=fixture();
 assert.equal(f.commerce.results[34].actual,'DUPLICATE');
 assert.equal(f.commerce.results[34].observed_total_vnd,null);
});
test('same ID but different *validly QA-signed* body denied as conflict',()=>{
 const f=fixture();
 assert.equal(f.commerce.results[35].actual,'DENY');
 assert.equal(f.commerce.results[35].reason,'QA_EVENT_ID_REUSED_WITH_DIFFERENT_BODY');
});
blocked('registry missing row refused',r=>r.pop(),'registry',/G05_QA_REGISTRY_COUNT_DRIFT/);
blocked('registry duplicate installation refused',r=>r[1].installation_ref=r[0].installation_ref,'registry',/G05_QA_REGISTRY_AMBIGUOUS_INSTALLATION/);
blocked('registry forged Store B for Page A refused',r=>r[0].store_id=SB,'registry',/G05_QA_REGISTRY_AUTHORITY_OR_FIXTURE_DRIFT/);
blocked('registry Owner claim false refused',r=>r[0].qa_owner_marker=false,'registry',/G05_QA_REGISTRY_AUTHORITY_OR_FIXTURE_DRIFT/);
blocked('registry fake Owner approval changes not permitted',r=>r[0].approval_scope='REAL_OWNER_APPROVED','registry',/G05_QA_REGISTRY_AUTHORITY_OR_FIXTURE_DRIFT/);
blocked('registry extra credential field rejected',r=>r[0].token='NEVER_REAL','registry',/G05_QA_REGISTRY_SCHEMA_DRIFT/);
blocked('catalog wrong Tenant for Store B refused',r=>r[2].tenant_id=T2,'catalog',/G06_STORE_CATALOG_SOURCE_INVALID/);
blocked('catalog Store B price changes refused',r=>r[2].price_vnd=1,'catalog',/G06_CATALOG_PRICE_OR_SKU_SCOPE_DRIFT/);
blocked('catalog fake zero Stock or dirty values wrong scope refused',r=>r[0].price_vnd=-1,'catalog',/G06_STORE_CATALOG_SOURCE_INVALID/);
blocked('catalog duplicated Store SKU refused',r=>r[2]={...r[0]},'catalog',/G06_CATALOG_PRICE_OR_SKU_SCOPE_DRIFT/);
blocked('catalog Order/customer PII extra field refused',r=>r[0].customer_phone='QA_NEVER_USE','catalog',/G06_STORE_CATALOG_SOURCE_INVALID/);
blocked('captured QA expected count tamper rejected',c=>c[0].expected='DENY','case',/G06_CASE_FAILED_QA_G06_01/);
blocked('captured QA expected VND tamper rejected',c=>c[0].expected_total_vnd=1,'case',/G06_PRICE_INCONSISTENT_QA_G06_01/);
test('signed Meta raw payload edited after signature generation cannot authorize Cart',()=>{
 const f=fixture({mutateCases:cases=>cases[0].raw_body=cases[0].raw_body.replace('A002','A003')});
 assert.equal(f.signatures.attestations[0].status,'DENY');
 assert.equal(f.signatures.attestations[0].reason,'QA_HMAC_BODY_NOT_VERIFIED');
 assert.throws(()=>f.final(),/G06_CASE_FAILED_QA_G06_01/);
});
test('validly QA-signed client scope claim fails after signature validation',()=>{
 const f=fixture();
 assert.equal(f.signatures.attestations[21].reason,'CLIENT_SCOPE_CLAIM');
 assert.equal(f.signatures.attestations[22].reason,'CLIENT_SCOPE_CLAIM');
});
test('fixture root cannot carry unapproved client tenant/store/role values',()=>{
 const f=fixture({mutateCases:cases=>cases[0].storeId=SA});
 assert.equal(f.signatures.attestations[0].status,'DENY');
 assert.equal(f.signatures.attestations[0].reason,'QA_ONLY_ENVELOPE_REQUIRED');
 assert.throws(()=>f.final(),/G06_CASE_FAILED_QA_G06_01/);
});
test('input branch replays intentionally in memory only; never certifies durable replay',()=>{
 const f=fixture();
 assert.equal(f.signatures.durable_replay_verified,false);
 assert.equal(f.commerce.durable_replay_verified,false);
 assert.equal(f.final().real_jwt_rls_verified,false);
});
test('final output never returns real or fake Tenant/Store UUID, credentials or PII',()=>{
 const result=fixture().final(),s=JSON.stringify(result);
 for(const val of [T1,T2,SA,SB,SC,'QA_G06_FAKE_META_APP_SECRET_NEVER_PROD',
   'QA_G06_FAKE_BOT_HEADER_NEVER_PROD','customer_phone'])
  assert.equal(s.includes(val),false,val);
});
