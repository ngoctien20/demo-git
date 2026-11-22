'use strict';
/**
 * TIEN404 V21 P1 — signed Messenger ingress to canonical Page/Store authority
 * and V13.6M.5 synthetic atomic event claim.
 *
 * NO SEND. NO DATABASE CONNECTOR. NO HOSTED ACCESS. Source-only QA candidate.
 * Real Meta HMAC bytes are verified by the inherited canonical pipeline.
 * Owner bindings, entitlement, and RLS readiness are provided by an injected
 * restricted read-only repository port (only synthetic QA is approved here).
 * This adapter deliberately never accepts trust-boolean flags from a webhook.
 */
const {previewMessengerV136M3} = require('../messenger-rich-v136m3/canonical-pipeline.cjs');
const refuse=(code)=>{const error=new Error(code);error.code=code;throw error;};

function createMessengerSignedAdmissionCandidate({
 mode='BLOCKED',db,readEntitlement,readPublicConfig,eventStore,
 appSecret,actionSecret,siteOrigin,now=Date.now
}={}){
 if(mode!=='SYNTHETIC_QA_ONLY')refuse('SIGNED_ADMISSION_HOSTED_NOT_APPROVED');
 const readiness=eventStore?.readiness;
 if(!eventStore||typeof eventStore.replayCheck!=='function'||
    readiness?.mode!=='SYNTHETIC_SQL_QA_ONLY'||
    readiness?.providerSendEnabled!==false||
    readiness?.durableReplayReady!==false||
    readiness?.allowOrderWrites!==false||
    readiness?.outboxEnabled!==false)
   refuse('SIGNED_ADMISSION_EVENT_STORE_NOT_APPROVED');
 if(!db||db.readOnly!==true||db.bypassRls!==false||
    db.authorizedProfile!=='RESTRICTED_MESSENGER_READONLY'||
    typeof db.query!=='function'||typeof readEntitlement!=='function'||
    typeof readPublicConfig!=='function'||typeof now!=='function')
   refuse('SIGNED_ADMISSION_REPOSITORY_NOT_APPROVED');
 if(typeof appSecret!=='string'||Buffer.byteLength(appSecret)<32||
    typeof actionSecret!=='string'||Buffer.byteLength(actionSecret)<32)
   refuse('SIGNED_ADMISSION_SERVER_SECRETS_REQUIRED');
 return Object.freeze({
  async inspectSigned({rawBody,signature}={}){
   // The original pipeline checks raw Meta HMAC before its first repository
   // call, then creates a FRESH Page/PSID resolver scope for EACH event.
   // V13.6M.5 replayCheck derives HMAC hashes and atomically claims via the
   // injected synthetic transactional driver. Duplicate events are suppressed.
   const preview=await previewMessengerV136M3({
    mode:'SYNTHETIC_QA_ONLY',rawBody,signature,appSecret,actionSecret,
    db,readEntitlement,readPublicConfig,
    replayCheck:(scope)=>eventStore.replayCheck(scope),
    siteOrigin,now,eventIsolation:true
   });
   if(preview?.status!=='CANDIDATE_PREVIEW_ONLY'||preview.previewOnly!==true||
      preview.sendEnabled!==false||preview.allowOrderWrites!==false||
      !Array.isArray(preview.events)||
      !preview.events.every(e=>e?.previewOnly===true&&e.sendEnabled===false))
      refuse('SIGNED_ADMISSION_PREVIEW_UNVERIFIED');
   // Do not return prepared Meta payloads or recipient PSIDs. This is only
   // a QA decision summary, never an API response sent to a customer.
   return Object.freeze({
    mode:'SIGNED_CANONICAL_PREVIEW_NO_SEND',sendAllowed:false,
    orderWriteAllowed:false,hostedReady:false,
    eventCount:preview.events.length,
    eventDecisions:Object.freeze(preview.events.map(e=>Object.freeze({
     status:e.status, ...(e.status==='PREVIEW_CREATED'?{route:e.route}:{}),
     sendAllowed:false
    })))
   });
  },
  readiness:Object.freeze({
   mode:'SYNTHETIC_QA_ONLY',hostedReady:false,realRlsProven:false,
   messengerPublishedWired:false,providerSendEnabled:false,
   orderWritesEnabled:false,automaticRetryEnabled:false
  })
 });
}
module.exports={createMessengerSignedAdmissionCandidate};
