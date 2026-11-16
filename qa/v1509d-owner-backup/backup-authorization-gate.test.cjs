'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {generateKeyPairSync,sign}=require('node:crypto');
const {PROJECT,CONTRACT,OP,approvalPayload,canonical,
 assessBackupAuthorizationEnvelope}=require('./backup-authorization-gate.cjs');
const NOW=Date.parse('2026-11-16T11:20:00+09:00');
const controller=generateKeyPairSync('ed25519');
const security=generateKeyPairSync('ed25519');
const other=generateKeyPairSync('ed25519');
const ID_CONTROLLER='QA_PLATFORM_CONTROLLER';
const ID_SECURITY='QA_SECURITY_REVIEWER';
function request(){return {
 contract:CONTRACT,requestRef:'QA_REQUEST_BACKUP_09D',
 environment:'staging',projectRef:PROJECT,operation:OP,
 scope:'DATABASE_LOGICAL_EXPORT_FOR_PRIVATE_RECOVERY_REVIEW',
 backupMethod:'SUPABASE_CLI_LOGICAL_DUMP_PROPOSED',
 destinationClass:'APPROVED_PRIVATE_ENCRYPTED_OFFSITE_PENDING',
 encryptionRequired:true,retentionDays:7,maxAdditionalCostUsd:0,
 sourceReadOnly:true,prohibitsRestore:true,prohibitsSchemaChange:true,
 prohibitsCustomerMessaging:true,issuedAtMs:NOW-1000,expiresAtMs:NOW+60000,
 syntheticOnly:true
};}
function hostTrust(){return {
 [ID_CONTROLLER]:{role:'project_data_controller',active:true,
 environment:'EPHEMERAL_QA_ONLY',projectRef:PROJECT,syntheticOnly:true,
 publicKeyPem:controller.publicKey.export({format:'pem',type:'spki'})},
 [ID_SECURITY]:{role:'security',active:true,
 environment:'EPHEMERAL_QA_ONLY',projectRef:PROJECT,syntheticOnly:true,
 publicKeyPem:security.publicKey.export({format:'pem',type:'spki'})}
};}
function approval(r,signerRef,role,privateKey){
 const observedAtMs=NOW;
 return {signerRef,role,observedAtMs,purpose:OP,
 signatureBase64:sign(null,approvalPayload(r,signerRef,role,observedAtMs),
 privateKey).toString('base64')};
}
function baseline(){
 const r=request();
 return {r,approvals:[
 approval(r,ID_CONTROLLER,'project_data_controller',controller.privateKey),
 approval(r,ID_SECURITY,'security',security.privateKey)
 ],trust:hostTrust()};
}
function run(b){
 return assessBackupAuthorizationEnvelope(b.r,b.approvals,b.trust,{now:()=>NOW});
}
test('valid 2 independent Ed25519 synthetic signatures do NOT authorize real export',()=>{
 const b=baseline(),r=run(b);
 assert.equal(r.status,'SYNTHETIC_DUAL_SIGNATURE_VERIFIED_NOT_AUTHORIZED');
 assert.equal(r.syntheticApprovalsChecked,2);
 assert.equal(r.signatureType,'Ed25519');
 assert.equal(r.approvedForBackup,false);
 assert.equal(r.approvedForRestore,false);
 assert.equal(r.allowedToExport,false);
 assert.equal(r.allowedToMigrate,false);
 assert.equal(r.allowedToSend,false);
 assert.equal(r.realSignatureCertified,false);
 assert.equal(r.hostedDataAccessed,false);
 assert.match(r.requestFingerprint,/^[0-9a-f]{64}$/);
 assert.equal(Object.hasOwn(r,'projectData'),false);
 assert.equal(Object.hasOwn(r,'signatureBase64'),false);
});
test('canonical request digest insensitive to insertion order',()=>{
 const r=request();
 const reverse=Object.fromEntries(Object.entries(r).reverse());
 assert.equal(canonical(r),canonical(reverse));
});
function blocked(name,edit,reason){
 test(name,()=>{const b=baseline();edit(b);
 const r=run(b);
 assert.equal(r.status,'BLOCKED');assert.equal(r.reason,reason);
 assert.equal(r.approvedForBackup,false);assert.equal(r.allowedToExport,false);
 assert.equal(r.approvedForRestore,false);assert.equal(r.hostedDataAccessed,false);
 });}
blocked('no project-controller signoff',b=>b.approvals.splice(0,1),'TWO_INDEPENDENT_APPROVERS_REQUIRED');
blocked('no security signoff',b=>b.approvals.splice(1,1),'TWO_INDEPENDENT_APPROVERS_REQUIRED');
blocked('three approvals rejected',b=>b.approvals.push({...b.approvals[0]}),'TWO_INDEPENDENT_APPROVERS_REQUIRED');
blocked('aliased repeated approval object rejected',b=>b.approvals.push(b.approvals[0]),'UNTRUSTED_OR_SENSITIVE_INPUT');
blocked('same issuer cannot sign twice',b=>{b.approvals[1].signerRef=ID_CONTROLLER},'SIGNER_ROLE_SCOPE_OR_TIME_INVALID');
blocked('self-approved role duplication rejected',b=>{b.approvals[1].role='project_data_controller'},'SIGNER_ROLE_SCOPE_OR_TIME_INVALID');
blocked('unknown signer rejected',b=>{b.approvals[1].signerRef='QA_ATTACKER_UNKNOWN'},'UNTRUSTED_OR_REVOKED_SIGNER');
blocked('revoked trusted signer rejected',b=>{b.trust[ID_SECURITY].active=false},'UNTRUSTED_OR_REVOKED_SIGNER');
blocked('untrusted environment rejected',b=>{b.trust[ID_SECURITY].environment='PRODUCTION'},'UNTRUSTED_OR_REVOKED_SIGNER');
blocked('synthetic trust disabled rejected',b=>{b.trust[ID_SECURITY].syntheticOnly=false},'UNTRUSTED_OR_REVOKED_SIGNER');
blocked('signer project mismatch rejected',b=>{b.trust[ID_SECURITY].projectRef='other_project'},'UNTRUSTED_OR_REVOKED_SIGNER');
blocked('public key swap rejected',b=>{b.trust[ID_SECURITY].publicKeyPem=other.publicKey.export({format:'pem',type:'spki'})},'INVALID_APPROVAL_SIGNATURE');
blocked('signature bit flip rejected',b=>{const s=Buffer.from(b.approvals[0].signatureBase64,'base64');s[0]^=1;b.approvals[0].signatureBase64=s.toString('base64')},'INVALID_APPROVAL_SIGNATURE');
blocked('bad signature encoding rejected',b=>{b.approvals[0].signatureBase64='invalid-signature'},'INVALID_SIGNATURE_ENCODING');
blocked('role swapped without signature rejected',b=>{b.approvals[0].role='security'},'UNTRUSTED_OR_REVOKED_SIGNER');
blocked('scope mutation invalidates request',b=>{b.r.retentionDays=8},'INVALID_APPROVAL_SIGNATURE');
blocked('project mismatch rejected',b=>{b.r.projectRef='other-project'},'UNAUTHORIZED_SCOPE_OR_COST');
blocked('production request rejected',b=>{b.r.environment='production'},'UNAUTHORIZED_SCOPE_OR_COST');
blocked('non synthetic real request rejected',b=>{b.r.syntheticOnly=false},'UNAUTHORIZED_SCOPE_OR_COST');
blocked('restore action never included',b=>{b.r.operation='RESTORE_HOSTED_DATABASE'},'UNAUTHORIZED_SCOPE_OR_COST');
blocked('schema migration action never included',b=>{b.r.prohibitsSchemaChange=false},'UNAUTHORIZED_SCOPE_OR_COST');
blocked('provider messaging never included',b=>{b.r.prohibitsCustomerMessaging=false},'UNAUTHORIZED_SCOPE_OR_COST');
blocked('source write requested rejected',b=>{b.r.sourceReadOnly=false},'UNAUTHORIZED_SCOPE_OR_COST');
blocked('export automatically restoring rejected',b=>{b.r.prohibitsRestore=false},'UNAUTHORIZED_SCOPE_OR_COST');
blocked('unapproved fee rejected',b=>{b.r.maxAdditionalCostUsd=1},'UNAUTHORIZED_SCOPE_OR_COST');
blocked('unencrypted destination rejected',b=>{b.r.encryptionRequired=false},'UNAUTHORIZED_SCOPE_OR_COST');
blocked('public artifact destination rejected',b=>{b.r.destinationClass='PUBLIC_GITHUB'},'UNAUTHORIZED_SCOPE_OR_COST');
blocked('excessive retention denied',b=>{b.r.retentionDays=365},'UNAUTHORIZED_SCOPE_OR_COST');
blocked('zero retention denied',b=>{b.r.retentionDays=0},'UNAUTHORIZED_SCOPE_OR_COST');
blocked('request expired denied',b=>{b.r.expiresAtMs=NOW-1},'EXPIRED_OR_UNBOUNDED_REQUEST');
blocked('request issued in future denied',b=>{b.r.issuedAtMs=NOW+1},'EXPIRED_OR_UNBOUNDED_REQUEST');
blocked('request longer than one hour denied',b=>{b.r.expiresAtMs=NOW+7200000},'EXPIRED_OR_UNBOUNDED_REQUEST');
blocked('attestation timestamp beyond current time denied',b=>{b.approvals[0].observedAtMs=NOW+1},'SIGNER_ROLE_SCOPE_OR_TIME_INVALID');
blocked('attestation timestamp before request denied',b=>{b.approvals[0].observedAtMs=NOW-2000},'SIGNER_ROLE_SCOPE_OR_TIME_INVALID');
blocked('attestation purpose not backup export denied',b=>{b.approvals[0].purpose='PUBLISH_PRODUCTION'},'SIGNER_ROLE_SCOPE_OR_TIME_INVALID');
blocked('signer signature cannot substitute security approver role',b=>{b.trust[ID_SECURITY].role='project_data_controller'},'UNTRUSTED_OR_REVOKED_SIGNER');
blocked('malformed approval record denied',b=>{b.approvals[0].extra=true},'INVALID_ATTESTATION');
blocked('extra request action denied',b=>{b.r.can_send=true},'REQUEST_SCHEMA_MISMATCH');
blocked('raw jwt field denied',b=>{b.r.raw_jwt='REDACTED'},'UNTRUSTED_OR_SENSITIVE_INPUT');
blocked('nested token field denied',b=>{b.r.extra=[{access_token:'REDACTED'}]},'UNTRUSTED_OR_SENSITIVE_INPUT');
blocked('database password field denied',b=>{b.r.db_password='REDACTED'},'UNTRUSTED_OR_SENSITIVE_INPUT');
blocked('secret in signer metadata denied',b=>{b.trust[ID_SECURITY].secret='REDACTED'},'UNTRUSTED_OR_SENSITIVE_INPUT');
blocked('missing synthetic request ID denied',b=>{b.r.requestRef='x'},'UNAUTHORIZED_SCOPE_OR_COST');
blocked('backup method unknown denied',b=>{b.r.backupMethod='BACKUP_PRODUCTION_NOW'},'UNAUTHORIZED_SCOPE_OR_COST');
test('no trusted registry remains blocked',()=>{
 const b=baseline();
 const r=assessBackupAuthorizationEnvelope(b.r,b.approvals,{},{now:()=>NOW});
 assert.equal(r.status,'BLOCKED');assert.equal(r.allowedToExport,false);
});
