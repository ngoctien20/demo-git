'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {runShadowUat}=require('./no-send-channel-uat.cjs');
const now=1794873600000;
const scope={tenantId:'T_QA_01',storeId:'S_QA_A'};
const messenger='6ZWYRBKieTKQMzoQ',zalo='FqEcdmc8PRRMNUEb';
const realMessenger='Z7FdV7uDvApfbURQ',realZalo='yIJk8LvJoLF40Z62';
const install=(channel,id)=>({...scope,channel,providerInstallationId:id,
  source:'SYNTHETIC_TEST_INSTALLATION_ONLY',stage:'INACTIVE_QA_SHADOW'});
const catalog=[{...scope,sku:'QA_F_001',active:true},{...scope,sku:'QA_F_002',active:true}];
const inventory=[
 {workflowId:messenger,active:false,hasPotentialSideEffects:false},
 {workflowId:zalo,active:false,hasPotentialSideEffects:false},
 {workflowId:realMessenger,active:true,hasPotentialSideEffects:true},
 {workflowId:realZalo,active:true,hasPotentialSideEffects:true}
];
const base=(extra={})=>({...scope,
  caseId:'CASE_A',eventId:'EVENT_A',channel:'MESSENGER',
  providerInstallationId:'META_PAGE_QA_A',workflowId:messenger,
  origin:'OFFLINE_SYNTHETIC_PROVIDER_FIXTURE_ONLY',syntheticSignatureValid:true,
  intent:'IMAGE_PRODUCT_LOOKUP',candidateSkus:['QA_F_001'],
  requestedAction:'SUGGEST_SKU',...extra});
const orderGrant=(extra={})=>({...scope,type:'QA_ORDER_READ_ONLY_FIXTURE',
  orderId:'ORD_A_001',customerChallengeApproved:true,
  targetCustomerVerified:true,expiresAtMs:now+30000,
  sourceChannel:'MESSENGER',targetChannel:'ZALO',...extra});
const input=(extra={})=>({...scope,nowMs:now,
 installations:[install('MESSENGER','META_PAGE_QA_A'),install('ZALO','ZALO_OA_QA_A')],
 catalog,channelWorkflowInventory:inventory,fixtures:[base()],...extra});
const run=(extra={})=>runShadowUat(input(extra));
const decision=extra=>run({fixtures:[base(extra)]}).results[0];
const cross=(extra={})=>base({caseId:'CASE_X',eventId:'EVENT_X',
  channel:'ZALO',providerInstallationId:'ZALO_OA_QA_A',workflowId:zalo,
  intent:'CROSS_CHANNEL_ORDER_READ',sourceChannel:'MESSENGER',
  orderId:'ORD_A_001',sourceCustomerApprovedLink:true,
  targetCustomerVerifiedLink:true,orderAccessGrant:orderGrant(),
  requestedAction:'READ_ONLY',...extra});
test('01 ordinary photo suggestion fixture rehearses read only',()=>assert.equal(decision({}).decision,'SYNTHETIC_READ_ONLY_REHEARSAL'));
test('02 UAT output never claims actual provider signature',()=>assert.equal(run().realProviderSignatureVerified,false));
test('03 UAT output never claims hosted Store RLS',()=>assert.equal(run().hostedStoreRlsVerified,false));
test('04 no actual order queries or sends occur',()=>{
 const r=run();assert.equal(r.actualOrderQueries,0);assert.equal(r.providerSends,0);
});
test('05 no production promotion can be inferred',()=>assert.equal(run().canPromoteToCommerceCore,false));
test('06 no customer content or order data in output',()=>{
 const r=run();assert.equal(JSON.stringify(r).includes('customerId'),false);
 assert.equal(JSON.stringify(r).includes('orderAccessGrant'),false);
});
test('07 photo unknown SKU denied',()=>assert.equal(decision({candidateSkus:['QA_OTHER']}).denialCode,'UAT_VISION_SKU_NOT_VERIFIED_OR_AUTOSELECT_DENIED'));
test('08 auto selected model SKU denied',()=>assert.equal(decision({skuAutomaticallySelected:true}).decision,'DENY'));
test('09 too many candidates denied',()=>assert.equal(decision({candidateSkus:['QA_F_001','QA_F_002','QA_F_001','QA_F_002']}).decision,'DENY'));
test('10 cross Tenant event denied',()=>assert.equal(decision({tenantId:'T_OTHER'}).denialCode,'UAT_CROSS_STORE_OR_TENANT_DENIED'));
test('11 cross Store event denied',()=>assert.equal(decision({storeId:'S_QA_B'}).denialCode,'UAT_CROSS_STORE_OR_TENANT_DENIED'));
test('12 unknown installation refused',()=>assert.equal(decision({providerInstallationId:'META_OTHER'}).denialCode,'UAT_UNBOUND_CHANNEL_INSTALLATION'));
test('13 active Messenger with send tools never used as shadow',()=>assert.equal(decision({workflowId:realMessenger}).denialCode,'UAT_REAL_ACTIVE_OR_SIDE_EFFECT_WORKFLOW_DENIED'));
test('14 active Zalo with marker upsert never used as shadow',()=>assert.equal(decision({channel:'ZALO',providerInstallationId:'ZALO_OA_QA_A',workflowId:realZalo}).denialCode,'UAT_REAL_ACTIVE_OR_SIDE_EFFECT_WORKFLOW_DENIED'));
test('15 side-effect workflow even if inactive refused',()=>{
 const inv=[...inventory,{workflowId:'FAKE_SIDE_EFFECT',active:false,hasPotentialSideEffects:true}];
 const r=run({channelWorkflowInventory:inv,fixtures:[base({workflowId:'FAKE_SIDE_EFFECT'})]});
 assert.equal(r.results[0].denialCode,'UAT_REAL_ACTIVE_OR_SIDE_EFFECT_WORKFLOW_DENIED');
});
test('16 spoofed real webhook origin refused',()=>assert.equal(decision({origin:'REAL_PROVIDER_WEBHOOK'}).denialCode,'UAT_NATIVE_PROVIDER_SIGNATURE_NOT_PRESENT'));
test('17 unchecked synthetic signature refused',()=>assert.equal(decision({syntheticSignatureValid:false}).denialCode,'UAT_NATIVE_PROVIDER_SIGNATURE_NOT_PRESENT'));
test('18 direct order write action denied',()=>assert.equal(decision({requestedAction:'WRITE_ORDER'}).denialCode,'UAT_SIDE_EFFECT_ACTION_FORBIDDEN'));
test('19 send-message action denied',()=>assert.equal(decision({requestedAction:'SEND_MESSAGE'}).decision,'DENY'));
test('20 arbitrary unknown action denied',()=>assert.equal(decision({requestedAction:'UNKNOWN_ACTION'}).decision,'DENY'));
test('21 create order action denied',()=>assert.equal(decision({requestedAction:'CREATE_ORDER'}).decision,'DENY'));
test('22 upsert customer/QA marker action denied',()=>assert.equal(decision({requestedAction:'UPSERT_MARKER'}).decision,'DENY'));
test('23 synthetic cross channel read-only with challenge can be simulated',()=>{
 const r=run({fixtures:[cross()]});
 assert.equal(r.syntheticAccepts,1);assert.equal(r.liveZaloUatPassed,false);
});
test('24 cross channel missing source approval denied',()=>{
 const r=run({fixtures:[cross({sourceCustomerApprovedLink:false})]});
 assert.equal(r.results[0].denialCode,'UAT_CROSS_CHANNEL_TWO_STEP_LINK_DENIED');
});
test('25 cross channel missing verified target denied',()=>{
 const r=run({fixtures:[cross({targetCustomerVerifiedLink:false})]});
 assert.equal(r.results[0].decision,'DENY');
});
test('26 cross channel wrong Store grant denied',()=>{
 const r=run({fixtures:[cross({orderAccessGrant:orderGrant({storeId:'S_QA_B'})})]});
 assert.equal(r.results[0].denialCode,'UAT_ORDER_READER_ACCESS_GRANT_DENIED');
});
test('27 cross channel wrong order id grant denied',()=>{
 const r=run({fixtures:[cross({orderAccessGrant:orderGrant({orderId:'ORD_A_999'})})]});
 assert.equal(r.results[0].denialCode,'UAT_ORDER_READER_ACCESS_GRANT_DENIED');
});
test('28 cross channel expired grant denied',()=>{
 const r=run({fixtures:[cross({orderAccessGrant:orderGrant({expiresAtMs:now-10})})]});
 assert.equal(r.results[0].decision,'DENY');
});
test('29 target identity challenge not approved denied',()=>{
 const r=run({fixtures:[cross({orderAccessGrant:orderGrant({customerChallengeApproved:false})})]});
 assert.equal(r.results[0].decision,'DENY');
});
test('30 wrong target channel in grant denied',()=>{
 const r=run({fixtures:[cross({orderAccessGrant:orderGrant({targetChannel:'MESSENGER'})})]});
 assert.equal(r.results[0].decision,'DENY');
});
test('31 duplicate synthetic event ID rejected',()=>{
 assert.throws(()=>run({fixtures:[base(),base({caseId:'CASE_B'})]}),/UAT_CASE_INVALID/);
});
test('32 duplicate QA case ID rejected',()=>{
 assert.throws(()=>run({fixtures:[base(),base({eventId:'EVENT_B'})]}),/UAT_CASE_INVALID/);
});
test('33 no synthetic registry can activate live workflow',()=>{
 const inst=install('MESSENGER','META_PAGE_QA_A');inst.stage='ACTIVE_PRODUCTION';
 assert.throws(()=>run({installations:[inst,install('ZALO','ZALO_OA_QA_A')]}),/UAT_INSTALLATION_UNTRUSTED_OR_ACTIVE/);
});
test('34 duplicate Store SKU catalog rejected',()=>{
 assert.throws(()=>run({catalog:[...catalog,catalog[0]]}),/UAT_CATALOG_SCOPE_INVALID/);
});
test('35 unknown provider channel refused at input',()=>{
 assert.throws(()=>run({fixtures:[base({channel:'WHATSAPP'})]}),/UAT_CASE_INVALID/);
});
test('36 no real provider event consumed in successful fixture',()=>assert.equal(run().realWebhookEventsConsumed,0));
