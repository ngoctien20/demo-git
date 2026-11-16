'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const b=require('../v152-rpc6/hosted-fourrow-recovery-baseline.json');
const {inspectArchiveToc}=require('./local-archive-coverage.cjs');
const {CONTRACT,PROJECT,PARENT,reviewM0Evidence,reviewM1Readiness,
 executeM1,exportHosted}=require('./private-m0-evidence-resolution.cjs');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const app=['public.tenants','public.tenant_memberships','public.products',
 'public.orders','public.customers'];
const auth=['auth.users','auth.identities','auth.sessions'];
const storage=['storage.objects','storage.buckets'];
function toc(parts){
 let i=100;
 return [
  '; PostgreSQL database dump',
  '; TOC Entries: '+String(parts.length*2),
  ...parts.flatMap(k=>{
   const [s,t]=k.split('.');
   const n=++i,m=++i;
   return [
     n+'; 1259 '+(17000+n)+' TABLE '+s+' '+t+' postgres',
     m+'; 0 '+(17000+n)+' TABLE DATA '+s+' '+t+' postgres'
   ];
  })
 ].join('\n');
}
const full=toc([...app,...auth,...storage]);
const partial=toc(app);
const baseline=()=>structuredClone(b);
const owner={status:'PRIVATE_LEDGER_FORMAT_READY_FOR_REAL_REVIEW',validatedShapeCount:4};
const provenance=()=>({
 projectRef:PROJECT,scope:'PRE_M1_ENCRYPTED_FULL_DATA_RECOVERY_ONLY',
 archiveDigest:sha('qa synthetic archive'),
 hostedReadOnlySnapshotDigest:sha('qa public read only metadata'),
 archiveOriginAuthenticated:true,archiveFreshnessAgainstCurrentHostedVerified:true
});
const recovery=()=>({
 projectRef:PROJECT,scope:'PRE_M1_ENCRYPTED_FULL_DATA_RECOVERY_ONLY',
 archiveDigest:sha('qa synthetic archive'),
 encryptedAtRest:true,independentIsolatedRestoreCompleted:true,
 restoredApplicationRowsMatchReadOnlyBaseline:true,
 authDependencyRecoveryTestPassed:true,
 storageObjectBytesHandledInSeparateApprovedPlan:true,
 rlsAndGrantsRestoreComparisonPassed:true
});
const reviewer=()=>({
 controllerIndependentlyVerified:true,securityReviewerIndependentlyVerified:true,
 backupOperatorAuthorized:true,privatePrimaryEvidenceInspected:true,
 oneTimeExportConsentRecorded:true,archiveCustodyAndRetentionCostApproved:true
});
const all=()=>({
 baseline:baseline(),archiveToc:full,archiveProvenance:provenance(),
 ownerReview:owner,recovery:recovery(),reviewer:reviewer(),
 now:Date.parse('2026-11-16T10:45:00Z')
});
const m1=()=>({
 projectRef:PROJECT,baseSha:PARENT,exactPhase:'M1_EXPAND_SCHEMA_ONLY',
 changeKind:'NO_ROW_BACKFILL_NO_POLICY_SWAP',
 currentPublishedCallerFrozen:true,
 migrationCodeReviewedAgainstActualHostedSchema:true,
 disposablePg17UpgradeRollbackRehearsed:true,
 independentControllerAndSecurityApproval:true,realOperatorAuthorization:true
});
test('01 actual RPC6 hosted baseline still 2 Tenant / 2 Product / 2 Order only',()=>{
 const x=baseline();
 assert.equal(x.tenant_shape.tenants_each_with_one_product_and_one_order,2);
 assert.equal(x.current_schema.stores_exists,false);
 assert.equal(x.current_schema.store_memberships_exists,false);
});
test('02 a local application archive lacking Auth/Storage data is PARTIAL',()=>{
 const x=inspectArchiveToc(partial);
 assert.equal(x.status,'PARTIAL_APP_ARCHIVE_NOT_FULL_SERVICE_RECOVERY');
 assert.equal(x.coverage.application.tableDataEntriesPresent,5);
 assert.equal(x.coverage.auth.tableDataEntriesPresent,0);
 assert.equal(x.completeRestoreProven,false);
});
test('03 coverage of all table-data entries is still not a verified restore',()=>{
 const x=inspectArchiveToc(full);
 assert.equal(x.status,'STRUCTURAL_TOC_COVERAGE_CANDIDATE_UNVERIFIED');
 assert.equal(x.coverage.application.includesAllTableDataEntries,true);
 assert.equal(x.coverage.auth.includesAllTableDataEntries,true);
 assert.equal(x.coverage.storage.includesAllTableDataEntries,true);
 assert.equal(x.realRestoreIsolationVerified,false);
 assert.equal(x.completeRestoreProven,false);
});
test('04 schema-only archive cannot support an application data recovery claim',()=>{
 const source=toc(app).split('\n').filter(x=>!x.includes('TABLE DATA')).join('\n');
 const x=inspectArchiveToc(source);
 assert.equal(x.status,'APP_RECOVERY_COVERAGE_INCOMPLETE');
 assert.equal(x.coverage.application.tableDataEntriesPresent,0);
});
test('05 unknown/invalid/empty TOC fails without raw-data output',()=>{
 for(const t of ['',null,'random password auth.users', 'x'.repeat(5000001)]){
  const x=inspectArchiveToc(t);
  assert(x.status==='INVALID_OR_EMPTY_TOC'||x.status==='NO_PG_RESTORE_TOC_ENTRIES');
 }
});
test('06 table names must match exact schema/table, not substring',()=>{
 const wrong=toc(['public.users_extra','notauth.users','public.tenants_fake']);
 const x=inspectArchiveToc(wrong);
 assert.equal(x.coverage.auth.tableDataEntriesPresent,0);
 assert.equal(x.coverage.application.tableDataEntriesPresent,0);
});
test('07 no archive TOC supplied in M0 means DENY',()=>{
 const x=reviewM0Evidence({baseline:baseline()});
 assert.equal(x.status,'M0_EVIDENCE_BLOCKED');
 assert(x.blockers.includes('APPLICATION_TABLE_DATA_MISSING_FROM_EXISTING_ARCHIVE'));
 assert.equal(x.backupExportAuthorized,false);
});
test('08 partial existing local H11R-style archive cannot be treated as full M0 recovery',()=>{
 const x=reviewM0Evidence({...all(),archiveToc:partial});
 assert.equal(x.status,'M0_EVIDENCE_BLOCKED');
 assert(x.blockers.includes('AUTH_TABLE_DATA_NOT_IN_EXISTING_ARCHIVE'));
 assert(x.blockers.includes('OLD_ARCHIVE_IS_PARTIAL_OR_UNPARSEABLE'));
});
test('09 archive SHA and source snapshot binding are separate requirements',()=>{
 const q=all();q.archiveProvenance.sourceSnapshotDigest='not-a-digest';
 const x=reviewM0Evidence(q);
 assert(x.blockers.includes('EXACT_HOSTED_ARCHIVE_OR_SOURCE_SNAPSHOT_PROVENANCE_MISSING'));
});
test('10 archive source and freshness must be actually reviewed out of band',()=>{
 const q=all();q.archiveProvenance.archiveFreshnessAgainstCurrentHostedVerified=false;
 assert(reviewM0Evidence(q).blockers.includes(
  'ARCHIVE_SOURCE_AND_FRESHNESS_NOT_INDEPENDENTLY_PROVEN'));
});
test('11 differing restore/source archive digest cannot certify recovery',()=>{
 const q=all();q.recovery.archiveDigest=sha('different archive');
 assert(reviewM0Evidence(q).blockers.includes('RECOVERY_ARCHIVE_NOT_BOUND_TO_SOURCE'));
});
test('12 external Owner four-row ledger must not be substituted with tenant counts',()=>{
 const q=all();delete q.ownerReview;
 assert(reviewM0Evidence(q).blockers.includes('FOUR_ROW_PRIVATE_OWNER_LEDGER_NOT_READY'));
});
test('13 independent isolated restore and Auth+Storage dependencies must be checked',()=>{
 for(const key of ['independentIsolatedRestoreCompleted',
 'authDependencyRecoveryTestPassed','storageObjectBytesHandledInSeparateApprovedPlan',
 'rlsAndGrantsRestoreComparisonPassed']){
  const q=all();q.recovery[key]=false;
  assert(reviewM0Evidence(q).blockers.includes(
   'REAL_INDEPENDENT_FULL_DEPENDENCY_RESTORE_UNVERIFIED'),key);
 }
});
test('14 Controller, Security Reviewer and Backup Operator remain independent',()=>{
 for(const key of ['controllerIndependentlyVerified',
   'securityReviewerIndependentlyVerified','backupOperatorAuthorized']){
  const q=all();q.reviewer[key]=false;
  assert(reviewM0Evidence(q).blockers.includes(
   'REAL_OPERATOR_REVIEW_AND_ONE_TIME_BACKUP_AUTHORITY_MISSING'),key);
 }
});
test('15 forged all-green evidence remains unverified and cannot approve M0',()=>{
 const x=reviewM0Evidence(all());
 assert.equal(x.status,'CLAIMED_M0_READY_FOR_EXTERNAL_ATTESTATION');
 for(const k of ['approvalGranted','backupExportAuthorized','restoreAuthorized',
  'm1MigrationAuthorized','m2RowBackfillAuthorized','m4RlsChangeAuthorized',
  'independentlyInspectedBackup','actualFullRecoveryCertified',
  'realMerchantOwnerVerified'])assert.equal(x[k],false,k);
 assert.equal(x.recordsWritten,0);
});
test('16 M1 blocked while real M0 source evidence not complete',()=>{
 const x=reviewM1Readiness({baseline:baseline()});
 assert.equal(x.status,'M1_MIGRATION_NO_GO');
 assert.equal(x.canApplyM1,false);
});
test('17 valid synthetic M0 review metadata still cannot approve M1',()=>{
 const q=all(),m0=reviewM0Evidence(q);
 const r=reviewM1Readiness({baseline:q.baseline,m0Review:m0,
  ownershipPacket:owner,m1Packet:m1()});
 assert.equal(r.status,'M1_REVIEW_PACKET_PENDING_REAL_OPERATOR_APPROVAL');
 assert.equal(r.canApplyM1,false);
 assert.equal(r.userOperationSpecificConsentVerified,false);
});
test('18 M1 scope cannot silently include M2 backfill or M4 policy swaps',()=>{
 for(const patch of [
  {exactPhase:'M2_BACKFILL'},
  {changeKind:'M4_DROP_RLS'},
  {baseSha:'forged'},
  {projectRef:'different-project'}
 ]){
  const q=all();
  const x=reviewM1Readiness({baseline:q.baseline,m0Review:reviewM0Evidence(q),
   ownershipPacket:owner,m1Packet:{...m1(),...patch}});
  assert.equal(x.status,'M1_MIGRATION_NO_GO');
  assert.equal(x.canChangeRls,false);
 }
});
test('19 M1 current Published caller freeze and rollback rehearsal required',()=>{
 for(const k of ['currentPublishedCallerFrozen',
 'migrationCodeReviewedAgainstActualHostedSchema',
 'disposablePg17UpgradeRollbackRehearsed']){
  const q=all(),x=reviewM1Readiness({baseline:q.baseline,m0Review:reviewM0Evidence(q),
   ownershipPacket:owner,m1Packet:{...m1(),[k]:false}});
  assert.equal(x.status,'M1_MIGRATION_NO_GO');
 }
});
test('20 schema drift always blocks M0 and M1',()=>{
 const q=all();q.baseline.entity_counts.products=3;
 const x=reviewM0Evidence(q);
 assert.equal(x.status,'M0_EVIDENCE_BLOCKED');
 assert(x.blockers.includes('REAL_HOSTED_COUNT_OR_TENANT_SHAPE_DRIFT'));
 assert.equal(reviewM1Readiness({baseline:q.baseline}).status,'M1_MIGRATION_NO_GO');
});
test('21 raw private TOC and real credential content never returned in QA decisions',()=>{
 const q=all(),r=reviewM0Evidence(q),s=JSON.stringify(r);
 assert(!s.includes('TABLE DATA'));
 assert(!s.includes(q.archiveProvenance.archiveDigest));
 assert(!s.includes(q.archiveProvenance.hostedReadOnlySnapshotDigest));
});
test('22 no real hosted backup or M1 migration executor',()=>{
 assert.throws(()=>exportHosted(),/RPC7_REAL_EXPORT_NOT_AUTHORIZED/);
 assert.throws(()=>executeM1(),/RPC7_M1_HOSTED_EXECUTION_NOT_AUTHORIZED/);
 assert.equal(CONTRACT,'T404_RPC7_PRIVATE_M0_REAL_EVIDENCE_RESOLUTION_V1');
});
