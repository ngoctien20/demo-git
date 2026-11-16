import test from 'node:test';
import assert from 'node:assert/strict';
import {
 CONTRACT,createSyntheticCrossChannelLab,
 sendProviderMessage,writeHostedOrder,executePrivilegedRpc,invokePaidModel
} from './crosschannel-core.mjs';
const env=(channel,account_id,participant_id,event_id='QA-EVT-XCH01',extra={})=>
 ({contract:CONTRACT,channel,account_id,participant_id,event_id,...extra});
const lab=(opts={})=>createSyntheticCrossChannelLab({otp:()=> '123456',clock:()=>1000,...opts});
const m=(x,id='QA_PSID_A',acct='QA_META_A',event='QA-EVT-XCH01')=>
 x.mintSyntheticIngress(env('MESSENGER',acct,id,event));
const z=(x,id='QA_UID_A',acct='QA_ZALO_A',event='QA-EVT-XCH02')=>
 x.mintSyntheticIngress(env('ZALO_OA',acct,id,event));
const newOrder=(x,ctx=m(x),req='QA-REQ-0001',quantity=2,sku='A002')=>
 x.createQaOrder({context:ctx,sku,quantity,confirmed:true,idempotency_key:req});
const link=(x,ctx=m(x),zc=z(x),order=newOrder(x,ctx))=>{
 const p=x.startLink({context:ctx,order_id:order.order_id});
 const l=x.completeLink({context:zc,proof_ref:p.proof_ref,code:p.code});
 return {order,p,l};
};
const err=(fn,re)=>assert.throws(fn,new RegExp(re));
test('01 contract clearly synthetic',()=>assert.match(CONTRACT,/SYNTHETIC/));
test('02 real order write hard disabled',()=>err(writeHostedOrder,'HOSTED_WRITER_DISABLED'));
test('03 RPC mutation hard disabled',()=>err(executePrivilegedRpc,'RPC_CHANGE_NOT_APPROVED'));
test('04 real provider messaging hard disabled',()=>err(sendProviderMessage,'PROVIDER_SEND_DISABLED'));
test('05 paid inference hard disabled',()=>err(invokePaidModel,'PAID_MODEL_DISABLED'));
test('06 XCH01 Shop A Messenger creates synthetic pending order with correct price',()=>{
 const x=lab(),o=newOrder(x);assert.equal(o.total_vnd,318000);
 assert.equal(o.store_id,'QA_STORE_A');assert.equal(o.status,'pending');
});
test('07 XCH01 no customer confirmation means no order',()=>{
 const x=lab();err(()=>x.createQaOrder({context:m(x),sku:'A002',quantity:2,confirmed:false,idempotency_key:'QA-REQ-0001'}),'CONFIRMATION_REQUIRED');
 assert.equal(x.snapshot().order_count,0);
});
test('08 XCH01 overstock rejected',()=>{
 const x=lab();err(()=>newOrder(x,m(x),'QA-REQ-0002',26),'INVALID_PRODUCT_PRICE_OR_STOCK');
});
test('09 XCH01 invalid SKU cannot be substituted',()=>{
 const x=lab();err(()=>newOrder(x,m(x),'QA-REQ-0002',2,'VL-01'),'INVALID_PRODUCT_PRICE_OR_STOCK');
});
test('10 XCH01 duplicate delivery uses same order id once',()=>{
 const x=lab(),ctx=m(x),a=newOrder(x,ctx),b=newOrder(x,ctx);
 assert.equal(a.order_id,b.order_id);assert.equal(b.duplicate,true);assert.equal(x.snapshot().order_count,1);
});
test('11 XCH01 same idempotency key changed quantity is conflict',()=>{
 const x=lab(),ctx=m(x);newOrder(x,ctx);err(()=>newOrder(x,ctx,'QA-REQ-0001',3),'IDEMPOTENCY_CONFLICT');
});
test('12 XCH02 unlinked Zalo UID with correct order code is denied',()=>{
 const x=lab(),o=newOrder(x);assert.equal(x.lookupOrder({context:z(x),order_id:o.order_id}).status,'NOT_FOUND_OR_UNAUTHORIZED');
});
test('13 XCH02 linked Zalo sees only permitted fields',()=>{
 const x=lab(),{order,l}=link(x);assert.equal(l.status,'IDENTITY_LINKED');
 const got=x.lookupOrder({context:z(x),order_id:order.order_id});
 assert.equal(got.status,'FOUND');assert.equal(got.data.total_vnd,318000);
 assert.deepEqual(Object.keys(got.data).sort(),['order_id','product_name','quantity','sku','status','total_vnd','unit_price_vnd','version'].sort());
});
test('14 XCH03 wrong challenge code is rejected',()=>{
 const x=lab(),ctx=m(x),o=newOrder(x,ctx),p=x.startLink({context:ctx,order_id:o.order_id});
 assert.equal(x.completeLink({context:z(x),proof_ref:p.proof_ref,code:'000000'}).status,'DENIED');
 assert.equal(x.lookupOrder({context:z(x),order_id:o.order_id}).status,'NOT_FOUND_OR_UNAUTHORIZED');
});
test('15 XCH03 challenge expires after five minutes',()=>{
 const t={now:1000},x=lab({clock:()=>t.now}),ctx=m(x),o=newOrder(x,ctx),p=x.startLink({context:ctx,order_id:o.order_id});
 t.now=301000;
 assert.equal(x.completeLink({context:z(x),proof_ref:p.proof_ref,code:p.code}).reason,'INVALID_EXPIRED_OR_REPLAYED_PROOF');
});
test('16 XCH03 challenge replay is rejected',()=>{
 const x=lab(),ctx=m(x),o=newOrder(x,ctx),p=x.startLink({context:ctx,order_id:o.order_id}),zc=z(x);
 assert.equal(x.completeLink({context:zc,proof_ref:p.proof_ref,code:p.code}).status,'IDENTITY_LINKED');
 assert.equal(x.completeLink({context:zc,proof_ref:p.proof_ref,code:p.code}).status,'DENIED');
});
test('17 XCH03 incorrect code three attempts invalidates proof',()=>{
 const x=lab(),ctx=m(x),o=newOrder(x,ctx),p=x.startLink({context:ctx,order_id:o.order_id}),zc=z(x);
 for(let k=0;k<3;k++)assert.equal(x.completeLink({context:zc,proof_ref:p.proof_ref,code:'999999'}).status,'DENIED');
 assert.equal(x.completeLink({context:zc,proof_ref:p.proof_ref,code:p.code}).status,'DENIED');
});
test('18 XCH03 new proof revokes prior unused proof from same source',()=>{
 const x=lab(),ctx=m(x),o=newOrder(x,ctx),p=x.startLink({context:ctx,order_id:o.order_id}),
 q=x.startLink({context:ctx,order_id:o.order_id});
 assert.equal(x.completeLink({context:z(x),proof_ref:p.proof_ref,code:p.code}).status,'DENIED');
 assert.equal(x.completeLink({context:z(x),proof_ref:q.proof_ref,code:q.code}).status,'IDENTITY_LINKED');
});
test('19 XCH03 unknown proof reference is denied',()=>{
 const x=lab();assert.equal(x.completeLink({context:z(x),proof_ref:'QA-FAKE',code:'123456'}).status,'DENIED');
});
test('20 XCH03 cannot complete Shop A challenge on Shop B OA same tenant',()=>{
 const x=lab(),ctx=m(x),o=newOrder(x,ctx),p=x.startLink({context:ctx,order_id:o.order_id});
 const got=x.completeLink({context:z(x,'QA_UID_B','QA_ZALO_B'),proof_ref:p.proof_ref,code:p.code});
 assert.equal(got.status,'DENIED');
 assert.equal(x.snapshot().link_count,0);
});
test('21 XCH03 cannot complete Shop A challenge on Shop C OA another tenant',()=>{
 const x=lab(),ctx=m(x),o=newOrder(x,ctx),p=x.startLink({context:ctx,order_id:o.order_id});
 assert.equal(x.completeLink({context:z(x,'QA_UID_C','QA_ZALO_C'),proof_ref:p.proof_ref,code:p.code}).status,'DENIED');
});
test('22 XCH03 wrong owner cannot generate link code from order',()=>{
 const x=lab(),o=newOrder(x),wrong=m(x,'QA_PSID_STRANGER');
 assert.equal(x.startLink({context:wrong,order_id:o.order_id}).status,'NOT_FOUND_OR_UNAUTHORIZED');
});
test('23 XCH04 returning original Messenger user can read their order',()=>{
 const x=lab(),ctx=m(x),o=newOrder(x,ctx);assert.equal(x.lookupOrder({context:ctx,order_id:o.order_id}).status,'FOUND');
});
test('24 XCH04 another Messenger PSID cannot read order',()=>{
 const x=lab(),o=newOrder(x);
 assert.equal(x.lookupOrder({context:m(x,'QA_PSID_OTHER'),order_id:o.order_id}).status,'NOT_FOUND_OR_UNAUTHORIZED');
});
test('25 XCH05 updateOrder method is not exposed',()=>{
 assert.equal(typeof lab().updateOrder,'undefined');
});
test('26 XCH06 Shop B Zalo cannot read Shop A order, even linked A exists',()=>{
 const x=lab(),{order}=link(x);
 assert.equal(x.lookupOrder({context:z(x,'QA_UID_B','QA_ZALO_B'),order_id:order.order_id}).status,'NOT_FOUND_OR_UNAUTHORIZED');
});
test('27 XCH06 Shop C Messenger cannot read Shop A order',()=>{
 const x=lab(),o=newOrder(x);
 assert.equal(x.lookupOrder({context:m(x,'QA_PSID_C','QA_META_C'),order_id:o.order_id}).status,'NOT_FOUND_OR_UNAUTHORIZED');
});
test('28 XCH06 cross-store same-tenant accounts cannot create Shop A SKU in B',()=>{
 const x=lab(),ctx=m(x,'QA_PSID_B','QA_META_B');
 err(()=>newOrder(x,ctx,'QA-REQ-0003',2,'A002'),'INVALID_PRODUCT_PRICE_OR_STOCK');
});
test('29 XCH06 valid Shop B order is priced from Shop B own catalog',()=>{
 const x=lab(),ctx=m(x,'QA_PSID_B','QA_META_B'),
 o=newOrder(x,ctx,'QA-REQ-0004',2,'VL-01');
 assert.equal(o.total_vnd,184000);assert.equal(o.store_id,'QA_STORE_B');
});
test('30 XCH06 client store_id injection into trusted event rejected',()=>{
 const x=lab();err(()=>x.mintSyntheticIngress(env('MESSENGER','QA_META_A','QA_PSID_A','QA-EVT-XCH01',{store_id:'QA_STORE_B'})),'INVALID_SYNTHETIC_GATEWAY_EVENT');
});
test('31 XCH06 copied trusted context fails WeakSet check',()=>{
 const x=lab(),ctx=m(x);err(()=>x.lookupOrder({context:{...ctx},order_id:'QA-CBOT02-0001'}),'UNVERIFIED_GATEWAY_CONTEXT');
});
test('32 XCH06 random unregistered provider account rejected',()=>{
 const x=lab();err(()=>x.mintSyntheticIngress(env('ZALO_OA','QA_ZALO_OTHER','QA_UID_A')),'UNKNOWN_VERIFIED_PROVIDER_ACCOUNT');
});
test('33 link is revocable immediately from Zalo account',()=>{
 const x=lab(),{order}=link(x),zc=z(x);assert.equal(x.unlink({context:zc}).unlinked,true);
 assert.equal(x.lookupOrder({context:zc,order_id:order.order_id}).status,'NOT_FOUND_OR_UNAUTHORIZED');
});
test('34 already linked Zalo UID cannot be reassigned to another Messenger PSID silently',()=>{
 const x=lab(),orig=m(x),first=newOrder(x,orig),zc=z(x);
 let p=x.startLink({context:orig,order_id:first.order_id});
 assert.equal(x.completeLink({context:zc,proof_ref:p.proof_ref,code:p.code}).status,'IDENTITY_LINKED');
 const other=m(x,'QA_PSID_OTHER'),second=newOrder(x,other,'QA-REQ-OTHER');
 p=x.startLink({context:other,order_id:second.order_id});
 assert.equal(x.completeLink({context:zc,proof_ref:p.proof_ref,code:p.code}).reason,'CONFLICTING_IDENTITY_BINDING');
});
test('35 order code alone cannot authorize unlinked user with guessed target UID',()=>{
 const x=lab(),o=newOrder(x);
 assert.equal(x.lookupOrder({context:z(x,'QA_UID_GUESS'),order_id:o.order_id}).data,null);
});
test('36 synthetic snapshot exposes no challenge code/hash or customer identifier',()=>{
 const x=lab(),ctx=m(x),o=newOrder(x,ctx);x.startLink({context:ctx,order_id:o.order_id});
 const snapshot=JSON.stringify(x.snapshot());assert.equal(snapshot.includes('123456'),false);
 assert.equal(snapshot.includes('QA_PSID_A'),false);assert.equal(snapshot.includes('digest'),false);
});
test('37 role/store trust boundary forbids injecting customer_id in ingress event',()=>{
 const x=lab();err(()=>x.mintSyntheticIngress(env('ZALO_OA','QA_ZALO_A','QA_UID_A','QA-EVT-XCH11',{customer_id:'QA_CUSTOMER_A'})),'INVALID_SYNTHETIC_GATEWAY_EVENT');
});
test('38 no mutation of live Orders or provider sends after full QA flow',()=>{
 const x=lab();link(x);const s=x.snapshot();
 assert.equal(s.hosted_writes,0);assert.equal(s.provider_sends,0);assert.equal(s.paid_model_calls,0);
});
