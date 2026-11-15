'use strict';
// V13.3 NO-SEND integration boundary. Ports MUST be instantiated on a trusted backend.
// This does not connect any live webhook, database, Customer Core or Owner Core.
const {createMenuEngine}=require('../v131/menu-engine.cjs');
const {makeSalesLitePorts}=require('../v131/business-contracts.cjs');
const fail=c=>{const e=new Error(c);e.code=c;throw e;};
function checkPort(x,label){if(typeof x!=='function')fail(label+'_PORT_MISSING');}
function createNoSendCoreBridge({resolveVerifiedIngress,readCatalog,readOwnerInbox,readOwnerReport,customerCore,clock=Date.now}={}){
 checkPort(resolveVerifiedIngress,'TRUSTED_INGRESS');
 const resolved=new WeakMap();
 async function trusted(event){
  // A raw event object alone has no authority; the service must authenticate webhook and binding.
  const scope=await resolveVerifiedIngress(event);
  if(!scope||scope.source!=='BACKEND_AUTHENTICATED_CONTEXT'||scope.isVerified!==true||
     !scope.providerVerified||!scope.botBindingVerified||!scope.membershipVerified||
     !Number.isFinite(scope.sessionExpiresAt)||scope.sessionExpiresAt<=clock())fail('INGRESS_TRUST_DENIED');
  // Only return a frozen server-produced identity. No request role or tenant is consulted here.
  const ctx=Object.freeze({...scope,permissions:Object.freeze([...scope.permissions||[]])});
  resolved.set(event,ctx);return ctx;
 }
 function scopedRead(port,kind){
  return async req=>{
   checkPort(port,kind);
   const data=await port(Object.freeze({...req}));
   if(!data||data.verified!==true||data.tenantId!==req.tenantId||
      data.storeId!==req.storeId||data.botId!==req.botId)fail('CORE_READ_SCOPE_DENIED');
   return data;
  };
 }
 const catalogue=scopedRead(readCatalog,'CATALOG_READ'),inbox=scopedRead(readOwnerInbox,'OWNER_INBOX'),report=scopedRead(readOwnerReport,'OWNER_REPORT');
 const engine=createMenuEngine({resolveContext:trusted,clock,readPorts:{
  CUS_CATALOG:catalogue,CUS_PRICE:catalogue,OWN_NEW_ORDERS:inbox,OWN_REPORT:report
 }});
 const salesPorts=makeSalesLitePorts({customerCore});
 async function route(event){
  if(!event||typeof event!=='object')fail('EVENT_INVALID');
  let result;
  try{result=await engine.handle(event);}catch(e){return Object.freeze({status:'TRUSTED_ROUTE_DENIED',code:e.code||'ROUTER_DENIED',externalSends:0,ordersWritten:0,productionReady:false});}
  return Object.freeze({...result,externalSends:0,ordersWritten:0,outboxWrites:0,productionReady:false});
 }
 async function customerPreview(event,envelope){
  try{
   const ctx=await trusted(event);
   return await salesPorts.customerPreview({ctx,envelope});
  }catch(e){return Object.freeze({status:'CUSTOMER_PREVIEW_DENIED',code:e.code||'PREVIEW_UNAVAILABLE',externalSends:0,ordersWritten:0,outboxWrites:0,productionReady:false});}
 }
 return Object.freeze({route,customerPreview,mode:'NO_SEND_NO_ORDER_QA',providerConnected:false,productionReady:false});
}
module.exports={createNoSendCoreBridge};
