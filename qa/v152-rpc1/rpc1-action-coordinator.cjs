'use strict';
/*
 * TIEN404 RPC.1 -- channel-neutral NO-SEND dispatch over existing ADV.6
 * canonical signed action gateway and the separately-scoped pairing gateway.
 * Never reuse a commerce action signature for an owner-pairing privilege.
 * This is NOT a production HTTP endpoint, no network or database.
 */
const VERSION='T404_RPC1_NO_SEND_ACTION_COORDINATOR_V1';
const ACTIONS=new Set(['CATALOG','QUOTE','ORDER_REQUEST','ASK_STAFF','POLICY']);
const fail=code=>{const e=new Error(code);e.code=code;throw e};
function createRpc1ActionCoordinator({mode,pairing,canonical}={}){
 if(mode!=='SYNTHETIC_NO_SEND'||
    !pairing||typeof pairing.issueCandidate!=='function'||
    typeof pairing.verifyAndClaimPreview!=='function'||
    !canonical||typeof canonical.issuePreview!=='function'||
    typeof canonical.verifyPreview!=='function')
    fail('RPC1_GATEWAYS_UNVERIFIED');
 async function issue({action,request,resource_ref=null}={}){
   if(action==='OWNER_PAIRING_CLAIM'){
     if(resource_ref!==null||!request||!request.envelope)
       fail('PAIRING_ENVELOPE_REQUIRED');
     return pairing.issueCandidate(request);
   }
   if(!ACTIONS.has(action))fail('ACTION_NOT_ALLOWLISTED');
   const c=await canonical.issuePreview({
     request,action,resource_ref,ttlMs:60000
   });
   if(c?.issueStatus!=='SIGNED_RECEIPT_PREVIEW_ONLY'||
      c.orderCreated!==false||c.channelSent!==false||
      c.liveAuthorized!==false)
     fail('CANONICAL_GATEWAY_PREVIEW_INVARIANT_FAILED');
   return Object.freeze({
     contract:VERSION,action,status:'CANONICAL_ACTION_PREVIEW_ONLY',
     capability:c.receipt,hostedWrites:0,providerSends:0,
     orderCreated:false,liveAuthorized:false
   });
 }
 async function verify({action,request,token,challenge_proof}={}){
   if(action==='OWNER_PAIRING_CLAIM'){
     if(!request?.envelope)fail('PAIRING_ENVELOPE_REQUIRED');
     return pairing.verifyAndClaimPreview({
       envelope:request.envelope,token,challenge_proof
     });
   }
   if(!ACTIONS.has(action))fail('ACTION_NOT_ALLOWLISTED');
   const r=await canonical.verifyPreview({request,token});
   if(r?.status!=='VERIFIED_CLAIMED_NO_EXECUTION'||
      r.actionExecutable!==false||r.orderCreated!==false||
      r.providerSends!==0||r.hostedWrites!==0||
      r.liveAuthorized!==false||r.action!==action)
      fail('CANONICAL_GATEWAY_CLAIM_INVARIANT_FAILED');
   return Object.freeze({
      contract:VERSION,status:'CANONICAL_ACTION_VERIFIED_NO_EXECUTION',
      action,scope:r.scope,hostedWrites:0,providerSends:0,
      orderCreated:false,liveAuthorized:false
   });
 }
 return Object.freeze({
   VERSION,issue,verify,
   sql(){fail('ARBITRARY_SQL_DISABLED')},
   execute(){fail('BUSINESS_EXECUTION_DISABLED')},
   send(){fail('PROVIDER_SEND_DISABLED')},
   publish(){fail('PUBLISH_APPROVAL_REQUIRED')}
 });
}
module.exports=Object.freeze({VERSION,createRpc1ActionCoordinator});