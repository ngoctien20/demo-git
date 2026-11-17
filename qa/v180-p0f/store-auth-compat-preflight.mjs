// TIEN404 V18.0-P0F — source-only compatibility and private admission preflight.
// This module NEVER authenticates a JWT, never reaches a provider/database,
// and can NEVER authorize a hosted schema change, role grant, external send or release.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA=/^[0-9a-f]{64}$/i;
const core=['products','orders','order_items','customers','conversations','messages','tenant_memberships'];
const forbiddenKeys=/^(access_token|refresh_token|authorization|api_key|secret|client_secret|service_role|password|jwt|raw_jwt|private_key)$/i;
function hasSensitiveKey(o, depth=0){
 if(!o || typeof o!=='object' || depth>4)return false;
 for(const [k,v] of Object.entries(o)){
  if(forbiddenKeys.test(k))return true;
  if(v && typeof v==='object' && hasSensitiveKey(v,depth+1))return true;
 }
 return false;
}
const deny=(status,blockers,extras={})=>Object.freeze({
 status,blockers:Object.freeze([...blockers]),canMigrate:false,
 canModifyHosted:false,canCallHostedRpc:false,canSendProvider:false,
 canPublish:false,canAcceptJWT:false,...extras
});
export function inspectCompatibility(snapshot){
 const b=[];
 if(!snapshot || typeof snapshot!=='object' || Array.isArray(snapshot))
   return deny('INVALID_SNAPSHOT',['MISSING_READ_ONLY_BASELINE']);
 if(snapshot.project_ref!=='ifxlvrhyjhbzbrkdsida')b.push('PROJECT_MISMATCH');
 if(snapshot.scope!=='METADATA_ONLY_NO_SECRET_NO_CUSTOMER_ROWS')b.push('NOT_SANITIZED');
 if(snapshot.release_authority!=='NO_GO')b.push('RELEASE_AUTHORITY_CHANGED');
 if(snapshot.stores_table_present!==false || snapshot.store_memberships_table_present!==false)
   b.push('STAGING_DRIFT_NEEDS_NEW_READ_ONLY_AUDIT');
 const a=Array.isArray(snapshot.table_surfaces)?snapshot.table_surfaces:[];
 if(a.length!==7 || core.some(t=>a.filter(x=>x.table===t).length!==1))
   b.push('SEVEN_COMMERCE_SURFACES_REQUIRED');
 for(const row of a){
  if(!row.has_tenant_id || row.has_store_id!==false) b.push('SCHEMA_CHANGED_OR_INCOMPLETE_'+row.table);
  if(row.rls!==true || row.force_rls!==true) b.push('RLS_BASELINE_DRIFT_'+row.table);
  if(row.anon_select!==false || row.authenticated_select!==true)
    b.push('API_GRANT_DRIFT_'+row.table);
 }
 if(snapshot.real_auth_store_ab_jwt_verified!==false ||
    snapshot.same_tenant_store_authority_independently_verified!==false)
   b.push('UNPROVEN_OWNER_OR_AUTH_STATUS');
 if(!Array.isArray(snapshot.external_contract_surfaces) ||
    !snapshot.external_contract_surfaces.some(x=>x.surface==='public.save_merchant_product' && x.has_store_id===false))
   b.push('PRIVILEGED_RPC_GAP_NOT_CAPTURED');
 if(!Array.isArray(snapshot.n8n_boundaries) || snapshot.n8n_boundaries.length<4 ||
    snapshot.n8n_boundaries.some(x=>x.released_store_scoped!==false))
   b.push('LIVE_CHANNEL_CONTRACT_NOT_VERIFIED');
 const status=b.length?'RECHECK_REQUIRED':'TENANT_ONLY_BASELINE_VERIFIED';
 return deny(status,[...b,
  'NO_CANONICAL_STORE_MEMBERSHIPS','TENANT_ONLY_PUBLIC_COMMERCE',
  'STORE_SCOPED_SECURITY_DEFINER_NOT_DEPLOYED','REAL_AUTH_AB_NO_SEND_NOT_EXECUTED',
  'M0_RECOVERY_DEFERRED_SOURCE_ONLY'],{sourceOnlyMatrixReady:b.length===0});
}
export function inspectPrivateOwnerPairing(snapshot,evidence){
 const baseline=inspectCompatibility(snapshot);
 const b=[];
 if(!baseline.sourceOnlyMatrixReady)b.push('BASELINE_NOT_VERIFIED');
 if(!evidence || typeof evidence!=='object' || Array.isArray(evidence))
   return deny('BLOCKED',['NO_PRIVATE_EVIDENCE',...b]);
 if(hasSensitiveKey(evidence))b.push('RAW_CREDENTIAL_OR_TOKEN_IN_METADATA');
 if(evidence.environment!=='PRIVATE_QA_NO_SEND')b.push('PRIVATE_QA_REQUIRED');
 if(evidence.actor_consented!==true || evidence.independent_reviewer_present!==true)
   b.push('INDEPENDENT_CONSENT_AND_REVIEW_REQUIRED');
 if(!UUID.test(evidence.tenant_id||'')||
   !UUID.test(evidence.store_a_id||'')||!UUID.test(evidence.store_b_id||'')||
   evidence.store_a_id===evidence.store_b_id)
   b.push('SAME_TENANT_DISTINCT_STORE_UUID_PROOF_MISSING');
 if(!SHA.test(evidence.actor_a_fingerprint||'')||
    !SHA.test(evidence.actor_b_fingerprint||'') ||
    evidence.actor_a_fingerprint===evidence.actor_b_fingerprint)
   b.push('DISTINCT_ACTORS_NOT_PROVEN');
 const req=['owner_a_consent','owner_b_consent','store_registry','membership_readback',
  'session_verification_a','session_verification_b','signed_ingress_boundary',
  'independent_denials'];
 const hashes=evidence.evidence_hashes||{};
 if(req.some(k=>!SHA.test(hashes[k]||'')))b.push('REQUIRED_EVIDENCE_SHA256_MISSING');
 if(evidence.real_auth_attested_by_authorized_operator!==true ||
    evidence.store_scope_verified_server_side!==true ||
    evidence.no_provider_send!==true ||
    evidence.no_customer_data!==true)
   b.push('REAL_AUTH_OR_SCOPE_NOT_INDEPENDENTLY_ATTESTED');
 // There is no actual public Store schema in the currently verified baseline;
 // even with a complete *self-described* manifest, real hosted A/B still cannot be accepted.
 return deny(b.length?'BLOCKED':'PRIVATE_INDEPENDENT_REVIEW_REQUIRED',
  [...b,'HOSTED_CANONICAL_STORE_SCHEMA_MISSING',
       'REAL_JWT_SIGNATURE_SESSION_AND_RLS_NOT_VERIFIED_BY_THIS_MODULE'],
  {mayPrivatelyReviewEvidence:b.length===0,realAuthTested:false,hostedABAdmission:false});
}
const scenarios=[
['AUTH01','A_VALID_ISSUER_AUDIENCE_SIGNATURE_SESSION','ALLOW'],
['AUTH02','B_VALID_ISSUER_AUDIENCE_SIGNATURE_SESSION','ALLOW'],
['AUTH03','BAD_SIGNATURE','DENY'],
['AUTH04','WRONG_ISSUER','DENY'],
['AUTH05','WRONG_AUDIENCE','DENY'],
['AUTH06','EXPIRED_ACCESS_TOKEN','DENY'],
['AUTH07','REVOKED_SESSION','DENY'],
['AUTH08','EDITABLE_USER_METADATA_OWNER_SPOOF','DENY'],
['AUTH09','ANON_NO_SESSION','DENY'],
['STORE10','A_READ_A','ALLOW'],
['STORE11','B_READ_B','ALLOW'],
['STORE12','A_READ_B_SAME_TENANT','DENY'],
['STORE13','B_READ_A_SAME_TENANT','DENY'],
['STORE14','A_READ_OTHER_TENANT','DENY'],
['STORE15','STAFF_MODIFY_PRODUCT','DENY'],
['STORE16','DUAL_MEMBER_CROSS_STORE_TRANSFER','DENY'],
['STORE17','STALE_REVOKED_MEMBERSHIP','DENY'],
['STORE18','SUSPENDED_STORE','DENY'],
['STORE19','REQUEST_BODY_STORE_SPOOF','DENY'],
['STORE20','PROVIDER_INSTALLATION_STORE_MISMATCH','DENY'],
['ORDER21','GUESS_OTHER_CUSTOMER_ORDER_ID','DENY'],
['ORDER22','UNVERIFIED_CROSS_CHANNEL_IDENTITY_LINK','DENY'],
['ORDER23','CONSUMED_OR_EXPIRED_IDENTITY_OTP','DENY'],
['ORDER24','INVALID_PROVIDER_NATIVE_SIGNATURE','DENY'],
['ORDER25','SERVICE_ROLE_CLIENT_BYPASS','DENY'],
['ORDER26','ORDER_PRODUCT_DIFFERENT_STORE_FK','DENY'],
['ORDER27','ORDER_CUSTOMER_DIFFERENT_STORE_FK','DENY'],
['ORDER28','SAME_STORE_AUTHORIZED_ORDER_READ','ALLOW'],
['CATALOG29','SAME_SKU_DIFFERENT_STORES_DISTINCT_PRICE','ALLOW'],
['POLICY30','NO_EXTERNAL_PROVIDER_SEND','DENY'],
['POLICY31','NO_LIVE_CUSTOMER_DATA','DENY']
];
export function noSendUatCases(){
 return Object.freeze(scenarios.map(([id,scenario,expected])=>Object.freeze({
  id,scenario,expected,actual:'NOT_RUN',evidence_sha256:null,
  environment:'PRIVATE_QA_NO_SEND',runtimeVerified:false
 })));
}
export function inspectUatReceipts(receipts){
 const plan=noSendUatCases();
 if(!Array.isArray(receipts)||receipts.length!==plan.length)
  return deny('BLOCKED',['COMPLETE_CASE_MATRIX_REQUIRED']);
 const byId=new Map(receipts.map(x=>[x?.id,x]));
 const b=[];
 if(byId.size!==plan.length)b.push('DUPLICATE_CASE_OR_MISSING_ID');
 for(const c of plan){
  const r=byId.get(c.id);
  if(!r || r.expected!==c.expected || r.scenario!==c.scenario)
    b.push('CASE_CONTRACT_DRIFT_'+c.id);
  if(r?.actual!=='NOT_RUN' || r?.runtimeVerified!==false)
    b.push('UNAUTHORIZED_RESULT_IN_SOURCE_ONLY_MANIFEST_'+c.id);
  if(r?.evidence_sha256!==null)
    b.push('INVENTED_EVIDENCE_IN_SOURCE_MANIFEST_'+c.id);
 }
 return deny(b.length?'BLOCKED':'PREPARED_NOT_EXECUTED',
  [...b,'NO_HOSTED_TEST_HAS_RUN','M0_RECOVERY_REQUIRED_BEFORE_HOSTED_MIGRATION'],
  {testCasesDefined:plan.length,realUatExecuted:false,canScheduleHostedUat:false});
}
