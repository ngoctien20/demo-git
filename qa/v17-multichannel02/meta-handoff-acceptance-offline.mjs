// TIEN404 V17.MULTI-CHANNEL-02 — synthetic Meta Handover acceptance preflight.
// This checks a PRIVATE RECEIPT HANDLE. It does not verify any real Meta request,
// call Graph, read PSIDs, advance a conversation, or generate a trusted live ACK.
const MODE = 'OFFLINE_SYNTHETIC_META_ACCEPTANCE';
const ID=/^[a-zA-Z0-9_.:-]{2,128}$/;
const valid=x=>typeof x==='string'&&ID.test(x);
const MAX_AGE_MS=5*60*1000;
const deny=reason=>Object.freeze({
  offlineEligible:false,reason,noSend:true,canCommitState:false,
  realProviderVerified:false,hostedWrite:false,canReleaseBot:false
});

/** Private adapters: readPendingOperation, readQaProviderReceipt, reserveQaReplay.
 * The only real production path would be independent HMAC validation from
 * raw bytes, Page/App authority, durable event replay and atomic Store-scoped
 * handoff transition. None of those are implemented or claimed here.
 */
export async function inspectMetaHandoffAck(input,deps) {
 if(!deps||deps.executionMode!==MODE||deps.realProviderEnabled!==false||
   !['readPendingOperation','readQaProviderReceipt','reserveQaReplay']
      .every(k=>typeof deps[k]==='function'))
    return deny('REAL_META_HANDOVER_NOT_AUTHORIZED');
 if(!input||!valid(input.pendingRef)||!valid(input.receiptRef))
    return deny('INVALID_REFERENCE');
 const now=deps.nowMs??Date.now();
 if(!Number.isSafeInteger(now)||now<=0)return deny('INVALID_CLOCK');
 let op,receipt;
 try {
   op=await deps.readPendingOperation({pendingRef:input.pendingRef});
   receipt=await deps.readQaProviderReceipt({receiptRef:input.receiptRef});
 } catch {return deny('PRIVATE_RECEIPT_UNAVAILABLE');}
 if(!op||op.source!=='QA_SYNTHETIC_PENDING_HANDOFF'||
   !valid(op.pendingRef)||op.pendingRef!==input.pendingRef||
   !['HANDOFF_PENDING','RESUME_PENDING'].includes(op.status)||
   !valid(op.tenantId)||!valid(op.storeId)||!valid(op.bindingId)||
   !valid(op.conversationId)||!valid(op.pageRef)||!valid(op.appRef)||
   !['pass_thread_control','take_thread_control'].includes(op.expectedMetaEvent)||
   (op.status==='HANDOFF_PENDING'&&op.expectedMetaEvent!=='pass_thread_control')||
   (op.status==='RESUME_PENDING'&&op.expectedMetaEvent!=='take_thread_control')||
   !valid(op.pendingRequestId)||
   !Number.isSafeInteger(op.revision)||op.revision<1)
   return deny('TRUSTED_PENDING_STATE_MISSING');
 if(!receipt||receipt.source!=='QA_SYNTHETIC_META_RAW_HMAC_RECEIPT'||
   receipt.syntheticSignatureVerified!==true||
   receipt.realMetaSignatureVerified!==false ||
   receipt.method!=='META_X_HUB_SIGNATURE_256'||
   receipt.qaOnly!==true||receipt.allowSend!==false ||
   !valid(receipt.receiptId)||!valid(receipt.eventId)||
   receipt.eventId!==input.receiptRef ||
   !Number.isSafeInteger(receipt.occurredAtMs)||
   receipt.occurredAtMs>now+10000||now-receipt.occurredAtMs>MAX_AGE_MS)
   return deny('META_RAW_RECEIPT_UNTRUSTED');
 if(receipt.pageRef!==op.pageRef||
   receipt.appRef!==op.appRef||receipt.bindingId!==op.bindingId||
   receipt.tenantId!==op.tenantId||receipt.storeId!==op.storeId||
   receipt.conversationId!==op.conversationId||
   receipt.pendingRequestId!==op.pendingRequestId||
   receipt.eventType!==op.expectedMetaEvent||
   receipt.threadOwnerConfirmed!==true)
   return deny('META_PAGE_THREAD_OR_TRANSITION_MISMATCH');
 // A future live implementation will use a database unique constraint and
 // event-ID replay ledger. This synthetic adapter is a fixture-only reservation.
 let isNew;
 try {isNew=await deps.reserveQaReplay({
   bindingId:op.bindingId,eventId:receipt.eventId,
   transitionRef:op.pendingRef,ttlMs:24*3600*1000
 });} catch {return deny('REPLAY_STORAGE_UNAVAILABLE');}
 if(isNew!==true)return deny('REPLAY_OR_CONFLICT');
 return Object.freeze({
   offlineEligible:true,stage:'QA_META_HANDOVER_ACK_CANDIDATE_ONLY',
   relatedPendingRef:op.pendingRef,expectedRevision:op.revision,
   noSend:true,canCommitState:false,canReleaseBot:false,
   hostedWrite:false,realProviderVerified:false,
   requiresRealMetaHmac:true,requiresRealPageAuthority:true,
   requiresDurableCas:true,requiresIndependentHumanApproval:true
 });
}
