'use strict';
/**
 * TIEN404 V14.4.3 — offline RPC SECURITY DEFINER review only.
 *
 * The ONLY input is a metadata-only catalog snapshot derived from
 * RPC_AUDIT_READ_ONLY.sql. No passwords, function bodies, vault values,
 * user IDs, raw order rows, JWTs, or client-side trust flags are accepted as
 * authorization. This code intentionally has NO SQL runner or GRANT API.
 */
const PROJECT='ifxlvrhyjhbzbrkdsida';
const PUBLIC={
 save_merchant_product:{
  auth:true,anon:false,
  expect:{uses_auth_uid:true,uses_tenant_membership:true,writes_products:true},
  critical:'P0_PRODUCT_WRITER_TENANT_ONLY',
  next:'V15_STORE_SCOPED_PRODUCT_RPC_REDESIGN_REQUIRED'
 },
 qa_owner_pairing:{
  auth:true,anon:false,
  expect:{uses_auth_uid:true,uses_tenant_membership:true,
    reads_qa_bot_registry:true,has_qa_dry_run_guard:true},
  critical:'P0_PAIRING_USES_QA_IDENTITY_MAP_NOT_CANONICAL_STORE',
  next:'QA_PAIRING_CANNOT_AUTO_PROMOTE_TO_MERCHANT_OA'
 },
 qa_shop_b_zalo_claim:{
  auth:false,anon:true,
  expect:{uses_vault_secret:true,reads_request_headers:true,
    uses_hmac:true,calls_qa_pairing:true},
  critical:'P0_ANON_DEFINER_HEADER_AND_VAULT_GATE_REQUIRES_REAL_INGRESS_REVIEW',
  next:'STAGING_ANON_RPC_KEEP_UNCHANGED_UNTIL_SIGNATURE_AND_REPLAY_REVIEW'
 }
};
const PRIVATE=[
 'claim_owner_pairing_v3_synthetic',
 'confirm_owner_pairing_v3_qa',
 'issue_owner_challenge'
];
const EXPECTED_NAMES=Object.freeze([
 ...Object.keys(PUBLIC).map(x=>'public.'+x),
 ...PRIVATE.map(x=>'tien404_r1_qa.'+x)
]);
const allowedFlagNames=new Set([
 'uses_hmac','uses_lock','uses_auth_uid','writes_products',
 'calls_qa_pairing','uses_vault_secret','has_qa_dry_run_guard',
 'reads_qa_bot_registry','reads_request_headers','uses_store_membership',
 'has_store_id_reference','uses_tenant_membership'
]);
function uniq(xs){return Object.freeze([...new Set(xs)]);}
function reviewRpcCatalog({source,projectRef,rpcs,callerInventoryReviewed=false,
 hostSignatureVerified=false,hostReplayTested=false}={}){
 const blockers=[],reports=[];
 if(source!=='SUPABASE_READ_ONLY_RPC_AUDIT')blockers.push('CATALOG_PROVENANCE_NOT_VERIFIED');
 if(projectRef!==PROJECT)blockers.push('PROJECT_SCOPE_MISMATCH');
 if(!Array.isArray(rpcs))blockers.push('RPC_METADATA_ARRAY_REQUIRED');
 const entries=Array.isArray(rpcs)?rpcs:[];
 const indexes=new Map();
 for(const r of entries){
   const key=(r?.schema||'')+'.'+(r?.function||'');
   indexes.set(key,(indexes.get(key)||0)+1);
 }
 for(const name of EXPECTED_NAMES){
   if(indexes.get(name)!==1)
     blockers.push(indexes.get(name)?'RPC_DUPLICATE_OR_OVERLOADED_'+name:'RPC_MISSING_'+name);
 }
 for(const key of indexes.keys())
  if(!EXPECTED_NAMES.includes(key))blockers.push('UNEXPECTED_RPC_IN_AUDIT');
 for(const r of entries){
  const name=(r?.schema||'')+'.'+(r?.function||'');
  if(!EXPECTED_NAMES.includes(name))continue;
  const isPublic=r.schema==='public';
  const exp=isPublic?PUBLIC[r.function]:null;
  const findings=[];
  if(r.owner!=='postgres')findings.push('OWNER_OR_PRIVILEGE_DRIFT');
  if(r.public_execute!==false)findings.push('PUBLIC_EXECUTE_GRANT_OR_UNKNOWN');
  if(r.security_definer!==isPublic)findings.push('SECURITY_MODE_DRIFT');
  if(typeof r.identity_arguments!=='string'||r.identity_arguments.length<8)
   findings.push('FUNCTION_SIGNATURE_NOT_RECORDED');
  if(isPublic){
    if(r.locked_empty_search_path!==true)
      findings.push('DEFINER_SEARCH_PATH_NOT_LOCKED');
    if(r.authenticated_execute!==exp.auth||r.anon_execute!==exp.anon)
      findings.push('UNEXPECTED_EXECUTE_ROLE');
    for(const [k,v] of Object.entries(exp.expect))
      if(r.flags?.[k]!==v)findings.push('EXPECTED_GUARD_OR_WRITE_PATH_NOT_FOUND_'+k);
    if(r.flags?.uses_store_membership!==true||
       r.flags?.has_store_id_reference!==true) {
      findings.push(exp.critical);
    }
  }else{
    if(r.anon_execute!==false||r.authenticated_execute!==false)
      findings.push('PRIVATE_HELPER_EXPOSED');
    if(r.security_definer!==false)findings.push('PRIVATE_HELPER_PRIVILEGE_DRIFT');
  }
  if(r.flags&&Object.keys(r.flags).some(k=>!allowedFlagNames.has(k)))
    findings.push('UNKNOWN_AUDIT_FLAGS');
  reports.push(Object.freeze({
   name,stage:isPublic?'PUBLIC_DEFINER':'PRIVATE_QA_HELPER',
   auditedMetadataOnly:true,findings:uniq(findings),
   next:isPublic?exp.next:'KEEP_PRIVATE_QA_ONLY',
   approvedForHosted:false
  }));
 }
 if(!callerInventoryReviewed)blockers.push('ALL_RPC_CALL_SITES_NOT_INDEPENDENTLY_AUDITED');
 if(!hostSignatureVerified)blockers.push('HOST_SIGNATURE_AND_HEADER_PROVENANCE_UNVERIFIED');
 if(!hostReplayTested)blockers.push('HOST_EVENT_IDEMPOTENCY_UNVERIFIED');
 const merged=uniq([...blockers,...reports.flatMap(r=>r.findings)]);
 return Object.freeze({
  projectRef:PROJECT,mode:'READ_ONLY_RPC_REVIEW',
  status:'HOSTED_STORE_MIGRATION_BLOCKED',
  reviewed:reports.length,expected:EXPECTED_NAMES.length,
  reports:Object.freeze(reports),blockingFindings:merged,
  // Even a synthetic perfect audit never authorizes changing RPC privileges.
  canRevokeExecute:false,canReplaceFunction:false,
  canApplyRls:false,canPromoteQARpc:false,canSendProviderMessage:false,
  canDeploy:false,requiresIndependentDBAReview:true,
  realHostSignatureTested:false
 });
}
module.exports={PROJECT,EXPECTED_NAMES,reviewRpcCatalog};
