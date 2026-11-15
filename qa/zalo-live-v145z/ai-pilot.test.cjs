'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {preview,verifyCatalog}=require('./ai-pilot.cjs');
const NOW=1794700000000;
const B={source:'TRUSTED_TENANT_RESOLVER',verified:true,channel:'ZALO_BOT',
 tenant_id:'tenant-qa-a',store_id:'shop-qa-a',bot_id:'bot-qa-a',customer_chat_id:'chat-qa-a',
 expires_at_ms:NOW+3600000};
const P=[{sku:'A002',name:'Áo QA trắng',price_vnd:159000,stock_on_hand:3,is_active:true},
 {sku:'A003',name:'Áo QA đen',price_vnd:199000,stock_on_hand:2,is_active:true}];
const C={source:'TRUSTED_QA_CATALOG_READBACK',environment:'OFFLINE_QA',
 tenant_id:B.tenant_id,store_id:B.store_id,bot_id:B.bot_id,fetched_at_ms:NOW-1000,products:P};
const E=(text='Mã A002 giá bao nhiêu?',id=1,rev=0)=>({
 event_id:'evt-'+id,text,chat_id:B.customer_chat_id,expected_revision:rev,received_at_ms:NOW});
const run=(o={})=>preview({binding:B,catalog:C,event:E(),now:NOW,...o});
test('QA price from verified Store A catalog',async()=>{
 const x=await run();assert.match(x.proposal.text,/159\.000đ/);assert.equal(x.proposal.provider_sends,0);
 assert.equal(x.model_calls,0);assert.equal(x.proposal.live_verified,false);
});
test('fake model marked synthetic, not real AI',async()=>{
 const x=await run({modelPort:async arg=>{
  assert.equal(arg.catalog_scope,'tenant-qa-a/shop-qa-a');
  assert.equal(arg.question,'Mã A002 giá bao nhiêu?');
  return {origin:'OFFLINE_FAKE_MODEL',text:'Mình giúp bạn nhé.'};
 }});
 assert.equal(x.model_calls,1);assert.equal(x.model_origin,'OFFLINE_FAKE_MODEL');
 assert.match(x.proposal.text,/159\.000đ/);assert.equal(x.proposal.dispatch_authorized,false);
});
test('follow-up reads focused SKU within session only',async()=>{
 const a=await run();
 const b=await run({event:E('Còn bao nhiêu chiếc?',2,1),session:a.state,memory:a.memory});
 assert.match(b.proposal.text,/3 sản phẩm/);
});
test('two stores same tenant same SKU separate prices',async()=>{
 const b={...B,store_id:'shop-qa-b',bot_id:'bot-qa-b',customer_chat_id:'chat-qa-b'};
 const c={...C,store_id:b.store_id,bot_id:b.bot_id,
  products:[{...P[0],price_vnd:299000,stock_on_hand:7}]};
 const x=await preview({binding:b,catalog:c,event:{...E(),chat_id:b.customer_chat_id},now:NOW});
 assert.match(x.proposal.text,/299\.000đ/);assert.doesNotMatch(x.proposal.text,/159\.000đ/);
});
test('unknown SKU not invented',async()=>{
 const x=await run({event:E('Mã Z999 giá bao nhiêu?',4)});
 assert.match(x.proposal.text,/chưa tìm thấy/);assert.doesNotMatch(x.proposal.text,/159\.000đ/);
});
test('quantity multiplication',async()=>{
 const x=await run({event:E('Mã A002 lấy 2 cái',5)});assert.match(x.proposal.text,/318\.000đ/);
});
test('order intent never writes',async()=>{
 const x=await run({event:E('Tôi muốn đặt hàng',6)});
 assert.equal(x.proposal.orders_written,0);assert.match(x.proposal.text,/chưa tạo đơn/);
});
test('event replay suppresses model',async()=>{
 const a=await run();const x=await run({session:a.state,memory:a.memory,
 modelPort:async()=>{throw Error('MODEL_SHOULD_NOT_RUN')}});
 assert.equal(x.proposal.kind,'DUPLICATE_IGNORED');assert.equal(x.model_calls,0);
});
const invalidCatalogs=[
 ['stale',{fetched_at_ms:NOW-61000}],
 ['future',{fetched_at_ms:NOW+1}],
 ['foreign store',{store_id:'shop-foreign'}],
 ['foreign tenant',{tenant_id:'tenant-foreign'}],
 ['missing origin',{source:'CLIENT_PROVIDED'}]
];
for(const [name,changed] of invalidCatalogs)
 test('deny catalog '+name,async()=>assert.rejects(run({catalog:{...C,...changed}}),/CATALOG_NOT_TRUSTED_OR_STALE/));
test('negative price blocks',()=>assert.throws(()=>verifyCatalog({...C,products:[{...P[0],price_vnd:-1}]},B,NOW),/CATALOG_ROW_INVALID/));
test('duplicate SKU blocks',()=>assert.throws(()=>verifyCatalog({...C,products:[P[0],P[0]]},B,NOW),/CATALOG_ROW_INVALID/));
test('forged binding blocks',async()=>assert.rejects(run({binding:{...B,verified:false}}),/TRUSTED_BINDING_REQUIRED/));
test('expired binding blocks',async()=>assert.rejects(run({binding:{...B,expires_at_ms:NOW}}),/TRUSTED_BINDING_REQUIRED/));
test('forged store field on provider event blocks',async()=>assert.rejects(
 run({event:{...E(),store_id:'shop-qa-b'}}),/PROVIDER_EVENT_INVALID_OR_UNTRUSTED_SCOPE/));
test('wrong chat ID blocks',async()=>assert.rejects(
 run({event:{...E(),chat_id:'intruder-chat'}}),/CUSTOMER_EVENT_INVALID/));
test('model cannot propose false price',async()=>assert.rejects(
 run({modelPort:async()=>({origin:'OFFLINE_FAKE_MODEL',text:'Giá 1 đồng'})}),/MODEL_PHRASE_REJECTED/));
test('model cannot claim to be a live model',async()=>assert.rejects(
 run({modelPort:async()=>({origin:'REAL_MODEL',text:'Mình giúp bạn nhé.'})}),/MODEL_PHRASE_REJECTED/));
test('deny live mode in source',async()=>assert.rejects(run({mode:'LIVE_PILOT'}),/LIVE_MODE_UNAUTHORIZED/));
test('foreign memory scope blocks',async()=>{
 const a=await run();await assert.rejects(run({event:E('Còn hàng?',7,1),
 session:a.state,memory:{...a.memory,scope:'another-shop'}}),/MEMORY_SCOPE_OR_REVISION_INVALID/);
});
test('shop paused suppresses model',async()=>{
 const a=await run();const x=await run({event:E('Mã A003 giá?',8,1),session:{...a.state,shop_paused:true},
 memory:a.memory,modelPort:async()=>{throw Error('MODEL_SHOULD_NOT_RUN')}});
 assert.equal(x.model_calls,0);assert.equal(x.proposal.provider_sends,0);
});
test('handoff suppresses model',async()=>{
 const x=await run({event:E('Tôi cần nhân viên',9),modelPort:async()=>{throw Error('MODEL_SHOULD_NOT_RUN')}});
 assert.equal(x.model_calls,0);assert.equal(x.state.status,'WAITING_STAFF');
});
test('revision conflict rejected',async()=>{
 const a=await run();await assert.rejects(run({event:E('Còn hàng?',10,0),
 session:a.state}),/REVISION_CONFLICT/);
});
test('explicit qty 0 rejected',async()=>assert.rejects(
 run({event:E('Mã A002 lấy 0 cái',11)}),/QUANTITY_UNSUPPORTED/));
test('model never receives chat ID or credential',async()=>{
 await run({modelPort:async args=>{
  assert.equal('chat_id' in args,false);assert.equal('token' in args,false);
  return {origin:'OFFLINE_FAKE_MODEL',text:'Mình hỗ trợ bạn nhé.'};
 }});
});
