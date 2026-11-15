'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createSafetyAudit,ERRORS}=require('./order-stock-safety.cjs');
const TA='11111111-1111-4111-8111-111111111111';
const TB='22222222-2222-4222-8222-222222222222';
const SA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const OA='aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
const OB='bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb';
const time=Date.parse('2026-11-16T00:00:00Z');
const cat=(store=SA)=>({source:'SYNTHETIC_SCOPED_CATALOG',
 tenantId:store===SA?TA:TB,storeId:store,
 priceVersion:12,stockVersion:8,expiresAt:time+60000,
 products:[{sku:'SKU-1',priceVnd:159000,stockOnHand:5,isActive:true},
           {sku:'SKU-2',priceVnd:50000,stockOnHand:10,isActive:true}]});
function setup(){
 const fixtures={[SA]:cat(SA),[SB]:cat(SB)};
 const users={ownerA:{tenantId:TA,storeId:SA},ownerB:{tenantId:TB,storeId:SB}};
 const state={users,fixtures,clock:time};
 const ports={
  mode:'OFFLINE_VERIFIED_CATALOG',
  async resolveStoreScope({bearer,storeId}){
   const u=users[bearer];
   if(!u||u.storeId!==storeId)return null;
   return {source:'SYNTHETIC_AUTH_SERVER',tenantId:u.tenantId,storeId:u.storeId,
    active:true,subscriptionActive:true,canViewCatalog:true};
  },
  async readStoreCatalogSnapshot({tenantId,storeId}){
   const c=fixtures[storeId];return c?.tenantId===tenantId?c:null;
  }
 };
 const s=createSafetyAudit({mode:'OFFLINE_SYNTHETIC_QA',ports,now:()=>state.clock});
 return {s,state};
}
function req(extra={}){return {storeId:SA,lines:[{sku:'SKU-1',quantity:2}],
 expectedTotalVnd:318000,customerConfirmed:false,
 requestId:'req-order-000001',...extra};}
function ev(extra={}){return {source:'TRUSTED_ORDER_WORKFLOW_MOCK',
 storeId:SA,orderId:OA,status:'pending',action:'preview',stockDelta:0,...extra};}
async function denial(p,code){await assert.rejects(p,x=>x?.code===code);}
test('01 · only mock source ports enabled',()=>{
 assert.throws(()=>createSafetyAudit(),x=>x.code===ERRORS.MODE);
 assert.throws(()=>createSafetyAudit({mode:'HOSTED',ports:setup().s}),
 x=>x.code===ERRORS.MODE);
});
test('02 · valid single SKU preview totals exact integer VND',async()=>{
 const {s}=setup(),r=await s.previewOrder({bearer:'ownerA',body:req()});
 assert.equal(r.expectedTotalVnd,318000);
 assert.equal(r.status,'AWAITING_CUSTOMER_CONFIRMATION');
 assert.equal(r.willCreateOrder,false);assert.equal(r.willDeductStock,false);
});
test('03 · confirmed preview still cannot commit order or reserve stock',async()=>{
 const {s}=setup(),r=await s.previewOrder({bearer:'ownerA',
 body:req({customerConfirmed:true})});
 assert.equal(r.status,'CONFIRMED_PREVIEW_REQUIRES_ATOMIC_ORDER_COMMIT');
 assert.equal(r.willCreateOrder,false);assert.equal(r.willReserveStock,false);
});
test('04 · two SKU lines calculate without float rounding',async()=>{
 const {s}=setup();
 const r=await s.previewOrder({bearer:'ownerA',body:req({
 lines:[{sku:'SKU-1',quantity:1},{sku:'SKU-2',quantity:3}],
 expectedTotalVnd:309000})});
 assert.equal(r.expectedTotalVnd,309000);
});
test('05 · client-supplied price, tenant or store authorization override denied',async()=>{
 const {s}=setup();await denial(s.previewOrder({bearer:'ownerA',body:{
 ...req(),clientPrice:1,tenantId:TA,role:'owner'}}),ERRORS.INPUT);
});
test('06 · cross-store customer tries wrong catalog denied',async()=>{
 const {s}=setup();await denial(s.previewOrder({bearer:'ownerB',body:req()}),ERRORS.AUTH);
});
test('07 · spoofed authorized store in body cannot pass matching session',async()=>{
 const {s}=setup();await denial(s.previewOrder({bearer:'ownerA',
 body:req({storeId:SB})}),ERRORS.AUTH);
});
test('08 · missing or invalid bearer is denied',async()=>{
 const {s}=setup();await denial(s.previewOrder({bearer:'unknown',body:req()}),ERRORS.AUTH);
});
test('09 · insufficient snapshot stock is blocked',async()=>{
 const {s}=setup();await denial(s.previewOrder({bearer:'ownerA',
 body:req({lines:[{sku:'SKU-1',quantity:6}],expectedTotalVnd:954000})}),ERRORS.STOCK);
});
test('10 · duplicate SKU within same order rejected',async()=>{
 const {s}=setup();await denial(s.previewOrder({bearer:'ownerA',
 body:req({lines:[{sku:'SKU-1',quantity:1},{sku:'SKU-1',quantity:1}]})}),ERRORS.SKU);
});
test('11 · duplicate product records in server snapshot reject',async()=>{
 const {s,state}=setup();state.fixtures[SA].products.push({
 sku:'SKU-1',priceVnd:159000,stockOnHand:5,isActive:true});
 await denial(s.previewOrder({bearer:'ownerA',body:req()}),ERRORS.SKU);
});
test('12 · stale price or stock version snapshot rejected',async()=>{
 const {s,state}=setup();state.clock=time+70000;
 await denial(s.previewOrder({bearer:'ownerA',body:req()}),ERRORS.STALE);
});
test('13 · invalid catalog price version rejected',async()=>{
 const {s,state}=setup();state.fixtures[SA].priceVersion=0;
 await denial(s.previewOrder({bearer:'ownerA',body:req()}),ERRORS.SNAPSHOT);
});
test('14 · catalog mistakenly bound to other tenant denied',async()=>{
 const {s,state}=setup();state.fixtures[SA].tenantId=TB;
 await denial(s.previewOrder({bearer:'ownerA',body:req()}),ERRORS.SNAPSHOT);
});
test('15 · decimal or string price from source rejected',async()=>{
 for(const priceVnd of ['159.000đ',159.5]){
  const {s,state}=setup();state.fixtures[SA].products[0].priceVnd=priceVnd;
  await denial(s.previewOrder({bearer:'ownerA',body:req()}),ERRORS.SNAPSHOT);
 }
});
test('16 · negative stock rejected instead of treating as zero',async()=>{
 const {s,state}=setup();state.fixtures[SA].products[0].stockOnHand=-1;
 await denial(s.previewOrder({bearer:'ownerA',body:req()}),ERRORS.SNAPSHOT);
});
test('17 · qty zero, decimals or >10k denied',async()=>{
 for(const quantity of [0,1.5,-3,10001]){
  const {s}=setup();
  await denial(s.previewOrder({bearer:'ownerA',body:req({
   lines:[{sku:'SKU-1',quantity}]})}),ERRORS.INPUT);
 }
});
test('18 · malformed expected total rejected rather than becoming zero',async()=>{
 for(const expectedTotalVnd of ['318.000đ',NaN,-1]){
  const {s}=setup();await denial(s.previewOrder({bearer:'ownerA',
   body:req({expectedTotalVnd})}),ERRORS.INPUT);
 }
});
test('19 · valid but incorrect expected total denied',async()=>{
 const {s}=setup();await denial(s.previewOrder({bearer:'ownerA',
 body:req({expectedTotalVnd:159000})}),ERRORS.TOTAL);
});
test('20 · explicit free item of 0 VND is valid but still no-write',async()=>{
 const {s,state}=setup();state.fixtures[SA].products[0].priceVnd=0;
 const r=await s.previewOrder({bearer:'ownerA',
 body:req({expectedTotalVnd:0})});
 assert.equal(r.expectedTotalVnd,0);assert.equal(r.willCreateOrder,false);
});
test('21 · bigint multiplication overflow cannot silently wrap',async()=>{
 const {s,state}=setup();state.fixtures[SA].products[0]={
 sku:'SKU-1',priceVnd:1_000_000_000_000,stockOnHand:10000,isActive:true};
 await denial(s.previewOrder({bearer:'ownerA',body:req({
 lines:[{sku:'SKU-1',quantity:10000}],expectedTotalVnd:0})}),ERRORS.OVERFLOW);
});
test('22 · normal pending preview may not modify stock',()=>{
 const {s}=setup();const r=s.reviewStockEvent(ev());
 assert.equal(r.stockDelta,0);assert.equal(r.reservationsChanged,0);
});
test('23 · pending immediate deduction is blocked',()=>{
 const {s}=setup();
 assert.throws(()=>s.reviewStockEvent(ev({action:'deduct',stockDelta:-2})),
 x=>x.code===ERRORS.MUTATION);
});
test('24 · confirmed stock commit remains blocked pending explicit ledger',()=>{
 const {s}=setup();
 assert.throws(()=>s.reviewStockEvent(ev({
 action:'commit',status:'confirmed',stockDelta:-2})),x=>x.code===ERRORS.MUTATION);
});
test('25 · cancelled/restored stock requires dedicated ledger',()=>{
 const {s}=setup();
 assert.throws(()=>s.reviewStockEvent(ev({
 action:'release',status:'cancelled',stockDelta:2})),x=>x.code===ERRORS.MUTATION);
});
test('26 · invalid source event cannot claim an inventory release',()=>{
 const {s}=setup();
 assert.throws(()=>s.reviewStockEvent(ev({source:'CLIENT_FORM'})),x=>x.code===ERRORS.INPUT);
});
test('27 · paid only, exclude pending/cancelled/refunded/confirmed',()=>{
 const {s}=setup();
 const orders=[
 {orderId:OA,storeId:SA,status:'paid',totalVnd:159000},
 {orderId:'aaaaaaaa-2222-4222-8222-aaaaaaaaaaaa',storeId:SA,status:'pending',totalVnd:200000},
 {orderId:'aaaaaaaa-3333-4333-8333-aaaaaaaaaaaa',storeId:SA,status:'cancelled',totalVnd:150000},
 {orderId:'aaaaaaaa-4444-4444-8444-aaaaaaaaaaaa',storeId:SA,status:'refunded',totalVnd:50000},
 {orderId:'aaaaaaaa-5555-4555-8555-aaaaaaaaaaaa',storeId:SA,status:'confirmed',totalVnd:50000}
 ];
 const r=s.reviewPaidRevenue({storeId:SA,orders});
 assert.equal(r.totalPaidVnd,159000);assert.equal(r.paidCount,1);
 assert.equal(r.orderCount,5);assert.equal(r.hostedReads,0);
});
test('28 · duplicate paid order prevents double counting',()=>{
 const {s}=setup();
 const row={orderId:OA,storeId:SA,status:'paid',totalVnd:159000};
 assert.throws(()=>s.reviewPaidRevenue({storeId:SA,orders:[row,row]}),
 x=>x.code===ERRORS.DUPLICATE);
});
test('29 · no cross-store revenue leakage',()=>{
 const {s}=setup();assert.throws(()=>s.reviewPaidRevenue({storeId:SA,orders:[
 {orderId:OB,storeId:SB,status:'paid',totalVnd:500000}]}),x=>x.code===ERRORS.ORDER);
});
test('30 · malformed paid total fails closed',()=>{
 const {s}=setup();for(const totalVnd of ['100.000',-1,NaN]){
  assert.throws(()=>s.reviewPaidRevenue({storeId:SA,orders:[
   {orderId:OA,storeId:SA,status:'paid',totalVnd}]}),x=>x.code===ERRORS.ORDER);
 }
});
test('31 · paid sum exceeds accounting cap and fails',()=>{
 const {s}=setup();
 assert.throws(()=>s.reviewPaidRevenue({storeId:SA,orders:[
 {orderId:OA,storeId:SA,status:'paid',totalVnd:900_000_000_000_000},
 {orderId:'aaaaaaaa-6666-4666-8666-aaaaaaaaaaaa',storeId:SA,status:'paid',totalVnd:900_000_000_000_000}
 ]}),x=>x.code===ERRORS.OVERFLOW);
});
test('32 · no exposed order append, stock write or notification functions',()=>{
 const {s}=setup();const x=s.inspect();
 assert.equal(x.hostedWrites,0);
 for(const key of ['canAppendOrder','canAdjustStock','canSettlePayment',
  'canSendNotification','canPublish'])assert.equal(x[key],false);
});
