'use strict';
/*
 * V15.2-ADV.6 — Canonical server ACTION GATEWAY CANDIDATE.
 * HMAC V1 (from ADV.5) is the only server receipt contract here.
 * ADV.3 Ed25519 QA signed previews remain a DIFFERENT, non-interoperable
 * contract; never automatically exchange the two.
 *
 * This gateway has NO endpoint, handler, order execution, hosted DB connection,
 * provider dispatch or paid API. It issues and verifies QA receipts ONLY.
 */
const actionRegistry=require('./signed-action-registry.cjs');
const CONTRACT='T404_CANONICAL_ACTION_GATEWAY_CANDIDATE_V1';
const fail=reason=>{throw Error(reason)};
function createCanonicalGateway({identity,nonceStore,keyRing,activeKid,clock,mode}={}){
 if(mode!=='SYNTHETIC_NO_SEND'||!identity||
    typeof identity.resolveVerifiedContext!=='function'||
    typeof identity.authorize!=='function'||!nonceStore||
    typeof nonceStore.claimOnce!=='function')
   fail('LIVE_GATEWAY_AND_UNVERIFIED_DEPENDENCIES_LOCKED');
 const signed=actionRegistry.createRegistry({
   keyRing,activeKid,resolveVerifiedContext:identity.resolveVerifiedContext,
   authorize:identity.authorize,nonceStore,clock
 });
 async function issuePreview({request,action,resource_ref=null,ttlMs=120000}={}){
   const receipt=await signed.issue({request,action,resource_ref,ttlMs});
   return Object.freeze({contract:CONTRACT,mode,
     signedContract:actionRegistry.VERSION,issueStatus:'SIGNED_RECEIPT_PREVIEW_ONLY',
     receipt,ownerProofCertified:false,providerSendAllowed:false,
     orderCreated:false,channelSent:false,liveAuthorized:false});
 }
 async function verifyPreview({request,token}={}){
   const checked=await signed.verifyAndClaim({request,token});
   if(checked.status!=='VERIFIED_CLAIMED_NO_EXECUTION'||
      checked.orderCreated!==false||checked.providerSends!==0||
      checked.hostedWrites!==0)fail('UNEXPECTED_LIVE_ACTION_RESULT');
   return Object.freeze({contract:CONTRACT,mode,
     status:'VERIFIED_CLAIMED_NO_EXECUTION',
     action:checked.action,scope:{tenant_id:checked.tenant_id,
       store_id:checked.store_id,channel:checked.channel},
     nonceClaimed:true,actionExecutable:false,orderCreated:false,
     providerSends:0,hostedWrites:0,liveAuthorized:false});
 }
 return Object.freeze({
   CONTRACT,mode,issuePreview,verifyPreview,
   canPublish:false,canSend:false,canExecute:false,
   send(){fail('PROVIDER_SEND_DISABLED')},
   execute(){fail('BUSINESS_EXECUTION_DISABLED')},
   publish(){fail('PUBLISH_APPROVAL_REQUIRED')}
 });
}
module.exports=Object.freeze({CONTRACT,createCanonicalGateway});