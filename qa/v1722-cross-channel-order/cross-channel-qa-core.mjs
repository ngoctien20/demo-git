/**
 * TIEN404 V17.22 — Messenger order -> Zalo Bot status, independent identity QA.
 * STRICT SOURCE-ONLY: fake provider HMAC fixtures and in-memory QA orders.
 * No Supabase/Sheets writes, no Meta/Zalo sends, no production credential or LLM.
 * Real Messenger HMAC / Zalo header MUST be validated by independent ingress.
 * A provider user ID, order ref, phone or link code alone NEVER grants order access.
 */
import {createHmac,createHash,timingSafeEqual,randomInt,randomUUID} from 'node:crypto';
export const CONTRACT='T404_V1722_CROSS_CHANNEL_ORDER_IDENTITY_QA_V1';
export const MODE='SYNTHETIC_LOCAL_NO_SEND_NO_COMMERCE_WRITES';
const KEY='QA_ONLY_NOT_PRODUCTION_HMAC_KEY_2026';
const REGISTRY=Object.freeze({
 'messenger:QA_PAGE_A':{tenant:'QA_TENANT_1',store:'QA_STORE_A',secret:'QA_HMAC_META_A_FAKE'},
 'messenger:QA_PAGE_B':{tenant:'QA_TENANT_1',store:'QA_STORE_B',secret:'QA_HMAC_META_B_FAKE'},
 'messenger:QA_PAGE_C':{tenant:'QA_TENANT_2',store:'QA_STORE_C',secret:'QA_HMAC_META_C_FAKE'},
 'zalo_bot:QA_BOT_A':{tenant:'QA_TENANT_1',store:'QA_STORE_A',secret:'QA_HEADER_ZALO_A_FAKE'},
 'zalo_bot:QA_BOT_B':{tenant:'QA_TENANT_1',store:'QA_STORE_B',secret:'QA_HEADER_ZALO_B_FAKE'},
 'zalo_bot:QA_BOT_C':{tenant:'QA_TENANT_2',store:'QA_STORE_C',secret:'QA_HEADER_ZALO_C_FAKE'}
});
const PRODUCTS=Object.freeze({
 QA_STORE_A:{QA_SKU_001:{name:'Sản phẩm QA A',price:159000,stock:10}},
 QA_STORE_B:{QA_SKU_001:{name:'Sản phẩm QA B',price:259000,stock:10}},
 QA_STORE_C:{QA_SKU_001:{name:'Sản phẩm QA C',price:309000,stock:10}}
});
const FIELDS=['event_id','channel','installation_ref','sender_ref','message_type','text','received_at'];
const ID=/^QA_[A-Z0-9_]{3,60}$/;
const fail=m=>{throw Error(m)};
const valid=o=>o!==null&&typeof o==='object'&&!Array.isArray(o)&&Object.getPrototypeOf(o)===Object.prototype;
const exact=(x,fields)=>valid(x)&&Object.keys(x).length===fields.length&&fields.every(k=>Object.hasOwn(x,k));
const mac=(key,text)=>createHmac('sha256',key).update(text,'utf8').digest('hex');
const equalHex=(a,b)=>typeof a==='string'&&/^[a-f0-9]{64}$/.test(a)&&
 timingSafeEqual(Buffer.from(a,'hex'),Buffer.from(b,'hex'));
const deny=()=>Object.freeze({status:'DENIED',message:'Không thể xác minh quyền truy cập hoặc mã yêu cầu.',provider_sends:0,commerce_writes:0,model_calls:0});
const out=(status,fields={})=>Object.freeze({status,...fields,provider_sends:0,commerce_writes:0,model_calls:0,
 fixture_only:true,production_order_created:false});
const actorHash=e=>mac(KEY,['actor',e.channel,e.installation_ref,e.sender_ref].join('|'));
const registry=e=>REGISTRY[e.channel+':'+e.installation_ref];
const eventShape=e=>exact(e,FIELDS)&&['messenger','zalo_bot'].includes(e.channel)&&
 ID.test(e.installation_ref)&&ID.test(e.sender_ref)&&ID.test(e.event_id)&&
 e.message_type==='text'&&typeof e.text==='string'&&e.text.length>0&&e.text.length<=400&&
 typeof e.received_at==='string'&&Number.isFinite(Date.parse(e.received_at));
export function qaEvent({channel='messenger',installation_ref='QA_PAGE_A',sender_ref='QA_OWNER_M_A',
 event_id='QA_EVENT_0001',text='QA_ORDER PREVIEW QA_SKU_001 1',
 received_at='2026-11-17T12:00:00.000Z'}={}){
 return {event_id,channel,installation_ref,sender_ref,message_type:'text',text,received_at};
}
export function signQaEnvelope(e){
 if(!eventShape(e)||!registry(e))fail('BAD_QA_EVENT');
 const rawBody=JSON.stringify(e);
 return Object.freeze({fixture_only:true,rawBody,
 signature:mac(registry(e).secret,rawBody)});
}
function verifyQaEnvelope(input,nowMs){
 if(!exact(input,['fixture_only','rawBody','signature'])||input.fixture_only!==true)
  fail('NATIVE_PROVIDER_AUTH_REQUIRED');
 if(typeof input.rawBody!=='string'||Buffer.byteLength(input.rawBody,'utf8')>1600)
  fail('BOUNDED_PROVIDER_BODY_REQUIRED');
 let e;try{e=JSON.parse(input.rawBody)}catch{fail('BAD_JSON')}
 if(!eventShape(e)||JSON.stringify(e)!==input.rawBody)fail('FORGED_OR_NONCANONICAL_EVENT');
 const i=registry(e);
 if(!i||!equalHex(input.signature,mac(i.secret,input.rawBody)))fail('PROVIDER_FIXTURE_SIGNATURE_DENIED');
 if(!Number.isSafeInteger(nowMs)||Math.abs(nowMs-Date.parse(e.received_at))>300000)
  fail('EVENT_TIMESTAMP_INVALID');
 return {event:e,install:i,actor:actorHash(e),digest:createHash('sha256').update(input.rawBody).digest('hex')};
}
function otpCode(generator){
 const n=generator();
 if(!Number.isSafeInteger(n)||n<100000||n>999999)fail('CRYPTO_OTP_REQUIRED');
 return String(n);
}
/** Test clock and OTP generator are injected ONLY in the local QA process. */
export function createCrossChannelQaLab({now=()=>Date.parse('2026-11-17T12:00:00.000Z'),
 code=()=>randomInt(100000,1000000)}={}){
 const previews=new Map(),orders=new Map(),challenges=new Map(),links=new Map(),
   replay=new Map(),actorFailures=new Map();
 let seq=0;
 const ref=(type)=>'QA-'+type+'-'+String(++seq).padStart(5,'0');
 function failActor(actor,time){
  const v=actorFailures.get(actor);
  if(!v||v.until<=time){actorFailures.set(actor,{count:1,until:time+300000});return false;}
  v.count++;return v.count>3;
 }
 function isBlocked(actor,time){
  const v=actorFailures.get(actor);return !!v&&v.until>time&&v.count>3;
 }
 function formatOrder(order){
  return out('ORDER_STATUS',{order_ref:order.id,status:order.status,sku:order.sku,
    quantity:order.qty,total_vnd:order.total,origin:'messenger',qa_only:true});
 }
 function status(ctx,orderId,fromZalo){
  const o=orders.get(orderId);
  if(!o||o.tenant!==ctx.install.tenant||o.store!==ctx.install.store)return deny();
  if(fromZalo){
    const link=links.get(ctx.actor);
    if(!link||link.messenger_actor!==o.owner||link.tenant!==o.tenant||link.store!==o.store)
      return deny();
  }else if(o.owner!==ctx.actor)return deny();
  return formatOrder(o);
 }
 function processMessenger(ctx,time){
  const t=ctx.event.text;
  let m;
  if((m=/^QA_ORDER PREVIEW (QA_SKU_[A-Z0-9_]+) ([1-9]\d?)$/.exec(t))){
   const product=PRODUCTS[ctx.install.store]?.[m[1]],qty=Number(m[2]);
   if(!product||qty>product.stock)return deny();
   const p={ref:ref('PREV'),owner:ctx.actor,store:ctx.install.store,
    tenant:ctx.install.tenant,sku:m[1],qty,price:product.price,total:product.price*qty,
    expires:time+120000,used:false};
   previews.set(p.ref,p);
   return out('PREVIEW_REQUIRED_CONFIRM',{preview_ref:p.ref,sku:p.sku,quantity:qty,
    expected_total_vnd:p.total,expires_in_seconds:120});
  }
  if((m=/^QA_ORDER CONFIRM (QA-PREV-\d{5})$/.exec(t))){
   const p=previews.get(m[1]);
   if(!p||p.owner!==ctx.actor||p.tenant!==ctx.install.tenant||
      p.store!==ctx.install.store||p.expires<time||p.used)return deny();
   const product=PRODUCTS[p.store]?.[p.sku];
   if(!product||product.price!==p.price||p.qty>product.stock)return deny();
   p.used=true;
   const id=ref('ORD'),o={id,owner:ctx.actor,tenant:p.tenant,store:p.store,
    sku:p.sku,qty:p.qty,price:p.price,total:p.total,status:'qa_pending',created:time};
   orders.set(id,o);
   return out('QA_ORDER_CREATED',{order_ref:id,status:o.status,total_vnd:o.total,
    message:'Đơn QA đã được lưu trong bộ nhớ thử nghiệm, KHÔNG phải đơn thương mại.'});
  }
  if((m=/^QA_ORDER STATUS (QA-ORD-\d{5})$/.exec(t)))return status(ctx,m[1],false);
  if((m=/^QA_LINK START (QA-ORD-\d{5})$/.exec(t))){
   const o=orders.get(m[1]);
   if(!o||o.owner!==ctx.actor||o.tenant!==ctx.install.tenant||o.store!==ctx.install.store)
     return deny();
   const c=otpCode(code),id=ref('LINK'),nonce=randomUUID();
   challenges.set(id,{id,nonce,owner:ctx.actor,tenant:o.tenant,store:o.store,
    codeHash:mac(KEY,nonce+':M:'+c),zaloHash:null,zaloActor:null,
    expires:time+300000,used:false,order_ref:o.id});
   return out('LINK_START_MESSENGER',{link_ref:id,messenger_code:c,expires_in_seconds:300,
    message:'Chỉ nhập mã này trong Zalo Bot QA của đúng cửa hàng. Không gửi cho người khác.'});
  }
  if((m=/^QA_LINK CONFIRM (QA-LINK-\d{5}) ([0-9]{6})$/.exec(t))){
   const challenge=challenges.get(m[1]);
   if(!challenge||challenge.owner!==ctx.actor||challenge.tenant!==ctx.install.tenant||
      challenge.store!==ctx.install.store||challenge.expires<time||
      challenge.used||!challenge.zaloActor||!challenge.zaloHash)return deny();
   if(!equalHex(challenge.zaloHash,mac(KEY,challenge.nonce+':Z:'+m[2]))){
     failActor(ctx.actor,time);return deny();
   }
   const existing=links.get(challenge.zaloActor);
   if(existing&&(existing.messenger_actor!==ctx.actor||
      existing.tenant!==ctx.install.tenant||existing.store!==ctx.install.store))return deny();
   links.set(challenge.zaloActor,{messenger_actor:ctx.actor,tenant:challenge.tenant,
    store:challenge.store,linked_at:time});
   challenge.used=true;challenge.codeHash=null;challenge.zaloHash=null;
   return out('LINK_APPROVED',{message:'Đã xác nhận quyền kiểm soát cả Messenger và Zalo Bot QA.',
    order_ref:challenge.order_ref});
  }
  if(t==='QA_LINK REVOKE'){
   let count=0;
   for(const [z,link] of links){
    if(link.messenger_actor===ctx.actor&&link.tenant===ctx.install.tenant&&
       link.store===ctx.install.store){links.delete(z);count++;}
   }
   return out('LINK_REVOKED',{links_revoked:count});
  }
  return deny();
 }
 function processZalo(ctx,time){
  const t=ctx.event.text;
  let m;
  if((m=/^QA_ORDER STATUS (QA-ORD-\d{5})$/.exec(t)))return status(ctx,m[1],true);
  if((m=/^QA_LINK CODE ([0-9]{6})$/.exec(t))){
   if(isBlocked(ctx.actor,time))return deny();
   for(const c of challenges.values()){
    if(c.used||c.expires<time||c.tenant!==ctx.install.tenant||c.store!==ctx.install.store)
      continue;
    if(!equalHex(c.codeHash,mac(KEY,c.nonce+':M:'+m[1])))continue;
    if(c.zaloActor&&c.zaloActor!==ctx.actor)return deny();
    if(c.zaloActor)return deny(); // duplicate submits cannot generate second code
    c.zaloActor=ctx.actor;
    const second=otpCode(code);
    c.zaloHash=mac(KEY,c.nonce+':Z:'+second);
    return out('LINK_AWAIT_MESSENGER_CONFIRM',{link_ref:c.id,zalo_confirmation_code:second,
     expires_in_seconds:Math.max(0,Math.floor((c.expires-time)/1000)),
     message:'Nhập mã xác nhận này trên Messenger đã tạo đơn. Chưa mở quyền xem đơn.'});
   }
   failActor(ctx.actor,time);return deny();
  }
  return deny();
 }
 function receive(envelope){
  const time=now();
  const ctx=verifyQaEnvelope(envelope,time);
  const key=[ctx.event.channel,ctx.event.installation_ref,ctx.event.event_id].join('|');
  const prior=replay.get(key);
  if(prior){
   if(prior.digest!==ctx.digest)fail('CONFLICTING_PROVIDER_EVENT_REPLAY');
   return prior.reply;
  }
  let reply;
  if(isBlocked(ctx.actor,time))reply=deny();
  else reply=ctx.event.channel==='messenger'?processMessenger(ctx,time):processZalo(ctx,time);
  replay.set(key,{digest:ctx.digest,reply});
  return reply;
 }
 return Object.freeze({
   receive,
   inspection:()=>Object.freeze({orders:orders.size,previews:previews.size,
      challenges:challenges.size,linked_zalo_accounts:links.size,replay_events:replay.size,
      provider_sends:0,commerce_writes:0,model_calls:0,live_orders:0}),
   sendProvider:()=>fail('PROVIDER_SEND_DISABLED'),
   writeProductionOrder:()=>fail('COMMERCE_WRITE_DISABLED'),
   readRawCustomer:()=>fail('CUSTOMER_PRIVATE_DATA_DISABLED'),
   mode:MODE
 });
}
