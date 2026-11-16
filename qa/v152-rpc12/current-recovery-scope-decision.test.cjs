'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {CONTRACT,HISTORICAL,CLAIMS,reviewRecoveryScope,
 executeCurrentRecovery}=require('./current-recovery-scope-decision.cjs');
const baseline=()=>({
 projectRef:'ifxlvrhyjhbzbrkdsida',capturedDateJst:'2026-11-17',
 tenants:2,products:2,orders:2,customers:0,
 authUsers:3,storageBuckets:0,storageObjects:0
});
const h11r=()=>({
 status:HISTORICAL,localArchiveShaMatch:true,
 localArchiveBytesMatch:true,applicationEntries:5,
 authEntries:0,storageEntries:0,operatorReported:true
});
const packet=(scope='UNDECIDED')=>({
 scope,currentSnapshot:baseline(),h11rReceipt:h11r(),
 claimedEvidence:Object.fromEntries(CLAIMS.map(x=>[x,true]))
});
test('01 user-accepted historical archive remains accepted only for partial local QA',()=>{
 const r=reviewRecoveryScope(packet());
 assert.equal(r.historicalH11rAcceptedWithLimitations,true);
 assert.equal(r.historicalH11rAcceptsCurrentHostedRestore,false);
 assert.equal(r.m0Approved,false);assert.equal(r.m1Approved,false);
});
test('02 owner has not yet chosen migration current-recovery scope',()=>{
 const r=reviewRecoveryScope(packet());
 assert.equal(r.status,'OWNER_RECOVERY_SCOPE_DECISION_PENDING');
 assert(r.blockers.includes('MIGRATION_RECOVERY_SCOPE_NOT_YET_CHOSEN_BY_OWNER'));
});
test('03 full-service selection fails because historical Auth is absent',()=>{
 const r=reviewRecoveryScope(packet('FULL_SERVICE'));
 assert.equal(r.status,'CURRENT_M0_RECOVERY_NO_GO');
 assert(r.historicalScopeLimitations.includes('HISTORICAL_ARCHIVE_DOES_NOT_COVER_CURRENT_AUTH'));
});
test('04 app-only scope still demands external Auth/Storage and independent restore',()=>{
 const r=reviewRecoveryScope(packet('APPLICATION_WITH_EXTERNAL_AUTH_STORAGE_PLAN'));
 assert.equal(r.status,'CURRENT_M0_RECOVERY_NO_GO');
 assert(r.historicalScopeLimitations.includes('EXTERNAL_AUTH_STORAGE_RECOVERY_PLAN_REQUIRES_SEPARATE_REAL_PROOF'));
});
test('05 3 current Auth users cannot be silently treated as backed up',()=>{
 const p=packet();p.currentSnapshot.authUsers=0;
 const r=reviewRecoveryScope(p);
 assert(r.blockers.includes('CURRENT_AGGREGATE_SNAPSHOT_NOT_GROUNDED_OR_CHANGED'));
});
test('06 if current Storage object metadata changes, require a new audit',()=>{
 const p=packet();p.currentSnapshot.storageObjects=1;
 assert(reviewRecoveryScope(p).blockers.includes('CURRENT_AGGREGATE_SNAPSHOT_NOT_GROUNDED_OR_CHANGED'));
});
test('07 local hash reference mismatch cannot preserve old acceptance as proven',()=>{
 const p=packet();p.h11rReceipt.localArchiveShaMatch=false;
 assert(reviewRecoveryScope(p).blockers.includes('H11R_LIMITED_ACCEPTANCE_NOT_RECONCILED'));
});
test('08 fake owner claims alone never grant current recovery',()=>{
 const p=packet();p.scope='FULL_SERVICE';p.h11rReceipt.authEntries=3;
 const r=reviewRecoveryScope(p);
 assert.equal(r.m0Approved,false);assert.equal(r.canApplyM1,false);
 assert.equal(r.actualCurrentIsolatedRestoreVerified,false);
});
test('09 every missing independent evidence class must block',()=>{
 for(const key of CLAIMS){
  const p=packet('FULL_SERVICE');
  p.claimedEvidence[key]=false;
  assert(reviewRecoveryScope(p).blockers.includes('INDEPENDENT_PRIMARY_'+key.toUpperCase()+'_UNVERIFIED'),key);
 }
});
test('10 malformed or leaked unexpected fields cannot change verified counts',()=>{
 const p=packet();p.currentSnapshot.password='DO_NOT_PRINT';
 const r=reviewRecoveryScope(p);
 assert(r.blockers.includes('CURRENT_AGGREGATE_SNAPSHOT_NOT_GROUNDED_OR_CHANGED'));
 assert(!JSON.stringify(r).includes('DO_NOT_PRINT'));
});
test('11 unknown recovery scope fail closed',()=>{
 for(const scope of ['PRODUCTION_IMMEDIATE','FULL_AND_APPROVED',null,{}]){
  const r=reviewRecoveryScope(packet(scope));
  assert.equal(r.scope,'INVALID');
  assert.equal(r.canApplyM1,false);
 }
});
test('12 fake green packet never grants backup/export/restore/SQL',()=>{
 const r=reviewRecoveryScope(packet('APPLICATION_WITH_EXTERNAL_AUTH_STORAGE_PLAN'));
 for(const k of ['canExportBackup','canRestore','canApplyM1','canBackfill',
   'canAlterRls','canApplyM3','canRevokeLegacyRpc','canPublish']){
  assert.equal(r[k],false,k);
 }
});
test('13 even asserted auth plan still cannot certify object bytes',()=>{
 const r=reviewRecoveryScope(packet('FULL_SERVICE'));
 assert.equal(r.authRecoveryCertified,false);
 assert.equal(r.storageObjectBytesCertified,false);
 assert.equal(r.operatorAndReviewerAuthorityVerified,false);
});
test('14 no real export/restore entrypoint',()=>{
 assert.equal(CONTRACT,'T404_RPC12_CURRENT_RECOVERY_SCOPE_DECISION_V1');
 assert.throws(()=>executeCurrentRecovery(),/SEPARATE_APPROVAL/);
});

test('15 claimed new recovery point may be structurally reviewed, old H11R is still not independently restored',()=>{
 const r=reviewRecoveryScope(packet('FULL_SERVICE'));
 assert.equal(r.status,'CLAIMED_CURRENT_RECOVERY_PACKET_REQUIRES_EXTERNAL_VERIFICATION');
 assert(r.historicalScopeLimitations.includes('HISTORICAL_ARCHIVE_DOES_NOT_COVER_CURRENT_AUTH'));
 assert.equal(r.m0Approved,false);
 assert.equal(r.canApplyM1,false);
});
