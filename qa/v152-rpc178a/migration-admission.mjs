/** TIEN404 RPC17.8A — private migration acceptance gate (OFFLINE ONLY).
 * This gate cannot grant DDL authorization. Actual approval must be verified
 * independently, out of band, against a signed immutable evidence registry.
 */
export const REQUIRED_PROOFS=Object.freeze([
 'owner_identity_mfa_verified',
 'canonical_store_a_b_ownership_verified',
 'independent_security_reviewer_verified',
 'explicit_disposable_schema_scope_consent',
 'exact_ddl_sha256_reviewed',
 'prechange_backup_inventory_verified',
 'restore_drill_checksum_verified',
 'schema_not_in_exposed_api',
 'minimal_grant_impact_reviewed',
 'supabase_cost_no_new_spend_confirmed',
 'operator_session_bound_to_scope',
 'rollback_separate_approval',
 'real_auth_users_provisioned_private',
 'session_a_b_authenticated_independently',
 'no_send_no_upload_enforced'
]);
const DENY=(reason,missing=[])=>Object.freeze({
 status:'BLOCKED',
 reason,
 missing:Object.freeze([...missing]),
 can_migrate:false,can_create_user:false,can_grant_roles:false,
 can_deploy:false,can_upload:false,can_send:false,
 can_assert_real_auth_uat:false
});
export function reviewMigrationCandidate(evidence={},proposal={}){
 try{
  const missing=REQUIRED_PROOFS.filter(x=>evidence?.[x]!==true);
  if(proposal?.schema_name!=='rpc178_qa')missing.push('SCOPE_MUST_BE_RPC178_QA');
  if(proposal?.mutate_public!==false)missing.push('PUBLIC_SCHEMA_NO_TOUCH');
  if(proposal?.mutate_auth!==false)missing.push('SUPABASE_AUTH_NO_TOUCH');
  if(proposal?.grant_anon!==false||proposal?.grant_authenticated!==false||proposal?.grant_service_role!==false)missing.push('ZERO_ROLE_GRANTS_REQUIRED');
  if(proposal?.expose_data_api!==false)missing.push('NO_DATA_API_EXPOSURE');
  if(proposal?.real_customer_data!==false)missing.push('NO_REAL_CUSTOMER_DATA');
  if(proposal?.cloudflare_change!==false)missing.push('NO_CLOUDFLARE_CHANGE');
  if(proposal?.cost_approval_present!==true)missing.push('COST_BOUNDARY_UNVERIFIED');
  // A user-supplied checklist cannot be promoted to a signed acceptance event.
  return DENY(missing.length?'UNVERIFIED_MIGRATION_PREREQUISITES':'INDEPENDENT_SIGNED_AUTHORIZATION_NOT_PROVIDED',missing);
 }catch{return DENY('FAIL_CLOSED',['invalid_input']);}
}
export function reviewRealJwtAdmission({jwtA, jwtB, policy}={}){
 // Raw JWTs must never be sent here. A future sealed broker handles them.
 if(jwtA||jwtB)return DENY('RAW_JWT_NOT_ACCEPTED',['private_broker_required']);
 if(policy?.private_operator_verified!==true)return DENY('OPERATOR_IDENTITY_UNVERIFIED',['private_operator']);
 return DENY('AUTHENTICATED_STORE_AB_UAT_NOT_EXECUTED',['real_postgrest_rls_evidence']);
}
