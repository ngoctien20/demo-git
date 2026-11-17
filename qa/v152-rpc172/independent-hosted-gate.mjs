/** RPC17.2 Independent Hosted Admission Review — evidence assessment ONLY.
 * Explicitly cannot grant cloud release even when synthetic packets are complete.
 */
const FIELDS=Object.freeze([
  'owner_identity_independent','security_reviewer_independent','operator_mfa',
  'finance_approval','budget_ceiling_verified','hosted_do_sqlite_atomic',
  'hosted_do_restart_persistence','hosted_rate_limit_verified',
  'trusted_store_routing','real_supabase_store_ab_jwt',
  'merchant_primary_records_4of4','scanner_isolated_operational',
  'scanner_cdr_validated','scanner_signed_receipts',
  'private_retention_and_rollback','cloudflare_access_scope_verified',
  'dedicated_private_test_canary','no_send_evidence'
]);
export function reviewHostedAdmission(evidence={}){
  const gaps=FIELDS.filter(name=>evidence?.[name]!==true);
  if(evidence?.mode!=='INDEPENDENT_HOSTED_NO_SEND')gaps.unshift('independent_mode');
  const unique=[...new Set(gaps)];
  return Object.freeze({
    status:unique.length?'BLOCKED':'REVIEW_READY_NOT_AUTHORIZED',
    missing:Object.freeze(unique),
    prerequisites_complete:unique.length===0,
    can_upload:false,can_open_access:false,can_send:false,can_release:false,
    reason:'SEPARATE_HUMAN_APPROVAL_AND_HOSTED_VALIDATION_REQUIRED'
  });
}
export const requiredHostedEvidence=FIELDS;
