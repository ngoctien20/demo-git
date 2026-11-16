'use strict';
/*
 * V15.2-ADV.6 — Fail-closed, server-injected verified identity contract.
 * NOT a JWT parser. Cryptographic JWT and provider webhook verification MUST be
 * injected from an approved server SDK/adapter. No browser-asserted role/owner
 * flags may authorize actions. There is no network, secret, or hosted access here.
 */
const crypto=require('node:crypto');
const VERSION='T404_VERIFIED_IDENTITY_GATE_V1';
const CHANNELS=Object.freeze(['MESSENGER','ZALO_BOT','ZALO_OA','WEB_WIDGET']);
const ACTIONS=Object.freeze(['CATALOG','QUOTE','ORDER_REQUEST','ASK_STAFF','POLICY']);
const isPlain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
const exact=(x,keys)=>isPlain(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
const id=x=>typeof x==='string'&&x.length>0&&x.length<=128&&/^[A-Za-z0-9_:./-]+$/.test(x);
const digest=x=>crypto.createHash('sha256').update('TIEN404:IDENTITY:v1:').update(x).digest('hex');
const fail=reason=>{throw Error(reason)};
function createIdentityConnector({
 verifyJwt,lookupActiveSession,lookupStoreMembership,
 verifyWebhook,lookupChannelBinding,lookupConsent,recheckConsent,
 expectedIssuer,expectedAudience='authenticated',clock=()=>Date.now()
}={}){
 if(![verifyJwt,lookupActiveSession,lookupStoreMembership,verifyWebhook,
   lookupChannelBinding,lookupConsent,recheckConsent,clock].every(x=>typeof x==='function')||
   !id(expectedIssuer)||!id(expectedAudience))fail('IDENTITY_DEPENDENCIES_MISSING');
 const current=()=>{const t=clock();if(!Number.isSafeInteger(t)||t<0)fail('IDENTITY_CLOCK_INVALID');return t};
 const targetOk=t=>exact(t,['tenant_id','store_id','channel'])&&id(t.tenant_id)&&
   id(t.store_id)&&CHANNELS.includes(t.channel);
 async function verifiedOwner(request){
   if(!exact(request,['mode','accessToken','target'])||
      !targetOk(request.target)||typeof request.accessToken!=='string'||
      request.accessToken.length>8192||request.accessToken.length<12)
     fail('OWNER_JWT_REQUEST_INVALID');
   // Only the injected verifier may return claims. Untrusted JWT decode, browser
   // "verified":true, user_metadata, or a model-supplied role are never used.
   const claims=await verifyJwt(request.accessToken);
   if(!isPlain(claims)||!id(claims.sub)||claims.iss!==expectedIssuer||
     claims.aud!==expectedAudience||claims.role!=='authenticated'||
     claims.is_anonymous!==false||!id(claims.session_id)||
     !Number.isSafeInteger(claims.exp)||claims.exp*1000<=current())
     fail('JWT_CLAIMS_DENIED');
   const active=await lookupActiveSession({user_id:claims.sub,session_id:claims.session_id});
   if(active!==true)fail('SESSION_INACTIVE');
   const target=request.target;
   const m=await lookupStoreMembership({user_id:claims.sub,
     tenant_id:target.tenant_id,store_id:target.store_id});
   if(!isPlain(m)||m.user_id!==claims.sub||m.tenant_id!==target.tenant_id||
      m.store_id!==target.store_id||m.status!=='active'||
      !['owner','manager','staff'].includes(m.role))
     fail('STORE_OWNER_MEMBERSHIP_NOT_VERIFIED');
   return Object.freeze({
      tenant_id:target.tenant_id,store_id:target.store_id,
      channel:target.channel,subject_id:'owner:'+claims.sub,
      recipient_binding:digest([claims.iss,claims.sub,claims.session_id,target.channel].join('|')),
      auth_source:'SERVER_VERIFIED_JWT_OR_CHANNEL_BINDING'
   });
 }
 async function verifiedWebhook(request){
   if(!exact(request,['mode','channel','rawBody','headers'])||
      !CHANNELS.includes(request.channel)||request.channel==='WEB_WIDGET'||
      !Buffer.isBuffer(request.rawBody)||request.rawBody.length===0||
      request.rawBody.length>262144||!isPlain(request.headers))
      fail('WEBHOOK_ENVELOPE_INVALID');
   // verifyWebhook MUST do provider-specific cryptographic HMAC/signature checks
   // over EXACT raw body and use a pinned application identity.
   const event=await verifyWebhook({
      channel:request.channel,rawBody:request.rawBody,headers:request.headers
   });
   if(!exact(event,['channel','account_id','subject_hash','event_id','occurred_at_ms'])||
      event.channel!==request.channel||!id(event.account_id)||
      !/^[a-f0-9]{64}$/.test(event.subject_hash)||!id(event.event_id)||
      !Number.isSafeInteger(event.occurred_at_ms)||
      Math.abs(current()-event.occurred_at_ms)>300000)
      fail('VERIFIED_PROVIDER_EVENT_REQUIRED');
   const b=await lookupChannelBinding({channel:event.channel,account_id:event.account_id});
   if(!isPlain(b)||b.channel!==event.channel||b.account_id!==event.account_id||
      !id(b.tenant_id)||!id(b.store_id)||b.status!=='active'||
      b.merchant_consent!==true)
      fail('CHANNEL_OWNERSHIP_NOT_VERIFIED');
   const c=await lookupConsent({tenant_id:b.tenant_id,store_id:b.store_id,
     channel:event.channel,subject_hash:event.subject_hash});
   if(!isPlain(c)||c.tenant_id!==b.tenant_id||c.store_id!==b.store_id||
      c.channel!==event.channel||c.subject_hash!==event.subject_hash||
      c.consent!==true)
      fail('CUSTOMER_CONSENT_REQUIRED');
   return Object.freeze({
      tenant_id:b.tenant_id,store_id:b.store_id,channel:event.channel,
      subject_id:'channel:'+event.subject_hash,
      recipient_binding:digest([event.channel,event.account_id,event.subject_hash].join('|')),
      auth_source:'SERVER_VERIFIED_JWT_OR_CHANNEL_BINDING'
   });
 }
 async function resolveVerifiedContext(request){
   if(!isPlain(request)||!['OWNER_JWT','CHANNEL_WEBHOOK'].includes(request.mode))
      fail('UNTRUSTED_IDENTITY_CONTEXT');
   return request.mode==='OWNER_JWT'?verifiedOwner(request):verifiedWebhook(request);
 }
 async function authorize({phase,principal,action,resource_ref}={}){
   if(!['ISSUE','CONSUME'].includes(phase)||!ACTIONS.includes(action)||
      !exact(principal,['tenant_id','store_id','channel','subject_id','recipient_binding','auth_source'])||
      principal.auth_source!=='SERVER_VERIFIED_JWT_OR_CHANNEL_BINDING'||
      !id(principal.tenant_id)||!id(principal.store_id)||!CHANNELS.includes(principal.channel)||
      !id(principal.subject_id)||!id(principal.recipient_binding)||
      (resource_ref!==null&&resource_ref!==undefined&&!id(resource_ref)))return false;
   if(principal.subject_id.startsWith('owner:')){
     const user=principal.subject_id.slice(6);
     const m=await lookupStoreMembership({user_id:user,
        tenant_id:principal.tenant_id,store_id:principal.store_id});
     return isPlain(m)&&m.user_id===user&&m.tenant_id===principal.tenant_id&&
        m.store_id===principal.store_id&&m.status==='active'&&
        ['owner','manager','staff'].includes(m.role);
   }
   if(principal.subject_id.startsWith('channel:')){
     return (await recheckConsent({tenant_id:principal.tenant_id,
       store_id:principal.store_id,channel:principal.channel,
       subject_hash:principal.subject_id.slice(8),
       recipient_binding:principal.recipient_binding,
       action,phase}))===true;
   }
   return false;
 }
 return Object.freeze({VERSION,resolveVerifiedContext,authorize});
}
module.exports=Object.freeze({VERSION,createIdentityConnector});