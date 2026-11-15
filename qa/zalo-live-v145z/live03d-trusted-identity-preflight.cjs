'use strict';
/**
 * TIEN404 V14.5Z LIVE03D — no-send provider identity verification CANDIDATE.
 * Source only, offline. No credentials, provider calls, n8n writes or deployment.
 *
 * Real acceptance requires a server-owned provider getMe transport, server-owned
 * registry, scoped owner allowlist AND independently verified owner association.
 * Request-supplied "verified" booleans or snapshots are NOT accepted as proof.
 */
const { createHmac, timingSafeEqual } = require('node:crypto');
const REASONS=Object.freeze({
  provider:'PROVIDER_GETME_UNAVAILABLE_OR_INVALID',
  bot:'PROVIDER_BOT_ID_UNVERIFIED',
  mapping:'SERVER_BOT_SHOP_MAPPING_MISSING_OR_AMBIGUOUS',
  scope:'TENANT_OR_SHOP_SCOPE_MISMATCH',
  owner:'OWNER_QA_BINDING_MISSING_OR_AMBIGUOUS',
  consent:'OWNER_PROVIDER_CONSENT_UNVERIFIED',
  expired:'OWNER_QA_ALLOWLIST_EXPIRED',
  config:'SERVER_ONLY_TRUST_CONFIGURATION_INCOMPLETE'
});
const idValid=s=>typeof s==='string'&&/^[0-9]{8,32}$/.test(s);
const scopeValid=s=>typeof s==='string'&&/^[a-z0-9][a-z0-9_-]{2,127}$/i.test(s);
const secureEq=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
function normalizeGetMe(body){
  const r=body?.result;
  if(!body||body.ok!==true||!r||!idValid(r.id)||typeof r.account_name!=='string'||r.account_name.length>128||r.account_name.length<1)
    return null;
  return {botId:r.id};
}
function block(reason){
  return Object.freeze({state:'BLOCKED',reason,verified:false,providerSends:0,can_send:false,can_promote_registry:false});
}
function makeVerifier(trustedDeps={}){
  const {fetchProviderGetMe,findServerBotMappings,findOwnerAllowlist,verifyOwnerWithProvider,
         expectedTenantId,expectedStoreId,hmacKey} = trustedDeps;
  const valid = [fetchProviderGetMe,findServerBotMappings,findOwnerAllowlist,verifyOwnerWithProvider].every(f=>typeof f==='function')
    &&scopeValid(expectedTenantId)&&scopeValid(expectedStoreId)
    &&Buffer.isBuffer(hmacKey)&&hmacKey.length>=32;
  // Config is supplied privately by the trusted server, never parsed from client JSON.
  if(!valid)return async()=>block(REASONS.config);
  return async function audit(readonlyContext={},nowMs=Date.now()){
    // Do not accept actor IDs or "verified=true" from request payload.
    if(!Number.isSafeInteger(nowMs)||nowMs<=0) return block(REASONS.config);
    try{
      const p=await fetchProviderGetMe();
      if(p?.transport!=='SERVER_AUTHENTICATED_PROVIDER_GETME'||p?.httpStatus!==200)
        return block(REASONS.provider);
      const bot=normalizeGetMe(p.body);
      if(!bot)return block(REASONS.bot);
      const rows=await findServerBotMappings(bot.botId);
      if(!Array.isArray(rows)||rows.length!==1)return block(REASONS.mapping);
      const mapping=rows[0];
      if(mapping?.bot_provider!=='zalo_bot_creator'||mapping?.identity_status!=='verified_provider_id'
        ||mapping?.enabled_mode!=='limited_qa'||mapping?.synthetic_fixture!==false
        ||!idValid(mapping.bot_id)||!secureEq(mapping.bot_id,bot.botId))
        return block(REASONS.mapping);
      if(!secureEq(mapping.tenant_id,expectedTenantId)||!secureEq(mapping.store_id,expectedStoreId))
        return block(REASONS.scope);
      const owners=await findOwnerAllowlist(expectedStoreId);
      if(!Array.isArray(owners)||owners.length!==1)return block(REASONS.owner);
      const owner=owners[0];
      if(owner?.status!=='ALLOWED_STAGING_OWNER'
        ||typeof owner?.chat_id!=='string'||owner.chat_id.length<4||owner.chat_id.length>200)
        return block(REASONS.owner);
      const expiry=Date.parse(owner.expires_at);
      if(!Number.isFinite(expiry)||expiry<=nowMs)return block(REASONS.expired);
      // Independent trusted verifier, e.g. provider verified Bot+chat ID+owner,
      // NOT a synthetic registry field or caller-provided boolean.
      const pair=await verifyOwnerWithProvider({botId:bot.botId,ownerChatId:owner.chat_id,
         storeId:expectedStoreId,tenantId:expectedTenantId});
      if(!pair||pair.verified!==true||pair.source!=='TRUSTED_PROVIDER_OWNER_PAIR_ATTESTOR'
        ||pair.owner_consent!==true||!Number.isSafeInteger(pair.checked_ms)
        ||Math.abs(nowMs-pair.checked_ms)>120000)return block(REASONS.consent);
      const digest=(domain,value)=>createHmac('sha256',hmacKey).update('TIEN404-LIVE03D-QA-V1\0'+domain+'\0'+value).digest('hex');
      return Object.freeze({
        state:'ELIGIBLE_FOR_SIGNED_CERTIFICATION_ONLY',
        verified:true,
        provider_bot_digest:digest('bot',bot.botId),
        tenant_digest:digest('tenant',expectedTenantId),
        store_digest:digest('store',expectedStoreId),
        owner_digest:digest('owner',owner.chat_id),
        evidence_kind:'SERVER_AUTHENTICATED_BOT_OWNER_QA_CANDIDATE',
        expires_ms:Math.min(expiry,nowMs+120000),
        providerSends:0,can_send:false,can_promote_registry:false
      });
    }catch{return block(REASONS.provider)}
  };
}
module.exports={makeVerifier,normalizeGetMe,REASONS};
