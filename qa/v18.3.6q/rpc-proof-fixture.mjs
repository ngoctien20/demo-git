/**
 * V18.3.6Q — PRIVATE RPC HMAC PROOF, SYNTHETIC DISPOSABLE FIXTURE ONLY.
 * This committed key is PUBLIC, cannot be reused as production secret.
 * Node<>PostgreSQL canonicalization is tested byte-for-byte on PG17.
 */
import {createHmac,timingSafeEqual} from 'node:crypto';
export const FIXTURE_HMAC_KEY_HEX='51'.repeat(32);
export const CLAIM_SCHEMA='TIEN404_V1836Q_PUBLIC_QA_ONLY';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const requireUUID=(k,x)=>{if(typeof x!=='string'||!UUID.test(x))throw Error('INVALID_'+k);return x;};
export function canonicalFixtureClaim(x){
 const keys=['sessionId','userId','tenantId','storeId','itemId','jti'];
 for(const k of keys) requireUUID(k,x?.[k]);
 if(!Number.isSafeInteger(x.revision)||x.revision<1)
  throw Error('INVALID_REVISION');
 if(!Number.isSafeInteger(x.expiresEpoch)||x.expiresEpoch<1)
  throw Error('INVALID_EXPIRY');
 return ['Q1','tien404-qa-issuer','tien404-qa-catalog','qa-fixture-v1',
   x.sessionId,x.userId,x.tenantId,x.storeId,String(x.revision),
   x.itemId,'CATALOG_READ',x.jti,String(x.expiresEpoch)].join('\n');
}
export function signPublicQaFixture(x){
 const body=canonicalFixtureClaim(x);
 return Object.freeze({keyId:'qa-fixture-v1',version:'Q1',
   bodySha256:null,macHex:createHmac('sha256',Buffer.from(FIXTURE_HMAC_KEY_HEX,'hex'))
     .update(Buffer.from(body,'utf8')).digest('hex'),
   publicFixtureSecret:true,realIssuerVerified:false,productionSignerValid:false});
}
export function verifyPublicQaFixture(x,mac){
 let expected;
 try{expected=signPublicQaFixture(x).macHex;}
 catch{return false;}
 if(typeof mac!=='string'||!/^[a-f0-9]{64}$/.test(mac))return false;
 return timingSafeEqual(Buffer.from(expected,'hex'),Buffer.from(mac,'hex'));
}
export function rpcProofReviewVerdict(){
 return Object.freeze({
  stage:'DISPOSABLE_PG17_CROSS_RUNTIME_NEGATIVE_QA',
  signer:'SYNTHETIC_COMMITTED_HMAC_KEY_NOT_SECRET',
  signingKeyCustodyVerified:false,
  realSupabaseJwtVerified:false,
  realGoTrueSessionVerified:false,
  realStoreOwnershipVerified:false,
  databaseOwnerUsesBypassPotential:true,
  callerHasExternalCredential:false,
  alternateSecdefCallersReviewed:false,
  actualProductionRpcTrustClosed:false,
  productionAdmitted:false,
  humanSecurityReviewerApproval:false,
 });
}
