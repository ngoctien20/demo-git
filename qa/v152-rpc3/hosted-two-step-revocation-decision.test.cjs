'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const baseline=require('./hosted-readonly-baseline.json');
const {
 CONTRACT,PROJECT,SIGNATURE,APPROVERS,STAGES,
 reviewHostedTwoStep,reviewOneTimeRevocation,
 executeRevocation,exportBackup,publishWorkflow
}=require('./hosted-two-step-revocation-decision.cjs');
const copy=()=>structuredClone(baseline);
function allGreen(){
 const b=copy(),x=b.hosted_two_step;
 for(const k of ['public_stores_table_exists','public_store_memberships_table_exists',
  'authenticated_real_owner_a_jwt_proof','authenticated_real_owner_b_jwt_proof',
  'same_tenant_cross_store_denial_proof','active_jwt_session_revocation_proof',
  'claim_call_executed_on_hosted','confirm_call_executed_on_hosted'])x[k]=true;
 b.caller_chain.external_callers_independently_certified=true;
 b.logs.direct_provider_rpc_invocations_proven=true;
 b.logs.independent_external_operator_request_audit=true;
 for(const k of Object.keys(b.backup))b.backup[k]=true;
 for(const k of Object.keys(b.migration))b.migration[k]=true;
 return b;
}
const review={authoritativeVerifiedEvidence:true,independentAuditorInspection:true,
 anonRpcDeniedFromUntrustedClient:true,authorizedPrivatePairingSucceeded:true,
 ownerConfirmedSeparately:true,supabaseAdvisorWarningCleared:true};
test('01 current hosted stage blocks independent Owner A/B JWT/RLS acceptance',()=>{
 const r=reviewHostedTwoStep({baseline});
 assert.equal(r.contract,CONTRACT);
 assert.equal(r.status,'PREFLIGHT_BLOCKED');
 assert(r.blockers.includes('CANONICAL_HOSTED_STORE_OWNERSHIP_SCHEMA_MISSING'));
 assert(r.blockers.includes('INDEPENDENT_LIVE_OWNER_JWT_RLS_NEGATIVE_PROOF_MISSING'));
 assert.equal(r.permissionToChangeRls,false);
});
test('02 currently private claim and confirm functions have conservative security metadata',()=>{
 const x=baseline.hosted_two_step;
 assert.equal(x.both_security_invoker,true);
 assert.equal(x.both_anon_execute,false);
 assert.equal(x.both_authenticated_execute,false);
 assert.equal(x.both_have_row_lock_and_conflict_handling,true);
 assert.equal(x.confirm_uses_auth_uid_and_owner_authorized_qa,true);
});
test('03 JSON flags pretending to prove hosted JWTs cannot independently certify',()=>{
 const r=reviewHostedTwoStep({baseline:allGreen(),privateEvidence:review});
 assert.equal(r.status,'PENDING_INDEPENDENT_ATTESTATION');
 assert.equal(r.realOwnerIdentityCertifiableFromThisJson,false);
 assert.equal(r.productionOwnerPairingCertified,false);
});
test('04 private metadata signatures alone are not independent proof inspection',()=>{
 const b=allGreen();
 const r=reviewHostedTwoStep({baseline:b,privateEvidence:{
   status:'SIGNED_METADATA_PENDING_PRIVATE_EVIDENCE_VALIDATION',
   authoritativeVerifiedEvidence:false,independentAuditorInspection:false
 }});
 assert.equal(r.status,'PREFLIGHT_BLOCKED');
 assert(r.blockers.includes('INDEPENDENT_PRIVATE_RAW_PROOF_INSPECTION_MISSING'));
});
test('05 actual PRE_REVOKE snapshot is NO_GO, anon current privilege allowed as baseline only',()=>{
 const r=reviewOneTimeRevocation({baseline,privateEvidence:{},phase:'PRE_REVOKE'});
 assert.equal(r.signature,SIGNATURE);
 assert.equal(r.projectRef,PROJECT);
 assert.equal(r.status,'NO_GO');
 assert(!r.blockers.includes('PRE_REVOKE_BASELINE_NOT_CONSISTENT'));
 assert(r.blockers.includes('EXTERNAL_CALLER_ATTESTATION_NOT_COMPLETE'));
 assert.equal(r.approvesRpcRevoke,false);
});
test('06 POST_REVOKE cannot pass while anon EXECUTE still granted',()=>{
 const r=reviewOneTimeRevocation({baseline,privateEvidence:review,phase:'POST_REVOKE'});
 assert.equal(r.status,'NO_GO');
 assert(r.blockers.includes('ANON_RPC_EXECUTE_STILL_ENABLED_AFTER_EXPECTED_CUTOVER'));
});
test('07 all-green claims still cannot authorize any real hosted operation',()=>{
 const b=allGreen();const r=reviewOneTimeRevocation({
  baseline:b,privateEvidence:review,phase:'PRE_REVOKE'
 });
 assert.equal(r.status,'PENDING_INDEPENDENT_SIGNED_APPROVAL');
 for(const k of ['approvesBackupExport','approvesHostedJwtTest',
  'approvesRlsMigration','approvesN8nPublishedChange',
  'approvesRpcRevoke','approvesCredentialRotation','allowsLiveSend',
  'allowsMerge','allowsProductionRelease','oneTimeAuthorizationConsumed'])
  assert.equal(r[k],false,k);
 assert.equal(r.hostedWrites,0);
});
test('08 fake all-green post-revoke proof cannot claim privilege was changed by source',()=>{
 const b=allGreen();b.supabase_rpc.anon_execute=false;
 const r=reviewOneTimeRevocation({baseline:b,privateEvidence:review,phase:'POST_REVOKE'});
 assert.equal(r.status,'PENDING_INDEPENDENT_SIGNED_APPROVAL');
 assert.equal(r.existingPublicRpcChanged,false);
 assert.equal(r.actualPrivilegedRoleVerified,false);
});
test('09 POST_REVOKE needs negative anon, positive private and separate Owner confirmation',()=>{
 for(const k of ['anonRpcDeniedFromUntrustedClient',
   'authorizedPrivatePairingSucceeded','ownerConfirmedSeparately',
   'supabaseAdvisorWarningCleared']){
  const p={...review,[k]:false},b=allGreen();b.supabase_rpc.anon_execute=false;
  const r=reviewOneTimeRevocation({baseline:b,privateEvidence:p,phase:'POST_REVOKE'});
  assert.equal(r.status,'NO_GO',k);
  assert(r.blockers.includes('POST_REVOKE_NEGATIVE_AND_POSITIVE_REGRESSION_MISSING'));
 }
});
test('10 no Owner B or revoked-session proof blocks without silently filling from private QA',()=>{
 for(const k of ['authenticated_real_owner_b_jwt_proof',
  'same_tenant_cross_store_denial_proof','active_jwt_session_revocation_proof']){
  const b=allGreen();b.hosted_two_step[k]=false;
  const r=reviewOneTimeRevocation({baseline:b,privateEvidence:review});
  assert.equal(r.status,'NO_GO',k);
  assert(r.blockers.includes('HOSTED_OWNER_RLS_TWO_STEP_GATE_BLOCKED'));
 }
});
test('11 a missing private backup restore receipt cannot grant revoke',()=>{
 const b=allGreen();b.backup.independent_restore_verified=false;
 const r=reviewOneTimeRevocation({baseline:b,privateEvidence:review});
 assert.equal(r.status,'NO_GO');
 assert(r.blockers.includes('BACKUP_RESTORE_AND_THREE_PARTY_APPROVAL_NOT_VERIFIED'));
});
test('12 unknown external callers still block even if manual historic count is zero',()=>{
 const b=allGreen();b.caller_chain.external_callers_independently_certified=false;
 const r=reviewOneTimeRevocation({baseline:b,privateEvidence:review});
 assert.equal(r.status,'NO_GO');
 assert(r.blockers.includes('EXTERNAL_CALLER_ATTESTATION_NOT_COMPLETE'));
});
test('13 exact project, caller chain and approved change window mandatory',()=>{
 const b=allGreen();b.supabase_project='other-project';
 assert.equal(reviewOneTimeRevocation({baseline:b,privateEvidence:review}).status,'NO_GO');
 const c=allGreen();c.caller_chain.upstream_webhook_workflow='forged';
 assert.equal(reviewOneTimeRevocation({baseline:c,privateEvidence:review}).status,'NO_GO');
 const d=allGreen();d.migration.external_authorized_change_window=false;
 assert.equal(reviewOneTimeRevocation({baseline:d,privateEvidence:review}).status,'NO_GO');
});
test('14 invalid phase and malformed input fail closed',()=>{
 for(const x of [null,{},'APPROVED',[]]){
  const r=reviewOneTimeRevocation({baseline:x,phase:'PRE_REVOKE'});
  assert.equal(r.status,'NO_GO');assert.equal(r.approvesRpcRevoke,false);
 }
 assert.equal(reviewOneTimeRevocation({baseline,phase:'AUTO_REVOKE'}).status,'NO_GO');
});
test('15 three required external signers, no implied approval tokens',()=>{
 assert.deepEqual([...APPROVERS],['CONTROLLER','SECURITY_REVIEWER','DB_OPERATOR']);
 assert.equal(STAGES[0],'PRIVATE_EXTERNAL_CALLER_ATTESTATION');
 assert.equal(STAGES.at(-1),'POST_REVOKE_ANON_DENIAL_AND_REGRESSION');
});
test('16 no programmatic ability to revoke/export/publish',()=>{
 assert.throws(()=>executeRevocation(),/RPC3_REVOKE_REQUIRES_EXTERNAL_SIGNED_ONE_TIME_APPROVAL/);
 assert.throws(()=>exportBackup(),/RPC3_BACKUP_REQUIRES_SEPARATE_EXPLICIT_APPROVAL/);
 assert.throws(()=>publishWorkflow(),/RPC3_PUBLISHED_CHANGE_NOT_AUTHORIZED/);
});
