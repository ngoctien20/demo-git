import test from 'node:test';
import assert from 'node:assert/strict';
import {describeChannels,inspectUnifiedSalesPreview,inspectOwnerNotificationPreview,plannedChannelStatus} from './unified-channel-registry-offline.mjs';
const NOW=1794912000000;
const PROOF={ZALO_BOT:'ZALO_BOT_HEADER_AND_INSTALLATION',MESSENGER:'META_RAW_BODY_HMAC_AND_PAGE_BINDING',WEBSITE:'SIGNED_WEBSITE_SESSION_AND_STORE_BINDING'};
function fixture(channel='ZALO_BOT'){
 const event={channel,installationRef:'install-zalo-qa-01',eventRef:'event-msg-qa-001',providerActorRef:'actor-qa-0001',receivedAtMs:NOW-1000};
 const proof={source:'SYNTHETIC_INDEPENDENT_PROOF',verified:true,channel,installationRef:event.installationRef,eventRef:event.eventRef,kind:PROOF[channel]};
 const registry={source:'SYNTHETIC_SERVER_REGISTRY',channel,installationRef:event.installationRef,tenantRef:'tenant-qa-0001',storeRef:'store-A-qa-01',botVersion:'bot-v17-7b',policyVersion:'policy-v17-7b',syntheticOwnerBindingVerified:true,readOnly:true,allowSend:false,allowCommerceWrite:false};
 const seen=new Set();
 const bindings={executionMode:'SYNTHETIC_QA_ONLY',liveEnabled:false,ownerOaAvailable:false,nowMs:NOW,readProviderProof:async()=>proof,resolveServerInstallation:async()=>registry,reserveOnce:async k=>seen.has(k)?false:(seen.add(k),true)};
 return {event,proof,registry,bindings};
}
function locked(r){
 for(const k of ['realProviderVerified','realStoreOwnerVerified','realJwtRlsVerified','crossChannelIdentityLinked','allowCommerceReader','allowOrderWrite','allowStockWrite','allowProviderSend','allowNotificationSend','canPublish'])assert.equal(r[k],false,k);
 for(const k of ['modelCalls','providerSends','commerceWrites'])assert.equal(r[k],0,k);
}
async function rejected(reason,mutate,channel='ZALO_BOT'){
 const f=fixture(channel);mutate(f);
 const r=await inspectUnifiedSalesPreview(f.event,f.bindings);
 assert.equal(r.candidate,false,JSON.stringify(r));assert.equal(r.reason,reason);locked(r);
}
test('registry scopes are separate and OA not enabled',()=>{
 const r=describeChannels();
 assert.deepEqual(r.customerIngress,['ZALO_BOT','MESSENGER','WEBSITE','ZALO_OA']);
 assert.deepEqual(r.merchantNotification,['TELEGRAM','GMAIL']);
 assert.deepEqual(r.deferred,['ZALO_OA']);
 assert.equal(r.aiSalesDemoCredentialReuse,false);
});
for(const channel of Object.keys(PROOF))test('synthetic '+channel+' has no real authorization',async()=>{
 const f=fixture(channel),r=await inspectUnifiedSalesPreview(f.event,f.bindings);
 assert.equal(r.candidate,true);assert.equal(r.storeScoped,true);assert.match(r.conversationKey,/^[a-f0-9]{64}$/);locked(r);
 assert.equal(JSON.stringify(r).includes(f.registry.tenantRef),false);
});
test('OA requires real owner permission',async()=>rejected('ZALO_OA_NEEDS_REAL_OWNER_OAUTH_AND_NATIVE_PROVIDER_UAT',f=>f.event.channel='ZALO_OA'));
test('Telegram cannot enter Commerce as chat',async()=>rejected('NOT_A_RECOGNIZED_CUSTOMER_INGRESS',f=>f.event.channel='TELEGRAM'));
test('LINE not admitted without adapter',async()=>rejected('NOT_A_RECOGNIZED_CUSTOMER_INGRESS',f=>f.event.channel='LINE'));
for(const k of ['tenantId','storeId','sku','price','expected_total','isAdmin','oa_id','customerIdentity'])test('client authority '+k+' denied',async()=>rejected('CLIENT_SUPPLIED_STORE_AUTHORITY_OR_EXTRA_DATA',f=>{f.event[k]='override'}));
test('stale event denied',async()=>rejected('EVENT_EXPIRED_OR_FUTURE',f=>f.event.receivedAtMs=NOW-3600000));
test('real execution mode denied',async()=>rejected('SYNTHETIC_NO_SEND_GATE_NOT_ESTABLISHED',f=>f.bindings.liveEnabled=true));
test('proof backend unreachable denied',async()=>rejected('BACKEND_PROOF_OR_INSTALLATION_UNAVAILABLE',f=>{f.bindings.readProviderProof=async()=>{throw Error('offline')}}));
test('forged proof source denied',async()=>rejected('INVALID_OR_UNTRUSTED_CHANNEL_PROOF',f=>f.proof.source='CLIENT'));
test('provider attempts Store override denied',async()=>rejected('INVALID_OR_UNTRUSTED_CHANNEL_PROOF',f=>f.proof.storeRef='other-store'));
test('Messenger cannot reuse Zalo Bot proof',async()=>rejected('INVALID_OR_UNTRUSTED_CHANNEL_PROOF',f=>f.proof.kind=PROOF.ZALO_BOT,'MESSENGER'));
test('unbound Store denied',async()=>rejected('UNTRUSTED_CHANNEL_TO_STORE_INSTALLATION',f=>f.registry.syntheticOwnerBindingVerified=false));
test('missing read-only flag denied',async()=>rejected('UNTRUSTED_CHANNEL_TO_STORE_INSTALLATION',f=>delete f.registry.readOnly));
test('send-enabled installation denied',async()=>rejected('UNTRUSTED_CHANNEL_TO_STORE_INSTALLATION',f=>f.registry.allowSend=true));
test('Commerce write-enabled installation denied',async()=>rejected('UNTRUSTED_CHANNEL_TO_STORE_INSTALLATION',f=>f.registry.allowCommerceWrite=true));
test('replay backend down denied',async()=>rejected('DURABLE_REPLAY_RESERVATION_MISSING',f=>{f.bindings.reserveOnce=async()=>{throw Error('offline')}}));
test('duplicate message denied',async()=>{
 const f=fixture();assert.equal((await inspectUnifiedSalesPreview(f.event,f.bindings)).candidate,true);
 const r=await inspectUnifiedSalesPreview(f.event,f.bindings);assert.equal(r.reason,'DUPLICATE_MESSAGE_OR_REPLAY');locked(r);
});
test('same person not auto-linked across providers',async()=>{
 const results=await Promise.all(Object.keys(PROOF).map(async c=>{const f=fixture(c);return inspectUnifiedSalesPreview(f.event,f.bindings)}));
 assert.equal(new Set(results.map(r=>r.conversationKey)).size,3);results.forEach(locked);
});
test('same tenant different stores cannot share conversation scope',async()=>{
 const a=fixture(),b=fixture();b.registry.storeRef='store-B-qa-01';
 const [x,y]=await Promise.all([inspectUnifiedSalesPreview(a.event,a.bindings),inspectUnifiedSalesPreview(b.event,b.bindings)]);
 assert.equal(x.candidate,true);assert.equal(y.candidate,true);assert.notEqual(x.conversationKey,y.conversationKey);
});
test('unknown channels never become production permitted',()=>{
 for(const n of ['ZALO_BOT','MESSENGER','WEBSITE','ZALO_OA','TELEGRAM','GMAIL','LINE']){
  const s=plannedChannelStatus(n);assert.equal(s.canSend,false);assert.equal(s.canReceiveRealProviderTraffic,false);
 }
});
function notification(){
 const event={channel:'TELEGRAM',eventType:'ORDER_SAVED',eventRef:'order-saved-qa-01',storeRef:'store-A-qa-01'};
 const source={mode:'SYNTHETIC_QA_ONLY',noSend:true,fixtureReceiptSource:'SYNTHETIC_SAVED_ORDER',persistedInSyntheticFixture:true,eventRef:event.eventRef,storeRef:event.storeRef,tenantAuthVerifiedInRealWorld:false,aiSalesDemoCredentialReused:false};
 return {event,source};
}
for(const channel of ['TELEGRAM','GMAIL'])test(channel+' is notification-only no send',()=>{
 const n=notification();n.event.channel=channel;const r=inspectOwnerNotificationPreview(n.event,n.source);
 assert.equal(r.candidate,true);assert.equal(r.scope,'OWNER_NOTIFICATION');locked(r);
});
test('Messenger cannot become notification transport',()=>{
 const n=notification();n.event.channel='MESSENGER';
 const r=inspectOwnerNotificationPreview(n.event,n.source);assert.equal(r.reason,'CUSTOMER_CHANNEL_CANNOT_BE_NOTIFICATION_DISPATCHER');locked(r);
});
test('unpersisted order cannot be notified',()=>{
 const n=notification();n.source.persistedInSyntheticFixture=false;
 assert.equal(inspectOwnerNotificationPreview(n.event,n.source).reason,'SERVER_NOTIFICATION_RECEIPT_NOT_AUTHORIZED');
});
test('Demo credential reuse blocked',()=>{
 const n=notification();n.source.aiSalesDemoCredentialReused=true;
 assert.equal(inspectOwnerNotificationPreview(n.event,n.source).reason,'SERVER_NOTIFICATION_RECEIPT_NOT_AUTHORIZED');
});
test('client-supplied notification recipient blocked',()=>{
 const n=notification();n.event.recipient='another-recipient';
 assert.equal(inspectOwnerNotificationPreview(n.event,n.source).reason,'NOTIFICATION_AUTHORITY_CAME_FROM_UNTRUSTED_PAYLOAD');
});
