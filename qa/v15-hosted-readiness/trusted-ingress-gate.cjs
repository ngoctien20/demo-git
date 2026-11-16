'use strict';
/**
 * TIEN404 V15.0-03H: SOURCE-ONLY signed synthetic ingress gate.
 * This is NOT a real Meta/Zalo signer, OAuth identity, Supabase Auth session
 * or hosted replay proof. Only accepts TEST FIXTURE provenance and always NO-SEND.
 * Signing keys are generated inside tests; real issuer keys NOT configured.
 */
const {createPublicKey,verify,timingSafeEqual,createHash}=require('node:crypto');
const P256=new Set(['prime256v1']);
const HEX64=/^[0-9a-f]{64}$/;
const B64=/^[A-Za-z0-9_-]{86}$/;
const CHANNELS=new Set(['MESSENGER','ZALO_BOT','ZALO_OA','WEB_WIDGET']);
const accepted=new WeakSet();
const TRUST='SYNTHETIC_SIGNED_BACKEND_CONTEXT_V15';
const SOURCES=Object.freeze({
 channel:'TIEN404_V15_QA_CHANNEL_SIGNATURE_ATTESTOR',
 membership:'TIEN404_V15_QA_TENANT_SCOPE_ATTESTOR'
});
const POLICY=Object.freeze({version:'V15_03H_QA_V1',mode:'SYNTHETIC_ONLY',maxProofMs:120000,
  allowedTools:Object.freeze(['catalog_read','price_quote','order_draft','support_draft'])});
function deny(reason){
 return Object.freeze({status:'BLOCKED',reason,can_send:false,can_write_orders:false,
   owner_certified:false,provider_identity_real:false,tool_execution_count:0,
   paid_model_calls:0,provider_sends:0,orders_written:0});
}
function equalDigest(a,b){
 if(typeof a!=='string'||typeof b!=='string'||!HEX64.test(a)||!HEX64.test(b))return false;
 return timingSafeEqual(Buffer.from(a,'hex'),Buffer.from(b,'hex'));
}
function importVerifier(pem){
 if(typeof pem!=='string'||pem.length<110||pem.length>1000)throw Error('UNTRUSTED_KEY');
 const key=createPublicKey(pem);
 if(key.asymmetricKeyType!=='ec'||!P256.has(key.asymmetricKeyDetails?.namedCurve))throw Error('NOT_P256');
 return key;
}
function getSignedClaims(e,issuer,key,now){
 if(!e||typeof e!=='object'||Array.isArray(e)||typeof e.payload!=='string'||
   e.payload.length>3200||typeof e.signature!=='string'||!B64.test(e.signature))return null;
 try{
  const p=JSON.parse(e.payload);
  if(p.issuer!==issuer||p.audience!=='TIEN404_V15_03H_NO_SEND_PRIVATE_QA'||
    !Number.isSafeInteger(p.issued_ms)||!Number.isSafeInteger(p.expires_ms)||
    p.issued_ms>now+5000||p.expires_ms<=now||
    p.expires_ms-p.issued_ms>POLICY.maxProofMs||
    p.expires_ms<=p.issued_ms||!p.claims||typeof p.claims!=='object'||Array.isArray(p.claims))return null;
  if(!verify('sha256',Buffer.from(e.payload),{key,dsaEncoding:'ieee-p1363'},Buffer.from(e.signature,'base64url')))return null;
  return p.claims;
 }catch{return null}
}
async function attestSyntheticRequest(bundle,trusted,nowMs=Date.now()){
 if(!Number.isSafeInteger(nowMs)||nowMs<1700000000000)return deny('TRUSTED_CLOCK_REQUIRED');
 if(!bundle||typeof bundle!=='object'||Array.isArray(bundle)||
   Object.keys(bundle).sort().join(',')!=='channelProof,membershipProof,text')return deny('SIGNED_PROOFS_AND_MESSAGE_ONLY');
 if(typeof bundle.text!=='string'||bundle.text.length<1||bundle.text.length>2000||
   /[\u0000-\u0008\u000b-\u001f\u007f]/.test(bundle.text))return deny('INVALID_MESSAGE');
 if(!trusted||trusted.mode!=='SYNTHETIC_QA_ONLY'||typeof trusted.consumeNonceOnce!=='function'||
   typeof trusted.verifyPinnedFixtureBinding!=='function')return deny('BACKEND_TRUST_STORE_MISSING');
 let channelRoot,membershipRoot;
 try{
   channelRoot=importVerifier(trusted.channelPublicKey);
   membershipRoot=importVerifier(trusted.membershipPublicKey);
   const chHash=createHash('sha256').update(channelRoot.export({type:'spki',format:'der'})).digest('hex');
   const mHash=createHash('sha256').update(membershipRoot.export({type:'spki',format:'der'})).digest('hex');
   if(chHash===mHash)return deny('INDEPENDENT_ISSUER_KEYS_REQUIRED');
 }catch{return deny('ISSUER_PUBLIC_KEYS_NOT_VERIFIED')}
 const a=getSignedClaims(bundle.channelProof,SOURCES.channel,channelRoot,nowMs),
       b=getSignedClaims(bundle.membershipProof,SOURCES.membership,membershipRoot,nowMs);
 if(!a||!b)return deny('SIGNATURE_OR_PROOF_FRESHNESS_INVALID');
 const bind=['tenant_digest','store_digest','subject_digest','conversation_digest','event_digest','challenge_nonce'];
 if(bind.some(k=>!equalDigest(a[k],b[k])))return deny('INDEPENDENT_ISSUER_SCOPE_MISMATCH');
 if(a.provider_mode!=='V148_HMAC_SIGNED_FIXTURE_ONLY'||
   a.provider_signature_real!==false||b.registry_mode!=='V147_STATIC_STAGING_FIXTURE'||
   b.authenticated_owner_real!==false||b.actor_role!=='customer'||
   !CHANNELS.has(a.channel)||a.channel!==b.channel)return deny('NON_QA_OR_OWNER_PROOF_FORBIDDEN');
 let ok=false;
 try{ok=await trusted.verifyPinnedFixtureBinding({
    tenantDigest:a.tenant_digest,storeDigest:a.store_digest,channel:a.channel,
    providerIsSynthetic:true,
    subjectDigest:a.subject_digest
  })}catch{}
 if(ok!==true)return deny('PINNED_TENANT_STORE_CHANNEL_NOT_VERIFIED');
 let consumed=false;
 try{consumed=(await trusted.consumeNonceOnce({
   nonce:a.challenge_nonce,eventDigest:a.event_digest,ttlMs:POLICY.maxProofMs,
   scope:'V15_03H_PRIVATE_QA_NO_SEND'
 }))===true}catch{}
 if(!consumed)return deny('NONCE_REPLAY_OR_ATOMIC_STORE_UNAVAILABLE');
 const context=Object.freeze({
   status:'SYNTHETIC_SIGNED_QA_ONLY',trust_marker:TRUST,
   policy_version:POLICY.version,tenant_digest:a.tenant_digest,store_digest:a.store_digest,
   subject_digest:a.subject_digest,conversation_digest:a.conversation_digest,
   event_digest:a.event_digest,channel:a.channel,actor_role:'customer',
   allowed_tools:POLICY.allowedTools,verified_at_ms:nowMs,
   synthetic_only:true,owner_certified:false,provider_identity_real:false,
   can_send:false,can_write_orders:false,paid_model_calls:0,orders_written:0,provider_sends:0
 });
 accepted.add(context);
 return context;
}
function isAcceptedSyntheticContext(context){
 return !!context&&accepted.has(context)&&Object.isFrozen(context)&&
  context.trust_marker===TRUST&&context.synthetic_only===true&&
  context.can_send===false&&context.can_write_orders===false;
}
module.exports={attestSyntheticRequest,isAcceptedSyntheticContext,POLICY,SOURCES};
