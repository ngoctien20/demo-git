'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const baseline=require('./hosted-fourrow-recovery-baseline.json');
const {
 CONTRACT,PROJECT,PARENT,BACKUP_SCOPE,PHASES,
 checkHostedCounts,reviewPrivateFourRow,reviewPreMigrationBackup,
 reviewRestoreReceipt,reviewM1Authorization,runHostedMigration,exportRealBackup
}=require('./fourrow-recovery-migration-gate.cjs');
const NOW=Date.parse('2026-11-16T10:00:00Z');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const copy=()=>structuredClone(baseline);
const tenantA='11111111-1111-4111-8111-111111111111';
const tenantB='22222222-2222-4222-8222-222222222222';
const storeA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const storeB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const merchantA='aaaaaaaa-0000-4000-8000-000000000001';
const merchantB='bbbbbbbb-0000-4000-8000-000000000002';
const reviewer='dddddddd-0000-4000-8000-000000000004';
const localRecords=()=>{
 const types={
   products:['PRODUCT_CATALOG_SOURCE','MERCHANT_STORE_ATTESTATION','INDEPENDENT_QA_REVIEW'],
   orders:['ORDER_ORIGIN_SOURCE','MERCHANT_STORE_ATTESTATION','INDEPENDENT_QA_REVIEW']
 };
 return [
  {table:'products',rowId:'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',tenantId:tenantA,storeId:storeA,merchantId:merchantA},
  {table:'orders',rowId:'aaaaaaaa-2222-4222-8222-aaaaaaaaaaaa',tenantId:tenantA,storeId:storeA,merchantId:merchantA},
  {table:'products',rowId:'bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb',tenantId:tenantB,storeId:storeB,merchantId:merchantB},
  {table:'orders',rowId:'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb',tenantId:tenantB,storeId:storeB,merchantId:merchantB}
 ].map((r,i)=>{
   const snapshotSha256=sha('synthetic snapshot '+i);
   return {
    table:r.table,rowId:r.rowId,tenantId:r.tenantId,
    candidateStoreId:r.storeId,snapshotSha256,
    sourceUpdatedAt:'2026-11-16T09:00:00Z',
    merchantActorId:r.merchantId,reviewerActorId:reviewer,
    evidence:types[r.table].map((type,j)=>({
      type,reference:'EVD-'+String(i*3+j).padStart(12,'0'),
      rowId:r.rowId,tenantId:r.tenantId,storeId:r.storeId,
      snapshotSha256,
      actorId:type==='INDEPENDENT_QA_REVIEW'?reviewer:r.merchantId,
      signedAt:'2026-11-16T09:10:00Z'
    }))
   };
 });
};
const ledger=()=>({projectRef:PROJECT,mode:'PRIVATE_OPERATOR_REVIEW_ONLY',rows:localRecords()});
const req=()=>({
 projectRef:PROJECT,parentSha:PARENT,scope:BACKUP_SCOPE,
 sourceSnapshotDigest:sha('qa snapshot'),nonceDigest:sha('qa nonce'),
 encryptionClass:'ENCRYPTED_PRIVATE_OPERATOR_VAULT',
 destinationClass:'INDEPENDENT_PRIVATE_BACKUP_STORAGE',
 retentionDays:7,costCapVnd:0,expiresAtMs:NOW+300000
});
const flags=()=>Object.fromEntries([
 'controllerIdentityVerifiedOutOfBand',
 'independentSecurityReviewerIdentityVerifiedOutOfBand',
 'backupOperatorRoleVerifiedOutOfBand',
 'privateEvidenceStorageAndClassificationApproved',
 'explicitOneTimeOwnerBackupApprovalVerified',
 'immutableScopeAndCostApprovalVerified',
 'independentAuthorizationNonceLedgerVerified'
].map(x=>[x,true]));
const restore=()=>({
 projectRef:PROJECT,scope:BACKUP_SCOPE,
 archiveSha256:sha('qa archive'),restoredArchiveSha256:sha('qa archive'),
 privateRestoreLogDigest:sha('qa log'),logicalDataAuditDigest:sha('qa logical'),
 schemaAuditDigest:sha('qa schema'),recoveredProducts:2,recoveredOrders:2,
 recoveredCustomers:0,recoveredTenants:2,
 independentIsolatedHostAttested:true,realPgRestoreExitSuccess:true,
 schemaAndGrantComparisonPassed:true,dataIntegrityAndForeignKeysPassed:true,
 authenticatedIdentityNotCopiedIntoPublicLogs:true,
 independentReviewerInspectedPrimaryRestoreLogs:true,
 restoreWasFromApprovedExactArchive:true
});
const m1=()=>({
 projectRef:PROJECT,phase:'M1_EXPAND_STORE_SCHEMA_ONLY',
 oldPublishedWorkflowsUnchanged:true,
 separateM1ControllerApproval:true,separateM1SecurityReviewerApproval:true,
 namedDbOperatorLeastPrivilege:true,
 readOnlyCallerCompatibilityAudited:true,
 rollbackDrillIndependentlyVerified:true,
 schemaMigrationDryRunVerifiedInDisposablePg17:true
});
test('01 live aggregate shape: 2 tenants each 1 product + 1 order and active owner',()=>{
 const r=checkHostedCounts(baseline);
 assert.equal(r.status,'AGGREGATE_ROW_SHAPE_VERIFIED_ONLY');
 assert.equal(r.blockers.length,0);
 assert.equal(r.verifiedRowsById,0);
 assert.equal(r.verifiedStoreOwners,0);
});
test('02 tenant Owner existence is NOT canonical Store ownership or backfill authority',()=>{
 const r=checkHostedCounts(baseline);
 assert.equal(baseline.tenant_shape.tenants_with_active_owner,2);
 assert.equal(baseline.current_schema.stores_exists,false);
 assert.equal(r.canAttributeStore,false);
 assert.equal(r.canBackfill,false);
});
test('03 current real four-row private ledger not submitted: deny',()=>{
 const x=reviewPrivateFourRow({snapshot:baseline,now:NOW});
 assert.equal(x.status,'FOUR_ROW_OWNER_PROOF_BLOCKED');
 assert.equal(x.verifiedHostedRows,0);assert.equal(x.backfillWrites,0);
});
test('04 synthetic four-row owner ledger format verified with REUSED V14.4.3 linter',()=>{
 const x=reviewPrivateFourRow({snapshot:baseline,privatePacket:ledger(),now:NOW});
 assert.equal(x.status,'PRIVATE_LEDGER_FORMAT_READY_FOR_REAL_REVIEW');
 assert.equal(x.validatedShapeCount,4);
 assert.equal(x.sourcePrivateLedgerActuallyInspected,false);
 assert.equal(x.independentMerchantAndSecuritySignaturesVerified,false);
 assert.equal(x.canBackfill,false);
});
test('05 source inventory change requires read-only re-audit before review',()=>{
 const b=copy();b.entity_counts.orders=3;
 const x=reviewPrivateFourRow({snapshot:b,privatePacket:ledger(),now:NOW});
 assert.equal(x.status,'FOUR_ROW_OWNER_PROOF_BLOCKED');
 assert(x.blockers.includes('LIVE_ORDERS_COUNT_DRIFT'));
});
test('06 Tenant shape mismatch blocks even when total four rows unchanged',()=>{
 const b=copy();b.tenant_shape.tenants_each_with_one_product_and_one_order=1;
 const x=reviewPrivateFourRow({snapshot:b,privatePacket:ledger(),now:NOW});
 assert(x.blockers.includes('LIVE_TENANT_PAIR_OR_ACTIVE_OWNER_SHAPE_DRIFT'));
});
test('07 same individual cannot serve Merchant and independent Reviewer',()=>{
 const l=ledger();l.rows[0].reviewerActorId=l.rows[0].merchantActorId;
 const x=reviewPrivateFourRow({snapshot:baseline,privatePacket:l,now:NOW});
 assert.equal(x.status,'FOUR_ROW_OWNER_PROOF_BLOCKED');
 assert(x.blockers.includes('SAME_MERCHANT_AND_REVIEWER'));
});
test('08 same Store ID reused for different Tenants is not accepted',()=>{
 const l=ledger();l.rows[2].candidateStoreId=l.rows[0].candidateStoreId;
 l.rows[2].evidence.forEach(e=>e.storeId=l.rows[2].candidateStoreId);
 const x=reviewPrivateFourRow({snapshot:baseline,privatePacket:l,now:NOW});
 assert(x.blockers.includes('STORE_MAPPED_TO_TWO_TENANTS'));
});
test('09 mismatched row identity, missing linked evidence and PII field blocked',()=>{
 const l=ledger();l.rows[0].evidence[0].rowId=l.rows[1].rowId;
 l.rows[1].phone='ineligible';
 const x=reviewPrivateFourRow({snapshot:baseline,privatePacket:l,now:NOW});
 assert(x.blockers.includes('UNBOUND_EVIDENCE_SCOPE'));
 assert(x.blockers.includes('UNEXPECTED_PRIVATE_ROW_FIELD'));
});
test('10 malformed private packet fails closed without logging raw owner IDs',()=>{
 for(const privatePacket of [null,{},[],{rows:'not array'}, {mode:'PUBLIC'}]){
  const x=reviewPrivateFourRow({snapshot:baseline,privatePacket,now:NOW});
  assert.equal(x.canBackfill,false);
  assert.equal(x.resultContainsIds,false);
 }
});
test('11 pre-M1 real backup currently DENY, independent authorization missing',()=>{
 const b=reviewPreMigrationBackup({snapshot:baseline,now:NOW});
 assert.equal(b.status,'DENY_PRE_M1_REAL_EXPORT');
 assert.equal(b.canExportBackup,false);
 assert.equal(b.backupExportPerformed,false);
});
test('12 schema-only rehearsal does not count as full data recovery backup',()=>{
 const q=req();q.scope='SCHEMA_ONLY_REHEARSAL';
 const x=reviewPreMigrationBackup({snapshot:baseline,request:q,externalApproval:flags(),now:NOW});
 assert(x.blockers.includes('WRONG_OR_MISSING_PRE_M1_FULL_DATA_RECOVERY_SCOPE'));
});
test('13 explicit scoped recovery request avoids JWT-before-M1 planning deadlock but no approval',()=>{
 const x=reviewPreMigrationBackup({
   snapshot:baseline,request:req(),externalApproval:flags(),now:NOW
 });
 assert.equal(x.status,'PRIVATE_RECOVERY_REQUEST_NEEDS_EXTERNAL_APPROVAL');
 assert.equal(x.resolvesArchitecturalOwnerJwtBeforeBackupDeadlockInPolicy,true);
 assert.equal(x.oneTimeBackupApprovalGranted,false);
 assert.equal(x.canExportBackup,false);
});
test('14 missing controller, independent reviewer or backup operator blocks',()=>{
 for(const name of ['controllerIdentityVerifiedOutOfBand',
 'independentSecurityReviewerIdentityVerifiedOutOfBand',
 'backupOperatorRoleVerifiedOutOfBand']){
  const p=flags();p[name]=false;
  const x=reviewPreMigrationBackup({snapshot:baseline,request:req(),externalApproval:p,now:NOW});
  assert.equal(x.status,'DENY_PRE_M1_REAL_EXPORT');
 }
});
test('15 approval cost cap, expiry, storage encryption or nonce cannot be omitted',()=>{
 const patches=[{costCapVnd:-1},{expiresAtMs:NOW+2000000},
   {destinationClass:'PUBLIC_GITHUB'},{nonceDigest:'unverified'}];
 for(const patch of patches){
  const x=reviewPreMigrationBackup({
   snapshot:baseline,request:{...req(),...patch},externalApproval:flags(),now:NOW
  });
  assert.equal(x.status,'DENY_PRE_M1_REAL_EXPORT');
 }
});
test('16 restored archive SHA match alone does NOT prove successful independent restore',()=>{
 const r=restore();r.independentReviewerInspectedPrimaryRestoreLogs=false;
 const x=reviewRestoreReceipt({snapshot:baseline,receipt:r});
 assert.equal(x.status,'REAL_HOSTED_RESTORE_NOT_ATTESTED');
 assert.equal(x.independentlyVerifiedRealRestoreByThisModule,false);
});
test('17 complete synthetic restore metadata is still review-only, not hosted certification',()=>{
 const x=reviewRestoreReceipt({snapshot:baseline,receipt:restore()});
 assert.equal(x.status,'CLAIMED_RECEIPT_AWAITS_INDEPENDENT_VERIFICATION');
 assert.equal(x.realBackupRecoveryCertified,false);
 assert.equal(x.canApplyMigration,false);
});
test('18 SHA mismatch or restored row-count mismatch denies',()=>{
 for(const patch of [{restoredArchiveSha256:sha('wrong archive')},{recoveredOrders:1}]){
  const x=reviewRestoreReceipt({snapshot:baseline,receipt:{...restore(),...patch}});
  assert.equal(x.status,'REAL_HOSTED_RESTORE_NOT_ATTESTED');
 }
});
test('19 no M1 migration without four-row, backup and restore review',()=>{
 const x=reviewM1Authorization({snapshot:baseline});
 assert.equal(x.status,'MIGRATION_M1_NO_GO');
 assert.equal(x.canApplyM1,false);
});
test('20 fake all-green external metadata still does not grant M1 DDL',()=>{
 const x=reviewM1Authorization({
   snapshot:baseline,
   ownerReview:reviewPrivateFourRow({snapshot:baseline,privatePacket:ledger(),now:NOW}),
   backupReview:reviewPreMigrationBackup({snapshot:baseline,request:req(),externalApproval:flags(),now:NOW}),
   restoreReview:reviewRestoreReceipt({snapshot:baseline,receipt:restore()}),
   privateChangeRequest:m1()
 });
 assert.equal(x.status,'CLAIMED_M1_REQUEST_AWAITS_REAL_APPROVAL');
 assert.equal(x.realOperatorAuthorized,false);
 assert.equal(x.hostedSchemaChanged,false);
 assert.equal(x.canApplyM1,false);
 assert.equal(x.canRunAnyMigration,false);
 assert.equal(x.canRevokeRpc,false);
});
test('21 M1 approval cannot be repurposed for M2 backfill or RLS replacement',()=>{
 const q=m1();q.phase='M2_FOUR_ROW_BACKFILL';
 const x=reviewM1Authorization({
  snapshot:baseline,
  ownerReview:reviewPrivateFourRow({snapshot:baseline,privatePacket:ledger(),now:NOW}),
  backupReview:reviewPreMigrationBackup({snapshot:baseline,request:req(),externalApproval:flags(),now:NOW}),
  restoreReview:reviewRestoreReceipt({snapshot:baseline,receipt:restore()}),
  privateChangeRequest:q
 });
 assert.equal(x.status,'MIGRATION_M1_NO_GO');
 assert.equal(x.canChangeRls,false);
});
test('22 inherited phase contract preserves separate approval boundaries',()=>{
 assert(PHASES.includes('M0_INDEPENDENT_ISOLATED_RESTORE'));
 assert(PHASES.includes('M2_FOUR_ROW_BACKFILL_SEPARATELY_APPROVED'));
 assert(PHASES.includes('M4_ATOMIC_RLS_REPLACEMENT_SEPARATELY_APPROVED'));
 assert.equal(CONTRACT,'T404_RPC6_FOUR_ROW_PRE_MIGRATION_RECOVERY_V1');
});
test('23 no in-module database migration or real backup export operation',()=>{
 assert.throws(()=>runHostedMigration(),/RPC6_HOSTED_MIGRATION_REQUIRES_SEPARATE_EXPLICIT_AUTHORIZATION/);
 assert.throws(()=>exportRealBackup(),/RPC6_REAL_BACKUP_EXPORT_REQUIRES_ONE_TIME_PRIVATE_APPROVAL/);
});
test('24 result never includes raw UUIDs, names, tokens or private row records',()=>{
 const l=ledger(),x=reviewPrivateFourRow({snapshot:baseline,privatePacket:l,now:NOW});
 const s=JSON.stringify(x);
 assert(!s.includes(l.rows[0].rowId));assert(!s.includes(l.rows[0].tenantId));
 assert(!s.includes(l.rows[0].merchantActorId));
 assert(!s.includes(l.rows[0].snapshotSha256));
});
