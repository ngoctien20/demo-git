'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {evaluateEvidence,CONTRACT}=require('./owner-evidence-gate.cjs');
const A='a'.repeat(64),B='b'.repeat(64),C='c'.repeat(64),D='d'.repeat(64),E='e'.repeat(64);
const good=()=>({
 inventory:{source:'HOSTED_READ_ONLY_SQL',stores_table:true,store_memberships_table:true,
  stores_rls_enabled:true,store_memberships_rls_enabled:true,
  schema_snapshot_ref:'private:hosted:pg17:evidence:001'},
 ownerProof:{
  ownerA:{principal_digest:A,store_digest:C,jwt_session_proof_ref:'private:jwt-ownerA-001'},
  ownerB:{principal_digest:B,store_digest:D,jwt_session_proof_ref:'private:jwt-ownerB-001'},
  independent_verified_signatures:true,
  negative_cross_store_test_ref:'private:qa-cross-store-403-001',
  current_membership_test_ref:'private:membership-issuer-qa-001'
 },
 backup:{export_sha256:E,restored_sha256:E,export_receipt_ref:'private:backup-export-001',
   restore_test_ref:'private:backup-restore-001',
   operator_attestation_ref:'private:operator-backup-001',
   test_environment_isolated:true,real_export_authorized:true},
 privateDbRole:{operator_approval_ref:'private:controller-signoff-001',
   security_reviewer_ref:'private:security-review-002',
   server_role_can_bypass_rls:false,public_role_access_denied:true,
   private_schema_not_exposed:true,insert_and_hashed_nonce_returning_only:true,
   credential_custody_certified:true},
 durableReplay:{real_pg17_ci_run_ref:'github:actions:real-pg17-qa-001',
   multi_connection_atomic_claim_test:true,reconnect_persistence_test:true,
   hosted_role_and_transaction_test:true,
   hosted_test_ref:'private:hosted-db-replay-001',
   compensation_and_rollback_ref:'private:approval-rollback-001'}
});
test('no data cannot self-certify hosted ownership or backup',()=>{
 const x=evaluateEvidence();
 assert.equal(x.contract,CONTRACT);assert.equal(x.status,'BLOCKED');
 assert.equal(x.blockers.length,5);
 assert.equal(x.hostedWriteAuthorized,false);assert.equal(x.releaseAuthorized,false);
});
test('real inventory missing two Store tables blocks proof despite QA owner bindings',()=>{
 const x=good();
 x.inventory.stores_table=false;x.inventory.store_memberships_table=false;
 assert.equal(evaluateEvidence(x).status,'BLOCKED');
 assert.match(evaluateEvidence(x).blockers.join(),/HOSTED_STORE_SCHEMA/);
});
test('forged verified=true and a single owner cannot prove two independent owners',()=>{
 const x=good();x.ownerProof.ownerB={...x.ownerProof.ownerA};
 x.ownerProof.verified=true;
 assert.match(evaluateEvidence(x).blockers.join(),/INDEPENDENT_OWNER_JWT/);
});
test('same Store SHA and same JWT session cannot count as independent Shop A/B',()=>{
 const x=good();x.ownerProof.ownerB.store_digest=x.ownerProof.ownerA.store_digest;
 x.ownerProof.ownerB.jwt_session_proof_ref=x.ownerProof.ownerA.jwt_session_proof_ref;
 assert.equal(evaluateEvidence(x).status,'BLOCKED');
});
test('unverified backup or missing restore hash blocks private migration',()=>{
 const x=good();
 x.backup.restored_sha256=B;
 assert.match(evaluateEvidence(x).blockers.join(),/AUTHORIZED_EXPORT/);
 x.backup.restored_sha256=E;x.backup.real_export_authorized=false;
 assert.match(evaluateEvidence(x).blockers.join(),/AUTHORIZED_EXPORT/);
});
test('role bypass RLS, public Data API access or no separate reviewer blocks',()=>{
 const x=good();x.privateDbRole.server_role_can_bypass_rls=true;
 assert.match(evaluateEvidence(x).blockers.join(),/PRIVATE_DB_ROLE/);
 x.privateDbRole.server_role_can_bypass_rls=false;
 x.privateDbRole.public_role_access_denied=false;
 assert.match(evaluateEvidence(x).blockers.join(),/PRIVATE_DB_ROLE/);
 x.privateDbRole.public_role_access_denied=true;
 x.privateDbRole.security_reviewer_ref=x.privateDbRole.operator_approval_ref;
 assert.match(evaluateEvidence(x).blockers.join(),/PRIVATE_DB_ROLE/);
});
test('local Postgres CI concurrency does not substitute for hosted DB role/transaction',()=>{
 const x=good();x.durableReplay.hosted_role_and_transaction_test=false;
 assert.match(evaluateEvidence(x).blockers.join(),/HOSTED_DURABLE_REPLAY/);
});
test('even complete references require independent offline review and grant no authority',()=>{
 const x=evaluateEvidence(good());
 assert.equal(x.status,'PENDING_INDEPENDENT_REVIEW');
 assert.equal(x.blockers.length,0);
 for(const key of ['authorizationGranted','hostedWriteAuthorized',
 'privateRoleChangeAuthorized','providerSendsAllowed','schemaMigrationAuthorized',
 'realCustomerDataAuthorized','releaseAuthorized'])assert.equal(x[key],false,key);
});
test('malformed proof fields never throw or authorize',()=>{
 for(const o of [null,undefined,{},[],{inventory:{verified:true}},
  {privateDbRole:{server_role_can_bypass_rls:false}},
  {ownerProof:{principal_digest:A}},{backup:{export_sha256:E}}]){
  const r=evaluateEvidence(o);
  assert.equal(r.status,'BLOCKED');
  assert.equal(r.releaseAuthorized,false);
 }
});
