/**
 * CBOT-UAT-01 | independent NO-SEND readiness assertions against V16.7 source.
 * These are synthetic source-level gates only, NOT provider E2E acceptance.
 * No Meta/Zalo API, Supabase, order writes, private identity or paid models.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
 createSyntheticMerchantRuntime, writeRealOrder, sendRealMessage,
 callRealModel, publishToProduction
} from './merchant-registry.mjs';

const event=(account_id,channel='MESSENGER',synthetic_text='gia SAME01',extras={})=>({
 contract:'QA_VERIFIED_CHANNEL_EVENT_V1',
 account_id,channel,event_id:'QA-EVT-CBOT01',synthetic_text,...extras
});
const get=(r,acct='QA_META_A',channel='MESSENGER',text='gia SAME01')=>
 r.resolveTrustedQaChannel(event(acct,channel,text));
const blocked=(f,code)=>assert.throws(f,new RegExp(code));
const r=()=>createSyntheticMerchantRuntime();

test('XCH-01 quote on Messenger is shop-scoped but not an order',()=>{
 const x=r(),scope=get(x),view=x.route(scope),snapshot=x.mockSnapshot();
 assert.equal(view.intent,'FAST_CATALOG');
 assert.equal(view.catalog.store_id,'QA_STORE_A');
 assert.equal(view.catalog.price_vnd,159000);
 assert.equal(snapshot.hostedDbWrites,0);
});
test('XCH-01 confirmed order intent FAILS CLOSED without hosted writer',()=>{
 const x=r(),scope=get(x,'QA_META_A','MESSENGER','dat SAME01');
 assert.equal(x.route(scope).intent,'COMMERCE_BLOCKED');
 assert.equal(x.workflowEnvelope(scope).order_write,false);
 blocked(writeRealOrder,'V167_NO_RELEASE_OR_HOSTED_COMMERCE');
});
test('XCH-02 target Zalo OA account for Shop A is not a trusted mapping',()=>{
 blocked(()=>get(r(),'QA_ZALO_OA_A','ZALO_OA'),'CHANNEL_STORE_BINDING_UNVERIFIED');
});
test('XCH-02 order lookup method is not implemented in V16.7 runtime',()=>{
 assert.equal(typeof r().lookupOrder,'undefined');
});
test('XCH-03 cross-channel identity link method is not implemented',()=>{
 assert.equal(typeof r().linkIdentity,'undefined');
 assert.equal(typeof r().completeIdentityChallenge,'undefined');
});
test('XCH-03 source cannot accept a claimed customer_id from client event',()=>{
 blocked(()=>r().resolveTrustedQaChannel(event('QA_META_A','MESSENGER','gia SAME01',{customer_id:'QA_CUSTOMER_A'})),
   'UNTRUSTED_OR_NON_SYNTHETIC_EVENT');
});
test('XCH-04 returning Messenger cannot read real order status here',()=>{
 const x=r(),scope=get(x,'QA_META_A','MESSENGER','dat SAME01');
 const response=x.workflowEnvelope(scope);
 assert.equal(response.capability,'READ_ONLY_PREVIEW');
 assert.equal(response.order_write,false);
 assert.equal(typeof x.getOrderStatus,'undefined');
});
test('XCH-05 order update is unavailable and must not bypass writer gate',()=>{
 assert.equal(typeof r().updateOrder,'undefined');
 blocked(writeRealOrder,'V167_NO_RELEASE_OR_HOSTED_COMMERCE');
});
test('XCH-06 same Tenant Shop A/B have independent catalog and price',()=>{
 const x=r(),a=get(x),b=get(x,'QA_META_B');
 assert.equal(a.tenant_id,b.tenant_id);
 assert.notEqual(a.store_id,b.store_id);
 assert.equal(x.viewCatalog(a,'SAME01').price_vnd,159000);
 assert.equal(x.viewCatalog(b,'SAME01').price_vnd,209000);
});
test('XCH-06 client-injected store_id cannot select Shop B',()=>{
 blocked(()=>r().resolveTrustedQaChannel(event('QA_META_A','MESSENGER','gia SAME01',{store_id:'QA_STORE_B'})),
  'UNTRUSTED_OR_NON_SYNTHETIC_EVENT');
});
test('XCH-06 client-injected tenant_id cannot select Shop C',()=>{
 blocked(()=>r().resolveTrustedQaChannel(event('QA_META_A','MESSENGER','gia SAME01',{tenant_id:'QA_TENANT_2'})),
  'UNTRUSTED_OR_NON_SYNTHETIC_EVENT');
});
test('XCH-06 forged runtime scope cannot access another Store catalog',()=>{
 const x=r(),real=get(x);
 blocked(()=>x.viewCatalog({...real,store_id:'QA_STORE_B'},'SAME01'),
  'TRUSTED_RUNTIME_SCOPE_REQUIRED');
});
test('XCH-06 channel/account mismatch must not fall back to another Shop',()=>{
 blocked(()=>get(r(),'QA_ZALO_C','MESSENGER'),'CHANNEL_STORE_BINDING_UNVERIFIED');
});
test('XCH-06 Shop C has different tenant and separate Zalo Bot fixture',()=>{
 const x=r(),a=get(x),c=get(x,'QA_ZALO_C','ZALO_BOT');
 assert.notEqual(a.tenant_id,c.tenant_id);
 assert.equal(x.viewCatalog(c,'SAME01').price_vnd,259000);
});
test('CBOT-01 customer text cannot impersonate verified provider event',()=>{
 blocked(()=>r().resolveTrustedQaChannel(event('QA_META_A','MESSENGER','gia SAME01',{signature_verified:true})),
  'UNTRUSTED_OR_NON_SYNTHETIC_EVENT');
});
test('CBOT-01 direct fabricated context is refused',()=>{
 blocked(()=>r().route(Object.freeze({tenant_id:'QA_TENANT_1',store_id:'QA_STORE_A'})),
  'TRUSTED_RUNTIME_SCOPE_REQUIRED');
});
test('CBOT-01 expired subscription invalidates even previously issued scope',()=>{
 const x=r(),scope=get(x);
 x.setSubscriptionForSyntheticTest('QA_STORE_A','EXPIRED');
 blocked(()=>x.route(scope),'STALE_OR_REVOKED_RUNTIME_SCOPE');
});
test('CBOT-01 editing Shop A draft cannot alter approved Shop B',()=>{
 const x=r(),before=x.exportPublicProfile({actor_id:'QA_OWNER_B',store_id:'QA_STORE_B'});
 const draft=x.proposeBotChange({actor_id:'QA_MANAGER_A',store_id:'QA_STORE_A',expected_version:1,
   patch:{bot_name:'Bot QA A mới'}});
 assert.equal(draft.state,'DRAFT');
 assert.equal(draft.publish_status,'BLOCKED');
 const after=x.exportPublicProfile({actor_id:'QA_OWNER_B',store_id:'QA_STORE_B'});
 assert.deepEqual(after,before);
});
test('CBOT-01 raw messenger send is hard blocked',()=>{
 blocked(sendRealMessage,'V167_NO_RELEASE_OR_HOSTED_COMMERCE');
});
test('CBOT-01 paid AI invocation is hard blocked',()=>{
 blocked(callRealModel,'V167_NO_RELEASE_OR_HOSTED_COMMERCE');
});
test('CBOT-01 production release is hard blocked',()=>{
 blocked(publishToProduction,'V167_NO_RELEASE_OR_HOSTED_COMMERCE');
});
test('CBOT-01 external effects remain zero after synthetic previews',()=>{
 const x=r();
 x.route(get(x));
 x.route(get(x,'QA_META_B'));
 x.route(get(x,'QA_ZALO_C','ZALO_BOT'));
 const s=x.mockSnapshot();
 assert.equal(s.liveProviderSends,0);
 assert.equal(s.hostedDbWrites,0);
 assert.equal(s.modelApiCalls,0);
});
