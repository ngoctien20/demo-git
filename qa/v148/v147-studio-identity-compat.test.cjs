'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createHmac}=require('node:crypto');
const studio=require('../v147-custom-studio/studio-core.js');
const {buildResolver}=require('./unified-identity-resolver.cjs');
const SECRET=Buffer.from('V148_V147_COMPAT_QA_SIGNING_SECRET_NOT_REAL_CREDENTIAL');
const NOW=Date.parse('2026-11-16T09:00:00Z');
const CHANNELS={MESSENGER:['messenger','meta'],ZALO_BOT:['zalo_bot','zalo'],
 ZALO_OA:['zalo_oa','zalo'],WEB_WIDGET:['website_widget','firstparty']};
// Synthetic mapping ONLY: never interpret qa_shop_a as a hosted canonical Store UUID.
const mapping={A:{tenant:'TENANT_QA_1',store:'STORE_QA_A'},
 B:{tenant:'TENANT_QA_1',store:'STORE_QA_B'},
 C:{tenant:'TENANT_QA_2',store:'STORE_QA_C'}};
function fixture(st=studio.createStudio()){
 const bindings=[],products=[];
 for(const shop of ['A','B','C']){
  const f=studio.FIXTURES[shop],ids=mapping[shop];
  products.push({store_id:ids.store,sku:f.product.sku,name:f.product.name,
   price_vnd:f.product.priceVnd,stock:f.product.stock,active:true});
  for(const [channel,[normalized,provider]] of Object.entries(CHANNELS)){
   const cfg=st.get(shop,channel);
   assert.equal(cfg.tenant_id,f.tenantId);
   assert.equal(cfg.store_id,f.storeId);
   assert.equal(cfg.approval_status,'EXPERIMENTAL');
   bindings.push({
    id:'BINDING_QA_'+shop+'_'+channel,tenant_id:ids.tenant,store_id:ids.store,
    bot_profile_id:'BOT_QA_'+shop+'_'+channel,
    channel:normalized,provider,environment:'qa',
    provider_account_ref:'ACCOUNT_QA_'+shop+'_'+channel,
    provider_bot_ref:'PROVIDER_BOT_QA_'+shop+'_'+channel,
    status:'active',binding_version:1,
    config_version:cfg.bot_profile_version,
    subscription_active:true,store_active:true,can_process:true,
    can_send:false,greeting:cfg.greeting,hours:'08:00–21:00'
   });
  }
 }
 const resolver=buildResolver({mode:'OFFLINE_SYNTHETIC_NO_SEND',
  adapterSecret:SECRET,bindings,products,now:()=>NOW});
 return {resolver,bindings,products};
}
let serial=0;
function signed(b,text){
 const data={event_id:'COMPAT_'+(++serial),trace_id:'QA_COMPAT_TRACE',
  channel:b.channel,provider:b.provider,environment:'qa',
  provider_account_ref:b.provider_account_ref,provider_bot_ref:b.provider_bot_ref,
  provider_user_ref:'SYNTHETIC_VISITOR',provider_conversation_ref:'QA_STUDIO_C',
  event_type:'message',occurred_at:NOW,text};
 const rawBody=Buffer.from(JSON.stringify(data));
 return {rawBody,signature:'sha256='+createHmac('sha256',SECRET).update(rawBody).digest('hex')};
}
test('01 V14.7 Studio remains 3 shops × 4 original channels',()=>{
 assert.equal(Object.keys(studio.FIXTURES).length,3);
 assert.deepEqual([...studio.CHANNELS].sort(),Object.keys(CHANNELS).sort());
});
test('02 explicit identity mapping has same-tenant A/B and separate C',()=>{
 assert.equal(mapping.A.tenant,mapping.B.tenant);
 assert.notEqual(mapping.B.tenant,mapping.C.tenant);
});
test('03 all 12 channel bindings get their own scoped bot profile ID',()=>{
 const f=fixture();assert.equal(f.bindings.length,12);
 assert.equal(new Set(f.bindings.map(x=>x.bot_profile_id)).size,12);
 assert.equal(f.resolver.inspect().knownBindings,12);
});
test('04 all V14.7 bot greetings preserved in identity fast path',()=>{
 const f=fixture();
 for(const b of f.bindings){
  const shop=b.id.split('_')[2],srcChannel=Object.keys(CHANNELS).find(ch=>CHANNELS[ch][0]===b.channel);
  const cfg=studio.createStudio().get(shop,srcChannel);
  const r=f.resolver.route(signed(b,'Xin chào'));
  assert.equal(r.route,'FAST');
  assert.ok(r.reply_preview.includes(cfg.greeting));
  assert.equal(r.store_id,mapping[shop].store);
  assert.equal(r.provider_sends,0);
 }
});
test('05 all Shop A/B/C prices from V14.7 remain distinct by Store',()=>{
 const f=fixture();
 for(const b of f.bindings){
  const shop=b.id.split('_')[2],expected=studio.FIXTURES[shop].product;
  const r=f.resolver.route(signed(b,'Báo giá '+expected.sku));
  assert.equal(r.product.price_vnd,expected.priceVnd);
  assert.equal(r.product.stock,expected.stock);
  assert.equal(r.product.name,expected.name);
 }
});
test('06 updating V14.7 merchant greeting does not change ownership',()=>{
 const s=studio.createStudio();
 s.update('A','MESSENGER',{greeting:'Lời chào mới ở QA Shop A'},'MERCHANT_QA');
 const f=fixture(s);
 const b=f.bindings.find(x=>x.id==='BINDING_QA_A_MESSENGER');
 const r=f.resolver.route(signed(b,'Chào'));
 assert.equal(r.tenant_id,mapping.A.tenant);
 assert.equal(r.store_id,mapping.A.store);
 assert.match(r.reply_preview,/Lời chào mới/);
 assert.equal(r.can_send,false);
});
test('07 V14.7 merchant cannot change tenant/store binding or approval',()=>{
 const s=studio.createStudio();
 assert.throws(()=>s.update('A','MESSENGER',{store_id:'STORE_QA_C'},'MERCHANT_QA'),/GLOBAL_POLICY_OR_SCOPE_LOCKED/);
 assert.throws(()=>s.update('A','MESSENGER',{approval_status:'APPROVED'},'MERCHANT_QA'),/GLOBAL_POLICY_OR_SCOPE_LOCKED/);
});
test('08 V14.7 synthetic channel capabilities not confused with verified provider send rights',()=>{
 const f=fixture();for(const b of f.bindings)assert.equal(b.can_send,false);
 assert.equal(f.resolver.inspect().productionReady,false);
});
test('09 V14.7 all four flows remain preview-only and produce no order',()=>{
 const st=studio.createStudio();
 for(const shop of ['A','B','C'])for(const channel of studio.CHANNELS){
  for(const flow of ['CONSULT','QUOTE','ORDER','SUPPORT']){
   const r=st.preview(shop,channel,flow);
   assert.equal(r.hostedWrites,0);assert.equal(r.providerSends,0);
   assert.equal(r.orderCreated,false);
  }
 }
});
test('10 explicit synthetic identity map cannot be used as live hosted Store UUID',()=>{
 for(const ids of Object.values(mapping)){
 assert.match(ids.store,/^STORE_QA_/);
 assert.equal(/^[0-9a-f]{8}-/.test(ids.store),false);
 }
});
