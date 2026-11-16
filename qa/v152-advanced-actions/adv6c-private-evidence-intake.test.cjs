'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const v=require('./adv6c-private-evidence-intake.cjs');
const NOW=Date.parse('2026-11-16T06:00:00Z');
const HEX=char=>char.repeat(64);
const project=HEX('f');
function make(){
 const manifest={
  contract:v.CONTRACT,requestId:'QA-ADV6CSESSION0001',
  projectDigest:project,purpose:'PRIVATE_EVIDENCE_REVIEW',
  createdAtUtc:'2026-11-16T05:59:00Z',expiresAtUtc:'2026-11-16T06:09:00Z',
  evidence:v.LANES.map((lane,i)=>({
   lane,reference:'private:evidence-record-'+String(i).padStart(2,'0'),
   sha256:crypto.createHash('sha256').update('QA_'+lane).digest('hex'),
   capturedAtUtc:'2026-11-16T05:00:00Z'
  }))
 };
 const keyPairs=v.ROLES.map(()=>crypto.generateKeyPairSync('ed25519'));
 const registry=new Map(v.ROLES.map((role,i)=>[
  'QA_KEY_'+i,{
   role,principalDigest:crypto.createHash('sha256').update('QA_PRINCIPAL_'+i).digest('hex'),
   publicKey:keyPairs[i].publicKey,
   enrollmentReceipt:'private:enrolled-key-'+i,
   state:'ACTIVE',
   purposes:v.PURPOSES.slice()
  }
 ]));
 const signatures=()=>v.ROLES.map((role,i)=>({
  role,keyId:'QA_KEY_'+i,
  signature:crypto.sign(null,v.canonicalBytes(manifest),keyPairs[i].privateKey).toString('base64url')
 }));
 return {manifest,registry,keyPairs,attestations:signatures(),signatures};
}
function verify(x){
 return v.receiptReview({manifest:x.manifest,attestations:x.attestations,
  registry:x.registry,expectedProjectDigest:project,now:NOW});
}
test('01 signed synthetic receipt is only pending independent external review',()=>{
 const out=verify(make());
 assert.equal(out.status,'PENDING_EXTERNAL_INDEPENDENT_VERIFICATION');
 assert.equal(out.signatureVerificationPerformed,true);
 assert.equal(out.productionReleaseAuthorized,false);
});
test('02 require eight complete private lanes',()=>{
 const x=make();x.manifest.evidence.pop();x.attestations=x.signatures();
 assert(verify(x).blockers.includes('PRIVATE_REFERENCE_LANES_INCOMPLETE'));
});
test('03 require independent Controller, Security Reviewer, Backup Operator',()=>{
 assert.deepEqual(v.ROLES,['CONTROLLER','SECURITY_REVIEWER','BACKUP_OPERATOR']);
});
test('04 reject self-asserted verifier boolean',()=>{
 const x=make();x.manifest.verified=true;
 assert(verify(x).blockers.includes('MANIFEST_OR_PROJECT_SCOPE_INVALID'));
});
test('05 raw JWT field never enters manifest',()=>{
 const x=make();x.manifest.accessToken='Bearer NEVER_ACCEPT';
 assert.equal(verify(x).status,'BLOCKED');
});
test('06 no external HTTP URLs or raw evidence path allowed',()=>{
 const x=make();x.manifest.evidence[0].reference='https://example.com/proof.json';
 x.attestations=x.signatures();assert(verify(x).blockers.includes('PRIVATE_REFERENCE_LANES_INVALID'));
});
test('07 reference must not contain email/PII',()=>{
 const x=make();x.manifest.evidence[0].reference='private:owner@example.com';
 x.attestations=x.signatures();assert(verify(x).blockers.includes('PRIVATE_REFERENCE_LANES_INVALID'));
});
test('08 same receipt cannot be replayed across different project',()=>{
 const x=make();
 assert(v.receiptReview({...x,expectedProjectDigest:HEX('a'),now:NOW}).blockers
  .includes('MANIFEST_OR_PROJECT_SCOPE_INVALID'));
});
test('09 tampered digest breaks all Ed25519 endorsements',()=>{
 const x=make();x.manifest.evidence[0].sha256=HEX('b');
 assert(verify(x).blockers.includes('ED25519_ATTESTATION_INVALID'));
});
test('10 tampered operation breaks signature, even same signing roles',()=>{
 const x=make();x.manifest.purpose='HOSTED_STORE_MIGRATION_REVIEW';
 assert(verify(x).blockers.includes('ED25519_ATTESTATION_INVALID'));
});
test('11 change from review to one-time export requires fresh signatures',()=>{
 const x=make();x.manifest.purpose='ONE_TIME_BACKUP_EXPORT_REVIEW';
 assert(verify(x).blockers.includes('ED25519_ATTESTATION_INVALID'));
});
test('12 valid signed request to review export never authorizes export',()=>{
 const x=make();x.manifest.purpose='ONE_TIME_BACKUP_EXPORT_REVIEW';
 x.attestations=x.signatures();
 const out=verify(x);
 assert.equal(out.status,'PENDING_EXTERNAL_INDEPENDENT_VERIFICATION');
 assert.equal(out.privateExportAuthorized,false);
 assert.equal(out.durableApprovalLeaseCertified,false);
});
test('13 valid signed request to review RPC role never changes privileges',()=>{
 const x=make();x.manifest.purpose='RPC_PRIVILEGE_CHANGE_REVIEW';
 x.attestations=x.signatures();
 const out=verify(x);assert.equal(out.rpcPrivilegeChangeAuthorized,false);
 assert.equal(out.status,'PENDING_EXTERNAL_INDEPENDENT_VERIFICATION');
});
test('14 forged signature blocked',()=>{
 const x=make();
 x.attestations[1].signature=x.attestations[0].signature;
 assert(verify(x).blockers.includes('ED25519_ATTESTATION_INVALID'));
});
test('15 missing attestation blocked',()=>{
 const x=make();x.attestations.pop();
 assert(verify(x).blockers.includes('INDEPENDENT_SIGNATURE_SET_INVALID'));
});
test('16 wrong role order blocked',()=>{
 const x=make();x.attestations.reverse();
 assert(verify(x).blockers.includes('INDEPENDENT_SIGNATURE_SET_INVALID'));
});
test('17 unapproved signer key blocked',()=>{
 const x=make();x.registry.delete('QA_KEY_1');
 assert(verify(x).blockers.includes('INDEPENDENT_SIGNER_ENROLLMENT_OR_ROLE_INVALID'));
});
test('18 revoked public key blocked',()=>{
 const x=make();x.registry.get('QA_KEY_1').state='REVOKED';
 assert(verify(x).blockers.includes('INDEPENDENT_SIGNER_ENROLLMENT_OR_ROLE_INVALID'));
});
test('19 missing operator key permission for purpose denied',()=>{
 const x=make();x.registry.get('QA_KEY_2').purposes=['HOSTED_STORE_MIGRATION_REVIEW'];
 assert(verify(x).blockers.includes('INDEPENDENT_SIGNER_ENROLLMENT_OR_ROLE_INVALID'));
});
test('20 same principal acting as Controller and independent reviewer blocked',()=>{
 const x=make();x.registry.get('QA_KEY_1').principalDigest=x.registry.get('QA_KEY_0').principalDigest;
 assert(verify(x).blockers.includes('INDEPENDENT_SIGNER_ENROLLMENT_OR_ROLE_INVALID'));
});
test('21 unknown key or key ID injected into manifest blocked',()=>{
 const x=make();x.manifest.keyId='QA_FAKE_999';
 assert.equal(verify(x).status,'BLOCKED');
});
test('22 expired one-time review request blocked',()=>{
 const x=make();const out=v.receiptReview({...x,expectedProjectDigest:project,now:NOW+3600000});
 assert(out.blockers.includes('REQUEST_TIME_SCOPE_INVALID'));
});
test('23 overly long request expiry blocked',()=>{
 const x=make();x.manifest.expiresAtUtc='2026-11-16T06:30:00Z';x.attestations=x.signatures();
 assert(verify(x).blockers.includes('REQUEST_TIME_SCOPE_INVALID'));
});
test('24 stale private evidence blocked',()=>{
 const x=make();x.manifest.evidence[2].capturedAtUtc='2026-11-01T05:00:00Z';
 x.attestations=x.signatures();
 assert(verify(x).blockers.includes('PRIVATE_REFERENCE_LANES_INVALID'));
});
test('25 duplicate sha256 evidence across two lanes blocked',()=>{
 const x=make();x.manifest.evidence[1].sha256=x.manifest.evidence[0].sha256;
 x.attestations=x.signatures();
 assert(verify(x).blockers.includes('PRIVATE_REFERENCE_LANES_INVALID'));
});
test('26 missing trust roots cannot self-certify through a signed string',()=>{
 const x=make();x.registry=new Map();
 assert(verify(x).blockers.includes('TRUSTED_SIGNER_ENROLLMENT_UNAVAILABLE'));
});
test('27 input lacks source private evidence',()=>{
 const out=v.receiptReview();
 assert.equal(out.status,'BLOCKED');assert.equal(out.productionReleaseAuthorized,false);
});
test('28 private references, keys, digests, signatures NOT emitted in public result',()=>{
 const x=make(),out=verify(x),s=JSON.stringify(out);
 assert(!s.includes(x.manifest.evidence[0].reference));
 assert(!s.includes(x.manifest.evidence[0].sha256));
 assert(!s.includes(x.attestations[0].signature));
 assert(!s.includes(x.registry.get('QA_KEY_0').principalDigest));
});
test('29 all operational methods throw regardless of valid signatures',()=>{
 for(const k of ['exportBackup','restoreBackup','migrateHosted','grantDbRole',
  'changeRpcPrivilege','executeAction','sendProvider'])
 assert.throws(()=>v[k](),/ADV6C_NO_PRIVATE_OPERATION_EXECUTOR/);
});
test('30 complete synthetic receipt never certifies Store/JWT/hosted/backup',()=>{
 const out=verify(make());
 for(const k of ['jwtSessionOwnershipCertified','independentBackupRestoreCertified',
  'hostedNonceCertified','privateDbRoleApproved','signerAuthorityCertified',
  'realEvidenceContentReviewed','commerceWritesAuthorized'])
 assert.equal(out[k],false,k);
});
test('31 altered evidence order violates required lane ordering',()=>{
 const x=make();[x.manifest.evidence[0],x.manifest.evidence[1]]=
 [x.manifest.evidence[1],x.manifest.evidence[0]];
 x.attestations=x.signatures();
 assert(verify(x).blockers.includes('PRIVATE_REFERENCE_LANES_INVALID'));
});
test('32 unknown request purposes cannot claim release',()=>{
 const x=make();x.manifest.purpose='ACTIVATE_PRODUCTION';
 assert(verify(x).blockers.includes('MANIFEST_OR_PROJECT_SCOPE_INVALID'));
});
test('33 unknown private signer enrollment receipt rejected',()=>{
 const x=make();x.registry.get('QA_KEY_0').enrollmentReceipt='https://public.example/private';
 assert(verify(x).blockers.includes('INDEPENDENT_SIGNER_ENROLLMENT_OR_ROLE_INVALID'));
});
test('34 invalid private registry key is rejected',()=>{
 const x=make();x.registry.get('QA_KEY_0').publicKey={publicKey:'not-a-KeyObject'};
 assert(verify(x).blockers.includes('INDEPENDENT_SIGNER_ENROLLMENT_OR_ROLE_INVALID'));
});
test('35 private evidence intake cannot become approval lease',()=>{
 const out=verify(make());
 assert.equal(out.durableApprovalLeaseCertified,false);
 assert.equal(out.hostedMigrationAuthorized,false);
 assert.equal(out.dbRoleChangeAuthorized,false);
 assert.equal(out.providerSendsAuthorized,false);
});
