'use strict';
/**
 * TIEN404 RPC10-G0.4 — TRUSTED STORE RESOLVER × READ-ONLY COMMERCE ADAPTER.
 *
 * CANDIDATE / NO NETWORK / NO SEND / NO DB / NO REAL ORDERS.
 * All privileged capabilities are injected by a trusted *future* server;
 * this module DOES NOT itself authenticate provider signatures, actual Store
 * ownership, RLS or JWT. Synthetic verifiers in tests are NOT real evidence.
 *
 * Customer-visible SKU/qty are hints. Neither incoming JSON nor any LLM
 * text may supply tenantId/storeId, unit price or inventory authority.
 */
const crypto=require('node:crypto');
const CONTRACT='T404_RPC10_G04_TRUSTED_STORE_COMMERCE_READONLY_V1';
const PROVIDERS=new Set(['MESSENGER','ZALO_OA','ZALO_BOT','WEBSITE']);
const ACTIONS=new Set(['CATALOG_LOOKUP','CART_PREVIEW']);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HASH=/^[0-9a-f]{64}$/;
const SKU=/^[A-Z0-9][A-Z0-9_.-]{1,39}$/;
const SAFE_ID=/^[A-Za-z0-9_-]{3,96}$/;
const EVENT_TTL_MS=5*60*1000;
const MAX_RAW_BYTES=131072;
const fail=code=>{throw Error(code)};
const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const exact=(v,keys)=>plain(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const goodId=v=>typeof v==='string'&&SAFE_ID.test(v);
const goodUUID=v=>typeof v==='string'&&UUID.test(v);
const safeClock=t=>Number.isSafeInteger(t)&&t>0;
const safeMoney=n=>Number.isSafeInteger(n)&&n>=0&&n<=1000000000000;
const safeStock=n=>Number.isSafeInteger(n)&&n>=0&&n<=1000000000;
const safeRevision=n=>Number.isSafeInteger(n)&&n>0;
const freeze=o=>Object.freeze(o);

function createNoSendCommerceAdapter({verifyInbound,readInstallationBinding,
 authorizeStoreRead,readCatalogSnapshot,clock=()=>Date.now()}={}){
 if(![verifyInbound,readInstallationBinding,authorizeStoreRead,
      readCatalogSnapshot,clock].every(f=>typeof f==='function'))
  fail('SERVER_INJECTED_DEPENDENCIES_REQUIRED');
 const completed=new Map(),inflight=new Set();
 function now(){
  const value=clock();
  if(!safeClock(value))fail('INVALID_CLOCK');
  return value;
 }
 function receipt(status,fields={}){
  return freeze({
   contract:CONTRACT,mode:'SOURCE_ONLY_NO_SEND',status,...fields,
   providerSends:0,orderWrites:0,stockWrites:0,realModelCalls:0,hostedWrites:0,
   canPublish:false,canCreateOrder:false,canMutateStock:false,canUseRealCredentials:false,
   actualProviderSignatureVerifiedHere:false,actualStoreOwnerVerifiedHere:false,
   actualJwtVerifiedHere:false,actualRlsVerifiedHere:false,durableReplayProtection:false
  });
 }
 function validateRequest(req){
  if(!exact(req,['rawBody','headers','action','sku','quantity'])||
    !Buffer.isBuffer(req.rawBody)||req.rawBody.length<1||
    req.rawBody.length>MAX_RAW_BYTES||!plain(req.headers)||
    Object.keys(req.headers).length>24||!ACTIONS.has(req.action)||
    typeof req.sku!=='string'||!SKU.test(req.sku)||
    !Number.isSafeInteger(req.quantity)||
    (req.action==='CATALOG_LOOKUP'&&req.quantity!==1)||
    (req.action==='CART_PREVIEW'&&(req.quantity<1||req.quantity>50)))
    fail('UNTRUSTED_REQUEST_OR_SCOPE_CLAIM');
 }
 function validateEvent(e,t){
  const fields=['source','verified','provider','accountId','eventId','subjectHash','occurredAtMs'];
  if(!exact(e,fields)||e.source!=='SERVER_ATTESTED_PROVIDER_EVENT'||
    e.verified!==true||!PROVIDERS.has(e.provider)||!goodId(e.accountId)||
    !goodId(e.eventId)||typeof e.subjectHash!=='string'||!HASH.test(e.subjectHash)||
    !safeClock(e.occurredAtMs)||Math.abs(t-e.occurredAtMs)>EVENT_TTL_MS)
    fail('ATTESTED_INBOUND_REQUIRED');
 }
 function validateBinding(b,e,t){
  const keys=['source','verified','provider','accountId','tenantId','storeId',
    'botProfileVersion','registryVersion','status','expiresAtMs',
    'independentOwnerAuthorityClaimed','canonicalTenantAndStore'];
  if(!exact(b,keys)||b.source!=='PRIVATE_SERVER_INSTALLATION_REGISTRY'||
    b.verified!==true||b.provider!==e.provider||b.accountId!==e.accountId||
    !goodUUID(b.tenantId)||!goodUUID(b.storeId)||!goodId(b.botProfileVersion)||
    !safeRevision(b.registryVersion)||b.status!=='ACTIVE'||
    !safeClock(b.expiresAtMs)||b.expiresAtMs<=t||
    b.independentOwnerAuthorityClaimed!==true||
    b.canonicalTenantAndStore!==true)
   fail('INSTALLATION_STORE_BINDING_DENIED');
 }
 function validatePolicy(p,b,action){
  const keys=['source','verified','tenantId','storeId','botProfileVersion','registryVersion',
    'storeActive','subscriptionActive','merchantAuthorityActive',
    'allowedActions','priceMode','policyVersion'];
  if(!exact(p,keys)||p.source!=='SERVER_STORE_POLICY_READBACK'||
    p.verified!==true||p.tenantId!==b.tenantId||p.storeId!==b.storeId||
    p.botProfileVersion!==b.botProfileVersion||
    p.registryVersion!==b.registryVersion||
    p.storeActive!==true||p.subscriptionActive!==true||
    p.merchantAuthorityActive!==true||!goodId(p.policyVersion)||
    !Array.isArray(p.allowedActions)||p.allowedActions.length<1||
    p.allowedActions.length>2||!p.allowedActions.every(a=>ACTIONS.has(a))||
    new Set(p.allowedActions).size!==p.allowedActions.length||
    !p.allowedActions.includes(action)||p.priceMode!=='RETAIL_ONLY')
   fail('STORE_READ_POLICY_DENIED');
 }
 function validateCatalog(c,b){
  if(!exact(c,['source','verified','scope','tenantId','storeId',
     'registryVersion','revision','products'])||
    c.source!=='STORE_SCOPED_CATALOG_READBACK'||c.verified!==true||
    c.scope!=='TENANT_AND_STORE'||c.tenantId!==b.tenantId||
    c.storeId!==b.storeId||c.registryVersion!==b.registryVersion||
    !safeRevision(c.revision)||!Array.isArray(c.products)||c.products.length>100)
   fail('STORE_SCOPED_CATALOG_DENIED');
  const itemIds=new Set(),skus=new Set();
  for(const item of c.products){
   if(!exact(item,['source','tenantId','storeId','itemId','sku','name',
      'priceVnd','stock','active'])||item.source!=='SERVER_VERIFIED_STORE_PRODUCT'||
      item.tenantId!==b.tenantId||item.storeId!==b.storeId||
      !goodId(item.itemId)||!SKU.test(item.sku)||
      typeof item.name!=='string'||item.name.length<1||item.name.length>90||
      /[\u0000-\u001f\u007f]/.test(item.name)||
      !safeMoney(item.priceVnd)||!safeStock(item.stock)||
      typeof item.active!=='boolean'||itemIds.has(item.itemId)||skus.has(item.sku))
    fail('PRODUCT_PRICE_STOCK_OR_STORE_SCOPE_INVALID');
   itemIds.add(item.itemId);skus.add(item.sku);
  }
 }
 function gc(t){
  for(const [k,time] of completed)if(t-time>EVENT_TTL_MS)completed.delete(k);
  // Without shared, durable storage this cannot be used as production replay proof.
  if(completed.size>10000)completed.clear();
 }
 async function run(req){
  validateRequest(req);
  const t=now();
  // The injected signature verifier MUST use raw bytes and actual provider
  // credentials server-side; no token, session or Store ID is read here.
  const e=await verifyInbound({rawBody:req.rawBody,headers:req.headers});
  validateEvent(e,t);
  const replayKey=crypto.createHash('sha256').update(
   [e.provider,e.accountId,e.eventId].join('|')).digest('hex');
  gc(t);
  if(completed.has(replayKey)||inflight.has(replayKey))
   return receipt('DUPLICATE_EVENT_IGNORED');
  inflight.add(replayKey);
  try{
   const b=await readInstallationBinding({provider:e.provider,accountId:e.accountId});
   validateBinding(b,e,now());
   const scope={tenantId:b.tenantId,storeId:b.storeId,
    botProfileVersion:b.botProfileVersion,registryVersion:b.registryVersion};
   const policy=await authorizeStoreRead({...scope,action:req.action});
   validatePolicy(policy,b,req.action);
   const c=await readCatalogSnapshot({...scope,action:req.action});
   validateCatalog(c,b);
   // Recheck before returning a customer-visible answer. This reduces, but
   // cannot eliminate, TOCTOU; hosted RLS/JWT is required for real release.
   const current=await readInstallationBinding({provider:e.provider,accountId:e.accountId});
   validateBinding(current,e,now());
   if(current.tenantId!==b.tenantId||current.storeId!==b.storeId||
      current.registryVersion!==b.registryVersion||
      current.botProfileVersion!==b.botProfileVersion)
    fail('INSTALLATION_CHANGED_DURING_READ');
   const updated=await authorizeStoreRead({...scope,action:req.action});
   validatePolicy(updated,b,req.action);
   if(updated.policyVersion!==policy.policyVersion)
    fail('STORE_POLICY_CHANGED_DURING_READ');
   const item=c.products.find(p=>p.sku===req.sku&&p.active);
   let result;
   if(!item){result=receipt('SKU_NOT_FOUND_IN_AUTHORIZED_STORE',{sku:req.sku});}
   else if(req.action==='CATALOG_LOOKUP'){
    result=receipt('STORE_CATALOG_MATCH',{sku:item.sku,name:item.name,
     unitPriceVnd:item.priceVnd,availability:item.stock>0?'AVAILABLE':'OUT_OF_STOCK',
     needsCustomerConfirmation:true});
   }else if(item.stock<req.quantity){
    result=receipt('INSUFFICIENT_STORE_STOCK',{sku:item.sku,
     needsReconfirmQuantity:true,canCreateOrder:false});
   }else{
    const total=item.priceVnd*req.quantity;
    if(!Number.isSafeInteger(total))fail('VND_TOTAL_OVERFLOW');
    result=receipt('STORE_CART_PREVIEW_REQUIRES_CONFIRMATION',{
     sku:item.sku,name:item.name,quantity:req.quantity,
     unitPriceVnd:item.priceVnd,totalVnd:total,
     catalogRevision:c.revision,needsCustomerConfirmation:true,
     needsTrustedServerRepricingAtOrderCommit:true});
   }
   completed.set(replayKey,now());
   return result;
  }finally{inflight.delete(replayKey);}
 }
 function stats(){return freeze({contract:CONTRACT,mode:'EPHEMERAL_TEST_ONLY',
  completedKeys:completed.size,inflightKeys:inflight.size,
  durableReplayProtection:false,providerSends:0,orderWrites:0,hostedWrites:0});}
 function createOrder(){fail('REAL_ORDER_WRITE_DISABLED');}
 function sendMessage(){fail('PROVIDER_SEND_DISABLED');}
 return freeze({run,stats,createOrder,sendMessage});
}
module.exports=freeze({CONTRACT,PROVIDERS,ACTIONS,createNoSendCommerceAdapter});
