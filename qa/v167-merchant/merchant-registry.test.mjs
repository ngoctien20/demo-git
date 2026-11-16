import test from 'node:test';
import assert from 'node:assert/strict';
import {
 REGISTRY_CONTRACT,RUNTIME_CONTRACT,NO_SEND,INDUSTRY_ATTRIBUTES,TIER_LIMITS,
 createSyntheticMerchantRuntime,compareCloneVsShared,
 callRealModel,writeRealOrder,sendRealMessage,publishToProduction
} from './merchant-registry.mjs';
const event=(account_id='QA_META_A', channel='MESSENGER',synthetic_text='gia SAME01',more={})=>({
 contract:'QA_VERIFIED_CHANNEL_EVENT_V1',channel,account_id,event_id:'QA-EVT-0001',synthetic_text,...more
});
const runtime=()=>createSyntheticMerchantRuntime();
const err=(fn,code)=>assert.throws(fn,new RegExp(code));
const scope=(r,a='QA_META_A',ch='MESSENGER',msg='gia SAME01')=>r.resolveTrustedQaChannel(event(a,ch,msg));
test('01 contract pinned',()=>assert.equal(REGISTRY_CONTRACT,'TIEN404_MERCHANT_CONFIG_V16_7_SYNTHETIC'));
test('02 runtime contract pinned',()=>assert.equal(RUNTIME_CONTRACT,'TIEN404_SHARED_RUNTIME_V16_7_NO_SEND'));
test('03 mode pinned no-send',()=>assert.equal(NO_SEND,'SYNTHETIC_ONLY_NO_SEND'));
test('04 same Tenant multi-store Shop A/B',()=>{
 const r=runtime(),a=scope(r),b=scope(r,'QA_META_B');
 assert.equal(a.tenant_id,b.tenant_id);assert.notEqual(a.store_id,b.store_id);
});
test('05 cross-tenant shop C',()=>{
 const r=runtime(),a=scope(r),c=scope(r,'QA_ZALO_C','ZALO_BOT');
 assert.notEqual(a.tenant_id,c.tenant_id);
});
test('06 same SKU scoped price Shop A',()=>{
 const r=runtime(),a=r.viewCatalog(scope(r),'SAME01');
 assert.equal(a.price_vnd,159000);assert.equal(a.store_id,'QA_STORE_A');
});
test('07 same SKU scoped price Shop B',()=>{
 const r=runtime(),b=r.viewCatalog(scope(r,'QA_META_B'),'SAME01');
 assert.equal(b.price_vnd,209000);assert.equal(b.store_id,'QA_STORE_B');
});
test('08 same SKU scoped price Shop C',()=>{
 const r=runtime(),c=r.viewCatalog(scope(r,'QA_ZALO_C','ZALO_BOT'),'SAME01');
 assert.equal(c.price_vnd,259000);assert.equal(c.store_id,'QA_STORE_C');
});
test('09 malicious store_id in customer event fails closed',()=>err(()=>{
 const r=runtime();r.resolveTrustedQaChannel(event('QA_META_A','MESSENGER','gia SAME01',{store_id:'QA_STORE_B'}));
},'UNTRUSTED'));
test('10 malicious tenant_id in customer event fails closed',()=>err(()=>{
 const r=runtime();r.resolveTrustedQaChannel(event('QA_META_A','MESSENGER','gia SAME01',{tenant_id:'QA_TENANT_2'}));
},'UNTRUSTED'));
test('11 malicious role in customer event fails closed',()=>err(()=>{
 const r=runtime();r.resolveTrustedQaChannel(event('QA_META_A','MESSENGER','gia SAME01',{role:'OWNER'}));
},'UNTRUSTED'));
test('12 malicious customer phone text is denied',()=>err(()=>runtime().resolveTrustedQaChannel(event('QA_META_A','MESSENGER','0901234567')),'UNTRUSTED'));
test('13 malformed event ID rejected',()=>err(()=>runtime().resolveTrustedQaChannel(event('QA_META_A','MESSENGER','gia SAME01',{event_id:'secret'})),'UNTRUSTED'));
test('14 channel/account mismatch denied',()=>err(()=>runtime().resolveTrustedQaChannel(event('QA_ZALO_C','MESSENGER')),'CHANNEL_STORE_BINDING'));
test('15 unknown account denied',()=>err(()=>runtime().resolveTrustedQaChannel(event('QA_UNKNOWN','MESSENGER')),'CHANNEL_STORE_BINDING'));
test('16 unsupported arbitrary channel denied',()=>err(()=>runtime().resolveTrustedQaChannel(event('QA_META_A','UNKNOWN')),'UNTRUSTED'));
test('17 fake client context object denied even if fields match',()=>{
 const r=runtime(),valid=scope(r);
 err(()=>r.route({...valid}),'TRUSTED_RUNTIME_SCOPE');
});
test('18 direct forged context denied',()=>{
 const r=runtime();
 err(()=>r.viewCatalog({store_id:'QA_STORE_B',tenant_id:'QA_TENANT_1',contract:RUNTIME_CONTRACT},'SAME01'),
 'TRUSTED_RUNTIME_SCOPE');
});
test('19 invalid sku denied rather than cross-Shop fallback',()=>err(()=>{
 const r=runtime();r.viewCatalog(scope(r),'A999');
},'CATALOG_QUERY_INVALID'));
test('20 catalog does not expose customer or credential data',()=>{
 const r=runtime(),result=r.viewCatalog(scope(r),'SAME01');
 assert.equal('phone' in result,false);assert.equal('credential' in result,false);
});
test('21 greet Shop A uses A greeting',()=>{
 const r=runtime(),v=r.route(scope(r,'QA_META_A','MESSENGER','xin chao'));
 assert.equal(v.answer_preview,'Xin chào cửa hàng A');assert.equal(v.intent,'FAST_FAQ');
});
test('22 greet Shop B uses B greeting',()=>{
 const r=runtime(),v=r.route(scope(r,'QA_META_B','MESSENGER','xin chao'));
 assert.equal(v.answer_preview,'Xin chào cửa hàng B');
});
test('23 quote routes catalog read only',()=>{
 const r=runtime(),v=r.route(scope(r));assert.equal(v.intent,'FAST_CATALOG');
 assert.equal(v.catalog.price_vnd,159000);assert.equal(v.no_send,true);
});
test('24 request to order blocked',()=>{
 const r=runtime(),v=r.route(scope(r,'QA_META_A','MESSENGER','dat SAME01'));
 assert.equal(v.intent,'COMMERCE_BLOCKED');assert.equal(v.no_send,true);
});
test('25 support is preview only',()=>{
 const r=runtime(),v=r.route(scope(r,'QA_META_A','MESSENGER','ho tro'));
 assert.equal(v.intent,'HANDOFF_PREVIEW');assert.equal(v.createTicket,false);
});
test('26 AI model is a policy label, not a paid call',()=>{
 const r=runtime(),v=r.route(scope(r,'QA_META_A','MESSENGER','tu van san pham'));
 assert.equal(v.intent,'AI_PREVIEW');assert.equal(v.invoke_model,false);
});
test('27 Economy has one concurrency slot proposed',()=>{
 const r=runtime(),v=r.route(scope(r,'QA_META_A','MESSENGER','tu van san pham'));
 assert.equal(v.max_concurrent_ai,1);
});
test('28 Standard has two concurrency slots proposed',()=>{
 const r=runtime(),v=r.route(scope(r,'QA_META_B','MESSENGER','tu van san pham'));
 assert.equal(v.max_concurrent_ai,2);
});
test('29 Priority has five concurrency slots proposed',()=>{
 const r=runtime(),v=r.route(scope(r,'QA_ZALO_C','ZALO_BOT','tu van san pham'));
 assert.equal(v.max_concurrent_ai,5);
});
test('30 shared n8n envelope contains strict Store scope',()=>{
 const r=runtime(),v=r.workflowEnvelope(scope(r,'QA_META_B'));
 assert.equal(v.tenant_id,'QA_TENANT_1');assert.equal(v.store_id,'QA_STORE_B');
 assert.equal(v.capability,'READ_ONLY_PREVIEW');assert.equal(v.order_write,false);
});
test('31 shared n8n envelope omits raw chat and secrets',()=>{
 const r=runtime(),v=r.workflowEnvelope(scope(r));
 for(const k of ['raw_message','access_token','credential_reference','sender_id','phone'])assert.equal(k in v,false);
});
test('32 workflow envelope uses no model or provider send',()=>{
 const r=runtime(),v=r.workflowEnvelope(scope(r));
 assert.equal(v.model_call,false);assert.equal(v.provider_send,false);
});
test('33 propose staff draft scoped to Shop A',()=>{
 const r=runtime(),d=r.proposeBotChange({actor_id:'QA_TIEN404_SUPPORT',store_id:'QA_STORE_A',
 expected_version:1,patch:{greeting:'Xin chào khách A mới'}});
 assert.equal(d.contract,REGISTRY_CONTRACT);assert.equal(d.state,'DRAFT');
 assert.equal(d.candidate_version,2);assert.equal(d.publish_status,'BLOCKED');
});
test('34 staff cannot edit Shop B without explicit scope',()=>err(()=>{
 const r=runtime();r.proposeBotChange({actor_id:'QA_TIEN404_SUPPORT',store_id:'QA_STORE_B',
 expected_version:1,patch:{greeting:'Xin chào khách B mới'}});
},'ACTOR_STORE_SCOPE_DENIED'));
test('35 manager A cannot edit Shop B',()=>err(()=>{
 const r=runtime();r.proposeBotChange({actor_id:'QA_MANAGER_A',store_id:'QA_STORE_B',
 expected_version:1,patch:{greeting:'Xin chào khách B mới'}});
},'ACTOR_STORE_SCOPE_DENIED'));
test('36 clerk staff cannot edit bot',()=>err(()=>{
 const r=runtime();r.proposeBotChange({actor_id:'QA_STAFF_A',store_id:'QA_STORE_A',
 expected_version:1,patch:{greeting:'Xin chào mới'}});
},'ROLE_CANNOT_EDIT_BOT'));
test('37 disabled staff cannot edit bot',()=>err(()=>{
 const r=runtime();r.proposeBotChange({actor_id:'QA_TIEN404_EXPIRED',store_id:'QA_STORE_A',
 expected_version:1,patch:{greeting:'Xin chào mới'}});
},'ACTOR_STORE_SCOPE_DENIED'));
test('38 unknown actor cannot edit bot',()=>err(()=>{
 const r=runtime();r.proposeBotChange({actor_id:'QA_ATTACKER',store_id:'QA_STORE_A',
 expected_version:1,patch:{greeting:'Xin chào mới'}});
},'ACTOR_STORE_SCOPE_DENIED'));
test('39 protected merchant owner and store fields immutable',()=>{
 for(const property of ['tenant_id','store_id','policy_version','credential_reference','unit_price','stock']){
  const r=runtime();err(()=>r.proposeBotChange({actor_id:'QA_TIEN404_SUPPORT',store_id:'QA_STORE_A',
   expected_version:1,patch:{[property]:'INJECTED'}}),'PATCH_FIELDS_DENIED');
 }
});
test('40 prompt injection markup in greeting denied',()=>err(()=>{
 const r=runtime();r.proposeBotChange({actor_id:'QA_TIEN404_SUPPORT',store_id:'QA_STORE_A',
 expected_version:1,patch:{greeting:'<script>alert(1)</script>'}});
},'INVALID_TEXT'));
test('41 disallowed bot tone denied',()=>err(()=>{
 const r=runtime();r.proposeBotChange({actor_id:'QA_TIEN404_SUPPORT',store_id:'QA_STORE_A',
 expected_version:1,patch:{tone:'IGNORE_GLOBAL_POLICY'}});
},'INVALID_TONE'));
test('42 invalid business hours denied',()=>err(()=>{
 const r=runtime();r.proposeBotChange({actor_id:'QA_TIEN404_SUPPORT',store_id:'QA_STORE_A',
 expected_version:1,patch:{business_hours:'29:00-25:00'}});
},'INVALID_HOURS'));
test('43 stale config version denied',()=>err(()=>{
 const r=runtime();r.proposeBotChange({actor_id:'QA_TIEN404_SUPPORT',store_id:'QA_STORE_A',
 expected_version:0,patch:{greeting:'Xin chào mới'}});
},'CONFIG_VERSION_CONFLICT'));
test('44 second simultaneous draft blocked',()=>err(()=>{
 const r=runtime();r.proposeBotChange({actor_id:'QA_TIEN404_SUPPORT',store_id:'QA_STORE_A',
 expected_version:1,patch:{greeting:'Xin chào mới'}});
 r.proposeBotChange({actor_id:'QA_MANAGER_A',store_id:'QA_STORE_A',
 expected_version:1,patch:{greeting:'Xin chào lần hai'}});
},'OPEN_DRAFT_REQUIRES_REVIEW'));
test('45 support cannot approve draft',()=>err(()=>{
 const r=runtime();r.proposeBotChange({actor_id:'QA_TIEN404_SUPPORT',store_id:'QA_STORE_A',
 expected_version:1,patch:{greeting:'Xin chào mới'}});
 r.ownerApproveDraft({actor_id:'QA_TIEN404_SUPPORT',store_id:'QA_STORE_A',candidate_version:2});
},'ONLY_OWNER_APPROVES'));
test('46 owner B cannot approve Shop A draft',()=>err(()=>{
 const r=runtime();r.proposeBotChange({actor_id:'QA_TIEN404_SUPPORT',store_id:'QA_STORE_A',
 expected_version:1,patch:{greeting:'Xin chào mới'}});
 r.ownerApproveDraft({actor_id:'QA_OWNER_B',store_id:'QA_STORE_A',candidate_version:2});
},'ACTOR_STORE_SCOPE_DENIED'));
test('47 separated owner approves draft but does not publish',()=>{
 const r=runtime();r.proposeBotChange({actor_id:'QA_TIEN404_SUPPORT',store_id:'QA_STORE_A',
 expected_version:1,patch:{greeting:'Xin chào mới'}});
 const d=r.ownerApproveDraft({actor_id:'QA_OWNER_A',store_id:'QA_STORE_A',candidate_version:2});
 assert.equal(d.state,'OWNER_APPROVED_PREVIEW_ONLY');assert.equal(d.publish_status,'BLOCKED');
 const preview=r.previewApprovedDraft({actor_id:'QA_OWNER_A',store_id:'QA_STORE_A'});
 assert.equal(preview.not_published,true);assert.equal(preview.greeting,'Xin chào mới');
 assert.equal(r.route(scope(r,'QA_META_A','MESSENGER','xin chao')).answer_preview,'Xin chào cửa hàng A');
});
test('48 self approval is forbidden',()=>err(()=>{
 const r=runtime();r.proposeBotChange({actor_id:'QA_OWNER_A',store_id:'QA_STORE_A',
 expected_version:1,patch:{greeting:'Xin chào mới'}});
 r.ownerApproveDraft({actor_id:'QA_OWNER_A',store_id:'QA_STORE_A',candidate_version:2});
},'SEPARATION_OF_DUTIES'));
test('49 owner B does not see Shop A draft',()=>err(()=>{
 const r=runtime();r.proposeBotChange({actor_id:'QA_TIEN404_SUPPORT',store_id:'QA_STORE_A',
 expected_version:1,patch:{greeting:'Xin chào mới'}});
 r.inspectDraft('QA_OWNER_B','QA_STORE_A');
},'ACTOR_STORE_SCOPE_DENIED'));
test('50 Shop B catalog remains unchanged by Shop A draft',()=>{
 const r=runtime();r.proposeBotChange({actor_id:'QA_TIEN404_SUPPORT',store_id:'QA_STORE_A',
 expected_version:1,patch:{greeting:'Xin chào mới'}});
 assert.equal(r.viewCatalog(scope(r,'QA_META_B'),'SAME01').price_vnd,209000);
});
test('51 public profile export gated by synthetic role',()=>{
 const r=runtime(),v=r.exportPublicProfile({actor_id:'QA_OWNER_A',store_id:'QA_STORE_A'});
 assert.equal(v.bot_name,'Trợ lý A');assert.equal('phone' in v,false);
});
test('52 staff cannot export public profile',()=>err(()=>{
 runtime().exportPublicProfile({actor_id:'QA_STAFF_A',store_id:'QA_STORE_A'});
},'PROFILE_EXPORT_FORBIDDEN'));
test('53 expired Shop blocks resolving future ingress',()=>{
 const r=runtime();r.setSubscriptionForSyntheticTest('QA_STORE_A','EXPIRED');
 err(()=>scope(r),'SUBSCRIPTION_OR_STORE_INACTIVE');
});
test('54 expired Shop revokes already-issued mock scope',()=>{
 const r=runtime(),s=scope(r);
 r.setSubscriptionForSyntheticTest('QA_STORE_A','EXPIRED');
 err(()=>r.route(s),'STALE_OR_REVOKED_RUNTIME_SCOPE');
});
test('55 expired Shop blocks new edits',()=>err(()=>{
 const r=runtime();r.setSubscriptionForSyntheticTest('QA_STORE_A','EXPIRED');
 r.proposeBotChange({actor_id:'QA_TIEN404_SUPPORT',store_id:'QA_STORE_A',
 expected_version:1,patch:{greeting:'Xin chào mới'}});
},'INACTIVE_STORE_CANNOT_EDIT'));
test('56 unknown subscription status rejected',()=>err(()=>{
 runtime().setSubscriptionForSyntheticTest('QA_STORE_A','ACTIVE_UNPAID');
},'INVALID_SUBSCRIPTION'));
test('57 synthetic snapshot has no customer rows, credential, or token',()=>{
 const r=runtime(),v=JSON.stringify(r.mockSnapshot());
 for(const token of ['access_token','password','customer_phone','address','api_key','secret'])
 assert.equal(v.includes(token),false);
});
test('58 no live provider send, hosted DB write or model API',()=>{
 const r=runtime(),v=r.mockSnapshot();
 assert.deepEqual([v.liveProviderSends,v.hostedDbWrites,v.modelApiCalls],[0,0,0]);
});
test('59 all production actions throw even with synthetic scope',()=>{
 for(const fn of [callRealModel,writeRealOrder,sendRealMessage,publishToProduction])
 assert.throws(fn,/V167_NO_RELEASE_OR_HOSTED_COMMERCE/);
});
test('60 no hardcoded provider access for Zalo OA',()=>err(()=>{
 runtime().resolveTrustedQaChannel(event('QA_ZALO_C','ZALO_OA'));
},'CHANNEL_STORE_BINDING_UNVERIFIED'));
test('61 industry profiles vary by store type',()=>{
 assert(INDUSTRY_ATTRIBUTES.FASHION.attrs.includes('size'));
 assert(INDUSTRY_ATTRIBUTES.GROCERY.attrs.includes('package_size'));
 assert(INDUSTRY_ATTRIBUTES.MATERIALS.attrs.includes('grade'));
});
test('62 tier limits are proposals, not hosted quotas',()=>{
 assert.equal(TIER_LIMITS.ECONOMY.rpm,5);
 assert.equal(TIER_LIMITS.PRIORITY.aiConcurrency,5);
});
test('63 total workload estimate 100 shops shared 10%',()=>{
 const v=compareCloneVsShared({shops:100,messagesPerShop:1000,orchestrationRate:.1});
 assert.equal(v.monthlyMessages,100000);
 assert.equal(v.estimatedSharedOrchestratorInvocations,10000);
 assert.equal(v.workflowCloneCountHypothesis,600);
 assert.equal(v.sharedCoreWorkflowLibraryHypothesis,6);
 assert.equal(v.hypotheticalOnly,true);
});
test('64 reject invalid capacity assumptions',()=>{
 err(()=>compareCloneVsShared({shops:0,messagesPerShop:100,orchestrationRate:.1}),'INVALID');
 err(()=>compareCloneVsShared({shops:1,messagesPerShop:100,orchestrationRate:1.1}),'INVALID');
});
test('65 isolated registries do not share mutation',()=>{
 const a=runtime(),b=runtime();
 a.proposeBotChange({actor_id:'QA_TIEN404_SUPPORT',store_id:'QA_STORE_A',
 expected_version:1,patch:{greeting:'Xin chào mới'}});
 assert.equal(b.inspectDraft('QA_OWNER_A','QA_STORE_A'),null);
});
