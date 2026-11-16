import {createHmac,timingSafeEqual} from 'node:crypto';
/**
 * V15-SECLOAD-01: PURE SYNTHETIC security and capacity laboratory.
 * No internet, no real Meta/Supabase/n8n, no production secrets.
 * It tests invariants and mock isolation; it is NOT a live security proof.
 */
const owners=new WeakSet();
const permits=new WeakSet();
const supportedChannel=new Set(['MESSENGER','ZALO','WEBSITE']);
const marker=/^[A-Za-z0-9-]{2,80}$/;
const eq=(a,b)=>typeof a==='string'&&typeof b==='string'&&a===b;
const clone=x=>structuredClone(x);
export function signSyntheticWebhook(raw, secret) {
 return 'sha256='+createHmac('sha256',secret).update(raw).digest('hex');
}
export function verifySyntheticWebhook(raw,signature,secret) {
 if(typeof raw!=='string'||!/^sha256=[0-9a-f]{64}$/i.test(signature||''))return false;
 const want=Buffer.from(signSyntheticWebhook(raw,secret),'utf8');
 const got=Buffer.from(signature,'utf8');
 return got.length===want.length&&timingSafeEqual(got,want);
}
export function createQACommerce({
  secret='QA_NON_PRODUCTION_SECRET_36_CHARS_2026',
  catalog={
   'TENANT-A|SHOP-A':[{sku:'A002',price:159000,stock:3}],
   'TENANT-A|SHOP-B':[{sku:'A002',price:259000,stock:2}],
   'TENANT-B|SHOP-C':[{sku:'A002',price:359000,stock:4}]
  },
  routes={
   'MESSENGER|PAGE-A':{tenant:'TENANT-A',store:'SHOP-A'},
   'MESSENGER|PAGE-B':{tenant:'TENANT-A',store:'SHOP-B'},
   'ZALO|OA-C':{tenant:'TENANT-B',store:'SHOP-C'},
   'WEBSITE|SITE-C':{tenant:'TENANT-B',store:'SHOP-C'}
  },
  time=()=>Date.now(),
  mockModelMs=0,
  rateLimit=10000,
  rateWindowMs=1000,
  failModel=false
}={}){
 const routeIndex=new Map(Object.entries(routes));
 const productIndex=new Map();
 for(const [key,rows] of Object.entries(catalog)){
  const store=new Map();
  for(const row of rows)store.set(row.sku,{...row});
  productIndex.set(key,store);
 }
 const replay=new Set(),sessions=new Map(),orders=new Map(),outbox=new Map(),windows=new Map();
 let modelCalls=0,providerSends=0,realOrderWrites=0,modelErrors=0;
 const getOwner=ctx=>owners.has(ctx)&&ctx._brand==='SERVER_ISSUED_QA';
 const getKey=ctx=>ctx.tenant+'|'+ctx.store;
 const safe=ctx=>getOwner(ctx)&&productIndex.has(getKey(ctx));
 function ingress({raw,signature}) {
  if(!verifySyntheticWebhook(raw,signature,secret))return {status:403,reason:'HMAC_INVALID'};
  let event;try{event=JSON.parse(raw)}catch{return{status:400,reason:'MALFORMED_JSON'}}
  if(!event||typeof event!=='object'||Array.isArray(event)||
    !supportedChannel.has(event.channel)||!marker.test(event.page||'')||
    !marker.test(event.sender||'')||!marker.test(event.messageId||''))
    return{status:400,reason:'INVALID_ENVELOPE'};
  const identity=routeIndex.get(event.channel+'|'+event.page);
  if(!identity)return{status:403,reason:'UNBOUND_PROVIDER_PAGE'};
  // Client-provided store/tenant/admin are deliberately ignored.
  const uid=event.channel+'|'+event.page+'|'+event.sender+'|'+event.messageId;
  if(replay.has(uid))return{status:409,reason:'REPLAY_REJECTED'};
  replay.add(uid);
  const key=identity.tenant+'|'+identity.store+'|'+event.sender;
  const range=windows.get(key)||{start:time(),count:0};
  if(time()-range.start>=rateWindowMs){range.start=time();range.count=0}
  range.count++;windows.set(key,range);
  if(range.count>rateLimit)return{status:429,reason:'RATE_LIMITED'};
  const ctx=Object.freeze({
   _brand:'SERVER_ISSUED_QA',tenant:identity.tenant,store:identity.store,
   sender:event.sender,channel:event.channel,page:event.page,
   messageId:event.messageId
  });
  owners.add(ctx);
  return{status:200,ctx,eventText:typeof event.text==='string'?event.text.slice(0,2000):''};
 }
 function quote(ctx,sku){
  if(!safe(ctx))return{status:403,reason:'UNTRUSTED_CONTEXT'};
  const p=productIndex.get(getKey(ctx)).get(sku);
  return p?{status:200,price:p.price,stock:p.stock,sku:p.sku,store:ctx.store}:
   {status:404,reason:'PRODUCT_NOT_FOUND'};
 }
 function issueOrderPermit(ctx,{sku,quantity,confirmed}){
  if(!safe(ctx)||confirmed!==true||!Number.isSafeInteger(quantity)||quantity<1||quantity>10)
   return null;
  const p=productIndex.get(getKey(ctx)).get(sku);
  if(!p)return null;
  const permit=Object.freeze({ctx,sku,quantity,expected:p.price*quantity});
  permits.add(permit);return permit;
 }
 function mockCreateOrder(ctx,permit,idempotencyKey){
  if(!safe(ctx)||!permits.has(permit)||permit.ctx!==ctx)return{status:403,reason:'NO_SERVER_APPROVAL'};
  if(!marker.test(idempotencyKey||''))return{status:400,reason:'BAD_IDEMPOTENCY'};
  const ref=getKey(ctx)+'|'+ctx.sender+'|'+idempotencyKey;
  if(orders.has(ref))return{status:200,replay:true,order:clone(orders.get(ref))};
  const p=productIndex.get(getKey(ctx)).get(permit.sku);
  if(!p||p.price*permit.quantity!==permit.expected)return{status:409,reason:'PRICE_CONFLICT'};
  if(p.stock<permit.quantity)return{status:409,reason:'STOCK_CONFLICT'};
  p.stock-=permit.quantity;
  const order={sku:permit.sku,quantity:permit.quantity,total:permit.expected,
    store:ctx.store,tenant:ctx.tenant,status:'pending'};
  orders.set(ref,order); // FAKE IN-MEMORY, no provider writes.
  outbox.set(ref,{event:'ORDER_PENDING',store:ctx.store,recipient:'OWNER_QA_ONLY'});
  return{status:201,replay:false,order:clone(order)};
 }
 function readOrder(ctx,idempotencyKey){
  if(!safe(ctx)||!marker.test(idempotencyKey||''))return{status:403};
  const key=getKey(ctx)+'|'+ctx.sender+'|'+idempotencyKey;
  const order=orders.get(key);return order?{status:200,order:clone(order)}:{status:404};
 }
 function history(ctx,text){
  if(!safe(ctx))return{status:403};
  const key=getKey(ctx)+'|'+ctx.sender;
  const h=sessions.get(key)||[];
  if(typeof text==='string')h.push(text.slice(0,100));
  sessions.set(key,h);
  return{status:200,history:clone(h)};
 }
 async function syntheticAgent(ctx,{delay=mockModelMs,forceFailure=failModel}={}){
  if(!safe(ctx))return{status:403,reason:'UNTRUSTED_CONTEXT'};
  if(forceFailure){modelErrors++;return{status:503,reason:'MODEL_UNAVAILABLE_HANDOFF'}}
  modelCalls++;
  if(delay>0)await new Promise(resolve=>setTimeout(resolve,delay));
  // No real AI call. This is a mock read-only response.
  return{status:200,text:'QA read-only response for '+ctx.store,
   calledOrderTool:false,calledProvider:false};
 }
 function stats(){return Object.freeze({
  modelCalls,providerSends,realOrderWrites,modelErrors,
  replaySeen:replay.size,syntheticOrders:orders.size,outboxEvents:outbox.size,
  syntheticSessions:sessions.size
 })}
 return Object.freeze({ingress,quote,issueOrderPermit,mockCreateOrder,
  readOrder,history,syntheticAgent,stats});
}
export function syntheticEvent({
  channel='MESSENGER',page='PAGE-A',sender='USER-A',
  messageId='QA-MID-01',text='xin chào',...untrusted
}={},secret='QA_NON_PRODUCTION_SECRET_36_CHARS_2026'){
 const raw=JSON.stringify({channel,page,sender,messageId,text,...untrusted});
 return {raw,signature:signSyntheticWebhook(raw,secret)};
}
