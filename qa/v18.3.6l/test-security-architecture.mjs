import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeRevocationTimeline,assessExternalAuthAdmissionEvidence} from './revocation-architecture.mjs';
import {assessKeyCustodyProposal} from './key-custody-proposal.mjs';
import {threatRegister,assessGatewayThreatReview} from './gateway-threat-gate.mjs';

const H=x=>x.repeat(64);
const T=1_800_000_000;
function timeline(){
  const session={tokenVerified:true,observedSource:'synthetic_authoritative_session_fixture',
    sessionHash:H('a'),subjectHash:H('b'),tenantHash:H('c'),
    storeHash:H('d'),memberRevisionHash:H('e'),
    checkedAt:T,validUntil:T+3,active:true,revokedAt:null};
  const request={sessionHash:H('a'),subjectHash:H('b'),tenantHash:H('c'),
    storeHash:H('d'),memberRevisionHash:H('e'),
    startedAt:T+1,committedAt:T+2,operation:'CATALOG_READ'};
  const events={remoteAvailable:true,revocationFeedHealthy:true,remoteRevokedAt:null,
    localObservedAt:null,revocationLedgerEpoch:T,sessionEpoch:T};
  return {session,request,events};
}
function assertNoAdmission(result){
  assert.equal(result.productionAdmitted,false);
  assert.equal(result.realAuthVerified,false);
  assert.equal(result.permitsRead,false);
  assert.equal(result.permitsWrite,false);
  assert.equal(result.permitsProviderSend,false);
}
test('A01 clean fixture is still a P0 unproven cross-service race',()=>{
 const r=analyzeRevocationTimeline(timeline());
 assert.equal(r.finding,'NO_REVOKE_OBSERVED_BUT_CROSS_SERVICE_RACE_UNPROVEN');
 assert.equal(r.risk,'P0');assertNoAdmission(r);
});
test('A02 missing evidence blocked',()=>assert.equal(analyzeRevocationTimeline().finding,'MISSING_EVIDENCE'));
test('A03 malformed Store hash blocks',()=>{const x=timeline();x.request.storeHash='raw-store-id';assert.equal(analyzeRevocationTimeline(x).finding,'INVALID_SCOPE_OR_CLOCK');});
test('A04 unverified Auth token blocks',()=>{const x=timeline();x.session.tokenVerified=false;assert.equal(analyzeRevocationTimeline(x).finding,'UNVERIFIED_AUTH_SOURCE');});
test('A05 client supplied source not authoritative',()=>{const x=timeline();x.session.observedSource='client_claim';assert.equal(analyzeRevocationTimeline(x).finding,'UNVERIFIED_AUTH_SOURCE');});
test('A06 mismatched Store blocks',()=>{const x=timeline();x.request.storeHash=H('7');assert.equal(analyzeRevocationTimeline(x).finding,'SESSION_OR_STORE_BINDING_MISMATCH');});
test('A07 mismatched session blocks',()=>{const x=timeline();x.request.sessionHash=H('7');assert.equal(analyzeRevocationTimeline(x).finding,'SESSION_OR_STORE_BINDING_MISMATCH');});
test('A08 mismatched member revision blocks',()=>{const x=timeline();x.request.memberRevisionHash=H('7');assert.equal(analyzeRevocationTimeline(x).finding,'SESSION_OR_STORE_BINDING_MISMATCH');});
test('A09 local revoked session denies',()=>{const x=timeline();x.session.active=false;assert.equal(analyzeRevocationTimeline(x).finding,'REVOKED_AT_CHECK');});
test('A10 local revokedAt denies',()=>{const x=timeline();x.session.revokedAt=T;assert.equal(analyzeRevocationTimeline(x).finding,'REVOKED_AT_CHECK');});
test('A11 expired remote check result denies',()=>{const x=timeline();x.session.validUntil=T+1;assert.equal(analyzeRevocationTimeline(x).finding,'STALE_OR_UNBOUNDED_AUTH_CHECK');});
test('A12 future session observation denies',()=>{const x=timeline();x.session.checkedAt=T+2;assert.equal(analyzeRevocationTimeline(x).finding,'STALE_OR_UNBOUNDED_AUTH_CHECK');});
test('A13 remote Auth API unavailable denies',()=>{const x=timeline();x.events.remoteAvailable=false;assert.equal(analyzeRevocationTimeline(x).finding,'REMOTE_AUTH_OR_FEED_UNAVAILABLE');});
test('A14 revocation feed unavailable denies',()=>{const x=timeline();x.events.revocationFeedHealthy=false;assert.equal(analyzeRevocationTimeline(x).finding,'REMOTE_AUTH_OR_FEED_UNAVAILABLE');});
test('A15 remote revoked before check but local is still active is P0',()=>{const x=timeline();x.events.remoteRevokedAt=T;assert.equal(analyzeRevocationTimeline(x).finding,'REMOTE_REVOKED_BEFORE_CHECK_BUT_LOCAL_ACTIVE');});
test('A16 revoke between check and commit is P0',()=>{
 const x=timeline();x.events.remoteRevokedAt=T+1;
 const r=analyzeRevocationTimeline(x);
 assert.equal(r.finding,'REMOTE_REVOKED_AFTER_CHECK_BEFORE_COMMIT');
 assert.equal(r.divergenceSeconds,1);assertNoAdmission(r);
});
test('A17 remote revoke after commit retains chronological evidence, never grants release',()=>{
 const x=timeline();x.events.remoteRevokedAt=T+3;
 const r=analyzeRevocationTimeline(x);
 assert.equal(r.finding,'REMOTE_REVOKED_AFTER_COMMIT');assertNoAdmission(r);
});
test('A18 uncorrelated revocation epoch is unsafe',()=>{const x=timeline();x.events.sessionEpoch=T-1;assert.equal(analyzeRevocationTimeline(x).finding,'REVOCATION_EPOCH_NOT_AUTHORITY_BACKED');});
test('A19 malformed revocation timestamp is unsafe',()=>{const x=timeline();x.events.remoteRevokedAt='unknown';assert.equal(analyzeRevocationTimeline(x).finding,'INVALID_REMOTE_REVOKE_EVIDENCE');});
test('A20 ORDER_WRITE is not a supported read case',()=>{const x=timeline();x.request.operation='ORDER_WRITE';assert.equal(analyzeRevocationTimeline(x).finding,'INVALID_SCOPE_OR_CLOCK');});
test('A21 invalid transaction ordering blocks',()=>{const x=timeline();x.request.committedAt=T;assert.equal(analyzeRevocationTimeline(x).finding,'INVALID_SCOPE_OR_CLOCK');});
test('A22 no real evidence yields explicit blockers',()=>{
 const r=assessExternalAuthAdmissionEvidence();
 assert.equal(r.status,'BLOCKED');assert.ok(r.blockers.includes('CROSS_SERVICE_REVOCATION_RACE_UNCLOSED'));
 assert.equal(r.productionAdmitted,false);
});
test('A23 synthetic all-true checklist never verifies real Auth',()=>{
 const r=assessExternalAuthAdmissionEvidence({
  realSupabaseAuthSessionProofReviewed:true,
  sessionSourceOfTruthApproved:true,
  externalRevocationAtCommitProven:true,
  sameTenantStoreABVerified:true,
  independentHumanReviewerApproved:true,
 });
 assert.equal(r.status,'EVIDENCE_PACKAGE_FOR_INDEPENDENT_PRIVATE_REVIEW');
 assert.equal(r.realAuthVerified,false);assert.equal(r.productionAdmitted,false);
});

function keys(){
 const seed={environment:'PRODUCTION',attestationHash:H('a'),lifecycle:'CANDIDATE'};
 return {
  keys:[
   {...seed,purpose:'TIEN404_AUTHORITY_ED25519',kid:'authority-a',algorithm:'Ed25519',
    operation:'SIGN',privateKeyExportable:false,signingEndpointPublic:false,
    operatorScope:'dedicated_private_issuer'},
   {...seed,purpose:'TIEN404_RPC_SIGNER',kid:'rpc-a',algorithm:'HMAC-SHA256',
    operation:'SIGN',design:'PRIVATE_HMAC_DB_BOUNDARY',
    symmetricSecretInDatabase:true,signingEndpointPublic:false},
   {...seed,purpose:'SUPABASE_AUTH_JWT_VERIFY',kid:'jwt-verifier',
    operation:'VERIFY',privateKeyPresent:false,trustedSupabaseIssuerPinned:true},
  ],
  signerNetworkPrivate:true,keyAccessTwoPersonReview:true,
  rotationProcedureDryRunPassed:true,redactedSignAuditEnabled:true,
  automatedKeyMaterialLeakCheckPassed:true,independentReviewId:'synthetic-review',
 };
}
test('K01 complete design metadata is still review-only',()=>{
 const r=assessKeyCustodyProposal(keys());
 assert.equal(r.status,'DESIGN_PACKET_READY_FOR_EXTERNAL_REVIEW');
 assert.equal(r.productionSignerEnabled,false);assert.equal(r.deploymentVerified,false);
});
test('K02 missing key packet is incomplete',()=>assert.equal(assessKeyCustodyProposal().status,'DESIGN_INCOMPLETE'));
test('K03 same kid across roles rejected',()=>{const q=keys();q.keys[1].kid=q.keys[0].kid;assert.ok(assessKeyCustodyProposal(q).findings.includes('KID_COLLISION'));});
test('K04 cross environment key leakage rejected',()=>{const q=keys();q.keys[1].environment='QA';assert.ok(assessKeyCustodyProposal(q).findings.includes('KEY_ENVIRONMENT_MISMATCH'));});
test('K05 extractable authority private key rejected',()=>{const q=keys();q.keys[0].privateKeyExportable=true;assert.ok(assessKeyCustodyProposal(q).findings.some(x=>x.includes('EXTRACTABLE_PRIVATE_KEY')));});
test('K06 exposed authority signing endpoint rejected',()=>{const q=keys();q.keys[0].signingEndpointPublic=true;assert.ok(assessKeyCustodyProposal(q).findings.some(x=>x.includes('PUBLIC_SIGNER')));});
test('K07 authority EdDSA algorithm substitution rejected',()=>{const q=keys();q.keys[0].algorithm='HS256';assert.ok(assessKeyCustodyProposal(q).findings.some(x=>x.includes('ALGORITHM_NOT_PINNED')));});
test('K08 unsupported issuer access role rejected',()=>{const q=keys();q.keys[0].operatorScope='generic_gateway';assert.ok(assessKeyCustodyProposal(q).findings.some(x=>x.includes('ISSUER_SCOPING')));});
test('K09 Supabase Auth verifier cannot hold JWT private signing key',()=>{const q=keys();q.keys[2].privateKeyPresent=true;assert.ok(assessKeyCustodyProposal(q).findings.some(x=>x.includes('PUBLIC_TRUST_ONLY')));});
test('K10 unpinned Supabase JWKS issuer rejected',()=>{const q=keys();q.keys[2].trustedSupabaseIssuerPinned=false;assert.ok(assessKeyCustodyProposal(q).findings.some(x=>x.includes('JWT_ISSUER_JWKS_NOT_PINNED')));});
test('K11 RPC HMAC database custody must be explicit',()=>{const q=keys();q.keys[1].symmetricSecretInDatabase=false;assert.ok(assessKeyCustodyProposal(q).findings.some(x=>x.includes('HMAC_DB_SECRET_BOUNDARY')));});
test('K12 public key database verification requires independently vetted extension',()=>{const q=keys();q.keys[1].design='VETTED_PUBLIC_KEY_VERIFIER';assert.ok(assessKeyCustodyProposal(q).findings.some(x=>x.includes('ASYMMETRIC_DB_VERIFIER_NOT_VERIFIED')));});
test('K13 missing private network rejected',()=>{const q=keys();q.signerNetworkPrivate=false;assert.ok(assessKeyCustodyProposal(q).findings.includes('PRIVATE_NETWORK_NOT_VERIFIED'));});
test('K14 missing two-person key access control rejected',()=>{const q=keys();q.keyAccessTwoPersonReview=false;assert.ok(assessKeyCustodyProposal(q).findings.includes('DUAL_CONTROL_NOT_VERIFIED'));});
test('K15 missing revoke/rotation drill rejected',()=>{const q=keys();q.rotationProcedureDryRunPassed=false;assert.ok(assessKeyCustodyProposal(q).findings.includes('ROTATION_AND_REVOCATION_DRILL_NOT_VERIFIED'));});
test('K16 missing redacted signing audit rejected',()=>{const q=keys();q.redactedSignAuditEnabled=false;assert.ok(assessKeyCustodyProposal(q).findings.includes('ISSUER_AUDIT_NOT_VERIFIED'));});
test('K17 missing metadata digest rejected',()=>{const q=keys();q.keys[0].attestationHash='notsha';assert.ok(assessKeyCustodyProposal(q).findings.some(x=>x.includes('MISSING_REDACTED_EVIDENCE_HASH')));});
test('K18 unapproved RELEASED lifecycle rejected',()=>{const q=keys();q.keys[0].lifecycle='RELEASED';assert.ok(assessKeyCustodyProposal(q).findings.some(x=>x.includes('RELEASE_STATUS_NOT_REVIEWABLE_OFFLINE')));});
test('K19 missing independent review reference rejected',()=>{const q=keys();q.independentReviewId='';assert.ok(assessKeyCustodyProposal(q).findings.includes('INDEPENDENT_REVIEW_REFERENCE_MISSING'));});
test('K20 even completed metadata never verifies a KMS provider or real reviewer',()=>{
 const r=assessKeyCustodyProposal(keys());
 assert.equal(r.keyMaterialAccessed,false);assert.equal(r.signedByIndependentReviewer,false);
 assert.equal(r.productionAdmitted,false);
});

const proofs=Object.fromEntries(threatRegister.map(x=>[x.require,H('a')]));
function review(){return {
 proofHashes:{...proofs},reviewerHash:H('b'),implementerHash:H('c'),
 reviewedCommitDigest:H('d'),reviewerSignaturePrivatelyVerified:true,
};}
test('G01 register includes explicit 6 P0 and 3 P1 threats',()=>{
 assert.equal(threatRegister.filter(x=>x.severity==='P0').length,6);
 assert.equal(threatRegister.filter(x=>x.severity==='P1').length,3);
});
test('G02 missing threat evidence is blocked',()=>{
 const r=assessGatewayThreatReview();
 assert.equal(r.status,'BLOCKED');assert.equal(r.verifiedThreatClosures,0);
});
test('G03 even complete synthetic hashes never close threats',()=>{
 const r=assessGatewayThreatReview(review());
 assert.equal(r.status,'EVIDENCE_INDEX_READY_FOR_INDEPENDENT_REVIEW');
 assert.equal(r.verifiedThreatClosures,0);assert.equal(r.independentHumanReviewCompleted,false);
 assert.equal(r.productionAdmitted,false);
});
test('G04 same reviewer and implementer rejected',()=>{
 const x=review();x.reviewerHash=x.implementerHash;
 assert.ok(assessGatewayThreatReview(x).unresolved.includes('REVIEWER_NOT_INDEPENDENT'));
});
test('G05 missing P0 proof is blocked',()=>{
 const x=review();delete x.proofHashes.AUTHORITATIVE_REVOCATION_RACE_PROOF;
 assert.ok(assessGatewayThreatReview(x).unresolved.includes('L-P0-01'));
});
test('G06 unsigned independent review is blocked',()=>{
 const x=review();x.reviewerSignaturePrivatelyVerified=false;
 assert.ok(assessGatewayThreatReview(x).unresolved.includes('INDEPENDENT_REVIEW_SIGNATURE_UNVERIFIED'));
});
test('G07 missing reviewed code hash blocked',()=>{
 const x=review();x.reviewedCommitDigest='bad';
 assert.ok(assessGatewayThreatReview(x).unresolved.includes('REVIEWED_CODE_HASH_MISSING'));
});
test('G08 production gateway never admitted with synthetic package',()=>{
 const r=assessGatewayThreatReview(review());
 assert.equal(r.protectedGatewayAdmitted,false);
});
