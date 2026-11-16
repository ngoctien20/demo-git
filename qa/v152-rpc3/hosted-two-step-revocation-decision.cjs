'use strict';
/*
 * TIEN404 ADV.6C-RPC.3 — HOSTED TWO-STEP ACCEPTANCE AND ONE-TIME
 * RPC REVOKE DECISION PAPERWORK (SOURCE ONLY / NO SEND / NO SQL).
 *
 * This code does not possess authenticated real Owner JWTs, PostgreSQL
 * privileges, real backup operator access, trusted private Controller keys,
 * or a hosted change-control ledger. It can only DENY or ask for independent
 * private verification. User flags/JSON signatures do not authorize changes.
 */
const CONTRACT='T404_RPC3_TWO_STEP_REVOCATION_DECISION_V1';
const PROJECT='ifxlvrhyjhbzbrkdsida';
const SIGNATURE='public.qa_shop_b_zalo_claim(uuid,text,text,text)';
const APPROVERS=Object.freeze(['CONTROLLER','SECURITY_REVIEWER','DB_OPERATOR']);
const STAGES=Object.freeze([
 'PRIVATE_EXTERNAL_CALLER_ATTESTATION',
 'HOSTED_OWNER_JWT_RLS_READ_ONLY_ACCEPTANCE',
 'BACKUP_AND_INDEPENDENT_RESTORE_APPROVAL',
 'PRIVATE_TWO_STEP_PAIRING_SHADOW_NO_WRITE',
 'SEPARATELY_APPROVED_SINGLE_WRITER_CANARY',
 'ONE_TIME_EXACT_RPC_PRIVILEGE_REVOCATION',
 'POST_REVOKE_ANON_DENIAL_AND_REGRESSION'
]);
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
const check=(test,name,arr)=>{if(test!==true)arr.push(name)};
function reviewHostedTwoStep({baseline,privateEvidence}={}){
 const b=object(baseline)?baseline:{},p=object(privateEvidence)?privateEvidence:{};
 const x=b.hosted_two_step||{},m=[];
 check(b.contract==='T404_ADV6C_RPC3_HOSTED_READONLY_BASELINE_V1'&&
   b.supabase_project===PROJECT,'PROJECT_BASELINE_INVALID',m);
 check(x.both_security_invoker===true,'PRIVATE_PAIRING_INVOCATION_RIGHTS_UNVERIFIED',m);
 check(x.both_anon_execute===false&&x.both_authenticated_execute===false,
   'PRIVATE_PAIRING_FUNCTION_EXPOSURE_UNVERIFIED',m);
 check(x.both_have_row_lock_and_conflict_handling===true,
   'PRIVATE_TWO_STEP_TRANSACTION_STATIC_INVARIANTS_MISSING',m);
 check(x.confirm_uses_auth_uid_and_owner_authorized_qa===true,
   'OWNER_CONFIRMATION_GUARD_MISSING',m);
 check(x.public_stores_table_exists===true&&x.public_store_memberships_table_exists===true,
   'CANONICAL_HOSTED_STORE_OWNERSHIP_SCHEMA_MISSING',m);
 check(x.authenticated_real_owner_a_jwt_proof===true&&
   x.authenticated_real_owner_b_jwt_proof===true&&
   x.same_tenant_cross_store_denial_proof===true&&
   x.active_jwt_session_revocation_proof===true,
   'INDEPENDENT_LIVE_OWNER_JWT_RLS_NEGATIVE_PROOF_MISSING',m);
 check(x.claim_call_executed_on_hosted===true&&x.confirm_call_executed_on_hosted===true,
   'HOSTED_TWO_STEP_CLAIM_CONFIRM_NOT_SEPARATELY_AUTHORIZED_OR_PROVEN',m);
 check(p.authoritativeVerifiedEvidence===true&&p.independentAuditorInspection===true,
   'INDEPENDENT_PRIVATE_RAW_PROOF_INSPECTION_MISSING',m);
 return Object.freeze({
   contract:CONTRACT,section:'HOSTED_TWO_STEP',
   status:m.length?'PREFLIGHT_BLOCKED':'PENDING_INDEPENDENT_ATTESTATION',
   blockers:Object.freeze(m),
   privateClaimAndConfirmationCodePresent:!!x.claim_function&&!!x.confirm_function,
   realOwnerIdentityCertifiableFromThisJson:false,
   hostedPairingExecutedByThisCode:false,
   productionOwnerPairingCertified:false,
   permissionToChangeRls:false,permissionToRevoke:false
 });
}
function reviewOneTimeRevocation({baseline,privateEvidence,phase='PRE_REVOKE'}={}){
 const b=object(baseline)?baseline:{},p=object(privateEvidence)?privateEvidence:{};
 const blockers=[];
 const hosted=reviewHostedTwoStep({baseline:b,privateEvidence:p});
 check(b.contract==='T404_ADV6C_RPC3_HOSTED_READONLY_BASELINE_V1'&&
   b.supabase_project===PROJECT,'WRONG_PROJECT_OR_UNVERIFIED_BASELINE',blockers);
 check(phase==='PRE_REVOKE'||phase==='POST_REVOKE',
   'REVOCATION_PHASE_INVALID',blockers);
 check(b.caller_chain?.exact_rpc_workflow==='OgDZNSAvKEvhnAvn'&&
   b.caller_chain?.upstream_webhook_workflow==='yIJk8LvJoLF40Z62',
   'KNOWN_PUBLISHED_RPC_CHAIN_NOT_ACCOUNTED',blockers);
 check(b.caller_chain?.external_callers_independently_certified===true&&
   b.migration?.full_caller_inventory===true,
   'EXTERNAL_CALLER_ATTESTATION_NOT_COMPLETE',blockers);
 check(b.logs?.direct_provider_rpc_invocations_proven===true&&
   b.logs?.independent_external_operator_request_audit===true,
   'RPC_REQUEST_AUDIT_WINDOW_UNCERTIFIED',blockers);
 check(b.migration?.private_service_role_and_writer_hosted===true,
   'PRIVATE_WRITER_AND_LEAST_PRIVILEGE_ROLE_NOT_HOSTED',blockers);
 check(b.migration?.no_double_writer_real_canary===true,
   'SINGLE_WRITER_CANARY_AND_SHADOW_UNVERIFIED',blockers);
 check(b.migration?.rollback_drill_verified===true,
   'ROLLBACK_DRILL_UNVERIFIED',blockers);
 check(b.backup?.one_time_controller_approval_verified===true&&
   b.backup?.separate_security_reviewer_approval_verified===true&&
   b.backup?.named_operator_approval_verified===true&&
   b.backup?.encrypted_backup_export_verified===true&&
   b.backup?.independent_restore_verified===true,
   'BACKUP_RESTORE_AND_THREE_PARTY_APPROVAL_NOT_VERIFIED',blockers);
 check(b.migration?.external_authorized_change_window===true&&
   b.migration?.rpc_revoke_authorized===true,
   'EXACT_PRIVILEGE_CHANGE_NOT_INDEPENDENTLY_APPROVED',blockers);
 check(hosted.blockers.length===0,'HOSTED_OWNER_RLS_TWO_STEP_GATE_BLOCKED',blockers);
 if(phase==='PRE_REVOKE'){
   // Old RPC must exist and still be callable until exact controlled cutover.
   check(b.supabase_rpc?.anon_execute===true,
     'PRE_REVOKE_BASELINE_NOT_CONSISTENT',blockers);
 }else if(phase==='POST_REVOKE'){
   check(b.supabase_rpc?.anon_execute===false,
     'ANON_RPC_EXECUTE_STILL_ENABLED_AFTER_EXPECTED_CUTOVER',blockers);
   check(p.anonRpcDeniedFromUntrustedClient===true&&
     p.authorizedPrivatePairingSucceeded===true&&
     p.ownerConfirmedSeparately===true&&
     p.supabaseAdvisorWarningCleared===true,
     'POST_REVOKE_NEGATIVE_AND_POSITIVE_REGRESSION_MISSING',blockers);
 }
 // Even an all-green input is an unverified assertion. A separate signed
 // external operator must approve and enforce actual migration.
 return Object.freeze({
  contract:CONTRACT,section:'ONE_TIME_EXACT_RPC_REVOKE',
  projectRef:PROJECT,signature:SIGNATURE,phase,
  status:blockers.length?'NO_GO':'PENDING_INDEPENDENT_SIGNED_APPROVAL',
  stages:STAGES,blockers:Object.freeze(blockers),
  productionTrafficSwitched:false,actualPrivilegedRoleVerified:false,
  existingPublicRpcChanged:false,
  approvesBackupExport:false,approvesHostedJwtTest:false,
  approvesRlsMigration:false,approvesN8nPublishedChange:false,
  approvesRpcRevoke:false,approvesCredentialRotation:false,
  allowsLiveSend:false,allowsMerge:false,allowsProductionRelease:false,
  oneTimeAuthorizationConsumed:false,hostedWrites:0
 });
}
function executeRevocation(){
 throw Error('RPC3_REVOKE_REQUIRES_EXTERNAL_SIGNED_ONE_TIME_APPROVAL');
}
function exportBackup(){
 throw Error('RPC3_BACKUP_REQUIRES_SEPARATE_EXPLICIT_APPROVAL');
}
function publishWorkflow(){
 throw Error('RPC3_PUBLISHED_CHANGE_NOT_AUTHORIZED');
}
module.exports=Object.freeze({
 CONTRACT,PROJECT,SIGNATURE,APPROVERS,STAGES,
 reviewHostedTwoStep,reviewOneTimeRevocation,
 executeRevocation,exportBackup,publishWorkflow
});