import { verify as edVerify } from 'node:crypto';

/**
 * TIEN404 V17.23Q: public source-only cryptographic packet **shape** check.
 * Caller-supplied public keys, signatures, receipt flags or workflow success
 * NEVER prove real QA Provider installation ownership or independent authority.
 * Real evidence must stay in a separate authenticated private verifier.
 */
export const SCOPE='TIEN404_V17_23Q_PRIVATE_NO_SEND_PROVIDER_EVIDENCE_V1';
export const REAL_GETME_OBSERVATION=Object.freeze({
  workflowId:'xayBLEyUwd64mcLK',
  executionId:'5087',
  executionMode:'manual',
  executionStatus:'success',
  responseMarker:'ZALO_GETME_READONLY_CONFIRMED',
  httpStatus:200,
  workflowReportedSends:0,
  workflowReportedOrdersWritten:0,
  workflowReportedWebhookChanged:false,
  botShopBindingVerified:false,
  ownerRecipientBindingVerified:false,
  liveUatReady:false
});
const RECEIPT_FIELDS=Object.freeze([
 'scope','purpose','provider','installationClass','syntheticOrReal','eventEvidenceDigest',
 'eventNonce','ownerConsentEvidenceRef','operatorEvidenceRef','reviewerEvidenceRef',
 'issuerProject','issuedAt','expiresAt','noSendBoundary','noWriteBoundary'
]);
const ALLOWED_PROVIDERS=Object.freeze(['meta-messenger','zalo-bot','zalo-oa']);
const FORBIDDEN_KEYS=Object.freeze([
 'jwt','token','accessToken','refreshToken','serviceRole','appSecret','botToken',
 'oaSecret','apiKey','secret','webhookUrl','rawBody','payload','eventBody',
 'signatureHeader','customerId','customerPhone','merchantId','storeId','tenantId',
 'ownerDocument','pageId','oaId','chatId','userId','password'
]);
function plain(o){return o!==null&&typeof o==='object'&&!Array.isArray(o)&&Object.getPrototypeOf(o)===Object.prototype}
function uniq(xs){return Object.freeze([...new Set(xs)])}
export function classifyRealGetMeObservation(o={}){
 const blockers=[];
 for(const [key,value] of Object.entries(REAL_GETME_OBSERVATION))
  if(o?.[key]!==value)blockers.push('OBSERVATION_CHANGED_'+key.toUpperCase());
 if(!plain(o))blockers.push('INVALID_OBSERVATION');
 if(plain(o)&&Object.keys(o).some(k=>!Object.hasOwn(REAL_GETME_OBSERVATION,k)))
  blockers.push('UNEXPECTED_OBSERVATION_FIELDS');
 return Object.freeze({
  status:blockers.length?'REAL_GETME_REAUDIT':'REAL_BOT_GETME_READONLY_OBSERVED',
  blockers:uniq(blockers),
  readOnlyProviderCredentialValidated:!blockers.length,
  dedicatedQaBotOwnershipAccepted:false,
  nativeSignedWebhookEventAccepted:false,
  noSendProviderLogsIndependentlyReconciled:false,
  actualStoreBindingAccepted:false,
  realJwtAccepted:false,
  canStartPrivateCanary:false,canSetWebhook:false,canSend:false,canReadOrder:false,canDeploy:false
 });
}
function exactCanonicalJSON(o){
 if(!plain(o))throw Error('OBJECT_REQUIRED');
 const keys=Object.keys(o).sort();
 if(keys.some(k=>!RECEIPT_FIELDS.includes(k))||keys.some(k=>!Object.hasOwn(o,k)))
  throw Error('INVALID_RECEIPT_FIELDS');
 const mapped={};for(const key of keys)mapped[key]=o[key];
 return JSON.stringify(mapped);
}
/**
 * Only consistency, NOT authority. Signature evidence must be anchored to an
 * independently attested private key registry (not provided by a caller).
 * No signer verification keys are packaged into public production configs.
 */
export function checkDetachedPrivateReceipt(packet={}, keys={}, nowMs=Date.now()){
 const reasons=[];
 if(!plain(packet)||!plain(packet.body))return Object.freeze({status:'INVALID_ENVELOPE',cryptographicConsistency:false,independentAuthorityAccepted:false,canStartCanary:false,reasons:['INVALID_PACKET_SHAPE']});
 const body=packet.body;
 for(const [k,v] of Object.entries(body))
  if(FORBIDDEN_KEYS.includes(k)||(!RECEIPT_FIELDS.includes(k)))reasons.push('UNKNOWN_OR_SENSITIVE_FIELD');
 if(RECEIPT_FIELDS.some(k=>!Object.hasOwn(body,k)))reasons.push('MISSING_REQUIRED_FIELD');
 if(body.scope!==SCOPE)reasons.push('WRONG_SCOPE');
 if(body.purpose!=='PRIVATE_PROVIDER_ONLY_NO_SEND')reasons.push('WRONG_PURPOSE');
 if(!ALLOWED_PROVIDERS.includes(body.provider))reasons.push('WRONG_PROVIDER');
 if(body.installationClass!=='DEDICATED_DISPOSABLE_QA')reasons.push('NOT_DEDICATED_QA');
 if(body.syntheticOrReal!=='REAL_PRIVATE_EVENT_EVIDENCE')reasons.push('NOT_REAL_PRIVATE_EVIDENCE');
 for(const k of ['eventEvidenceDigest','ownerConsentEvidenceRef','operatorEvidenceRef','reviewerEvidenceRef'])
  if(typeof body[k]!=='string'||!(/^[a-f0-9]{64}$/).test(body[k]))reasons.push('INVALID_EVIDENCE_DIGEST');
 if(typeof body.eventNonce!=='string'||!(/^[a-f0-9]{32}$/).test(body.eventNonce))reasons.push('INVALID_EVENT_NONCE');
 if(body.issuerProject!=='tien404-staging-private')reasons.push('WRONG_ISSUER');
 if(!Number.isSafeInteger(nowMs)||!Number.isSafeInteger(body.issuedAt)||!Number.isSafeInteger(body.expiresAt)||
    body.issuedAt>nowMs||nowMs>body.expiresAt||body.expiresAt-body.issuedAt>600000||body.issuedAt<nowMs-600000)
   reasons.push('INVALID_TIME_WINDOW');
 if(body.noSendBoundary!==true||body.noWriteBoundary!==true)reasons.push('SEND_OR_WRITE_BOUNDARY_UNATTESTED');
 if(!plain(keys)||typeof keys.ownerPublicKeyPem!=='string'||typeof keys.reviewerPublicKeyPem!=='string'||
    keys.ownerPublicKeyPem===keys.reviewerPublicKeyPem)reasons.push('TWO_DISTINCT_EXTERNAL_KEYS_REQUIRED');
 if(typeof packet.ownerSignature!=='string'||typeof packet.reviewerSignature!=='string')reasons.push('TWO_SIGNATURES_REQUIRED');
 if(!plain(packet)||Object.keys(packet).some(k=>!['body','ownerSignature','reviewerSignature'].includes(k)))reasons.push('PRIVATE_INPUT_OR_EXTRA_ENVELOPE_FIELD');
 let cryptoValid=false;
 if(!reasons.length){
   try{
    const signed=Buffer.from('TIEN404-V17.23Q-PRIVATE-RECEIPT-V1\n'+exactCanonicalJSON(body),'utf8');
    if(signed.length>4096)throw Error('OVERSIZED');
    const owner=Buffer.from(packet.ownerSignature,'base64url');
    const reviewer=Buffer.from(packet.reviewerSignature,'base64url');
    cryptoValid=owner.length===64&&reviewer.length===64&&
      edVerify(null,signed,keys.ownerPublicKeyPem,owner)&&edVerify(null,signed,keys.reviewerPublicKeyPem,reviewer);
   }catch(_){cryptoValid=false}
 }
 if(!cryptoValid)reasons.push('DETACHED_SIGNATURE_CONSISTENCY_UNPROVEN');
 // Permanent guard: public tool has no trusted root, private operator/merchant
 // proof, or replay registry; even cryptographically consistent self-supplied
 // public keys are NOT independent attestation.
 reasons.push('TRUSTED_PRIVATE_KEY_REGISTRY_AND_REPLAY_NOT_CONNECTED');
 return Object.freeze({
  status:'INDEPENDENT_EVIDENCE_NO_GO',
  cryptographicConsistency:cryptoValid,
  independentAuthorityAccepted:false,
  realProviderOriginAccepted:false,
  noSendIndependentlyProven:false,
  canStartCanary:false,canUseJwt:false,canSetWebhook:false,canSend:false,canReadOrder:false,canDeploy:false,
  reasons:uniq(reasons)
 });
}
