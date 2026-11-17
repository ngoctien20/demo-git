// TIEN404 V17.7A — Offline OA-INDEPENDENT channel shadow acceptance.
// Purpose: validate a common, NO-SEND ingress contract for Zalo Bot,
// Messenger and Website without touching live n8n, Meta, Zalo, Supabase.
// This is NOT a real provider verifier, storefront permission service,
// signature implementation or production channel adapter.
import {createHash} from 'node:crypto';

const CHANNELS=Object.freeze({
  ZALO_BOT:'BOT_HEADER_VERIFIED_BY_BACKEND',
  MESSENGER:'META_HMAC_VERIFIED_BY_BACKEND',
  WEBSITE:'WEBSITE_SESSION_VERIFIED_BY_BACKEND'
});
const REF=/^[a-zA-Z0-9_-]{6,128}$/;
const MAX_TEXT=4096, FRESH_MS=5*60*1000;

const denied=reason=>Object.freeze({
  admitted:false,reason,sourceOnly:true,noSend:true,noOrderWrite:true,
  noStockWrite:true,modelCalls:0,providerSends:0,commerceWrites:0,
  realProviderVerified:false,realStoreAuthVerified:false,canPublish:false
});
const admitted=()=>Object.freeze({
  admitted:true,stage:'OFFLINE_CHANNEL_SHADOW_FIXTURE_ONLY',
  sourceOnly:true,noSend:true,noOrderWrite:true,noStockWrite:true,
  modelCalls:0,providerSends:0,commerceWrites:0,
  realProviderVerified:false,realStoreAuthVerified:false,canPublish:false
});
const valid=s=>typeof s==='string'&&REF.test(s);
const digest=s=>createHash('sha256').update(s).digest('hex');

/** ALL deps are test doubles, never derived from the incoming customer event.
 * deps.verifyIngress({channel, opaqueHandle}) must independently verify REAL
 * native HMAC/secret/session in a separately approved future hosted adapter.
 * Here it ONLY returns a fixture receipt with source OFFLINE_SYNTHETIC.
 * deps.resolveInstallation({channel,installationKey}) must be a server-bound,
 * immutable registry. tenant/store/bot never come from user JSON.
 * deps.reserveOnce(key) must be atomic and durable in an eventual real system.
 */
export async function inspectOfflineChannelShadow(input,deps){
  if(!deps||deps.executionMode!=='OFFLINE_FIXTURE_ONLY'||
    deps.liveEnabled!==false||typeof deps.verifyIngress!=='function'||
    typeof deps.resolveInstallation!=='function'||
    typeof deps.reserveOnce!=='function')return denied('TRUSTED_OFFLINE_GATE_MISSING');
  if(!input||typeof input!=='object'||Array.isArray(input)||
    !Object.hasOwn(CHANNELS,input.channel))return denied('UNSUPPORTED_CHANNEL_NO_OA_FALLBACK');
  const prohibited=['tenantId','storeId','store_key','tenant_id','sku',
    'price','unitPrice','expectedTotal','expected_total','isAdmin',
    'botPrompt','botVersion','accessToken','oa_id','customerIdentity'];
  if(prohibited.some(k=>Object.hasOwn(input,k)))return denied('UNTRUSTED_CUSTOMER_AUTHORITY_OR_ORDER_FIELDS');
  if(!valid(input.installationKey)||!valid(input.eventId)||
     !valid(input.opaqueIngressHandle)||typeof input.text!=='string'||
     input.text.length===0||input.text.length>MAX_TEXT)
    return denied('BAD_CHANNEL_EVENT_REFERENCE');
  const now=deps.nowMs??Date.now();
  if(!Number.isSafeInteger(now)||!Number.isSafeInteger(input.receivedAtMs)||
     Math.abs(now-input.receivedAtMs)>FRESH_MS)
    return denied('STALE_OR_FUTURE_EVENT');
  let proof,installation;
  try{
    proof=await deps.verifyIngress({channel:input.channel,
      opaqueHandle:input.opaqueIngressHandle});
    installation=await deps.resolveInstallation({channel:input.channel,
      installationKey:input.installationKey});
  }catch{return denied('PRIVATE_CHANNEL_PROOF_UNAVAILABLE');}
  if(!proof||proof.source!=='OFFLINE_SYNTHETIC'||proof.verified!==true||
     proof.kind!==CHANNELS[input.channel]||proof.channel!==input.channel||
     proof.installationKey!==input.installationKey)
    return denied('CHANNEL_TRANSPORT_NOT_VERIFIED_IN_FIXTURE');
  if(!installation||installation.source!=='SERVER_REGISTRY_OFFLINE_QA'||
     installation.channel!==input.channel||
     installation.installationKey!==input.installationKey||
     installation.noSend!==true||installation.commerceReadOnly!==true||
     installation.ownerBindingVerified!==true||
     !valid(installation.tenantKey)||!valid(installation.storeKey)||
     !valid(installation.botKey))
    return denied('UNTRUSTED_OR_MISMATCHED_STORE_INSTALLATION');
  if(proof.tenantKey!==undefined||proof.storeKey!==undefined||
     proof.price!==undefined||proof.orderId!==undefined)
    return denied('TRANSPORT_RECEIPT_TRIED_TO_SET_COMMERCE_AUTHORITY');
  let fresh;
  try{
    fresh=await deps.reserveOnce(digest(JSON.stringify([
      'V17.7A_NO_SEND',input.channel,input.installationKey,input.eventId
    ])));
  }catch{return denied('REPLAY_BACKEND_UNAVAILABLE');}
  if(fresh!==true)return denied('DUPLICATE_OR_REPLAY');
  // No AI, send, DB, product query, order tools, network or model call.
  // Never return raw customer text, IDs, tenant/store, proof or secrets.
  return admitted();
}

export const offlineChannels=Object.freeze(Object.keys(CHANNELS));
