'use strict';
// V17.2C.34 — SOURCE-ONLY cross-channel identity proof contract.
// NO provider API, DB, JWT, phone lookup, message sending or order access.
// Injected verifiers MUST be implemented independently on protected servers.
const DENY = Object.freeze({verified:false,reason:'CROSS_CHANNEL_PROOF_DENIED'});
const CHANNELS = new Set(['messenger','zalo']);
function validRef(x){return typeof x==='string' && x.length>=3 && x.length<=200;}
function createCrossChannelIdentityProofGate({getPrivateProof,verifySignedLinkProof,now=Date.now}={}){
 if(typeof getPrivateProof!=='function' || typeof verifySignedLinkProof!=='function' || typeof now!=='function')
  throw Error('PRIVATE_PROOF_VERIFIERS_REQUIRED');
 return async function verify(expected){
  // Expected context MUST originate from private, previously authenticated
  // backend state. Never pass untrusted client JSON as expected authority.
  if(!expected||typeof expected!=='object'||Array.isArray(expected) ||
    !validRef(expected.proofRef) || !validRef(expected.orderRef) ||
    !validRef(expected.tenantRef) || !validRef(expected.storeRef) ||
    !validRef(expected.originActorRef) || !validRef(expected.targetActorRef) ||
    !CHANNELS.has(expected.originChannel)||!CHANNELS.has(expected.targetChannel)||
    expected.originChannel===expected.targetChannel) return DENY;
  try{
   const p=await getPrivateProof(expected.proofRef);
   if(!p||p.active!==true ||p.revoked!==false ||
      p.originConsentVerified!==true ||p.targetConsentVerified!==true ||
      p.originAccountOwnershipVerified!==true ||p.targetAccountOwnershipVerified!==true ||
      p.oneTimeChallengeConsumed!==true ||p.atomicReplayProtectionVerified!==true ||
      p.scope!=='read_order_status_only' ||
      !Number.isFinite(p.expiresAtMs)||p.expiresAtMs<=now() ||
      ['proofRef','orderRef','tenantRef','storeRef','originActorRef','targetActorRef',
       'originChannel','targetChannel'].some(k=>p[k]!==expected[k]))return DENY;
   const sig=await verifySignedLinkProof({proofRef:p.proofRef,
      orderRef:p.orderRef,tenantRef:p.tenantRef,storeRef:p.storeRef,
      originChannel:p.originChannel,targetChannel:p.targetChannel,
      originActorRef:p.originActorRef,targetActorRef:p.targetActorRef});
   if(!sig||sig.signatureVerified!==true||sig.issuerTrusted!==true||
      sig.boundToAllClaims!==true)return DENY;
   // This only clears a PREVIEW test gate. Order data and action rights are
   // never returned. Real access requires a separate live Store/actor check.
   return {verified:true,scope:'read_order_status_only',canWrite:false,canSend:false};
  }catch{return DENY;}
 };
}
module.exports={createCrossChannelIdentityProofGate};
