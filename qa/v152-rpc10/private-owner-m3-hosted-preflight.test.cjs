'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const baseline=require('../v152-rpc6/hosted-fourrow-recovery-baseline.json');
const {CONTRACT,PROJECT,REQUIRED_EVIDENCE,classifyPrivateM3,
 executeRealM3}=require('./private-owner-m3-hosted-preflight.cjs');
const b=()=>structuredClone(baseline);
const ready=()=>({
 currentBaseline:b(),
 ownerEvidence:{status:'PRIVATE_LEDGER_FORMAT_READY_FOR_REAL_REVIEW',validatedShapeCount:4},
 m0Evidence:{status:'CLAIMED_M0_READY_FOR_EXTERNAL_ATTESTATION'},
 phaseEvidence:{scope:'STAGING_ONLY_M3_AFTER_M2M4',
   callerContractVersionValidated:true,
   m3SqlCanaryRestrictedToDisposableLab:true},
 primaryEvidence:Object.fromEntries(REQUIRED_EVIDENCE.map(k=>[k,true]))
});
test('01 current hosted baseline still 2 Products and 2 Orders in 2 Tenants',()=>{
 const a=b();assert.equal(a.entity_counts.products,2);
 assert.equal(a.entity_counts.orders,2);
 assert.equal(a.tenant_shape.tenants_each_with_one_product_and_one_order,2);
});
test('02 current absence of real Store tables prevents actual M3 migration',()=>{
 assert.equal(b().current_schema.stores_exists,false);
 assert.equal(classifyPrivateM3({currentBaseline:b()}).status,'HOSTED_M3_NO_GO');
});
test('03 no private Owner ledger means NO-GO',()=>{
 const p=ready();delete p.ownerEvidence;
 assert(classifyPrivateM3(p).issues.includes('FOUR_ROW_PRIVATE_OWNER_LEDGER_NOT_READY_FOR_REVIEW'));
});
test('04 three instead of four Owner rows is rejected',()=>{
 const p=ready();p.ownerEvidence.validatedShapeCount=3;
 assert.equal(classifyPrivateM3(p).status,'HOSTED_M3_NO_GO');
});
test('05 owner-accepted H11R partial archive is not independent full restore',()=>{
 const p=ready();p.m0Evidence={status:'LOCAL_ARCHIVE_TOC_REVIEW_ONLY'};
 assert(classifyPrivateM3(p).issues.includes('M0_REAL_RECOVERY_NOT_INDEPENDENTLY_ATTESTED'));
});
test('06 M3 before M2M4 phases is denied',()=>{
 const p=ready();p.phaseEvidence.scope='STAGING_ONLY_M3_BEFORE_M2M4';
 assert(classifyPrivateM3(p).issues.includes('PHASE_M3_OR_WRITER_COMPATIBILITY_NOT_REVIEWED'));
});
test('07 wrong environment or project is denied',()=>{
 const p=ready();p.currentBaseline.project_ref='other-project';
 assert.equal(classifyPrivateM3(p).status,'HOSTED_M3_NO_GO');
});
test('08 hosted row count drift demands a fresh read-only review',()=>{
 const p=ready();p.currentBaseline.entity_counts.orders=4;
 assert(classifyPrivateM3(p).issues.includes('LIVE_ORDERS_COUNT_DRIFT'));
});
test('09 each missing direct primary evidence class blocks',()=>{
 for(const k of REQUIRED_EVIDENCE){
  const p=ready();p.primaryEvidence[k]=false;
  const r=classifyPrivateM3(p);
  assert.equal(r.status,'HOSTED_M3_NO_GO',k);
  assert(r.issues.includes('MISSING_'+k.toUpperCase()),k);
 }
});
test('10 especially M3 FKs and Store SKU/legacy writers must be reviewed',()=>{
 for(const k of ['customerOrderSameStoreForeignKeysReviewed',
 'storeScopedSkuAndLegacyWriterCompatibilityReviewed',
 'allPrivilegedWriterAndSecurityDefinerCallersReviewed']){
  const p=ready();p.primaryEvidence[k]=false;
  assert.equal(classifyPrivateM3(p).canApplyM3,false);
 }
});
test('11 distinct DB Operator, Controller and Security Reviewer approvals mandatory',()=>{
 for(const k of ['separateM3ControllerApprovalConfirmed',
 'independentSecurityReviewerAttestationConfirmed',
 'leastPrivilegeDbOperatorBoundToStagingWindow']){
  const p=ready();p.primaryEvidence[k]=false;
  assert.equal(classifyPrivateM3(p).status,'HOSTED_M3_NO_GO');
 }
});
test('12 all-green unverified packet STILL cannot authorize any operation',()=>{
 const r=classifyPrivateM3(ready());
 assert.equal(r.status,'CLAIMED_REVIEW_PACKET_REQUIRES_EXTERNAL_PRIMARY_SOURCE_VERIFICATION');
 for(const field of ['actualOwnerToStoreAuthorityVerified',
  'realIndependentRecoveryCertified','realCallerAndJwtProofCertified',
  'liveMigrationAuthorized','canApplyM1','canApplyM2M4','canApplyM3',
  'canBackfill','canChangeRls','canRevokeLegacyRpc','canPublishWorkflows']){
  assert.equal(r[field],false,field);
 }
});
test('13 malformed or missing proof packet fails closed',()=>{
 for(const p of [null,undefined,{},'all true',[]]){
  const a=ready();a.primaryEvidence=p;
  assert.equal(classifyPrivateM3(a).status,'HOSTED_M3_NO_GO');
 }
});
test('14 private records and actual customer data never returned',()=>{
 const x=classifyPrivateM3(ready()),s=JSON.stringify(x);
 assert.equal(x.realRowIdsInspectedByThisCode,false);
 assert.equal(x.customerDataChanged,0);
 assert(!s.includes('sample-customer-uuid'));
});
test('15 no real hosted action is implemented',()=>{
 assert.throws(()=>executeRealM3(),/REQUIRES_SEPARATE_VERIFIED_APPROVAL/);
 assert.equal(CONTRACT,'T404_RPC10_PRIVATE_OWNER_M3_FK_INDEPENDENT_AUTHORITY_V1');
 assert.equal(PROJECT,'ifxlvrhyjhbzbrkdsida');
});
