'use strict';
/* V17.1K Messenger HMAC fixture-only verification.
 * Zalo native signature must be verified from current OA/app protocol and real
 * authority; no generic HMAC assumption. No actual webhook, send or order read.
 */
const crypto=require('node:crypto');
const VERSION='T404_V171K_META_FIXTURE_HMAC_NO_SEND_V1';
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{2,90}$/.test(x);
const obj=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const deny=s=>{throw Error(s)};
function validMetaFixtureHmac(rawBody,header,fixtureSecret){
 if(!Buffer.isBuffer(rawBody)||rawBody.length<2||rawBody.length>65536||
    typeof header!=='string'||!/^sha256=[a-f0-9]{64}$/.test(header)||
    typeof fixtureSecret!=='string'||fixtureSecret.length<16)return false;
 const expected=crypto.createHmac('sha256',fixtureSecret).update(rawBody).digest();
 const actual=Buffer.from(header.slice(7),'hex');
 return expected.length===actual.length&&crypto.timingSafeEqual(expected,actual);
}
function verifyOfflineNoSend({channel,rawBody,signatureHeader,fixtureSecret,
  installation,nowMs}={}){
 if(!['MESSENGER','ZALO'].includes(channel)||!obj(installation)||
    !id(installation.tenantId)||!id(installation.storeId)||
    installation.active!==false||installation.stage!=='SYNTHETIC_OFFLINE_ONLY'||
    !Number.isSafeInteger(nowMs)||nowMs<=0)
    deny('SIGNED_SHADOW_UNTRUSTED_INSTALLATION');
 if(channel==='ZALO')return Object.freeze({version:VERSION,channel,decision:'DENY',
   reason:'ZALO_PROVIDER_SIGNATURE_AND_OA_OWNER_NOT_VERIFIED',
   actualRealProviderSignatureVerified:false,actualProviderSends:0,hostedWrites:0});
 if(!validMetaFixtureHmac(rawBody,signatureHeader,fixtureSecret))
   return Object.freeze({version:VERSION,channel,decision:'DENY',
     reason:'META_RAW_HMAC_INVALID',actualRealProviderSignatureVerified:false,
     actualProviderSends:0,hostedWrites:0});
 let parsed;
 try{parsed=JSON.parse(rawBody.toString('utf8'));}
 catch{return Object.freeze({version:VERSION,channel,decision:'DENY',
     reason:'SIGNED_BODY_NOT_JSON',actualRealProviderSignatureVerified:false,
     actualProviderSends:0,hostedWrites:0});}
 if(!obj(parsed)||!id(parsed.pageId)||!id(parsed.messageId)||
    parsed.pageId!==installation.pageId||
    parsed.tenantId!==installation.tenantId||
    parsed.storeId!==installation.storeId||
    parsed.origin!=='OFFLINE_TEST_SIGNED_FIXTURE')
    return Object.freeze({version:VERSION,channel,decision:'DENY',
      reason:'SIGNED_FIXTURE_INSTALLATION_MISMATCH',
      actualRealProviderSignatureVerified:false,
      actualProviderSends:0,hostedWrites:0});
 return Object.freeze({version:VERSION,channel,
   decision:'SYNTHETIC_CRYPTO_PASS_NO_REAL_UAT',
   syntheticRawHmacSha256Verified:true,actualRealProviderSignatureVerified:false,
   verifiedMetaPageOwnership:false,verifiedStoreJwtRls:false,
   actualWebhooksReceived:0,actualOrderReads:0,actualProviderSends:0,
   hostedWrites:0,approvedForRealUat:false});
}
module.exports=Object.freeze({VERSION,validMetaFixtureHmac,verifyOfflineNoSend});