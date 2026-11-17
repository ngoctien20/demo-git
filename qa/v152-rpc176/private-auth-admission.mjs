/** RPC17.6 — no-token, no-send UAT admission review.
 * Presence of Auth session ROWS or boolean checkboxes is never real JWT acceptance.
 * An independent private verifier must produce authenticated, session-bound,
 * signed evidence in a separate channel; NONE of those actions are here.
 */
export const EVIDENCE_FIELDS=Object.freeze([
 'private_owner_operator_verified_out_of_band',
 'security_reviewer_independent',
 'schema_snapshot_and_recovery_approved',
 'disposable_store_a_b_authority_approved',
 'actual_supabase_jwt_A_issuer_verified',
 'actual_supabase_jwt_B_issuer_verified',
 'distinct_live_supabase_sessions_verified',
 'verified_memberships_same_tenant_distinct_stores',
 'authenticated_postgrest_RLS_ab_negative_pass',
 'authenticated_postgrest_RLS_cross_tenant_negative_pass',
 'revocation_and_stale_session_denial_pass',
 'cloudflare_access_still_deny_all',
 'no_send_no_upload_observed',
 'finance_cost_boundary_approved'
]);
export const reviewRealAbAdmission=(evidence,context={})=>{
 const missing=EVIDENCE_FIELDS.filter(k=>evidence?.[k]!==true);
 if(!context||context.environment!=='PRIVATE_INDEPENDENT_UAT')missing.push('private_independent_environment');
 if(context?.stored_raw_jwt===true||context?.secret_uploaded===true)missing.push('SECRET_EXPOSURE');
 if(context?.allows_public_url!==false)missing.push('PUBLIC_ROUTE');
 const requirements_met=missing.length===0;
 return Object.freeze({
  status:requirements_met?'HUMAN_REVIEW_REQUIRED':'BLOCKED',
  missing:Object.freeze(missing),
  requirements_met,
  // A checklist is not an authenticated receipt and cannot authorize privileged actions.
  can_accept_real_auth:false,can_assert_uat_pass:false,can_upload:false,
  can_send:false,can_deploy:false,can_open_access:false,
  reason:'UNVERIFIED_EVIDENCE_REQUIRES_INDEPENDENT_PRIVATE_ACCEPTANCE'
 });
};
export function redactQaEvidence(data){
 const allowed=['case_id','result','stage','reason'];
 const output={};
 for(const key of allowed){
  const v=data?.[key];
  if(typeof v==='string'&&v.length<=100&&/^[a-z0-9_. -]+$/i.test(v))output[key]=v;
 }
 return Object.freeze(output);
}
