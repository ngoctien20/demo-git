'use strict';
/*
 * TIEN404 V15.2-ADV.6C-RPC.1 -- synthetic trusted channel ingress
 * and OWNER_PAIRING_CLAIM one-time capability CANDIDATE.
 *
 * Separate security domain from ADV.5 ACTION_V1 and ADV.3 Ed25519 previews.
 * NO endpoint, SQL runner, direct RPC, network, credential access, model call,
 * provider send, or hosted mutation. A successful claim returns a review-only
 * plan, NEVER invokes the historical SECURITY DEFINER RPC.
 *
 * Provider signature, canonical account->Store mapping, owner consent, pairing
 * challenge validity and durable event+nonce claims MUST be implemented as
 * independent authorized backend ports before any actual deployment.
 */
const crypto=require('node:crypto');
const CONTRACT='T404_RPC1_TRUSTED_CHANNEL_PAIRING_CAPABILITY_V1';
const TOKEN_PREFIX='tp1';
const ACTION='OWNER_PAIRING_CLAIM';
const CHANNELS=new Set(['MESSENGER','ZALO_BOT','ZALO_OA']);
const CLOCK_SKEW=10_000;
const MAX_TTL=120_000;
const safe=x=>typeof x==='string'&&x.length>0&&x.length<=128&&/^[A-Za-z0-9:_./-]+$/.test(x);
const isObj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
const exact=(x,keys)=>isObj(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
const sha=x=>crypto.createHash('sha256').update('TIEN404:RPC1:').update(x).digest('hex');
const fail=c=>{const e=new Error(c);e.code=c;throw e;};
const CLAIM_KEYS=['v','kid','jti','iat','exp','channel','account_id','event_hash',
 'subject_hash','tenant_id','store_id','bot_id','challenge_ref','action'];
function createTrustedPairingGateway({
 mode,signerKey,kid,clock=()=>Date.now(),verifyProviderEvent,
 lookupTrustedChannelBinding,checkMerchantConsent,verifyOwnerChallenge,
 claimInboundEventOnce,claimCapabilityOnce
}={}){
 if(mode!=='SYNTHETIC_NO_SEND'||!Buffer.isBuffer(signerKey)||
    signerKey.length<32||!safe(kid)||kid.length>40||
    [clock,verifyProviderEvent,lookupTrustedChannelBinding,
     checkMerchantConsent,verifyOwnerChallenge,claimInboundEventOnce,
     claimCapabilityOnce].some(x=>typeof x!=='function'))
    fail('TRUSTED_PRIVATE_GATEWAY_PORTS_REQUIRED');
 const key=Buffer.from(signerKey);
 const now=()=>{const n=clock();if(!Number.isSafeInteger(n)||n<0)fail('CLOCK_INVALID');return n};
 const sign=payload=>crypto.createHmac('sha256',key)
   .update('TIEN404:RPC1:PAIR:v1:').update(payload).digest();
 async function inspect({channel,rawBody,headers}={}){
   if(!CHANNELS.has(channel)||!Buffer.isBuffer(rawBody)||
      rawBody.length<2||rawBody.length>131072||
      !isObj(headers)||Object.keys(headers).length>48)
      fail('UNTRUSTED_PROVIDER_ENVELOPE');
   // This port MUST validate the official provider signature over original
   // raw bytes. A HTTP header secret or a boolean sent by a user is NOT proof.
   const e=await verifyProviderEvent({channel,rawBody,headers});
   if(!exact(e,['channel','account_id','event_id','subject_hash','occurred_at_ms'])||
      e.channel!==channel||!safe(e.account_id)||!safe(e.event_id)||
      typeof e.subject_hash!=='string'||!/^[a-f0-9]{64}$/.test(e.subject_hash)||
      !Number.isSafeInteger(e.occurred_at_ms)||
      Math.abs(now()-e.occurred_at_ms)>300000)
      fail('PROVIDER_SIGNATURE_OR_EVENT_UNVERIFIED');
   const b=await lookupTrustedChannelBinding({
     channel:e.channel,account_id:e.account_id
   });
   if(!exact(b,['channel','account_id','tenant_id','store_id','bot_id','status'])||
     b.channel!==channel||b.account_id!==e.account_id||
     !safe(b.tenant_id)||!safe(b.store_id)||!safe(b.bot_id)||
     b.status!=='active')
     fail('CANONICAL_CHANNEL_STORE_BINDING_REQUIRED');
   const consent=await checkMerchantConsent({
     tenant_id:b.tenant_id,store_id:b.store_id,bot_id:b.bot_id,
     subject_hash:e.subject_hash,channel
   });
   if(consent!==true)fail('OWNER_CONSENT_UNVERIFIED');
   return Object.freeze({
     channel,account_id:e.account_id,event_id:e.event_id,
     subject_hash:e.subject_hash,occurred_at_ms:e.occurred_at_ms,
     tenant_id:b.tenant_id,store_id:b.store_id,bot_id:b.bot_id,
     event_hash:sha([channel,e.account_id,e.event_id,
       e.subject_hash,b.tenant_id,b.store_id,b.bot_id].join('|'))
   });
 }
 async function checkChallenge(ctx,challenge_ref,challenge_proof){
   if(!safe(challenge_ref)||typeof challenge_proof!=='string'||
     !/^[a-f0-9]{32}$/.test(challenge_proof))
     fail('PAIRING_CHALLENGE_INPUT_INVALID');
   // The server checks TTL, challenge Store/owner linkage, and digest in an
   // independent DB transaction. "verified:true" is never a caller claim.
   const ok=await verifyOwnerChallenge({
      tenant_id:ctx.tenant_id,store_id:ctx.store_id,bot_id:ctx.bot_id,
      subject_hash:ctx.subject_hash,challenge_ref,challenge_proof
   });
   if(ok!==true)fail('OWNER_PAIRING_PROOF_DENIED');
 }
 async function issueCandidate({envelope,challenge_ref,challenge_proof,
    ttlMs=60_000}={}){
   if(!Number.isSafeInteger(ttlMs)||ttlMs<1000||ttlMs>MAX_TTL)
     fail('PAIRING_CAPABILITY_TTL_INVALID');
   const ctx=await inspect(envelope);
   await checkChallenge(ctx,challenge_ref,challenge_proof);
   // Atomic durable claim: same provider event must not issue multiple
   // capabilities, even across horizontally scaled gateway instances.
   if(await claimInboundEventOnce(
      sha('INBOUND|'+ctx.event_hash),now()+600000)!==true)
      fail('PROVIDER_EVENT_REPLAY_OR_LEDGER_UNAVAILABLE');
   const iat=now(),exp=iat+ttlMs;
   const data={
     v:CONTRACT,kid,jti:crypto.randomBytes(18).toString('hex'),
     iat,exp,channel:ctx.channel,account_id:ctx.account_id,
     event_hash:ctx.event_hash,subject_hash:ctx.subject_hash,
     tenant_id:ctx.tenant_id,store_id:ctx.store_id,bot_id:ctx.bot_id,
     challenge_ref,action:ACTION
   };
   const compact=Buffer.from(JSON.stringify(data)).toString('base64url');
   const mac=sign(compact).toString('base64url');
   return Object.freeze({
     status:'PAIRING_CAPABILITY_PREVIEW_ONLY',contract:CONTRACT,
     token:TOKEN_PREFIX+'.'+compact+'.'+mac,
     expiresAt:exp,action:ACTION,tenant_id:ctx.tenant_id,
     store_id:ctx.store_id,providerSent:false,dbWrites:0,
     legacyRpcInvoked:false,liveAuthorized:false
   });
 }
 async function verifyAndClaimPreview({envelope,token,challenge_proof}={}){
   if(typeof token!=='string'||token.length>2500||
      !/^tp1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token))
      fail('PAIRING_TOKEN_MALFORMED');
   const [,body,mac]=token.split('.');
   const expected=sign(body),got=Buffer.from(mac,'base64url');
   if(got.length!==expected.length||
      got.toString('base64url')!==mac||
      !crypto.timingSafeEqual(got,expected))
      fail('PAIRING_CAPABILITY_BAD_SIGNATURE');
   let data;
   try{
      const bytes=Buffer.from(body,'base64url');
      if(bytes.toString('base64url')!==body)
        fail('PAIRING_CAPABILITY_NONCANONICAL');
      data=JSON.parse(bytes.toString('utf8'));
   }catch{fail('PAIRING_CAPABILITY_CLAIMS_INVALID')}
   if(!exact(data,CLAIM_KEYS)||data.v!==CONTRACT||
      data.action!==ACTION||data.kid!==kid||
      !safe(data.jti)||!safe(data.channel)||!CHANNELS.has(data.channel)||
      !safe(data.account_id)||!safe(data.tenant_id)||
      !safe(data.store_id)||!safe(data.bot_id)||
      !safe(data.challenge_ref)||!/^[a-f0-9]{64}$/.test(data.subject_hash||'')||
      !/^[a-f0-9]{64}$/.test(data.event_hash||'')||
      !Number.isSafeInteger(data.iat)||!Number.isSafeInteger(data.exp)||
      data.exp-data.iat<1000||data.exp-data.iat>MAX_TTL||
      data.iat>now()+CLOCK_SKEW||data.exp<=now())
      fail('PAIRING_CAPABILITY_CLAIMS_INVALID');
   // Revalidate signature, binding, current consent and challenge on consume.
   const ctx=await inspect(envelope);
   for(const k of ['channel','account_id','tenant_id','store_id','bot_id',
     'subject_hash','event_hash']){
     if(data[k]!==ctx[k])fail('PAIRING_SCOPE_OR_EVENT_MISMATCH');
   }
   await checkChallenge(ctx,data.challenge_ref,challenge_proof);
   if(data.exp<=now())fail('PAIRING_CAPABILITY_EXPIRED');
   if(await claimCapabilityOnce(
     sha('CAPABILITY|'+data.tenant_id+'|'+data.store_id+'|'+data.jti),
     data.exp+MAX_TTL)!==true)
     fail('PAIRING_CAPABILITY_REPLAY_OR_LEDGER_UNAVAILABLE');
   return Object.freeze({
     contract:CONTRACT,status:'SIGNED_CAPABILITY_CLAIMED_NO_DB_WRITE',
     action:ACTION,scope:{tenant_id:ctx.tenant_id,
       store_id:ctx.store_id,bot_id:ctx.bot_id,channel:ctx.channel},
     eventHash:ctx.event_hash,nonceClaimedSynthetic:true,
     productionNonceCertified:false,hostedOwnerVerified:false,
     legacyRpcInvoked:false,orderCreated:false,dbWrites:0,
     providerSent:false,executionAllowed:false
   });
 }
 return Object.freeze({
   CONTRACT,issueCandidate,verifyAndClaimPreview,
   callLegacyRpc(){fail('PUBLIC_SECURITY_DEFINER_RPC_DISABLED_IN_GATEWAY')},
   executePrivateClaim(){fail('PRIVATE_PAIRING_WRITER_REQUIRES_HOSTED_APPROVAL')},
   runSql(){fail('ARBITRARY_SQL_DISABLED')},
   publish(){fail('PUBLISH_APPROVAL_REQUIRED')},
   send(){fail('PROVIDER_SEND_DISABLED')}
 });
}
module.exports=Object.freeze({CONTRACT,ACTION,createTrustedPairingGateway});