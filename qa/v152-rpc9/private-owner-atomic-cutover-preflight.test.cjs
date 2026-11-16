'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const baseline=require('../v152-rpc6/hosted-fourrow-recovery-baseline.json');
const {CONTRACT,PROJECT,PHASE,EXPECTED_INPUTS,recordPreflight,
 executeHostedCutover}=require('./private-owner-atomic-cutover-preflight.cjs');
const b=()=>structuredClone(baseline);
const owner=()=>({status:'PRIVATE_LEDGER_FORMAT_READY_FOR_REAL_REVIEW',validatedShapeCount:4});
const m0=()=>({status:'CLAIMED_M0_READY_FOR_EXTERNAL_ATTESTATION'});
const approvals=()=>Object.fromEntries(EXPECTED_INPUTS.map(x=>[x,true]));
const req=()=>({projectRef:PROJECT,exactPhase:PHASE,
 singleTransactionApproved:true,zeroDowntimeClaim:false,
 changeScope:'STAGING_ONLY'});
const good=()=>({baseline:b(),ownerPacket:owner(),m0Receipt:m0(),
 hostedProofs:approvals(),changeRequest:req()});
test('01 existing hosted snapshot has two separate Tenants and no Store schema',()=>{
 assert.equal(b().tenant_shape.tenants_each_with_one_product_and_one_order,2);
 assert.equal(b().current_schema.stores_exists,false);
 assert.equal(b().entity_counts.products,2);
 assert.equal(b().entity_counts.orders,2);
});
test('02 missing real four-row ledger blocks even when rest of input claimed green',()=>{
 const g=good();delete g.ownerPacket;
 const x=recordPreflight(g);
 assert(x.blockers.includes('PRIVATE_FOUR_ROW_OWNER_LEDGER_NOT_ATTESTED'));
 assert.equal(x.canBackfill,false);
});
test('03 only two rows in ledger is rejected',()=>{
 const g=good();g.ownerPacket.validatedShapeCount=2;
 assert.equal(recordPreflight(g).status,'RPC9_M2_M4_HOSTED_NO_GO');
});
test('04 H11R partial application local receipt is not real independent M0 proof',()=>{
 const g=good();g.m0Receipt={status:'LOCAL_ARCHIVE_TOC_REVIEW_ONLY'};
 assert(recordPreflight(g).blockers.includes('M0_REAL_BACKUP_RESTORE_NOT_INDEPENDENTLY_ACCEPTED'));
});
test('05 missing signed Owner review / provenance / source freshness blocks',()=>{
 for(const key of ['realSourceFreshnessInspected',
  'fourIndividualRowsOwnerAttributedToCanonicalStore',
  'independentMerchantAndReviewerAttestationInspected']){
  const g=good();g.hostedProofs[key]=false;
  assert(recordPreflight(g).blockers.includes('HOSTED_PROOF_'+key.toUpperCase()+'_MISSING'),key);
 }
});
test('06 missing reader blackout approval or lock budgets blocks',()=>{
 for(const key of ['allSessionsAndReadersMaintenanceRestrictionApproved',
  'readLockBudgetAndStatementTimeoutApproved']){
  const g=good();g.hostedProofs[key]=false;
  assert.equal(recordPreflight(g).status,'RPC9_M2_M4_HOSTED_NO_GO');
 }
});
test('07 missing real JWT cross-Store or revoked-staff evidence blocks',()=>{
 for(const key of ['realOwnerAJwtAndOwnerBJwtSameTenantNegative',
   'crossTenantAndRevokedStaffReadNegative']){
   const g=good();g.hostedProofs[key]=false;
   assert.equal(recordPreflight(g).canApplyCutover,false);
   assert(recordPreflight(g).blockers.length>0);
 }
});
test('08 missing actual M1 hosted schema prevents phase jump',()=>{
 const g=good();g.hostedProofs.m1AlreadyAppliedAndRealHostedSchemaVerified=false;
 assert.equal(recordPreflight(g).status,'RPC9_M2_M4_HOSTED_NO_GO');
});
test('09 attempt to claim zero-downtime without measurements denied',()=>{
 const g=good();g.changeRequest.zeroDowntimeClaim=true;
 assert(recordPreflight(g).blockers.includes('EXACT_AUTHORIZED_STAGE_AND_DOWNTIME_SCOPE_MISSING'));
 assert.equal(recordPreflight(g).zeroDowntimeCertified,false);
});
test('10 cannot broaden M2M4 operation to production or M3/RPC revoke',()=>{
 for(const change of [
  {changeScope:'PRODUCTION'},
  {exactPhase:'M3_FK_DROP'},
  {exactPhase:'RPC_REVOKE'},
  {projectRef:'another-project'}]){
  const g=good();Object.assign(g.changeRequest,change);
  assert.equal(recordPreflight(g).status,'RPC9_M2_M4_HOSTED_NO_GO');
 }
});
test('11 schema count drift causes fresh audit/denial',()=>{
 const g=good();g.baseline.entity_counts.products=3;
 assert(recordPreflight(g).blockers.includes('LIVE_PRODUCTS_COUNT_DRIFT'));
});
test('12 self-reported all-green flags still never grant permission',()=>{
 const x=recordPreflight(good());
 assert.equal(x.status,'SELF_REPORTED_READY_FOR_SEPARATE_INDEPENDENT_OPERATOR_REVIEW');
 for(const field of ['actualOwnerStoreVerified','realIndependentRestoreCertified',
  'realJwtRlsAccepted','canBackfill','canReplaceRls','canApplyCutover',
  'canRevokeRpc','canChangePublished','canApplyM1','zeroDowntimeCertified']){
  assert.equal(x[field],false,field);
 }
});
test('13 null, broken or untrusted proof flags fail closed',()=>{
 for(const x of [null,undefined,'true',[],{approved:true}]){
  const g=good();g.hostedProofs=x;
  assert.equal(recordPreflight(g).status,'RPC9_M2_M4_HOSTED_NO_GO');
 }
});
test('14 no real hosted execution entrypoint',()=>{
 assert.throws(()=>executeHostedCutover(),/SEPARATE_REAL_M0_M1_M2M4_APPROVAL/);
 assert.equal(CONTRACT,'T404_RPC9_PRIVATE_OWNER_ATOMIC_M2M4_AUTHORIZATION_PREFLIGHT_V1');
});
