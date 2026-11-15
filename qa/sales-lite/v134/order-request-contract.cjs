'use strict';
// V13.4 pure proposal contract. Nothing here writes orders, changes stock or sends messages.
const crypto=require('node:crypto');
const STATES=Object.freeze(['REQUESTED','PENDING_OWNER','CONFIRMED','FULFILLED','PAID','CANCELLED']);
const TRANSITIONS=Object.freeze({
  REQUESTED:Object.freeze(['PENDING_OWNER','CANCELLED']),
  PENDING_OWNER:Object.freeze(['CONFIRMED','CANCELLED']),
  CONFIRMED:Object.freeze(['FULFILLED','CANCELLED']),
  FULFILLED:Object.freeze(['PAID']),
  PAID:Object.freeze([]),
  CANCELLED:Object.freeze([])
});
function deny(code){return Object.freeze({status:'DENIED',code,ordersWritten:0,outboxWrites:0,stockChanged:false});}
const id=x=>typeof x==='string'&&x.length>=4&&x.length<=160&&/^[a-zA-Z0-9:_-]+$/.test(x);
function createOrderRequestProposal({scope,customer,items,priceSnapshot,providerEventId}={}){
  if(!scope||!id(scope.tenantId)||!id(scope.storeId)||!id(scope.channel)||
     !id(providerEventId)||!customer||!id(customer.customerRef))return deny('IDENTITY_UNVERIFIED');
  if(!priceSnapshot||priceSnapshot.verified!==true||
     priceSnapshot.tenantId!==scope.tenantId||priceSnapshot.storeId!==scope.storeId||
     !Array.isArray(items)||items.length===0||items.length>30)return deny('PRICE_SNAPSHOT_UNVERIFIED');
  const bySku=new Map();
  for(const p of priceSnapshot.products||[]){
    if(!p||!id(p.sku)||p.tenantId!==scope.tenantId||p.storeId!==scope.storeId||
       !Number.isSafeInteger(p.unitPriceVnd)||p.unitPriceVnd<0||
       !Number.isInteger(p.availableStock)||p.availableStock<0)return deny('PRICE_SNAPSHOT_INVALID');
    if(bySku.has(p.sku))return deny('PRICE_SNAPSHOT_INVALID');
    bySku.set(p.sku,p);
  }
  const basket=[];
  let total=0;
  const seen=new Set();
  for(const line of items){
    if(!line||!id(line.sku)||!Number.isInteger(line.quantity)||line.quantity<1||
       line.quantity>10000||seen.has(line.sku))return deny('BASKET_INVALID');
    seen.add(line.sku);
    const product=bySku.get(line.sku);
    if(!product)return deny('SKU_UNAVAILABLE');
    if(product.availableStock<line.quantity)return deny('STOCK_INSUFFICIENT');
    const amount=product.unitPriceVnd*line.quantity;
    if(!Number.isSafeInteger(amount)||!Number.isSafeInteger(total+amount))return deny('TOTAL_INVALID');
    basket.push(Object.freeze({sku:line.sku,quantity:line.quantity,
      unitPriceVnd:product.unitPriceVnd,lineTotalVnd:amount}));
    total+=amount;
  }
  const key=crypto.createHash('sha256').update([
    scope.tenantId,scope.storeId,scope.channel,providerEventId
  ].join('|')).digest('hex');
  return Object.freeze({status:'REQUEST_PROPOSAL',tenantId:scope.tenantId,
    storeId:scope.storeId,channel:scope.channel,customerRef:customer.customerRef,
    idempotencyKey:key,items:Object.freeze(basket),totalVnd:String(total),
    initialOrderState:'REQUESTED',requiresCustomerConfirmation:true,
    requiresBackendRevalidation:true,ordersWritten:0,outboxWrites:0,
    stockChanged:false,productionReady:false});
}
function proposeTransition({order,target,actor,expectedVersion}={}){
  if(!order||order.serverVerified!==true||!id(order.tenantId)||!id(order.storeId)||
     !id(order.id)||!STATES.includes(order.status)||!STATES.includes(target)||
     !Number.isInteger(order.version)||order.version<0||
     order.version!==expectedVersion)return deny('ORDER_VERSION_OR_SCOPE_INVALID');
  if(!actor||actor.serverVerified!==true||actor.tenantId!==order.tenantId||
     actor.storeId!==order.storeId||!['owner','manager'].includes(actor.role)||
     actor.active!==true)return deny('ACTOR_UNAUTHORIZED');
  if(!TRANSITIONS[order.status].includes(target))return deny('TRANSITION_NOT_ALLOWED');
  if(target==='PAID'&&order.paymentVerified!==true)return deny('PAYMENT_NOT_VERIFIED');
  return Object.freeze({status:'TRANSITION_PROPOSAL',orderId:order.id,
    tenantId:order.tenantId,storeId:order.storeId,from:order.status,to:target,
    expectedVersion,requiresOwnerConfirmation:true,requiresBackendRevalidation:true,
    ordersWritten:0,outboxWrites:0,stockChanged:false,productionReady:false});
}
function paidRevenueReadOnly({scope,orders}={}){
  if(!scope||!id(scope.tenantId)||!id(scope.storeId)||!Array.isArray(orders))
    return deny('SCOPE_UNVERIFIED');
  let sum=0n,count=0;
  for(const order of orders){
    if(!order||order.serverVerified!==true||order.tenantId!==scope.tenantId||
       order.storeId!==scope.storeId||!STATES.includes(order.status)||
       (typeof order.totalVnd!=='string'&&!Number.isSafeInteger(order.totalVnd))||
       !/^\d{1,16}$/.test(String(order.totalVnd)))return deny('REVENUE_SCOPE_OR_AMOUNT_INVALID');
    if(order.status==='PAID'&&order.paymentVerified===true){
      sum+=BigInt(order.totalVnd);count++;
    }
  }
  return Object.freeze({status:'READ_ONLY_REVENUE',paidOrderCount:count,
    paidTotalVnd:String(sum),unpaidExcluded:true,ordersWritten:0,productionReady:false});
}
module.exports={createOrderRequestProposal,proposeTransition,paidRevenueReadOnly,STATES,TRANSITIONS};
