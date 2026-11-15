'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {assessLevel2Evidence,REQUIRED_L2,createScopedOfflineBridge}=require('./level2-offline-bridge.cjs');
const A='PAGE_QA_A',B='PAGE_QA_B',C='PAGE_QA_C';
function sender(bridge,page=A,user='QA_USER_ALICE'){
 let n=0;
 return (text,mid)=>bridge.simulateSyntheticMessage({pageId:page,senderId:user,
  text,mid:mid||'QA_MID_V146_'+user.replace('QA_USER_','')+'_'+String(++n).padStart(4,'0')});
}
test('01 incomplete evidence cannot certify LEVEL2',()=>{
 const x=assessLevel2Evidence();assert.equal(x.currentCertification,'LEVEL1_ONLY');
 assert.equal(x.canClaimLevel2,false);assert.equal(x.canMergeOrPublish,false);
 assert.deepEqual(x.unverifiedOrMissing,REQUIRED_L2);
});
test('02 reject invalid evidence input',()=>{
 for(const x of [null,[],42,'yes'])assert.throws(()=>assessLevel2Evidence(x),/L2_EVIDENCE_INVALID/);
});
test('03 even fabricated VERIFIED labels cannot authorize',()=>{
 const e=Object.fromEntries(REQUIRED_L2.map(k=>[k,{status:'VERIFIED',evidenceRef:'untrusted-user-claim'}]));
 const x=assessLevel2Evidence(e);
 assert.equal(x.metadataCompleteness,'CANDIDATE_FOR_INDEPENDENT_REVIEW');
 for(const k of ['independentlyVerified','canClaimLevel2','canSendProviderMessage','canWriteHostedOrders','canMergeOrPublish'])assert.equal(x[k],false);
});
test('04 malformed evidence reference is incomplete',()=>{
 const x=assessLevel2Evidence({trusted_page_store_identity:{status:'VERIFIED',evidenceRef:'short'}});
 assert.ok(x.unverifiedOrMissing.includes('trusted_page_store_identity'));
});
test('05 consult composes inherited Messenger lab with channel core',()=>{
 const r=sender(createScopedOfflineBridge())('Shop có áo không?');
 assert.equal(r.flow,'CONSULT');assert.equal(r.responseType,'TEXT');
 assert.equal(r.fixtureStore,'A');assert.equal(r.contractVersion,'14.3');
});
test('06 A and B same SKU prices remain different',()=>{
 const a=sender(createScopedOfflineBridge(),A)('giá áo thun');
 const b=sender(createScopedOfflineBridge(),B)('giá áo thun');
 assert.match(a.previewText,/159\.000/);assert.match(b.previewText,/209\.000/);
 assert.notEqual(a.fixtureStore,b.fixtureStore);
});
test('07 C cross-tenant fixture has independent price',()=>{
 const r=sender(createScopedOfflineBridge(),C)('báo giá');
 assert.equal(r.fixtureTenant,'T2');assert.match(r.previewText,/259\.000/);
});
test('08 order starts with explicit confirmation but no write',()=>{
 const bridge=createScopedOfflineBridge(),r=sender(bridge)('đặt 2 áo thun');
 assert.equal(r.awaitingConfirmation,true);
 assert.equal(r.responseType,'ORDER_CONFIRMATION_REQUIRED');
 assert.equal(bridge.inspect().requests,0);assert.equal(r.hostedWrites,0);
});
test('09 confirmation is only synthetic order and unsent outbox',()=>{
 const bridge=createScopedOfflineBridge(),s=sender(bridge);
 s('đặt 2 áo thun');const r=s('xác nhận');
 assert.equal(r.responseType,'ORDER_REQUEST_SUMMARY');
 assert.match(r.requestCode,/^QA-REQ-/);
 assert.equal(bridge.inspect().unsentOutbox,1);
 assert.equal(r.providerSends,0);assert.equal(r.hostedWrites,0);
});
test('10 duplicate MID replay returns one synthetic request',()=>{
 const bridge=createScopedOfflineBridge(),s=sender(bridge);
 s('đặt 2 áo thun','QA_MID_ORDER_001');
 const a=s('xác nhận','QA_MID_CONFIRM_001');
 const b=s('xác nhận','QA_MID_CONFIRM_001');
 assert.equal(b.replayed,true);assert.equal(a.requestCode,b.requestCode);
 assert.equal(bridge.inspect().requests,1);
});
test('11 conflict MID reused with altered text fails closed',()=>{
 const bridge=createScopedOfflineBridge(),s=sender(bridge);
 s('giá áo thun','QA_MID_TAMPER_001');
 assert.throws(()=>s('giá 1000','QA_MID_TAMPER_001'),/MID_PAYLOAD_OR_SENDER_SCOPE_CONFLICT/);
});
test('12 unknown Page rejected by inherited fixture gateway',()=>{
 const bridge=createScopedOfflineBridge();
 assert.throws(()=>bridge.simulateSyntheticMessage({pageId:'UNKNOWN',senderId:'QA_USER_ALICE',
 text:'hi',mid:'QA_MID_UNKNOWN_001'}),/BAD_SYNTHETIC_ENVELOPE/);
});
test('13 cross Page request readback denied',()=>{
 const bridge=createScopedOfflineBridge(),a=sender(bridge,A),b=sender(bridge,B);
 a('đặt 1 áo thun');assert.ok(a('xác nhận').requestCode);
 assert.equal(b('mã đơn').requestCode,null);
});
test('14 same Page different sender request readback denied',()=>{
 const bridge=createScopedOfflineBridge(),a=sender(bridge,A,'QA_USER_ALICE'),b=sender(bridge,A,'QA_USER_BOB');
 a('đặt 1 áo thun');a('xác nhận');
 assert.equal(b('tra cứu đơn').requestCode,null);
});
test('15 staff handoff and order cancellation remain no-send',()=>{
 const bridge=createScopedOfflineBridge(),s=sender(bridge);
 const r=s('gặp chủ shop');assert.equal(r.flow,'ORDER_SUPPORT');
 assert.equal(r.providerSends,0);assert.equal(r.canClaimLevel2,false);
 assert.match(s('hủy đơn').previewText,/chưa ghi thay đổi/i);
});
test('16 fixture outputs cannot be misreported as real AI/Meta/JWT',()=>{
 const bridge=createScopedOfflineBridge(),s=sender(bridge);
 for(const msg of ['tư vấn áo','báo giá','đặt 1 áo thun','xác nhận','mã đơn']){
  const r=s(msg);assert.equal(r.mode,'SYNTHETIC_COMPOSITION_ONLY');
  for(const k of ['realAiCalled','metaSignatureVerified','jwtRlsVerified','durableOutboxVerified','canClaimLevel2','canPublish'])assert.equal(r[k],false);
  assert.equal(r.hostedWrites,0);assert.equal(r.providerSends,0);
 }
});
