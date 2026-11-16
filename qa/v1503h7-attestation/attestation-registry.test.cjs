'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {generateKeyPairSync,createPublicKey,createHash,sign}=require('node:crypto');
const {CONTRACT,PROJECT,OP,canonical,approvalPayload}=require('../v1509d-owner-backup/backup-authorization-gate.cjs');
const {MODE,assessSyntheticAttestationRegistry}=require('./attestation-registry.cjs');
const NOW=Date.parse('2026-11-16T12:30:00+09:00');
const keys={controller:generateKeyPairSync('ed25519'),security:generateKeyPairSync('ed25519'),other:generateKeyPairSync('ed25519')};
const refs={controller:'QA_H7_CONTROLLER_0001',security:'QA_H7_SECURITY_0002',operator:'QA_H7_OPERATOR_0003'};
const fingerprint=pub=>createHash('sha256').update(createPublicKey(pub).export({format:'der',type:'spki'})).digest('hex');
const digest=x=>createHash('sha256').update(x).digest('hex');
const pub=k=>keys[k].publicKey.export({format:'pem',type:'spki'});
function request(){return {
 contract:CONTRACT,requestRef:'QA_H7_BACKUP_REQUEST_0001',environment:'staging',
 projectRef:PROJECT,operation:OP,scope:'DATABASE_LOGICAL_EXPORT_FOR_PRIVATE_RECOVERY_REVIEW',
 backupMethod:'SUPABASE_CLI_LOGICAL_DUMP_PROPOSED',
 destinationClass:'APPROVED_PRIVATE_ENCRYPTED_OFFSITE_PENDING',
 encryptionRequired:true,retentionDays:7,maxAdditionalCostUsd:0,
 sourceReadOnly:true,prohibitsRestore:true,prohibitsSchemaChange:true,
 prohibitsCustomerMessaging:true,issuedAtMs:NOW-1000,expiresAtMs:NOW+120000,syntheticOnly:true
};}
function signer(id,role,key=null){return {
 signerRef:id,role,projectRef:PROJECT,environment:'staging',active:true,
 proofMode:'QA_WITNESS_UNVERIFIED_FOR_HOSTED',
 issuedAtMs:NOW-10000,expiresAtMs:NOW+3600000,revokedAtMs:null,
 publicKeyPem:key?pub(key):null,keyFingerprint:key?fingerprint(pub(key)):null
};}
function attest(r,id,role,key){return {
 signerRef:id,role,observedAtMs:NOW,purpose:OP,
 signatureBase64:sign(null,approvalPayload(r,id,role,NOW),keys[key].privateKey).toString('base64')
};}
function fixture(){
 const r=request();
 return {
  request:r,
  attestations:[attest(r,refs.controller,'project_data_controller','controller'),
                attest(r,refs.security,'security','security')],
  registry:{
    mode:MODE,projectRef:PROJECT,environment:'staging',operatorRef:refs.operator,
    nonceDigest:digest('V15-H7-REPLAY:'+PROJECT+':'+digest(canonical(r))),
    signers:[signer(refs.controller,'project_data_controller','controller'),
             signer(refs.security,'security','security'),
             signer(refs.operator,'backup_operator')]
  }
 };
}
const run=f=>assessSyntheticAttestationRegistry(f,{now:()=>NOW});
test('synthetic enrolled signers + two signatures pass SHAPE ONLY, never authorize',()=>{
 const out=run(fixture());
 assert.equal(out.status,'SYNTHETIC_REGISTRY_VERIFIED_NOT_HOSTED_AUTHORIZATION');
 assert.equal(out.syntheticRolesChecked,3);
 assert.equal(out.syntheticSignaturesChecked,2);
 assert.match(out.requestDigest,/^[a-f0-9]{64}$/);
 assert.match(out.nonceDigest,/^[a-f0-9]{64}$/);
 for(const k of ['independentOwnerCertified','realSignerEnrolled','privateVaultVerified',
  'persistentReplayLedgerDeployed','realAuthorizationVerified','allowedToExport',
  'allowedToRestore','allowedToMigrate','allowedToSend','hostedDataTouched'])assert.equal(out[k],false);
});
function deny(name,mutate){
 test(name,()=>{
  const f=fixture();mutate(f);
  const v=run(f);
  assert.equal(v.status,'BLOCKED',name);
  for(const k of ['allowedToExport','allowedToRestore','allowedToMigrate','allowedToSend',
    'realSignerEnrolled','realAuthorizationVerified','hostedDataTouched'])assert.equal(v[k],false,name);
 });
}
deny('registry missing',f=>f.registry=null);
deny('registry forged authority flag',f=>f.registry.approved=true);
deny('registry mode not synthetic',f=>f.registry.mode='HOSTED_CERTIFIED');
deny('wrong project registry',f=>f.registry.projectRef='another_project');
deny('registry shifted to production',f=>f.registry.environment='production');
deny('unknown operator',f=>f.registry.operatorRef='QA_UNKNOWN_OPERATOR_0000');
deny('not exactly three signers',f=>f.registry.signers.pop());
deny('duplicate signer ID',f=>f.registry.signers[1].signerRef=refs.controller);
deny('duplicated signing role',f=>f.registry.signers[1].role='project_data_controller');
deny('unknown fourth role',f=>f.registry.signers[0].role='super_admin');
deny('role typo',f=>f.registry.signers[1].role='merchant_owner');
deny('controller deactivated',f=>f.registry.signers[0].active=false);
deny('security revoked',f=>f.registry.signers[1].revokedAtMs=NOW-1000);
deny('operator revoked',f=>f.registry.signers[2].active=false);
deny('controller expired',f=>f.registry.signers[0].expiresAtMs=NOW);
deny('reviewer enrolled in future',f=>f.registry.signers[1].issuedAtMs=NOW+1);
deny('operator enrolled in future',f=>f.registry.signers[2].issuedAtMs=NOW+1);
deny('security enrolled with invalid timeline',f=>f.registry.signers[1].expiresAtMs=NOW-10001);
deny('controller wrong environment',f=>f.registry.signers[0].environment='production');
deny('operator different project',f=>f.registry.signers[2].projectRef='another_project');
deny('operator supplied signing key',f=>f.registry.signers[2].publicKeyPem=pub('other'));
deny('operator supplied arbitrary fingerprint',f=>f.registry.signers[2].keyFingerprint='a'.repeat(64));
deny('public key not Ed25519',f=>f.registry.signers[0].publicKeyPem='not a key');
deny('signer key swapped from another issuer',f=>f.registry.signers[0].publicKeyPem=pub('other'));
deny('mismatched signer key fingerprint',f=>f.registry.signers[1].keyFingerprint='b'.repeat(64));
deny('identical public key fingerprint across signers',f=>{
 f.registry.signers[1].publicKeyPem=pub('controller');
 f.registry.signers[1].keyFingerprint=f.registry.signers[0].keyFingerprint;
});
deny('unknown signup proof',f=>f.registry.signers[0].proofMode='SIGNED_BY_MERCHANT');
deny('unexpected signer field',f=>f.registry.signers[0].certified=true);
deny('attempt to include actual privateKey',f=>f.registry.signers[0].privateKey='secret');
deny('attempt to include jwt',f=>f.request.raw_jwt='anything');
deny('attempt to include customer phone',f=>f.registry.phone='anything');
deny('unknown role in attestations',f=>f.attestations[1].role='backup_operator');
deny('operator cannot sign as security',f=>f.attestations[1].signerRef=refs.operator);
deny('two signatures from same signer',f=>f.attestations[1].signerRef=refs.controller);
deny('missing security signature',f=>f.attestations.pop());
deny('third signature not allowed',f=>f.attestations.push({...f.attestations[0]}));
deny('signature tampered',f=>{const x=Buffer.from(f.attestations[0].signatureBase64,'base64');x[0]^=1;f.attestations[0].signatureBase64=x.toString('base64')});
deny('signed request tampered',f=>f.request.retentionDays=8);
deny('request points to production',f=>f.request.environment='production');
deny('request grants restore',f=>f.request.prohibitsRestore=false);
deny('expired request',f=>f.request.expiresAtMs=NOW-1);
deny('unapproved extra cost',f=>f.request.maxAdditionalCostUsd=1);
deny('nonce digest spoofed',f=>f.registry.nonceDigest='0'.repeat(64));
deny('nonce digest absent',f=>f.registry.nonceDigest=null);
deny('untrusted controller extra role secret',f=>f.registry.signers[0].access_token='s');
deny('untrusted request backend credential',f=>f.request.db_password='unsafe');
deny('request signer status spoof',f=>f.attestations[0].approvedForExport=true);
deny('prototype array registry',f=>f.registry.signers={});
deny('invalid signer ref',f=>f.registry.signers[0].signerRef='x');
deny('missing registry field',f=>delete f.registry.nonceDigest);
