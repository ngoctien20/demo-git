'use strict';
/**
 * TIEN404 ADV.6D — READ-ONLY PRIVATE AUTHORITY AND REMEDIATION DECISION GATE.
 * Caller-supplied public keys, digests and attestations are NOT independently
 * anchored trust. No real identity, JWT, DB connection, backup or executor.
 * No data-leak output: never echo signer IDs, private paths or digests.
 */
const {ROLES,receiptReview}=require('./adv6c-private-evidence-intake.cjs');
const VERSION='T404_ADV6D_PRIVATE_SIGNER_AUTHORITY_V1';
const REQUEST='T404_ADV6D_OPERATION_REVIEW_REQUEST_V1';
const RPC='T404_ADV6D_RPC_RISK_SNAPSHOT_V1';
const RPC_REVIEW='T404_ADV6D_RPC_DEPENDENCY_REVIEW_V1';
const HEX=/^[a-f0-9]{64}$/;
const KEY=/^[A-Za-z0-9][A-Za-z0-9._-]{5,63}$/;
const REF=/^private:[A-Za-z0-9][A-Za-z0-9._/-]{7,95}$/;
const ISO=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
 Object.getPrototypeOf(x)===Object.prototype;
const exact=(x,keys)=>plain(x)&&Object.keys(x).length===keys.length&&
 keys.every(k=>Object.hasOwn(x,k));
const ts=s=>typeof s==='string'&&ISO.test(s)&&Number.isFinite(Date.parse(s))?
 Date.parse(s):NaN;
const blocked=(blockers,status='BLOCKED')=>Object.freeze({
 status,blockers:Object.freeze([...new Set(blockers)]),
 privateAuthorityVerified:false,realControllerApproved:false,
 realOperatorApproved:false,realSecurityReviewerApproved:false,
 independentOwnerJwtRlsCertified:false,realBackupRestoreCertified:false,
 hostedPrivateDbRoleApproved:false,hostedRpcRemediationApproved:false,
 durableOneTimeApprovalLeaseCertified:false,
 hostedWriteAuthorized:false,backupExportAuthorized:false,
 roleGrantAuthorized:false,rpcPrivilegeChangeAuthorized:false,
 providerSendAuthorized:false,productionAuthorized:false
});
const OPS=Object.freeze({
 BACKUP_EXPORT_REVIEW:'ONE_TIME_BACKUP_EXPORT_REVIEW',
 HOSTED_STORE_MIGRATION_REVIEW:'HOSTED_STORE_MIGRATION_REVIEW',
 PRIVATE_DB_ROLE_REVIEW:'PRIVATE_NONCE_DB_ROLE_REVIEW',
 RPC_REMEDIATION_REVIEW:'RPC_PRIVILEGE_CHANGE_REVIEW'
});
const EXPECTED_RPC=Object.freeze([
 Object.freeze({name:'qa_owner_pairing',args:'p_shop uuid, p_action text, p_challenge uuid'}),
 Object.freeze({name:'qa_shop_b_zalo_claim',args:'p_challenge uuid, p_code text, p_sender text, p_event text'}),
 Object.freeze({name:'save_merchant_product',args:'p_tenant uuid, p_sku text, p_name text, p_price bigint, p_active boolean, p_initial_stock integer, p_expected_updated_at timestamp with time zone'})
]);
function reviewSignerEnrollment({enrollment,expectedProjectDigest,now=Date.now()}={}){
 const bad=[];
 if(!Number.isSafeInteger(now)||now<=0)bad.push('INVALID_REVIEW_CLOCK');
 if(!exact(enrollment,['version','projectDigest','createdAtUtc','expiresAtUtc','registrar','signers'])||
   enrollment.version!==VERSION||!HEX.test(expectedProjectDigest)||
   enrollment.projectDigest!==expectedProjectDigest)
   return blocked(['TRUSTED_SIGNER_ENROLLMENT_MISSING_OR_WRONG_PROJECT']);
 const from=ts(enrollment.createdAtUtc),until=ts(enrollment.expiresAtUtc);
 if(!Number.isFinite(from)||!Number.isFinite(until)||from>now+30000||
    until<=now||until-from>86400000)bad.push('SIGNER_ENROLLMENT_EXPIRED_OR_INVALID');
 const registrar=enrollment.registrar;
 if(!exact(registrar,['principalDigest','receiptRef','authorityProofRef'])||
   !HEX.test(registrar.principalDigest)||!REF.test(registrar.receiptRef)||
   !REF.test(registrar.authorityProofRef))
   bad.push('PRIVATE_INDEPENDENT_REGISTRAR_PROOF_MISSING');
 if(!Array.isArray(enrollment.signers)||enrollment.signers.length!==3){
   bad.push('THREE_INDEPENDENT_SIGNER_ENROLLMENTS_REQUIRED');
 } else {
   const principals=new Set(),fingerprints=new Set(),keys=new Set();
   for(let i=0;i<3;i++){
     const s=enrollment.signers[i];
     if(!exact(s,['role','keyId','principalDigest','publicKeyFingerprint','enrollmentReceiptRef','scopeRef','status'])||
       s.role!==ROLES[i]||!KEY.test(s.keyId)||!HEX.test(s.principalDigest)||
       !HEX.test(s.publicKeyFingerprint)||!REF.test(s.enrollmentReceiptRef)||
       !REF.test(s.scopeRef)||s.status!=='ACTIVE'){
       bad.push('SIGNER_ROLE_ENROLLMENT_INVALID');continue;
     }
     if(principals.has(s.principalDigest)||fingerprints.has(s.publicKeyFingerprint)||
       keys.has(s.keyId)||registrar?.principalDigest===s.principalDigest)
       bad.push('SIGNER_SEPARATION_OF_DUTIES_FAILED');
     principals.add(s.principalDigest);fingerprints.add(s.publicKeyFingerprint);
     keys.add(s.keyId);
   }
 }
 // Metadata-only intake cannot authenticate the registrar or signer personally.
 return Object.freeze({...blocked(bad,bad.length?'BLOCKED':'PENDING_PRIVATE_REGISTRAR_VERIFICATION'),
    roleEnrollmentFieldsValid:bad.length===0,
    enrollmentIsAnAuthorization:false,
    externallyAnchoredTrustVerified:false});
}
function reviewRpcRisk({snapshot,review,now=Date.now()}={}){
 const problems=[];
 if(!exact(snapshot,['contract','capturedAtUtc','source','projectDigest','functions'])||
   snapshot.contract!==RPC||snapshot.source!=='HOSTED_PG_CATALOG_READ_ONLY'||
   !HEX.test(snapshot.projectDigest)||!Number.isFinite(ts(snapshot.capturedAtUtc))||
   ts(snapshot.capturedAtUtc)>now+300000||now-ts(snapshot.capturedAtUtc)>86400000||
   !Array.isArray(snapshot.functions)||snapshot.functions.length!==3)
   return Object.freeze({...blocked(['HOSTED_RPC_METADATA_UNVERIFIED_OR_STALE']),
     rpcFindings:0,anonDefinerCallable:false});
 let anonDefinerCallable=false,authenticatedDefinerCallable=false;
 for(let i=0;i<3;i++){
   const f=snapshot.functions[i],e=EXPECTED_RPC[i];
   if(!exact(f,['name','args','owner','securityDefiner','searchPathRestricted',
     'anonExecute','authenticatedExecute'])||
     f.name!==e.name||f.args!==e.args||f.owner!=='postgres'||
     f.securityDefiner!==true||f.searchPathRestricted!==true||
     typeof f.anonExecute!=='boolean'||typeof f.authenticatedExecute!=='boolean')
     return Object.freeze({...blocked(['RPC_METADATA_SIGNATURE_OR_SCOPE_DRIFT']),
       rpcFindings:0,anonDefinerCallable:false});
   anonDefinerCallable||=f.anonExecute;
   authenticatedDefinerCallable||=f.authenticatedExecute;
 }
 if(anonDefinerCallable)
   problems.push('P0_ANON_EXECUTABLE_SECURITY_DEFINER_REVIEW_REQUIRED');
 if(authenticatedDefinerCallable)
   problems.push('P0_AUTHENTICATED_SECURITY_DEFINER_REVIEW_REQUIRED');
 if(!exact(review,['contract','reviewedAtUtc','controllerRef','reviewerRef',
   'functionBodyAuditRef','callerDependencyRef','positiveNegativeQaRef',
   'rollbackRef','maintenanceWindowRef'])||review.contract!==RPC_REVIEW||
   !Number.isFinite(ts(review.reviewedAtUtc))||ts(review.reviewedAtUtc)>now+30000||
   now-ts(review.reviewedAtUtc)>7*86400000||
   !['controllerRef','reviewerRef','functionBodyAuditRef','callerDependencyRef',
     'positiveNegativeQaRef','rollbackRef','maintenanceWindowRef']
       .every(k=>REF.test(review[k]))||
   review?.controllerRef===review?.reviewerRef)
   problems.push('INDEPENDENT_RPC_BODY_DEPENDENCY_QA_ROLLBACK_REVIEW_MISSING');
 // Even if current grants are eventually limited, an API-callable
 // SECURITY DEFINER requires independent proof of intended access.
 problems.push('RPC_ACTUAL_BEHAVIOR_AND_AUTHORIZATION_NOT_CERTIFIED');
 return Object.freeze({
  ...blocked(problems,'SECURITY_REVIEW_REQUIRED_NO_HOSTED_CHANGE'),
  rpcFindings:Number(anonDefinerCallable)+Number(authenticatedDefinerCallable),
  anonDefinerCallable,authenticatedDefinerCallable,
  productionRpcPatchReady:false,
  testedRollbackOnHosted:false
 });
}
function reviewOperationDecision({request,receipt,signerAuthority,rpcRisk,
 expectedProjectDigest,now=Date.now()}={}){
 const errors=[];
 if(!exact(request,['contract','operation','requestId','projectDigest','scopeDigest',
     'createdAtUtc','expiresAtUtc','oneTime','noAdditionalSpend',
     'controllerApprovalRef','operatorMandateRef','securityReviewRef',
     'backupCoverageRef','vaultCustodyRef','rollbackPlanRef','atomicLeaseRef'])||
     request.contract!==REQUEST||!Object.hasOwn(OPS,request.operation)||
     !/^QA-[A-Z0-9]{12,48}$/.test(request.requestId)||!HEX.test(expectedProjectDigest)||
     request.projectDigest!==expectedProjectDigest||!HEX.test(request.scopeDigest)||
     request.oneTime!==true||request.noAdditionalSpend!==true)
   errors.push('OPERATION_REQUEST_INVALID_OR_UNSCOPED');
 const start=ts(request?.createdAtUtc),end=ts(request?.expiresAtUtc);
 if(!Number.isSafeInteger(now)||now<=0||!Number.isFinite(start)||
    !Number.isFinite(end)||start>now+30000||end<=now||end-start>600000)
   errors.push('ONE_TIME_REVIEW_WINDOW_INVALID');
 if(!['controllerApprovalRef','operatorMandateRef','securityReviewRef',
      'backupCoverageRef','vaultCustodyRef','rollbackPlanRef','atomicLeaseRef']
       .every(k=>REF.test(request?.[k]))||
      request?.controllerApprovalRef===request?.securityReviewRef||
      request?.controllerApprovalRef===request?.operatorMandateRef||
      request?.securityReviewRef===request?.operatorMandateRef)
   errors.push('SEPARATE_PRIVATE_APPROVAL_OR_CUSTODY_REFERENCE_MISSING');
 if(!receipt||receipt.contract!=='T404_ADV6C_PRIVATE_EVIDENCE_RECEIPT_V1'||
    receipt.status!=='PENDING_EXTERNAL_INDEPENDENT_VERIFICATION'||
    receipt.purpose!==OPS[request?.operation]||
    receipt.productionReleaseAuthorized!==false||
    receipt.privateExportAuthorized!==false||
    receipt.signerAuthorityCertified!==false)
   errors.push('VALID_SCOPED_ADV6C_RECEIPT_REQUIRED');
 if(!signerAuthority||signerAuthority.status!=='PENDING_PRIVATE_REGISTRAR_VERIFICATION'||
    signerAuthority.privateAuthorityVerified!==false||
    signerAuthority.enrollmentIsAnAuthorization!==false)
   errors.push('INDEPENDENT_SIGNER_AUTHORITY_NOT_ESTABLISHED');
 if(request?.operation==='RPC_REMEDIATION_REVIEW'&&
    (!rpcRisk||rpcRisk.status!=='SECURITY_REVIEW_REQUIRED_NO_HOSTED_CHANGE'))
   errors.push('HOSTED_RPC_REVIEW_GATE_MISSING');
 // A passed source-only review cannot validate provenance of raw inputs,
 // approve spending or create a durable single-use lease.
 errors.push('EXTERNAL_CONTROLLER_REVIEWER_OPERATOR_ATTESTATION_PENDING');
 errors.push('TRUSTED_DURABLE_APPROVAL_LEASE_AND_REAL_BACKUP_RESTORE_NOT_CERTIFIED');
 return Object.freeze({
   ...blocked(errors,'NO_GO_PRIVATE_APPROVAL_REQUIRED'),
   contract:REQUEST,operation:OPS[request?.operation]?request.operation:null,
   action:'NO_EXECUTION_READ_ONLY_REVIEW',
   approvalDecision:'NOT_AUTHORIZED',
   requiredActors:Object.freeze(['CONTROLLER','SECURITY_REVIEWER','BACKUP_OPERATOR']),
   disclosure:'STATUS_AND_BLOCKER_CODES_ONLY_NO_PRIVATE_REFERENCES',
   privateSignerIntakeEvaluated:Boolean(signerAuthority),
   rpcRemediationEvaluated:Boolean(rpcRisk)
 });
}
function reviewCombined({adv6cInput,enrollment,request,rpcSnapshot,rpcEvidence,projectDigest,
 now=Date.now()}={}){
 const privateReceipt=receiptReview({...adv6cInput,expectedProjectDigest:projectDigest,now});
 const signerAuthority=reviewSignerEnrollment({enrollment,expectedProjectDigest:projectDigest,now});
 const rpcRisk=reviewRpcRisk({snapshot:rpcSnapshot,review:rpcEvidence,now});
 return Object.freeze({
  receipt:privateReceipt,
  signerAuthority,
  rpcRisk,
  decision:reviewOperationDecision({request,receipt:privateReceipt,
   signerAuthority,rpcRisk,expectedProjectDigest:projectDigest,now})
 });
}
const disabled=()=>{throw Error('ADV6D_NO_HOSTED_PRIVILEGED_OPERATION')};
module.exports=Object.freeze({VERSION,REQUEST,RPC,RPC_REVIEW,EXPECTED_RPC,OPS,
 reviewSignerEnrollment,reviewRpcRisk,reviewOperationDecision,reviewCombined,
 exportRealBackup:disabled,restoreRealBackup:disabled,
 deployMigration:disabled,changeRpcPrivileges:disabled,
 changeDbRole:disabled,sendProvider:disabled,executeCommerce:disabled});
