/**
 * TIEN404 V18.7.6C-M3-H7 — offline ONLY Page installation and conversation UAT gate.
 * Not wired to a live Worker. No Meta SDK/token, HTTP, AI, DB, queue, provider
 * send, order write, Page installation, or Page-to-Store identity binding.
 *
 * IMPORTANT: input is UNTRUSTED. This module can only assess completeness of
 * externally verified proof. It NEVER grants runtime or production authority.
 */
import {summarizePagePayload} from "./worker.mjs";

const QA_APP_ID="2366045790814059";
const RELEVANT_FIELDS=Object.freeze([
  "messages","message_reads","message_deliveries","message_echoes"
]);
const evidenceStates=Object.freeze([
  "owner_consent_hosted_verification",
  "page_role_independent_verification",
  "page_installation_provider_read",
  "app_mode_and_permissions_review",
  "allowed_test_account_role",
  "page_identity_bound_to_qa_app"
]);
const noAuthority=Object.freeze({
  livePageInstalledVerified:false,
  conversationReadAuthorized:false,
  providerSendAllowed:false,
  aiReplyAllowed:false,
  storeLookupAllowed:false,
  orderWriteAllowed:false,
  productionReady:false
});
const obj=x=>x!==null&&typeof x==="object"&&!Array.isArray(x);
const isClosedString=x=>typeof x==="string"&&x.length>0&&x.length<=128;

/** No upstream string or boolean creates Page/Store authority on its own. */
export function assessH7Admission(evidence){
  const checks=Object.create(null);
  const d=obj(evidence)?evidence:{};
  checks.isolatedWorker=d.environment==="ISOLATED_QA_ONLY";
  checks.exactQaApp=d.appId===QA_APP_ID;
  checks.noProviderSendRequested=d.providerSendEnabled===false;
  checks.noOrderWriteRequested=d.orderWriteEnabled===false;
  checks.ownerApprovedTest=d.ownerApprovedReadOnlyTest===true;
  checks.fieldsConfigured=Array.isArray(d.subscribedFields)
   &&RELEVANT_FIELDS.every(x=>d.subscribedFields.includes(x));
  checks.proofInventoryExists=obj(d.evidenceInventory)
   &&evidenceStates.every(k=>d.evidenceInventory[k]==="PENDING"
     ||d.evidenceInventory[k]==="VERIFIED");
  // These are claims, not independently validated Meta/Owner attestations.
  const allClaimed=Object.values(checks).every(Boolean);
  const missing=Object.keys(checks).filter(k=>!checks[k]);
  return Object.freeze({
    stage:"CANDIDATE_REVIEW_ONLY",
    claimsComplete:allClaimed,
    missing,
    requiredEvidence:evidenceStates,
    ...noAuthority
  });
}

/**
 * Runs after raw-body HMAC verification in the EXISTING Worker.
 * No event field, Page ID, message text or role assertion can authorize send.
 * The summary is only a count/classification; not conversation content.
 */
export function classifyH7ConversationForQA(payload,{hmacAlreadyVerified=false}={}){
 if(hmacAlreadyVerified!==true)return Object.freeze({
  accepted:false,reason:"HMAC_NOT_VERIFIED",eventTypes:{},...noAuthority
 });
 const summary=summarizePagePayload(payload);
 if(!summary)return Object.freeze({
  accepted:false,reason:"PAGE_SHAPE_REJECTED",eventTypes:{},...noAuthority
 });
 const types=Object.freeze(Object.fromEntries(
   Object.entries(summary.types).filter(([k])=>[
    "messages","message_echoes","message_reads","message_deliveries",
    "messaging_postbacks","standby","unknown","unknown_page_change"
   ].includes(k))));
 const echoed=types.message_echoes||0;
 const inbound=types.messages||0;
 return Object.freeze({
  accepted:true,reason:"SIGNED_EVENT_CLASSIFIED_NOT_AUTHORIZED",
  eventCount:summary.count,
  eventTypes:types,
  incomingMessageCandidates:inbound,
  echoedMessageCount:echoed,
  echoLoopSuppressed:true,
  pageIdentityVerified:false,
  ownerConsentVerified:false,
  ...noAuthority
 });
}

/** Must never turn even complete synthetic evidence into a Send or Write. */
export function noSendDecision({eventType,metaHmacVerified=false,ownerApproval=false}={}){
 return Object.freeze({
  eventClass:RELEVANT_FIELDS.includes(eventType)?eventType:"unknown",
  metaHmacVerified:metaHmacVerified===true,
  ownerApprovalClaimed:ownerApproval===true,
  action:"ACK_ONLY_NO_SEND",
  ...noAuthority
 });
}
export {QA_APP_ID,RELEVANT_FIELDS,evidenceStates};
