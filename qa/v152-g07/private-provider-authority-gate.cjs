'use strict';
/**
 * TIEN404 G0.7 / PRIVATE PROVIDER AUTHORITY ADMISSION CANDIDATE
 * SOURCE ONLY | NO WEBHOOK | NO NETWORK | NO SEND | NO CREDENTIAL READ.
 *
 * Verifies authentic HMAC bytes *if a future private operator injects an
 * independently managed provider secret*. The function CANNOT authenticate
 * the provenance of that secret, Page/OA ownership, or Supabase Store Owner.
 * A valid cryptographic result is NEVER authorization to do Commerce I/O.
 * Zalo OA and Website MUST be denied pending separately reviewed native
 * protocol / session issuer: never silently map OA to Bot/QA HMAC.
 */
const crypto=require('node:crypto');
const CONTRACT='T404_G07_PROVIDER_AUTHORITY_REVIEW_V1';
const PURPOSE='SIGNED_NO_SEND_READ_ONLY_QA';
const META='MESSENGER',BOT='ZALO_BOT',OA='ZALO_OA',WEB='WEBSITE';
const KNOWN=new Set([META,BOT,OA,WEB]);
const SHA=/^[a-f0-9]{64}$/;
const B64_SIG=/^[A-Za-z0-9+/]{86}==$/;
const KEY_ID=/^[a-zA-Z0-9_-]{6,64}$/;
const MAX_BYTES=128*1024,MAX_AGE_MS=5*60*1000;
const MAX_TTL_MS=30*60*1000;
const fields=(obj,keys)=>obj!==null&&typeof obj==='object'&&!Array.isArray(obj)&&
 Object.getPrototypeOf(obj)===Object.prototype&&
 Object.keys(obj).length===keys.length&&keys.every(k=>Object.hasOwn(obj,k));
const safeTime=t=>Number.isSafeInteger(t)&&t>0;
const hash=v=>crypto.createHash('sha256').update(v).digest('hex');
const deny=(reason)=>Object.freeze({
 contract:CONTRACT,status:'PRIVATE_NO_SEND_ADMISSION_NO_GO',reason,
 cryptographicCheckPassed:false,
 signedAuthorityPacketStructurallyVerified:false,
 actualProviderOwnerAttested:false,actualMerchantStoreOwnershipAttested:false,
 actualIndependentSourceEvidenceInspected:false,actualCanonicalHostedStoreRegistryChecked:false,
 actualHostedJwtRlsTested:false,actualZaloOaNativeSignatureVerified:false,
 currentIndependentRestoreAccepted:false,durableReplayVerified:false,
 providerSends:0,ordersWritten:0,stockWritten:0,hostedWrites:0,
 canPublish:false,canReceiveRealTraffic:false,canCreateOrder:false,
 canReadHostedCommerce:false,canChangeRls:false
});
function fixedEq(a,b){
 if(!Buffer.isBuffer(a)||!Buffer.isBuffer(b)||a.length!==b.length)return false;
 return crypto.timingSafeEqual(a,b);
}
function verifyProviderPayload({provider,rawBody,signatureHeader,providerSecret}={}){
 if(!KNOWN.has(provider))return deny('UNSUPPORTED_PROVIDER');
 if(provider===OA)return deny('ZALO_OA_NATIVE_VERIFICATION_NOT_PROVEN');
 if(provider===WEB)return deny('WEBSITE_PRIVATE_SESSION_ISSUER_NOT_PROVEN');
 if(!Buffer.isBuffer(rawBody)||rawBody.length===0||rawBody.length>MAX_BYTES)
  return deny('RAW_BYTES_NOT_PRESERVED_OR_OVERSIZED');
 if(typeof providerSecret!=='string'||Buffer.byteLength(providerSecret,'utf8')<16||
  Buffer.byteLength(providerSecret,'utf8')>256)
  return deny('PRIVATE_SECRET_MISSING_OR_INVALID');
 if(typeof signatureHeader!=='string')
  return deny('SIGNATURE_HEADER_MISSING');
 let valid=false;
 if(provider===META){
  if(!/^sha256=[a-f0-9]{64}$/.test(signatureHeader))
   return deny('META_SIGNATURE_FORMAT_INVALID');
  const expected=crypto.createHmac('sha256',providerSecret).update(rawBody).digest();
  valid=fixedEq(Buffer.from(signatureHeader.slice(7),'hex'),expected);
 }else if(provider===BOT){
  // Token check, not HMAC over body. Future public endpoint requires an
  // operator-owned secret and separate content/schema replay validation.
  const sig=Buffer.from(signatureHeader,'utf8');
  const key=Buffer.from(providerSecret,'utf8');
  valid=fixedEq(sig,key);
 }
 if(!valid)return deny('PROVIDER_CRYPTO_CHECK_FAILED');
 return Object.freeze({...deny('CRYPTO_MATCH_ONLY_NOT_PROVENANCE'),
   status:'CRYPTOGRAPHIC_PREFLIGHT_ONLY',cryptographicCheckPassed:true,
   actualProviderOwnerAttested:false,canReceiveRealTraffic:false});
}
const AUTH_FIELDS=['contract','purpose','environment','provider','installationDigest',
 'tenantDigest','storeDigest','registryDigest','providerOwnerProofDigest',
 'merchantOwnerProofDigest','independentSourceProofDigest','ownerKeyId',
 'reviewerKeyId','registryVersion','issuedAtMs','expiresAtMs','noSend'];
function canonical(m){
 const copy={};for(const k of AUTH_FIELDS)copy[k]=m[k];
 return Buffer.from(JSON.stringify(copy),'utf8');
}
function reviewAuthorityPacket(packet,trust,nowMs=Date.now()){
 if(!fields(packet,['manifest','ownerSignature','reviewerSignature'])||
  !fields(packet.manifest,AUTH_FIELDS))
  return deny('PACKET_SCHEMA_OR_SOURCE_CLAIM_INVALID');
 const m=packet.manifest;
 if(m.contract!==CONTRACT||m.purpose!==PURPOSE||
  m.environment!=='PRIVATE_REVIEW_ONLY'||!KNOWN.has(m.provider)||m.noSend!==true)
  return deny('AUTHORITY_SCOPE_MISMATCH');
 for(const name of ['installationDigest','tenantDigest','storeDigest','registryDigest',
  'providerOwnerProofDigest','merchantOwnerProofDigest','independentSourceProofDigest']){
  if(typeof m[name]!=='string'||!SHA.test(m[name])||/^0+$/.test(m[name]))
   return deny('PRIMARY_SOURCE_DIGEST_INVALID');
 }
 if(!KEY_ID.test(m.ownerKeyId)||!KEY_ID.test(m.reviewerKeyId)||
  m.ownerKeyId===m.reviewerKeyId)
  return deny('OWNER_REVIEWER_NOT_DISTINCT');
 if(!Number.isSafeInteger(m.registryVersion)||m.registryVersion<1||
    !safeTime(m.issuedAtMs)||!safeTime(m.expiresAtMs)||!safeTime(nowMs)||
    m.issuedAtMs>nowMs+60000||m.expiresAtMs<=nowMs||
    m.expiresAtMs-m.issuedAtMs>MAX_TTL_MS||
    m.expiresAtMs<=m.issuedAtMs)
  return deny('AUTHORITY_TIME_OR_VERSION_INVALID');
 if(typeof packet.ownerSignature!=='string'||!B64_SIG.test(packet.ownerSignature)||
    typeof packet.reviewerSignature!=='string'||!B64_SIG.test(packet.reviewerSignature))
  return deny('AUTHORITY_SIGNATURE_FORMAT_INVALID');
 // Trust anchors MUST be supplied by a separately owned server, never from
 // packet properties or chat. Test generated ephemeral keys prove only shape.
 if(!trust||typeof trust!=='object'||!Object.hasOwn(trust,'owner')||
    !Object.hasOwn(trust,'reviewer'))return deny('PRIVATE_TRUST_ANCHORS_UNAVAILABLE');
 const owner=trust.owner,reviewer=trust.reviewer;
 if(!fields(owner,['keyId','role','organization','publicKey'])||
    !fields(reviewer,['keyId','role','organization','publicKey'])||
    owner.keyId!==m.ownerKeyId||reviewer.keyId!==m.reviewerKeyId||
    owner.role!=='MERCHANT_OWNER'||reviewer.role!=='INDEPENDENT_REVIEWER'||
    typeof owner.organization!=='string'||typeof reviewer.organization!=='string'||
    owner.organization.length<3||reviewer.organization.length<3||
    owner.organization===reviewer.organization)
  return deny('INDEPENDENT_REVIEWER_TRUST_NOT_ESTABLISHED');
 let validOwner=false,validReviewer=false;
 try{
  const bytes=canonical(m);
  validOwner=crypto.verify(null,bytes,owner.publicKey,Buffer.from(packet.ownerSignature,'base64'));
  validReviewer=crypto.verify(null,bytes,reviewer.publicKey,Buffer.from(packet.reviewerSignature,'base64'));
 }catch(_e){return deny('AUTHORITY_SIGNATURE_VERIFY_ERROR')}
 if(!validOwner||!validReviewer)return deny('OWNER_OR_REVIEWER_SIGNATURE_INVALID');
 return Object.freeze({...deny('EXTERNAL_ORIGINAL_SOURCE_STILL_NOT_INDEPENDENTLY_VALIDATED'),
  status:'SIGNED_PRIVATE_PACKET_STRUCTURE_PASSED__STILL_NO_GO',
  signedAuthorityPacketStructurallyVerified:true,
  // Cryptographic packet signature does not establish underlying Merchant's
  // identity, real source documents, Store resolution or provider possession.
  actualProviderOwnerAttested:false,actualMerchantStoreOwnershipAttested:false});
}
function inspectReviewCandidate({provider,rawBody,signatureHeader,providerSecret,
 packet,trust,nowMs=Date.now()}={}){
 const cryptoResult=verifyProviderPayload({provider,rawBody,signatureHeader,providerSecret});
 if(!cryptoResult.cryptographicCheckPassed)return cryptoResult;
 const reviewed=reviewAuthorityPacket(packet,trust,nowMs);
 if(!reviewed.signedAuthorityPacketStructurallyVerified)return reviewed;
 if(packet.manifest.provider!==provider)return deny('PACKET_PROVIDER_MISMATCH');
 // Do not parse actual customer events, leak raw IDs or access any I/O here.
 return Object.freeze({...deny('ONLY_PRIVATE_OPERATOR_REAL_SOURCE_ACCEPTANCE_CAN_ADMIT'),
  status:'CRYPTO_AND_SIGNED_PACKET_STRUCTURALLY_PASSED__HOSTED_NO_GO',
  cryptographicCheckPassed:true,
  signedAuthorityPacketStructurallyVerified:true});
}
module.exports=Object.freeze({
 CONTRACT,PURPOSE,verifyProviderPayload,reviewAuthorityPacket,inspectReviewCandidate
});
