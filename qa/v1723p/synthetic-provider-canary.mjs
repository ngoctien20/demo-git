import {createHash} from 'node:crypto';
import {
 verifyMetaSyntheticFixture,
 verifyZaloOaSyntheticDigest,
 verifyZaloBotSyntheticSecret
} from '../v1723o/native-provider-private-canary.mjs';

/**
 * V17.23P isolated SYNTHETIC provider event verifier.
 * It does not open a webhook, send a message, read an order, or grant real Owner/JWT authority.
 * Replay control is process-local only; it MUST NOT be deployed as production replay protection.
 */
export const SYNTHETIC_MARKER='TIEN404_V1723P_SYNTHETIC_FIXTURE_ONLY';
export const CHANNELS=Object.freeze(['meta-messenger','zalo-oa','zalo-bot']);
const INSTALLATION_SCOPE=Object.freeze({
 'meta-messenger':'SYNTHETIC_META_QA_PAGE',
 'zalo-oa':'SYNTHETIC_ZALO_QA_OA',
 'zalo-bot':'SYNTHETIC_ZALO_QA_BOT'
});
const MAX_BYTES=8192,MAX_SKEW_MS=300000;
const denied=(reasons,syntheticSignatureVerified=false)=>Object.freeze({
 status:reasons.length?'SYNTHETIC_DENIED':'SYNTHETIC_ACCEPTED_NO_HOSTED_AUTHORITY',
 reasonCodes:Object.freeze([...new Set(reasons)]),
 syntheticSignatureVerified,
 actualNativeProviderEventVerified:false,
 privateMerchantOwnerVerified:false,
 actualStoreBindingVerified:false,
 realJwtVerified:false,
 replayPersistenceVerified:false,
 canReadOrder:false,canWriteOrder:false,canSend:false,canModifyWebhook:false,
 canOpenCanary:false,canDeploy:false
});
export class SyntheticReplayMemory {
 #items=new Set();
 claim(fingerprint){
  if(typeof fingerprint!=='string'||!(/^[a-f0-9]{64}$/).test(fingerprint))return false;
  if(this.#items.has(fingerprint))return false;
  this.#items.add(fingerprint);return true;
 }
 get size(){return this.#items.size}
}
export function simulateOneCanary(event={},replayStore){
 const reasons=[];
 if(event?.marker!==SYNTHETIC_MARKER)reasons.push('SYNTHETIC_MARKER_REQUIRED');
 if(event?.operation!=='SIMULATE_NO_SEND')reasons.push('NON_SYNTHETIC_OPERATION_BLOCKED');
 if(!CHANNELS.includes(event?.provider))reasons.push('UNKNOWN_PROVIDER');
 if(event?.installation!==INSTALLATION_SCOPE[event?.provider])reasons.push('SYNTHETIC_INSTALLATION_MISMATCH');
 const body=event?.rawBody;
 if(!Buffer.isBuffer(body)||body.length===0||body.length>MAX_BYTES)reasons.push('INVALID_SYNTHETIC_RAW_BYTES');
 const now=event?.nowMs,at=event?.receiptAtMs;
 if(!Number.isSafeInteger(now)||!Number.isSafeInteger(at)||Math.abs(now-at)>MAX_SKEW_MS)
  reasons.push('SYNTHETIC_INGRESS_TIME_WINDOW_FAILED');
 if(!replayStore||typeof replayStore.claim!=='function')reasons.push('SYNTHETIC_REPLAY_STORE_REQUIRED');
 const forbidden=['jwt','accessToken','refreshToken','serviceRole','realOwnerEvidence','merchantPhone','customerId','orderId','storeId','tenantId','realProviderEvent','providerToken'];
 if(forbidden.some(k=>Object.hasOwn(Object(event),k)))reasons.push('REAL_DATA_OR_CLIENT_STORE_OVERRIDE_FORBIDDEN');

 let signatureOk=false;
 if(reasons.length===0){
  if(event.provider==='meta-messenger'){
   signatureOk=verifyMetaSyntheticFixture({
    rawBody:body,header:event.header,appSecret:event.syntheticSecret
   });
  }else if(event.provider==='zalo-oa'){
   const m=typeof event.header==='string'?/^mac=([a-f0-9]{64})$/.exec(event.header):null;
   signatureOk=!!m&&verifyZaloOaSyntheticDigest({
    appId:event.syntheticAppId,
    exactDataBytes:body,
    timeStamp:event.syntheticEventTimestamp,
    oaSecret:event.syntheticSecret,
    digestHex:m[1]
   });
  }else if(event.provider==='zalo-bot'){
   signatureOk=verifyZaloBotSyntheticSecret({
    receivedHeader:event.header,configuredSecret:event.syntheticSecret
   });
  }
  if(!signatureOk) reasons.push('PROVIDER_SPECIFIC_SYNTHETIC_PROOF_INVALID');
 }
 if(reasons.length===0){
  // No original data or secret reflected in receipt. Replay is SINGLE-PROCESS DEMO only.
  const digest=createHash('sha256')
   .update(event.provider).update('|').update(event.installation)
   .update('|').update(body).update('|').update(event.header).digest('hex');
  if(!replayStore.claim(digest))reasons.push('SYNTHETIC_REPLAY_BLOCKED');
 }
 return denied(reasons,signatureOk);
}
export function reviewQaInstallationAdmission(packet={}){
 const reasons=[];
 if(!['meta-messenger','zalo-oa','zalo-bot'].includes(packet?.provider))reasons.push('PROVIDER_NOT_SELECTED');
 if(packet?.target!=='DEDICATED_DISPOSABLE_QA_INSTALLATION')reasons.push('NO_DEDICATED_QA_INSTALLATION');
 if(packet?.mode!=='PRIVATE_NO_SEND_NO_WRITE')reasons.push('HOSTED_SEND_OR_WRITE_SCOPE_DENIED');
 if(packet?.ownerDecision!=='PRIVATE_INDEPENDENT_CONSENT_PENDING')reasons.push('PRIVATE_OWNER_CONSENT_NOT_ESTABLISHED');
 for(const field of ['jwt','appSecret','accessToken','token','pageId','oaId','botToken','providerSignature','merchantOwnerId','tenantId','storeId','customerPhone','rawEvent','webhookUrl']){
  if(Object.hasOwn(Object(packet),field))reasons.push('PRIVATE_OR_UNTRUSTED_EVIDENCE_INPUT');
 }
 reasons.push('PRIVATE_PROVIDER_INSTALLATION_OWNER_AUTHORITY_NOT_ATTESTED');
 reasons.push('PROVIDER_NATIVE_SIGNED_EVENT_NOT_INDEPENDENTLY_CAPTURED');
 // Commerce/JWT admission remains separately blocked. Provider-only QA ingress can
 // be independently reviewed later without touching Orders, Store or real customer data.
 reasons.push('COMMERCE_STORE_AB_AND_M0_RECOVERY_GATE_SEPARATELY_CLOSED');
 return Object.freeze({status:'PRIVATE_AUTHORITY_NO_GO',reasonCodes:Object.freeze([...new Set(reasons)]),
  realProviderOwnerVerified:false,privateEvidenceAccepted:false,realJwtCanaryAuthorized:false,
  canOpenProviderCanary:false,canReadOrder:false,canWriteOrder:false,canSend:false,canDeploy:false});
}
