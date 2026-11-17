'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {CONTRACT,REQUIREMENTS,review,permittedQaActions,authorizeRealUat}
 =require('./meta-zalo-uat-admission.cjs');
const all=Object.values(REQUIREMENTS).flat();
const packet=()=>({projectRef:'ifxlvrhyjhbzbrkdsida',
 scope:'STAGING_READ_ONLY_NO_SEND',
 claims:Object.fromEntries(all.map(k=>[k,true]))});
test('01 actual snapshot missing proofs is hosted NO-GO',()=>{
 const r=review({projectRef:'ifxlvrhyjhbzbrkdsida'});
 assert.equal(r.status,'REAL_MESSENGER_ZALO_UAT_NO_GO');
 assert.equal(r.missingEvidenceCount,all.length);
});
test('02 wrong project cannot be swapped into release',()=>{
 const x=packet();x.projectRef='some-other-project';
 assert.equal(review(x).status,'REAL_MESSENGER_ZALO_UAT_NO_GO');
});
test('03 production send scope never admissible in this pilot',()=>{
 const x=packet();x.scope='PRODUCTION_SEND';
 assert.equal(review(x).status,'REAL_MESSENGER_ZALO_UAT_NO_GO');
});
test('04 each source Meta Page permission independently required',()=>{
 for(const field of REQUIREMENTS.META){
  const x=packet();x.claims[field]=false;
  assert.equal(review(x).status,'REAL_MESSENGER_ZALO_UAT_NO_GO',field);
 }
});
test('05 Zalo OA authority distinct from generic Zalo Bot',()=>{
 for(const field of REQUIREMENTS.ZALO_OA){
  const x=packet();delete x.claims[field];
  assert.equal(review(x).status,'REAL_MESSENGER_ZALO_UAT_NO_GO',field);
 }
});
test('06 source Messenger approval must precede cross-channel lookup',()=>{
 for(const field of REQUIREMENTS.CROSS_CHANNEL){
  const x=packet();x.claims[field]=false;
  assert.equal(review(x).status,'REAL_MESSENGER_ZALO_UAT_NO_GO',field);
 }
});
test('07 hosted RLS, store owner proof and independent recovery all mandatory',()=>{
 for(const field of REQUIREMENTS.DATA_AND_SECURITY){
  const x=packet();x.claims[field]=undefined;
  assert.equal(review(x).status,'REAL_MESSENGER_ZALO_UAT_NO_GO',field);
 }
});
test('08 model image rights and cost cannot be bypassed by free-credit claims',()=>{
 const x=packet();for(const k of [
 'merchantImageRightsAndRetentionIndependentlyAttested',
 'realVisionProviderInferenceReceiptApproved',
 'realImageRecallAndUnknownFalsePositiveMeasured',
 'pricingAndModelBudgetOperatorApproved'])x.claims[k]=false;
 assert(review(x).missingEvidenceCount>=4);
});
test('09 exact review signatures and no-send pilot required',()=>{
 for(const field of REQUIREMENTS.RELEASE){
  const x=packet();x.claims[field]=false;
  assert.equal(review(x).status,'REAL_MESSENGER_ZALO_UAT_NO_GO',field);
 }
});
test('10 forged all-green packet still can do NO live actions',()=>{
 const r=review(packet());
 assert.equal(r.status,'CLAIMED_EVIDENCE_PACKET_PENDING_INDEPENDENT_OPERATOR_ACCEPTANCE');
 for(const key of ['canSendProvider','canCallRealVision','canPublishWorkflow',
 'canBackfillCommerce','canReadRealOrders','canMergeRelease'])
  assert.equal(r[key],false,key);
});
test('11 only allowed QA actions are read-only, not live',()=>{
 const q=permittedQaActions();
 assert.equal(q.runSyntheticNodeTests,true);
 assert.equal(q.useIsolatedDisposableDb,true);
 assert.equal(q.realProviderSend,false);
 assert.equal(q.uploadMerchantImages,false);
});
test('12 there is no accidental live-send implementation in admission gate',()=>{
 assert.throws(()=>authorizeRealUat(),/PRIVATE_OPERATOR_APPROVAL/);
 assert.equal(CONTRACT,'T404_V171E_META_ZALO_UAT_NO_SEND_ADMISSION_V1');
});
