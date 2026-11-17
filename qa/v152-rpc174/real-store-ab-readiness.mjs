/** TIEN404 RPC17.4 — read-only UAT readiness contract; never a hosted admission.
 * Caller metadata is UNTRUSTED. This module intentionally cannot verify JWT signatures,
 * query Supabase or authorize any operations. Require an independent private verifier.
 */
export const REQUIRED=Object.freeze([
 'private_operator_independently_verified',
 'owner_approval_verified',
 'finance_no_new_cost_or_approved_limit',
 'supabase_auth_jwt_A_verified_by_issuer',
 'supabase_auth_jwt_B_verified_by_issuer',
 'auth_session_A_active_rechecked',
 'auth_session_B_active_rechecked',
 'two_distinct_auth_subjects',
 'same_tenant_membership_verified_db',
 'store_A_membership_verified_db',
 'store_B_membership_verified_db',
 'server_canonical_store_resolver_verified',
 'independent_store_isolation_RLS_negative',
 'independent_cross_tenant_RLS_negative',
 'hosted_sqlite_no_send_gate_verified',
 'private_scanner_CDR_verified',
 'rollback_evidence_verified',
 'merchant_ownership_primary_4of4_verified',
 'cloudflare_access_still_deny_all',
 'no_real_upload_or_send'
]);
const blocked=(missing)=>Object.freeze({
 status:'BLOCKED_PRIVATE_UAT_NOT_AUTHORIZED',
 missing:Object.freeze([...new Set(missing)]),
 can_upload:false,can_send:false,can_open_access:false,can_deploy:false,
 can_assert_real_store_ab_pass:false
});
const goodId=(x)=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
const own=(o,k)=>!!o&&Object.hasOwn(o,k);
export function inspectRealStoreAbReadiness(evidence={},session={},policy={}){
 try {
  const missing=REQUIRED.filter(key=>evidence?.[key]!==true);
  if(!session||typeof session!=='object'||!goodId(session.tenant_id))missing.push('tenant_id_not_verified');
  if(!goodId(session.user_A)||!goodId(session.user_B)||session.user_A===session.user_B)missing.push('distinct_auth_users_absent');
  if(!goodId(session.store_A)||!goodId(session.store_B)||session.store_A===session.store_B)missing.push('distinct_store_ids_absent');
  if(!goodId(session.session_A)||!goodId(session.session_B)||session.session_A===session.session_B)missing.push('distinct_sessions_absent');
  // Never treat a user-provided token, metadata or JWT decode as proof.
  if(own(session,'access_token')||own(session,'refresh_token')||own(session,'service_role')||own(session,'user_metadata')||own(session,'raw_jwt'))missing.push('secret_or_untrusted_claim_present');
  if(policy?.workers_dev!==false||policy?.preview_urls!==false||policy?.allow_policy_count!==0)missing.push('access_not_closed');
  if(policy?.real_file_upload!==false||policy?.outbound_send!==false)missing.push('no_send_not_enforced');
  return blocked(missing.length?missing:['independent_hosted_acceptance_required']);
 }catch{return blocked(['invalid_input']);}
}
export function safeUatTrace(trace){
 // Never log tokens, PII, file bytes, provider raw responses, or merchant identity.
 const allow=new Set(['case_id','stage','result','reason']);
 if(!trace||typeof trace!=='object')return Object.freeze({stage:'invalid',result:'BLOCKED'});
 const out={};for(const key of ['case_id','stage','result','reason']){
   const v=trace[key];if(typeof v==='string'&&v.length<=100&&/^[a-zA-Z0-9_. -]+$/.test(v))out[key]=v;
 }
 return Object.freeze(out);
}
export function noSendCanaryDecision(){
 return Object.freeze({status:'NO_GO',can_upload:false,can_send:false,can_open_access:false,can_deploy:false,reason:'NEEDS_INDEPENDENT_AUTHENTICATED_HOSTED_ACCEPTANCE'});
}
