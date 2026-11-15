'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createMessengerQaLab,PAGES}=require('./messenger-four-flow-offline.cjs');
const A='PAGE_QA_A',B='PAGE_QA_B',C='PAGE_QA_C';
const u='QA_USER_ALICE',bob='QA_USER_BOB';
let n=0;
function send(lab,page,text,sender=u,mid){
 return lab.handle(lab.gateway.fixtureEnvelope({pageId:page,senderId:sender,
   mid:mid||'QA_MID_'+String(++n).padStart(6,'0'),text}));
}
function lab(){return createMessengerQaLab()}
test('01 — fixture has two shops sharing tenant and third cross tenant',()=>{
 assert.equal(PAGES[A].tenant,PAGES[B].tenant);
 assert.notEqual(PAGES[A].store,PAGES[B].store);
 assert.notEqual(PAGES[A].tenant,PAGES[C].tenant);
});
test('02 — unbranded raw webhook cannot bypass synthetic trusted boundary',()=>{
 assert.throws(()=>lab().handle({pageId:A,senderId:u,text:'Shop?',mid:'QA_MID_TEST'}),/TRUSTED_FIXTURE_GATE_REQUIRED/);
});
test('03 — unknown Page rejected',()=>{
 assert.throws(()=>lab().gateway.fixtureEnvelope({pageId:'PAGE_FAKE',
 senderId:u,text:'Shop?',mid:'QA_MID_TEST'}),/BAD_SYNTHETIC_ENVELOPE/);
});
test('04 — empty sender or invalid mid rejected',()=>{
 const l=lab();for(const x of ['', 'fake'])assert.throws(()=>
 l.gateway.fixtureEnvelope({pageId:A,senderId:x,text:'hi',mid:'QA_MID_TEST'}),
 /BAD_SYNTHETIC_ENVELOPE/);
});
test('05 — long messages rejected before bot',()=>{
 assert.throws(()=>lab().gateway.fixtureEnvelope({pageId:A,senderId:u,
  text:'x'.repeat(801),mid:'QA_MID_TEST'}),/BAD_SYNTHETIC_ENVELOPE/);
});
test('06 — consultant uses Store A catalog',()=>{
 const r=send(lab(),A,'Shop có áo không?');
 assert.equal(r.flow,'CONSULT');assert.equal(r.store,'A');assert.match(r.message,/A001/);
});
test('07 — consultant uses Store B not A',()=>{
 const r=send(lab(),B,'Tu van san pham');
 assert.equal(r.flow,'CONSULT');assert.equal(r.store,'B');
});
test('08 — accurate Store A VND price is integer',()=>{
 const r=send(lab(),A,'Áo thun trắng giá bao nhiêu?');
 assert.equal(r.flow,'QUOTE');assert.equal(r.unitPriceVnd,159000);
 assert.match(r.message,/159\.000đ/);
});
test('09 — Store B same SKU has different price',()=>{
 const r=send(lab(),B,'gia ao thun');
 assert.equal(r.unitPriceVnd,209000);assert.equal(r.store,'B');
});
test('10 — Store C cross-tenant price remains independent',()=>{
 assert.equal(send(lab(),C,'bao gia').unitPriceVnd,259000);
});
test('11 — 2-item quote is exact 318000 VND',()=>{
 const r=send(lab(),A,'2 cai gia bao nhieu');
 assert.equal(r.quotedTotalVnd??r.totalVnd,318000);
});
test('12 — quote does not create order or Outbox event',()=>{
 const l=lab();const r=send(l,A,'gia bao nhieu');
 assert.equal(r.orderCreated,false);
 assert.equal(l.inspect().requests,0);assert.equal(l.inspect().unsentOutbox,0);
});
test('13 — negotiated customer price refused without policy',()=>{
 const r=send(lab(),A,'Tôi muốn giá 100 nghìn');
 assert.equal(r.flow,'QUOTE');assert.match(r.message,/Không có chính sách/);
});
test('14 — wholesale discount not invented',()=>{
 const r=send(lab(),A,'gia si');
 assert.match(r.message,/Không có chính sách/);
});
test('15 — order request first enters explicit confirmation state',()=>{
 const l=lab();const r=send(l,A,'Tôi đặt 2 áo thun trắng M');
 assert.equal(r.awaitingConfirmation,true);
 assert.equal(l.inspect().requests,0);assert.equal(l.inspect().pending,1);
});
test('16 — only subsequent confirmation persists synthetic request',()=>{
 const l=lab();send(l,A,'đặt 2 áo');const r=send(l,A,'xác nhận');
 assert.equal(r.flow,'ORDER');assert.match(r.requestCode,/^QA-REQ-/);
 assert.equal(l.inspect().requests,1);
 assert.equal(l.inspect().unsentOutbox,1);
});
test('17 — pending request has no stock movement or provider sends',()=>{
 const l=lab();send(l,A,'dat 2 ao');send(l,A,'xac nhan');
 assert.equal(l.inspect().hostedWrites,0);assert.equal(l.inspect().metaSends,0);
 assert.equal(PAGES[A].stock,3);
});
test('18 — outbox event is ready but never sent',()=>{
 const l=lab();send(l,A,'dat 2 ao');
 const r=send(l,A,'xac nhan');
 assert.equal(r.outboxStatus,'READY_OFFLINE_NOT_SENT');
 assert.equal(r.providerSends,0);
});
test('19 — duplicate exact MID returns replay and no second order',()=>{
 const l=lab();send(l,A,'dat 2 ao',u,'QA_MID_FIRST_1');
 const r1=send(l,A,'xac nhan',u,'QA_MID_CONFIRM_1');
 const r2=send(l,A,'xac nhan',u,'QA_MID_CONFIRM_1');
 assert.equal(r2.replayed,true);
 assert.equal(r1.requestCode,r2.requestCode);
 assert.equal(l.inspect().requests,1);assert.equal(l.inspect().unsentOutbox,1);
});
test('20 — duplicated MID with changed sender fails closed',()=>{
 const l=lab();send(l,A,'gia ao',u,'QA_MID_SHARED_1');
 assert.throws(()=>send(l,A,'gia ao',bob,'QA_MID_SHARED_1'),
  /MID_PAYLOAD_OR_SENDER_SCOPE_CONFLICT/);
});
test('21 — duplicated MID with tampered price query fails closed',()=>{
 const l=lab();send(l,A,'gia ao',u,'QA_MID_SHARED_2');
 assert.throws(()=>send(l,A,'gia 1000',u,'QA_MID_SHARED_2'),
 /MID_PAYLOAD_OR_SENDER_SCOPE_CONFLICT/);
});
test('22 — unknown stock quantity denied without order creation',()=>{
 const l=lab(),r=send(l,A,'đặt 9 áo');
 assert.match(r.message,/Không đủ tồn/);assert.equal(l.inspect().requests,0);
});
test('23 — invalid quantity denied',()=>{
 const l=lab(),r=send(l,A,'đặt 99999 áo');
 assert.equal(r.flow,'ORDER');assert.equal(l.inspect().requests,0);
});
test('24 — cancelling confirmation creates no order',()=>{
 const l=lab();send(l,A,'đặt 2 áo');send(l,A,'hủy xác nhận');
 assert.equal(l.inspect().pending,0);assert.equal(l.inspect().requests,0);
});
test('25 — unprompted confirm cannot create order',()=>{
 const l=lab();send(l,A,'xac nhan');
 assert.equal(l.inspect().requests,0);assert.equal(l.inspect().unsentOutbox,0);
});
test('26 — own order status visible only to same sender and Page',()=>{
 const l=lab();send(l,A,'đặt 2 áo');const order=send(l,A,'xác nhận');
 const own=send(l,A,'tra cuu don',u);
 assert.equal(own.requestCode,order.requestCode);
 assert.equal(send(l,A,'tra cuu don',bob).requestCode,null);
 assert.equal(send(l,B,'tra cuu don',u).requestCode,null);
});
test('27 — cross-tenant C cannot view A order',()=>{
 const l=lab();send(l,A,'dat 1 ao');send(l,A,'xac nhan');
 assert.equal(send(l,C,'ma don',u).requestCode,null);
});
test('28 — change address not executed without verifying owner',()=>{
 const l=lab(),r=send(l,A,'đổi địa chỉ');
 assert.equal(r.flow,'ORDER_SUPPORT');assert.equal(l.inspect().requests,0);
});
test('29 — cancellation instruction does not bypass order status',()=>{
 const l=lab();send(l,A,'dat 1 ao');send(l,A,'xac nhan');
 const r=send(l,A,'hủy đơn');
 assert.equal(r.flow,'ORDER_SUPPORT');assert.equal(l.inspect().requests,1);
});
test('30 — support escalation is no-send',()=>{
 const l=lab(),r=send(l,A,'gặp chủ shop');
 assert.equal(r.flow,'ORDER_SUPPORT');assert.equal(r.providerSends,0);
});
test('31 — missing intent falls back to safe consultation',()=>{
 const r=send(lab(),A,'xyz!!!');
 assert.equal(r.flow,'CONSULT');assert.match(r.message,/giả lập/);
});
test('32 — level 1 not falsely reported as real Messenger / AI / RLS',()=>{
 const x=lab().inspect();
 assert.equal(x.realAiAgent,false);assert.equal(x.realMetaHmacVerified,false);
 assert.equal(x.realRlsVerified,false);assert.equal(x.canPublish,false);
});
test('33 — all outputs indicate text fallback, zero writes and no provider sends',()=>{
 const l=lab();for(const q of ['tư vấn','báo giá','dat 1 ao','xac nhan','ma don']){
 const r=send(l,A,q);assert.equal(r.writes,0);assert.equal(r.providerSends,0);
 assert.equal(r.richUi,'TEXT_FALLBACK_ONLY');
 }
});
