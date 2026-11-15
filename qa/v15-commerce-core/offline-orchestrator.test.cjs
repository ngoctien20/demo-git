'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createOfflineLabEngine}=require('./offline-orchestrator.cjs');
const {FIXTURES,CHANNELS}=require('../v147-custom-studio/studio-core.js');
const {SKILLS,MODES,runOfflineSkill}=require('./business-skills-registry.cjs');
const {routeNoSend,MODEL_IDS}=require('./smart-model-router.cjs');
const fixedNow=1794789000000;
const make=()=>createOfflineLabEngine({now:()=>fixedNow});
test('V14.8 identity fixture reused, not misrepresented as official',()=>{const e=make().inspect();assert.equal(e.mode,'OFFLINE_SIGNED_FIXTURE_ONLY');assert.equal(e.auth_real,false);assert.equal(e.owner_certified,false);assert.equal(e.channel_count,4)});
test('12 store/channel combos route through one shared offline Agent Core',async()=>{
 const e=make();
 for(const shop of ['A','B','C'])for(const channel of CHANNELS){
  const o=await e.run({shop,channel,message:'Xin chào'});
  assert.equal(o.status,'SYNTHETIC_QA_RESULT');
  assert.equal(o.channel,channel);assert.equal(o.shop,shop);
  assert.equal(o.plan.action,'DETERMINISTIC_GREETING');
  assert.equal(o.metrics.paid_model_calls,0);
  assert.equal(o.identity_real_provider_verified,false);
  assert.equal(o.can_send,false);
 }
});
test('all three Shop A/B/C reuse exact V14.7 product fixtures without cross-store pricing',async()=>{
 const e=make();
 for(const shop of ['A','B','C']){
  const o=await e.run({shop,channel:'MESSENGER',message:'Mã A001 giá bao nhiêu?'});
  assert.equal(o.skill.status,'SYNTHETIC_QA_RESULT');
  assert.equal(o.skill.record.price_vnd,FIXTURES[shop].product.priceVnd);
  assert.equal(o.skill.store_ref,FIXTURES[shop].storeId);
  assert.equal(o.skill.record.stock,FIXTURES[shop].product.stock);
  assert.equal(o.metrics.order_writes,0);
 }
});
test('nonexistent A002 SKU cannot be repriced as synthetic A001',async()=>{const x=await make().run({shop:'B',message:'Mã A002 giá bao nhiêu?'});assert.equal(x.skill.record,null);assert.match(x.reply,/Không tìm thấy/);});
test('wrong store SKU cannot reveal another store product data',async()=>{const x=await make().run({shop:'A',message:'Mã A003 giá bao nhiêu?'});assert.equal(x.skill.record,null);});
test('client store takeover rejected despite signed fixture correct',async()=>{const x=await make().run({shop:'A',message:'giá sản phẩm',clientClaims:{store_id:'qa_shop_b'}});assert.equal(x.status,'BLOCKED');assert.equal(x.plan.reason,'UNTRUSTED_CLIENT_IDENTITY_CONFLICT');});
test('client tenant override rejected',async()=>{const x=await make().run({shop:'B',message:'Xin chào',clientClaims:{tenant_id:'qa_tenant_2'}});assert.equal(x.status,'BLOCKED');});
test('client channel override rejected',async()=>{const x=await make().run({channel:'MESSENGER',message:'Xin chào',clientClaims:{channel:'zalo_bot'}});assert.equal(x.status,'BLOCKED');});
test('client conversation override rejected',async()=>{const x=await make().run({message:'Xin chào',clientClaims:{conversation_id:'spoofed_conversation'}});assert.equal(x.status,'BLOCKED');});
test('client claims cannot escalate owner revenue capability',async()=>{
 const x=await make().run({shop:'A',message:'báo cáo doanh thu hôm nay',role:'customer',clientClaims:{actor_type:'owner',allowed_capabilities:['owner_report_read']}});assert.equal(x.status,'BLOCKED');
});
test('client trying to turn send on has zero send effects',async()=>{
 const x=await make().run({shop:'A',message:'Xin chào',clientClaims:{send_enabled:true}});assert.equal(x.can_send,false);assert.equal(x.metrics.provider_sends,0);
});
test('synthetic owner report never invents revenues',async()=>{
 const x=await make().run({shop:'B',role:'owner',message:'báo cáo doanh thu hôm nay'});assert.match(x.reply,/Không có báo cáo doanh thu thật/);assert.equal(x.owner_authenticated,false);
});
test('draft order never calls order tools',async()=>{
 const x=await make().run({shop:'B',message:'Đặt 2 áo kiểu nữ'});assert.equal(x.skill.mode,'DRAFT');assert.equal(x.metrics.order_writes,0);assert.match(x.reply,/Chưa thu thập/);
});
test('order change blocks authorization',async()=>{const x=await make().run({message:'hủy đơn số 123'});assert.equal(x.status,'BLOCKED');assert.equal(x.metrics.order_writes,0);});
test('support request is draft only',async()=>{const x=await make().run({message:'khiếu nại bảo hành'});assert.equal(x.skill.mode,'DRAFT');assert.equal(x.skill.provider_sends,0);});
test('unrecognized task never auto calls model',async()=>{const x=await make().run({message:'hãy làm marketing nâng cao'});assert.equal(x.metrics.paid_model_calls,0);assert.match(x.reply,/không gọi API thật/);});
test('model choice is recommendation only, no actual dispatch',async()=>{const x=await make().run({message:'mã A001 giá?',modelId:'gemini-2.5-flash-lite'});assert.equal(x.route.recommended_model,'gemini-2.5-flash-lite');assert.equal(x.route.provider_call_allowed,false);assert.equal(x.route.selected_model,null);});
test('unsupported model cannot be dispatched',()=>{const r=routeNoSend({intent:'CATALOG',requestedModel:'gpt-free-unverified'});assert.equal(r.status,'BLOCKED');assert.equal(r.provider_call_allowed,false);});
test('even client owner approved budget flag cannot enable paid calls',()=>{const r=routeNoSend({intent:'PRICE_QUOTE',requestedModel:'gpt-6-luna',ownerApprovedBudgetUsd:100,providerEntitlementVerified:true,hostedReservationVerified:true});assert.equal(r.provider_call_allowed,false);assert.equal(r.usd_spent,0);});
test('no retries after business side effects',()=>{const r=routeNoSend({intent:'ORDER_DRAFT',sideEffectsOccurred:true});assert.equal(r.status,'BLOCKED');assert.equal(r.reason,'NO_FALLBACK_AFTER_SIDE_EFFECTS');});
test('no model cost for deterministic greeting',()=>{const r=routeNoSend({intent:'GREETING'});assert.equal(r.status,'DETERMINISTIC_NO_MODEL');assert.equal(r.usd_model_estimate,0);});
test('router includes exactly five shortlisted model IDs',()=>assert.equal(MODEL_IDS.length,5));
test('skill registry defines four execution modes',()=>assert.deepEqual(MODES,['READ_ONLY','DRAFT','CONFIRM_REQUIRED','AUTHORIZED_EXECUTION']));
test('write skills cannot be executed from offline QA model request',()=>{
 const x=runOfflineSkill({plan:{status:'CANDIDATE_OFFLINE_NO_SEND',can_send:false,real_llm_calls:0,tools_executed:0,session_ref:'forged',tool:{capability:'inventory_write',read_only:false},allowed_capabilities:['inventory_write']},server:{source:'TRUSTED_SERVER_IDENTITY',environment:'SYNTHETIC_OFFLINE_FIXTURE',authorizedForStaging:true,sendEnabled:false,storeId:'qa_shop_a',tenantId:'qa_tenant_1',capabilities:['inventory_write'],actorRole:'owner',channel:'messenger',conversationId:'xx'},fixtureStore:'A'});
 assert.equal(x.status,'DENIED');
});
test('no one can run read-only skill without plan from shared Core',()=>assert.equal(runOfflineSkill({}).status,'DENIED'));
test('no Shop A product while trusted server is Shop B',async()=>{
 const plan=(await make().run({shop:'B',message:'giá A001'})).plan;
 const x=runOfflineSkill({plan,fixtureStore:'A',server:{source:'TRUSTED_SERVER_IDENTITY',environment:'SYNTHETIC_OFFLINE_FIXTURE',authorizedForStaging:true,tenantId:'qa_tenant_1',storeId:'qa_shop_b',channel:'messenger',conversationId:'xxx',actorRole:'customer',sendEnabled:false,capabilities:['price_quote']}});
 assert.equal(x.status,'DENIED');assert.equal(x.reason,'CROSS_STORE_OR_SESSION_MISMATCH');
});
test('separate conversations are not merged across channels',async()=>{
 const e=make(),a=await e.run({shop:'A',channel:'MESSENGER',message:'Xin chào'}),b=await e.run({shop:'A',channel:'ZALO_BOT',message:'Xin chào'});
 assert.notEqual(a.plan.session_ref,b.plan.session_ref);
});
test('customer input with HTML payload never reflected unescaped in reply',async()=>{
 const x=await make().run({message:'<script>alert(1)</script>'});assert.ok(!x.reply.includes('<script>'));
});
test('all available skills have only documented modes',()=>{for(const [name,v] of Object.entries(SKILLS)){assert.ok(MODES.includes(v.mode),name)}});
