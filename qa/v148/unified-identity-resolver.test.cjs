'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createHmac}=require('node:crypto');
const {buildResolver,VERSION}=require('./unified-identity-resolver.cjs');
const SECRET=Buffer.from('V148_SYNTHETIC_ONLY_SIGNER_NOT_META_OR_ZALO_20261116');
const NOW=Date.parse('2026-11-16T09:00:00.000Z');
const base={environment:'qa',status:'active',binding_version:1,config_version:1,
 subscription_active:true,store_active:true,can_process:true,can_send:false,
 greeting:'Xin chào từ cửa hàng QA!',hours:'08:00–21:00 QA'};
function b(id,channel,provider,account,bot,tenant,store,profile){
 return {...base,id,channel,provider,provider_account_ref:account,provider_bot_ref:bot,
  tenant_id:tenant,store_id:store,bot_profile_id:profile};
}
const bindings=[
 b('BINDING_QA_META_A','messenger','meta','PAGE_A','BOT_A','TENANT_QA_1','STORE_QA_A','BOT_QA_A'),
 b('BINDING_QA_META_B','messenger','meta','PAGE_B','BOT_B','TENANT_QA_1','STORE_QA_B','BOT_QA_B'),
 b('BINDING_QA_ZBOT_C','zalo_bot','zalo','ZBOT_C','BOT_C','TENANT_QA_2','STORE_QA_C','BOT_QA_C'),
 b('BINDING_QA_ZOA_A','zalo_oa','zalo','ZOA_A','BOT_OA_A','TENANT_QA_1','STORE_QA_A','BOT_QA_OA_A'),
 b('BINDING_QA_WEB_B','website_widget','firstparty','WEBSITE_B','WIDGET_B','TENANT_QA_1','STORE_QA_B','BOT_QA_WEB_B')
];
const products=[
 {store_id:'STORE_QA_A',sku:'A002',name:'Áo trắng A',price_vnd:159000,stock:25,active:true},
 {store_id:'STORE_QA_B',sku:'A002',name:'Áo trắng B',price_vnd:209000,stock:8,active:true},
 {store_id:'STORE_QA_C',sku:'C001',name:'Sản phẩm C',price_vnd:99000,stock:12,active:true}
];
let seq=0;const config={mode:'OFFLINE_SYNTHETIC_NO_SEND',adapterSecret:SECRET,bindings,products,now:()=>NOW};
const gate=(overrides={})=>buildResolver({...config,...overrides});
function envelope(text,{binding=bindings[0],user='QA_SHARED_USER',conversation='QA_CONV',
    event_id,occurred_at=NOW,...other}={}){
 return {event_id:event_id||'E_'+(++seq),trace_id:'TRACE_QA',channel:binding.channel,provider:binding.provider,
  environment:binding.environment,provider_account_ref:binding.provider_account_ref,
  provider_bot_ref:binding.provider_bot_ref,provider_user_ref:user,
  provider_conversation_ref:conversation,event_type:'message',occurred_at,text,...other};
}
function signed(e,secret=SECRET){
 const rawBody=Buffer.from(JSON.stringify(e),'utf8');
 const signature='sha256='+createHmac('sha256',secret).update(rawBody).digest('hex');
 return {rawBody,signature};
}
function send(g,text,opt={}){return g.route(signed(envelope(text,opt)));}
function refuse(r,reason){assert.equal(r.trusted,false);assert.equal(r.resolution_status,'DENIED');
 if(reason)assert.equal(r.reason,reason);
 assert.equal(r.provider_sends,0);assert.equal(r.order_writes,0);assert.equal(r.hosted_writes,0);}
function accepted(r,store,tenant){
 assert.equal(r.trusted,true);assert.equal(r.store_id,store);assert.equal(r.tenant_id,tenant);
 assert.equal(r.can_send,false);assert.equal(r.policy.can_send,false);assert.equal(r.provider_sends,0);
 assert.equal(r.order_writes,0);assert.equal(r.hosted_writes,0);assert.equal(r.contract_version,VERSION);
 assert.ok(!JSON.stringify(r).includes('QA_SHARED_USER'));
}
test('01 explicit OFFLINE fixture configuration only',()=>assert.throws(()=>gate({mode:'LIVE'}),/QA_CONFIG_INVALID/));
test('02 no signer secret',()=>assert.throws(()=>gate({adapterSecret:null}),/QA_CONFIG_INVALID/));
test('03 require registry',()=>assert.throws(()=>gate({bindings:[]}),/QA_CONFIG_INVALID/));
test('04 reject duplicate provider account + bot binding',()=>assert.throws(()=>gate({bindings:[bindings[0],{...bindings[0],id:'BINDING_QA_OTHER'}]}),/DUPLICATE_ACTIVE_PROVIDER_BINDING/));
test('05 prohibit provider/channel mismatch',()=>assert.throws(()=>gate({bindings:[{...bindings[0],provider:'zalo'}]}),/BINDING_CONFIG_INVALID/));
test('06 prohibit send-enabled binding even in synthetic mode',()=>assert.throws(()=>gate({bindings:[{...bindings[0],can_send:true}]}),/BINDING_CONFIG_INVALID/));
test('07 prohibit duplicated sku per store',()=>assert.throws(()=>gate({products:[products[0],products[0]]}),/QA_DUPLICATE_SKU/));
test('08 negative product price invalid',()=>assert.throws(()=>gate({products:[{...products[0],price_vnd:-1}]}),/QA_PRODUCT_INVALID/));
test('09 floating product price invalid',()=>assert.throws(()=>gate({products:[{...products[0],price_vnd:159000.5}]}),/QA_PRODUCT_INVALID/));
test('10 floating stock invalid',()=>assert.throws(()=>gate({products:[{...products[0],stock:1.2}]}),/QA_PRODUCT_INVALID/));
test('11 Messenger Shop A binding trusted',()=>{
 const r=send(gate(),'Chào');accepted(r,'STORE_QA_A','TENANT_QA_1');
});
test('12 Messenger Shop B binding trusted independently',()=>{
 const r=send(gate(),'Chào',{binding:bindings[1]});accepted(r,'STORE_QA_B','TENANT_QA_1');
});
test('13 Zalo Bot Shop C binding trusted',()=>{
 const r=send(gate(),'Chào',{binding:bindings[2]});accepted(r,'STORE_QA_C','TENANT_QA_2');
});
test('14 Zalo OA Shop A binding trusted',()=>{
 const r=send(gate(),'Chào',{binding:bindings[3]});accepted(r,'STORE_QA_A','TENANT_QA_1');
});
test('15 Website Widget Shop B binding trusted',()=>{
 const r=send(gate(),'Chào',{binding:bindings[4]});accepted(r,'STORE_QA_B','TENANT_QA_1');
});
test('16 same external user ID not linked between channels',()=>{
 const g=gate(),a=send(g,'Chào',{binding:bindings[0]}),b=send(g,'Chào',{binding:bindings[3]});
 assert.notEqual(a.external_identity_id,b.external_identity_id);
 assert.notEqual(a.conversation_id,b.conversation_id);
});
test('17 same provider user ID not linked across two Messenger Pages',()=>{
 const g=gate(),a=send(g,'Chào',{binding:bindings[0]}),b=send(g,'Chào',{binding:bindings[1]});
 assert.notEqual(a.external_identity_id,b.external_identity_id);
});
test('18 internal conversation stable for same Page + user across new messages',()=>{
 const g=gate(),a=send(g,'Chào'),b=send(g,'Xin chào');
 assert.equal(a.external_identity_id,b.external_identity_id);
 assert.equal(a.conversation_id,b.conversation_id);
});
test('19 different conversation ref changes scoped conversation ID',()=>{
 const g=gate(),a=send(g,'Chào',{conversation:'QA_CONV_A'}),b=send(g,'Chào',{conversation:'QA_CONV_B'});
 assert.notEqual(a.conversation_id,b.conversation_id);
});
test('20 same event ID replay blocked before any response',()=>{
 const g=gate(),e=envelope('Chào',{event_id:'E_REPLAY'}),s=signed(e);
 const a=g.route(s),b=g.route(s);assert.equal(a.trusted,true);refuse(b,'DUPLICATE_EVENT_NO_SEND');
});
test('21 replay with changed text but same event id fail closed',()=>{
 const g=gate();g.route(signed(envelope('Chào',{event_id:'E_CONFLICT'})));
 refuse(g.route(signed(envelope('Đặt 1 áo A002',{event_id:'E_CONFLICT'}))),'REPLAY_EVENT_MUTATION');
});
test('22 invalid signature fail closed',()=>{
 const g=gate(),s=signed(envelope('Chào'));s.signature='sha256='+'0'.repeat(64);
 refuse(g.route(s),'SYNTHETIC_ADAPTER_SIGNATURE_INVALID');
});
test('23 wrong secret fail closed',()=>{
 const g=gate();refuse(g.route(signed(envelope('Chào'),Buffer.from('wrong_signing_key'))),'SYNTHETIC_ADAPTER_SIGNATURE_INVALID');
});
test('24 missing signature fail closed',()=>{
 const g=gate();refuse(g.route({rawBody:signed(envelope('Chào')).rawBody,signature:''}),'SIGNATURE_MISSING');
});
test('25 tampering after signing detected',()=>{
 const g=gate(),x=signed(envelope('Chào'));
 x.rawBody=Buffer.from(x.rawBody.toString().replace('Chào','Đặt 2 áo'));
 refuse(g.route(x),'SYNTHETIC_ADAPTER_SIGNATURE_INVALID');
});
test('26 unknown provider Page cannot fallback to default',()=>{
 const g=gate(),e=envelope('Chào',{provider_account_ref:'UNLISTED_PAGE'});
 refuse(g.route(signed(e)),'TRUSTED_BINDING_NOT_FOUND');
});
test('27 same account different provider bot ref cannot override',()=>{
 const g=gate(),e=envelope('Chào',{provider_bot_ref:'HACKED_BOT'});
 refuse(g.route(signed(e)),'TRUSTED_BINDING_NOT_FOUND');
});
test('28 explicit tenant_id in signed payload is prohibited',()=>{
 const g=gate(),e=envelope('Chào',{tenant_id:'TENANT_QA_2'});
 refuse(g.route(signed(e)),'NORMALIZED_EVENT_SHAPE_INVALID');
});
test('29 explicit store_id in signed payload prohibited',()=>{
 const g=gate(),e=envelope('Chào',{store_id:'STORE_QA_C'});
 refuse(g.route(signed(e)),'NORMALIZED_EVENT_SHAPE_INVALID');
});
test('30 unapproved channel prohibited',()=>{
 const g=gate(),e=envelope('Chào',{channel:'zalo_oa',provider:'meta'});
 refuse(g.route(signed(e)),'NORMALIZED_EVENT_INVALID');
});
test('31 non QA environment prohibited',()=>{
 const g=gate(),e=envelope('Chào',{environment:'production'});
 refuse(g.route(signed(e)),'NORMALIZED_EVENT_INVALID');
});
test('32 event too old rejected',()=>{
 const g=gate(),e=envelope('Chào',{occurred_at:NOW-31*60*1000});
 refuse(g.route(signed(e)),'NORMALIZED_EVENT_INVALID');
});
test('33 event far future rejected',()=>{
 const g=gate(),e=envelope('Chào',{occurred_at:NOW+10*60*1000});
 refuse(g.route(signed(e)),'NORMALIZED_EVENT_INVALID');
});
test('34 unsupported event type denied',()=>{
 const g=gate(),e=envelope('Chào',{event_type:'payment'});
 refuse(g.route(signed(e)),'NORMALIZED_EVENT_INVALID');
});
test('35 null event denied',()=>{
 const g=gate();refuse(g.route(signed(null)),'NORMALIZED_EVENT_SHAPE_INVALID');
});
test('36 array instead of event denied',()=>{
 const g=gate();refuse(g.route(signed([])),'NORMALIZED_EVENT_SHAPE_INVALID');
});
test('37 store revocation invalidates warm binding cache immediately',()=>{
 const g=gate(),first=send(g,'Chào');assert.equal(first.trusted,true);
 g.setFixtureStatus('BINDING_QA_META_A',{status:'revoked'});
 refuse(send(g,'Xin chào'),'BINDING_REVOKED_SUBSCRIPTION_OR_STORE_INACTIVE');
});
test('38 shop temporary closed blocks even cached route',()=>{
 const g=gate();send(g,'Chào');g.setFixtureStatus('BINDING_QA_META_A',{store_active:false});
 refuse(send(g,'Chào'),'BINDING_REVOKED_SUBSCRIPTION_OR_STORE_INACTIVE');
});
test('39 subscription expired blocks even cached route',()=>{
 const g=gate();send(g,'Chào');g.setFixtureStatus('BINDING_QA_META_A',{subscription_active:false});
 refuse(send(g,'Chào'),'BINDING_REVOKED_SUBSCRIPTION_OR_STORE_INACTIVE');
});
test('40 failed policy blocks even cached route',()=>{
 const g=gate();send(g,'Chào');g.setFixtureStatus('BINDING_QA_META_A',{can_process:false});
 refuse(send(g,'Chào'),'BINDING_REVOKED_SUBSCRIPTION_OR_STORE_INACTIVE');
});
test('41 Fast Path greeting after trusted identity',()=>{
 const r=send(gate(),'Xin chào');accepted(r,'STORE_QA_A','TENANT_QA_1');
 assert.equal(r.route,'FAST');assert.equal(r.fast_path,'GREETING');
});
test('42 Fast Path hours after trusted identity',()=>{
 const r=send(gate(),'Shop mấy giờ mở cửa?');assert.equal(r.route,'FAST');assert.equal(r.fast_path,'HOURS');
});
test('43 Fast Path sku A002 returns Shop A price',()=>{
 const r=send(gate(),'Báo giá A002');accepted(r,'STORE_QA_A','TENANT_QA_1');
 assert.equal(r.product.price_vnd,159000);assert.equal(r.product.stock,25);
});
test('44 same SKU A002 returns Shop B price',()=>{
 const r=send(gate(),'Báo giá A002',{binding:bindings[1]});
 assert.equal(r.product.price_vnd,209000);assert.equal(r.product.stock,8);
});
test('45 Shop C cannot see Shop A A002 price',()=>{
 const r=send(gate(),'Báo giá A002',{binding:bindings[2]});
 assert.equal(r.route,'BLOCKED');assert.equal(r.reason,'PRODUCT_NOT_FOUND_IN_TRUSTED_STORE');
});
test('46 complex AI request returns PENDING, no actual LLM call',()=>{
 const r=send(gate(),'Tư vấn giúp tôi mẫu hợp với nhu cầu công sở');
 assert.equal(r.route,'AI_PENDING_NO_CALL');assert.equal(r.real_llm_calls,0);
});
test('47 order intent hard blocked not delegated to agent',()=>{
 const r=send(gate(),'Đặt 2 áo A002');
 assert.equal(r.route,'BLOCKED');assert.equal(r.reason,'TRANSACTION_REQUIRES_SEPARATE_AUTHORIZED_WRITE_GATE');
});
test('48 update order hard blocked',()=>{
 const r=send(gate(),'Sửa đơn');
 assert.equal(r.route,'BLOCKED');
});
test('49 cached binding improves fixture route (not proof of production SLA)',()=>{
 const g=gate();send(g,'Chào');send(g,'Chào');
 assert.ok(g.inspect().cacheHit>=1);
});
test('50 only read and no-send counters ever reported',()=>{
 const g=gate();send(g,'Báo giá A002');send(g,'Đặt 2 áo A002');
 const m=g.inspect();assert.equal(m.hostedWrites,0);assert.equal(m.providerSends,0);
 assert.equal(m.realLlmCalls,0);assert.equal(m.productionReady,false);
});
test('51 no live provider signature claim',()=>{
 const g=gate();assert.equal(g.inspect().actualMetaZaloSignaturesVerified,false);
});
test('52 no durable replay claim',()=>{
 const g=gate();assert.equal(g.inspect().durableReplay,false);
});
module.exports={bindings,products,config,envelope,signed};
