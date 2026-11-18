import test from 'node:test';
import assert from 'node:assert/strict';
import {assessPrivateAuthABReadiness,verifiedStagingReadOnlySnapshot} from './real-auth-ab-preflight.mjs';

const H=(ch)=>ch.repeat(64);
const owner=(ch,store)=>({
 principalHash:H(ch),tenantHash:H('a'),storeHash:H(store),
 consentHash:H(ch==='b'?'e':'d'),
 sessionEvidenceHash:H(ch==='b'?'2':'1'),
 membershipEvidenceHash:H(ch==='b'?'4':'3'),
 sessionVerifiedByTrustedServer:true,membershipCheckedServerSide:true,
 consentSignedAndCurrent:true,expiredOrRevoked:false,
});
function admittedLooking(){
 return {
  schema:{canonicalStoreTables:2,commerceStoreColumns:6,restrictiveStorePolicies:6,
   compositeConstraintsTested:true,backupRestoreVerified:true,stagingMigrationApproved:true},
  owners:{A:owner('1','a'),B:owner('b','c')},
  gates:{
   trustedSessionVerifierApproved:true,membershipResolverApproved:true,
   signedIssuerApproved:true,atomicNonceStoreApproved:true,
   privilegedGatewayReviewed:true,denyCrossStoreABVerified:true,
  },
  review:{independentHumanReviewerApproved:true,reviewEvidenceHash:H('f'),reviewId:'synthetic-review',reviewerHash:H('e'),implementerHash:H('d')},
 };
}
test('P01 actual observed staging metadata remains BLOCKED',()=>{
 const s=verifiedStagingReadOnlySnapshot;
 const result=assessPrivateAuthABReadiness({schema:{
  canonicalStoreTables:s.canonicalStoreTables,commerceStoreColumns:s.commerceStoreColumns,
  restrictiveStorePolicies:s.restrictiveStorePolicies},owners:{},gates:{},review:{}});
 assert.equal(result.status,'BLOCKED');
 assert.equal(result.realAuthVerified,false);
 assert.equal(result.productionAdmitted,false);
 assert.ok(result.blockers.includes('CANONICAL_STORE_AUTHORITY_MISSING'));
 assert.ok(result.blockers.includes('COMMERCE_STORE_COLUMNS_MISSING'));
});
test('P02 no evidence BLOCKED',()=>{
 const out=assessPrivateAuthABReadiness();
 assert.deepEqual(out.blockers,['INPUT_MISSING']);
});
test('P03 independent Owner principals required',()=>{
 const x=admittedLooking();x.owners.B.principalHash=x.owners.A.principalHash;
 assert.ok(assessPrivateAuthABReadiness(x).blockers.includes('OWNERS_NOT_INDEPENDENT'));
});
test('P04 two different Store scopes required',()=>{
 const x=admittedLooking();x.owners.B.storeHash=x.owners.A.storeHash;
 assert.ok(assessPrivateAuthABReadiness(x).blockers.includes('STORE_SCOPES_NOT_DISTINCT'));
});
test('P05 require same Tenant on A/B',()=>{
 const x=admittedLooking();x.owners.B.tenantHash=H('b');
 assert.ok(assessPrivateAuthABReadiness(x).blockers.includes('NOT_SAME_TENANT'));
});
test('P06 require independent reviewer',()=>{
 const x=admittedLooking();x.review.independentHumanReviewerApproved=false;
 assert.ok(assessPrivateAuthABReadiness(x).blockers.includes('INDEPENDENT_SECURITY_REVIEW_MISSING'));
});
test('P07 require two actual server-verified owner sessions',()=>{
 const x=admittedLooking();x.owners.B.sessionVerifiedByTrustedServer=false;
 assert.ok(assessPrivateAuthABReadiness(x).blockers.includes('OWNER_B_SESSION_UNVERIFIED'));
});
test('P08 missing owner signed approval blocks admission',()=>{
 const x=admittedLooking();x.owners.A.consentSignedAndCurrent=false;
 assert.ok(assessPrivateAuthABReadiness(x).blockers.includes('OWNER_A_CONSENT_UNVERIFIED'));
});
test('P09 service-role gateway must have independent review',()=>{
 const x=admittedLooking();x.gates.privilegedGatewayReviewed=false;
 assert.ok(assessPrivateAuthABReadiness(x).blockers.includes('PRIVILEGEDGATEWAYREVIEWED_MISSING'));
});
test('P10 backup and migration approval both required',()=>{
 const x=admittedLooking();x.schema.backupRestoreVerified=false;x.schema.stagingMigrationApproved=false;
 const out=assessPrivateAuthABReadiness(x);
 assert.ok(out.blockers.includes('BACKUP_RESTORE_NOT_VERIFIED'));
 assert.ok(out.blockers.includes('STAGING_CHANGE_NOT_APPROVED'));
});
test('P11 even synthetic complete evidence only returns READY_FOR_PRIVATE_REVIEW',()=>{
 const out=assessPrivateAuthABReadiness(admittedLooking());
 assert.equal(out.status,'EVIDENCE_PACKAGE_READY_FOR_PRIVATE_REVIEW');
 assert.equal(out.realAuthVerified,false);
 assert.equal(out.tokensAccessed,false);
 assert.equal(out.productionAdmitted,false);
});
test('P12 no raw Auth identifier accepted as evidence hash',()=>{
 const x=admittedLooking();x.owners.A.principalHash='00000000-0000-0000-0000-000000001001';
 assert.ok(assessPrivateAuthABReadiness(x).blockers.includes('OWNER_A_INVALID_PRINCIPALHASH'));
});
test('P13 revoked session blocks preflight',()=>{
 const x=admittedLooking();x.owners.A.expiredOrRevoked=true;
 assert.ok(assessPrivateAuthABReadiness(x).blockers.includes('OWNER_A_REVOKED_OR_UNKNOWN'));
});
test('P14 not Store-scoped membership blocks preflight',()=>{
 const x=admittedLooking();x.owners.B.membershipCheckedServerSide=false;
 assert.ok(assessPrivateAuthABReadiness(x).blockers.includes('OWNER_B_STORE_MEMBERSHIP_UNVERIFIED'));
});

test('P15 independent reviewer must differ from implementer',()=>{
 const x=admittedLooking();x.review.reviewerHash=x.review.implementerHash;
 assert.ok(assessPrivateAuthABReadiness(x).blockers.includes('INDEPENDENT_SECURITY_REVIEW_MISSING'));
});
