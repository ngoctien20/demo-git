// TIEN404 V17.ZALO-SOURCE-04C — offline private OA + Access attestation contract.
// NO provider API, no real Merchant, no OAuth, no hosted Worker or DB.
// Ed25519 public-key verification here tests PRIVATE attestor-shaped receipts using
// GENERATED TEST KEYS; it does NOT prove Zalo OA ownership or Cloudflare Access.
import {createHash, verify as verifySignature} from 'node:crypto';
const ID=/^[A-Za-z0-9_-]{1,128}$/;
const OA=/^[0-9]{5,25}$/;
const HEX=/^[a-f0-9]{64}$/;
const MINUTE=60_000;
const TIMESPAN=5*MINUTE;
const sha=s=>createHash('sha256').update(s,'utf8').digest('hex');
const valid=s=>typeof s==='string'&&ID.test(s);
const clock=n=>Number.isSafeInteger(n)&&n>0;
const fail=reason=>Object.freeze({candidate:false,reason,realProviderVerified:false,accessHostedVerified:false,
  realCanaryExecuted:false,canReceiveRealTraffic:false,canActivate:false,canSend:false,canWriteOrders:false,sourceOnly:true});
const pending=stage=>Object.freeze({candidate:true,stage,realProviderVerified:false,accessHostedVerified:false,
  realCanaryExecuted:false,canReceiveRealTraffic:false,canActivate:false,canSend:false,canWriteOrders:false,sourceOnly:true});
const ALLOWED_SCOPE='OA_PROFILE_READ_ONLY_AND_WEBHOOK_NO_SEND';
const REQUIRED_AUD='TIEN404_QA_ZALO_OA_OWNER_V1';

export function verifyOfflineAttestationEnvelope(envelope,key,kind){
  if(!envelope||typeof envelope!=='object'||Array.isArray(envelope)||
      !envelope.payload||typeof envelope.payload!=='object'||Array.isArray(envelope.payload)||
      envelope.payload.kind!==kind||envelope.payload.audience!==REQUIRED_AUD||
      envelope.payload.version!==1||
      typeof envelope.signature!=='string'||!/^[A-Za-z0-9_-]{86}$/.test(envelope.signature)||
      !key) return false;
  // Byte-stable JSON contract only for the Node offline fixture; production must
  // pin a canonical encoding (e.g. JCS) and verify a real private issuer key registry.
  try{
    const bytes=Buffer.from(JSON.stringify(envelope.payload),'utf8');
    return verifySignature(null,bytes,key,Buffer.from(envelope.signature,'base64url'));
  }catch{return false;}
}

export function inspectDedicatedAccessConfig(app, pinned){
  if(!app||!pinned||typeof pinned.domain!=='string'||
      !/^[a-z0-9-]+\.workers\.dev$/.test(pinned.domain)||
      app.type!=='self_hosted'||app.name!==pinned.name||
      app.aud!==pinned.aud||app.domain!==pinned.domain||
      !valid(app.id)||app.enabled!==true||
      !Array.isArray(app.policies)||app.policies.length===0)
    return fail('DEDICATED_ACCESS_APPLICATION_UNVERIFIED');
  if(app.policies.some(p=>!p||p.decision==='bypass'||
    p.decision==='non_identity'||p.decision==='service_auth'||
    p.anyone===true||p.everyone===true||p.includeEveryone===true))
    return fail('ACCESS_BYPASS_OR_BROAD_POLICY_FORBIDDEN');
  if(app.policies.some(p=>p.decision!=='allow'||p.active!==true||
      !Array.isArray(p.allowedActorIds)||p.allowedActorIds.length===0||
      p.allowedActorIds.some(x=>!valid(x))))
    return fail('ACCESS_OPERATOR_ALLOWLIST_REQUIRED');
  return pending('OFFLINE_ACCESS_CONFIGURATION_SHAPE_MATCH_ONLY');
}

/** All data arrives from trust-separated private injected backend providers in tests.
 * No input OA ID, token or arbitrary URL is ever accepted. Two independent private
 * attestors must sign the receipts; signed claims are not live-provider evidence.
 */
export async function evaluatePrivateOaCanaryAdmission(deps){
  if(!deps||deps.executionMode!=='OFFLINE_FIXTURE_ONLY'||deps.liveEnabled!==false||
      typeof deps.loadMerchantAttestation!=='function'||
      typeof deps.loadOperatorAttestation!=='function'||
      typeof deps.readOperatorIdentity!=='function'||
      typeof deps.readOwnerSession!=='function'||
      typeof deps.checkStoreOwnership!=='function'||
      typeof deps.loadAccessConfig!=='function'||
      typeof deps.reserveOneShot!=='function'||
      !deps.merchantAttestorPublicKey||!deps.operatorAttestorPublicKey||
      !deps.pinnedAccess) return fail('SOURCE_ONLY_TRUST_DEPENDENCIES_MISSING');
  const now=deps.nowMs??Date.now();
  if(!clock(now))return fail('CLOCK_INVALID');
  let owner,operator,merchant,approval,config;
  try{
    [owner,operator,merchant,approval,config]=await Promise.all([
      deps.readOwnerSession(),deps.readOperatorIdentity(),deps.loadMerchantAttestation(),
      deps.loadOperatorAttestation(),deps.loadAccessConfig()
    ]);
  }catch{return fail('PRIVATE_EVIDENCE_NOT_AVAILABLE');}
  if(!owner||owner.authenticated!==true||owner.revoked!==false||
      !valid(owner.actorId)||!valid(owner.sessionId))
    return fail('CURRENT_SUPABASE_OWNER_SESSION_REQUIRED');
  if(!operator||operator.accessVerified!==true||operator.revoked!==false||
      !valid(operator.actorId)||!valid(operator.aud)||
      operator.aud!==deps.pinnedAccess.aud||operator.actorId===owner.actorId)
    return fail('INDEPENDENT_CLOUDFLARE_OPERATOR_REQUIRED');
  if(inspectDedicatedAccessConfig(config,deps.pinnedAccess).candidate!==true)
    return fail('DEDICATED_ACCESS_POLICY_NOT_APPROVED');
  if(!config.policies.some(p=>p.allowedActorIds.includes(operator.actorId)))
    return fail('OPERATOR_NOT_ON_ACCESS_ALLOWLIST');
  if(!verifyOfflineAttestationEnvelope(merchant,deps.merchantAttestorPublicKey,'MERCHANT_OA_GRANT'))
    return fail('MERCHANT_ATTESTATION_SIGNATURE_INVALID');
  const m=merchant.payload;
  if(!OA.test(m.appId??'')||!OA.test(m.oaId??'')||
      !valid(m.tenantId)||!valid(m.storeId)||!valid(m.ownerActorId)||
      m.ownerActorId!==owner.actorId||
      m.sessionDigest!==sha(owner.sessionId)||
      m.profileReadbackOaId!==m.oaId||
      m.claimedCallbackOaId!==m.oaId||
      m.source!=='PRIVATE_OAUTH_EXCHANGE_AND_OA_READBACK'||
      m.ownerAdminConsentVerified!==true||
      m.oauthStateBound===false||m.oauthStateBound!==true||
      m.scope!==ALLOWED_SCOPE||m.noSendConsent!==true||
      m.customerDataAllowed!==false||
      !clock(m.issuedAtMs)||!clock(m.expiresAtMs)||
      m.issuedAtMs>now||now-m.issuedAtMs>TIMESPAN||
      m.expiresAtMs<=now||m.expiresAtMs>now+TIMESPAN)
    return fail('OA_ADMIN_GRANT_BINDING_UNVERIFIED');
  let owns=false;
  try{owns=(await deps.checkStoreOwnership({actorId:owner.actorId,tenantId:m.tenantId,storeId:m.storeId}))===true;}
  catch{return fail('STORE_OWNERSHIP_SERVICE_UNAVAILABLE');}
  if(!owns)return fail('REAL_STORE_OWNERSHIP_NOT_VERIFIED');
  if(!verifyOfflineAttestationEnvelope(approval,deps.operatorAttestorPublicKey,'INDEPENDENT_OPERATOR_NO_SEND'))
    return fail('INDEPENDENT_OPERATOR_SIGNATURE_INVALID');
  const op=approval.payload;
  const grantDigest=sha(JSON.stringify(merchant.payload));
  if(op.operatorActorId!==operator.actorId||op.operatorActorId===m.ownerActorId||
     op.grantDigest!==grantDigest||op.accessAud!==deps.pinnedAccess.aud||
     op.tenantId!==m.tenantId||op.storeId!==m.storeId||
     op.maxProviderSends!==0||op.maxOrderWrites!==0||
     op.maxStockWrites!==0||op.maxBillableCalls!==0||
     op.allowHostedDeployment!==false||op.noSendOnly!==true||
     !clock(op.issuedAtMs)||!clock(op.expiresAtMs)||
     op.issuedAtMs>now||op.expiresAtMs<=now||
     op.expiresAtMs>now+TIMESPAN)
    return fail('OPERATOR_NO_SEND_APPROVAL_NOT_MATCHED');
  let reserved=false;
  try{reserved=await deps.reserveOneShot(sha(grantDigest+':'+op.operatorActorId+':'+op.accessAud));}
  catch{return fail('DURABLE_ONE_SHOT_SERVICE_UNAVAILABLE');}
  if(reserved!==true)return fail('DUPLICATE_OR_REPLAY');
  return pending('SYNTHETIC_SIGNED_RECEIPT_GATE_PASSED_REAL_UAT_STILL_BLOCKED');
}
