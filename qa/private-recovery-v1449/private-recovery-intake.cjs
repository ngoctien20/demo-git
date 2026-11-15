'use strict';
/**
 * TIEN404 V14.4.9 -- PRIVATE OPERATOR EVIDENCE PREFLIGHT (OFFLINE ONLY).
 * No network, filesystem, SQL, tokens, crypto key handling, restore or write.
 * Accepts UNTRUSTED local metadata -- it NEVER verifies files, identities,
 * actual signatures, Store attribution, or data completeness.
 * NEVER send real intake inputs to CI, GitHub, chat, telemetry or logs.
 */
const PROJECT='ifxlvrhyjhbzbrkdsida';
const HEX64=/^[0-9a-f]{64}$/i;
const SLOT_TABLE=Object.freeze({P01:'products',P02:'products',O01:'orders',O02:'orders'});
const CLASSES=Object.freeze({
  products:['PRODUCT_CATALOG_SOURCE','MERCHANT_STORE_ATTESTATION','INDEPENDENT_QA_REVIEW'],
  orders:['ORDER_ORIGIN_SOURCE','MERCHANT_STORE_ATTESTATION','INDEPENDENT_QA_REVIEW']
});
const PARTS=Object.freeze(['roles','schema','application_data','auth_data']);
const REASONS=Object.freeze({
  WRONG_SCOPE:'PRIVATE_SCOPE_NOT_PROVEN',
  ARCHIVE_SET:'MISSING_OR_EXTRA_BACKUP_COMPONENT',
  FILE_DIGEST:'ARCHIVE_DIGEST_INVALID_OR_DUPLICATE',
  SNAPSHOT:'BACKUP_SNAPSHOT_NOT_CONSISTENT',
  PROTECTION:'PRIVATE_ENCRYPTED_STORAGE_NOT_ATTESTED',
  RESTORE:'FULL_AUTH_APP_RESTORE_NOT_INDEPENDENTLY_VERIFIED',
  ROW_SLOTS:'FOUR_EXACT_ROW_SLOTS_REQUIRED',
  RECORD:'ROW_SOURCE_SNAPSHOT_OR_DIGEST_INVALID',
  SOURCE:'PRIMARY_SOURCE_EVIDENCE_MISSING',
  ATTEST:'MERCHANT_ATTESTATION_MISSING',
  REVIEW:'INDEPENDENT_REVIEW_MISSING',
  BOUND:'EVIDENCE_NOT_BOUND_TO_ROW_AND_STORE',
  AMBIGUITY:'STORE_OWNERSHIP_AMBIGUOUS',
  DRIFT:'HOSTED_SOURCE_SNAPSHOT_DRIFT',
  OWNER_CHECK:'REAL_MERCHANT_AUTHENTICITY_NOT_CHECKED',
  REVIEWER_CHECK:'REAL_REVIEWER_AUTHENTICITY_NOT_CHECKED'
});
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const sha=x=>typeof x==='string'&&HEX64.test(x);
function result(kind,codes,extra={}){
 const errors=[...new Set(codes)].sort();
 return Object.freeze({kind,status:errors.length?'BLOCKED':'READY_FOR_PRIVATE_MANUAL_REVIEW_ONLY',
  issueCodes:Object.freeze(errors),...extra,
  actualSourceRecordsVerified:0,actualStoreOwnersVerified:0,
  authDataRestored:false,realSignatureVerified:false,
  hostedDataExported:false,customerDataExposed:false, 
  canDeploy:false,canMigrate:false,canBackfill:false,canAlterAcl:false,
  canExecuteRpc:false,canSendProviderMessage:false});
}
function inspectArchiveManifest(input){
 const x=obj(input)?input:{},errors=[];
 if(x.projectRef!==PROJECT||x.mode!=='PRIVATE_OPERATOR_METADATA_ONLY')errors.push(REASONS.WRONG_SCOPE);
 const parts=Array.isArray(x.components)?x.components:[];
 if(parts.length!==4||PARTS.some(kind=>parts.filter(y=>y?.kind===kind).length!==1)||
    parts.some(y=>!PARTS.includes(y?.kind)))errors.push(REASONS.ARCHIVE_SET);
 const hashes=new Set();
 for(const part of parts){
  if(!obj(part)||!sha(part.sha256)||!Number.isSafeInteger(part.bytes)||
     part.bytes<=0||hashes.has(part.sha256)||part.dumpSucceeded!==true)
    errors.push(REASONS.FILE_DIGEST);
  if(obj(part)&&sha(part.sha256))hashes.add(part.sha256);
 }
 if(typeof x.snapshotTag!=='string'||!/^QA-SNAPSHOT-[A-Za-z0-9_-]{8,48}$/.test(x.snapshotTag)||
    x.consistentCaptureAttested!==true||
    parts.some(p=>p?.snapshotTag!==x.snapshotTag))
    errors.push(REASONS.SNAPSHOT);
 if(x.encryptedPrivateStorage!==true||x.restrictedOperatorAccess!==true||
    x.retentionApproved!==true||x.noPublicUploadAttested!==true)
    errors.push(REASONS.PROTECTION);
 if(x.independentFullRestoreSucceeded!==true||
    x.authFkNineValidated!==true||
    x.fourApplicationRowsRecovered!==true||
    x.roleAndPolicyParityVerified!==true||
    x.independentRollbackSucceeded!==true)
    errors.push(REASONS.RESTORE);
 return result('PRIVATE_ARCHIVE_METADATA_LINT',errors,{
  componentCount:parts.length,expectedComponentCount:4,
  expectedAuthFks:9,explicitReleaseAuthorization:false,
  note:'File hashes and boolean claims are not evidence of actual backup integrity or independent restore'
 });
}
function inspectMerchantIntake(input){
 const x=obj(input)?input:{},errors=[];
 if(x.projectRef!==PROJECT||x.mode!=='PRIVATE_OPERATOR_METADATA_ONLY')errors.push(REASONS.WRONG_SCOPE);
 const rows=Array.isArray(x.rows)?x.rows:[];
 if(rows.length!==4||Object.keys(SLOT_TABLE).some(slot=>rows.filter(y=>y?.slot===slot).length!==1)||
     rows.some(y=>!SLOT_TABLE[y?.slot]))errors.push(REASONS.ROW_SLOTS);
 const seenDigests=new Set();
 const independentActors=new Set();
 for(const row of rows){
  if(!obj(row)||row.table!==SLOT_TABLE[row.slot]||
      !sha(row.rowVersionDigest)||!sha(row.sourceRecordDigest)||
      row.rowVersionDigest===row.sourceRecordDigest||
      seenDigests.has(row.sourceRecordDigest)||
      !['QA_GROUP_1','QA_GROUP_2'].includes(row.anonymousTenantGroup))
    errors.push(REASONS.RECORD);
  if(obj(row)&&sha(row.sourceRecordDigest))seenDigests.add(row.sourceRecordDigest);
  if(row?.ambiguousStoreOwnership!==false)errors.push(REASONS.AMBIGUITY);
  if(row?.sourceStillMatchesHosted!==true)errors.push(REASONS.DRIFT);
  if(!Array.isArray(row?.evidence)||row.evidence.length!==3||
     !CLASSES[row?.table]?.every(type=>row.evidence.filter(e=>e?.type===type).length===1))
    errors.push(REASONS.SOURCE);
  if(row?.merchantActorRef===row?.reviewerActorRef||
     typeof row?.merchantActorRef!=='string'||typeof row?.reviewerActorRef!=='string'||
     !/^ACT-[A-Za-z0-9_-]{8,48}$/.test(row?.merchantActorRef)||
     !/^ACT-[A-Za-z0-9_-]{8,48}$/.test(row?.reviewerActorRef))
    errors.push(REASONS.REVIEW);
  if(row?.merchantIdentityPrivatelyChecked!==true)errors.push(REASONS.OWNER_CHECK);
  if(row?.reviewerIdentityPrivatelyChecked!==true)errors.push(REASONS.REVIEWER_CHECK);
  if(row?.merchantSignaturePrivatelyChecked!==true)errors.push(REASONS.ATTEST);
  if(row?.reviewerSignaturePrivatelyChecked!==true)errors.push(REASONS.REVIEW);
  for(const e of Array.isArray(row?.evidence)?row.evidence:[]){
    if(!obj(e)||!sha(e.claimedEvidenceDigest)||e.boundToExactRecordAndStore!==true||
      e.reviewedInPrivateRepository!==true)
      errors.push(REASONS.BOUND);
  }
 }
 return result('PRIVATE_FOUR_ROW_INTAKE_LINT',errors,{
    expectedRows:4,submittedRows:rows.length,
    // do not emit row, user, tenant, Store ID, hash or evidence values
    declaredSlots:Object.freeze(Object.keys(SLOT_TABLE)),
    note:'Only private human reviewers can actually verify merchant signatures, row-to-Store ownership and source freshness'
 });
}
function releaseBoundary({archive,intake,approvedHostedMigration=false,actualJwtAcceptance=false}={}){
 const why=[];
 if(archive?.status!=='READY_FOR_PRIVATE_MANUAL_REVIEW_ONLY')why.push(REASONS.RESTORE);
 if(intake?.status!=='READY_FOR_PRIVATE_MANUAL_REVIEW_ONLY')why.push(REASONS.REVIEW);
 if(approvedHostedMigration!==true||actualJwtAcceptance!==true)why.push(REASONS.WRONG_SCOPE);
 const output=result('HOSTED_RELEASE_FAIL_CLOSED',why,{independentReleaseReviewRequired:true});
 return Object.freeze({...output,status:'BLOCKED',canMigrate:false,canBackfill:false});
}
module.exports=Object.freeze({PROJECT,PARTS,SLOT_TABLE,CLASSES,REASONS,
 inspectArchiveManifest,inspectMerchantIntake,releaseBoundary});
