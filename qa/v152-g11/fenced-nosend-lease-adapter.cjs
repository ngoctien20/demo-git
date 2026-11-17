'use strict';
/**
 * TIEN404 G0.11 — SOURCE-ONLY fail-closed lease finalization for an approved
 * isolated Meta QA handler. Does NOT connect to a DB or Meta, send messages,
 * store customer content, or verify real Page/Store ownership.
 *
 * The caller must inject the pinned V17.1E handler AFTER independent
 * private authority checks from G0.9. Repository is a private least-privilege
 * adapter for the separately reviewed disposable-PG17 function contract.
 *
 * A received event is NOT "done" until completeNoSend() persists success.
 * Live SEND is unsupported. SEND_UNCERTAIN is held for human reconciliation;
 * no automatic retry or exactly-once provider delivery claim.
 */
const crypto=require('node:crypto');
const CONTRACT='T404_G11_NO_SEND_LEASE_CUTOVER_CANDIDATE_V1';
const REFERENCE='T404_V171E_ISOLATED_SIGNED_NOSEND_V1';
const DIGEST=/^[0-9a-f]{64}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PAGE=/^[A-Za-z0-9_-]{6,100}$/;
const err=()=>{throw Error('G11_PRIVATE_LEASE_CLAIM_REFUSED')};
const failure=(why='LEASE_OR_FINALIZATION_UNCONFIRMED')=>Object.freeze({
 contract:REFERENCE,status:'BLOCKED',reason:why,http_status:503,
 meta_outbound:0,model_calls:0,commerce_writes:0,
 canSend:false,canReadRealCommerce:false,canCreateOrders:false,
 releaseStatus:'HOSTED_NO_GO'
});
const mac=(key,label,bytes)=>crypto.createHmac('sha256',key)
 .update(Buffer.from('t404-g11-private-nosend-v1\u0000'+label+'\u0000'))
 .update(bytes).digest();
function createLeaseBridge({repository,replayPepper,installationRef,rawBody,
 leaseSeconds=45}={}){
 if(!repository||typeof repository.acquireNoSend!=='function'||
    typeof repository.completeNoSend!=='function'||
    typeof repository.markSendUncertain!=='function'||
    !Buffer.isBuffer(replayPepper)||replayPepper.length<32||
    replayPepper.length>128||
    typeof installationRef!=='string'||!PAGE.test(installationRef)||
    !Buffer.isBuffer(rawBody)||rawBody.length<1||rawBody.length>32768||
    !Number.isSafeInteger(leaseSeconds)||leaseSeconds<5||leaseSeconds>300)err();
 const installationDigest=mac(replayPepper,'installation',Buffer.from(installationRef));
 const payloadDigest=mac(replayPepper,'payload',rawBody);
 let lease=null,claimAttempted=false,finalized=false;
 async function claimOnce(receiptId){
  if(claimAttempted||typeof receiptId!=='string'||!DIGEST.test(receiptId))err();
  claimAttempted=true;
  const eventDigest=mac(replayPepper,'event',Buffer.from(receiptId,'ascii'));
  let answer;
  try{
   answer=await repository.acquireNoSend({
    provider:'MESSENGER',installationDigest:Buffer.from(installationDigest),
    eventDigest:Buffer.from(eventDigest),payloadDigest:Buffer.from(payloadDigest),
    leaseSeconds
   });
  }catch{err();}
  if(!answer||typeof answer!=='object'||Array.isArray(answer))err();
  if(answer.disposition==='done')return 'duplicate';
  if(answer.disposition==='claimed'||answer.disposition==='reclaimed'){
   if(typeof answer.workerToken!=='string'||!UUID.test(answer.workerToken)||
      !Number.isSafeInteger(answer.attempt)||answer.attempt<1)err();
   lease={eventDigest,workerToken:answer.workerToken};
   return 'claimed'; // V17.1E only knows claimed/duplicate.
  }
  // leased, conflict, manual_review, DB timeout or unknown: fail closed.
  err();
 }
 async function finishNoSend(){
  if(!lease||finalized)err();
  let result;
  try{
   result=await repository.completeNoSend({
    provider:'MESSENGER',installationDigest:Buffer.from(installationDigest),
    eventDigest:Buffer.from(lease.eventDigest),workerToken:lease.workerToken
   });
  }catch{err();}
  if(result!=='completed')err();
  finalized=true;
  lease=null;
  return 'completed';
 }
 // This method is for audit-only tests of an irreversible send boundary.
 // The G0.11 No-Send orchestrator never calls it and never sends anything.
 async function flagUncertainForReview(){
  if(!lease||finalized)err();
  let result;
  try{
   result=await repository.markSendUncertain({
    provider:'MESSENGER',installationDigest:Buffer.from(installationDigest),
    eventDigest:Buffer.from(lease.eventDigest),workerToken:lease.workerToken
   });
  }catch{err();}
  if(result!=='manual_review')err();
  lease=null;
  return 'manual_review';
 }
 return Object.freeze({claimOnce,finishNoSend,flagUncertainForReview});
}
async function processPinnedNoSend({
 request,privateConfig,pinnedHandler,repository,replayPepper,
 installationRef,clock=()=>Date.now()
}={}){
 if(!request||typeof request!=='object'||Object.keys(request).sort().join(',')!=='headers,method,rawBody,url'||
    request.method!=='POST'||!Buffer.isBuffer(request.rawBody)||
    !privateConfig||typeof privateConfig!=='object'||
    typeof pinnedHandler!=='function'||typeof clock!=='function')
  return failure('PINNED_PROVIDER_OR_PRIVATE_CONTEXT_MISSING');
 let lease;
 try{
  lease=createLeaseBridge({repository,replayPepper,installationRef,rawBody:request.rawBody});
 }catch{return failure('PRIVATE_LEASE_REPOSITORY_NOT_READY')}
 let signed;
 try{
  // The pinned V17.1E callback authenticates Meta HMAC, Page, tester, MID,
  // timestamp before invoking claimOnce. This source never replaces verifier.
  signed=await pinnedHandler(request,{...privateConfig,claimOnce:lease.claimOnce},clock);
 }catch{return failure('PINNED_META_HANDLER_EXCEPTION')}
 if(!signed||signed.contract!==REFERENCE||signed.meta_outbound!==0||
   signed.model_calls!==0||signed.commerce_writes!==0)
  return failure('PINNED_HANDLER_CHANGED_OR_UNSAFE');
 if(signed.status==='DUPLICATE_IGNORED')
  return Object.freeze({...signed,canSend:false,canReadRealCommerce:false,
   canCreateOrders:false,releaseStatus:'HOSTED_NO_GO'});
 if(signed.status!=='SIGNED_QA_EVENT_NO_SEND'||signed.http_status!==200||
    signed.mock_outbound!=='NO_SEND')return failure('SIGNED_EVENT_DENIED_OR_IN_PROGRESS');
 try{await lease.finishNoSend()}
 catch{return failure('NO_SEND_FINALIZATION_NOT_DURABLE')}
 return Object.freeze({...signed,noSendPersisted:true,
  canSend:false,canReadRealCommerce:false,canCreateOrders:false,
  providerSends:0,ordersWritten:0,stockWritten:0,modelCalls:0,
  releaseStatus:'HOSTED_NO_GO',realProviderUatCompletedHere:false,
  realStoreOwnerAttestedHere:false});
}
module.exports=Object.freeze({CONTRACT,REFERENCE,createLeaseBridge,processPinnedNoSend});
