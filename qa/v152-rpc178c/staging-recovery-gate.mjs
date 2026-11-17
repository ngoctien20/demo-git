/** RPC17.8C — independent Supabase staging backup/restore evidence intake.
 * This is NOT a Supabase backup interface. Never accept mocked CI drill as live proof.
 */
const REQUIRE=Object.freeze([
 'staging_snapshot_ref_attested_privately',
 'staging_snapshot_sha256_attested_privately',
 'snapshot_includes_required_auth_and_public_schemas',
 'restore_executed_in_isolated_staging_compatible_environment',
 'restored_schema_inventory_matches_signed_baseline',
 'restored_row_integrity_checks_passed',
 'restored_rls_and_grants_negative_checks_passed',
 'independent_reviewer_signed_receipt',
 'merchant_owner_signed_exact_ddl_scope',
 'fresh_operator_mfa_and_scope_verified',
 'explicit_no_new_cost_approval',
 'signed_rollback_plan_verified',
 'no_real_customer_export_to_ci',
 'provider_signature_and_owner_pairing_reviewed'
]);
const noGo=(reason,missing=[])=>Object.freeze({status:'BLOCKED',reason,missing:Object.freeze(missing),can_apply_supabase_ddl:false,can_restore_supabase:false,can_delete_backup:false,can_open_access:false,can_run_real_jwt_uat:false,can_send:false});
export function reviewStagingRestoreEvidence(input={}){
 try{
  const {evidence,source,approval}=input||{};
  const missing=REQUIRE.filter(k=>evidence?.[k]!==true);
  if(source?.project!=='ifxlvrhyjhbzbrkdsida'||source?.schema!=='rpc178_qa')missing.push('PROJECT_OR_SCHEMA_MISMATCH');
  if(source?.origin!=='LIVE_SUPABASE_SIGNED_RESTORE_ATTESTATION')missing.push('NO_REAL_SUPABASE_RESTORE_RECEIPT');
  if(source?.github_disposable_only!==false)missing.push('CI_FIXTURE_NOT_SUFFICIENT');
  if(approval?.authorized_ddl_sha256==null||!/^[0-9a-f]{64}$/i.test(approval.authorized_ddl_sha256))missing.push('IMMUTABLE_DDL_SHA_MISSING');
  if(approval?.operator_identity_receipt!==true||approval?.independent_reviewer_receipt!==true)missing.push('INDEPENDENT_AUTHORITY_NOT_VERIFIED');
  // A JSON string or toggled flag can never become a trusted backend receipt.
  return noGo(missing.length?'SUPABASE_RECOVERY_EVIDENCE_INCOMPLETE':'EXTERNAL_SIGNED_RECEIPT_NOT_VERIFIED',missing);
 }catch{return noGo('FAIL_CLOSED',['INVALID_INPUT']);}
}
export const REQUIREMENT_IDS=REQUIRE;
export const realMigrationDecision=()=>noGo('SIGNED_RECOVERY_AND_OWNER_APPROVAL_NO_GO');
