'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {CONTRACT,INPUT,assessLocalArchiveReceipt}=
 require('./local-m0-archive-receipt.cjs');
const h=s=>crypto.createHash('sha256').update(s).digest('hex');
const cov=(expected,n)=>({
 expected,schemaEntriesPresent:n,tableDataEntriesPresent:n,
 includesAllTableDataEntries:n===expected
});
const toc=(a=5,auth=0,storage=0)=>({
 contract:'T404_RPC7_LOCAL_ARCHIVE_COVERAGE_V1',
 status:a<5?'APP_RECOVERY_COVERAGE_INCOMPLETE':
   auth<3||storage<2?'PARTIAL_APP_ARCHIVE_NOT_FULL_SERVICE_RECOVERY':
   'STRUCTURAL_TOC_COVERAGE_CANDIDATE_UNVERIFIED',
 coverage:{
  application:cov(5,a),auth:cov(3,auth),storage:cov(2,storage)
 },completeRestoreProven:false
});
const packet=()=>({
 contract:INPUT,observedAtUtc:'2026-11-16T11:30:00.000Z',
 archiveSha256:h('synthetic local bytes'),archiveBytes:28,
 expectedSha256:h('synthetic local bytes'),expectedBytes:28,
 scope:'APPLICATION_WITH_EXTERNAL_AUTH_STORAGE_PLAN',tocResult:toc()
});
test('01 local matching prior hash/size is NOT approved M0 or M1',()=>{
 const r=assessLocalArchiveReceipt(packet());
 assert.equal(r.contract,CONTRACT);
 assert.equal(r.status,'LOCAL_ARCHIVE_TOC_REVIEW_ONLY');
 assert.equal(r.referenceHashMatches,true);
 assert.equal(r.referenceBytesMatches,true);
 assert.equal(r.m0Approved,false);assert.equal(r.m1Authorized,false);
 assert.equal(r.independentRestoreCertified,false);
});
test('02 partial app archive explicitly cannot cover full-service scope',()=>{
 const p=packet();p.scope='FULL_SERVICE';
 const r=assessLocalArchiveReceipt(p);
 assert.equal(r.status,'LOCAL_ARCHIVE_SCOPE_INCOMPLETE');
 assert.equal(r.coverage.fullDbTocCandidate,false);
 assert(r.blockers.includes('AUTH_OR_STORAGE_TABLE_DATA_TOC_INCOMPLETE'));
});
test('03 full TOC does not prove actual restored data or object bytes',()=>{
 const p=packet();p.scope='FULL_SERVICE';p.tocResult=toc(5,3,2);
 const r=assessLocalArchiveReceipt(p);
 assert.equal(r.status,'LOCAL_ARCHIVE_TOC_REVIEW_ONLY');
 assert.equal(r.coverage.fullDbTocCandidate,true);
 assert.equal(r.independentRestoreCertified,false);
 assert.equal(r.storageObjectBytesCertified,false);
});
test('04 baseline hash mismatch is a hard local mismatch',()=>{
 const p=packet();p.expectedSha256=h('other archive');
 const r=assessLocalArchiveReceipt(p);
 assert.equal(r.status,'LOCAL_ARCHIVE_BASELINE_MISMATCH');
 assert.equal(r.referenceHashMatches,false);
 assert.equal(r.backupExportAuthorized,false);
});
test('05 byte mismatch is blocked regardless of matching SHA',()=>{
 const p=packet();p.expectedBytes=999;
 const r=assessLocalArchiveReceipt(p);
 assert.equal(r.status,'LOCAL_ARCHIVE_BASELINE_MISMATCH');
 assert.equal(r.referenceBytesMatches,false);
});
test('06 missing previous hash or size cannot imply old receipt verification',()=>{
 const p=packet();p.expectedSha256=null;p.expectedBytes=null;
 const r=assessLocalArchiveReceipt(p);
 assert.equal(r.referenceHashCompared,false);
 assert.equal(r.referenceBytesCompared,false);
 assert(r.blockers.includes('PREVIOUS_ARCHIVE_SHA_NOT_SUPPLIED'));
});
test('07 reject unexpected key including JWT, PII, raw TOC or archive path',()=>{
 for(const key of ['jwt','phone','rawToc','path']){
  const p=packet();p[key]='private-data';
  assert.throws(()=>assessLocalArchiveReceipt(p),/RPC7_LOCAL_RECEIPT_INPUT_DENIED/);
 }
});
test('08 deny count fraud or inconsistent includesAllTableDataEntries',()=>{
 const p=packet();p.tocResult.coverage.auth.tableDataEntriesPresent=3;
 assert.throws(()=>assessLocalArchiveReceipt(p),/RPC7_LOCAL_TOC_COVERAGE_MALFORMED/);
});
test('09 reject fake completeRestoreProven=true',()=>{
 const p=packet();p.tocResult.completeRestoreProven=true;
 assert.throws(()=>assessLocalArchiveReceipt(p),/RPC7_LOCAL_TOC_RESULT_UNTRUSTED/);
});
test('10 schema-only source does not demonstrate application recovery',()=>{
 const p=packet();p.tocResult=toc(0,0,0);
 const r=assessLocalArchiveReceipt(p);
 assert.equal(r.status,'LOCAL_ARCHIVE_SCOPE_INCOMPLETE');
 assert(r.blockers.includes('APPLICATION_TABLE_DATA_TOC_INCOMPLETE'));
});
test('11 wrong or invalid recovery scope denied',()=>{
 for(const scope of ['AUTO_MIGRATE','SCHEMA_ONLY',null,'']){
  const p=packet();p.scope=scope;
  assert.throws(()=>assessLocalArchiveReceipt(p),/RPC7_LOCAL_RECEIPT_INPUT_DENIED/);
 }
});
test('12 malformed current hash/size/UTC timestamp rejected',()=>{
 for(const patch of [
  {archiveSha256:'NOT_HASH'}, {archiveBytes:0},
  {observedAtUtc:'2026-11-16 local'}, {expectedBytes:-1}
 ]){
  const p={...packet(),...patch};
  assert.throws(()=>assessLocalArchiveReceipt(p),/RPC7_LOCAL_RECEIPT_INPUT_DENIED/);
 }
});
test('13 output contains no raw archive path, tokens or user identities',()=>{
 const p=packet(),r=JSON.stringify(assessLocalArchiveReceipt(p));
 assert(!r.includes('E:\\pgadmin'));
 assert.equal(JSON.parse(r).archivePathOrRawTocIncluded,false);
 assert.equal(JSON.parse(r).customerRowsInspected,false);
});
test('14 reusing local archive cannot signal real hosted owner approval',()=>{
 const r=assessLocalArchiveReceipt(packet());
 assert.equal(r.archivalSourceAuthenticated,false);
 assert.equal(r.storeOwnershipVerified,false);
 assert.equal(r.hostedWrites,0);
 assert.equal(r.m1Authorized,false);
});
