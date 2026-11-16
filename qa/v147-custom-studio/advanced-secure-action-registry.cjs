'use strict';
/**
 * TIEN404 V15.2-ADV.3 — Synthetic signed-preview action registry.
 * This is NEVER an action execution gateway: it cannot send, order, lookup,
 * modify hosted records, grant Owner rights, or charge a provider.
 * Real provider identity and merchant authorization require a separate,
 * approved server-side release gate. Private keys are injected only by QA.
 */
const crypto=require('node:crypto');
const {resolve}=require('./advanced-channel-registry.js');
const VERSION='T404_ADV3_SIGNED_PREVIEW_V1';
const AUDIENCE='T404_SYNTHETIC_ACTION_QA_NO_SEND';
const MAX_TTL_MS=120000;
const HEX64=/^[a-f0-9]{64}$/;
const NONCE=/^[a-f0-9]{32}$/;
const B64=/^[A-Za-z0-9_-]{1,2000}$/;
const ACTIONS=Object.freeze({
 CATALOG:Object.freeze({class:'READ_PREVIEW',capability:'catalog_read'}),
 QUOTE:Object.freeze({class:'READ_PREVIEW',capability:'price_quote'}),
 POLICY:Object.freeze({class:'READ_PREVIEW',capability:'knowledge_read'}),
 ASK_STAFF:Object.freeze({class:'DRAFT_PREVIEW',capability:'support_draft'}),
 ORDER_REQUEST:Object.freeze({class:'CONFIRMATION_ONLY',capability:'order_draft'}),
 TRACK_ORDER:Object.freeze({class:'BLOCKED_PRIVATE',capability:'order_status_read'}),
 OPEN_VERIFIED_LINK:Object.freeze({class:'BLOCKED_EXTERNAL',capability:'verified_link'})
});
const isPlain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
const exact=(o,fields)=>isPlain(o)&&Object.keys(o).length===fields.length&&fields.every(k=>Object.hasOwn(o,k));
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const equal=(a,b)=>typeof a==='string'&&typeof b==='string'&&HEX64.test(a)&&HEX64.test(b)&&crypto.timingSafeEqual(Buffer.from(a,'hex'),Buffer.from(b,'hex'));
const deny=reason=>Object.freeze({status:'BLOCKED',reason,syntheticOnly:true,actionExecutable:false,
 canSend:false,providerSends:0,ordersWritten:0,hostedReads:0,hostedWrites:0,paidModelCalls:0,paidSpendVnd:0});
const CONTEXT_FIELDS=['mode','tenantDigest','storeDigest','subjectDigest','conversationDigest','channel','role','providerVerifiedReal','ownerVerifiedReal','sendEnabled'];
const CLAIM_FIELDS=['version','audience','action','channel','tenantDigest','storeDigest','subjectDigest','conversationDigest','decisionDigest','nonce','issuedAtMs','expiresAtMs'];
function validContext(c){
 return exact(c,CONTEXT_FIELDS)&&c.mode==='SYNTHETIC_QA_ONLY'&&
 [c.tenantDigest,c.storeDigest,c.subjectDigest,c.conversationDigest].every(x=>typeof x==='string'&&HEX64.test(x))&&
 ['MESSENGER','ZALO_BOT','ZALO_OA','WEB_WIDGET'].includes(c.channel)&&
 c.role==='customer'&&c.providerVerifiedReal===false&&c.ownerVerifiedReal===false&&c.sendEnabled===false;
}
function previewButton(decision,action){
 if(!isPlain(decision)||decision.contract!=='T404_PRESENTATION_DECISION_V1'||
   decision.mode!=='SYNTHETIC_NO_SEND'||decision.lifecycle!=='EXPERIMENTAL'||
   decision.providerSends!==0||decision.hostedWrites!==0||
   decision.releaseAuthorized!==false||!isPlain(decision.decision)||
   decision.decision.actionExecutable!==false||decision.decision.actionSuggestion!==action||
   !isPlain(decision.preview)||!Array.isArray(decision.preview.buttons)||
   !Array.isArray(decision.preview.cards))return false;
 const buttons=[...decision.preview.buttons,...decision.preview.cards.flatMap(c=>Array.isArray(c.buttons)?c.buttons:[])];
 return buttons.some(b=>isPlain(b)&&b.id===action&&b.interactive===false&&b.requiresSignedServerAction===true);
}
function actionDigest(d,action){
 return sha(JSON.stringify({contract:d.contract,storeId:d.storeId,tenantId:d.tenantId,
  channel:d.channel,action,selectedComponent:d.decision.selectedComponent}));
}
function scopeOk(decision,action,context){
 if(!validContext(context)||!previewButton(decision,action))return false;
 if(typeof decision.tenantId!=='string'||typeof decision.storeId!=='string')return false;
 if(!equal(sha(decision.tenantId),context.tenantDigest)||
    !equal(sha(decision.storeId),context.storeDigest)||context.channel!==decision.channel)return false;
 const meta=ACTIONS[action];
 if(!meta||meta.class.startsWith('BLOCKED'))return false;
 const registry=resolve({channel:decision.channel,componentId:'SIGNED_POSTBACK',
    tenant_id:decision.tenantId,store_id:decision.storeId});
 // The registry may not support a native signed postback. This does NOT
 // authorize a provider postback; only a synthetic disabled-preview token.
 return registry.status!=='DENY';
}
function decode(s){
 if(typeof s!=='string'||!B64.test(s))throw Error('TOKEN_ENCODING_INVALID');
 const v=Buffer.from(s,'base64url');
 if(v.toString('base64url')!==s)throw Error('TOKEN_ENCODING_NONCANONICAL');
 return v;
}
function issueSignedPreview({decision,action,context,nonce,issuedAtMs,ttlMs=60000,privateKey}={}){
 if(!scopeOk(decision,action,context))return deny('POLICY_OR_SCOPE_DENIED');
 if(!NONCE.test(nonce||'')||!Number.isSafeInteger(issuedAtMs)||issuedAtMs<1700000000000||
    !Number.isSafeInteger(ttlMs)||ttlMs<1000||ttlMs>MAX_TTL_MS)return deny('NONCE_TIME_OR_TTL_INVALID');
 let key;
 try{key=crypto.createPrivateKey(privateKey);if(key.asymmetricKeyType!=='ed25519')throw Error()}catch{return deny('QA_ED25519_SIGNER_REQUIRED')}
 const claims={version:VERSION,audience:AUDIENCE,action,channel:context.channel,
  tenantDigest:context.tenantDigest,storeDigest:context.storeDigest,
  subjectDigest:context.subjectDigest,conversationDigest:context.conversationDigest,
  decisionDigest:actionDigest(decision,action),nonce,issuedAtMs,expiresAtMs:issuedAtMs+ttlMs};
 const raw=Buffer.from(JSON.stringify(claims));
 const token=Object.freeze({payload:raw.toString('base64url'),
  signature:crypto.sign(null,raw,key).toString('base64url')});
 return Object.freeze({status:'SIGNED_QA_PREVIEW_ONLY',token,expiresAtMs:claims.expiresAtMs,
  syntheticOnly:true,actionExecutable:false,canSend:false,providerSends:0,ordersWritten:0,hostedWrites:0,paidSpendVnd:0});
}
async function verifyPreviewAndConsume({token,decision,action,context,publicKey,nonceStore,nowMs}={}){
 if(!validContext(context)||!scopeOk(decision,action,context))return deny('POLICY_OR_SCOPE_DENIED');
 if(!exact(token,['payload','signature'])||typeof token.payload!=='string'||token.payload.length>1800||
    typeof token.signature!=='string'||token.signature.length>100)return deny('TOKEN_SCHEMA_DENIED');
 if(!Number.isSafeInteger(nowMs)||nowMs<1700000000000)return deny('TRUSTED_CLOCK_REQUIRED');
 if(!nonceStore||nonceStore.source!=='IN_MEMORY_SYNTHETIC_QA'||
    typeof nonceStore.verifyPinnedScope!=='function'||typeof nonceStore.consumeOnce!=='function')
   return deny('SYNTHETIC_ATOMIC_NONCE_STORE_REQUIRED');
 let p;
 try{
  const raw=decode(token.payload),sig=decode(token.signature);
  if(sig.length!==64)return deny('TOKEN_SIGNATURE_INVALID');
  const key=crypto.createPublicKey(publicKey);
  if(key.asymmetricKeyType!=='ed25519'||!crypto.verify(null,raw,key,sig))
    return deny('TOKEN_SIGNATURE_INVALID');
  p=JSON.parse(raw.toString('utf8'));
 }catch{return deny('TOKEN_SIGNATURE_OR_ENCODING_INVALID')}
 if(!exact(p,CLAIM_FIELDS)||p.version!==VERSION||p.audience!==AUDIENCE||
    p.action!==action||p.channel!==context.channel||!NONCE.test(p.nonce||'')||
    ![p.tenantDigest,p.storeDigest,p.subjectDigest,p.conversationDigest,p.decisionDigest].every(x=>typeof x==='string'&&HEX64.test(x)))
   return deny('TOKEN_CLAIMS_DENIED');
 if(!Number.isSafeInteger(p.issuedAtMs)||!Number.isSafeInteger(p.expiresAtMs)||
    p.issuedAtMs>nowMs+3000||p.expiresAtMs<=nowMs||p.expiresAtMs-p.issuedAtMs>MAX_TTL_MS||
    p.expiresAtMs<=p.issuedAtMs)return deny('TOKEN_EXPIRED_OR_INVALID_TIME');
 if(!equal(p.tenantDigest,context.tenantDigest)||!equal(p.storeDigest,context.storeDigest)||
    !equal(p.subjectDigest,context.subjectDigest)||!equal(p.conversationDigest,context.conversationDigest)||
    !equal(p.decisionDigest,actionDigest(decision,action)))return deny('SIGNED_SCOPE_OR_DECISION_MISMATCH');
 let verified=false;
 try{verified=(await nonceStore.verifyPinnedScope({context,claims:p}))===true}catch{}
 if(!verified)return deny('INDEPENDENT_QA_SCOPE_PROOF_REQUIRED');
 let consumed=false;
 try{consumed=(await nonceStore.consumeOnce({nonce:p.nonce,scope:p.storeDigest,expiresAtMs:p.expiresAtMs}))===true}catch{}
 if(!consumed)return deny('REPLAY_OR_ATOMIC_NONCE_UNAVAILABLE');
 return Object.freeze({status:action==='ORDER_REQUEST'?'CONFIRMATION_REQUIRED_NO_WRITE':'QA_PREVIEW_ACK_ONLY',
  action,actionClass:ACTIONS[action].class,providerPostbackCertified:false,
  customerConfirmationRequired:action==='ORDER_REQUEST',
  syntheticOnly:true,actionExecutable:false,canSend:false,providerSends:0,
  ordersWritten:0,hostedReads:0,hostedWrites:0,paidModelCalls:0,paidSpendVnd:0});
}
module.exports=Object.freeze({VERSION,ACTIONS,issueSignedPreview,verifyPreviewAndConsume});
