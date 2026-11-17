// TIEN404 V17.7H.4S — Existing Zalo Bot × Store authority × Cross-channel
// PUBLIC-SAFE OFFLINE admission. It NEVER uses real Bot tokens, JWT, database
// clients, HTTP providers, secrets, customer profiles, order bodies or
// production events. A QA pass DOES NOT authorize any actual order read.
// Store owner/tenant identity must come from independently trusted server
// authority AFTER canonical Store-scoped RLS is hosted and tested.
const SURFACES = Object.freeze(['products','orders','order_items','customers',
  'conversations','messages']);
const CHANNELS = Object.freeze(['MESSENGER','ZALO_BOT']);
const QA_REF = /^QA_[A-Za-z0-9_-]{8,96}$/;
const PROOF_SOURCE = 'OFFLINE_SYNTHETIC_CONSENT_CHALLENGE';
const REGISTRY_SOURCE = 'OFFLINE_SANITIZED_REGISTRY_FIXTURE';
const ORDER_SOURCE = 'OFFLINE_FAKE_ORDER_ONLY';
const SYNTHETIC_SCOPE = 'QA_SYNTHETIC_NO_REAL_OWNER';
const META_KEYS = new Set([
  'source','commerceSurfaces','rlsForceCount','tenantIdSurfaces',
  'storeIdSurfaces','commerceSelectPolicies','qaTenantCount',
  'qaSameTenantAbCount','qaMaxStoresPerTenant','shopBotCount',
  'shopBotDryRunCount','ownerBindingPairedCount',
  'ownerBindingCount','n8nQaBotRegistryCount',
  'n8nQaBotSyntheticCount','n8nInstallationCount',
  'n8nQaOnlyInstallationCount','n8nZaloBotQaCount',
  'n8nMessengerQaCount','realNativeOwnerSessionAccepted',
  'realCustomerIdentityLinksAccepted','externalNoSendAuditAccepted'
]);
const PLAN_KEYS = new Set([
  'mode','registrySource','ordersSource','action','noSend','noWrite',
  'noCommerceRead','events','installations','customerProof','fakeOrder'
]);
const EVENT_KEYS = new Set(['channel','providerRef','actorRef','eventRef']);
const INSTALL_KEYS = new Set([
  'channel','providerRef','tenantRef','storeRef','approvalScope','qaOnly','readOnly'
]);
const LINK_KEYS = new Set([
  'source','sourceChannel','targetChannel','sourceActorRef','targetActorRef',
  'tenantRef','storeRef','customerRef','scope','issuedAtMs','expiresAtMs',
  'usedOnce','independentLiveProof'
]);
const ORDER_KEYS = new Set([
  'source','tenantRef','storeRef','customerRef','orderRef'
]);
const PERMISSIONS=Object.freeze({
  realProviderOwnerVerified:false,
  realBotStoreAuthorityVerified:false,
  realCustomerIdentityLinkVerified:false,
  realOrderOwnershipVerified:false,
  realSameTenantStoreAbJwtRlsVerified:false,
  hostedReplayAccepted:false,
  externalNoSendAccepted:false,
  canReadOrder:false,canReadCustomer:false,
  canReadInventory:false,canWriteCommerce:false,
  canSendProviderMessage:false,canEnableWebhook:false,
  canPromoteToCore:false
});
const denied=(reason,extra={})=>Object.freeze({
  status:'NO_GO',reason,...PERMISSIONS,...extra
});
const candidate=(reason,extra={})=>Object.freeze({
  status:'SYNTHETIC_SCOPE_ONLY_REAL_NO_GO',
  reason,...PERMISSIONS,...extra
});
const isRecord=(v,fields)=>!!v&&typeof v==='object'&&!Array.isArray(v)&&
  Object.keys(v).every(k=>fields.has(k));
const natural=(v)=>Number.isSafeInteger(v)&&v>=0;
const qa=(v)=>typeof v==='string'&&QA_REF.test(v);

/** Live metadata observation from current connectors, NOT an authority token.
 * All real read/write permissions stay false even if a fake all-green
 * metadata packet claims the backend has changed.
 */
export function assessReadOnlyStoreAuthorityMetadata(metadata){
  if(!isRecord(metadata,META_KEYS)||metadata.source!=='CONNECTED_STAGING_METADATA')
    return denied('METADATA_SOURCE_NOT_TRUSTED_FOR_AUTHORIZATION');
  const numbers=[
    'commerceSurfaces','rlsForceCount','tenantIdSurfaces','storeIdSurfaces',
    'commerceSelectPolicies','qaTenantCount','qaSameTenantAbCount',
    'qaMaxStoresPerTenant','shopBotCount','shopBotDryRunCount',
    'ownerBindingPairedCount','ownerBindingCount','n8nQaBotRegistryCount',
    'n8nQaBotSyntheticCount','n8nInstallationCount',
    'n8nQaOnlyInstallationCount','n8nZaloBotQaCount','n8nMessengerQaCount'
  ];
  if(!numbers.every(k=>natural(metadata[k]))||
     ['realNativeOwnerSessionAccepted','realCustomerIdentityLinksAccepted',
      'externalNoSendAuditAccepted'].some(k=>typeof metadata[k]!=='boolean'))
    return denied('MALFORMED_AUTHORITY_AUDIT_FIELDS');
  const gaps=[];
  if(metadata.commerceSurfaces!==SURFACES.length||
     metadata.rlsForceCount!==SURFACES.length||
     metadata.tenantIdSurfaces!==SURFACES.length)
    gaps.push('SIX_COMMERCE_SURFACE_RLS_SCHEMA_NOT_VERIFIED');
  if(metadata.storeIdSurfaces!==SURFACES.length ||
     metadata.commerceSelectPolicies<SURFACES.length)
    gaps.push('STORE_SCOPED_RLS_AND_SELECT_POLICIES_UNAVAILABLE');
  if(metadata.qaSameTenantAbCount<1 || metadata.qaMaxStoresPerTenant<2)
    gaps.push('REAL_SAME_TENANT_STORE_A_B_AUTH_FIXTURE_MISSING');
  if(metadata.shopBotDryRunCount>0 ||
     metadata.n8nQaBotSyntheticCount>0 ||
     metadata.n8nQaOnlyInstallationCount>0)
    gaps.push('BOT_OR_CHANNEL_REGISTRY_SYNTHETIC_ONLY');
  if(!metadata.realNativeOwnerSessionAccepted)
    gaps.push('BOT_CREATOR_NATIVE_OWNER_NOT_AUTHENTICATED');
  if(!metadata.realCustomerIdentityLinksAccepted)
    gaps.push('CUSTOMER_CROSS_CHANNEL_CONSENT_LINK_NOT_VERIFIED');
  if(!metadata.externalNoSendAuditAccepted)
    gaps.push('SIGNED_NATIVE_NO_SEND_UAT_AND_AUDIT_MISSING');
  // Source-only inventory gate. No content from a caller can mint a permission.
  return denied('HOSTED_STORE_AUTHORITY_REAL_UAT_NOT_ADMITTED',{
    metadataShapeChecked:true,
    sourceSurfaceCount:metadata.commerceSurfaces,
    storeIdSurfaceCount:metadata.storeIdSurfaces,
    currentGaps:Object.freeze(gaps),
    evenAllGreenMetadataCannotAuthorize:true
  });
}

/**
 * The two different channel actor references must be linked through a
 * server-owned, one-time consent challenge. Matching phone, name, or order
 * number NEVER creates a customer identity link. Neither Bot Token nor Page
 * HMAC equates to an authorized customer.
 *
 * This is an OFFLINE SHA-independent contract with only fake QA refs.
 * A "match" means synthetic fixture-shape consistency, NOT a DB read.
 */
export function assessCrossChannelSyntheticNoSend(input,nowMs){
  if(!isRecord(input,PLAN_KEYS) ||
     input.mode!=='OFFLINE_FAKE_CUSTOMER_LINK_ONLY' ||
     input.registrySource!==REGISTRY_SOURCE ||
     input.ordersSource!==ORDER_SOURCE ||
     input.action!=='READ_ORDER_STATUS' ||
     input.noSend!==true || input.noWrite!==true ||
     input.noCommerceRead!==true ||
     !Number.isSafeInteger(nowMs)||nowMs<1 ||
     !Array.isArray(input.events)||input.events.length!==2||
     !Array.isArray(input.installations)||input.installations.length!==2)
    return denied('NO_SEND_SOURCE_OR_LENGTH_NOT_VALID');
  const events=input.events;
  const installs=input.installations;
  if(events.some(e=>!isRecord(e,EVENT_KEYS)||!CHANNELS.includes(e.channel)||
      !qa(e.providerRef)||!qa(e.actorRef)||!qa(e.eventRef))||
     installs.some(i=>!isRecord(i,INSTALL_KEYS)||!CHANNELS.includes(i.channel)||
      !qa(i.providerRef)||!qa(i.tenantRef)||!qa(i.storeRef)||
      i.approvalScope!==SYNTHETIC_SCOPE||i.qaOnly!==true||i.readOnly!==true)||
     new Set(events.map(e=>e.channel)).size!==2||
     new Set(installs.map(i=>i.channel)).size!==2)
    return denied('PROVIDER_INSTALLATION_OR_EVENT_NOT_QA_ONLY');
  const byChannel=Object.fromEntries(installs.map(i=>[i.channel,i]));
  const messenger=events.find(e=>e.channel==='MESSENGER');
  const zalo=events.find(e=>e.channel==='ZALO_BOT');
  if(messenger.actorRef===zalo.actorRef ||
     events.some(e=>e.providerRef!==byChannel[e.channel].providerRef))
    return denied('CHANNEL_PROVIDER_OR_ACTOR_BINDING_MISMATCH');
  if(byChannel.MESSENGER.tenantRef!==byChannel.ZALO_BOT.tenantRef ||
     byChannel.MESSENGER.storeRef!==byChannel.ZALO_BOT.storeRef)
    return denied('CROSS_STORE_OR_CROSS_TENANT_DENIED');
  const link=input.customerProof;
  const order=input.fakeOrder;
  if(!isRecord(link,LINK_KEYS)||!isRecord(order,ORDER_KEYS)||
     link.source!==PROOF_SOURCE||order.source!==ORDER_SOURCE||
     link.sourceChannel!=='MESSENGER'||
     link.targetChannel!=='ZALO_BOT'||
     link.sourceActorRef!==messenger.actorRef||
     link.targetActorRef!==zalo.actorRef||
     !qa(link.tenantRef)||!qa(link.storeRef)||!qa(link.customerRef)||
     !qa(order.tenantRef)||!qa(order.storeRef)||
     !qa(order.customerRef)||!qa(order.orderRef)||
     link.scope!=='READ_ORDER_STATUS_ONLY'||
     link.usedOnce!==true||link.independentLiveProof!==false)
    return denied('CROSS_CHANNEL_CUSTOMER_PROOF_NOT_TRUSTED');
  if(!Number.isSafeInteger(link.issuedAtMs)||
     !Number.isSafeInteger(link.expiresAtMs)||
     link.expiresAtMs<=link.issuedAtMs||
     link.expiresAtMs-link.issuedAtMs>10*60*1000||
     nowMs<link.issuedAtMs||nowMs>link.expiresAtMs)
    return denied('CROSS_CHANNEL_CHALLENGE_STALE_OR_REPLAY_UNVERIFIED');
  if(link.tenantRef!==byChannel.ZALO_BOT.tenantRef||
     link.storeRef!==byChannel.ZALO_BOT.storeRef||
     order.tenantRef!==link.tenantRef||
     order.storeRef!==link.storeRef||
     order.customerRef!==link.customerRef)
    return denied('ORDER_CUSTOMER_STORE_ISOLATION_MISMATCH');
  return candidate('TWO_CHANNEL_QA_FIXTURE_TUPLES_MATCH_BUT_REAL_AUTH_DENIED',{
    syntheticTenantStoreMatch:true,
    syntheticCustomerScopeMatch:true,
    syntheticLinkSource:PROOF_SOURCE,
    fakeOrderRowNotFetched:true,
    actualOrderReads:0,
    actualProviderSends:0,
    actualCommerceWrites:0
  });
}
export const syntheticStoreAuthorityKinds=Object.freeze({
  surfaces:SURFACES,
  channels:CHANNELS,
  approvedForRealQuery:false,
  approvedForProviderSend:false,
  releaseDecision:'REAL_COMMERCE_CROSS_CHANNEL_NO_GO'
});
