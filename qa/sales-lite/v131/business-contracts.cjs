'use strict';
// TIEN404 SALES LITE V1.1 — business integration CONTRACT, no external side effects.
// Reuse existing V12.4R Customer Core and Notification Outbox through injected ports.
// This module deliberately does NOT create a replacement Orders database or call Supabase.
const {createHash}=require('node:crypto');
const STATES=Object.freeze(['DRAFT','PENDING_OWNER','ACCEPTED','REJECTED','CANCELLED','COMPLETED','PAID']);
const FLOW=Object.freeze({
 DRAFT:['PENDING_OWNER','CANCELLED'],PENDING_OWNER:['ACCEPTED','REJECTED','CANCELLED'],
 ACCEPTED:['COMPLETED'],REJECTED:[],CANCELLED:[],COMPLETED:['PAID'],PAID:[]
});
function fail(msg){const x=new Error(msg);x.code=msg;throw x;}
function safeKey(s){return typeof s==='string'&&s.length>3&&s.length<=150&&/^[a-zA-Z0-9:_-]+$/.test(s);}
function verifiedContext(ctx,role){
 if(!ctx||ctx.source!=='BACKEND_AUTHENTICATED_CONTEXT'||ctx.isVerified!==true||
    !safeKey(ctx.tenantId)||!safeKey(ctx.storeId)||!safeKey(ctx.botId)||
    !safeKey(ctx.scopeKey)||ctx.actorRole!==role||
    ctx.subscriptionStatus!=='ACTIVE')fail('TRUSTED_CONTEXT_REQUIRED');
 return ctx;
}
function safeScope(row,ctx){
 return row?.verified===true&&row.tenantId===ctx.tenantId&&row.storeId===ctx.storeId&&row.botId===ctx.botId;
}
function makeSalesLitePorts({customerCore,readOrder,readReport,readSubscription}={}){
 return Object.freeze({
  async customerPreview({ctx,envelope}){
   verifiedContext(ctx,'CUSTOMER');
   if(typeof customerCore?.preview!=='function')fail('CUSTOMER_CORE_NOT_CONNECTED');
   const r=await customerCore.preview(envelope);
   if(!r||r.productionReady!==false||r.ordersWritten!==0||r.externalSends!==0||
      r.mode!=='PREVIEW_ONLY')fail('CUSTOMER_CORE_SAFETY_GATE_FAILED');
   return Object.freeze({kind:'CUSTOMER_PREVIEW',status:r.status,replyCandidate:r.replyCandidate||null,
      externalSends:0,ordersWritten:0,outboxWrites:0});
  },
  async customerOwnOrder({ctx,customerProof,orderId}){
   verifiedContext(ctx,'CUSTOMER');
   if(!customerProof||customerProof.source!=='SERVER_VERIFIED_CUSTOMER'||
      customerProof.actorKey!==ctx.scopeKey||!safeKey(orderId))fail('CUSTOMER_ORDER_IDENTITY_REQUIRED');
   if(typeof readOrder!=='function')fail('ORDER_READ_PORT_NOT_CONNECTED');
   const row=await readOrder({tenantId:ctx.tenantId,storeId:ctx.storeId,botId:ctx.botId,
     actorKey:ctx.scopeKey,orderId});
   if(!safeScope(row,ctx)||row.customerKey!==ctx.scopeKey||row.orderId!==orderId)
     fail('CUSTOMER_ORDER_SCOPE_DENIED');
   return Object.freeze({status:'READ_ONLY_OWN_ORDER',orderId,statusLabel:row.status,
     externalSends:0,ordersWritten:0});
  },
  async ownerReport({ctx}){
   verifiedContext(ctx,'OWNER');
   if(!ctx.permissions?.includes('reports:read_shop'))fail('OWNER_REPORT_PERMISSION_DENIED');
   if(typeof readReport!=='function')fail('REPORT_READ_PORT_NOT_CONNECTED');
   const r=await readReport({tenantId:ctx.tenantId,storeId:ctx.storeId,botId:ctx.botId});
   if(!safeScope(r,ctx)||!['requestCount','pendingOwnerCount','acceptedCount',
     'completedCount','paidRevenueVnd'].every(k=>Number.isSafeInteger(r[k])&&r[k]>=0))
     fail('OWNER_REPORT_UNVERIFIED');
   return Object.freeze({status:'READ_ONLY_REPORT',requestCount:r.requestCount,
     pendingOwnerCount:r.pendingOwnerCount,acceptedCount:r.acceptedCount,
     completedCount:r.completedCount,paidRevenueVnd:r.paidRevenueVnd,
     revenueDefinition:'PAID_WITH_PAYMENT_EVIDENCE_ONLY',externalSends:0,ordersWritten:0});
  },
  async subscriptionView({ctx}){
   if(!ctx||ctx.source!=='BACKEND_AUTHENTICATED_CONTEXT'||ctx.isVerified!==true||
      !safeKey(ctx.tenantId)||!safeKey(ctx.storeId))fail('SUBSCRIPTION_ACCOUNT_REQUIRED');
   if(typeof readSubscription!=='function')fail('SUBSCRIPTION_READ_PORT_NOT_CONNECTED');
   const r=await readSubscription({tenantId:ctx.tenantId,storeId:ctx.storeId});
   if(!r||r.verified!==true||r.tenantId!==ctx.tenantId||r.storeId!==ctx.storeId||
       !['ACTIVE','EXPIRED','SUSPENDED','PENDING'].includes(r.status)||
       typeof r.expiresAt!=='string'||!Number.isFinite(Date.parse(r.expiresAt)))
      fail('SUBSCRIPTION_READBACK_UNVERIFIED');
   return Object.freeze({status:'READ_ONLY_SUBSCRIPTION',subscriptionStatus:r.status,
     expiresAt:r.expiresAt,paymentProof:null,renewalApplied:false,externalSends:0});
  }
 });
}
function proposeOrderTransition({ctx,order,requestedState,confirmation}){
 verifiedContext(ctx,'OWNER');
 if(!ctx.permissions?.includes('orders:approve')&&!ctx.permissions?.includes('orders:reject'))
    fail('OWNER_APPROVAL_PERMISSION_DENIED');
 if(!safeScope(order,ctx)||!safeKey(order.orderId)||!STATES.includes(order.status)||
    !STATES.includes(requestedState))fail('ORDER_STATE_UNVERIFIED');
 if(!FLOW[order.status].includes(requestedState))fail('ORDER_TRANSITION_INVALID');
 if(requestedState==='ACCEPTED'&&!ctx.permissions.includes('orders:approve'))fail('OWNER_APPROVAL_PERMISSION_DENIED');
 if(requestedState==='REJECTED'&&!ctx.permissions.includes('orders:reject'))fail('OWNER_REJECT_PERMISSION_DENIED');
 if(requestedState==='PAID')fail('PAYMENT_EVIDENCE_REQUIRED');
 if(!confirmation||confirmation.verified!==true||
    confirmation.orderId!==order.orderId||confirmation.requestedState!==requestedState||
    !safeKey(confirmation.nonce)||confirmation.idempotencyVerified!==true)
    return Object.freeze({status:'CONFIRMATION_REQUIRED',orderId:order.orderId,requestedState,
      stateChanged:false,ordersWritten:0,externalSends:0});
 return Object.freeze({status:'SERVER_COMMIT_REQUIRED',orderId:order.orderId,
   expectedState:order.status,requestedState,confirmationNonceRef:'REDACTED',
   stateChanged:false,ordersWritten:0,externalSends:0});
}
function prepareHeldNotification({context,persisted,ownerBinding,channel='ZALO_BOT'}){
 // A candidate is NOT an actual outbox record. The existing Notification Engine
 // must write the outbox transactionally AFTER verified order save.
 if(!context||!safeKey(context.tenantId)||!safeKey(context.storeId)||
    !safeKey(context.botId)||!persisted?.dbCommitted||
    !safeScope(persisted,context)||!safeKey(persisted.orderId)||
    persisted.status!=='PENDING_OWNER')fail('ORDER_NOT_PERSISTED');
 if(!ownerBinding||ownerBinding.verified!==true||!safeScope(ownerBinding,context)||
    ownerBinding.status!=='paired'||ownerBinding.expiresAt===undefined||
    Date.parse(ownerBinding.expiresAt)<=Date.now()||!safeKey(ownerBinding.ownerBindingId))
    fail('OWNER_BINDING_NOT_VERIFIED');
 if(channel!=='ZALO_BOT')fail('CHANNEL_NOT_APPROVED');
 const key=createHash('sha256').update([context.tenantId,context.storeId,
   persisted.orderId,ownerBinding.ownerBindingId,'ORDER_PENDING_OWNER'].join(':')).digest('hex');
 return Object.freeze({status:'OUTBOX_CANDIDATE_ONLY',event_type:'ORDER_PENDING_OWNER',
   order_id:persisted.orderId,tenant_id:context.tenantId,store_id:context.storeId,
   owner_binding_id:ownerBinding.ownerBindingId,channel,idempotency_key:key,
   delivery_state:'SEND_DISABLED',outboxWritten:false,providerAccepted:false,
   delivered:false,externalSends:0,ordersWritten:0});
}
function makeSupportTicketCandidate({ctx,issueCode}){
 if(!ctx||ctx.source!=='BACKEND_AUTHENTICATED_CONTEXT'||ctx.isVerified!==true||
    !safeKey(ctx.tenantId)||!safeKey(ctx.storeId)||
    !['BOT_CONNECTIVITY','ORDER_QUESTION','SUBSCRIPTION_QUESTION'].includes(issueCode))
   fail('SUPPORT_CONTEXT_INVALID');
 return Object.freeze({status:'SUPPORT_TICKET_DRAFT_ONLY',issueCode,
  submitted:false,ticketId:null,externalSends:0,ordersWritten:0});
}
module.exports={STATES,FLOW,makeSalesLitePorts,proposeOrderTransition,
 prepareHeldNotification,makeSupportTicketCandidate};
