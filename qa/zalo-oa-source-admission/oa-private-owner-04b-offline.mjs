// TIEN404 V17.ZALO-SOURCE-04B — private merchant/OA authority admission, OFFLINE ONLY.
// No network, no OAuth or provider calls, no credential handling, no hosted DB, no traffic.
// Dependencies below are trusted server-side interfaces simulated ONLY by unit tests.
import {createHash, timingSafeEqual} from 'node:crypto';

const MODE='OFFLINE_FIXTURE_ONLY';
const ID=/^[A-Za-z0-9_-]{1,128}$/;
const OA=/^[0-9]{5,25}$/;
const SHA=/^[a-f0-9]{64}$/;
const TOLERANCE_MS=5*60*1000;
export const no=(reason)=>Object.freeze({
  accepted:false, reason, noSend:true, noOrderWrite:true, canActivate:false,
  canReceiveProviderTraffic:false, hostedWrite:false, sourceOnly:true
});
const digest=(s)=>createHash('sha256').update(s,'utf8').digest('hex');
const eq=(a,b)=>SHA.test(a??'')&&SHA.test(b??'')&&timingSafeEqual(Buffer.from(a,'hex'),Buffer.from(b,'hex'));
const valid=(x)=>typeof x==='string'&&ID.test(x);
const clock=(n)=>Number.isSafeInteger(n)&&n>0;

/** PRIVATE interfaces (all mocks in this branch):
 * deps.getTrustedOperator(): operator authenticated by actual Cloudflare Access ctx.access.
 * deps.authenticateOwner(proof): current Supabase Auth identity; never client user_metadata.
 * deps.authorizeStoreOwner: fresh trusted DB lookup; never input tenant claims alone.
 * deps.consumeMerchantEvidence(handle): independently attested OA admin consent receipt.
 * deps.consumeOperatorApproval(handle): distinct independent one-use operator approval.
 * deps.reserveCanaryOnce(key): atomic durable one-use reservation by reference.
 * Must not return or log OA ID, bearer token, session ID, evidence body or personal data.
 */
export async function admitPrivateOaOwnerNoSend(input,deps){
  if(!deps||deps.executionMode!==MODE||deps.liveEnabled!==false||
    typeof deps.getTrustedOperator!=='function'||
    typeof deps.authenticateOwner!=='function'||
    typeof deps.authorizeStoreOwner!=='function'||
    typeof deps.consumeMerchantEvidence!=='function'||
    typeof deps.consumeOperatorApproval!=='function'||
    typeof deps.reserveCanaryOnce!=='function')
    return no('NO_TRUSTED_PRIVATE_GATE');
  if(!input||typeof input.ownerSessionProof!=='string'||input.ownerSessionProof.length<5||
    input.ownerSessionProof.length>2048||
    !valid(input.merchantEvidenceHandle)||!valid(input.operatorApprovalHandle))
    return no('BAD_PRIVATE_REFERENCE');
  const now=deps.nowMs??Date.now();
  if(!clock(now))return no('INVALID_CLOCK');
  let operator, owner;
  try{
    operator=await deps.getTrustedOperator();
    owner=await deps.authenticateOwner(input.ownerSessionProof);
  }catch{return no('PRIVATE_IDENTITY_UNAVAILABLE');}
  if(!operator||operator.accessAuthenticated!==true||operator.revoked!==false||
    !valid(operator.actorId)||!valid(operator.sessionId))return no('OPERATOR_ACCESS_REQUIRED');
  if(!owner||owner.authenticated!==true||owner.revoked!==false||
    !valid(owner.actorId)||!valid(owner.sessionId))return no('OWNER_SUPABASE_AUTH_REQUIRED');
  if(operator.actorId===owner.actorId)return no('OWNER_OPERATOR_SEPARATION_REQUIRED');

  let merchant;
  try{merchant=await deps.consumeMerchantEvidence(input.merchantEvidenceHandle);}
  catch{return no('PRIVATE_MERCHANT_ATTESTATION_UNAVAILABLE');}
  if(!merchant||merchant.source!=='PRIVATE_INDEPENDENT_OA_ADMIN_VERIFIER'||
    merchant.status!=='VERIFIED_QA_NO_SEND'||merchant.provider!=='ZALO_OA'||
    !OA.test(merchant.oaId??'')||!OA.test(merchant.appId??'')||
    !valid(merchant.tenantId)||!valid(merchant.storeId)||!valid(merchant.consentId)||
    merchant.ownerActorId!==owner.actorId||!eq(merchant.sessionDigest,digest(owner.sessionId))||
    !clock(merchant.verifiedAtMs)||!clock(merchant.expiresAtMs)||
    merchant.verifiedAtMs>now||now-merchant.verifiedAtMs>TOLERANCE_MS||
    merchant.expiresAtMs<=now||merchant.noSendConsent!==true||
    merchant.scope!=='OA_PROFILE_READ_ONLY_AND_WEBHOOK_NO_SEND'||
    merchant.customerDataAccessAllowed!==false)
    return no('MERCHANT_OA_ADMIN_EVIDENCE_NOT_VERIFIED');
  let authorized=false;
  try{authorized=(await deps.authorizeStoreOwner({actorId:owner.actorId,tenantId:merchant.tenantId,storeId:merchant.storeId,action:'CONNECT_ZALO_OA_QA_NO_SEND'}))===true;}
  catch{return no('STORE_AUTHORITY_UNAVAILABLE');}
  if(!authorized)return no('STORE_OWNER_NOT_AUTHORIZED');
  let approval;
  try{approval=await deps.consumeOperatorApproval(input.operatorApprovalHandle);}
  catch{return no('OPERATOR_APPROVAL_UNAVAILABLE');}
  const bindingDigest=digest(JSON.stringify([
    'TIEN404_04B', merchant.provider, merchant.appId, merchant.oaId,
    merchant.tenantId, merchant.storeId, merchant.consentId, owner.actorId
  ]));
  if(!approval||approval.status!=='APPROVED_NO_SEND_ONLY'||
    approval.operatorId!==operator.actorId||approval.operatorId===owner.actorId||
    !eq(approval.bindingDigest,bindingDigest)||!clock(approval.expiresAtMs)||
    approval.expiresAtMs<=now||approval.maxProviderSends!==0||
    approval.maxOrderWrites!==0||approval.maxStockWrites!==0||
    approval.maxBillableCalls!==0||approval.allowDeployment!==false||
    approval.requiresAccessProtectedRunner!==true)
    return no('INDEPENDENT_APPROVAL_NOT_VERIFIED');
  // Reservation is a simulation, not a live hosted replay store.
  let fresh;
  try{fresh=await deps.reserveCanaryOnce(bindingDigest);}
  catch{return no('REPLAY_GATE_UNAVAILABLE');}
  if(fresh!==true)return no('CANARY_ALREADY_RESERVED');
  return Object.freeze({
    accepted:true,stage:'OFFLINE_QA_ONLY_PENDING_REAL_PROVIDER_UAT',
    noSend:true,noOrderWrite:true,canActivate:false,
    canReceiveProviderTraffic:false,hostedWrite:false,sourceOnly:true,
    merchantEvidence:'PRIVATE_HANDLE_ATTESTATION_FIXTURE_NOT_REAL_PROVIDER',
    next:'PRIVATE_HOSTED_APPROVAL_AND_REAL_OA_EVIDENCE_STILL_REQUIRED'
  });
}
// This hash is intended solely for testing consistent fixture binding. It is
// NOT a signature and must NOT be exported to browsers or accepted as an authorization token.
export function qaOnlyApprovalDigest(e){
  if(!e||!valid(e.tenantId)||!valid(e.storeId)||!OA.test(e.appId??'')||
    !OA.test(e.oaId??'')||!valid(e.consentId)||!valid(e.ownerActorId))return null;
  return digest(JSON.stringify([
    'TIEN404_04B','ZALO_OA',e.appId,e.oaId,e.tenantId,e.storeId,e.consentId,e.ownerActorId
  ]));
}
