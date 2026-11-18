// TIEN404 V19.0-B5 — protected SYNTHETIC admission rehearsal, not a webhook.
// A B4 SYNTHETIC_FIXTURE_ONLY registry match is insufficient to grant commerce,
// customer, provider, owner, or actual Store authority. This module ONLY writes
// synthetic metadata to a disposable/local QA inbox when explicitly test-enabled.
import { reviewSyntheticInstallationBinding } from "../b4/trusted-installation-gate.mjs";
import { admitSynthetic } from "./durable-inbox-contract.mjs";
const te=new TextEncoder();
const DENY=(reason)=>Object.freeze({
 decision:"DENY",reason,providerVerified:false,storeAuthorized:false,
 commerceRead:false,commerceWrite:false,providerSend:false,publicWebhook:false
});
async function hmac(key,message){
 const cryptoKey=await crypto.subtle.importKey("raw",te.encode(key),
  {name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const digest=await crypto.subtle.sign("HMAC",cryptoKey,te.encode(message));
 return Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,"0")).join("");
}
export async function admitSyntheticFromLockedRegistry({
 db,mode,trustedInstallationRef,trustedCredentialBindingSha256,
 qaPepper,fixtureRef,payloadFixture,nowMs
}={}){
 if(mode!=="B5_LOCAL_D1_TEST_ONLY" ||
   typeof qaPepper!=="string" || qaPepper.length<32 || qaPepper.length>256 ||
   typeof fixtureRef!=="string" || !/^QA_FIXTURE_[A-Z0-9_]{1,40}$/.test(fixtureRef) ||
   typeof payloadFixture!=="string" || !/^SYNTHETIC_[A-Z0-9_]{1,50}$/.test(payloadFixture)){
  return DENY("LOCAL_QA_GATE_CLOSED");
 }
 const proof=await reviewSyntheticInstallationBinding({
  db, trustedInstallationRef,trustedCredentialBindingSha256,
  provider:"zalo_bot",environment:"staging",nowMs
 });
 if(proof.decision!=="QA_REGISTRY_MATCH_ONLY" ||
   proof.providerIdentityVerified!==false ||
   proof.storeAuthorityVerified!==false ||
   proof.commerceReadAllowed!==false || proof.commerceWriteAllowed!==false){
  return DENY("REGISTRY_AUTHORITY_NOT_VERIFIED");
 }
 try {
  const scopeKey=await hmac(qaPepper,"scope:"+trustedInstallationRef);
  const eventKey=await hmac(qaPepper,"event:"+fixtureRef);
  const payloadHash=await hmac(qaPepper,"payload:"+payloadFixture);
  const verdict=await admitSynthetic(db,{scopeKey,eventKey,payloadHash,fixtureRef,nowMs});
  return Object.freeze({
    decision:verdict.decision,
    reason:verdict.reason||null,
    syntheticBindingMatched:true,
    providerVerified:false,storeAuthorized:false,commerceRead:false,
    commerceWrite:false,providerSend:false,publicWebhook:false
  });
 } catch {
  return DENY("LOCAL_D1_ADMISSION_ERROR");
 }
}
export default {fetch(){return new Response(null,{status:423});}};
