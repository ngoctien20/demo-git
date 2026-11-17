// TIEN404 AI V17.7B — source-only unified multi-channel contract.
//
// This module is NOT a hosted ingress, provider signature verifier, tenancy
// authorizer, credential holder, message sender, or Commerce tool. Every pass
// is SYNTHETIC QA only, including owner/customer identity fixtures.
//
// CRM / AI SALES DEMO data, credentials and tools are explicitly excluded.
// No fetch, external request, model call, database, file I/O or provider send.
import {createHash} from 'node:crypto';

const SALES=Object.freeze({
  ZALO_BOT:Object.freeze({provider:'ZALO_BOT_PLATFORM',proof:'ZALO_BOT_HEADER_AND_INSTALLATION',
    scope:'SALES_INGRESS',phase:'STAGING_QA'}),
  MESSENGER:Object.freeze({provider:'META_PAGE',proof:'META_RAW_BODY_HMAC_AND_PAGE_BINDING',
    scope:'SALES_INGRESS',phase:'STAGING_QA'}),
  WEBSITE:Object.freeze({provider:'WEBSITE_CHAT',proof:'SIGNED_WEBSITE_SESSION_AND_STORE_BINDING',
    scope:'SALES_INGRESS',phase:'STAGING_QA'}),
  ZALO_OA:Object.freeze({provider:'ZALO_OFFICIAL_ACCOUNT',proof:'ZALO_NATIVE_OA_MAC_AND_OAUTH_INSTALLATION',
    scope:'SALES_INGRESS',phase:'WAIT_FOR_REAL_OA_OWNER'})
});
const NOTIFY=Object.freeze({
  TELEGRAM:Object.freeze({provider:'TELEGRAM_BOT',scope:'OWNER_NOTIFICATION',
    phase:'STAGING_QA_INACTIVE'}),
  GMAIL:Object.freeze({provider:'GMAIL_API',scope:'OWNER_NOTIFICATION',
    phase:'STAGING_QA_INACTIVE'})
});
const REF=/^[a-zA-Z0-9][a-zA-Z0-9_-]{7,127}$/;
const EVENT_FIELDS=new Set(['channel','installationRef','eventRef','providerActorRef','receivedAtMs']);
const PROOF_FIELDS=new Set(['source','verified','channel','installationRef','eventRef','kind']);
const DAY_MS=24*60*60*1000;
const hash=o=>createHash('sha256').update(JSON.stringify(o)).digest('hex');
const blocked=reason=>Object.freeze({
  candidate:false,reason,mode:'SYNTHETIC_ONLY',
  realProviderVerified:false,realStoreOwnerVerified:false,
  realJwtRlsVerified:false,crossChannelIdentityLinked:false,
  allowCommerceReader:false,allowOrderWrite:false,allowStockWrite:false,
  allowProviderSend:false,allowNotificationSend:false,
  canPublish:false,modelCalls:0,providerSends:0,commerceWrites:0
});
const preview=extra=>Object.freeze({
  candidate:true,stage:'V17_7B_SYNTHETIC_UNIFIED_CHANNEL_PREVIEW',
  mode:'SYNTHETIC_ONLY',
  realProviderVerified:false,realStoreOwnerVerified:false,
  realJwtRlsVerified:false,crossChannelIdentityLinked:false,
  allowCommerceReader:false,allowOrderWrite:false,allowStockWrite:false,
  allowProviderSend:false,allowNotificationSend:false,
  canPublish:false,modelCalls:0,providerSends:0,commerceWrites:0,...extra
});
const ref=s=>typeof s==='string'&&REF.test(s);

export function describeChannels(){
  return Object.freeze({
    customerIngress:Object.freeze(Object.keys(SALES)),
    merchantNotification:Object.freeze(Object.keys(NOTIFY)),
    deferred:Object.freeze(['ZALO_OA']),
    noCrossChannelIdentityByDefault:true,canPublish:false,
    productionProviderProofVerified:false,
    aiSalesDemoCredentialReuse:false
  });
}

/**
 * Normalize a test-only event and form scoped conversation key without ever
 * turning a client-supplied tenant/store into trusted authorization.
 *
 * Future hosting MUST replace all test doubles with independently verified
 * native channel proof + server-owned installation authority + durable replay.
 * The output is not an authorization token and cannot call Commerce.
 */
export async function inspectUnifiedSalesPreview(event,bindings){
  if(!bindings||bindings.executionMode!=='SYNTHETIC_QA_ONLY'||
     bindings.liveEnabled!==false||bindings.ownerOaAvailable!==false||
     typeof bindings.readProviderProof!=='function'||
     typeof bindings.resolveServerInstallation!=='function'||
     typeof bindings.reserveOnce!=='function'||
     !Number.isSafeInteger(bindings.nowMs)||bindings.nowMs<1)
    return blocked('SYNTHETIC_NO_SEND_GATE_NOT_ESTABLISHED');
  if(!event||typeof event!=='object'||Array.isArray(event)||
     !Object.hasOwn(SALES,event.channel))
    return blocked('NOT_A_RECOGNIZED_CUSTOMER_INGRESS');
  if(event.channel==='ZALO_OA')
    return blocked('ZALO_OA_NEEDS_REAL_OWNER_OAUTH_AND_NATIVE_PROVIDER_UAT');
  if(Object.keys(event).some(key=>!EVENT_FIELDS.has(key)))
    return blocked('CLIENT_SUPPLIED_STORE_AUTHORITY_OR_EXTRA_DATA');
  if(!ref(event.installationRef)||!ref(event.eventRef)||
     !ref(event.providerActorRef)||!Number.isSafeInteger(event.receivedAtMs))
    return blocked('INVALID_CHANNEL_EVENT_KEYS');
  if(Math.abs(bindings.nowMs-event.receivedAtMs)>5*60*1000)
    return blocked('EVENT_EXPIRED_OR_FUTURE');
  let proof,installation;
  try{
    proof=await bindings.readProviderProof(event.channel,event.eventRef);
    installation=await bindings.resolveServerInstallation(event.channel,event.installationRef);
  }catch{return blocked('BACKEND_PROOF_OR_INSTALLATION_UNAVAILABLE');}
  if(!proof||proof.source!=='SYNTHETIC_INDEPENDENT_PROOF'||
     proof.verified!==true||proof.channel!==event.channel||
     proof.installationRef!==event.installationRef||
     proof.eventRef!==event.eventRef||
     proof.kind!==SALES[event.channel].proof||
     Object.keys(proof).some(k=>!PROOF_FIELDS.has(k)))
    return blocked('INVALID_OR_UNTRUSTED_CHANNEL_PROOF');
  if(!installation||installation.source!=='SYNTHETIC_SERVER_REGISTRY'||
     installation.channel!==event.channel||
     installation.installationRef!==event.installationRef||
     !ref(installation.tenantRef)||!ref(installation.storeRef)||
     !ref(installation.botVersion)||!ref(installation.policyVersion)||
     installation.syntheticOwnerBindingVerified!==true||
     installation.readOnly===false||installation.allowSend!==false||
     installation.allowCommerceWrite!==false)
    return blocked('UNTRUSTED_CHANNEL_TO_STORE_INSTALLATION');
  // A provider-scoped actor cannot be used to infer identities across
  // Messenger, Zalo Bot, Website or a later OA, even if IDs are identical.
  const conversationKey=hash(['CONVERSATION_SCOPE_V17_7B',
    event.channel,event.installationRef,
    installation.tenantRef,installation.storeRef,event.providerActorRef]);
  const replayKey=hash(['REPLAY_SCOPE_V17_7B',
    event.channel,event.installationRef,event.eventRef]);
  let first;
  try{first=await bindings.reserveOnce(replayKey);}catch{
    return blocked('DURABLE_REPLAY_RESERVATION_MISSING');
  }
  if(first!==true)return blocked('DUPLICATE_MESSAGE_OR_REPLAY');
  return preview({conversationKey,channel:event.channel,
    provider:SALES[event.channel].provider,storeScoped:true,
    dataOrigin:'SYNTHETIC_FIXTURE_ONLY',scope:'SALES_INGRESS'});
}

/**
 * Notification is a separate lane. A source-only "saved order" receipt
 * cannot send Telegram/Gmail and cannot inherit AI_SALES_DEMO credentials.
 */
export function inspectOwnerNotificationPreview(event,source){
  if(!event||typeof event!=='object'||Array.isArray(event)||
     !Object.hasOwn(NOTIFY,event.channel))
    return blocked('CUSTOMER_CHANNEL_CANNOT_BE_NOTIFICATION_DISPATCHER');
  if(Object.keys(event).some(k=>!new Set([
    'channel','eventType','eventRef','storeRef'
  ]).has(k)))return blocked('NOTIFICATION_AUTHORITY_CAME_FROM_UNTRUSTED_PAYLOAD');
  if(event.eventType!=='ORDER_SAVED'||!ref(event.eventRef)||!ref(event.storeRef))
    return blocked('NOT_A_TRUSTED_PERSISTED_ORDER_EVENT');
  if(!source||source.mode!=='SYNTHETIC_QA_ONLY'||source.noSend!==true||
     source.fixtureReceiptSource!=='SYNTHETIC_SAVED_ORDER'||
     source.persistedInSyntheticFixture!==true||
     source.eventRef!==event.eventRef||source.storeRef!==event.storeRef||
     source.tenantAuthVerifiedInRealWorld!==false||
     source.aiSalesDemoCredentialReused!==false)
    return blocked('SERVER_NOTIFICATION_RECEIPT_NOT_AUTHORIZED');
  return preview({channel:event.channel,
    scope:'OWNER_NOTIFICATION',notificationCandidateOnly:true});
}

/** Return deterministic synthetic manifest only; never imply actual provider
 * availability, bot permissions, subscriptions or OAuth grants.
 */
export function plannedChannelStatus(channel){
  if(Object.hasOwn(SALES,channel))return Object.freeze({...SALES[channel],
    canReceiveRealProviderTraffic:false,canSend:false});
  if(Object.hasOwn(NOTIFY,channel))return Object.freeze({...NOTIFY[channel],
    canReceiveRealProviderTraffic:false,canSend:false});
  return Object.freeze({scope:'UNSUPPORTED',canReceiveRealProviderTraffic:false,
    canSend:false});
}
