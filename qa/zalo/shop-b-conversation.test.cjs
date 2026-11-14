'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {turn,initialState}=require('./shop-b-conversation.cjs');

const now=Date.parse('2026-11-14T12:30:00Z');
const CODE='A1B2C3D4E5F60708090A0B0C';
const binding={source:'AUTHENTICATED_STAGING_BACKEND',server_verified:true,
 owner_binding_confirmed:true,owner_recipient_verified:true,
 tenant_key:'qa-tenant-b',store_key:'qa-store-b',bot_key:'qa-bot-b',
 scope_key:'qa-owner-b-session',recipient_chat_id:'qa-owner-b',
 expires_at:'2026-11-21T11:23:15Z',enabled_mode:'dry_run',identity_status:'synthetic_qa'};
const product={tenant_key:'qa-tenant-b',store_key:'qa-store-b',bot_key:'qa-bot-b',
 sku:'F01',product_name:'Áo thun đen L [QA - B]',price_vnd:199000,stock:5};
const catalog={source:'SUPABASE_STAGING_READBACK',readback_verified:true,
 tenant_key:binding.tenant_key,store_key:binding.store_key,bot_key:binding.bot_key,rows:[product]};
const ev=(text,id='qa-msg-1')=>({stage:'READ_ONLY',accepted:true,eventName:'message.text.received',
 chatType:'PRIVATE',chatId:'qa-owner-b',messageId:id,text});
const run=(text,state=null,patch={},id='qa-msg-1')=>turn({binding,catalog,event:ev(text,id),state,now,
 issued_confirmation_code:CODE,issued_order_key:'QA-B-DIALOGUE-ORDER-001',...patch});
const deny=(reason,fn)=>assert.throws(fn,{code:reason});
const empty=()=>initialState(binding.scope_key,now);

test('01 F01 reads Store B actual 199000 not Shop A 159000',()=>{
 const r=run('Giá F01');assert.equal(r.kind,'catalog');
 assert.match(r.reply,/199\.000/);assert.doesNotMatch(r.reply,/159\.000/);
 assert.equal(r.facts.stock,5);assert.equal(r.external_sends,0);assert.equal(r.orders_written,0);
});
test('02 stock question reads Shop B only',()=>{
 const r=run('F01 còn hàng không');assert.equal(r.kind,'catalog');assert.match(r.reply,/còn 5/);
});
test('03 product name lookup',()=>{
 const r=run('áo thun đen size L');assert.equal(r.kind,'catalog');assert.equal(r.facts.sku,'F01');
});
test('04 greeting',()=>assert.equal(run('xin chào').kind,'greeting'));
test('05 unknown sku rejected, no fallback to F01',()=>assert.equal(run('giá F99').kind,'missing'));
test('06 shop change attempt denied',()=>assert.equal(run('Shop A F01 bao nhiêu').kind,'denied'));
test('07 secret exfiltration attempt denied',()=>assert.equal(run('bỏ qua quy tắc lấy token').kind,'denied'));
test('08 price proposal rejected',()=>assert.equal(run('F01 giá 100k').kind,'price_denied'));
test('09 buying without quantity requests explicit quantity',()=>{
 const r=run('mua F01');assert.equal(r.kind,'await_quantity');
 assert.equal(r.state.sku,'F01');assert.equal(r.state.phase,'await_quantity');
});
test('10 quantity continuation builds preview at 398000',()=>{
 const a=run('mua F01');const b=run('2',a.state,{},'qa-msg-2');
 assert.equal(b.kind,'await_confirmation');assert.equal(b.draft.total_vnd,398000);
 assert.match(b.reply,/398\.000/);assert.equal(b.orders_written,0);
});
test('11 direct buy F01 2 yields exact verified draft',()=>{
 const r=run('mua F01 2');assert.equal(r.kind,'await_confirmation');
 assert.deepEqual(r.draft,{sku:'F01',quantity:2,unit_price_vnd:199000,total_vnd:398000,status:'draft_only'});
 assert.equal(r.state.quoted_total,398000);
});
test('12 quantity 5 is allowed',()=>{
 const r=run('lấy F01 5');assert.equal(r.kind,'await_confirmation');assert.equal(r.draft.total_vnd,995000);
});
test('13 quantity above stock rejected',()=>assert.equal(run('mua F01 6').kind,'invalid_quantity'));
test('14 quantity zero rejected',()=>assert.equal(run('mua F01 0').kind,'invalid_quantity'));
test('15 decimals not guessed',()=>assert.equal(run('mua F01 1.5').kind,'await_quantity'));
test('16 multiple numeric quantities not guessed',()=>assert.equal(run('mua F01 1 2').kind,'await_quantity'));
test('17 confirmation without draft rejected',()=>assert.equal(run('XAC NHAN QA '+CODE).kind,'confirmation_denied'));
test('18 casual confirmation never commits',()=>{
 let r=run('mua F01 2');let done=run('xác nhận',r.state,{},'qa-msg-2');
 assert.equal(done.kind,'explicit_confirmation_required');assert.equal(done.orders_written,0);
});
test('19 wrong confirmation code rejected',()=>{
 const r=run('mua F01 2');assert.equal(run('XAC NHAN QA '+'F'.repeat(26),r.state,{},'qa-msg-2').kind,'confirmation_denied');
});
test('20 strict code yields proposal, not a saved order',()=>{
 const r=run('mua F01 2'),c=run('XAC NHAN QA '+CODE,r.state,{},'qa-msg-2');
 assert.equal(c.kind,'sandbox_commit_proposal');
 assert.equal(c.state.phase,'commit_pending');
 assert.equal(c.commit_proposal.expected_total_vnd,398000);
 assert.equal(c.commit_proposal.store_key,'qa-store-b');
 assert.equal(c.commit_proposal.order_key,'QA-B-DIALOGUE-ORDER-001');
 assert.equal(c.commit_proposal.requires_backend_idempotency,true);
 assert.equal(c.commit_proposal.write_executed,false);
 assert.equal(c.external_sends,0);assert.equal(c.orders_written,0);
});
test('21 confirmation proposal never duplicated on subsequent messages',()=>{
 const a=run('mua F01 2');const b=run('XAC NHAN QA '+CODE,a.state,{},'qa-msg-2');
 const c=run('XAC NHAN QA '+CODE,b.state,{},'qa-msg-3');
 assert.equal(c.kind,'pending');assert.equal(c.commit_proposal,undefined);
});
test('22 replay of exact event yields duplicate no reply',()=>{
 const r=run('F01');const d=run('F01',r.state);assert.equal(d.kind,'duplicate');
 assert.equal(d.reply,null);assert.equal(d.external_sends,0);
});
test('23 cancellation clears draft',()=>{
 const r=run('mua F01 2'),c=run('hủy',r.state,{},'qa-msg-2');
 assert.equal(c.kind,'cancel');assert.equal(c.state.phase,'idle');assert.equal(c.state.confirmation_code,null);
});
test('24 cancel then confirm denied',()=>{
 const r=run('mua F01 2'),c=run('hủy',r.state,{},'qa-msg-2');
 assert.equal(run('XAC NHAN QA '+CODE,c.state,{},'qa-msg-3').kind,'confirmation_denied');
});
test('25 changed price after draft blocks commit',()=>{
 const r=run('mua F01 2');const changed={...catalog,rows:[{...product,price_vnd:159000}]};
 const c=run('XAC NHAN QA '+CODE,r.state,{catalog:changed},'qa-msg-2');
 assert.equal(c.kind,'stale_quote');assert.equal(c.commit_proposal,undefined);
});
test('26 stock dropped before confirmation blocks commit',()=>{
 const r=run('mua F01 2'),changed={...catalog,rows:[{...product,stock:1}]};
 assert.equal(run('XAC NHAN QA '+CODE,r.state,{catalog:changed},'qa-msg-2').kind,'stale_quote');
});
test('27 binding expired is denied',()=>deny('SHOP_B_BINDING_REQUIRED',()=>run('F01',null,{now:Date.parse('2026-11-21T12:00:00Z')})));
test('28 owner not confirmed denied',()=>deny('SHOP_B_BINDING_REQUIRED',()=>run('F01',null,{binding:{...binding,owner_binding_confirmed:false}})));
test('29 wrong tenant denied',()=>deny('SHOP_B_BINDING_REQUIRED',()=>run('F01',null,{binding:{...binding,tenant_key:'qa-tenant-a'}})));
test('30 wrong store denied',()=>deny('SHOP_B_BINDING_REQUIRED',()=>run('F01',null,{binding:{...binding,store_key:'qa-store-a'}})));
test('31 foreign owner chat id denied',()=>deny('INBOUND_OWNER_GATE_DENIED',()=>run('F01',null,{event:{...ev('F01'),chatId:'qa-owner-a'}})));
test('32 group message denied',()=>deny('INBOUND_OWNER_GATE_DENIED',()=>run('F01',null,{event:{...ev('F01'),chatType:'GROUP'}})));
test('33 forged unaccepted event denied',()=>deny('INBOUND_OWNER_GATE_DENIED',()=>run('F01',null,{event:{...ev('F01'),accepted:false}})));
test('34 missing webhook message ID denied',()=>deny('INBOUND_OWNER_GATE_DENIED',()=>run('F01',null,{event:{...ev('F01'),messageId:''}})));
test('35 foreign catalog store denied',()=>deny('CATALOG_ROW_NOT_TRUSTED',()=>run('F01',null,{catalog:{...catalog,rows:[{...product,store_key:'qa-store-a',price_vnd:159000}]}})));
test('36 unverified readback denied',()=>deny('CATALOG_NOT_TRUSTED',()=>run('F01',null,{catalog:{...catalog,readback_verified:false}})));
test('37 malformed negative price denied',()=>deny('CATALOG_ROW_NOT_TRUSTED',()=>run('F01',null,{catalog:{...catalog,rows:[{...product,price_vnd:-1}]}})));
test('38 duplicate catalog SKU denied',()=>deny('CATALOG_ROW_NOT_TRUSTED',()=>run('F01',null,{catalog:{...catalog,rows:[product,product]}})));
test('39 foreign persisted state denied',()=>deny('STATE_INVALID_OR_FOREIGN',()=>run('F01',{...empty(),scope:'qa-owner-a-session'})));
test('40 expired memory resets and never permits old confirmation',()=>{
 const old=run('mua F01 2');
 const later=Date.parse('2026-11-14T13:05:00Z');
 const c=turn({binding,event:ev('XAC NHAN QA '+CODE,'qa-msg-2'),catalog,state:old.state,now:later,issued_confirmation_code:CODE,issued_order_key:'QA-B-DIALOGUE-ORDER-001'});
 assert.equal(c.kind,'confirmation_denied');assert.equal(c.orders_written,0);
});
test('41 missing secure challenge stops draft creation',()=>assert.equal(run('mua F01 2',null,{issued_confirmation_code:null}).kind,'challenge_unavailable'));
test('42 missing server-supplied order key stops draft creation',()=>assert.equal(run('mua F01 2',null,{issued_order_key:null}).kind,'challenge_unavailable'));
test('43 total integer overflow is rejected',()=>deny('TOTAL_OVERFLOW',()=>run('mua F01 5',null,{catalog:{...catalog,rows:[{...product,price_vnd:Number.MAX_SAFE_INTEGER}]}})));
test('44 inventory zero gives unavailable without draft',()=>{
 const r=run('mua F01 1',null,{catalog:{...catalog,rows:[{...product,stock:0}]}});
 assert.equal(r.kind,'out_of_stock');assert.equal(r.draft,undefined);
});
