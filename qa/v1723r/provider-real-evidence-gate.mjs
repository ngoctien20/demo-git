/**
 * V17.23R: independently observed n8n READ-ONLY Zalo Bot metadata only.
 * Does not call a provider, open a webhook, own a Bot, verify a signed event,
 * or grant an authenticated session. All private admission is NO-GO.
 */
export const GETME_OBSERVATION=Object.freeze({
 workflowId:'xayBLEyUwd64mcLK',executionId:'5087',executionStatus:'success',
 mode:'manual',result:'ZALO_GETME_READONLY_CONFIRMED',httpStatus:200,
 reportedSends:0,reportedOrderWrites:0,reportedWebhookChanged:false,
 storeBindingVerified:false,ownerBindingVerified:false,liveUatReady:false
});
export const WEBHOOK_OBSERVATION=Object.freeze({
 workflowId:'bD510xyr5jBHQ99K',executionId:'5088',executionStatus:'success',
 mode:'manual',result:'ZALO_WEBHOOK_INFO_READONLY',hasWebhook:true,
 matchesExistingStagingWebhook:true,matchesWebhookTest:false,
 reportedSends:0,reportedConfigurationChanges:0
});
export const PRIVATE_EVENT_REQUIRED=Object.freeze([
 'dedicatedQaBotProviderAccountIndependentlyVerified',
 'merchantConsentPrivatelyVerified',
 'secondVerifierAuthorityTrustedOutsideThisRepo',
 'isolatedIngressNotExistingStagingWebhook',
 'providerAuthHeaderValidatedOnActualDelivery',
 'providerInstallationBoundServerSide',
 'durableAtomicReplayRaceAndExpiryVerified',
 'noOutboundSendGuardProvenIndependently',
 'noOrdersCustomerDataReadOrWrite',
 'privateRedactedReceiptSignedWithTrustedAnchors'
]);
const uniq=xs=>Object.freeze([...new Set(xs)]);
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
function exactMatch(observed,expected,prefix,reasons){
 if(!plain(observed)){reasons.push(prefix+'_INVALID_SHAPE');return}
 for(const [k,v] of Object.entries(expected))if(observed[k]!==v)reasons.push(prefix+'_DRIFT_'+k.toUpperCase());
 for(const k of Object.keys(observed))if(!Object.hasOwn(expected,k))reasons.push(prefix+'_EXTRA_OR_PRIVATE_FIELD');
}
export function evaluateCurrentBotForDedicatedCanary({getMe=GETME_OBSERVATION,webhook=WEBHOOK_OBSERVATION}={}){
 const reasons=[];
 exactMatch(getMe,GETME_OBSERVATION,'GETME',reasons);
 exactMatch(webhook,WEBHOOK_OBSERVATION,'WEBHOOK',reasons);
 if(webhook?.matchesExistingStagingWebhook===true)reasons.push('BOT_ALREADY_BOUND_TO_EXISTING_STAGING_WEBHOOK');
 if(webhook?.hasWebhook===true&&webhook?.matchesWebhookTest!==true)reasons.push('NOT_A_DEDICATED_QA_WEBHOOK');
 if(getMe?.storeBindingVerified!==true||getMe?.ownerBindingVerified!==true)reasons.push('INDEPENDENT_MERCHANT_STORE_OWNER_AUTHORITY_ABSENT');
 reasons.push('READONLY_GETME_AND_WEBHOOK_INFO_NOT_A_PROVIDER_EVENT');
 return Object.freeze({
  status:'DEDICATED_QA_BOT_NO_GO',reasons:uniq(reasons),
  observedReadOnlyProviderChecks:reasons.every(k=>!['_DRIFT_','_INVALID_SHAPE','_EXTRA_OR_PRIVATE_FIELD'].some(s=>k.includes(s))),
  matchesExistingStagingWebhook:webhook?.matchesExistingStagingWebhook===true,
  dedicatedQaInstallationProven:false,realProviderEventProven:false,
  providerLogsIndependentlyChecked:false,independentMerchantOwnerProven:false,
  canReassignWebhook:false,canPollGetUpdates:false,canReceiveRealEvent:false,
  canSend:false,canReadOrders:false,canWriteOrders:false,
  canOpenHostedIngress:false,canAdmitRealJwt:false,canDeploy:false
 });
}
export function evaluateOneRealEventAdmission(packet={}){
 const reasons=[];
 if(!plain(packet))reasons.push('INVALID_PRIVATE_PACKET_SHAPE');
 if(packet?.channel!=='zalo-bot')reasons.push('ZALO_BOT_DEDICATED_QA_SCOPE_REQUIRED');
 if(packet?.mode!=='PRIVATE_NO_SEND_NO_WRITE')reasons.push('NO_SEND_NO_WRITE_MODE_REQUIRED');
 for(const k of PRIVATE_EVENT_REQUIRED)if(packet?.claims?.[k]!==true)reasons.push('EVIDENCE_MISSING_'+k.toUpperCase());
 if(!plain(packet?.claims))reasons.push('INVALID_CLAIMS_SHAPE');
 const sensitive=['token','botToken','secretToken','jwt','authorization','rawEvent','webhookUrl','providerHeader','customerPhone','orderId','storeId','userId','merchantOwnerId','privateKey','signature'];
 if(plain(packet)&&sensitive.some(k=>Object.hasOwn(packet,k)))reasons.push('SENSITIVE_DATA_MUST_REMAIN_IN_PRIVATE_VAULT');
 if(plain(packet?.claims)&&sensitive.some(k=>Object.hasOwn(packet.claims,k)))reasons.push('CLIENT_SUPPLIED_AUTHORITY_REJECTED');
 reasons.push('INDEPENDENT_PROVIDER_OWNER_SIGNED_RECEIPT_NOT_CONNECTED');
 reasons.push('REAL_PRIVATE_EVENT_AND_DURABLE_REPLAY_NOT_EXECUTED');
 return Object.freeze({
  status:'PRIVATE_REAL_EVENT_NO_GO',reasons:uniq(reasons),
  claimedChecksCount:PRIVATE_EVENT_REQUIRED.filter(k=>packet?.claims?.[k]===true).length,
  externalIssuerOrOwnerVerified:false,authenticatedEventReceived:false,
  durableReplayVerified:false,noSendObservedByIndependentMonitor:false,
  canEnrollQaBot:false,canChangeWebhook:false,canAcceptPrivateEvent:false,
  canSend:false,canReadOrders:false,canUseRealJwt:false,canDeploy:false
 });
}
