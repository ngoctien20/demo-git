/**
 * TIEN404 V17.4P independent release ADMISSION matrix.
 * THIS IS AN OPERATOR PRE-FLIGHT REPORT, NOT AN AUTHORIZATION API.
 * Never accept browser-owned flags here. Real proof must originate from
 * Cloudflare control plane, DNS challenge + trusted Store Owner DB, with audit.
 */
export const GATE_CONTRACT='T404_V174P_HOSTED_RELEASE_GATES_V1';
const sourceLabels=Object.freeze([
 'separate_worker_created',
 'host_control_verified',
 'access_app_bound_to_issuer',
 'access_jwt_audience_confirmed',
 'session_secret_in_secret_manager',
 'jwk_rotation_runbook_approved',
 'durable_object_bound_and_atomic_tested',
 'private_uat_operator_approved',
 'cost_scope_approved',
 'browser_uat_on_hosted_origin_passed',
 'worker_access_all_routes_and_preview_verified',
 'access_operator_only_no_bypass_verified',
 'do_replay_ttl_alarm_hosted_verified',
 'operator_rate_429_hosted_verified'
]);
const liveLabels=Object.freeze([
 'actual_merchant_domain_dns_challenge_verified',
 'store_owner_membership_verified_independently',
 'hosted_store_rls_a_b_passed',
 'customer_identity_proof_approved',
 'production_recovery_gate_approved',
 'real_provider_authority_approved',
 'live_rollout_scope_approved'
]);
export function evaluateReleaseGate(evidence={}){
 if(!evidence||typeof evidence!=='object'||Array.isArray(evidence))evidence={};
 const check=keys=>keys.map(gate=>({gate,verified:evidence[gate]===true}));
 const privateQA=check(sourceLabels),live=check(liveLabels);
 const qaReady=privateQA.every(x=>x.verified);
 const realReady=qaReady&&live.every(x=>x.verified);
 return Object.freeze({
  contract:GATE_CONTRACT,
  status:realReady?'EVIDENCE_REQUIRES_INDEPENDENT_FINAL_AUDIT':
   qaReady?'PRIVATE_QA_CANDIDATE_REQUIRES_HOSTED_REATTESTATION':'BLOCKED',
  private_qa_missing:privateQA.filter(x=>!x.verified).map(x=>x.gate),
  real_commerce_missing:live.filter(x=>!x.verified).map(x=>x.gate),
  private_hosted_browser_uat_independently_verified:false,
  merchant_domain_owner_verified_by_this_module:false,
  hosted_store_rls_verified_by_this_module:false,
  real_commerce_authorized:false,
  cloudflare_or_render_resource_changed:false
 });
}
