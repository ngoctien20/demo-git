// TIEN404 V17.7H.1 — Private QA Owner × Operator × Reviewer
// OFFLINE cryptographic fixture only. This never calls provider/getMe, JWT,
// Supabase, Cloudflare, n8n, or a webhook; it never reads merchant/customer data.
// A valid signature here verifies a TEST KEY, NOT Zalo Bot Creator/Meta admin
// authority and NOT Store owner permission. Real hosted admission always NO-GO.
import {createHash, verify as verifySignature} from 'node:crypto';

const ROLES=Object.freeze(['owner','operator','reviewer']);
const CHANNELS=Object.freeze(['ZALO_BOT','MESSENGER']);
const AUDIENCE='TIEN404_V17_7H1_QA_OWNER_ADMISSION_OFFLINE_ONLY';
const HEX=/^[a-f0-9]{64}$/;
const REF=/^[A-Za-z0-9][A-Za-z0-9_-]{11,95}$/;
const SIG=/^[A-Za-z0-9_-]{80,128}$/;
const MAX_AGE=10*60*1000;
const MAX_BYTES=4096;
const TOP_KEYS=new Set(['mode','audience','challengeId','channel',
  'installationRef','providerAccountRef','issuedAtMs','expiresAtMs',
  'scope','noSend','noCommerceRead','noCommerceWrite','signatures']);
const SIG_KEYS=new Set(['role','signature']);
const GATE=Object.freeze({
  sourceOnly:true,
  providerBotOwnerAuthenticated:false,
  providerAdminRoleReadbackVerified:false,
  realStoreOwnerAuthenticated:false,
  independentOperatorAuthenticated:false,
  independentReviewerAuthenticated:false,
  realProviderWebhookSignatureVerified:false,
  realHostedDurableReplayVerified:false,
  realStoreAbJwtRlsVerified:false,
  canOpenPublicCallback:false,
  canChangeProviderWebhook:false,
  canUseProductionCredential:false,
  canSendProviderMessage:false,
  canReadCommerce:false,
  canWriteCommerce:false,
  canPublish:false
});
const fail=(reason,additional={})=>Object.freeze({
  cryptographicFixtureCandidate:false,reason,...GATE,...additional
});
const candidate=(additional={})=>Object.freeze({
  cryptographicFixtureCandidate:true,
  reason:'OFFLINE_THREE_ROLE_SIGNATURES_VALID_NOT_PROVIDER_OWNERSHIP',
  ...GATE,...additional
});
function canonical(ticket) {
  // Strict fixed field order; transport never exposes the signers' PII.
  return JSON.stringify([
    AUDIENCE,ticket.challengeId,ticket.channel,
    ticket.installationRef,ticket.providerAccountRef,
    ticket.issuedAtMs,ticket.expiresAtMs,ticket.scope,
    ticket.noSend,ticket.noCommerceRead,ticket.noCommerceWrite
  ]);
}
export function offlineRoleSigningBytes(ticket,role){
  if(!ROLES.includes(role))throw Error('UNKNOWN_OFFLINE_ROLE');
  return Buffer.from('TIEN404_V17_7H1_TEST_ONLY\n'+canonical(ticket)+'\nROLE:'+role,'utf8');
}
/** deps is a known synthetic key registry from the LOCAL test harness.
 * Real owner attestation must use a separate private authenticated issuer
 * and native provider admin readback; caller supplied PEM is not sufficient.
 */
export async function inspectThreeRoleOfflineChallenge(ticket,trust,deps){
  if(!ticket||typeof ticket!=='object'||Array.isArray(ticket)||
     ticket.mode!=='OFFLINE_SYNTHETIC_NO_SEND'||
     ticket.audience!==AUDIENCE||
     ticket.scope!=='ONE_DISPOSABLE_QA_BOT_OR_PAGE_NO_SEND'||
     ticket.noSend!==true||ticket.noCommerceRead!==true||
     ticket.noCommerceWrite!==true ||
     Object.keys(ticket).some(k=>!TOP_KEYS.has(k)))
    return fail('CHALLENGE_NOT_PRIVATE_QA_ONLY');
  if(!CHANNELS.includes(ticket.channel)||!REF.test(ticket.challengeId??'')||
    !REF.test(ticket.installationRef??'')||
    !REF.test(ticket.providerAccountRef??'')||
    !Number.isSafeInteger(ticket.issuedAtMs)||
    !Number.isSafeInteger(ticket.expiresAtMs)||
    ticket.expiresAtMs<=ticket.issuedAtMs||
    ticket.expiresAtMs-ticket.issuedAtMs>MAX_AGE)
    return fail('UNPINNED_PROVIDER_OR_CHALLENGE_TIMEBOX');
  if(!deps||deps.mode!=='OFFLINE_MEMORY_ONLY'||
     !Number.isSafeInteger(deps.nowMs)||
     typeof deps.reserveChallengeOnce!=='function'||
     deps.nowMs<ticket.issuedAtMs||
     deps.nowMs>ticket.expiresAtMs)
    return fail('OFFLINE_REPLAY_OR_TIMEBOX_NOT_ESTABLISHED');
  if(!trust||trust.source!=='OFFLINE_EPHEMERAL_TEST_KEYS'||
     !trust.keys||typeof trust.keys!=='object'||
     Object.keys(trust.keys).length!==3||
     !ROLES.every(role=>Object.hasOwn(trust.keys,role))||
     !Array.isArray(ticket.signatures)||
     ticket.signatures.length!==3||
     new Set(ticket.signatures.map(x=>x?.role)).size!==3)
    return fail('THREE_DISTINCT_INDEPENDENT_ROLES_REQUIRED');
  const fingerprints=[];
  for(const role of ROLES){
    const k=trust.keys[role];
    const signs=ticket.signatures.filter(x=>x?.role===role);
    if(signs.length!==1 || !k || typeof k.publicKey!=='string'||
       k.publicKey.length>MAX_BYTES ||
       !HEX.test(k.actorDigest??'') ||
       k.source!=='OFFLINE_TEST_IDENTITY' ||
       Object.keys(signs[0]).some(x=>!SIG_KEYS.has(x))||
       !SIG.test(signs[0].signature??''))
      return fail('SIGNER_RECEIPT_SHAPE_INVALID');
    fingerprints.push(createHash('sha256').update(k.publicKey).digest('hex'));
  }
  if(new Set(fingerprints).size!==3||
     new Set(ROLES.map(x=>trust.keys[x].actorDigest)).size!==3)
    return fail('SAME_ACTOR_OR_KEY_REUSED_FOR_MULTIPLE_ROLES');
  try{
    for(const role of ROLES){
      const sig=ticket.signatures.find(x=>x.role===role).signature;
      const valid=verifySignature(null,
        offlineRoleSigningBytes(ticket,role),
        trust.keys[role].publicKey,
        Buffer.from(sig,'base64url'));
      if(!valid)return fail('ROLE_SIGNATURE_INVALID_OR_CHALLENGE_TAMPERED');
    }
  }catch{
    return fail('UNTRUSTED_PUBLIC_KEY_OR_SIGNATURE');
  }
  // Mock local Set only. The real RPC17.2 durable replay proof remains pending.
  let fresh=false;
  const digest=createHash('sha256').update(canonical(ticket)).digest('hex');
  try{fresh=await deps.reserveChallengeOnce(digest);}catch{
    return fail('REPLAY_BACKEND_UNAVAILABLE');
  }
  if(fresh!==true)return fail('CHALLENGE_ALREADY_USED_OR_REPLAYED');
  return candidate({
    verifiedSyntheticSignatureCount:3,
    independentlyVerifiedProviderOwnerCount:0,
    realSourceReadbacks:0,
    realKeyRegistryInstalled:false,
    hostedChallengeReservationVerified:false
  });
}
export function getPrivateOwnerVerificationPlan(channel){
  if(!CHANNELS.includes(channel))return fail('NO_OWNER_ADMISSION_FOR_OA_OR_UNSUPPORTED_CHANNEL');
  return Object.freeze({
    channel,steps:Object.freeze([
      'PIN_DISPOSABLE_BOT_OR_PAGE_ID_NO_CUSTOMER_DATA',
      'AUTHENTICATE_OWNER_IN_REAL_PROVIDER_ADMIN_PORTAL_PRIVATELY',
      'READ_ONLY_PROVIDER_BOT_OR_PAGE_ID_CONFIRMATION_BY_TRUSTED_OPERATOR',
      'INDEPENDENT_OPERATOR_AND_REVIEWER_IDENTITY_BINDING',
      'EXACT_SCOPED_CONSENT_AND_EXPIRY_NO_PRODUCTION_WEBHOOK_CHANGE',
      'VERIFY_HOSTED_LEDGER_AND_NO_SEND_CALLBACK_BEFORE_1_TEST_EVENT',
      'RUN_INDEPENDENT_ZERO_PROVIDER_SEND_AND_ZERO_COMMERCE_WRITES'
    ]),...GATE,
    admissionState:'REAL_OWNER_PROVIDER_UAT_NO_GO'
  });
}
export function prohibitRealAdmissionFromSelfReportedGreen(_evidence){
  return fail('REAL_PROVIDER_OWNER_OPERATOR_AND_HOSTED_REPLAY_NOT_ATTESTED',{
    blocked:Object.freeze([
      'PROVIDER_MANAGED_QA_OWNER_ADMIN_SESSION_MISSING',
      'TRUSTED_GETME_OR_PAGE_READBACK_MISSING',
      'INDEPENDENT_OPERATOR_REVIEWER_PROOF_MISSING',
      'REAL_DURABLE_REPLAY_AND_QUOTA_MISSING',
      'PROVIDER_NATIVE_SIGNED_NO_SEND_WEBHOOK_NOT_TESTED',
      'STORE_A_B_REAL_JWT_RLS_STILL_NO_GO'
    ])
  });
}
export const offlineOwnerAudience=AUDIENCE;
