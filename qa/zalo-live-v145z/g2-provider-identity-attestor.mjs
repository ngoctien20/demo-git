/**
 * TIEN404 G2 provider getMe signable evidence adapter — NOT DEPLOYED.
 * This module is not a Worker fetch handler or HTTP route.
 * It must ONLY be invoked by an authenticated private server,
 * with separately provisioned signing CryptoKey and HMAC CryptoKey.
 * It never receives credentials from public requests or passes Bot IDs
 * to caller. trustedGetMe is injected by the token-owning server service.
 *
 * A signed server attestation is NOT an official Zalo signed assertion.
 * Its issuer provenance still requires independent hosted verification.
 */
const HEX64=/^[0-9a-f]{64}$/,NONCE=/^[0-9a-f]{32,64}$/,ID=/^[0-9]{8,32}$/;
const enc=new TextEncoder();
const safeB64=b=>btoa(String.fromCharCode(...new Uint8Array(b)))
  .replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const denied=reason=>({status:'BLOCKED',reason,can_send:false,can_promote_registry:false,provider_sends:0});
export async function makeProviderEvidence({
  trustedGetMe,signingKey,identityHmacKey,scope,nonce,nowMs=Date.now()
}={}){
 if(typeof trustedGetMe!=='function'||
  signingKey?.type!=='private'||signingKey.algorithm?.name!=='ECDSA'||
  signingKey.algorithm?.namedCurve!=='P-256'||!signingKey.usages?.includes('sign')||
  identityHmacKey?.type!=='secret'||identityHmacKey.algorithm?.name!=='HMAC'||
  identityHmacKey.algorithm?.hash?.name!=='SHA-256'||!identityHmacKey.usages?.includes('sign')||
  !scope||scope.trustedServerOrigin!=='PRIVATE_TOKEN_HOLDER_POST_AUTH'||
  !HEX64.test(scope.tenant_digest||'')||!HEX64.test(scope.store_digest||'')||
  !HEX64.test(scope.owner_digest||'')||!NONCE.test(nonce||'')||
  !Number.isSafeInteger(nowMs)||nowMs<=0)
    return denied('PRIVATE_SIGNING_CONTEXT_MISSING');
 try{
  // One call to authenticated server-owned read-only Zalo /getMe.
  const response=await trustedGetMe();
  if(response?.origin!=='SERVER_HTTPS_ZALO_GETME'||response?.httpStatus!==200||
     response?.body?.ok!==true)return denied('ZALO_GETME_UNVERIFIED');
  const id=response.body.result?.id;
  if(typeof id!=='string'||!ID.test(id))return denied('OFFICIAL_BOT_ID_MISSING');
  const raw=enc.encode('TIEN404-G2-IDENTITY-V1\0'+nonce+'\0'+id);
  const bot_digest=Array.from(new Uint8Array(
     await crypto.subtle.sign({name:'HMAC'},identityHmacKey,raw)
  )).map(x=>x.toString(16).padStart(2,'0')).join('');
  const claims={
    bot_digest,tenant_digest:scope.tenant_digest,
    store_digest:scope.store_digest,owner_digest:scope.owner_digest,
    challenge_nonce:nonce,provider:'zalo_bot_creator',
    source:'SERVER_HTTPS_ZALO_GETME',api_method:'POST',
    getme_http_status:200,getme_result_id_string:true,
    id_is_official_provider_result:true,actual_api_call_readonly:true,
  };
  const payload=JSON.stringify({
    issuer:'ZALO_BOT_PROVIDER_ATTESTOR',
    purpose:'TIEN404_V145Z_LIVE03_CERTIFICATION_ONLY',
    evidence_id:'G2_PROVIDER_'+nonce.slice(0,16),
    issued_ms:nowMs,expires_ms:nowMs+120000,claims
  });
  const sig=await crypto.subtle.sign(
    {name:'ECDSA',hash:'SHA-256'},signingKey,enc.encode(payload));
  return {
    status:'SIGNED_PROVIDER_OBSERVATION_ONLY',
    proof:{payload,signature:safeB64(sig)},
    raw_provider_id_exposed:false,
    provider_sends:0,
    can_send:false,
    can_promote_registry:false
  };
 }catch{
   // Error text may include sensitive Bot Token URL: never surface it.
   return denied('PROVIDER_READ_OR_SIGN_FAILED');
 }
}
