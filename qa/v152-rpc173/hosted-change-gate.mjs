/** RPC17.3: static, no-network hosted change-control gate. No deployment authorization. */
export const REQUIREMENTS=Object.freeze([
 'owner_verified_out_of_band',
 'separate_security_reviewer_verified',
 'finance_incremental_cost_signed',
 'private_operator_mfa_verified',
 'supabase_real_same_tenant_ab_jwt_uat',
 'store_authority_canonical_proof',
 'hosted_sqlite_atomic_replay_evidence',
 'hosted_sqlite_restart_evidence',
 'scanner_isolated_malware_and_cdr',
 'scanner_independent_signed_clean_evidence',
 'cloudflare_private_access_allow_scope_reviewed',
 'rate_limit_abuse_and_replay_tests',
 'no_send_canary_evidence',
 'private_evidence_retention_and_rollback'
]);
export function inspectHostedProposal(evidence={},config={}){
 const missing=REQUIREMENTS.filter(field=>evidence?.[field]!==true);
 if(config?.workers_dev!==false)missing.push('workers_dev_must_be_false');
 if(config?.preview_urls!==false)missing.push('preview_urls_must_be_false');
 if(config?.routes?.length!==0)missing.push('zero_routes_required');
 if(config?.real_merchant_upload!==false)missing.push('no_real_merchant_upload');
 if(config?.uses_existing_rpc16_worker!==false)missing.push('preserve_rpc16_worker');
 return Object.freeze({
  reviewed:missing.length===0,missing:Object.freeze(missing),
  can_deploy:false,can_create_hosted_do:false,can_change_access:false,can_upload:false,can_send:false,
  status:missing.length?'BLOCKED':'REVIEW_ONLY_SEPARATE_APPROVAL_REQUIRED'
 });
}
