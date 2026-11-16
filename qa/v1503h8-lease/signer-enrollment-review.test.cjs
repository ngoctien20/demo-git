'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {CONTRACT,MODE,PROJECT,reviewSyntheticEnrollment}=require('./signer-enrollment-review.cjs');
const NOW=Date.parse('2026-11-16T12:40:00+09:00');
const roles=['project_data_controller','security','backup_operator'];
const make=()=>({
 contract:CONTRACT,mode:MODE,projectRef:PROJECT,environment:'staging',
 requestRef:'QA_H8_ENROLLMENT_REQUEST_0001',
 observedAtMs:NOW-2000,expiresAtMs:NOW+60000,
 signers:roles.map((role,i)=>({
  signerRef:'QA_H8_SIGNER_REF_000'+i,role,
  sourceRef:'QA_SYNTHETIC_WITNESS_SOURCE_00'+i,
  witnessRef:'QA_H8_WITNESS_REF_000'+i,
  identityReceiptRef:'QA_H8_IDENTITY_RECEIPT_000'+i,
  possessionReceiptRef:'QA_H8_POSSESSION_RECEIPT_000'+i,
  keyFingerprint:i===2?null:String(i+1).repeat(64),
  state:'QA_INTAKE_PENDING',validFromMs:NOW-10000,validUntilMs:NOW+3600000
 })),
 review:{
  scope:'PRIVATE_ENROLLMENT_QA_REVIEW_NO_AUTHORITY',
  privateVaultStatus:'PRIVATE_VAULT_PENDING',
  humanIdentityVerified:false,mfaVerified:false,hardwareKeyAttested:false,
  keyRotationAndRevocationReady:false,trustedEnrollmentServiceDeployed:false,
  persistentReplayLedgerDeployed:false,operatorLeastPrivilegeVerified:false,
  retentionDays:7,maxAdditionalCostUsd:0
 }
});
test('full synthetic intake shape never enrolls any real human or authorizes backup',()=>{
 const r=reviewSyntheticEnrollment(make(),{now:()=>NOW});
 assert.equal(r.status,'SYNTHETIC_SIGNER_ENROLLMENT_SHAPE_REVIEWED_NOT_TRUSTED');
 assert.equal(r.rolesReviewed,3);
 for(const k of ['verifiedHumanIdentity','enrolledTrustedSigner','attestationAuthorized',
  'realBackupAuthorized','canExport','canRestore','canMigrate','canSend','hostedDatabaseTouched'])
   assert.equal(r[k],false);
});
const cases=[
 ['different project',p=>p.projectRef='another-project'],
 ['production environment',p=>p.environment='production'],
 ['different mode',p=>p.mode='HOSTED_APPROVED'],
 ['different contract',p=>p.contract='QA_FAKE_CONTRACT'],
 ['invalid request ID',p=>p.requestRef='x'],
 ['future intake',p=>p.observedAtMs=NOW+1000],
 ['expired intake',p=>p.expiresAtMs=NOW],
 ['unbounded intake',p=>p.expiresAtMs=NOW+7200000],
 ['missing role',p=>p.signers.pop()],
 ['extra role',p=>p.signers.push({...p.signers[0]})],
 ['duplicate role',p=>p.signers[1].role=p.signers[0].role],
 ['wrong role',p=>p.signers[1].role='merchant_owner'],
 ['duplicate signer',p=>p.signers[1].signerRef=p.signers[0].signerRef],
 ['duplicate independent witness',p=>p.signers[1].witnessRef=p.signers[0].witnessRef],
 ['duplicate identity receipt',p=>p.signers[1].identityReceiptRef=p.signers[0].identityReceiptRef],
 ['duplicate possession receipt',p=>p.signers[1].possessionReceiptRef=p.signers[0].possessionReceiptRef],
 ['identity same as possession',p=>p.signers[0].possessionReceiptRef=p.signers[0].identityReceiptRef],
 ['duplicate key fingerprint',p=>p.signers[1].keyFingerprint=p.signers[0].keyFingerprint],
 ['operator signing fingerprint',p=>p.signers[2].keyFingerprint='a'.repeat(64)],
 ['invalid signing fingerprint',p=>p.signers[0].keyFingerprint='bad'],
 ['pre approved signer',p=>p.signers[0].state='HOSTED_APPROVED'],
 ['signer expired',p=>p.signers[0].validUntilMs=NOW],
 ['signer not yet valid',p=>p.signers[1].validFromMs=NOW+1],
 ['signer invalid dates',p=>p.signers[1].validUntilMs=NOW-10001],
 ['fake MFA approval',p=>p.review.mfaVerified=true],
 ['fake human verification',p=>p.review.humanIdentityVerified=true],
 ['fake key attestation',p=>p.review.hardwareKeyAttested=true],
 ['fake vault',p=>p.review.privateVaultStatus='VERIFIED'],
 ['fake rotation readiness',p=>p.review.keyRotationAndRevocationReady=true],
 ['fake enrollment service',p=>p.review.trustedEnrollmentServiceDeployed=true],
 ['fake one-use ledger',p=>p.review.persistentReplayLedgerDeployed=true],
 ['fake operator privilege',p=>p.review.operatorLeastPrivilegeVerified=true],
 ['wrong purpose',p=>p.review.scope='HOSTED_BACKUP_EXPORT'],
 ['positive cost',p=>p.review.maxAdditionalCostUsd=1],
 ['invalid retention',p=>p.review.retentionDays=31],
 ['no retention',p=>p.review.retentionDays=0],
 ['no required source receipt',p=>p.signers[0].sourceRef='x'],
 ['unexpected request field',p=>p.allowedToExport=true],
 ['unexpected signer field',p=>p.signers[0].authorized=true],
 ['unexpected review field',p=>p.review.approved=true],
 ['secret in top level',p=>p.access_token='FAKE_TOKEN'],
 ['secret in signer',p=>p.signers[0].private_key='FAKE_SECRET'],
 ['PII field',p=>p.signers[1].email='qa@example.invalid'],
 ['missing review',p=>delete p.review],
 ['missing identity receipt',p=>delete p.signers[0].identityReceiptRef],
 ['review not object',p=>p.review=[]],
 ['signer not object',p=>p.signers[0]=''],
 ['request not object',p=>p=null]
];
for(const [name,mutate] of cases){
 test(name+' is fail-closed',()=>{
  let p=make();const maybe=mutate(p);if(maybe===null)p=null;
  const r=reviewSyntheticEnrollment(p,{now:()=>NOW});
  assert.equal(r.status,'BLOCKED',name);
  assert.equal(r.canExport,false,name);
  assert.equal(r.canRestore,false,name);
  assert.equal(r.canMigrate,false,name);
  assert.equal(r.canSend,false,name);
 });
}
