'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {CONTRACT,MODE,PROJECT,reviewAuthority}=require('./independent-authority-gate.cjs');
const NOW=Date.parse('2026-11-16T15:00:00+09:00');
const roles=['project_data_controller','security','backup_operator'];
function fixture(){
 return {
  contract:CONTRACT,mode:MODE,projectRef:PROJECT,environment:'staging',
  operation:'REVIEW_ONE_TIME_LOGICAL_EXPORT_NO_EXECUTION',
  requestRef:'QA_H10_CONTROLLER_REVIEW_0001',
  requestDigest:'f'.repeat(64),nonceDigest:'e'.repeat(64),
  issuedAtMs:NOW-1000,expiresAtMs:NOW+120000,retentionDays:7,maxAdditionalCostUsd:0,
  ownerUiEvidence:'OWNER_ROLE_VISIBLE_USER_SCREENSHOT_NOT_INDEPENDENT_PROOF',
  signers:roles.map((role,i)=>({
   ref:'QA_H10_SIGNER_REF_000'+i,role,principalDigest:String(i+1).repeat(64),
   keyFingerprint:i===2?null:String(i+4).repeat(64),
   identityStatus:'IDENTITY_UNVERIFIED_PRIVATE_INTAKE',
   keyStatus:i===2?'NOT_A_SIGNING_APPROVER':'KEY_POSSESSION_NOT_VERIFIED',
   approvalReceiptStatus:'NOT_SUBMITTED',validUntilMs:NOW+60000,revoked:false
  })),
  independentWitnessRef:'QA_H10_INDEPENDENT_WITNESS_0001',
  sourceAuthorityStatus:'PRIVATE_AUTHORITY_VERIFICATION_PENDING',
  privateVaultStatus:'ENCRYPTED_OFFSITE_CUSTODY_PENDING_INDEPENDENT_REVIEW',
  approvalLedgerStatus:'TRUSTED_PERSISTENT_LEDGER_NOT_DEPLOYED',
  realExportApproved:false,hostedDataAccessed:false
 };
}
const run=p=>reviewAuthority(p,{now:()=>NOW});
test('synthetic roles and visible Owner screenshot are never authority',()=>{
 const r=run(fixture());
 assert.equal(r.status,'SYNTHETIC_AUTHORITY_PACKET_CONSISTENT_NOT_AUTHORIZED');
 assert.equal(r.reviewLanes,3);assert.equal(r.ownerRoleObservedOnly,true);
 for(const k of ['independentOwnerCertified','independentSignersVerified','operatorAuthorized',
 'vaultVerified','hostedBackupVerified','allowedToExport','allowedToRestore',
 'allowedToMigrate','allowedToSend','hostedDataTouched'])assert.equal(r[k],false);
});
const cases=[
 ['production',p=>p.environment='production'],
 ['other project',p=>p.projectRef='another-project'],
 ['wrong contract',p=>p.contract='LIVE'],
 ['wrong mode',p=>p.mode='LIVE'],
 ['wrong operation',p=>p.operation='RESTORE_AND_MIGRATE'],
 ['request ID',p=>p.requestRef='x'],
 ['missing request hash',p=>p.requestDigest='BAD'],
 ['nonce same as request',p=>p.nonceDigest=p.requestDigest],
 ['nonce malformed',p=>p.nonceDigest='BAD'],
 ['future issuance',p=>p.issuedAtMs=NOW+10],
 ['expired request',p=>p.expiresAtMs=NOW],
 ['unbounded request',p=>p.expiresAtMs=NOW+7200000],
 ['retention too long',p=>p.retentionDays=31],
 ['retention zero',p=>p.retentionDays=0],
 ['unapproved spending',p=>p.maxAdditionalCostUsd=1],
 ['screenshot elevated to attested',p=>p.ownerUiEvidence='INDEPENDENTLY_CERTIFIED'],
 ['controller claimed verified',p=>p.sourceAuthorityStatus='VERIFIED'],
 ['vault claimed verified',p=>p.privateVaultStatus='VERIFIED'],
 ['ledger claimed deployed',p=>p.approvalLedgerStatus='DEPLOYED'],
 ['export approved bit',p=>p.realExportApproved=true],
 ['hosted accessed bit',p=>p.hostedDataAccessed=true],
 ['no signer',p=>p.signers=[]],
 ['extra signer',p=>p.signers.push({...p.signers[0]})],
 ['same signer ref',p=>p.signers[1].ref=p.signers[0].ref],
 ['same signing role',p=>p.signers[1].role=p.signers[0].role],
 ['fake role',p=>p.signers[1].role='merchant_owner'],
 ['same principal across two roles',p=>p.signers[1].principalDigest=p.signers[0].principalDigest],
 ['same signing key across signers',p=>p.signers[1].keyFingerprint=p.signers[0].keyFingerprint],
 ['signer key not registered',p=>p.signers[0].keyFingerprint=null],
 ['controller claims key proof',p=>p.signers[0].keyStatus='ATTESTED'],
 ['security claims key proof',p=>p.signers[1].keyStatus='ATTESTED'],
 ['operator attempts to sign',p=>p.signers[2].keyFingerprint='c'.repeat(64)],
 ['operator claims to be signing approver',p=>p.signers[2].keyStatus='KEY_POSSESSION_NOT_VERIFIED'],
 ['operator claims real identity',p=>p.signers[2].identityStatus='VERIFIED'],
 ['controller claims real approval receipt',p=>p.signers[0].approvalReceiptStatus='SIGNED'],
 ['reviewer same as controller',p=>p.independentWitnessRef=p.signers[0].ref],
 ['reviewer same as operator',p=>p.independentWitnessRef=p.signers[2].ref],
 ['reviewer ID short',p=>p.independentWitnessRef='x'],
 ['revoked signer',p=>p.signers[1].revoked=true],
 ['signer expired',p=>p.signers[0].validUntilMs=NOW],
 ['signer validity beyond request',p=>p.signers[1].validUntilMs=NOW+240000],
 ['extra field',p=>p.exportAllowed=true],
 ['nested privilege flag',p=>p.signers[0].canExport=true],
 ['secret field',p=>p.access_token='BAD'],
 ['private key field',p=>p.signers[0].private_key='BAD'],
 ['customer email field',p=>p.email='QA@EXAMPLE.INVALID'],
 ['unknown nested actor role',p=>p.signers[0].role='super_admin']
];
for(const [name,edit] of cases)test(name+' must fail closed',()=>{
 const p=fixture();edit(p);const r=run(p);assert.equal(r.status,'BLOCKED');
 assert.equal(r.allowedToExport,false);assert.equal(r.allowedToMigrate,false);
 assert.equal(r.allowedToRestore,false);assert.equal(r.allowedToSend,false);
});
test('plain object only: class instances denied',()=>{
 const f=fixture();f.signers[1]=new Date();assert.equal(run(f).status,'BLOCKED');
});
test('missing actor role denied',()=>{
 const f=fixture();delete f.signers[1].role;assert.equal(run(f).status,'BLOCKED');
});
