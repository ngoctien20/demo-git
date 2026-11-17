import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectMetaHandoffAck} from './meta-handoff-acceptance-offline.mjs';
const NOW=1794900000000;
const input={pendingRef:'pending-QA-A',receiptRef:'event-QA-A'};
function fixture() {
 const seen=new Set();
 const d={
   executionMode:'OFFLINE_SYNTHETIC_META_ACCEPTANCE',
   realProviderEnabled:false,
   nowMs:NOW,
   op:{
    source:'QA_SYNTHETIC_PENDING_HANDOFF',pendingRef:'pending-QA-A',
    status:'HANDOFF_PENDING',tenantId:'tenant-SHARED',storeId:'store-A',
    bindingId:'binding-A',conversationId:'conv-A',pageRef:'page-A',
    appRef:'meta-app-A',expectedMetaEvent:'pass_thread_control',
    pendingRequestId:'request-A',revision:2
   },
   receipt:{
    source:'QA_SYNTHETIC_META_RAW_HMAC_RECEIPT',qaOnly:true,
    allowSend:false,syntheticSignatureVerified:true,realMetaSignatureVerified:false,
    method:'META_X_HUB_SIGNATURE_256',receiptId:'receipt-A',
    eventId:'event-QA-A',occurredAtMs:NOW,
    pageRef:'page-A',appRef:'meta-app-A',bindingId:'binding-A',
    tenantId:'tenant-SHARED',storeId:'store-A',conversationId:'conv-A',
    pendingRequestId:'request-A',eventType:'pass_thread_control',
    threadOwnerConfirmed:true
   },
   readPendingOperation:async()=>d.op,
   readQaProviderReceipt:async()=>d.receipt,
   reserveQaReplay:async ({eventId,ttlMs})=>{
    assert.equal(ttlMs,24*3600*1000);
    if(seen.has(eventId))return false;
    seen.add(eventId);return true;
   }
 };
 return d;
}
async function denial(code,d=fixture(),i=input) {
 const r=await inspectMetaHandoffAck(i,d);
 assert.equal(r.offlineEligible,false,JSON.stringify(r));
 assert.equal(r.reason,code);
 assert.equal(r.canCommitState,false);
 assert.equal(r.noSend,true);
 assert.equal(r.realProviderVerified,false);
}
test('Meta synthetic ACK recognized as source-only candidate, never real provider acceptance',async()=>{
 const r=await inspectMetaHandoffAck(input,fixture());
 assert.equal(r.offlineEligible,true);
 assert.equal(r.stage,'QA_META_HANDOVER_ACK_CANDIDATE_ONLY');
 assert.equal(r.canCommitState,false);
 assert.equal(r.canReleaseBot,false);
 assert.equal(r.noSend,true);
 assert.equal(r.realProviderVerified,false);
 assert.equal(r.requiresDurableCas,true);
});
test('positive simulated return-to-bot still cannot unmute',async()=>{
 const d=fixture();
 d.op.status='RESUME_PENDING';d.op.expectedMetaEvent='take_thread_control';
 d.receipt.eventType='take_thread_control';
 const r=await inspectMetaHandoffAck(input,d);
 assert.equal(r.offlineEligible,true);
 assert.equal(r.canReleaseBot,false);
});
test('missing adapters fail-closed',async()=>denial('REAL_META_HANDOVER_NOT_AUTHORIZED',{}));
test('production mode blocked',async()=>{
 const d=fixture();d.executionMode='PRODUCTION';
 await denial('REAL_META_HANDOVER_NOT_AUTHORIZED',d);
});
test('real provider traffic mode blocked',async()=>{
 const d=fixture();d.realProviderEnabled=true;
 await denial('REAL_META_HANDOVER_NOT_AUTHORIZED',d);
});
test('bad raw request ref blocked',async()=>denial('INVALID_REFERENCE',fixture(),{pendingRef:'',receiptRef:'event-QA-A'}));
test('missing pending operation blocks',async()=>{
 const d=fixture();d.op=null;await denial('TRUSTED_PENDING_STATE_MISSING',d);
});
test('wrong Store operation state blocked',async()=>{
 const d=fixture();d.op.status='BOT_ACTIVE';await denial('TRUSTED_PENDING_STATE_MISSING',d);
});
test('wrong expected Meta event for state blocked',async()=>{
 const d=fixture();d.op.expectedMetaEvent='take_thread_control';
 await denial('TRUSTED_PENDING_STATE_MISSING',d);
});
test('client self-declared pending operation rejected',async()=>{
 const d=fixture();d.op.source='CLIENT_SELF_REPORTED';
 await denial('TRUSTED_PENDING_STATE_MISSING',d);
});
test('missing signature proof blocked',async()=>{
 const d=fixture();d.receipt.syntheticSignatureVerified=false;
 await denial('META_RAW_RECEIPT_UNTRUSTED',d);
});
test('synthetic receipt cannot claim real Meta signature validated',async()=>{
 const d=fixture();d.receipt.realMetaSignatureVerified=true;
 await denial('META_RAW_RECEIPT_UNTRUSTED',d);
});
test('wrong signed method blocked',async()=>{
 const d=fixture();d.receipt.method='ZALO_OA_MAC';
 await denial('META_RAW_RECEIPT_UNTRUSTED',d);
});
test('signed payload with send privilege blocked',async()=>{
 const d=fixture();d.receipt.allowSend=true;
 await denial('META_RAW_RECEIPT_UNTRUSTED',d);
});
test('receipt not explicitly QA-only blocked',async()=>{
 const d=fixture();d.receipt.qaOnly=false;
 await denial('META_RAW_RECEIPT_UNTRUSTED',d);
});
test('stale provider event blocked',async()=>{
 const d=fixture();d.receipt.occurredAtMs=NOW-300001;
 await denial('META_RAW_RECEIPT_UNTRUSTED',d);
});
test('future timestamp blocks forged event',async()=>{
 const d=fixture();d.receipt.occurredAtMs=NOW+10001;
 await denial('META_RAW_RECEIPT_UNTRUSTED',d);
});
test('wrong Page blocked',async()=>{
 const d=fixture();d.receipt.pageRef='page-B';
 await denial('META_PAGE_THREAD_OR_TRANSITION_MISMATCH',d);
});
test('wrong Meta App blocked',async()=>{
 const d=fixture();d.receipt.appRef='app-B';
 await denial('META_PAGE_THREAD_OR_TRANSITION_MISMATCH',d);
});
test('same-Tenant different Store blocked',async()=>{
 const d=fixture();d.receipt.storeId='store-B';
 await denial('META_PAGE_THREAD_OR_TRANSITION_MISMATCH',d);
});
test('different Tenant blocked',async()=>{
 const d=fixture();d.receipt.tenantId='tenant-B';
 await denial('META_PAGE_THREAD_OR_TRANSITION_MISMATCH',d);
});
test('different conversation blocked',async()=>{
 const d=fixture();d.receipt.conversationId='conv-B';
 await denial('META_PAGE_THREAD_OR_TRANSITION_MISMATCH',d);
});
test('wrong pending request ID blocked',async()=>{
 const d=fixture();d.receipt.pendingRequestId='request-B';
 await denial('META_PAGE_THREAD_OR_TRANSITION_MISMATCH',d);
});
test('wrong event class blocked',async()=>{
 const d=fixture();d.receipt.eventType='standby_message';
 await denial('META_PAGE_THREAD_OR_TRANSITION_MISMATCH',d);
});
test('thread owner unconfirmed blocked',async()=>{
 const d=fixture();d.receipt.threadOwnerConfirmed=false;
 await denial('META_PAGE_THREAD_OR_TRANSITION_MISMATCH',d);
});
test('duplicate provider event replay denied',async()=>{
 const d=fixture();
 assert.equal((await inspectMetaHandoffAck(input,d)).offlineEligible,true);
 await denial('REPLAY_OR_CONFLICT',d);
});
test('replay service down denies all acceptance',async()=>{
 const d=fixture();d.reserveQaReplay=async()=>{throw Error('offline')};
 await denial('REPLAY_STORAGE_UNAVAILABLE',d);
});
test('receipt store down denies all acceptance',async()=>{
 const d=fixture();d.readQaProviderReceipt=async()=>{throw Error('offline')};
 await denial('PRIVATE_RECEIPT_UNAVAILABLE',d);
});
