/**
 * TIEN404 V14.5Z-G2.2 — READ-ONLY signed Bot → Shop B QA candidate resolver.
 * No provider calls, token/credential, Orders, customer or registry writes.
 * Not an owner/merchant certificate and never allows Zalo send.
 */
const ENCODER=new TextEncoder();
const HEX64=/^[0-9a-f]{64}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const BINDING_ID='G22_QA_SHOP_B_PROVIDER_CANDIDATE_V1';
const SLUG='qa-staging-shop-b-20261110';
const STORE='qa-store-b';
const PROOF_ISSUER='ZALO_BOT_PROVIDER_ATTESTOR';
const PROOF_PURPOSE='TIEN404_V145Z_LIVE03_CERTIFICATION_ONLY';
const DENIED=(code,status=403)=>({http_status:status,body:{
  ok:false,reason:code,source:'G22_READONLY_STAGING',
  can_send:false,orders_written:0,customer_data_touched:false,
  owner_verified:false,real_commerce_ready:false
}});
const b64Decode=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-s.length%4)%4)),c=>c.charCodeAt(0));
const constantEqual=(a,b)=>{
  if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;
  let mismatch=0;for(let i=0;i<a.length;i++)mismatch|=a.charCodeAt(i)^b.charCodeAt(i);
  return mismatch===0;
};
const toHex=b=>Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,'0')).join('');
export async function resolveG22(proof,db,nowMs,publicKeySpkiB64,expectedTenantSha){
  if(!db||typeof db.prepare!=='function'||!HEX64.test(expectedTenantSha||'')||
    typeof publicKeySpkiB64!=='string'||publicKeySpkiB64.length<80||
    !Number.isSafeInteger(nowMs)||nowMs<1700000000000)
      return DENIED('TRUSTED_STAGING_RUNTIME_MISSING',503);
  if(!proof||typeof proof!=='object'||Array.isArray(proof)||
    typeof proof.payload!=='string'||proof.payload.length>2000||
    typeof proof.signature!=='string'||!/^[A-Za-z0-9_-]{86,88}$/.test(proof.signature))
      return DENIED('SIGNED_PROVIDER_PROOF_REQUIRED',422);
  try{
    const payload=JSON.parse(proof.payload);
    const claims=payload?.claims;
    if(payload?.issuer!==PROOF_ISSUER||payload?.purpose!==PROOF_PURPOSE||
      !Number.isSafeInteger(payload.issued_ms)||!Number.isSafeInteger(payload.expires_ms)||
      payload.expires_ms-payload.issued_ms!==120000||
      payload.issued_ms>nowMs+5000||payload.expires_ms<=nowMs||
      !claims||!HEX64.test(claims.bot_digest||'')||!HEX64.test(claims.challenge_nonce||'')||
      claims.provider!=='zalo_bot_creator'||claims.source!=='SERVER_HTTPS_ZALO_GETME'||
      claims.api_method!=='POST'||claims.getme_http_status!==200||
      claims.getme_result_id_string!==true||claims.id_is_official_provider_result!==true||
      claims.actual_api_call_readonly!==true)
        return DENIED('PROVIDER_CLAIMS_UNTRUSTED_OR_EXPIRED');
    const pub=await crypto.subtle.importKey('spki',b64Decode(publicKeySpkiB64),
      {name:'ECDSA',namedCurve:'P-256'},false,['verify']);
    const valid=await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},pub,
      b64Decode(proof.signature),ENCODER.encode(proof.payload));
    if(!valid)return DENIED('PROVIDER_SIGNATURE_INVALID');
    // Server selects a single fixed QA mapping, ignoring any client tenant/shop/owner.
    const row=await db.prepare(
      'SELECT binding_id,bot_digest,challenge_hex,tenant_uuid,tenant_slug,store_key,provider,source,status,owner_certified,expires_ms,observed_ms FROM g22_trusted_bot_candidates WHERE binding_id=?1 LIMIT 1'
    ).bind(BINDING_ID).first();
    if(!row||row.binding_id!==BINDING_ID||row.status!=='CANDIDATE'||
      row.provider!=='zalo_bot_creator'||row.source!=='SERVER_VERIFIED_QA_TENANT'||
      row.tenant_slug!==SLUG||row.store_key!==STORE||
      row.owner_certified!==0||!UUID.test(row.tenant_uuid||'')||
      !Number.isSafeInteger(row.expires_ms)||row.expires_ms<=nowMs||
      !Number.isSafeInteger(row.observed_ms)||row.observed_ms>nowMs+5000)
       return DENIED('SHOP_B_CANDIDATE_RECORD_NOT_ELIGIBLE');
    const actualTenantSha=toHex(await crypto.subtle.digest('SHA-256',ENCODER.encode(row.tenant_uuid)));
    if(!constantEqual(actualTenantSha,expectedTenantSha))
      return DENIED('PINNED_TENANT_IDENTITY_MISMATCH');
    if(!constantEqual(row.bot_digest,claims.bot_digest)||
      !constantEqual(row.challenge_hex,claims.challenge_nonce))
       return DENIED('BOT_ID_OR_CHALLENGE_NOT_ENROLLED');
    return {
      http_status:200,
      body:{
       ok:true,status:'SIGNED_PROVIDER_MATCHES_SHOP_B_QA_CANDIDATE',
       binding_ref:BINDING_ID,
       tenant_scope:'QA_STAGING_SHOP_B_ONLY',
       store_scope:'qa-store-b',
       public_tenant_id_exposed:false,
       raw_bot_id_exposed:false,
       owner_verified:false,merchant_authority_verified:false,
       registry_status:'CANDIDATE_OWNER_PENDING',
       source:'G22_READONLY_STAGING',
       can_send:false,can_promote_live_registry:false,
       real_commerce_ready:false,orders_written:0,
       customer_data_touched:false,provider_sends:0
      }
    };
  }catch{
    return DENIED('CRYPTO_OR_REGISTRY_UNAVAILABLE',503);
  }
}
export const G22_EXPECTED={binding_ref:BINDING_ID,tenant_slug:SLUG,store_key:STORE,source:'SYNTHETIC_CHANNEL_BINDING_CANDIDATE'};
