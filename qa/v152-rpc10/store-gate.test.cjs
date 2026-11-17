'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {inspect,CORE,PRIVATE,FKS,PROJECT}=require('./store-gate.cjs');
const base=require('./hosted-baseline-sanitized.json');
const cp=x=>JSON.parse(JSON.stringify(x));
const green=()=>{
 const x=cp(base);x.canonicalStoresPresent=true;x.storeMembershipsPresent=true;
 for(const n of CORE)x.tables[n]={rlsEnabled:true,forceRls:true,tenantId:true,storeId:true,
  legacyTenantPermissiveSelect:false,storeScopedReadPolicy:true,writerCompatibilityReviewed:true};
 for(const n of FKS)x.constraints[n]=true;
 x.constraints.skuUniquenessPerStore=true;x.constraints.legacyTenantSkuUniqueRemoved=true;
 for(const n of PRIVATE)x.scopeClassification[n]={decision:'STORE_SCOPED_REVIEWED',independentReview:true};
 for(const s of x.fourRowOwnership){
  s.merchantPrimarySourceVerified=true;s.canonicalStoreProofVerified=true;s.independentReviewerVerified=true;
 }
 for(const n of ['independentRestorationVerified','authAndStorageRecoveryScoped',
  'merchantOwnerSignaturesVerifiedOutOfBand','operatorAndReviewerSeparated',
  'maintenanceWindowApproved','callerInventoryApproved','realJwtRlsTestPassed',
  'noWriteNoSendPostcheckPassed','rollbackDrillApproved'])x.authority[n]=true;
 return x;
};
test('current hosted snapshot is NO-GO',()=>{
 const r=inspect(base);assert.equal(r.status,'HOSTED_NO_GO');
 assert.equal(r.canMigrate,false);assert.ok(r.blockers.includes('CANONICAL_STORE_SCHEMA_MISSING'));
});
test('expected project and exact baseline drift',()=>{
 const a=green();a.projectRef='other';assert.ok(inspect(a).blockers.includes('PROJECT_SCOPE_MISMATCH'));
 const b=green();b.counts.products=3;assert.ok(inspect(b).blockers.includes('HOSTED_BASELINE_DRIFT_OR_MISSING'));
});
test('six mandatory data surfaces',()=>assert.deepEqual(CORE,
 ['products','orders','customers','order_items','conversations','messages']));
for(const t of CORE){
 test(t+' missing Store ID',()=>{const s=green();s.tables[t].storeId=false;
  assert.ok(inspect(s).blockers.includes('TENANT_STORE_COLUMNS_MISSING_'+t.toUpperCase()));});
 test(t+' still permits legacy Tenant reads',()=>{const s=green();s.tables[t].legacyTenantPermissiveSelect=true;
  assert.ok(inspect(s).blockers.includes('LEGACY_TENANT_READ_POLICY_'+t.toUpperCase()));});
 test(t+' missing Store RLS policy',()=>{const s=green();s.tables[t].storeScopedReadPolicy=false;
  assert.ok(inspect(s).blockers.includes('STORE_READ_POLICY_MISSING_'+t.toUpperCase()));});
 test(t+' unreviewed writer',()=>{const s=green();s.tables[t].writerCompatibilityReviewed=false;
  assert.ok(inspect(s).blockers.includes('WRITER_COMPATIBILITY_UNREVIEWED_'+t.toUpperCase()));});
}
for(const f of FKS)test('M3 FK missing '+f,()=>{
 const s=green();delete s.constraints[f];assert.ok(inspect(s).blockers.includes('M3_CONSTRAINT_MISSING_'+f.toUpperCase()));
});
for(const n of PRIVATE)test('shared/private surface unreviewed '+n,()=>{
 const s=green();delete s.scopeClassification[n];
 assert.ok(inspect(s).blockers.includes('PRIVATE_OR_SHARED_SURFACE_UNREVIEWED_'+n.toUpperCase()));
});
test('Tenant-wide SKU key must be replaced',()=>{
 const s=green();s.constraints.legacyTenantSkuUniqueRemoved=false;
 assert.ok(inspect(s).blockers.includes('SKU_STILL_TENANT_SCOPED'));
});
test('one missing merchant independent proof blocks',()=>{
 const s=green();s.fourRowOwnership[3].independentReviewerVerified=false;
 assert.ok(inspect(s).blockers.includes('REAL_OWNER_ORIGIN_UNATTESTED'));
});
test('duplicate four-row alias blocks',()=>{
 const s=green();s.fourRowOwnership[3].alias=s.fourRowOwnership[0].alias;
 assert.ok(inspect(s).blockers.includes('REAL_FOUR_ROW_LEDGER_INVALID'));
});
test('one missing row blocks',()=>{
 const s=green();s.fourRowOwnership.pop();
 assert.ok(inspect(s).blockers.includes('REAL_FOUR_ROW_LEDGER_INCOMPLETE'));
});
test('maintenance approval absent blocks',()=>{
 const s=green();s.authority.maintenanceWindowApproved=false;
 assert.ok(inspect(s).blockers.includes('AUTHORITY_MISSING_MAINTENANCEWINDOWAPPROVED'));
});
test('all-green self-report NEVER authorizes hosted migration',()=>{
 const r=inspect(green());
 assert.equal(r.status,'STRUCTURAL_SELF_REPORT_REQUIRES_EXTERNAL_ATTESTATION');
 for(const k of ['canMigrate','canBackfill','canReplaceRls','canRevokeRpc',
  'canRelease','actualOwnerStoreVerified','authenticatedEvidenceVerified'])
  assert.equal(r[k],false);
});
test('no sensitive input is echoed',()=>{
 const s=green();s.privateToken='NEVER_ECHO';
 assert.equal(JSON.stringify(inspect(s)).includes('NEVER_ECHO'),false);
});
test('invalid payload fails closed',()=>{
 assert.equal(inspect(null).status,'HOSTED_NO_GO');assert.equal(inspect([]).canMigrate,false);
});