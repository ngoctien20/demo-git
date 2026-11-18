import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {assessIndependentSecurityGate,digestPlaceholder} from './independent-security-gate.mjs';

const now=1_800_000_000;
const dh=x=>digestPlaceholder(x);
function fixture(){
 const keys=generateKeyPairSync('ed25519'),foreign=generateKeyPairSync('ed25519');
 const payload={
  scope:'V18.3.6H-READONLY-PREFLIGHT',
  audience:'tien404-private-human-security-review',
  environment:'offline_disposable',build_sha:'b'.repeat(40),
  reviewer_hash:dh('independent-reviewer-test'),
  implementer_hash:dh('different-implementer-test'),
  nonce_proof_hash:dh('nonce-proof'),auth_contract_hash:dh('auth-contract'),
  admission_evidence_hash:dh('admission-proof'),
  issued_at:now-5,expires_at:now+3600,p0_findings_closed:true,
 };
 const staging={canonicalStoreTables:2,commerceStoreColumns:6,restrictiveStorePolicies:6,
   realAuthABAccepted:true,independentOwnerConsentVerified:true,backupAndRollbackApproved:true};
 const reviewerKeys=new Map([['test-reviewer-key',keys.publicKey]]);
 const receipt=()=>({
  kid:'test-reviewer-key',payload:structuredClone(payload),
  signature:sign(null,Buffer.from(JSON.stringify(payload)),keys.privateKey).toString('base64url')
 });
 const check=(override={})=>assessIndependentSecurityGate({
  receipt:receipt(),reviewerKeys,clock:()=>now*1000,staging,...override,
 });
 return {keys,foreign,payload,staging,reviewerKeys,receipt,check};
}
test('R01 complete synthetic signed review is only evidence-ready, NEVER production-approved',()=>{
 const f=fixture(),res=f.check();
 assert.equal(res.status,'EVIDENCE_READY_FOR_SEPARATE_HUMAN_ADMISSION');
 assert.equal(res.reviewerCryptoSignatureValid,true);
 assert.equal(res.realHumanReviewed,false);
 assert.equal(res.productionAdmitted,false);
 assert.equal(res.stagingApproved,false);
});
test('R02 observed Supabase missing canonical Store schema is blocked',()=>{
 const f=fixture(),res=f.check({staging:{...f.staging,canonicalStoreTables:0,commerceStoreColumns:0,restrictiveStorePolicies:0}});
 assert.equal(res.status,'BLOCKED');
 assert.ok(res.blockers.includes('CANONICAL_STORE_STAGING_NOT_READY'));
});
test('R03 absent evidence blocked',()=>{
 const res=assessIndependentSecurityGate();
 assert.equal(res.status,'BLOCKED');
});
test('R04 reviewer signature tampering blocked',()=>{
 const f=fixture(),r=f.receipt();r.signature=(r.signature[0]==='A'?'B':'A')+r.signature.slice(1);
 const res=f.check({receipt:r});assert.ok(res.blockers.includes('REVIEWER_SIGNATURE_NOT_VERIFIED'));
});
test('R05 signed payload modification rejected',()=>{
 const f=fixture(),r=f.receipt();r.payload.build_sha='a'.repeat(40);
 const res=f.check({receipt:r});assert.ok(res.blockers.includes('REVIEWER_SIGNATURE_NOT_VERIFIED'));
});
test('R06 wrong pinned public key rejects review',()=>{
 const f=fixture(),res=f.check({reviewerKeys:new Map([['test-reviewer-key',f.foreign.publicKey]])});
 assert.ok(res.blockers.includes('REVIEWER_SIGNATURE_NOT_VERIFIED'));
});
test('R07 missing reviewer key rejects review',()=>{
 const f=fixture(),res=f.check({reviewerKeys:new Map()});
 assert.ok(res.blockers.includes('REVIEWER_SIGNATURE_NOT_VERIFIED'));
});
test('R08 reviewer equals implementer denied',()=>{
 const f=fixture();f.payload.reviewer_hash=f.payload.implementer_hash;
 assert.ok(f.check().blockers.includes('REVIEWER_NOT_INDEPENDENT'));
});
test('R09 unresolved P0 finding denied',()=>{
 const f=fixture();f.payload.p0_findings_closed=false;
 assert.ok(f.check().blockers.includes('P0_FINDINGS_OPEN'));
});
test('R10 expired review denied',()=>{
 const f=fixture();f.payload.expires_at=now-1;
 assert.ok(f.check().blockers.includes('REVIEW_EXPIRED'));
});
test('R11 review issuance in future denied',()=>{
 const f=fixture();f.payload.issued_at=now+100;
 assert.ok(f.check().blockers.includes('REVIEW_EXPIRED'));
});
test('R12 review validity beyond 1 day denied',()=>{
 const f=fixture();f.payload.expires_at=now+100000;
 assert.ok(f.check().blockers.includes('REVIEW_EXPIRED'));
});
test('R13 cross-system audience rejected',()=>{
 const f=fixture();f.payload.audience='tien404-provider-send';
 assert.ok(f.check().blockers.includes('WRONG_REVIEW_SCOPE'));
});
test('R14 wrong environment cannot unlock staging',()=>{
 const f=fixture();f.payload.environment='staging';
 assert.ok(f.check().blockers.includes('WRONG_REVIEW_SCOPE'));
});
test('R15 missing real Auth A/B proof prevents even readiness',()=>{
 const f=fixture(),res=f.check({staging:{...f.staging,realAuthABAccepted:false}});
 assert.ok(res.blockers.includes('REAL_AUTH_AND_OWNER_PROOF_MISSING'));
});
test('R16 missing backup and rollback approval blocks',()=>{
 const f=fixture(),res=f.check({staging:{...f.staging,backupAndRollbackApproved:false}});
 assert.ok(res.blockers.includes('BACKUP_AND_ROLLBACK_NOT_APPROVED'));
});
test('R17 invalid code SHA evidence blocks review',()=>{
 const f=fixture();f.payload.build_sha='short';
 assert.ok(f.check().blockers.includes('INVALID_EVIDENCE_DIGEST'));
});
test('R18 unrecognized extra claims invalidate signed evidence',()=>{
 const f=fixture();f.payload.unrequested_permission='PROVIDER_SEND';
 assert.ok(f.check().blockers.includes('INVALID_REVIEW_PAYLOAD'));
});
test('R19 missing reviewer proof hash invalidates package',()=>{
 const f=fixture();f.payload.reviewer_hash=undefined;
 assert.ok(f.check().blockers.includes('INVALID_EVIDENCE_DIGEST'));
});
test('R20 key ID injection unsupported',()=>{
 const f=fixture(),r=f.receipt();r.kid='https://malicious.invalid/jwks';
 assert.ok(f.check({receipt:r}).blockers.includes('REVIEWER_SIGNATURE_NOT_VERIFIED'));
});
