'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const c=require('./business-contracts.cjs');
const ctx={source:'BACKEND_AUTHENTICATED_CONTEXT',isVerified:true,
 tenantId:'qa-tenant-b',storeId:'qa-store-b',botId:'qa-bot-b',scopeKey:'owner-b',
 actorRole:'OWNER',subscriptionStatus:'ACTIVE',permissions:['orders:approve','orders:reject','reports:read_shop']};
const customer={...ctx,actorRole:'CUSTOMER',scopeKey:'customer-b'};
const order={verified:true,tenantId:'qa-tenant-b',storeId:'qa-store-b',botId:'qa-bot-b',
 orderId:'QA-B-001',status:'PENDING_OWNER',customerKey:'customer-b'};
const report={verified:true,tenantId:'qa-tenant-b',storeId:'qa-store-b',botId:'qa-bot-b',
 requestCount:3,pendingOwnerCount:2,acceptedCount:1,completedCount:0,paidRevenueVnd:0};
const ownerBinding={verified:true,tenantId:'qa-tenant-b',storeId:'qa-store-b',
 botId:'qa-bot-b',status:'paired',ownerBindingId:'verified_qa_owner_b',expiresAt:'2099-01-01T00:00:00Z'};
const pending={...order,status:'PENDING_OWNER',dbCommitted:true};
const deny=(code,fn)=>assert.rejects(fn(),{code});
test('ORDER-01 state machine defines all seven stages',()=>{
 assert.deepEqual(c.STATES,['DRAFT','PENDING_OWNER','ACCEPTED','REJECTED','CANCELLED','COMPLETED','PAID']);
});
test('ORDER-02 draft cannot jump directly to COMPLETED',()=>{
 assert.throws(()=>c.proposeOrderTransition({ctx,order:{...order,status:'DRAFT'},requestedState:'COMPLETED'}),{code:'ORDER_TRANSITION_INVALID'});
});
test('ORDER-03 pending->accepted requires explicit confirmation',()=>{
 const x=c.proposeOrderTransition({ctx,order,requestedState:'ACCEPTED'});
 assert.equal(x.status,'CONFIRMATION_REQUIRED');assert.equal(x.ordersWritten,0);
});
test('ORDER-04 even verified confirmation cannot auto-save',()=>{
 const x=c.proposeOrderTransition({ctx,order,requestedState:'ACCEPTED',confirmation:{
  verified:true,orderId:order.orderId,requestedState:'ACCEPTED',nonce:'qa_challenge_123',
  idempotencyVerified:true}});
 assert.equal(x.status,'SERVER_COMMIT_REQUIRED');assert.equal(x.ordersWritten,0);
});
test('ORDER-05 incorrect store cannot mutate state',()=>{
 assert.throws(()=>c.proposeOrderTransition({ctx,order:{...order,storeId:'qa-store-a'},
  requestedState:'ACCEPTED'}),{code:'ORDER_STATE_UNVERIFIED'});
});
test('ORDER-06 customer cannot call Owner tool',()=>{
 assert.throws(()=>c.proposeOrderTransition({ctx:customer,order,requestedState:'ACCEPTED'}),
  {code:'TRUSTED_CONTEXT_REQUIRED'});
});
test('ORDER-07 owner without approve permission denied',()=>{
 assert.throws(()=>c.proposeOrderTransition({ctx:{...ctx,permissions:['orders:reject']},
 order,requestedState:'ACCEPTED'}),{code:'OWNER_APPROVAL_PERMISSION_DENIED'});
});
test('ORDER-08 owner without reject permission denied',()=>{
 assert.throws(()=>c.proposeOrderTransition({ctx:{...ctx,permissions:['orders:approve']},
 order,requestedState:'REJECTED'}),{code:'OWNER_REJECT_PERMISSION_DENIED'});
});
test('ORDER-09 expired subscription blocks owner mutations',()=>{
 assert.throws(()=>c.proposeOrderTransition({ctx:{...ctx,subscriptionStatus:'EXPIRED'},
 order,requestedState:'ACCEPTED'}),{code:'TRUSTED_CONTEXT_REQUIRED'});
});
test('ORDER-10 paid without real payment proof not allowed',()=>{
 assert.throws(()=>c.proposeOrderTransition({ctx,order:{...order,status:'COMPLETED'},
 requestedState:'PAID'}),{code:'PAYMENT_EVIDENCE_REQUIRED'});
});
test('ORDER-11 rejected order cannot be reopened via this contract',()=>{
 assert.throws(()=>c.proposeOrderTransition({ctx,order:{...order,status:'REJECTED'},
 requestedState:'ACCEPTED'}),{code:'ORDER_TRANSITION_INVALID'});
});
test('ORDER-12 accepted->completed cannot skip later payment gate',()=>{
 const x=c.proposeOrderTransition({ctx,order:{...order,status:'ACCEPTED'},requestedState:'COMPLETED'});
 assert.equal(x.status,'CONFIRMATION_REQUIRED');
});
test('NOT-01 persisted verified order can prepare HELD event only',()=>{
 const n=c.prepareHeldNotification({context:ctx,persisted:pending,ownerBinding});
 assert.equal(n.delivery_state,'SEND_DISABLED');assert.equal(n.outboxWritten,false);
 assert.equal(n.delivered,false);assert.equal(n.externalSends,0);
});
test('NOT-02 no outbox candidate before DB commit',()=>{
 assert.throws(()=>c.prepareHeldNotification({context:ctx,persisted:{...pending,dbCommitted:false},ownerBinding}),
  {code:'ORDER_NOT_PERSISTED'});
});
test('NOT-03 no notification if data belongs to different shop',()=>{
 assert.throws(()=>c.prepareHeldNotification({context:ctx,persisted:{...pending,storeId:'qa-store-a'},ownerBinding}),
  {code:'ORDER_NOT_PERSISTED'});
});
test('NOT-04 unpaired owner cannot be recipient',()=>{
 assert.throws(()=>c.prepareHeldNotification({context:ctx,persisted:pending,ownerBinding:{...ownerBinding,status:'unpaired'}}),
  {code:'OWNER_BINDING_NOT_VERIFIED'});
});
test('NOT-05 other channel not silently enabled',()=>{
 assert.throws(()=>c.prepareHeldNotification({context:ctx,persisted:pending,ownerBinding,channel:'TELEGRAM'}),
  {code:'CHANNEL_NOT_APPROVED'});
});
test('NOT-06 same persisted order yields same idempotency key',()=>{
 const a=c.prepareHeldNotification({context:ctx,persisted:pending,ownerBinding});
 const b=c.prepareHeldNotification({context:ctx,persisted:pending,ownerBinding});
 assert.equal(a.idempotency_key,b.idempotency_key);assert.match(a.idempotency_key,/^[a-f0-9]{64}$/);
});
test('NOT-07 different store cannot reuse the same event key',()=>{
 const k=c.prepareHeldNotification({context:ctx,persisted:pending,ownerBinding});
 const otherCtx={...ctx,storeId:'qa-store-a'};
 const otherPending={...pending,storeId:'qa-store-a'};
 const otherBinding={...ownerBinding,storeId:'qa-store-a'};
 const l=c.prepareHeldNotification({context:otherCtx,persisted:otherPending,ownerBinding:otherBinding});
 assert.notEqual(k.idempotency_key,l.idempotency_key);
});
test('CUS-01 existing customer core preview used only with safe contract',async()=>{
 const ports=c.makeSalesLitePorts({customerCore:{preview:async()=>({
  status:'DRAFT_PREVIEW',mode:'PREVIEW_ONLY',productionReady:false,
  ordersWritten:0,externalSends:0,replyCandidate:'[QA] Xem giá từ catalog đã xác minh'
 })}});
 const x=await ports.customerPreview({ctx:customer,envelope:{version:1}});
 assert.equal(x.status,'DRAFT_PREVIEW');assert.equal(x.ordersWritten,0);
});
test('CUS-02 core with possible order writes rejected',async()=>{
 const ports=c.makeSalesLitePorts({customerCore:{preview:async()=>({
   status:'DRAFT_PREVIEW',mode:'PREVIEW_ONLY',productionReady:false,ordersWritten:1,externalSends:0
 })}});
 await deny('CUSTOMER_CORE_SAFETY_GATE_FAILED',()=>ports.customerPreview({ctx:customer,envelope:{}}));
});
test('CUS-03 outbound-enabled core result rejected',async()=>{
 const ports=c.makeSalesLitePorts({customerCore:{preview:async()=>({
   mode:'PREVIEW_ONLY',productionReady:false,ordersWritten:0,externalSends:1
 })}});
 await deny('CUSTOMER_CORE_SAFETY_GATE_FAILED',()=>ports.customerPreview({ctx:customer}));
});
test('CUS-04 no core port causes fail closed',async()=>{
 await deny('CUSTOMER_CORE_NOT_CONNECTED',()=>c.makeSalesLitePorts().customerPreview({ctx:customer}));
});
test('CUS-05 own order requires verified identity',async()=>{
 const ports=c.makeSalesLitePorts({readOrder:async()=>order});
 await deny('CUSTOMER_ORDER_IDENTITY_REQUIRED',()=>ports.customerOwnOrder({ctx:customer,orderId:order.orderId}));
});
test('CUS-06 own order with verified ownership read-only',async()=>{
 const ports=c.makeSalesLitePorts({readOrder:async()=>order});
 const x=await ports.customerOwnOrder({ctx:customer,orderId:order.orderId,
   customerProof:{source:'SERVER_VERIFIED_CUSTOMER',actorKey:'customer-b'}});
 assert.equal(x.status,'READ_ONLY_OWN_ORDER');assert.equal(x.ordersWritten,0);
});
test('CUS-07 foreign order cannot be viewed even if order_id known',async()=>{
 const ports=c.makeSalesLitePorts({readOrder:async()=>({...order,customerKey:'other-customer'})});
 await deny('CUSTOMER_ORDER_SCOPE_DENIED',()=>ports.customerOwnOrder({ctx:customer,orderId:order.orderId,
 customerProof:{source:'SERVER_VERIFIED_CUSTOMER',actorKey:'customer-b'}}));
});
test('CUS-08 owner cannot pose as customer',async()=>{
 await deny('TRUSTED_CONTEXT_REQUIRED',()=>c.makeSalesLitePorts().customerOwnOrder({ctx,orderId:order.orderId}));
});
test('OWN-01 report is read-only with paid revenue distinct from requests',async()=>{
 const ports=c.makeSalesLitePorts({readReport:async()=>report});
 const x=await ports.ownerReport({ctx});
 assert.equal(x.paidRevenueVnd,0);assert.equal(x.requestCount,3);
 assert.equal(x.revenueDefinition,'PAID_WITH_PAYMENT_EVIDENCE_ONLY');
});
test('OWN-02 negative paid revenue rejected',async()=>{
 const ports=c.makeSalesLitePorts({readReport:async()=>({...report,paidRevenueVnd:-100})});
 await deny('OWNER_REPORT_UNVERIFIED',()=>ports.ownerReport({ctx}));
});
test('OWN-03 owner cannot read another shop report',async()=>{
 const ports=c.makeSalesLitePorts({readReport:async()=>({...report,storeId:'qa-store-a'})});
 await deny('OWNER_REPORT_UNVERIFIED',()=>ports.ownerReport({ctx}));
});
test('OWN-04 permissions checked for report',async()=>{
 const ports=c.makeSalesLitePorts({readReport:async()=>report});
 await deny('OWNER_REPORT_PERMISSION_DENIED',()=>ports.ownerReport({ctx:{...ctx,permissions:[]}}));
});
test('SUB-01 subscription view only returns verified expiry',async()=>{
 const p=c.makeSalesLitePorts({readSubscription:async()=>({
  verified:true,tenantId:ctx.tenantId,storeId:ctx.storeId,status:'ACTIVE',expiresAt:'2027-01-01T00:00:00Z'
 })});
 const x=await p.subscriptionView({ctx});
 assert.equal(x.status,'READ_ONLY_SUBSCRIPTION');assert.equal(x.renewalApplied,false);
});
test('SUB-02 subscription view cannot pretend a payment was made',async()=>{
 const p=c.makeSalesLitePorts({readSubscription:async()=>({
  verified:true,tenantId:ctx.tenantId,storeId:ctx.storeId,status:'EXPIRED',expiresAt:'2026-11-14T00:00:00Z'
 })});
 const x=await p.subscriptionView({ctx});
 assert.equal(x.paymentProof,null);assert.equal(x.renewalApplied,false);
});
test('SUB-03 no backend readback denies subscription',async()=>{
 await deny('SUBSCRIPTION_READ_PORT_NOT_CONNECTED',()=>c.makeSalesLitePorts().subscriptionView({ctx}));
});
test('SUB-04 foreign subscription scope denied',async()=>{
 const p=c.makeSalesLitePorts({readSubscription:async()=>({
  verified:true,tenantId:'qa-tenant-a',storeId:'qa-store-a',status:'ACTIVE',expiresAt:'2027-01-01T00:00:00Z'
 })});
 await deny('SUBSCRIPTION_READBACK_UNVERIFIED',()=>p.subscriptionView({ctx}));
});
test('SUP-01 ticket is only a proposal; no real ticket is created',()=>{
 const x=c.makeSupportTicketCandidate({ctx,issueCode:'BOT_CONNECTIVITY'});
 assert.equal(x.submitted,false);assert.equal(x.ticketId,null);
});
test('SUP-02 arbitrary issue cannot inject extra workflow',()=>{
 assert.throws(()=>c.makeSupportTicketCandidate({ctx,issueCode:'DELETE_ALL'}),{code:'SUPPORT_CONTEXT_INVALID'});
});
test('SEC-01 contracts never declare sent and delivered',()=>{
 const n=c.prepareHeldNotification({context:ctx,persisted:pending,ownerBinding});
 assert.equal(n.providerAccepted,false);assert.equal(n.delivered,false);
});
