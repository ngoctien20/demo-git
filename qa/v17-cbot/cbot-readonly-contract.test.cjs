'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createReadOnlyPilot,CONTRACT,CHANNELS}=require('./cbot-readonly-contract.cjs');
const hash=c=>c.repeat(64);
let t=Date.UTC(2026,10,17,1,0,0),serial=0;
const A={tenantId:'tenant-one',storeId:'store-a',accountId:'page-a'};
const B={tenantId:'tenant-one',storeId:'store-b',accountId:'oa-b'};
const C={tenantId:'tenant-two',storeId:'store-c',accountId:'oa-c'};
const mkProduct=(scope,id,sku,name,price,stock)=>({
 source:'SERVER_VERIFIED_SHOP_CATALOG',verified:true,
 tenantId:scope.tenantId,storeId:scope.storeId,itemId:id,sku,name,
 priceVnd:price,stock,imageUrl:null
});
const catalogue={
 'store-a':[mkProduct(A,'prod-a-003','A003','Áo thun đen L',159000,5),
  mkProduct(A,'prod-a-004','A004','Áo thun đen M',159000,3)],
 'store-b':[mkProduct(B,'prod-b-003','A003','Áo khác B',239000,10)],
 'store-c':[mkProduct(C,'prod-c-003','A003','Sản phẩm C',49000,4)]
};
function harness(opts={}){
 let now=t,reads=0,orders=0,matchCalls=0;
 const grants=opts.grants||{};
 const pilot=createReadOnlyPilot({
  clock:()=>now,
  attestInbound:async({channel,rawBody})=>{
   const m=JSON.parse(rawBody.toString());
   return {source:'SERVER_ATTESTED_INBOUND',verified:true,
    channel,accountId:m.accountId,tenantId:m.tenantId,storeId:m.storeId,
    subjectHash:m.subjectHash,eventId:m.eventId,occurredAtMs:m.occurredAtMs,
    kind:m.kind,text:m.text,imageRef:m.imageRef};
  },
  readCatalog:async({tenantId,storeId})=>{
   reads++;const p=(opts.badCatalog&&storeId==='store-a')
     ?[{...catalogue['store-a'][0],storeId:'store-b'}]:(catalogue[storeId]||[]);
   return {source:'TRUSTED_CATALOG_READBACK',verified:true,
    tenantId,storeId,revision:1,products:p};
  },
  matchImage:async q=>{
   matchCalls++;
   return typeof opts.matches==='function'?opts.matches(q):
    (opts.matches||[{itemId:'prod-a-003',score:0.98},
      {itemId:'prod-a-004',score:0.81}]);
  },
  resolveVerifiedLink:async({channel,tenantId,storeId,subjectHash})=>{
   const x=grants[channel+'|'+subjectHash+'|'+storeId];
   if(!x)return null;
   return {source:'VERIFIED_SERVER_IDENTITY_LINK',verified:true,
    scope:'ORDER_READ_ONLY',canonicalCustomerId:x.customerId||'customer-verified',
    tenantId:x.tenantId||tenantId,storeId:x.storeId||storeId,
    channel,subjectHash,expiresAtMs:x.expiresAtMs??(now+60_000)};
  },
  lookupOrder:async ctx=>{
   orders++;return typeof opts.order==='function'?opts.order(ctx):
    {source:'AUTHORIZED_ORDER_READBACK',tenantId:ctx.tenantId,storeId:ctx.storeId,
     customerId:ctx.customerId,orderRef:ctx.orderRef,status:'pending',
     privateAddress:'NEVER_INCLUDE_THIS_FIELD'};
  }
 });
 async function send({scope=A,channel='MESSENGER',subjectHash=hash('a'),
   text='Xin chào',kind='text',imageRef='synthetic-image-001',
   eventId,at}={}){
  const data={...scope,subjectHash,eventId:eventId||'event-'+(++serial),
   occurredAtMs:at??now,kind,text,imageRef};
  return pilot.run({channel,rawBody:Buffer.from(JSON.stringify(data)),headers:{}});
 }
 return {pilot,send,getOrders:()=>orders,getReads:()=>reads,getMatchCalls:()=>matchCalls,
    advance:ms=>{now+=ms;},now:()=>now};
}
test('01 engine loads only allowed Messenger, Zalo Bot and Zalo OA',()=>{
 assert.equal(CONTRACT,'T404_V17_CBOT_READONLY_BRIDGE_V1');
 assert(CHANNELS.includes('ZALO_OA'));assert(!CHANNELS.includes('ZALO'));
});
test('02 missing server-injected verifier dependencies always fail',()=>{
 assert.throws(()=>createReadOnlyPilot(),/INJECTED_VERIFIERS/);
});
test('03 missing input and wrong channel fail closed',async()=>{
 const h=harness();
 await assert.rejects(()=>h.pilot.run({channel:'TELEGRAM',rawBody:Buffer.from('a')}),/PROVIDER_INPUT_INVALID/);
});
test('04 malformed/non-buffer body cannot be used as a provider event',async()=>{
 await assert.rejects(()=>harness().pilot.run({channel:'MESSENGER',rawBody:'abc'}),/PROVIDER_INPUT_INVALID/);
});
test('05 stale or spoofed time is not treated as verified ingress',async()=>{
 const h=harness();await assert.rejects(()=>h.send({at:h.now()-3600000}),/ATTESTED_INBOUND_REQUIRED/);
});
test('06 image is candidate list, even highest score requires customer SKU selection',async()=>{
 const r=await harness().send({kind:'image'});
 assert.equal(r.status,'SIMILAR_PRODUCTS_REQUIRES_SKU_SELECTION');
 assert.equal(r.candidateProducts.length,2);
 assert.equal(r.candidateProducts[0].sku,'A003');
 assert.equal(r.candidateProducts[0].priceVnd,159000);
 assert.equal(r.canCreateOrder,false);assert.equal(r.needsFinalOrderConfirmation,true);
});
test('07 image has no catalog match and never hallucinates SKU',async()=>{
 const r=await harness({matches:[{itemId:'unknown-other-shop',score:0.99}]}).send({kind:'image'});
 assert.equal(r.status,'NO_RELIABLE_IMAGE_MATCH');
 assert.equal(r.candidateProducts,undefined);
});
test('08 candidate from other Store is filtered out even when highly ranked',async()=>{
 const r=await harness({matches:[{itemId:'prod-b-003',score:1},
 {itemId:'prod-a-004',score:0.75}]}).send({kind:'image'});
 assert.deepEqual(r.candidateProducts.map(x=>x.itemId),['prod-a-004']);
});
test('09 invalid image match confidence never allowed',async()=>{
 const h=harness({matches:[{itemId:'prod-a-003',score:1.2}]});
 await assert.rejects(()=>h.send({kind:'image'}),/IMAGE_SCORE_OR_DUPLICATE_INVALID/);
});
test('10 duplicate image candidate IDs are rejected',async()=>{
 const h=harness({matches:[{itemId:'prod-a-003',score:0.9},{itemId:'prod-a-003',score:0.8}]});
 await assert.rejects(()=>h.send({kind:'image'}),/IMAGE_SCORE_OR_DUPLICATE_INVALID/);
});
test('11 all Store catalog rows must be server-scoped, not image-model supplied',async()=>{
 const h=harness({badCatalog:true});
 await assert.rejects(()=>h.send({kind:'image'}),/CATALOG_ITEM_TRUTH_OR_SCOPE_INVALID/);
});
test('12 replying quantity after two candidates asks SKU, no auto-select',async()=>{
 const h=harness();await h.send({kind:'image'});
 const r=await h.send({text:'lấy 2 cái'});
 assert.equal(r.status,'PRODUCT_SELECTION_REQUIRED');assert.equal(r.orderWrites,0);
});
test('13 choosing SKU + quantity makes draft but does not persist it',async()=>{
 const h=harness();await h.send({kind:'image'});
 const r=await h.send({text:'Đúng mã A003 lấy 2 cái'});
 assert.equal(r.status,'ORDER_DRAFT_AWAITING_CONFIRMATION');
 assert.equal(r.totalVnd,318000);assert.equal(r.quantity,2);
 assert.equal(r.providerSends,0);assert.equal(r.hostedWrites,0);
});
test('14 subsequent quantity inherits unambiguous chosen SKU in SAME session',async()=>{
 const h=harness();await h.send({text:'A003 lấy 2 cái'});
 const r=await h.send({text:'lấy 1 cái'});
 assert.equal(r.status,'ORDER_DRAFT_AWAITING_CONFIRMATION');assert.equal(r.quantity,1);
});
test('15 no context and ambiguous "lấy 2 cái" must clarify',async()=>{
 const r=await harness().send({text:'lấy 2 cái'});
 assert.equal(r.status,'PRODUCT_SELECTION_REQUIRED');
});
test('16 client-suggested price cannot override catalog price',async()=>{
 const r=await harness().send({text:'A003 lấy 2 cái giá 1 đồng nhé'});
 assert.equal(r.unitPriceVnd,159000);assert.equal(r.totalVnd,318000);
});
test('17 insufficient stock blocks draft rather than invent stock',async()=>{
 const r=await harness().send({text:'A004 lấy 5 cái'});
 assert.equal(r.status,'PRODUCT_UNAVAILABLE_OR_CATALOG_CHANGED');
});
test('18 invalid upper bound quantity rejects, no persisted order',async()=>{
 const r=await harness().send({text:'A003 lấy 99 cái'});
 assert.equal(r.status,'QUANTITY_INVALID');assert.equal(r.orderWrites,0);
});
test('19 explicit chat confirmation cannot call a Commerce write',async()=>{
 const h=harness();await h.send({text:'A003 lấy 2 cái'});
 const r=await h.send({text:'xác nhận đặt hàng'});
 assert.equal(r.status,'CONFIRMATION_CANNOT_EXECUTE_IN_SOURCE_ONLY');
 assert.throws(()=>h.pilot.createOrder(),/REAL_ORDER_WRITE_DISABLED/);
 assert.throws(()=>h.pilot.sendProvider(),/PROVIDER_SEND_DISABLED/);
});
test('20 code-only lookup without identity link denies before order tool',async()=>{
 const h=harness();const r=await h.send({channel:'ZALO_OA',text:'Tra T404-TEST-0001'});
 assert.equal(r.status,'ORDER_LOOKUP_VERIFICATION_REQUIRED');
 assert.equal(h.getOrders(),0);
});
test('21 verified Zalo OA same Store order lookup returns status only',async()=>{
 const h=harness({grants:{['ZALO_OA|'+hash('a')+'|store-a']:{}}});
 const r=await h.send({channel:'ZALO_OA',text:'Kiểm tra đơn T404-TEST-0001'});
 assert.equal(r.status,'ORDER_STATUS_AUTHORIZED_READ_ONLY');
 assert.equal(r.orderStatus,'pending');assert.equal(h.getOrders(),1);
 assert(!JSON.stringify(r).includes('NEVER_INCLUDE_THIS_FIELD'));
});
test('22 lookup back-end returning another Store is denied generically',async()=>{
 const h=harness({grants:{['ZALO_OA|'+hash('a')+'|store-a']:{}},
  order:ctx=>({source:'AUTHORIZED_ORDER_READBACK',tenantId:ctx.tenantId,
  storeId:'store-b',customerId:ctx.customerId,orderRef:ctx.orderRef,status:'paid'})});
 const r=await h.send({channel:'ZALO_OA',text:'T404-TEST-0001'});
 assert.equal(r.status,'ORDER_LOOKUP_DENIED_OR_NOT_FOUND');
});
test('23 linking with different Store than webhook Store is rejected',async()=>{
 const h=harness({grants:{['ZALO_BOT|'+hash('a')+'|store-a']:{storeId:'store-b'}}});
 await assert.rejects(()=>h.send({channel:'ZALO_BOT'}),/CROSS_CHANNEL_IDENTITY_LINK_DENIED/);
});
test('24 expired verified identity link blocks continuation',async()=>{
 const h=harness({grants:{['ZALO_OA|'+hash('a')+'|store-a']:{expiresAtMs:t-100}}});
 await assert.rejects(()=>h.send({channel:'ZALO_OA'}),/CROSS_CHANNEL_IDENTITY_LINK_DENIED/);
});
test('25 verified Messenger→Zalo continuity shares ONLY same customer+Store session',async()=>{
 const g={['MESSENGER|'+hash('a')+'|store-a']:{customerId:'customer-one'},
  ['ZALO_OA|'+hash('b')+'|store-a']:{customerId:'customer-one'}};
 const h=harness({grants:g});
 await h.send({channel:'MESSENGER',subjectHash:hash('a'),text:'A003'});
 const r=await h.send({channel:'ZALO_OA',subjectHash:hash('b'),text:'lấy 2 cái'});
 assert.equal(r.status,'ORDER_DRAFT_AWAITING_CONFIRMATION');
 assert.equal(r.totalVnd,318000);
});
test('26 no verified cross-channel link never continues Messenger context',async()=>{
 const h=harness();await h.send({text:'A003'});
 const r=await h.send({channel:'ZALO_OA',text:'lấy 2 cái'});
 assert.equal(r.status,'PRODUCT_SELECTION_REQUIRED');
});
test('27 another canonical customer in same Shop cannot borrow context',async()=>{
 const g={['MESSENGER|'+hash('a')+'|store-a']:{customerId:'customer-one'},
  ['ZALO_OA|'+hash('b')+'|store-a']:{customerId:'customer-two'}};
 const h=harness({grants:g});await h.send({text:'A003'});
 const r=await h.send({channel:'ZALO_OA',subjectHash:hash('b'),text:'lấy 2 cái'});
 assert.equal(r.status,'PRODUCT_SELECTION_REQUIRED');
});
test('28 same linked customer in different Store cannot borrow order context',async()=>{
 const g={['MESSENGER|'+hash('a')+'|store-a']:{customerId:'customer-one'},
  ['ZALO_OA|'+hash('b')+'|store-b']:{customerId:'customer-one'}};
 const h=harness({grants:g});await h.send({scope:A,text:'A003'});
 const r=await h.send({scope:B,channel:'ZALO_OA',subjectHash:hash('b'),text:'lấy 2 cái'});
 assert.equal(r.status,'PRODUCT_SELECTION_REQUIRED');
});
test('29 15-minute session expiry cannot be bypassed by old selected SKU',async()=>{
 const h=harness();await h.send({text:'A003'});h.advance(15*60*1000+1);
 const r=await h.send({text:'lấy 2 cái'});assert.equal(r.status,'PRODUCT_SELECTION_REQUIRED');
});
test('30 duplicate event ID is ignored, not sent or written twice',async()=>{
 const h=harness();
 await h.send({text:'A003 lấy 2 cái',eventId:'same-event'});
 const r=await h.send({text:'A003 lấy 2 cái',eventId:'same-event'});
 assert.equal(r.status,'DUPLICATE_EVENT_IGNORED');assert.equal(r.orderWrites,0);
});
test('31 review stats never claim durable replay/session or real identity',()=>{
 const r=harness().pilot.stats();
 assert.equal(r.serverPersisted,false);assert.equal(r.realIdentityLinked,false);
});
test('32 order reference matching another customer is generic denial',async()=>{
 const h=harness({grants:{['ZALO_BOT|'+hash('a')+'|store-a']:{customerId:'customer-one'}},
 order:ctx=>({source:'AUTHORIZED_ORDER_READBACK',tenantId:ctx.tenantId,
 storeId:ctx.storeId,customerId:'another-customer',orderRef:ctx.orderRef,status:'paid'})});
 const r=await h.send({channel:'ZALO_BOT',text:'T404-TEST-0001'});
 assert.equal(r.status,'ORDER_LOOKUP_DENIED_OR_NOT_FOUND');
});
test('33 source-only output never asserts provider send, Auth, order write or release',async()=>{
 const h=harness();const a=await h.send({kind:'image'}),b=await h.send({text:'A003 lấy 2 cái'});
 for(const x of [a,b]){
  for(const name of ['providerSends','hostedWrites','realModelCalls','orderWrites','stockWrites'])
   assert.equal(x[name],0,name);
  assert.equal(x.canPublish,false);assert.equal(x.actualWebhookSignatureCheckedHere,false);
 }
});
