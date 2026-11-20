/**
 * TIEN404 V19.8.10 - MOCK PROVIDER ONLY.
 * Synthetic HMAC proves possession of an ephemeral local test key, NEVER
 * actual Zalo Bot origin, Meta signature, merchant identity or consent.
 * No hosted calls, Commerce writes, customer identifiers or provider sends.
 */
import {createHmac,timingSafeEqual} from 'node:crypto';

const REF=/^QA_ENDPOINT_[AB]$/;
const EVENT=/^EVT_[A-Z0-9_]{3,40}$/;
const SKU=/^[A-Z][A-Z0-9-]{1,20}$/;
const allowed=(obj,keys)=>obj&&typeof obj==='object'&&!Array.isArray(obj)&&
 Object.keys(obj).length===keys.length&&keys.every(k=>Object.hasOwn(obj,k));
const keys=['endpointRef','eventRef','kind','chatType','isEcho','issuedAtMs',
 'sku','quantity','credentialEpoch'];

export const MOCK_SOURCE='MOCK_ZALO_PROVIDER_TEST_NOT_REAL_PROVIDER';
export function canonical(e){
 return JSON.stringify(keys.map(k=>e[k]));
}
export function signMockProvider(e,secret){
 if(!Buffer.isBuffer(secret)||secret.length<32)throw Error('INVALID_LOCAL_TEST_KEY');
 return {source:MOCK_SOURCE,event:e,signature:createHmac('sha256',secret)
  .update(canonical(e),'utf8').digest('hex')};
}
export function verifyMockProvider(packet,secret,nowMs){
 const deny=(reason)=>({accepted:false,reason,realProviderVerified:false,
  realOwnerVerified:false,canReadHosted:false,canSend:false,canWrite:false});
 if(!allowed(packet,['source','event','signature'])||packet.source!==MOCK_SOURCE)
  return deny('UNSUPPORTED_PROVIDER_SOURCE');
 const e=packet.event;
 if(!allowed(e,keys)||!REF.test(e.endpointRef)||!EVENT.test(e.eventRef)||
   e.kind!=='message.text.received'||e.chatType!=='PRIVATE'||e.isEcho!==false||
   !SKU.test(e.sku)||!Number.isSafeInteger(e.quantity)||e.quantity<1||e.quantity>100||
   !Number.isInteger(e.credentialEpoch)||e.credentialEpoch<1)
  return deny('INVALID_OR_PRIVILEGED_EVENT');
 if(!Number.isSafeInteger(nowMs)||!Number.isSafeInteger(e.issuedAtMs)||
  e.issuedAtMs>nowMs+1000||nowMs-e.issuedAtMs>300000)
  return deny('EVENT_EXPIRED_OR_FUTURE');
 if(!Buffer.isBuffer(secret)||secret.length<32||
  typeof packet.signature!=='string'||!/^[a-f0-9]{64}$/.test(packet.signature))
  return deny('UNTRUSTED_MOCK_SIGNATURE');
 const actual=createHmac('sha256',secret).update(canonical(e),'utf8').digest();
 const claimed=Buffer.from(packet.signature,'hex');
 if(actual.length!==claimed.length||!timingSafeEqual(actual,claimed))
  return deny('SIGNATURE_MISMATCH');
 return {accepted:true,reason:'MOCK_HMAC_ONLY',event:e,realProviderVerified:false,
  realOwnerVerified:false,canReadHosted:false,canSend:false,canWrite:false};
}
export function validateCatalogRow(row,store,sku,quantity){
 if(!row||!['A','B'].includes(store)||!SKU.test(sku)||
  !Number.isSafeInteger(quantity)||quantity<1||quantity>100)return null;
 const price=store==='A'?159000:189000,stock=store==='A'?5:9;
 if(row.store_code!==store||row.sku!==sku||sku!=='F01'||
  row.fixture_tag!=='SYNTHETIC_V1989'||row.price_vnd!==price||
  row.stock_on_hand!==stock||!Number.isSafeInteger(row.price_vnd))
  return null;
 const total=quantity*price;
 if(!Number.isSafeInteger(total))return null;
 return {sku,priceVnd:price,stockOnHand:stock,quantity,
  canFulfill:quantity<=stock,previewTotalVnd:total,currency:'VND',
  source:'SYNTHETIC_LOCAL_ONLY',storeCode:store,
  canReadHosted:false,canSend:false,canWrite:false,orderCreated:false};
}
