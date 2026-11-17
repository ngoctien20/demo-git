/**
 * TIEN404 V17.22E: PRIVATE TEST-ISSUER ADMISSION, SOURCE-ONLY, NO SEND.
 * Receipts are ONLY synthetic internal QA fixtures, not native Meta/Zalo auth.
 * No signing private key in this module, no provider API, DB or user data.
 * The trusted issuer public key is injected from an independently pinned caller.
 */
import {createHash,verify} from 'node:crypto';
import {createQaCommandRouter} from './qa-command-router.mjs';

export const IDENTITY_ADMISSION_CONTRACT='T404_V1722E_PRIVATE_FIXTURE_RECEIPT_V1';
const KEYS=['contract','issuer','key_id','scope','channel','route_ref','sender_sha256',
 'event_sha256','tenant','store','actor_hash','issued_at_ms','expires_at_ms',
 'native_verified','owner_verified','no_send'];
const HEX=/^[a-f0-9]{64}$/;
const SAFE=/^[A-Za-z0-9_.:-]{3,128}$/;
const exact=o=>o!==null&&typeof o==='object'&&!Array.isArray(o)&&
 Object.getPrototypeOf(o)===Object.prototype;
const shape=(o,keys)=>exact(o)&&Object.keys(o).length===keys.length&&keys.every(k=>Object.hasOwn(o,k));
const sha=data=>createHash('sha256').update(data,'utf8').digest('hex');
const eventHash=raw=>sha(JSON.stringify([raw.channel,raw.route_ref,raw.sender_ref,
 raw.message_id,raw.message_text,raw.timestamp_ms]));
const senderHash=raw=>sha(JSON.stringify([raw.channel,raw.route_ref,raw.sender_ref]));
const deny=(reason)=>Object.freeze({route:'DENY_NO_SEND',reason,provider_sends:0,
 commerce_writes:0,model_calls:0,admission_scope:'SYNTHETIC_ONLY',
 native_provider_verified:false,real_store_owner_verified:false});

/**
 * Receipts come from an out-of-band private registry callback, NOT raw webhook JSON.
 * An external trusted issuer MUST perform native provider verification before a
 * real version can be designed. This QA adapter REJECTS any claim of real authority.
 * Installation registry rows are explicitly synthetic and never prove real Store ownership.
 */
export function createPrivateQaIdentityRoute({
 trustedPublicKey,issuerId,keyId,installations,fetchPrivateReceipt,now=()=>Date.now()
}={}){
 if(!trustedPublicKey||typeof fetchPrivateReceipt!=='function'||
    !SAFE.test(issuerId||'')||!SAFE.test(keyId||'')||!Array.isArray(installations))
   throw Error('PRIVATE_TRUST_CONFIGURATION_REQUIRED');
 const approved=new Map();
 for(const row of installations){
   if(!shape(row,['channel','route_ref','tenant','store','scope','status','owner_verified'])||
      !['messenger','zalo_bot'].includes(row.channel)||
      !SAFE.test(row.route_ref)||!SAFE.test(row.tenant)||!SAFE.test(row.store)||
      row.scope!=='SYNTHETIC_ONLY'||row.status!=='QA_APPROVED'||row.owner_verified!==false)
     throw Error('SYNTHETIC_INSTALLATION_REGISTRY_REQUIRED');
   const name=row.channel+':'+row.route_ref;
   if(approved.has(name))throw Error('DUPLICATE_QA_INSTALLATION');
   approved.set(name,Object.freeze({...row}));
 }
 if(approved.size===0)throw Error('EMPTY_PRIVATE_INSTALLATION_REGISTRY');

 const route=createQaCommandRouter({resolveTrustedContext:async raw=>{
   const signed=await fetchPrivateReceipt(raw);
   if(!shape(signed,['payload','signature'])||!shape(signed.payload,KEYS))
     throw Error('SIGNED_PRIVATE_RECEIPT_REQUIRED');
   const p=signed.payload,t=now();
   if(!Number.isSafeInteger(t)||!Number.isSafeInteger(p.issued_at_ms)||
      !Number.isSafeInteger(p.expires_at_ms)||p.issued_at_ms>t||
      p.expires_at_ms<=t||p.expires_at_ms-p.issued_at_ms>60000)
     throw Error('PRIVATE_RECEIPT_EXPIRED_OR_UNBOUNDED');
   if(p.contract!==IDENTITY_ADMISSION_CONTRACT||p.issuer!==issuerId||p.key_id!==keyId||
      p.scope!=='SYNTHETIC_ONLY'||p.no_send!==true||
      p.native_verified!==false||p.owner_verified!==false||
      p.channel!==raw.channel||p.route_ref!==raw.route_ref||
      p.sender_sha256!==senderHash(raw)||p.event_sha256!==eventHash(raw)||
      !SAFE.test(p.tenant)||!SAFE.test(p.store)||!HEX.test(p.actor_hash||''))
     throw Error('PRIVATE_RECEIPT_SCOPE_OR_EVENT_MISMATCH');
   const key=p.channel+':'+p.route_ref,row=approved.get(key);
   if(!row||row.tenant!==p.tenant||row.store!==p.store)
     throw Error('CHANNEL_INSTALLATION_NOT_APPROVED_FOR_STORE');
   if(typeof signed.signature!=='string'||!/^[A-Za-z0-9_-]{86}$/.test(signed.signature))
     throw Error('PRIVATE_RECEIPT_SIGNATURE_INVALID');
   const signature=Buffer.from(signed.signature,'base64url');
   if(signature.length!==64||signature.toString('base64url')!==signed.signature||
      !verify(null,Buffer.from(JSON.stringify(p),'utf8'),trustedPublicKey,signature))
     throw Error('PRIVATE_RECEIPT_SIGNATURE_INVALID');
   // provider_verified here ONLY denotes successful internal QA fixture admission
   // required by the inherited source-only command router; not Meta or Zalo proof.
   return {provider_verified:true,mode:'STAGING_QA_NO_SEND',
     channel:p.channel,route_ref:p.route_ref,account_installed:true,
     tenant:p.tenant,store:p.store,actor_hash:p.actor_hash};
 }});
 return async function admit(raw){
   const answer=await route(raw);
   if(answer.route!=='PRIVATE_QA_ORDER_CORE_NO_SEND')return Object.freeze({...answer,
      admission_scope:'SYNTHETIC_ONLY',native_provider_verified:false,
      real_store_owner_verified:false});
   // An admission plan NEVER executes an order, sends an OTP or links accounts.
   return Object.freeze({...answer,admission_scope:'SYNTHETIC_ONLY',
     native_provider_verified:false,real_store_owner_verified:false});
 };
}
export const privateQaEventHash=eventHash;
export const privateQaSenderHash=senderHash;
