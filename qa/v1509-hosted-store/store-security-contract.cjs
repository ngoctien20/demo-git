'use strict';
/**
 * V15.0-09 — synthetic authorization DECISION MODEL, not an RLS substitute.
 * No Supabase, n8n, Meta/Zalo, DB, provider, AI, network or billing access.
 * This offline proof MUST NOT be used as trusted identity production code.
 * In production identity/ownership must come from backend + real auth JWT/RLS.
 */
const {createHash}=require('node:crypto');
const CHANNELS=new Set(['messenger','zalo_bot','zalo_oa','web_widget']);
const CAPS=Object.freeze({
  catalog_read:['owner','manager','staff'],
  price_quote:['owner','manager','staff'],
  order_status_read:['owner','manager'],
  owner_report_read:['owner','manager'],
  order_request_draft:['owner','manager','staff']
});
const REASON=Object.freeze({
 INVALID:'INVALID_OFFLINE_INPUT',
 DEPENDENCY:'AUTHORITATIVE_BACKEND_REQUIRED',
 CLIENT:'CLIENT_IDENTITY_CLAIM_FORBIDDEN',
 EVENT:'PROVIDER_EVENT_NOT_VERIFIED',
 SCOPE:'CANONICAL_TENANT_STORE_MISMATCH',
 MEMBERSHIP:'STORE_MEMBERSHIP_NOT_VERIFIED',
 OWNER:'OWNER_CONSENT_NOT_VERIFIED',
 POLICY:'STORE_POLICY_NOT_ACTIVE',
 CAPABILITY:'STORE_CAPABILITY_DENIED',
 REPLAY:'DURABLE_REPLAY_NOT_CERTIFIED'
});
function deny(reason){
 return Object.freeze({status:'BLOCKED',reason,classification:'OFFLINE_SECURITY_MODEL_ONLY',
   can_send:false,can_read_hosted:false,can_write_orders:false,
   provider_sends:0,hosted_reads:0,hosted_writes:0,model_calls:0});
}
function safeId(x){return typeof x==='string'&&/^[A-Za-z0-9_:-]{3,100}$/.test(x);}
function plain(x){return x&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;}
async function planStoreScope(event,{resolveTrustedEvent,readCanonicalEvidence,clock=Date.now}={}){
 if(!plain(event)||typeof resolveTrustedEvent!=='function'||typeof readCanonicalEvidence!=='function'||typeof clock!=='function')
   return deny(REASON.DEPENDENCY);
 if(!safeId(event.event_id)||!CHANNELS.has(event.channel)||!Object.hasOwn(CAPS,event.capability))
   return deny(REASON.INVALID);
 // Never accept client-supplied identity or entitlement, even if it happens to match.
 const forbidden=['tenant_id','store_id','owner_id','role','user_id','channel_binding_id',
   'provider_account_id','provider_bot_id','subscription_active','can_send','capabilities'];
 if(forbidden.some(k=>Object.hasOwn(event,k)))return deny(REASON.CLIENT);
 let proof,evidence;
 try{
   proof=await resolveTrustedEvent({eventId:event.event_id,channel:event.channel});
   if(!plain(proof)||proof.source!=='OFFLINE_BACKEND_EVENT_ATTESTATION'||
     proof.environment!=='qa_staging'||proof.eventId!==event.event_id||
     proof.channel!==event.channel||proof.authenticated!==true||
     !safeId(proof.authUserId)||!safeId(proof.tenantId)||!safeId(proof.storeId)||
     !safeId(proof.bindingId)||!safeId(proof.providerAccountRef)||
     !safeId(proof.providerBotRef)||!safeId(proof.conversationId)||
     !safeId(proof.policyVersion)||!safeId(proof.replayKey)||
     proof.providerSignatureVerified!==true||proof.expiresAtMs<=clock())
      return deny(REASON.EVENT);
   evidence=await readCanonicalEvidence({authUserId:proof.authUserId,
     tenantId:proof.tenantId,storeId:proof.storeId,bindingId:proof.bindingId,
     channel:proof.channel,capability:event.capability});
 }catch{return deny(REASON.DEPENDENCY)}
 if(!plain(evidence)||evidence.source!=='OFFLINE_CANONICAL_ROWS_SNAPSHOT'||
    evidence.authUserExists!==true||evidence.tenantExists!==true||
    evidence.storeExists!==true||evidence.tenantId!==proof.tenantId||
    evidence.storeId!==proof.storeId||evidence.storeTenantId!==proof.tenantId)
    return deny(REASON.SCOPE);
 if(evidence.tenantMembershipActive!==true||evidence.storeMembershipActive!==true||
    evidence.membershipUserId!==proof.authUserId||
    evidence.membershipTenantId!==proof.tenantId||
    evidence.membershipStoreId!==proof.storeId||
    !CAPS[event.capability].includes(evidence.role))
    return deny(REASON.MEMBERSHIP);
 if(evidence.bindingId!==proof.bindingId||evidence.channel!==proof.channel||
    evidence.providerAccountRef!==proof.providerAccountRef||
    evidence.providerBotRef!==proof.providerBotRef||
    evidence.ownerConsentVerified!==true||evidence.ownerConsentExpiresAtMs<=clock())
    return deny(REASON.OWNER);
 if(evidence.storeStatus!=='active'||evidence.subscriptionActive!==true||
    evidence.policyVersion!==proof.policyVersion||evidence.bindingRevoked===true||
    evidence.tenantRevoked===true||evidence.storeRevoked===true)
    return deny(REASON.POLICY);
 if(evidence.allowedCapabilities?.includes(event.capability)!==true)
    return deny(REASON.CAPABILITY);
 if(evidence.durableReplayStatus!=='FRESH_VERIFIED')
    return deny(REASON.REPLAY);
 const scopeRef=createHash('sha256').update(JSON.stringify({
   tenant:proof.tenantId,store:proof.storeId,channel:proof.channel,
   account:proof.providerAccountRef,bot:proof.providerBotRef,
   conversation:proof.conversationId,capability:event.capability
 })).digest('hex');
 return Object.freeze({status:'SYNTHETIC_POLICY_ELIGIBLE_NOT_HOSTED',
   classification:'OFFLINE_SECURITY_MODEL_ONLY',capability:event.capability,
   scope_ref:scopeRef,tenant_store_pair_valid:true,
   next_gate:event.capability==='order_request_draft'
     ?'USER_CONFIRMATION_AND_BACKEND_ORDER_GATE':'HOSTED_RLS_AND_AUTHENTICATED_READ_QA',
   can_send:false,can_read_hosted:false,can_write_orders:false,
   provider_sends:0,hosted_reads:0,hosted_writes:0,model_calls:0});
}
module.exports={planStoreScope,REASON,CHANNELS,CAPS};
