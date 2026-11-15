/**
 * TIEN404 V14.5Z-LIVE03E
 * Read-only provider getMe identity digest CANDIDATE. Not deployed.
 * No credentials, no network, no databases, no dispatch, no promotion.
 *
 * SECURITY BOUNDARY: trustedGetMe MUST be injected by trusted server runtime
 * holding an existing Zalo Bot token; never permit request body to provide it.
 * Attestation HMAC key is a separate, short-lived server secret, not a Bot Token
 * or the Gateway Authorization Key. NO such real key has been provisioned.
 */
'use strict';
const { createHmac, randomBytes }=require('node:crypto');
const BOT_RE=/^[0-9]{8,32}$/;
const SCOPE_RE=/^[a-z0-9][a-z0-9_-]{2,127}$/i;
function denied(reason){return Object.freeze({state:'BLOCKED',reason,can_send:false,can_promote_registry:false,provider_sends:0});}
function makeReadOnlyProbe({
  trustedGetMe,
  identityKey,
  tenantId,
  storeId,
  trustedRuntime,
}={}){
 const configured=typeof trustedGetMe==='function'&&Buffer.isBuffer(identityKey)&&identityKey.length>=32&&
 SCOPE_RE.test(tenantId||'')&&SCOPE_RE.test(storeId||'')&&trustedRuntime==='SERVER_ONLY_NO_SEND';
 if(!configured)return async()=>denied('TRUST_RUNTIME_UNAVAILABLE');
 return async function probe(){
   // No client identity, request body, Bot token, Chat ID or webhook input accepted.
   try{
     const t=Date.now();
     const response=await trustedGetMe();
     if(response?.httpStatus!==200||response?.origin!=='SERVER_HTTPS_ZALO_GETME'||response?.body?.ok!==true)
       return denied('PROVIDER_GETME_UNVERIFIED');
     const id=response?.body?.result?.id;
     const name=response?.body?.result?.account_name;
     if(typeof id!=='string'||!BOT_RE.test(id)||typeof name!=='string'||name.length===0||name.length>128)
       return denied('OFFICIAL_BOT_ID_MISSING');
     const nonce=randomBytes(16).toString('hex');
     function hmac(label,raw){
       return createHmac('sha256',identityKey)
         .update('TIEN404-LIVE03E-V1\0'+label+'\0'+nonce+'\0'+raw).digest('hex');
     }
     return Object.freeze({
       state:'PROVIDER_ID_OBSERVED_NOT_BOUND',
       source:'TRUSTED_GETME_DIGEST_CANDIDATE',
       bot_digest:hmac('provider_bot_id',id),
       tenant_digest:hmac('tenant_scope',tenantId),
       store_digest:hmac('store_scope',storeId),
       attest_nonce:nonce,
       observed_ms:t,
       expires_ms:t+120000,
       bot_shop_owner_verified:false,
       owner_pair_verified:false,
       provider_sends:0,
       can_send:false,
       can_promote_registry:false
     });
   }catch{
     // Fail closed without leaking Bot Token, ID, API URL with token or raw error.
     return denied('READONLY_PROVIDER_CHECK_FAILED');
   }
 };
}
module.exports={makeReadOnlyProbe};
