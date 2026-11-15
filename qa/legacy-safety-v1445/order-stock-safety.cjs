'use strict';
/**
 * TIEN404 V14.4.5 — stock, order request and paid-revenue safety GATE.
 * This is an offline deterministic READ-ONLY contract evaluator.
 * No order creation, no stock reservation, no payment settlement and no
 * provider message send. All positive results still require a DB transaction.
 */
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const MAX_PRICE=1_000_000_000_000;
const MAX_TOTAL=1_000_000_000_000_000;
const MAX_QTY=10000;
const ERRORS=Object.freeze({
 MODE:'OFFLINE_SAFETY_ONLY',AUTH:'TRUSTED_STORE_SCOPE_REQUIRED',
 INPUT:'ORDER_INPUT_INVALID',SNAPSHOT:'CATALOG_SNAPSHOT_UNVERIFIED',
 STALE:'PRICE_OR_STOCK_SNAPSHOT_EXPIRED',SKU:'UNKNOWN_OR_DUPLICATE_STORE_SKU',
 STOCK:'INSUFFICIENT_SNAPSHOT_STOCK',TOTAL:'EXPECTED_TOTAL_MISMATCH',
 OVERFLOW:'VND_TOTAL_OVERFLOW',ORDER:'ORDER_SCOPE_OR_TOTAL_INVALID',
 DUPLICATE:'DUPLICATE_ORDER_ID_IN_REPORT',STATUS:'ORDER_STATUS_NOT_ELIGIBLE',
 MUTATION:'STOCK_MUTATION_REQUIRES_SEPARATE_AUTHORIZED_LEDGER'
});
function fail(code){let e=new Error(code);e.code=code;throw e;}
function integer(x,max){return typeof x==='number'&&Number.isSafeInteger(x)&&x>=0&&x<=max;}
function uuid(x){return typeof x==='string'&&UUID.test(x);}
function createSafetyAudit({mode,ports,now=()=>Date.now()}={}){
 if(mode!=='OFFLINE_SYNTHETIC_QA'||ports?.mode!=='OFFLINE_VERIFIED_CATALOG'||
   typeof ports.resolveStoreScope!=='function'||
   typeof ports.readStoreCatalogSnapshot!=='function'||
   typeof now!=='function')fail(ERRORS.MODE);
 async function scope(bearer,storeId){
  if(!uuid(storeId))fail(ERRORS.INPUT);
  const x=await ports.resolveStoreScope({bearer,storeId});
  if(!x||x.source!=='SYNTHETIC_AUTH_SERVER'||
    x.storeId!==storeId||!uuid(x.tenantId)||
    x.active!==true||x.subscriptionActive!==true||
    x.canViewCatalog!==true)fail(ERRORS.AUTH);
  return x;
 }
 async function snapshot(scoped){
  const x=await ports.readStoreCatalogSnapshot({
   tenantId:scoped.tenantId,storeId:scoped.storeId});
  if(!x||x.source!=='SYNTHETIC_SCOPED_CATALOG'||
    x.tenantId!==scoped.tenantId||x.storeId!==scoped.storeId||
    !Number.isSafeInteger(x.priceVersion)||x.priceVersion<1||
    !Number.isSafeInteger(x.stockVersion)||x.stockVersion<1||
    !Array.isArray(x.products))fail(ERRORS.SNAPSHOT);
  if(!Number.isSafeInteger(x.expiresAt)||x.expiresAt<=now())
    fail(ERRORS.STALE);
  return x;
 }
 async function previewOrder({bearer,body}={}){
  const allowed=['storeId','lines','expectedTotalVnd','customerConfirmed','requestId'];
  if(!body||typeof body!=='object'||Array.isArray(body)||
   Object.keys(body).some(k=>!allowed.includes(k))||
   !Array.isArray(body.lines)||body.lines.length<1||body.lines.length>25||
   typeof body.customerConfirmed!=='boolean'||
   !integer(body.expectedTotalVnd,MAX_TOTAL)||
   typeof body.requestId!=='string'||!/^[A-Za-z0-9_-]{12,80}$/.test(body.requestId))
   fail(ERRORS.INPUT);
  const auth=await scope(bearer,body.storeId),cat=await snapshot(auth);
  const seen=new Set();
  let total=0n;
  for(const line of body.lines){
   if(!line||typeof line!=='object'||Array.isArray(line)||
    Object.keys(line).sort().join(',')!=='quantity,sku'||
    typeof line.sku!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(line.sku)||
    !Number.isInteger(line.quantity)||line.quantity<1||line.quantity>MAX_QTY)
    fail(ERRORS.INPUT);
   if(seen.has(line.sku))fail(ERRORS.SKU);seen.add(line.sku);
   const matches=cat.products.filter(p=>p.sku===line.sku&&p.isActive===true);
   if(matches.length!==1)fail(ERRORS.SKU);
   const p=matches[0];
   if(!integer(p.priceVnd,MAX_PRICE)||!integer(p.stockOnHand,2147483647))
    fail(ERRORS.SNAPSHOT);
   if(p.stockOnHand<line.quantity)fail(ERRORS.STOCK);
   total+=BigInt(p.priceVnd)*BigInt(line.quantity);
   if(total>BigInt(MAX_TOTAL)||total>BigInt(Number.MAX_SAFE_INTEGER))fail(ERRORS.OVERFLOW);
  }
  if(Number(total)!==body.expectedTotalVnd)fail(ERRORS.TOTAL);
  return Object.freeze({
   status:body.customerConfirmed?
    'CONFIRMED_PREVIEW_REQUIRES_ATOMIC_ORDER_COMMIT':'AWAITING_CUSTOMER_CONFIRMATION',
   storeScopeVerifiedBySyntheticPort:true,
   expectedTotalVnd:Number(total),
   priceVersion:cat.priceVersion,stockVersion:cat.stockVersion,
   stockSnapshotExpiresAt:cat.expiresAt,quantityChecked:true,
   willCreateOrder:false,willReserveStock:false,willDeductStock:false,
   willEmitOwnerNotification:false,hasAtomicOrderIdempotency:false,
   requiresFreshReadAtCommit:true,hostedWrites:0
  });
 }
 function reviewStockEvent(event={}){
  const statuses=new Set(['pending','confirmed','paid','cancelled','refunded']);
  if(event.source!=='TRUSTED_ORDER_WORKFLOW_MOCK'||
    !uuid(event.storeId)||!uuid(event.orderId)||
    !statuses.has(event.status)||!['preview','commit','release','deduct'].includes(event.action))
    fail(ERRORS.INPUT);
  if(event.action==='preview'&&event.status==='pending'&&event.stockDelta===0)
   return Object.freeze({status:'PENDING_PREVIEW_NO_STOCK_EFFECT',
      stockDelta:0,reservationsChanged:0,hostedWrites:0});
  // Stock authorization, reservations, concurrency and release policies
  // do NOT exist in the production Store ledger yet; require a new gate.
  fail(ERRORS.MUTATION);
 }
 function reviewPaidRevenue({storeId,orders}={}){
  if(!uuid(storeId)||!Array.isArray(orders)||orders.length>1000)
   fail(ERRORS.INPUT);
  let paid=0n,paidCount=0;
  const seen=new Set();
  for(const o of orders){
   if(!o||!uuid(o.orderId)||o.storeId!==storeId||
    !['pending','confirmed','paid','cancelled','refunded'].includes(o.status)||
    !integer(o.totalVnd,MAX_TOTAL))fail(ERRORS.ORDER);
   if(seen.has(o.orderId))fail(ERRORS.DUPLICATE);
   seen.add(o.orderId);
   if(o.status==='paid'){
    paid+=BigInt(o.totalVnd);paidCount++;
    if(paid>BigInt(MAX_TOTAL)||paid>BigInt(Number.MAX_SAFE_INTEGER))
     fail(ERRORS.OVERFLOW);
   }
  }
  return Object.freeze({source:'OFFLINE_SYNTHETIC_REVENUE_QA',
   totalPaidVnd:Number(paid),paidCount,
   orderCount:orders.length,includesPending:false,
   includesCancelled:false,includesRefunded:false,
   hostedReads:0,hostedWrites:0,realAccountingVerified:false});
 }
 return Object.freeze({
  previewOrder,reviewStockEvent,reviewPaidRevenue,
  inspect:()=>Object.freeze({mode:'OFFLINE_SYNTHETIC_QA',
   hostedWrites:0,canAppendOrder:false,canAdjustStock:false,
   canSettlePayment:false,canSendNotification:false,canPublish:false})
 });
}
module.exports={createSafetyAudit,ERRORS};
