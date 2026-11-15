'use strict';
/**
 * TIEN404 V14.5Z-G2.3 — Independent Owner Evidence & Merchant Consent Gate
 * SOURCE-ONLY SECURITY CANDIDATE. Does not read actual Zalo user, Bot Manager,
 * Supabase Auth, credentials, tokens, customer data or owner chat IDs.
 * In particular, a chat message, Bot Token, screenshot, personal Zalo OAuth
 * identity or Supabase membership ALONE cannot establish merchant authority.
 * The ONLY successful result is ELIGIBLE_FOR_PRIVATE_REVIEW_ONLY: never
 * grants Owner role, changes G2.2 registry, sends Zalo, or certifies real owner.
 */
const {createPublicKey, createHash, verify} = require('node:crypto');
const HEX64=/^[a-f0-9]{64}$/,NONCE=/^[a-f0-9]{32,64}$/;
const ROLES=Object.freeze({
 zalo_user:'TIEN404_G23_ZALO_OAUTH_ACCOUNT_ATTESTOR',
 bot_manager:'TIEN404_G23_BOT_CREATOR_CONTROL_REVIEWER',
 supabase_owner:'TIEN404_G23_SUPABASE_AUTH_OWNER_ATTESTOR',
 merchant_consent:'TIEN404_G23_MERCHANT_CONSENT_ATTESTOR'
});
const BLOCK=(reasons,verified=0)=>Object.freeze({
  version:'V14.5Z-G2.3',status:'BLOCKED',
  blocked_reasons:[...new Set(reasons)],
  signed_sources_verified:verified,
  private_owner_certified:false,merchant_authority_certified:false,
  real_zalo_approved:false,owner_permission_changed:false,
  live_registry_promoted:false,can_send:false,provider_sends:0,
  orders_written:0,provider_request:null,credential_changes:0
});
const isHex=s=>HEX64.test(s||'');
function verifiedRoots(pinned){
 if(!pinned||typeof pinned!=='object'||Array.isArray(pinned))return false;
 try{
  const hashes=[];
  for(const iss of Object.values(ROLES)){
   const root=pinned[iss];
   if(typeof root!=='string'||root.length>2000)return false;
   const k=createPublicKey(root);
   if(k.asymmetricKeyType!=='ec'||k.asymmetricKeyDetails?.namedCurve!=='prime256v1')return false;
   hashes.push(createHash('sha256').update(k.export({format:'der',type:'spki'})).digest('hex'));
  }
  return new Set(hashes).size===4;
 }catch{return false}
}
function verifyEvidence(e,issuer,root,now){
 if(!e||typeof e!=='object'||typeof e.payload!=='string'||e.payload.length>3500||
    typeof e.signature!=='string'||!(/^[A-Za-z0-9_-]{86}$/.test(e.signature)))return null;
 try{
  const proof=JSON.parse(e.payload);
  if(proof.issuer!==issuer||proof.purpose!=='TIEN404_G23_OWNER_EVIDENCE_PRIVATE_REVIEW_ONLY'||
    !Number.isSafeInteger(proof.issued_ms)||!Number.isSafeInteger(proof.expires_ms)||
    proof.issued_ms>now+5000||proof.expires_ms<=now||
    proof.expires_ms-proof.issued_ms>120000||proof.expires_ms<=proof.issued_ms||
    !proof.claims||typeof proof.claims!=='object'||Array.isArray(proof.claims))return null;
  const k=createPublicKey(root);
  const ok=verify('sha256',Buffer.from(e.payload),{key:k,dsaEncoding:'ieee-p1363'},Buffer.from(e.signature,'base64url'));
  return ok?proof.claims:null;
 }catch{return null}
}
async function assessG23(input={},trusted={},now=Date.now()){
 if(!Number.isSafeInteger(now)||now<=0)return BLOCK(['INVALID_TRUSTED_TIME']);
 // There must be four separately controlled real issuer roots and durable,
 // atomic replay nonce store, supplied exclusively by trusted backend.
 if(!verifiedRoots(trusted.pinnedIssuerKeys)||
    !isHex(trusted.tenantDigest)||!isHex(trusted.storeDigest)||
    !isHex(trusted.botDigest)||
    trusted.storeScope!=='QA_SHOP_B_ONLY'||
    typeof trusted.consumeOnce!=='function'||
    typeof trusted.verifyG22CandidateReadOnly!=='function')
    return BLOCK(['HOSTED_TRUST_ROOTS_OR_ATOMIC_NONCE_STORE_NOT_CONFIGURED']);
 const claims={},reasons=[];
 for(const [role,iss] of Object.entries(ROLES)){
   claims[role]=verifyEvidence(input?.evidence?.[role],iss,trusted.pinnedIssuerKeys[iss],now);
   if(!claims[role])reasons.push('MISSING_OR_INVALID_'+role.toUpperCase()+'_SIGNED_PROOF');
 }
 const count=Object.keys(claims).filter(r=>claims[r]).length;
 if(reasons.length)return BLOCK(reasons,count);
 const ch=claims.zalo_user?.challenge_nonce;
 if(!NONCE.test(ch||'')||Object.keys(claims).some(r=>claims[r]?.challenge_nonce!==ch))
   reasons.push('INDEPENDENT_CHALLENGE_NOT_BOUND');
 for(const field of ['tenant_digest','store_digest','bot_digest','subject_digest']){
   const vals=Object.keys(claims).map(r=>claims[r]?.[field]);
   if(vals.some(v=>!isHex(v))||new Set(vals).size!==1)
     reasons.push('CROSS_ISSUER_'+field.toUpperCase()+'_MISMATCH');
 }
 if(claims.zalo_user.tenant_digest!==trusted.tenantDigest||
    claims.zalo_user.store_digest!==trusted.storeDigest||
    claims.zalo_user.bot_digest!==trusted.botDigest)
   reasons.push('SERVER_PINNED_SHOP_B_BOT_MISMATCH');
 if(claims.zalo_user.provider!=='zalo_social_oauth'||
    claims.zalo_user.authentication_method!=='ZALO_OAUTH2_PKCE_SERVER_TOKEN_EXCHANGE'||
    claims.zalo_user.authenticated_user_observed!==true||
    claims.zalo_user.account_linkage_verified!==true||
    claims.zalo_user.zalo_subject_linked_to_supabase_user!==true||
    claims.zalo_user.oauth_state_and_pkce_checked!==true||
    !isHex(claims.zalo_user.zalo_user_digest)||
    !Number.isSafeInteger(claims.zalo_user.auth_time_ms)||
    now-claims.zalo_user.auth_time_ms>300000||
    claims.zalo_user.auth_time_ms>now+5000)
   reasons.push('ZALO_OAUTH_OR_ACCOUNT_LINKAGE_NOT_VERIFIED');
 // Zalo OAuth user identity does NOT attest ownership of the Bot Creator bot.
 // Require separately signed controlled Bot Manager review with challenge.
 if(claims.bot_manager.source!=='INDEPENDENT_BOT_CREATOR_CONTROL_REVIEW'||
    claims.bot_manager.bot_creator_authenticated_session_verified!==true||
    claims.bot_manager.provider_control_challenge_verified!==true||
    claims.bot_manager.review_operator_distinct_from_owner===false||
    claims.bot_manager.review_operator_distinct_from_owner!==true||
    claims.bot_manager.bot_manager_control_verified!==true||
    !Number.isSafeInteger(claims.bot_manager.checked_ms)||
    Math.abs(now-claims.bot_manager.checked_ms)>300000)
   reasons.push('INDEPENDENT_BOT_MANAGER_CONTROL_NOT_ATTESTED');
 if(claims.supabase_owner.source!=='SUPABASE_AUTH_TRUSTED_SERVER'||
    claims.supabase_owner.jwt_validated_server_side!==true||
    claims.supabase_owner.membership_tenant_pinned===false||
    claims.supabase_owner.membership_tenant_pinned!==true||
    claims.supabase_owner.membership_role!=='owner'||
    claims.supabase_owner.membership_active!==true||
    claims.supabase_owner.query_readonly!==true||
    claims.supabase_owner.owner_membership_unique_for_subject!==true||
    !Number.isSafeInteger(claims.supabase_owner.checked_ms)||
    Math.abs(now-claims.supabase_owner.checked_ms)>300000)
   reasons.push('TRUSTED_SUPABASE_OWNER_MEMBERSHIP_NOT_VERIFIED');
 if(claims.merchant_consent.source!=='AUTHENTICATED_MERCHANT_DASHBOARD'||
    claims.merchant_consent.consent_explicit!==true||
    claims.merchant_consent.consent_revoked!==false||
    claims.merchant_consent.consent_scope!=='G23_BOT_SHOP_B_QA_IDENTITY_ONLY_NO_SEND'||
    claims.merchant_consent.terms_version!=='G23-V1-NO-SEND'||
    claims.merchant_consent.user_gesture_verified!==true||
    !Number.isSafeInteger(claims.merchant_consent.consent_ms)||
    Math.abs(now-claims.merchant_consent.consent_ms)>300000||
    !Number.isSafeInteger(claims.merchant_consent.consent_expires_ms)||
    claims.merchant_consent.consent_expires_ms<=now||
    claims.merchant_consent.consent_expires_ms-now>86400000)
   reasons.push('MERCHANT_CONSENT_NOT_INDEPENDENT_OR_EXPLICIT');
 // Old allowlist is context, not proof; must be live and attached to SAME
 // bound identity before any private review recommendation.
 if(claims.merchant_consent.owner_allowlist_verified!==true||
    !Number.isSafeInteger(claims.merchant_consent.owner_allowlist_exp_ms)||
    claims.merchant_consent.owner_allowlist_exp_ms<=now)
   reasons.push('OWNER_ALLOWLIST_EXPIRED_OR_UNBOUND');
 if(reasons.length)return BLOCK(reasons,count);
 let candidate=false;
 try{candidate=await trusted.verifyG22CandidateReadOnly({
    scope:'QA_SHOP_B_ONLY',tenantDigest:trusted.tenantDigest,
    botDigest:trusted.botDigest,storeDigest:trusted.storeDigest
 });}catch{}
 if(candidate!==true)return BLOCK(['G22_CANDIDATE_NOT_AVAILABLE_OR_EXPIRED'],count);
 let consumed=false;
 try{consumed=(await trusted.consumeOnce({
   scope:'G23_OWNER_QA_PRIVATE_REVIEW',nonce:ch,
   subjectDigest:claims.supabase_owner.subject_digest,
   ttlMs:120000}))===true;}catch{}
 if(!consumed)return BLOCK(['CHALLENGE_REPLAY_OR_DURABLE_STORE_UNAVAILABLE'],count);
 return Object.freeze({
   version:'V14.5Z-G2.3',status:'ELIGIBLE_FOR_PRIVATE_HUMAN_REVIEW_ONLY',
   source_proofs_verified:4,signed_sources_verified:4,
   review_scope:'QA_SHOP_B_ONLY',
   expires_ms:Math.min(claims.merchant_consent.consent_expires_ms,
     claims.merchant_consent.owner_allowlist_exp_ms,now+120000),
   challenge_consumed:true,
   private_owner_certified:false,merchant_authority_certified:false,
   owner_permission_changed:false,live_registry_promoted:false,
   real_zalo_approved:false,can_send:false,provider_sends:0,
   orders_written:0,provider_request:null,credential_changes:0
 });
}
module.exports={assessG23,verifiedRoots,ROLES};
