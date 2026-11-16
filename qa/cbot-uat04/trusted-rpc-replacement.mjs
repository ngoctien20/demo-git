/**
 * TIEN404 CBOT-UAT-04 — Trusted RPC replacement ADMISSION CANDIDATE.
 * No deployed function, HTTP server, Supabase connection or Meta/Zalo integration.
 *
 * A privately enrolled GATEWAY signer MUST first verify the real provider's raw
 * webhook signature and Page/OA ownership OUTSIDE this module. A signed synthetic
 * envelope is NOT proof of native provider identity, legal owner consent or JWT.
 *
 * This module verifies a pinned Ed25519 gateway signature, audience, channel,
 * immutable account→Store mapping, bounded TTL and atomic-replay callback, then
 * performs READ-ONLY lookup against the inherited UAT02 synthetic lab.
 * Legacy OWNER_PAIRING_CLAIM remains BLOCKED, not silently mapped to order lookup.
 */
import {verify,createHash} from 'node:crypto';

export const CONTRACT='T404_CBOT_UAT04_TRUSTED_RPC_CANDIDATE_V1';
export const AUDIENCE='tien404-commerce-readonly-staging-candidate';
const fail=reason=>{const e=new Error(reason);e.code=reason;throw e;};
const hasExact=(x,keys)=> x!==null&&typeof x==='object'&&!Array.isArray(x)&&
 Object.getPrototypeOf(x)===Object.prototype&&Object.keys(x).length===keys.length&&
 keys.every(k=>Object.hasOwn(x,k));
const keys=['contract','issuer','audience','channel','account_id','participant_id',
 'event_id','action','order_id','issued_at_ms','expires_at_ms','nonce'];
const msg=p=>Buffer.from('TIEN404:UAT04:PRIVATE-GATEWAY-V1:'+JSON.stringify(p),'utf8');
const freeze=x=>Object.freeze(x);
const providerAccount=v=>typeof v==='string'&&/^QA_[A-Z0-9_]{3,48}$/.test(v);
const eventId=v=>typeof v==='string'&&/^QA-EVT-[A-Z0-9_-]{3,60}$/.test(v);
const orderId=v=>typeof v==='string'&&/^QA-CBOT02-[0-9]{4}$/.test(v);
const denied=()=>freeze({status:'NOT_FOUND_OR_UNAUTHORIZED',order:null,
 side_effects:freeze({provider_sends:0,hosted_writes:0,paid_model_calls:0})});
const runtime=()=>freeze({trust:'SYNTHETIC_SIGNED_GATEWAY_ONLY',
 native_provider_signature_verified:false,actual_owner_authority_verified:false,
 hosted_store_rls_verified:false,real_rpc_replaced:false,allow_real_send:false,
 allow_hosted_mutation:false});

export function createTrustedRpcCandidate({anchors,bindings,lab,now=()=>Date.now(),claimNonce}={}){
 if(!Array.isArray(anchors)||anchors.length<1||!Array.isArray(bindings)||bindings.length<1||
    !lab||typeof lab.mintSyntheticIngress!=='function'||typeof lab.lookupOrder!=='function'||
    typeof claimNonce!=='function'||typeof now!=='function')
    fail('TRUSTED_ISSUER_BINDINGS_AND_ATOMIC_NONCE_REQUIRED');
 const issuers=new Map(),mapped=new Map(),seenKeys=new Set();
 for(const a of anchors){
  if(!hasExact(a,['issuer','publicKey'])||!/^QA_GATEWAY_[A-Z0-9_]{1,40}$/.test(a.issuer)||
      issuers.has(a.issuer)||a.publicKey?.type!=='public'||
      a.publicKey?.asymmetricKeyType!=='ed25519')
      fail('INVALID_TRUST_ANCHOR');
  const fingerprint=createHash('sha256')
    .update(a.publicKey.export({format:'der',type:'spki'})).digest('hex');
  if(seenKeys.has(fingerprint))fail('DUPLICATED_TRUST_PUBLIC_KEY');
  seenKeys.add(fingerprint);issuers.set(a.issuer,a.publicKey);
 }
 for(const b of bindings){
  if(!hasExact(b,['issuer','channel','account_id','tenant_id','store_id'])||
      !issuers.has(b.issuer)||!['MESSENGER','ZALO_OA'].includes(b.channel)||
      ![b.account_id,b.tenant_id,b.store_id].every(providerAccount))
      fail('INVALID_TRUSTED_STORE_BINDING');
  const key=b.issuer+'|'+b.channel+'|'+b.account_id;
  if(mapped.has(key))fail('DUPLICATED_ACCOUNT_BINDING');
  mapped.set(key,freeze({...b}));
 }
 async function evaluate(packet){
  if(!hasExact(packet,['payload','signature'])||
     !hasExact(packet.payload,keys))fail('STRICT_PACKET_SHAPE_REQUIRED');
  const p=packet.payload;
  if(p.contract!==CONTRACT||p.audience!==AUDIENCE||
      !issuers.has(p.issuer)||!['MESSENGER','ZALO_OA'].includes(p.channel)||
      !providerAccount(p.account_id)||!providerAccount(p.participant_id)||
      !eventId(p.event_id)||!['ORDER_LOOKUP_READ','OWNER_PAIRING_CLAIM'].includes(p.action)||
      typeof p.nonce!=='string'||!/^[a-f0-9]{64}$/.test(p.nonce))
      fail('INVALID_CONTRACT_OR_AUDIENCE');
  if(p.action==='ORDER_LOOKUP_READ'?!orderId(p.order_id):p.order_id!==null)
      fail('INVALID_ACTION_PAYLOAD');
  const t=now();
  if(!Number.isSafeInteger(t)||!Number.isSafeInteger(p.issued_at_ms)||
     !Number.isSafeInteger(p.expires_at_ms)||p.expires_at_ms<=t||
     p.issued_at_ms>t+5000||p.issued_at_ms<t-60000||
     p.expires_at_ms-p.issued_at_ms>120000||
     p.expires_at_ms<=p.issued_at_ms)
      fail('ATTESTATION_EXPIRED_OR_INVALID_TTL');
  if(typeof packet.signature!=='string'||!/^[A-Za-z0-9_-]{80,100}$/.test(packet.signature))
      fail('INVALID_GATEWAY_SIGNATURE');
  const signature=Buffer.from(packet.signature,'base64url');
  if(signature.length!==64||signature.toString('base64url')!==packet.signature||
     !verify(null,msg(p),issuers.get(p.issuer),signature))
      fail('INVALID_GATEWAY_SIGNATURE');
  const binding=mapped.get(p.issuer+'|'+p.channel+'|'+p.account_id);
  if(!binding)fail('GATEWAY_ACCOUNT_NOT_BOUND_TO_STORE');
  // Must use externally atomic compare-and-set in a hosted implementation. No
  // in-memory Set is permitted as evidence for production replay safety.
  const nonceFingerprint=createHash('sha256')
    .update('T404UAT04|'+p.issuer+'|'+p.nonce).digest('hex');
  const nonceAccepted=await claimNonce(nonceFingerprint,p.expires_at_ms);
  if(nonceAccepted!==true)fail('REPLAY_OR_NONCE_LEDGER_UNAVAILABLE');
  const scoped=lab.mintSyntheticIngress({
   contract:'T404_CBOT_UAT02_SYNTHETIC_V1',
   channel:p.channel,account_id:p.account_id,
   participant_id:p.participant_id,event_id:p.event_id
  });
  if(scoped.tenant_id!==binding.tenant_id||scoped.store_id!==binding.store_id)
      fail('TRUSTED_BINDING_SCOPE_CONFLICT');
  if(p.action==='OWNER_PAIRING_CLAIM')return freeze({
    status:'BLOCKED_PRIVATE_OWNER_PROOF',order:null,
    reason:'LEGACY_OWNER_PAIRING_NEEDS_INDEPENDENT_AUTHORITY_AND_PRIVATE_BACKEND',
    ...runtime(),side_effects:denied().side_effects
  });
  const res=lab.lookupOrder({context:scoped,order_id:p.order_id});
  if(res.status!=='FOUND')return denied();
  return freeze({status:'FOUND_SYNTHETIC_ONLY',
    order:freeze({...res.data}),
    ...runtime(),side_effects:denied().side_effects
  });
 }
 return freeze({evaluate,diagnostics:runtime});
}
export function signableBytesForSyntheticTest(payload){return msg(payload);}
export function deployTrustedRpc(){fail('HOSTED_RPC_DEPLOY_NOT_AUTHORIZED');}
export function revokeLegacyAnonymousRpc(){fail('LEGACY_ANON_REVOKE_NOT_AUTHORIZED');}
export function sendProviderResponse(){fail('LIVE_PROVIDER_SEND_NOT_AUTHORIZED');}
export function writeCommerceOrder(){fail('HOSTED_COMMERCE_WRITE_NOT_AUTHORIZED');}
