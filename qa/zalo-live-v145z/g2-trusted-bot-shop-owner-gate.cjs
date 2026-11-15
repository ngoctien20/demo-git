'use strict';
/**
 * TIEN404 V14.5Z-G2 — PRIVATE, READ-ONLY Bot→Shop B→Owner QA attestation gate.
 * No provider/network I/O, secrets, credential access, database writes,
 * token handling, registry promotion or Zalo dispatch.
 *
 * Each role's signature is verified against a distinct server-PINNED P256 key.
 * None are provisioned yet. Any client-supplied trust roots are untrusted.
 * The actual Zalo getMe response is not itself signed by Zalo:
 * an authenticated SERVER attestor must sign its read-only observation.
 *
 * The nonce is consumed in a durable, trusted single-use store injected from
 * the server; caller-provided booleans NEVER prove replay protection.
 */
const { createHash, createPublicKey }=require('node:crypto');
const { verifyProof, ISSUER }=require('./live03-identity-budget-gate.cjs');
const ROLES=Object.freeze(['provider','registry','owner','hosted']);
const HASH=/^[0-9a-f]{64}$/,NONCE=/^[0-9a-f]{32,64}$/;
const blocked=(reasons,verified=0)=>Object.freeze({
  version:'V14.5Z-G2',
  status:'BLOCKED',
  blocked_reasons:[...new Set(reasons)],
  trusted_signatures_verified:verified,
  real_provider_bot_shop_owner_certified:false,
  client_qa_can_promote_registry:false,
  can_send:false,
  provider_sends:0,
  provider_request:null,
  credential_mutations:0,
  live_workflow_changes:0,
});
function distinctPinnedRoots(roots){
 try{
  if(!roots||typeof roots!=='object')return false;
  const fp=[];
  for(const role of ROLES){
   const pub=roots[ISSUER[role]];
   if(!pub||typeof pub!=='string'||pub.length>2000)return false;
   const key=createPublicKey(pub);
   if(key.asymmetricKeyType!=='ec'||key.asymmetricKeyDetails?.namedCurve!=='prime256v1')return false;
   fp.push(createHash('sha256').update(key.export({format:'der',type:'spki'})).digest('hex'));
  }
  return new Set(fp).size===ROLES.length;
 }catch{return false;}
}
async function assessG2(input={},server={},nowMs=Date.now()){
 if(!Number.isSafeInteger(nowMs)||nowMs<=0)return blocked(['INVALID_TRUSTED_SERVER_CLOCK']);
 // Keys, pinning and nonce store are supplied by trusted backend, never body.
 if(!distinctPinnedRoots(server?.pinnedKeys)||
    typeof server?.consumeNonceOnce!=='function'||
    !HASH.test(server?.expectedTenantDigest||'')||
    !HASH.test(server?.expectedStoreDigest||'')||
    server?.scope!=='SHOP_B_STAGING_ONLY')
   return blocked(['TRUSTED_ISSUER_KEYS_OR_NONCE_STORE_NOT_CONFIGURED']);
 const claims={},errors=[];
 for(const role of ROLES){
  claims[role]=verifyProof(role,input?.evidence?.[role],server.pinnedKeys,nowMs);
  if(!claims[role])errors.push('MISSING_SIGNED_'+role.toUpperCase()+'_PROOF');
 }
 const verified=ROLES.filter(r=>claims[r]).length;
 if(errors.length)return blocked(errors,verified);
 const p=claims.provider,r=claims.registry,o=claims.owner,h=claims.hosted;
 const nonce=p?.challenge_nonce;
 if(!NONCE.test(nonce||'')||ROLES.some(role=>claims[role]?.challenge_nonce!==nonce))
    errors.push('CHALLENGE_NONCE_UNBOUND_OR_MISMATCHED');
 const digests=['bot_digest','tenant_digest','store_digest','owner_digest'];
 for(const field of digests){
   const values=ROLES.map(role=>claims[role]?.[field]);
   if(values.some(v=>!HASH.test(v||''))||new Set(values).size!==1)
     errors.push('IDENTITY_'+field.toUpperCase()+'_MISMATCH');
 }
 if(r.tenant_digest!==server.expectedTenantDigest||
    r.store_digest!==server.expectedStoreDigest)
    errors.push('SERVER_PINNED_TENANT_STORE_MISMATCH');
 if(p.provider!=='zalo_bot_creator'||p.source!=='SERVER_HTTPS_ZALO_GETME'||
    p.api_method!=='POST'||p.getme_http_status!==200||
    p.getme_result_id_string!==true||p.id_is_official_provider_result!==true||
    p.actual_api_call_readonly!==true)
    errors.push('OFFICIAL_GETME_PROVIDER_ID_NOT_ATTESTED');
 if(r.bot_provider!=='zalo_bot_creator'||
    r.server_side_lookup!==true||r.match_count!==1||
    r.identity_status!=='verified_provider_id'||
    r.registry_mode!=='limited_qa'||r.synthetic_fixture!==false||
    r.store_scope!=='SHOP_B_STAGING_ONLY')
    errors.push('SHOP_B_TRUSTED_RESOLVER_NOT_ATTESTED');
 if(o.owner_allowlist_matches===false||o.owner_allowlist_matches!==true||
    o.provider_owner_pair_verified!==true||
    o.consent_explicit_for_qa!==true||
    o.consent_source!=='INDEPENDENT_PROVIDER_OWNER_ATTESTOR'||
    !Number.isSafeInteger(o.provider_checked_ms)||
    Math.abs(nowMs-o.provider_checked_ms)>120000||
    !Number.isSafeInteger(o.owner_allowlist_exp_ms)||
    o.owner_allowlist_exp_ms<=nowMs)
    errors.push('INDEPENDENT_OWNER_PAIR_OR_CONSENT_MISSING');
 if(h.readonly_ingress_verified!==true||
    h.protected_webhook_verified!==true||
    h.webhook_matches_staging!==true||
    h.trusted_bot_scope!=='SINGLE_REAL_BOT_TO_SHOP_B'||
    h.synthetic_binding_removed===false||h.synthetic_binding_removed!==true||
    h.no_send_kill_switch===false||h.no_send_kill_switch!==true||
    h.real_orders_disabled!==true)
    errors.push('REAL_HOSTED_INGRESS_NOT_ATTESTED');
 // The same nonce may only be consumed after all independent signed evidence
 // matches. The backing store must provide atomic compare-and-set and expiry.
 if(errors.length)return blocked(errors,verified);
 let consumed=false;
 try{consumed=(await server.consumeNonceOnce({nonce,botDigest:r.bot_digest,
     storeDigest:r.store_digest,ttlMs:120000,scope:'G2_SHOP_B_QA'}))===true;}catch{}
 if(!consumed)return blocked(['CHALLENGE_REPLAY_OR_STORE_UNAVAILABLE'],verified);
 return Object.freeze({
   version:'V14.5Z-G2',
   status:'ELIGIBLE_FOR_PRIVATE_OWNER_REVIEW_ONLY',
   trusted_signatures_verified:verified,
   real_provider_bot_shop_owner_certified:false, // Requires operator evidence review, not solely booleans.
   reviewed_real_provider_evidence:false,
   identity_digest_ref:r.bot_digest,
   store_digest_ref:r.store_digest,
   owner_digest_ref:r.owner_digest,
   challenge_consumed:true,
   provider_sends:0,can_send:false,provider_request:null,
   client_qa_can_promote_registry:false,
   live_workflow_changes:0,credential_mutations:0
 });
}
module.exports={assessG2,distinctPinnedRoots,ROLES};
