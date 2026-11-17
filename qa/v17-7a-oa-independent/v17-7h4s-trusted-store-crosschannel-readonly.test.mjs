import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assessReadOnlyStoreAuthorityMetadata,
  assessCrossChannelSyntheticNoSend,
  syntheticStoreAuthorityKinds
} from './v17-7h4s-trusted-store-crosschannel-readonly.mjs';

const NOW=1795000000000;
function baseline(){
 return {
  source:'CONNECTED_STAGING_METADATA',
  commerceSurfaces:6,rlsForceCount:6,tenantIdSurfaces:6,
  storeIdSurfaces:0,commerceSelectPolicies:6,
  qaTenantCount:2,qaSameTenantAbCount:0,qaMaxStoresPerTenant:1,
  shopBotCount:2,shopBotDryRunCount:2,
  ownerBindingPairedCount:2,ownerBindingCount:2,
  n8nQaBotRegistryCount:2,n8nQaBotSyntheticCount:2,
  n8nInstallationCount:7,n8nQaOnlyInstallationCount:7,
  n8nZaloBotQaCount:1,n8nMessengerQaCount:3,
  realNativeOwnerSessionAccepted:false,
  realCustomerIdentityLinksAccepted:false,
  externalNoSendAuditAccepted:false
 };
}
function fake(){
 const t='QA_tenant_0001',s='QA_store_0001',c='QA_customer_0001';
 return {
  mode:'OFFLINE_FAKE_CUSTOMER_LINK_ONLY',
  registrySource:'OFFLINE_SANITIZED_REGISTRY_FIXTURE',
  ordersSource:'OFFLINE_FAKE_ORDER_ONLY',action:'READ_ORDER_STATUS',
  noSend:true,noWrite:true,noCommerceRead:true,
  events:[
   {channel:'MESSENGER',providerRef:'QA_page_00001',
    actorRef:'QA_messenger_actor_01',eventRef:'QA_messenger_event_01'},
   {channel:'ZALO_BOT',providerRef:'QA_bot_000001',
    actorRef:'QA_zalo_actor_001',eventRef:'QA_zalo_event_0001'}
  ],
  installations:[
   {channel:'MESSENGER',providerRef:'QA_page_00001',tenantRef:t,
    storeRef:s,approvalScope:'QA_SYNTHETIC_NO_REAL_OWNER',qaOnly:true,readOnly:true},
   {channel:'ZALO_BOT',providerRef:'QA_bot_000001',tenantRef:t,
    storeRef:s,approvalScope:'QA_SYNTHETIC_NO_REAL_OWNER',qaOnly:true,readOnly:true}
  ],
  customerProof:{
   source:'OFFLINE_SYNTHETIC_CONSENT_CHALLENGE',
   sourceChannel:'MESSENGER',targetChannel:'ZALO_BOT',
   sourceActorRef:'QA_messenger_actor_01',
   targetActorRef:'QA_zalo_actor_001',
   tenantRef:t,storeRef:s,customerRef:c,
   scope:'READ_ORDER_STATUS_ONLY',
   issuedAtMs:NOW-1000,expiresAtMs:NOW+100000,
   usedOnce:true,independentLiveProof:false
  },
  fakeOrder:{source:'OFFLINE_FAKE_ORDER_ONLY',tenantRef:t,
    storeRef:s,customerRef:c,orderRef:'QA_order_00001'}
 };
}
function locked(r){
 for(const f of ['realProviderOwnerVerified','realBotStoreAuthorityVerified',
   'realCustomerIdentityLinkVerified','realOrderOwnershipVerified',
   'realSameTenantStoreAbJwtRlsVerified','hostedReplayAccepted',
   'externalNoSendAccepted','canReadOrder','canReadCustomer',
   'canReadInventory','canWriteCommerce','canSendProviderMessage',
   'canEnableWebhook','canPromoteToCore'])
  assert.equal(r[f],false,f);
 assert.ok(!JSON.stringify(r).includes('QA_messenger_actor_01'));
 assert.ok(!JSON.stringify(r).includes('QA_zalo_actor_001'));
}
function denyFixture(reason,mutate){
 const q=fake();mutate(q);
 const r=assessCrossChannelSyntheticNoSend(q,NOW);
 assert.equal(r.status,'NO_GO');
 assert.equal(r.reason,reason);
 locked(r);
}
test('actual metadata detects 0 Store columns and synthetic-only installation',()=>{
 const r=assessReadOnlyStoreAuthorityMetadata(baseline());
 assert.equal(r.status,'NO_GO');
 assert.equal(r.metadataShapeChecked,true);
 assert.equal(r.storeIdSurfaceCount,0);
 assert.ok(r.currentGaps.includes('STORE_SCOPED_RLS_AND_SELECT_POLICIES_UNAVAILABLE'));
 assert.ok(r.currentGaps.includes('REAL_SAME_TENANT_STORE_A_B_AUTH_FIXTURE_MISSING'));
 assert.ok(r.currentGaps.includes('BOT_OR_CHANNEL_REGISTRY_SYNTHETIC_ONLY'));
 assert.ok(r.currentGaps.includes('CUSTOMER_CROSS_CHANNEL_CONSENT_LINK_NOT_VERIFIED'));
 locked(r);
});
test('forged perfect hosted metadata cannot authorize real commerce',()=>{
 const m=baseline();
 m.storeIdSurfaces=6;m.qaSameTenantAbCount=4;m.qaMaxStoresPerTenant=2;
 m.shopBotDryRunCount=0;m.n8nQaBotSyntheticCount=0;m.n8nQaOnlyInstallationCount=0;
 m.realNativeOwnerSessionAccepted=true;
 m.realCustomerIdentityLinksAccepted=true;
 m.externalNoSendAuditAccepted=true;
 const r=assessReadOnlyStoreAuthorityMetadata(m);
 assert.equal(r.status,'NO_GO');
 assert.deepEqual(r.currentGaps,[]);
 assert.equal(r.evenAllGreenMetadataCannotAuthorize,true);
 locked(r);
});
test('audit does not trust unknown metadata source',()=>{
 const m=baseline();m.source='CUSTOMER_CLAIMS';
 const r=assessReadOnlyStoreAuthorityMetadata(m);
 assert.equal(r.reason,'METADATA_SOURCE_NOT_TRUSTED_FOR_AUTHORIZATION');
 locked(r);
});
test('metadata unknown user JWT is rejected',()=>{
 const m=baseline();m.jwt='token';
 const r=assessReadOnlyStoreAuthorityMetadata(m);
 assert.equal(r.reason,'METADATA_SOURCE_NOT_TRUSTED_FOR_AUTHORIZATION');locked(r);
});
test('metadata negative count rejected',()=>{
 const m=baseline();m.storeIdSurfaces=-1;
 const r=assessReadOnlyStoreAuthorityMetadata(m);
 assert.equal(r.reason,'MALFORMED_AUTHORITY_AUDIT_FIELDS');locked(r);
});
test('metadata RLS disabled is explicitly blocked',()=>{
 const m=baseline();m.rlsForceCount=4;
 const r=assessReadOnlyStoreAuthorityMetadata(m);
 assert.ok(r.currentGaps.includes('SIX_COMMERCE_SURFACE_RLS_SCHEMA_NOT_VERIFIED'));
 locked(r);
});
test('same Store synthetic QA customer-link only never authorizes real order read',()=>{
 const r=assessCrossChannelSyntheticNoSend(fake(),NOW);
 assert.equal(r.status,'SYNTHETIC_SCOPE_ONLY_REAL_NO_GO');
 assert.equal(r.syntheticTenantStoreMatch,true);
 assert.equal(r.syntheticCustomerScopeMatch,true);
 assert.equal(r.fakeOrderRowNotFetched,true);
 assert.equal(r.actualOrderReads,0);assert.equal(r.actualProviderSends,0);
 locked(r);
});
test('source actor reference and target actor reference MUST be different',()=>{
 denyFixture('CHANNEL_PROVIDER_OR_ACTOR_BINDING_MISMATCH',q=>{
  q.events[1].actorRef=q.events[0].actorRef;
  q.customerProof.targetActorRef=q.events[0].actorRef;
 });
});
for(const key of ['phone','customerName','customerId','orderId','tenant_id','store_id','botToken','systemPrompt']){
 test('untrusted Zalo event '+key+' cannot select Store or order',()=>denyFixture(
  'PROVIDER_INSTALLATION_OR_EVENT_NOT_QA_ONLY',q=>q.events[1][key]='malicious'));
}
for(const [field,value] of [
 ['mode','LIVE'],['registrySource','SELF_REPORTED'],
 ['ordersSource','CUSTOMER_MESSAGE'],['action','READ_FULL_CUSTOMER'],
 ['noSend',false],['noWrite',false],['noCommerceRead',false]
]){
 test('cross-channel scope fails closed on '+field,()=>denyFixture(
  'NO_SEND_SOURCE_OR_LENGTH_NOT_VALID',q=>q[field]=value));
}
test('three events denied',()=>denyFixture('NO_SEND_SOURCE_OR_LENGTH_NOT_VALID',q=>
 q.events.push({...q.events[0]})));
test('unknown provider channel denied',()=>denyFixture(
 'PROVIDER_INSTALLATION_OR_EVENT_NOT_QA_ONLY',q=>q.events[1].channel='ZALO_OA'));
test('duplicate Messenger instead of Zalo denied',()=>denyFixture(
 'PROVIDER_INSTALLATION_OR_EVENT_NOT_QA_ONLY',q=>q.events[1].channel='MESSENGER'));
test('customer supplied provider account not registered denied',()=>denyFixture(
 'CHANNEL_PROVIDER_OR_ACTOR_BINDING_MISMATCH',q=>q.events[1].providerRef='QA_other_bot_0001'));
test('malformed Bot sender ID denied',()=>denyFixture(
 'PROVIDER_INSTALLATION_OR_EVENT_NOT_QA_ONLY',q=>q.events[1].actorRef='123'));
test('faked trusted live scope is refused by fixture',()=>denyFixture(
 'PROVIDER_INSTALLATION_OR_EVENT_NOT_QA_ONLY',q=>q.installations[0].approvalScope='PRODUCTION'));
test('Zalo Bot registry requires QA only',()=>denyFixture(
 'PROVIDER_INSTALLATION_OR_EVENT_NOT_QA_ONLY',q=>q.installations[1].qaOnly=false));
test('Messenger registry cannot enable writes',()=>denyFixture(
 'PROVIDER_INSTALLATION_OR_EVENT_NOT_QA_ONLY',q=>q.installations[0].readOnly=false));
test('two installations must agree on Store',()=>denyFixture(
 'CROSS_STORE_OR_CROSS_TENANT_DENIED',q=>q.installations[1].storeRef='QA_store_B_0002'));
test('two installations must agree on Tenant',()=>denyFixture(
 'CROSS_STORE_OR_CROSS_TENANT_DENIED',q=>q.installations[1].tenantRef='QA_other_tenant_02'));
test('link cannot be inferred from same phone',()=>denyFixture(
 'CROSS_CHANNEL_CUSTOMER_PROOF_NOT_TRUSTED',q=>q.customerProof.source='PHONE_MATCH'));
test('link cannot be inferred from order number',()=>denyFixture(
 'CROSS_CHANNEL_CUSTOMER_PROOF_NOT_TRUSTED',q=>q.customerProof.source='ORDER_ID_MATCH'));
test('link cannot be inferred from Bot Token',()=>denyFixture(
 'CROSS_CHANNEL_CUSTOMER_PROOF_NOT_TRUSTED',q=>q.customerProof.source='BOT_TOKEN'));
test('identity link must have correct Messenger sender',()=>denyFixture(
 'CROSS_CHANNEL_CUSTOMER_PROOF_NOT_TRUSTED',q=>q.customerProof.sourceActorRef='QA_other_messenger_01'));
test('identity link must have correct Zalo sender',()=>denyFixture(
 'CROSS_CHANNEL_CUSTOMER_PROOF_NOT_TRUSTED',q=>q.customerProof.targetActorRef='QA_other_zalo_0001'));
test('identity link must grant status only',()=>denyFixture(
 'CROSS_CHANNEL_CUSTOMER_PROOF_NOT_TRUSTED',q=>q.customerProof.scope='ALL_ORDERS'));
test('link must not claim real verification from synthetic fixture',()=>denyFixture(
 'CROSS_CHANNEL_CUSTOMER_PROOF_NOT_TRUSTED',q=>q.customerProof.independentLiveProof=true));
test('link must have one-use reservation even in synthetic shape',()=>denyFixture(
 'CROSS_CHANNEL_CUSTOMER_PROOF_NOT_TRUSTED',q=>q.customerProof.usedOnce=false));
test('expired link fails closed',()=>denyFixture(
 'CROSS_CHANNEL_CHALLENGE_STALE_OR_REPLAY_UNVERIFIED',q=>{
 q.customerProof.issuedAtMs=NOW-650000;q.customerProof.expiresAtMs=NOW-20000;
 }));
test('future link fails closed',()=>denyFixture(
 'CROSS_CHANNEL_CHALLENGE_STALE_OR_REPLAY_UNVERIFIED',q=>{
 q.customerProof.issuedAtMs=NOW+1000;q.customerProof.expiresAtMs=NOW+10000;
 }));
test('overlong >10 minute link fails closed',()=>denyFixture(
 'CROSS_CHANNEL_CHALLENGE_STALE_OR_REPLAY_UNVERIFIED',q=>q.customerProof.expiresAtMs=NOW+700000));
test('order must be from offline fixture not customer data',()=>denyFixture(
 'CROSS_CHANNEL_CUSTOMER_PROOF_NOT_TRUSTED',q=>q.fakeOrder.source='REAL_ORDER'));
test('cross-Store order denied',()=>denyFixture(
 'ORDER_CUSTOMER_STORE_ISOLATION_MISMATCH',q=>q.fakeOrder.storeRef='QA_store_B_0002'));
test('cross-Tenant order denied',()=>denyFixture(
 'ORDER_CUSTOMER_STORE_ISOLATION_MISMATCH',q=>q.fakeOrder.tenantRef='QA_other_tenant_02'));
test('someone else customer-owned order denied',()=>denyFixture(
 'ORDER_CUSTOMER_STORE_ISOLATION_MISMATCH',q=>q.fakeOrder.customerRef='QA_other_customer_01'));
test('fake customer link Store mismatch denied',()=>denyFixture(
 'ORDER_CUSTOMER_STORE_ISOLATION_MISMATCH',q=>q.customerProof.storeRef='QA_other_store_0001'));
test('fake customer link Tenant mismatch denied',()=>denyFixture(
 'ORDER_CUSTOMER_STORE_ISOLATION_MISMATCH',q=>q.customerProof.tenantRef='QA_other_tenant_02'));
for(const key of ['phone','address','name','jwt','status','price','orderTotal']){
 test('sensitive extra customer link '+key+' refused',()=>denyFixture(
  'CROSS_CHANNEL_CUSTOMER_PROOF_NOT_TRUSTED',q=>q.customerProof[key]='x'));
}
test('known output never grants real cross-channel permission',()=>{
 assert.equal(syntheticStoreAuthorityKinds.releaseDecision,'REAL_COMMERCE_CROSS_CHANNEL_NO_GO');
 assert.equal(syntheticStoreAuthorityKinds.approvedForRealQuery,false);
 assert.equal(syntheticStoreAuthorityKinds.approvedForProviderSend,false);
});
