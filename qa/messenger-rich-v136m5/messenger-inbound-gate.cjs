'use strict';
/**
 * V21 P1 Messenger inbound claim -> synthetic provider outcome gate.
 *
 * SOURCE-ONLY candidate. Built around the existing V13.6M.5 private-event-store
 * contract; never reads a webhook, Supabase, Orders or Meta on its own.
 * Does NOT grant a production send. No HTTP, Meta token, pg or external writes.
 *
 * Fail-closed states:
 *   UNVERIFIED -> never claimed
 *   CLAIM_RESERVED -> only synthetic local analysis, NEVER SEND
 *   DUPLICATE_HOLD -> never execute the event a second time
 *   UNCERTAIN_HOLD -> do not auto-retry, do not finalize
 *   PREVIEW_READY -> synthetic receipts complete, still NEVER SEND
 *
 * This is not hosted RLS, authority, outbox, or exactly-once delivery evidence.
 */
const fail=code=>{const e=new Error(code);e.code=code;throw e;};
const replayRe=/^[a-f0-9]{64}$/;
const psidRe=/^[0-9]{5,30}$/;

function createMessengerInboundGateCandidate({mode='BLOCKED',eventStore}={}){
 if(mode!=='SYNTHETIC_QA_ONLY')fail('INBOUND_GATE_HOSTED_NOT_APPROVED');
 const ready=eventStore?.readiness;
 if(!eventStore||typeof eventStore.claim!=='function'||typeof eventStore.finalize!=='function'||
    ready?.mode!=='SYNTHETIC_SQL_QA_ONLY'||ready?.providerSendEnabled!==false||
    ready?.outboxEnabled!==false||ready?.allowOrderWrites!==false||
    ready?.durableReplayReady!==false)fail('INBOUND_GATE_STORE_NOT_APPROVED');
 const state=new WeakMap();
 function verified(input){
  if(!input || input.source!=='SYNTHETIC_SIGNED_WEBHOOK_QA' ||
     input.rawSignatureVerified!==true || input.timingSafeVerified!==true ||
     input.serverSideResolverVerified!==true || input.entitlementVerified!==true ||
     input.inboundWindowVerified!==true ||
     input.channel!=='messenger' || input.eventKind!=='customer_message' ||
     typeof input.replayKey!=='string' || !replayRe.test(input.replayKey) ||
     !input.trusted || input.trusted.source!=='SERVER_VERIFIED_MESSENGER_BINDING' ||
     input.trusted.serverDerived!==true || input.trusted.verified!==true ||
     !psidRe.test(String(input.trusted.recipientPsid??''))) {
   fail('INBOUND_GATE_UNVERIFIED_PROOF');
  }
  return input;
 }
 async function reserve(input){
  const event=verified(input);
  // Source-only V13.6M.5 independently re-validates tenant, store, Page,
  // sender, binding and HMAC-derived replay identity inside eventStore.claim().
  const receipt=await eventStore.claim({trusted:event.trusted,replayKey:event.replayKey});
  if(!receipt || receipt.providerSendEnabled!==false || receipt.previewOnly!==true)
   fail('INBOUND_GATE_CLAIM_CONTRACT_INVALID');
  if(receipt.status==='DUPLICATE_SUPPRESSED'){
   return Object.freeze({mode:'DUPLICATE_HOLD',sendAllowed:false,
    retryAllowed:false,providerSendEnabled:false,orderWriteAllowed:false});
  }
  if(receipt.status!=='CLAIMED'||receipt.firstSeen!==true)
   fail('INBOUND_GATE_CLAIM_CONTRACT_INVALID');
  const ticket=Object.freeze({mode:'CLAIM_RESERVED_DRY_RUN',
   sendAllowed:false,retryAllowed:false,providerSendEnabled:false,
   orderWriteAllowed:false});
  state.set(ticket,{receipt,phase:'CLAIMED',sender:event.trusted.recipientPsid});
  return ticket;
 }
 function reviewSyntheticOutcome(ticket,{expectedCount,receipts,transport='SYNTHETIC_ACCEPTED'}={}){
  const s=ticket&&state.get(ticket);
  if(!s)fail('INBOUND_GATE_TICKET_UNTRUSTED');
  if(s.phase!=='CLAIMED')fail('INBOUND_GATE_REVIEW_ALREADY_CONSUMED');
  // This gate can inspect already-present mock receipts; it cannot issue sends.
  const validPlan=Number.isSafeInteger(expectedCount)&&expectedCount>=1&&expectedCount<=3;
  const validResponses=Array.isArray(receipts)&&receipts.length===expectedCount &&
    receipts.every(r=>r&&typeof r.message_id==='string'&&r.message_id.trim() &&
       typeof r.recipient_id==='string'&&r.recipient_id===s.sender);
  const ids=Array.isArray(receipts)?receipts.map(r=>r?.message_id):[];
  const unique=new Set(ids).size===ids.length;
  if(transport!=='SYNTHETIC_ACCEPTED'||!validPlan||!validResponses||!unique){
   s.phase='UNCERTAIN_HOLD';
   return Object.freeze({mode:'UNCERTAIN_HOLD',sendAllowed:false,
    retryAllowed:false,finalizeAllowed:false,needsReconciliation:true});
  }
  s.phase='READY_FOR_PREVIEW';
  return Object.freeze({mode:'READY_FOR_PREVIEW_FINALIZE',sendAllowed:false,
   retryAllowed:false,finalizeAllowed:true,syntheticReceiptCount:expectedCount,
   acceptedByMeta:false,delivered:false,read:false});
 }
 async function finalizePreview(ticket){
  const s=ticket&&state.get(ticket);
  if(!s||s.phase!=='READY_FOR_PREVIEW')
   fail('INBOUND_GATE_FINALIZE_NOT_ALLOWED');
  // One local synthetic finalization only; guard concurrent calls before awaits.
  s.phase='FINALIZING';
  try{
   const final=await eventStore.finalize(s.receipt,{status:'PREVIEW_READY'});
   if(!final||final.status!=='PREVIEW_READY'||final.sendEnabled!==false)
     fail('INBOUND_GATE_FINALIZE_RESPONSE_INVALID');
   state.delete(ticket);
   return Object.freeze({mode:'PREVIEW_READY',sendAllowed:false,
    providerSendEnabled:false,retryAllowed:false,orderWriteAllowed:false,
    acceptedByMeta:false,delivered:false});
  }catch(e){
   s.phase='UNCERTAIN_HOLD'; // transaction state must be explicitly reconciled
   throw e;
  }
 }
 return Object.freeze({reserve,reviewSyntheticOutcome,finalizePreview,
  readiness:Object.freeze({mode:'SYNTHETIC_QA_ONLY',
   connectedToLiveMessenger:false,backedByHostedPostgres:false,
   hostedRlsVerified:false,realMetaSendEnabled:false,
   orderWritesEnabled:false,automaticRetryEnabled:false})});
}
module.exports={createMessengerInboundGateCandidate};
