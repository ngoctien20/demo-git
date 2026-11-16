'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {CONTRACT:EC,MODE:EM,PROJECT}=require('../v1503h8-lease/signer-enrollment-review.cjs');
const {CONTRACT,MODE,fixtureDigest,assessIndependentSignerEvidence}=require('./independent-signer-evidence.cjs');
const NOW=Date.parse('2026-11-16T13:30:00+09:00');
const roles=['project_data_controller','security','backup_operator'];
function make(){
 const enrollment={
  contract:EC,mode:EM,projectRef:PROJECT,environment:'staging',
  requestRef:'QA_H9_ENROLLMENT_REQUEST_0001',
  observedAtMs:NOW-2000,expiresAtMs:NOW+60000,
  signers:roles.map((role,i)=>({
   signerRef:'QA_H9_SIGNER_REF_000'+i,role,
   sourceRef:'QA_SYNTHETIC_WITNESS_SOURCE_000'+i,
   witnessRef:'QA_H9_WITNESS_REF_000'+i,
   identityReceiptRef:'QA_H9_IDENTITY_RECEIPT_000'+i,
   possessionReceiptRef:'QA_H9_POSSESSION_RECEIPT_000'+i,
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
 };
 const bundle={
   contract:CONTRACT,mode:MODE,environment:'staging',projectRef:PROJECT,
   requestRef:enrollment.requestRef,reviewerRef:'QA_H9_PRIVATE_REVIEWER_0044',
   reviewedAtMs:NOW-500,expiresAtMs:NOW+40000,
   vaultStatus:'PRIVATE_VAULT_RECEIPTS_NOT_VERIFIED',
   humanIdentitiesVerified:false,realSignaturesPresent:false,
   operatorPrivilegesVerified:false,releaseAuthorized:false,
   privateVaultVerified:false,backupExists:false,maxAdditionalCostUsd:0,
   evidence:enrollment.signers.map((s,i)=>({
     role:s.role,signerRef:s.signerRef,
     issuerRef:'QA_H9_INDEPENDENT_ISSUER_000'+i,
     witnessRef:s.witnessRef,
     identityReceiptRef:s.identityReceiptRef,
     possessionReceiptRef:s.possessionReceiptRef,
     principalDigest:String(i+1).repeat(64),sourceDigest:fixtureDigest(s),
     keyFingerprint:s.keyFingerprint,observedAtMs:NOW-1000,
     expiresAtMs:NOW+30000,revoked:false,
     sourceLabel:'QA_SYNTHETIC_UNATTESTED_SOURCE',syntheticOnly:true
   }))
 };
 return {enrollment,bundle};
}
const run=f=>assessIndependentSignerEvidence(f.enrollment,f.bundle,{now:()=>NOW});
test('consistent synthetic three-actor receipts NEVER certify real authority',()=>{
 const r=run(make());
 assert.equal(r.status,'SYNTHETIC_EVIDENCE_CONSISTENT_NOT_REAL_ATTESTATION');
 assert.equal(r.rolesReviewed,3);
 for(const k of ['verifiedIndependentIdentity','verifiedSourceAuthenticity',
  'verifiedActualSigner','verifiedOperator','verifiedPrivateVault','verifiedBackup',
  'authorizedToExport','authorizedToRestore','authorizedToMigrate',
  'authorizedToSend','hostedDataTouched'])assert.equal(r[k],false);
});
function block(label,edit){
 test(label+' fails closed',()=>{
  const f=make();edit(f);const v=run(f);
  assert.equal(v.status,'BLOCKED',label);
  for(const k of ['verifiedActualSigner','verifiedOperator','authorizedToExport',
    'authorizedToRestore','authorizedToMigrate','authorizedToSend','hostedDataTouched'])
   assert.equal(v[k],false,label);
 });
}
block('wrong project',f=>f.bundle.projectRef='different_project');
block('production environment',f=>f.bundle.environment='production');
block('fake registry contract',f=>f.bundle.contract='REAL_ATTESTATION');
block('fake mode',f=>f.bundle.mode='LIVE_APPROVED');
block('unknown request',f=>f.bundle.requestRef='QA_H9_OTHER_REQUEST_001');
block('fake human verification',f=>f.bundle.humanIdentitiesVerified=true);
block('fake human signatures',f=>f.bundle.realSignaturesPresent=true);
block('fake operator verification',f=>f.bundle.operatorPrivilegesVerified=true);
block('fake release authorization',f=>f.bundle.releaseAuthorized=true);
block('fake private vault',f=>f.bundle.privateVaultVerified=true);
block('fake backup exists',f=>f.bundle.backupExists=true);
block('unapproved cost',f=>f.bundle.maxAdditionalCostUsd=1);
block('vault marked verified',f=>f.bundle.vaultStatus='VERIFIED');
block('reviewer same as signer',f=>f.bundle.reviewerRef=f.enrollment.signers[0].signerRef);
block('reviewer same as witness',f=>f.bundle.reviewerRef=f.enrollment.signers[1].witnessRef);
block('reviewer missing',f=>f.bundle.reviewerRef='x');
block('expired bundle',f=>f.bundle.expiresAtMs=NOW-1);
block('bundle exceeds enrollment expiry',f=>f.bundle.expiresAtMs=NOW+120000);
block('review observed in future',f=>f.bundle.reviewedAtMs=NOW+1);
block('review before enrollment',f=>f.bundle.reviewedAtMs=NOW-5000);
block('two receipt lanes',f=>f.bundle.evidence.pop());
block('extra receipt lane',f=>f.bundle.evidence.push({...f.bundle.evidence[0]}));
block('role replaced',f=>f.bundle.evidence[0].role='merchant_owner');
block('signer switched',f=>f.bundle.evidence[0].signerRef=f.enrollment.signers[1].signerRef);
block('witness switched',f=>f.bundle.evidence[0].witnessRef=f.enrollment.signers[1].witnessRef);
block('identity receipt altered',f=>f.bundle.evidence[0].identityReceiptRef='QA_H9_FAKE_IDENTITY_001');
block('possession receipt altered',f=>f.bundle.evidence[0].possessionReceiptRef='QA_H9_FAKE_POSSESSION_001');
block('duplicate principal hash',f=>f.bundle.evidence[1].principalDigest=f.bundle.evidence[0].principalDigest);
block('bad principal digest',f=>f.bundle.evidence[1].principalDigest='bad');
block('duplicate independent issuer',f=>f.bundle.evidence[1].issuerRef=f.bundle.evidence[0].issuerRef);
block('issuer equals signer',f=>f.bundle.evidence[0].issuerRef=f.enrollment.signers[0].signerRef);
block('issuer equals reviewer',f=>f.bundle.evidence[0].issuerRef=f.bundle.reviewerRef);
block('source receipt hash altered',f=>f.bundle.evidence[0].sourceDigest='0'.repeat(64));
block('source label forged',f=>f.bundle.evidence[0].sourceLabel='REAL_GOV_ID');
block('revoked evidence',f=>f.bundle.evidence[0].revoked=true);
block('expired evidence',f=>f.bundle.evidence[0].expiresAtMs=NOW-1);
block('source observed before signer valid',f=>f.bundle.evidence[0].observedAtMs=NOW-30000);
block('source observed after review',f=>f.bundle.evidence[0].observedAtMs=NOW+1);
block('source expires after signer',f=>f.bundle.evidence[0].expiresAtMs=NOW+7200000);
block('wrong signer public fingerprint',f=>f.bundle.evidence[0].keyFingerprint='f'.repeat(64));
block('operator wrongly has fingerprint',f=>f.bundle.evidence[2].keyFingerprint='f'.repeat(64));
block('synthetic source field flipped',f=>f.bundle.evidence[0].syntheticOnly=false);
block('secret identity token embedded',f=>f.bundle.evidence[0].access_token='bad');
block('personal email embedded',f=>f.bundle.email='qa@example.invalid');
block('private key embedded',f=>f.enrollment.signers[0].private_key='secret');
block('unknown bundle field',f=>f.bundle.approved=true);
block('unknown proof field',f=>f.bundle.evidence[0].rawId='person');
block('H8 enrollment revoked',f=>f.enrollment.signers[1].state='REVOKED');
block('H8 enrollment false approval',f=>f.enrollment.review.humanIdentityVerified=true);
block('H8 role collision',f=>f.enrollment.signers[1].role=f.enrollment.signers[0].role);
block('H8 intent changed',f=>f.enrollment.requestRef='QA_H9_ELSE_00001');
