/**
 * RPC17.8B — deterministic, read-only schema/approval preflight.
 * Cannot verify owner identity, actual Supabase backups, signed approvals,
 * or live JWTs. Its return values NEVER authorize DDL or privileged actions.
 */
import {createHash} from 'node:crypto';
export const TARGET=Object.freeze({project:'ifxlvrhyjhbzbrkdsida',schema:'rpc178_qa'});
export const REQUIRED=Object.freeze([
 'private_owner_challenge_real_verified',
 'store_a_b_canonical_membership_real_verified',
 'operator_fresh_mfa_verified',
 'independent_reviewer_real_verified',
 'signed_exact_ddl_sha_verified',
 'staging_backup_restorable_verified',
 'rehearsed_rollback_verified',
 'zero_grants_and_exposure_verified',
 'snapshot_baseline_reviewed',
 'no_existing_schema_collision',
 'explicit_cost_ceiling_approved',
 'real_auth_a_b_sessions_verified_privately',
 'no_send_canary_reviewed'
]);
const blocked=(reason,missing=[])=>Object.freeze({
 status:'BLOCKED',reason,missing:Object.freeze(missing),
 can_apply_migration:false,can_create_users:false,can_change_grants:false,
 can_open_access:false,can_upload:false,can_send:false,
 real_auth_ab_uat_accepted:false
});
export function hashApprovedCandidate(sql){
 if(typeof sql!=='string'||sql.length<100||sql.length>100000)return null;
 return createHash('sha256').update(Buffer.from(sql,'utf8')).digest('hex');
}
export function inspectRpc178bPreflight({evidence,scope,ddl,baseline}={}){
 try{
  const missing=REQUIRED.filter(x=>evidence?.[x]!==true);
  const actualHash=hashApprovedCandidate(ddl);
  if(!actualHash||actualHash!==scope?.ddl_sha256)missing.push('EXACT_DDL_SHA_MISMATCH');
  if(scope?.project!==TARGET.project||scope?.schema!==TARGET.schema)missing.push('WRONG_STAGING_SCOPE');
  if(scope?.mutate_existing_public!==false||scope?.mutate_auth!==false)missing.push('EXISTING_SCHEMA_MODIFICATION');
  if(scope?.grant_authenticated!==false||scope?.grant_anon!==false||scope?.grant_service_role!==false||scope?.expose_api!==false)missing.push('PERMISSION_OR_API_EXPOSURE');
  if(scope?.send_real_messages!==false||scope?.write_customer_data!==false||scope?.create_paid_branch!==false)missing.push('SIDE_EFFECTS');
  if(baseline?.schema_absent!==true||baseline?.public_store_tables_absent!==true||baseline?.commerce_store_columns_absent!==true)missing.push('STAGING_BASELINE_UNVERIFIED');
  if(scope?.operator_receipt_binding!==actualHash||scope?.reviewer_receipt_binding!==actualHash)missing.push('INDEPENDENT_SIGNED_RECEIPTS_UNVERIFIED');
  // Even all booleans and matching SHA supplied by the same process are not
  // independently attested evidence. No DDL execution is possible from here.
  return blocked(missing.length?'PREFLIGHT_REQUIREMENTS_MISSING':'REAL_SIGNED_APPROVAL_NOT_INDEPENDENTLY_VERIFIED',missing);
 }catch{return blocked('FAIL_CLOSED',['invalid_input']);}
}
export const liveNoSendDecision=()=>blocked('REAL_JWT_AB_AND_HOSTED_SECURITY_NO_GO');
