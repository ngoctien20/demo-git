'use strict';
/*
 * TIEN404 RPC.7 — existing local archive receipt, metadata ONLY.
 * The input must come from a local hash + pg_restore --list workflow.
 * No data/record reads, network, keys, Auth, DB access, backups or M1.
 * A matching checksum does NOT authenticate the hosted source or restore.
 */
const CONTRACT='T404_RPC7_LOCAL_EXISTING_ARCHIVE_RECEIPT_V1';
const INPUT='T404_RPC7_LOCAL_EXISTING_ARCHIVE_RECEIPT_INPUT_V1';
const SHA=/^[0-9a-f]{64}$/;
const SCOPES=new Set(['FULL_SERVICE','APPLICATION_WITH_EXTERNAL_AUTH_STORAGE_PLAN']);
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
const keys=(x,list)=>obj(x)&&Object.keys(x).length===list.length&&list.every(k=>Object.hasOwn(x,k));
const fail=x=>{const e=new Error(x);e.code=x;throw e};
function assessLocalArchiveReceipt(p){
 const schema=['contract','observedAtUtc','archiveSha256','archiveBytes',
   'expectedSha256','expectedBytes','scope','tocResult'];
 if(!keys(p,schema)||p.contract!==INPUT||!SHA.test(p.archiveSha256)||
  !Number.isSafeInteger(p.archiveBytes)||p.archiveBytes<=0||
  !(p.expectedSha256===null||SHA.test(p.expectedSha256))||
  !(p.expectedBytes===null||(Number.isSafeInteger(p.expectedBytes)&&p.expectedBytes>0))||
  !SCOPES.has(p.scope)||
  typeof p.observedAtUtc!=='string'||
  !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(p.observedAtUtc)||
  !Number.isFinite(Date.parse(p.observedAtUtc)))
  fail('RPC7_LOCAL_RECEIPT_INPUT_DENIED');
 const t=p.tocResult;
 if(!obj(t)||t.contract!=='T404_RPC7_LOCAL_ARCHIVE_COVERAGE_V1'||
   typeof t.status!=='string'||!obj(t.coverage)||
   !obj(t.coverage.application)||!obj(t.coverage.auth)||
   !obj(t.coverage.storage)||
   typeof t.completeRestoreProven!=='boolean'||
   t.completeRestoreProven!==false)
   fail('RPC7_LOCAL_TOC_RESULT_UNTRUSTED');
 for(const [name,n] of [['application',5],['auth',3],['storage',2]]){
  const x=t.coverage[name];
  if(!Number.isSafeInteger(x.expected)||x.expected!==n||
     !Number.isSafeInteger(x.tableDataEntriesPresent)||
     x.tableDataEntriesPresent<0||x.tableDataEntriesPresent>n||
     !Number.isSafeInteger(x.schemaEntriesPresent)||
     x.schemaEntriesPresent<0||x.schemaEntriesPresent>n||
     typeof x.includesAllTableDataEntries!=='boolean'||
     x.includesAllTableDataEntries!==(x.tableDataEntriesPresent===n))
    fail('RPC7_LOCAL_TOC_COVERAGE_MALFORMED');
 }
 const shaMatches=p.expectedSha256===null?null:p.archiveSha256===p.expectedSha256;
 const sizeMatches=p.expectedBytes===null?null:p.archiveBytes===p.expectedBytes;
 const archiveMatch=shaMatches!==false&&sizeMatches!==false;
 const app=t.coverage.application.includesAllTableDataEntries;
 const fullDbToc=app&&t.coverage.auth.includesAllTableDataEntries&&
   t.coverage.storage.includesAllTableDataEntries;
 const scopeCoverage=p.scope==='FULL_SERVICE'?fullDbToc:app;
 const blockers=[];
 if(shaMatches===null)blockers.push('PREVIOUS_ARCHIVE_SHA_NOT_SUPPLIED');
 if(sizeMatches===null)blockers.push('PREVIOUS_ARCHIVE_BYTE_COUNT_NOT_SUPPLIED');
 if(shaMatches===false||sizeMatches===false)blockers.push('EXISTING_ARCHIVE_RECEIPT_MISMATCH');
 if(!app)blockers.push('APPLICATION_TABLE_DATA_TOC_INCOMPLETE');
 if(p.scope==='FULL_SERVICE'&&!fullDbToc)blockers.push('AUTH_OR_STORAGE_TABLE_DATA_TOC_INCOMPLETE');
 if(p.scope==='APPLICATION_WITH_EXTERNAL_AUTH_STORAGE_PLAN')
  blockers.push('EXTERNAL_AUTH_STORAGE_OBJECT_BYTES_RECOVERY_NOT_VERIFIED');
 blockers.push('HOSTED_SOURCE_FRESHNESS_UNVERIFIED');
 blockers.push('INDEPENDENT_RESTORE_AND_OWNER_STORE_EVIDENCE_MISSING');
 return Object.freeze({
  contract:CONTRACT,mode:'LOCAL_READ_ONLY_ARCHIVE_METADATA',
  status:!archiveMatch?'LOCAL_ARCHIVE_BASELINE_MISMATCH':
    !scopeCoverage?'LOCAL_ARCHIVE_SCOPE_INCOMPLETE':'LOCAL_ARCHIVE_TOC_REVIEW_ONLY',
  scope:p.scope,checkedAtUtc:p.observedAtUtc,
  archiveSha256:p.archiveSha256,archiveBytes:p.archiveBytes,
  referenceHashCompared:shaMatches!==null,referenceHashMatches:shaMatches,
  referenceBytesCompared:sizeMatches!==null,referenceBytesMatches:sizeMatches,
  tocClassification:t.status,
  coverage:Object.freeze({
   applicationDataEntries:t.coverage.application.tableDataEntriesPresent,
   authDataEntries:t.coverage.auth.tableDataEntriesPresent,
   storageDataEntries:t.coverage.storage.tableDataEntriesPresent,
   fullDbTocCandidate:fullDbToc,
   chosenScopeTocCandidate:scopeCoverage
  }),
  blockers:Object.freeze(blockers),
  archivePathOrRawTocIncluded:false,customerRowsInspected:false,
  archivalSourceAuthenticated:false,independentRestoreCertified:false,
  storeOwnershipVerified:false,authRecoveryCertified:false,
  storageObjectBytesCertified:false,m0Approved:false,m1Authorized:false,
  backupExportAuthorized:false,hostedWrites:0
 });
}
module.exports=Object.freeze({CONTRACT,INPUT,SCOPES,assessLocalArchiveReceipt});
