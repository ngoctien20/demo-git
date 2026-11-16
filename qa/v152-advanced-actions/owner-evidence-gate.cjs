'use strict';
/*
 * TIEN404 V15.2-ADV.6B — hosted ownership evidence review gate.
 * This is a strict REVIEW checklist, not an identity verifier or a way
 * to turn JSON assertions into approval. NEVER certifies hosted access.
 *
 * No queries, credentials, auth, network, filesystem or DB writes.
 * Real proof must be independently obtained from authenticated JWT/RLS runs,
 * privately signed attestations, a tested export+restore, and an approved DB role.
 */
const CONTRACT='T404_ADV6B_EVIDENCE_REVIEW_V1';
const sha=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const ref=x=>typeof x==='string'&&x.length>=8&&x.length<=180&&
  /^[A-Za-z0-9:_./-]+$/.test(x);
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
  Object.getPrototypeOf(x)===Object.prototype;
function evaluateEvidence(input={}){
  const x=plain(input)?input:{};
  const blockers=[];
  const inventory=x.inventory;
  if(!plain(inventory)||inventory.source!=='HOSTED_READ_ONLY_SQL'||
    inventory.stores_table!==true||inventory.store_memberships_table!==true||
    inventory.stores_rls_enabled!==true||
    inventory.store_memberships_rls_enabled!==true||
    !ref(inventory.schema_snapshot_ref))blockers.push('HOSTED_STORE_SCHEMA_OR_RLS_PROOF_MISSING');
  const proof=x.ownerProof;
  if(!plain(proof)||!plain(proof.ownerA)||!plain(proof.ownerB)||
    !sha(proof.ownerA.principal_digest)||!sha(proof.ownerB.principal_digest)||
    proof.ownerA.principal_digest===proof.ownerB.principal_digest||
    !sha(proof.ownerA.store_digest)||!sha(proof.ownerB.store_digest)||
    proof.ownerA.store_digest===proof.ownerB.store_digest||
    !ref(proof.ownerA.jwt_session_proof_ref)||!ref(proof.ownerB.jwt_session_proof_ref)||
    proof.ownerA.jwt_session_proof_ref===proof.ownerB.jwt_session_proof_ref||
    proof.independent_verified_signatures!==true||
    !ref(proof.negative_cross_store_test_ref)||
    !ref(proof.current_membership_test_ref))
    blockers.push('INDEPENDENT_OWNER_JWT_CROSS_STORE_PROOF_MISSING');
  const backup=x.backup;
  if(!plain(backup)||!sha(backup.export_sha256)||
    backup.export_sha256!==backup.restored_sha256||
    !ref(backup.export_receipt_ref)||!ref(backup.restore_test_ref)||
    !ref(backup.operator_attestation_ref)||
    backup.test_environment_isolated!==true||
    backup.real_export_authorized!==true)
    blockers.push('AUTHORIZED_EXPORT_AND_INDEPENDENT_RESTORE_MISSING');
  const approval=x.privateDbRole;
  if(!plain(approval)||!ref(approval.operator_approval_ref)||
    !ref(approval.security_reviewer_ref)||
    approval.operator_approval_ref===approval.security_reviewer_ref||
    approval.server_role_can_bypass_rls!==false||
    approval.public_role_access_denied!==true||
    approval.private_schema_not_exposed!==true||
    approval.insert_and_hashed_nonce_returning_only!==true||
    approval.credential_custody_certified!==true)
    blockers.push('PRIVATE_DB_ROLE_AND_SECURITY_APPROVAL_MISSING');
  const replay=x.durableReplay;
  if(!plain(replay)||!ref(replay.real_pg17_ci_run_ref)||
    replay.multi_connection_atomic_claim_test!==true||
    replay.reconnect_persistence_test!==true||
    replay.hosted_role_and_transaction_test!==true||
    !ref(replay.hosted_test_ref)||
    !ref(replay.compensation_and_rollback_ref))
    blockers.push('HOSTED_DURABLE_REPLAY_CERTIFICATION_MISSING');
  // Even an apparently complete document cannot upgrade itself to a release
  // or security certificate: only independent reviewers can attest evidence.
  return Object.freeze({
    contract:CONTRACT,
    status:blockers.length?'BLOCKED':'PENDING_INDEPENDENT_REVIEW',
    blockers:Object.freeze(blockers),
    authorizationGranted:false,
    hostedWriteAuthorized:false,
    privateRoleChangeAuthorized:false,
    providerSendsAllowed:false,
    schemaMigrationAuthorized:false,
    realCustomerDataAuthorized:false,
    releaseAuthorized:false,
    note:'EVIDENCE_REFERENCES_REQUIRE_INDEPENDENT_PRIVATE_VERIFICATION'
  });
}
module.exports=Object.freeze({CONTRACT,evaluateEvidence});