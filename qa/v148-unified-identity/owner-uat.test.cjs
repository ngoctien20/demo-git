'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const api=require('../v147-custom-studio/studio-core.js');
const u=require('./owner-uat.js');
const studio=api.createStudio();
const shops=['A','B','C'],scenarios=u.scenarios;
test('01 all 60 Shop × Channel × scenario UI preview combinations are correctly scoped',()=>{
 let count=0;
 for(const shop of shops)for(const channel of api.CHANNELS)for(const scenario of scenarios){
  const r=u.build({studio,api,shop,channel,scenario});
  assert.equal(r.tenant_id,api.FIXTURES[shop].tenantId);
  assert.equal(r.store_id,api.FIXTURES[shop].storeId);
  assert.equal(r.channel,channel);
  assert.equal(r.backend_identity_verified,false);
  assert.equal(r.provider_sends,0);assert.equal(r.order_writes,0);
  assert.equal(r.hosted_writes,0);assert.equal(r.can_publish,false);
  assert.equal(r.synthetic_only,true);
  count++;
 }
 assert.equal(count,60);
});
test('02 even same SKU A001 has three different synthetic Shop prices',()=>{
 const prices=shops.map(shop=>u.build({studio,api,shop,channel:'MESSENGER',scenario:'QUOTE'}).product.price_vnd);
 assert.deepEqual(prices,[159000,209000,259000]);
});
test('03 no auto cross-Store merge through merchant name',()=>{
 const a=u.build({studio,api,shop:'A',channel:'ZALO_BOT'});
 const b=u.build({studio,api,shop:'B',channel:'ZALO_BOT'});
 assert.notEqual(a.store_id,b.store_id);
 assert.notEqual(a.channel_binding_id,b.channel_binding_id);
});
test('04 channel bot profile IDs are independent',()=>{
 const ids=api.CHANNELS.map(channel=>u.build({studio,api,shop:'A',channel}).bot_profile_id);
 assert.equal(new Set(ids).size,4);
});
test('05 merchant Studio greeting customizations are inherited immediately',()=>{
 const privateStudio=api.createStudio();
 privateStudio.update('B','ZALO_OA',{greeting:'Xin chào bản QA tùy chỉnh'});
 const r=u.build({studio:privateStudio,api,shop:'B',channel:'ZALO_OA'});
 assert.equal(r.preview_text,'Xin chào bản QA tùy chỉnh');
 assert.equal(r.bot_profile_version,2);
});
test('06 merchant cannot rewrite Store via presentation',()=>{
 assert.throws(()=>studio.update('A','MESSENGER',{store_id:api.FIXTURES.B.storeId}),/GLOBAL_POLICY_OR_SCOPE_LOCKED/);
});
test('07 order intent is ONLY a preview, never a real Order confirmation',()=>{
 const r=u.build({studio,api,shop:'A',channel:'MESSENGER',scenario:'ORDER'});
 assert.equal(r.route_path,'TRANSACTION_BLOCKED');
 assert.equal(r.order_writes,0);
 assert.match(r.preview_text,/không tạo đơn/);
});
test('08 complex consultation never claims real AI call',()=>{
 const r=u.build({studio,api,shop:'A',channel:'WEB_WIDGET',scenario:'AI'});
 assert.equal(r.route_path,'AI_DISABLED');assert.equal(r.real_ai_called,false);
});
test('09 user supplied forged channel/store rejected',()=>{
 assert.throws(()=>u.build({studio,api,shop:'D',channel:'MESSENGER'}));
 assert.throws(()=>u.build({studio,api,shop:'A',channel:'FACEBOOK_UNKNOWN'}));
});
test('10 source UI must import existing V14.7 Studio, not copy its config',()=>{
 const file=fs.readFileSync(path.join(__dirname,'owner-uat.html'),'utf8');
 assert.ok(file.includes('../v147-custom-studio/studio-core.js'));
 assert.ok(file.includes('./owner-uat.js'));
 assert.ok(file.includes('60 trường hợp'));
 assert.ok(file.includes('không gửi Messenger'));
});
test('11 no network requests or credential handling in UI source',()=>{
 const html=fs.readFileSync(path.join(__dirname,'owner-uat.html'),'utf8');
 const js=fs.readFileSync(path.join(__dirname,'owner-uat.js'),'utf8');
 for(const s of [html,js])for(const bad of ['fetch(', 'axios(', 'graph.facebook.com',
  'app.n8n.cloud/webhook', 'service_role', 'secret_key', 'eval(', 'innerHTML']){
  assert.equal(s.includes(bad),false,bad);
 }
});
test('12 generated UAT output is JSON-serializable and redacted from secrets',()=>{
 const r=u.build({studio,api,shop:'C',channel:'ZALO_OA',scenario:'QUOTE'});
 const output=JSON.stringify(r);
 assert.ok(output.includes('EXPERIMENTAL'));
 assert.ok(!output.includes('token'));
 assert.ok(!output.includes('phone'));
});
