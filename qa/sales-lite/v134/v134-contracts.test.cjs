'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createNoSendChannelBridge,CAPABILITIES}=require('./channel-core-bridge.cjs');
const {createOrderRequestProposal,proposeTransition,paidRevenueReadOnly}=require('./order-request-contract.cjs');
const NOW=Date.parse('2026-11-15T06:00:00Z');
const scope={tenantId:'tenant-A',storeId:'store-A',channel:'WEBSITE_CHAT'};
const event={message:'Giá F01?',tenant_id:'tenant-B',store_id:'store-B',role:'owner'};
const trusted={source:'SERVER_VERIFIED_INGRESS',verified:true,channel:'WEBSITE_CHAT',
 channelKey:'website-widget-001',providerEventId:'event-1001',customerRef:'customer-1001',
 expiresAt:NOW+3600000,text:'Cho mình hỏi áo F01 giá bao nhiêu?'};
function bridge(overrides={}){
 const ports={
 clock:()=>NOW,authenticateIngress:async()=>trusted,
 resolveChannelBinding:async x=>({source:'SERVER_VERIFIED_BINDING',active:true,...x,
   tenantId:'tenant-A',storeId:'store-A'}),
 readSubscription:async x=>({source:'SERVER_VERIFIED_SUBSCRIPTION',...x,state:'ACTIVE',
   expiresAt:new Date(NOW+86400000).toISOString(),channels:['WEBSITE_CHAT','MESSENGER','ZALO_BOT']}),
 readCatalog:async x=>({verified:true,...x,products:[{tenantId:x.tenantId,storeId:x.storeId,sku:'F01',name:'Áo đen',
   priceVnd:159000,stockOnHand:3}]}),
 customerPreview:async x=>({previewOnly:true,text:'F01: 159.000đ',externalSends:0,
   ordersWritten:0,outboxWrites:0}),
 ...overrides
 };return createNoSendChannelBridge(ports);
}
test('channels are independent and native Zalo buttons remain UNKNOWN',()=>{
 assert.equal(CAPABILITIES.ZALO_BOT.nativeButtons,'UNKNOWN');
 assert.equal(CAPABILITIES.WEBSITE_CHAT.nativeButtons,'WEB_OWNED');
 assert.equal(Object.keys(CAPABILITIES).length,4);
});
test('untrusted tenant and role in inbound message are ignored',async()=>{
 const x=await bridge().preview(event);
 assert.equal(x.status,'PREVIEW_READY');assert.equal(x.tenantId,'tenant-A');
 assert.equal(x.storeId,'store-A');assert.equal(x.externalSends,0);
 assert.equal(x.ordersWritten,0);assert.equal(x.productionReady,false);
});
test('auth failure closed',async()=>assert.equal((await bridge({authenticateIngress:async()=>null}).preview(event)).code,'UNAUTHENTICATED_INGRESS'));
test('raw forged authentication cannot bypass server port',async()=>assert.equal((await bridge({authenticateIngress:async()=>null}).preview({...event,verified:true,source:'SERVER_VERIFIED_INGRESS'})).status,'PREVIEW_DENIED'));
test('expired trusted ingress rejected',async()=>assert.equal((await bridge({authenticateIngress:async()=>({...trusted,expiresAt:NOW-1})}).preview(event)).code,'UNAUTHENTICATED_INGRESS'));
test('unknown provider rejected',async()=>assert.equal((await bridge({authenticateIngress:async()=>({...trusted,channel:'WHATSAPP'})}).preview(event)).code,'UNKNOWN_CHANNEL'));
test('inactive channel binding rejected',async()=>assert.equal((await bridge({resolveChannelBinding:async x=>({...x,source:'SERVER_VERIFIED_BINDING',active:false,tenantId:'tenant-A',storeId:'store-A'})}).preview(event)).code,'CHANNEL_BINDING_DENIED'));
test('channel binding key mismatch rejected',async()=>assert.equal((await bridge({resolveChannelBinding:async x=>({...x,channelKey:'other-key',source:'SERVER_VERIFIED_BINDING',active:true,tenantId:'tenant-A',storeId:'store-A'})}).preview(event)).code,'CHANNEL_BINDING_DENIED'));
test('missing subscription rejected',async()=>assert.equal((await bridge({readSubscription:async()=>null}).preview(event)).code,'SUBSCRIPTION_DENIED'));
test('expired subscription rejected',async()=>assert.equal((await bridge({readSubscription:async x=>({...x,source:'SERVER_VERIFIED_SUBSCRIPTION',state:'ACTIVE',expiresAt:new Date(NOW-1).toISOString()})}).preview(event)).code,'SUBSCRIPTION_DENIED'));
test('unknown subscription rejected',async()=>assert.equal((await bridge({readSubscription:async x=>({...x,source:'SERVER_VERIFIED_SUBSCRIPTION',state:'UNKNOWN',expiresAt:new Date(NOW+10000).toISOString()})}).preview(event)).code,'SUBSCRIPTION_DENIED'));
test('channel absent from entitlement rejected',async()=>assert.equal((await bridge({readSubscription:async x=>({...x,source:'SERVER_VERIFIED_SUBSCRIPTION',state:'ACTIVE',expiresAt:new Date(NOW+3600000).toISOString(),channels:['MESSENGER']})}).preview(event)).code,'SUBSCRIPTION_DENIED'));
test('cross shop catalog rejected',async()=>assert.equal((await bridge({readCatalog:async x=>({verified:true,tenantId:'tenant-B',storeId:x.storeId,products:[]})}).preview(event)).code,'CATALOG_SCOPE_DENIED'));
test('cross shop product row rejected',async()=>assert.equal((await bridge({readCatalog:async x=>({verified:true,...x,products:[{tenantId:'tenant-B',storeId:'store-B',sku:'F01',name:'Wrong shop',priceVnd:199000,stockOnHand:2}]})}).preview(event)).code,'CATALOG_INVALID'));
test('invalid negative VND price rejected',async()=>assert.equal((await bridge({readCatalog:async x=>({verified:true,...x,products:[{tenantId:x.tenantId,storeId:x.storeId,sku:'F01',name:'Wrong',priceVnd:-1,stockOnHand:5}]})}).preview(event)).code,'CATALOG_INVALID'));
test('unsafe core result fails closed',async()=>assert.equal((await bridge({customerPreview:async()=>({previewOnly:true,text:'OK',externalSends:1,ordersWritten:0,outboxWrites:0})}).preview(event)).code,'CORE_PREVIEW_INVALID'));
test('provider-specific Messenger uses same core',async()=>{
 let seen;const b=bridge({authenticateIngress:async()=>({...trusted,channel:'MESSENGER',channelKey:'page-001'}),
 customerPreview:async x=>{seen=x;return {previewOnly:true,text:'OK',externalSends:0,ordersWritten:0,outboxWrites:0};}});
 const x=await b.preview(event);assert.equal(x.status,'PREVIEW_READY');assert.equal(seen.scope.channel,'MESSENGER');
});
test('missing backend port raises before routing',()=>assert.throws(()=>createNoSendChannelBridge(),/PORT_NOT_CONNECTED/));
const snap={verified:true,tenantId:'tenant-A',storeId:'store-A',products:[
 {tenantId:'tenant-A',storeId:'store-A',sku:'F01',unitPriceVnd:159000,availableStock:3}]};
const args={scope,customer:{customerRef:'customer-1001'},items:[{sku:'F01',quantity:2}],
 priceSnapshot:snap,providerEventId:'event-1001'};
test('order proposal uses authoritative price and never writes',()=>{
 const x=createOrderRequestProposal({...args,items:[{sku:'F01',quantity:2,unitPriceVnd:1}]});
 assert.equal(x.status,'REQUEST_PROPOSAL');assert.equal(x.totalVnd,'318000');
 assert.equal(x.items[0].unitPriceVnd,159000);assert.equal(x.ordersWritten,0);
 assert.equal(x.requiresBackendRevalidation,true);assert.equal(x.requiresCustomerConfirmation,true);
});
test('same event id has same idempotency key',()=>assert.equal(createOrderRequestProposal(args).idempotencyKey,createOrderRequestProposal(args).idempotencyKey));
test('different shop changes idempotency key',()=>{
 const next={tenantId:'tenant-B',storeId:'store-B',channel:'WEBSITE_CHAT'};
 const alt={verified:true,...next,products:[{...snap.products[0],tenantId:'tenant-B',storeId:'store-B'}]};
 assert.notEqual(createOrderRequestProposal({...args,scope:next,priceSnapshot:alt}).idempotencyKey,
   createOrderRequestProposal(args).idempotencyKey);
});
test('cannot make order using other shop price snapshot',()=>assert.equal(createOrderRequestProposal({...args,scope:{tenantId:'tenant-B',storeId:'store-B',channel:'WEBSITE_CHAT'}}).code,'PRICE_SNAPSHOT_UNVERIFIED'));
test('insufficient stock rejected',()=>assert.equal(createOrderRequestProposal({...args,items:[{sku:'F01',quantity:9}]}).code,'STOCK_INSUFFICIENT'));
test('unknown SKU rejected',()=>assert.equal(createOrderRequestProposal({...args,items:[{sku:'NOT-HERE',quantity:1}]}).code,'SKU_UNAVAILABLE'));
test('duplicated SKU line rejected',()=>assert.equal(createOrderRequestProposal({...args,items:[{sku:'F01',quantity:1},{sku:'F01',quantity:1}]}).code,'BASKET_INVALID'));
test('negative or decimal quantity rejected',()=>assert.equal(createOrderRequestProposal({...args,items:[{sku:'F01',quantity:-1}]}).code,'BASKET_INVALID'));
test('non finite total rejected',()=>assert.equal(createOrderRequestProposal({...args,priceSnapshot:{...snap,products:[{...snap.products[0],unitPriceVnd:Number.MAX_SAFE_INTEGER}]},items:[{sku:'F01',quantity:2}]}).code,'TOTAL_INVALID'));
const originalOrder={serverVerified:true,id:'order-0001',tenantId:'tenant-A',storeId:'store-A',
 status:'PENDING_OWNER',version:2,paymentVerified:false};
const owner={serverVerified:true,tenantId:'tenant-A',storeId:'store-A',role:'owner',active:true};
test('verified owner can only propose transition',()=>{
 const x=proposeTransition({order:originalOrder,target:'CONFIRMED',actor:owner,expectedVersion:2});
 assert.equal(x.status,'TRANSITION_PROPOSAL');assert.equal(x.ordersWritten,0);assert.equal(x.productionReady,false);
});
test('customer cannot confirm order',()=>assert.equal(proposeTransition({order:originalOrder,target:'CONFIRMED',actor:{...owner,role:'customer'},expectedVersion:2}).code,'ACTOR_UNAUTHORIZED'));
test('owner of other shop cannot confirm',()=>assert.equal(proposeTransition({order:originalOrder,target:'CONFIRMED',actor:{...owner,tenantId:'tenant-B'},expectedVersion:2}).code,'ACTOR_UNAUTHORIZED'));
test('stale version blocked',()=>assert.equal(proposeTransition({order:originalOrder,target:'CONFIRMED',actor:owner,expectedVersion:1}).code,'ORDER_VERSION_OR_SCOPE_INVALID'));
test('pending request is not paid',()=>assert.equal(proposeTransition({order:originalOrder,target:'PAID',actor:owner,expectedVersion:2}).code,'TRANSITION_NOT_ALLOWED'));
test('paid requires verified payment',()=>assert.equal(proposeTransition({order:{...originalOrder,status:'FULFILLED'},target:'PAID',actor:owner,expectedVersion:2}).code,'PAYMENT_NOT_VERIFIED'));
test('paid transition proposal does not charge',()=>assert.equal(proposeTransition({order:{...originalOrder,status:'FULFILLED',paymentVerified:true},target:'PAID',actor:owner,expectedVersion:2}).ordersWritten,0));
test('cancelled orders are terminal',()=>assert.equal(proposeTransition({order:{...originalOrder,status:'CANCELLED'},target:'CONFIRMED',actor:owner,expectedVersion:2}).code,'TRANSITION_NOT_ALLOWED'));
test('revenue counts only backend verified paid orders',()=>{
 const orders=['PENDING_OWNER','CONFIRMED','FULFILLED','PAID','CANCELLED'].map((s,i)=>({
  serverVerified:true,tenantId:'tenant-A',storeId:'store-A',status:s,totalVnd:'159000',paymentVerified:i===3}));
 const v=paidRevenueReadOnly({scope,orders});assert.equal(v.paidTotalVnd,'159000');
 assert.equal(v.paidOrderCount,1);assert.equal(v.unpaidExcluded,true);
});
test('cross shop revenue is blocked entirely',()=>assert.equal(paidRevenueReadOnly({scope,orders:[{serverVerified:true,tenantId:'tenant-B',storeId:'store-B',status:'PAID',totalVnd:'199000',paymentVerified:true}]}).code,'REVENUE_SCOPE_OR_AMOUNT_INVALID'));
test('unverified payment excluded from paid revenue',()=>assert.equal(paidRevenueReadOnly({scope,orders:[{serverVerified:true,tenantId:'tenant-A',storeId:'store-A',status:'PAID',totalVnd:'159000',paymentVerified:false}]}).paidTotalVnd,'0'));
test('revenue rejects malformed money',()=>assert.equal(paidRevenueReadOnly({scope,orders:[{serverVerified:true,tenantId:'tenant-A',storeId:'store-A',status:'PAID',totalVnd:'159.000đ',paymentVerified:true}]}).code,'REVENUE_SCOPE_OR_AMOUNT_INVALID'));
