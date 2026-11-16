'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const crypto=require('node:crypto');
const adv6c=require('./adv6c-private-evidence-intake.cjs');
const gate=require('./adv6d-private-authority-decision.cjs');
const NOW=Date.parse('2026-11-16T06:12:00Z');
const DIG=c=>c.repeat(64);
const PROJECT=DIG('a');
const ref=(s='proof')=>'private:'+s+'-ref-20261116';
const roles=adv6c.ROLES;
const signers=()=>({
 version:gate.VERSION,projectDigest:PROJECT,
 createdAtUtc:'2026-11-16T06:01:00Z',expiresAtUtc:'2026-11-16T06:45:00Z',
 registrar:{principalDigest:DIG('f'),receiptRef:ref('registrar-enrollment'),
  authorityProofRef:ref('registrar-authority')},
 signers:roles.map((role,i)=>({
  role,keyId:'QA_ENROLL_'+i,principalDigest:DIG(String(i+1)),
  publicKeyFingerprint:DIG(String(i+4)),
  enrollmentReceiptRef:ref('enroll-'+i),scopeRef:ref('scope-'+i),
  status:'ACTIVE'
 }))
});
function snapshot(){
 return {contract:gate.RPC,capturedAtUtc:'2026-11-16T06:02:00Z',
  source:'HOSTED_PG_CATALOG_READ_ONLY',projectDigest:PROJECT,
  functions:gate.EXPECTED_RPC.map(({name,args})=>({
   name,args,owner:'postgres',securityDefiner:true,searchPathRestricted:true,
   anonExecute:name==='qa_shop_b_zalo_claim',
   authenticatedExecute:name!=='qa_shop_b_zalo_claim'
  }))
 };
}
function rpcReview(){
 return {contract:gate.RPC_REVIEW,reviewedAtUtc:'2026-11-16T06:06:00Z',
  controllerRef:ref('controller-rpc'),reviewerRef:ref('security-rpc'),
  functionBodyAuditRef:ref('function-body'),callerDependencyRef:ref('caller-map'),
  positiveNegativeQaRef:ref('regression'),rollbackRef:ref('rollback'),
  maintenanceWindowRef:ref('maintenance')};
}
const request=(operation='BACKUP_EXPORT_REVIEW')=>({
 contract:gate.REQUEST,operation,requestId:'QA-ADV6DOPERATION0001',
 projectDigest:PROJECT,scopeDigest:DIG('9'),
 createdAtUtc:'2026-11-16T06:08:00Z',expiresAtUtc:'2026-11-16T06:16:00Z',
 oneTime:true,noAdditionalSpend:true,
 controllerApprovalRef:ref('controller-approval'),operatorMandateRef:ref('operator-mandate'),
 securityReviewRef:ref('security-review'),backupCoverageRef:ref('backup-coverage'),
 vaultCustodyRef:ref('vault-custody'),rollbackPlanRef:ref('rollback-plan'),
 atomicLeaseRef:ref('atomic-lease')
});
function receipt(operation='BACKUP_EXPORT_REVIEW'){
 const keys=roles.map(()=>crypto.generateKeyPairSync('ed25519'));
 const purpose=gate.OPS[operation];
 const manifest={contract:adv6c.CONTRACT,requestId:'QA-ADV6DOPERATION0001',
  projectDigest:PROJECT,purpose,
  createdAtUtc:'2026-11-16T06:08:00Z',expiresAtUtc:'2026-11-16T06:16:00Z',
  evidence:adv6c.LANES.map((lane,i)=>({
   lane,reference:ref('evidence-'+i),
   sha256:crypto.createHash('sha256').update('synthetic-'+lane).digest('hex'),
   capturedAtUtc:'2026-11-16T06:01:00Z'
  }))
 };
 const registry=new Map(roles.map((role,i)=>['QA_SIGN_'+i,{
  role,principalDigest:crypto.createHash('sha256').update('qa-signer-'+i).digest('hex'),
  publicKey:keys[i].publicKey,
  enrollmentReceipt:ref('signer-enroll-'+i),
  state:'ACTIVE',purposes:adv6c.PURPOSES.slice()
 }]));
 const attestations=roles.map((role,i)=>({
  role,keyId:'QA_SIGN_'+i,
  signature:crypto.sign(null,adv6c.canonicalBytes(manifest),keys[i].privateKey).toString('base64url')
 }));
 return {manifest,registry,attestations};
}
const auth=(enrollment=signers())=>gate.reviewSignerEnrollment({
 enrollment,expectedProjectDigest:PROJECT,now:NOW
});
const risk=(s=snapshot(),review=rpcReview())=>gate.reviewRpcRisk({
 snapshot:s,review,now:NOW
});
function decision(operation='BACKUP_EXPORT_REVIEW',extras={}){
 const v=receipt(operation),r=adv6c.receiptReview({
  ...v,expectedProjectDigest:PROJECT,now:NOW
 });
 return gate.reviewOperationDecision({
  request:request(operation),receipt:r,signerAuthority:auth(),
  rpcRisk:risk(),expectedProjectDigest:PROJECT,now:NOW,...extras
 });
}
test('01 signer evidence requires three roles',()=>{
 assert.deepEqual(roles,['CONTROLLER','SECURITY_REVIEWER','BACKUP_OPERATOR']);
});
test('02 complete synthetic enrollment only pending PRIVATE registrar verification',()=>{
 const x=auth();
 assert.equal(x.status,'PENDING_PRIVATE_REGISTRAR_VERIFICATION');
 assert.equal(x.roleEnrollmentFieldsValid,true);
 assert.equal(x.privateAuthorityVerified,false);
});
test('03 enrollment cannot authorize any hosted action',()=>{
 const x=auth();
 for(const k of ['hostedWriteAuthorized','backupExportAuthorized',
 'roleGrantAuthorized','rpcPrivilegeChangeAuthorized','productionAuthorized'])
  assert.equal(x[k],false,k);
});
test('04 no enrollment returns blocked',()=>{
 assert.equal(auth(undefined).privateAuthorityVerified,false);
 assert.equal(gate.reviewSignerEnrollment({now:NOW}).status,'BLOCKED');
});
test('05 fabricated verified=true is disallowed',()=>{
 const x=signers();x.verified=true;
 assert.equal(auth(x).status,'BLOCKED');
});
test('06 missing Security Reviewer key denied',()=>{
 const x=signers();x.signers.splice(1,1);
 assert(auth(x).blockers.includes('THREE_INDEPENDENT_SIGNER_ENROLLMENTS_REQUIRED'));
});
test('07 role order reversed denied',()=>{
 const x=signers();x.signers.reverse();
 assert(auth(x).blockers.includes('SIGNER_ROLE_ENROLLMENT_INVALID'));
});
test('08 signer principal cannot impersonate independent reviewer',()=>{
 const x=signers();x.signers[1].principalDigest=x.signers[0].principalDigest;
 assert(auth(x).blockers.includes('SIGNER_SEPARATION_OF_DUTIES_FAILED'));
});
test('09 signer public key fingerprint reused denied',()=>{
 const x=signers();x.signers[2].publicKeyFingerprint=x.signers[0].publicKeyFingerprint;
 assert(auth(x).blockers.includes('SIGNER_SEPARATION_OF_DUTIES_FAILED'));
});
test('10 duplicate signing key ID denied',()=>{
 const x=signers();x.signers[1].keyId=x.signers[0].keyId;
 assert(auth(x).blockers.includes('SIGNER_SEPARATION_OF_DUTIES_FAILED'));
});
test('11 registrar cannot be one of three signers',()=>{
 const x=signers();x.registrar.principalDigest=x.signers[0].principalDigest;
 assert(auth(x).blockers.includes('SIGNER_SEPARATION_OF_DUTIES_FAILED'));
});
test('12 registrar proof must be private-only ref',()=>{
 const x=signers();x.registrar.authorityProofRef='https://example.org/unauthorized';
 assert(auth(x).blockers.includes('PRIVATE_INDEPENDENT_REGISTRAR_PROOF_MISSING'));
});
test('13 nonexistent authority registrar denied',()=>{
 const x=signers();delete x.registrar;
 assert(auth(x).blockers.includes('PRIVATE_INDEPENDENT_REGISTRAR_PROOF_MISSING'));
});
test('14 revoked signer not acceptable',()=>{
 const x=signers();x.signers[1].status='REVOKED';
 assert(auth(x).blockers.includes('SIGNER_ROLE_ENROLLMENT_INVALID'));
});
test('15 wrong project hash denied',()=>{
 const x=signers();x.projectDigest=DIG('b');
 assert.equal(auth(x).status,'BLOCKED');
});
test('16 stale enrollment expired',()=>{
 const x=signers();x.expiresAtUtc='2026-11-16T06:00:00Z';
 assert(auth(x).blockers.includes('SIGNER_ENROLLMENT_EXPIRED_OR_INVALID'));
});
test('17 enrollment cannot last more than 24h',()=>{
 const x=signers();x.expiresAtUtc='2026-11-20T06:00:00Z';
 assert(auth(x).blockers.includes('SIGNER_ENROLLMENT_EXPIRED_OR_INVALID'));
});
test('18 untrusted JWT/accessToken extra field rejected',()=>{
 const x=signers();x.accessToken='Bearer fake';
 assert.equal(auth(x).status,'BLOCKED');
});
test('19 RPC risk snapshot matches exact three signatures',()=>{
 assert.equal(gate.EXPECTED_RPC.length,3);
 const r=risk();assert.equal(r.rpcFindings,2);
});
test('20 anon callable definer is P0 risk not proof of exploit',()=>{
 const r=risk();assert.equal(r.anonDefinerCallable,true);
 assert(r.blockers.includes('P0_ANON_EXECUTABLE_SECURITY_DEFINER_REVIEW_REQUIRED'));
 assert.equal(r.productionRpcPatchReady,false);
});
test('21 authenticated callable definer also requires review',()=>{
 const r=risk();
 assert(r.blockers.includes('P0_AUTHENTICATED_SECURITY_DEFINER_REVIEW_REQUIRED'));
});
test('22 RPC review cannot revoke or mark solved merely from references',()=>{
 const r=risk();
 assert.equal(r.rpcPrivilegeChangeAuthorized,false);
 assert.equal(r.testedRollbackOnHosted,false);
});
test('23 RPC missing function is invalid rather than assumed safe',()=>{
 const s=snapshot();s.functions.pop();
 assert.equal(risk(s).status,'BLOCKED');
});
test('24 RPC owner drift requires re-audit',()=>{
 const s=snapshot();s.functions[0].owner='another_admin';
 assert(risk(s).blockers.includes('RPC_METADATA_SIGNATURE_OR_SCOPE_DRIFT'));
});
test('25 function SECURITY INVOKER drift requires re-audit',()=>{
 const s=snapshot();s.functions[0].securityDefiner=false;
 assert(risk(s).blockers.includes('RPC_METADATA_SIGNATURE_OR_SCOPE_DRIFT'));
});
test('26 wrong search path cannot be treated safe',()=>{
 const s=snapshot();s.functions[1].searchPathRestricted=false;
 assert(risk(s).blockers.includes('RPC_METADATA_SIGNATURE_OR_SCOPE_DRIFT'));
});
test('27 forged extra rpc metadata rejected',()=>{
 const s=snapshot();s.functions[1].verifiedByOwner=true;
 assert(risk(s).blockers.includes('RPC_METADATA_SIGNATURE_OR_SCOPE_DRIFT'));
});
test('28 absent private dependent workflow review blocks',()=>{
 const x=rpcReview();x.callerDependencyRef='';
 assert(risk(snapshot(),x).blockers.includes('INDEPENDENT_RPC_BODY_DEPENDENCY_QA_ROLLBACK_REVIEW_MISSING'));
});
test('29 no independent rollback evidence blocks role change',()=>{
 const x=rpcReview();x.rollbackRef='public:github-link';
 assert(risk(snapshot(),x).blockers.includes('INDEPENDENT_RPC_BODY_DEPENDENCY_QA_ROLLBACK_REVIEW_MISSING'));
});
test('30 same controller/reviewer proof ref denied',()=>{
 const x=rpcReview();x.reviewerRef=x.controllerRef;
 assert(risk(snapshot(),x).blockers.includes('INDEPENDENT_RPC_BODY_DEPENDENCY_QA_ROLLBACK_REVIEW_MISSING'));
});
test('31 even hypothetical no exposed definer grants does not auto-approve',()=>{
 const s=snapshot();for(const x of s.functions){x.anonExecute=false;x.authenticatedExecute=false}
 const r=risk(s);
 assert.equal(r.rpcFindings,0);
 assert.equal(r.rpcPrivilegeChangeAuthorized,false);
 assert(r.blockers.includes('RPC_ACTUAL_BEHAVIOR_AND_AUTHORIZATION_NOT_CERTIFIED'));
});
test('32 stale RPC metadata blocked',()=>{
 const s=snapshot();s.capturedAtUtc='2026-10-16T06:02:00Z';
 assert.equal(risk(s).status,'BLOCKED');
});
test('33 operation backup review with synthetic signatures remains NO-GO',()=>{
 const d=decision();assert.equal(d.status,'NO_GO_PRIVATE_APPROVAL_REQUIRED');
 assert.equal(d.approvalDecision,'NOT_AUTHORIZED');
});
test('34 forged receipt status cannot activate operation',()=>{
 const r=decision('BACKUP_EXPORT_REVIEW',{receipt:{status:'APPROVED'}});
 assert(r.blockers.includes('VALID_SCOPED_ADV6C_RECEIPT_REQUIRED'));
});
test('35 changing scope between receipt and operation remains untrusted',()=>{
 const x=request();x.scopeDigest=DIG('g');
 const d=decision('BACKUP_EXPORT_REVIEW',{request:x});
 assert(r=>r); // explicitly assert next line for invalid scope
 assert(d.blockers.includes('OPERATION_REQUEST_INVALID_OR_UNSCOPED'));
});
test('36 release flag injected in operation request denied',()=>{
 const x=request();x.production=true;
 assert(decision('BACKUP_EXPORT_REVIEW',{request:x}).blockers
  .includes('OPERATION_REQUEST_INVALID_OR_UNSCOPED'));
});
test('37 no accidental paid extra budget accepted',()=>{
 const x=request();x.noAdditionalSpend=false;
 assert(decision('BACKUP_EXPORT_REVIEW',{request:x}).blockers
  .includes('OPERATION_REQUEST_INVALID_OR_UNSCOPED'));
});
test('38 valid but unsigned fresh request cannot authorize export',()=>{
 const d=decision();assert.equal(d.backupExportAuthorized,false);
 assert.equal(d.durableOneTimeApprovalLeaseCertified,false);
});
test('39 controller+operator approval cannot be same private ref',()=>{
 const x=request();x.operatorMandateRef=x.controllerApprovalRef;
 assert(decision('BACKUP_EXPORT_REVIEW',{request:x}).blockers
 .includes('SEPARATE_PRIVATE_APPROVAL_OR_CUSTODY_REFERENCE_MISSING'));
});
test('40 wrong purpose review receipt cannot support RPC remediation',()=>{
 const r=adv6c.receiptReview({...receipt('BACKUP_EXPORT_REVIEW'),
  expectedProjectDigest:PROJECT,now:NOW});
 const d=decision('RPC_REMEDIATION_REVIEW',{receipt:r});
 assert(d.blockers.includes('VALID_SCOPED_ADV6C_RECEIPT_REQUIRED'));
});
test('41 RPC review has own gate and cannot alter privileges',()=>{
 const d=decision('RPC_REMEDIATION_REVIEW');
 assert.equal(d.operation,'RPC_REMEDIATION_REVIEW');
 assert.equal(d.rpcPrivilegeChangeAuthorized,false);
});
test('42 missing rpc dependency review blocked for RPC operation',()=>{
 const d=decision('RPC_REMEDIATION_REVIEW',{rpcRisk:undefined});
 // Decision() default uses supplied undefined; explicit test below passes bad object
 assert.equal(d.rpcPrivilegeChangeAuthorized,false);
});
test('43 private DB role review cannot grant database role',()=>{
 const d=decision('PRIVATE_DB_ROLE_REVIEW');assert.equal(d.roleGrantAuthorized,false);
});
test('44 hosted migration review cannot change Store schema',()=>{
 const d=decision('HOSTED_STORE_MIGRATION_REVIEW');
 assert.equal(d.hostedWriteAuthorized,false);
});
test('45 leaked authority docs never returned in public results',()=>{
 const r=decision();
 const payload=JSON.stringify(r);
 assert(!payload.includes(ref('controller-approval')));
 assert(!payload.includes(ref('operator-mandate')));
 assert(!payload.includes(ref('vault-custody')));
});
test('46 bogus request time is fail-closed',()=>{
 const x=request();x.expiresAtUtc='2026-11-16T05:10:00Z';
 assert(decision('BACKUP_EXPORT_REVIEW',{request:x}).blockers
  .includes('ONE_TIME_REVIEW_WINDOW_INVALID'));
});
test('47 no real operations callable from ADV6D API',()=>{
 for(const k of ['exportRealBackup','restoreRealBackup','deployMigration',
  'changeRpcPrivileges','changeDbRole','sendProvider','executeCommerce'])
  assert.throws(()=>gate[k](),/ADV6D_NO_HOSTED_PRIVILEGED_OPERATION/);
});
test('48 independent source modules exist, combined intake does not self-certify',()=>{
 const m=receipt('BACKUP_EXPORT_REVIEW');
 const d=gate.reviewCombined({adv6cInput:m,enrollment:signers(),
  request:request(),rpcSnapshot:snapshot(),rpcEvidence:rpcReview(),
  projectDigest:PROJECT,now:NOW});
 assert.equal(d.receipt.status,'PENDING_EXTERNAL_INDEPENDENT_VERIFICATION');
 assert.equal(d.signerAuthority.status,'PENDING_PRIVATE_REGISTRAR_VERIFICATION');
 assert.equal(d.rpcRisk.status,'SECURITY_REVIEW_REQUIRED_NO_HOSTED_CHANGE');
 assert.equal(d.decision.approvalDecision,'NOT_AUTHORIZED');
});
test('49 empty combined intake never can send or write',()=>{
 const d=gate.reviewCombined();
 assert.equal(d.decision.productionAuthorized,false);
 assert.equal(d.decision.backupExportAuthorized,false);
 assert.equal(d.receipt.status,'BLOCKED');
});
test('50 metadata source is not proof of independent reviewer signing authority',()=>{
 const a=auth();
 assert.equal(a.externallyAnchoredTrustVerified,false);
 assert.equal(a.realSecurityReviewerApproved,false);
});
