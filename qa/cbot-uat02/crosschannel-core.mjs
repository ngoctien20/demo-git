/**
 * TIEN404 CBOT-UAT-02 — isolated synthetic Messenger→Zalo OA identity/order lab.
 * This is not a hosted Store resolver, real provider verifier, or production datastore.
 * In-memory-only fixtures; NO network, live Orders/Stock, provider send, or paid AI.
 */
import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
export const CONTRACT='T404_CBOT_UAT02_SYNTHETIC_V1';
const deny=reason=>{throw Error(reason)};
const freeze=x=>Object.freeze(x);
const shops=freeze([
 freeze({tenant_id:'QA_TENANT_1',store_id:'QA_STORE_A',industry:'FASHION',
   catalog:freeze({sku:'A002',name:'Áo thun trắng M',price_vnd:159000,stock:25}),
   accounts:freeze({MESSENGER:'QA_META_A',ZALO_OA:'QA_ZALO_A'})}),
 freeze({tenant_id:'QA_TENANT_1',store_id:'QA_STORE_B',industry:'MATERIALS',
   catalog:freeze({sku:'VL-01',name:'Xi măng QA',price_vnd:92000,stock:12}),
   accounts:freeze({MESSENGER:'QA_META_B',ZALO_OA:'QA_ZALO_B'})}),
 freeze({tenant_id:'QA_TENANT_2',store_id:'QA_STORE_C',industry:'GROCERY',
   catalog:freeze({sku:'TG-01',name:'Gạo QA',price_vnd:190000,stock:10}),
   accounts:freeze({MESSENGER:'QA_META_C',ZALO_OA:'QA_ZALO_C'})})
]);
const isText=v=>typeof v==='string' && /^QA_[A-Z0-9_]{2,48}$/.test(v);
const cleanId=v=>typeof v==='string' && /^QA-EVT-[A-Z0-9_-]{3,48}$/.test(v);
const hash=(salt,code)=>createHash('sha256').update(salt+':'+code,'utf8').digest();
const notFound=()=>freeze({status:'NOT_FOUND_OR_UNAUTHORIZED',data:null});
const copy=x=>JSON.parse(JSON.stringify(x));
export function createSyntheticCrossChannelLab({clock=()=>Date.now(),otp=()=>String(randomBytes(4).readUInt32BE(0)%1000000).padStart(6,'0')}={}){
 const issued=new WeakSet(), orders=new Map(),proofs=new Map(),links=new Map(), idempotency=new Map(), audit=[];
 let orderSeq=0,proofSeq=0;
 const getShop=storeId=>shops.find(s=>s.store_id===storeId)||deny('UNKNOWN_STORE');
 const ident=ctx=>ctx.store_id+'|'+ctx.channel+'|'+ctx.participant_id;
 const linkKey=(storeId,participantId)=>storeId+'|ZALO_OA|'+participantId;
 const guard=ctx=>{
  if(!ctx||!issued.has(ctx))deny('UNVERIFIED_GATEWAY_CONTEXT');
  const s=getShop(ctx.store_id);
  if(s.tenant_id!==ctx.tenant_id||s.accounts[ctx.channel]!==ctx.account_id)
    deny('STALE_CHANNEL_BINDING');
  return s;
 };
 function mintSyntheticIngress(envelope){
  const keys=['contract','channel','account_id','participant_id','event_id'];
  if(!envelope||Array.isArray(envelope)||typeof envelope!=='object'||
     Object.keys(envelope).some(k=>!keys.includes(k))||
     envelope.contract!==CONTRACT || !['MESSENGER','ZALO_OA'].includes(envelope.channel)||
     !isText(envelope.account_id)||!isText(envelope.participant_id)||!cleanId(envelope.event_id))
    deny('INVALID_SYNTHETIC_GATEWAY_EVENT');
  const s=shops.find(x=>x.accounts[envelope.channel]===envelope.account_id);
  if(!s)deny('UNKNOWN_VERIFIED_PROVIDER_ACCOUNT');
  const ctx=freeze({contract:CONTRACT,tenant_id:s.tenant_id,store_id:s.store_id,
   channel:envelope.channel,account_id:envelope.account_id,
   participant_id:envelope.participant_id,event_id:envelope.event_id});
  issued.add(ctx);
  return ctx;
 }
 function createQaOrder({context,sku,quantity,confirmed,idempotency_key}){
  const s=guard(context);
  if(context.channel!=='MESSENGER')deny('WRONG_ORDER_ORIGIN');
  if(confirmed!==true)deny('CONFIRMATION_REQUIRED');
  if(!Number.isSafeInteger(quantity)||quantity<1||quantity>s.catalog.stock||sku!==s.catalog.sku)
    deny('INVALID_PRODUCT_PRICE_OR_STOCK');
  if(typeof idempotency_key!=='string'||!/^QA-REQ-[A-Z0-9_-]{4,48}$/.test(idempotency_key))
    deny('INVALID_IDEMPOTENCY_KEY');
  const key=ident(context)+'|'+idempotency_key;
  const fingerprint=sku+'|'+quantity;
  if(idempotency.has(key)){
   const prev=idempotency.get(key);
   if(prev.fingerprint!==fingerprint)deny('IDEMPOTENCY_CONFLICT');
   return freeze({...copy(orders.get(prev.id)),duplicate:true});
  }
  const id='QA-CBOT02-'+String(++orderSeq).padStart(4,'0');
  const order=freeze({order_id:id,tenant_id:s.tenant_id,store_id:s.store_id,
   origin:'MESSENGER',owner_identity:ident(context),sku,product_name:s.catalog.name,
   quantity,unit_price_vnd:s.catalog.price_vnd,total_vnd:s.catalog.price_vnd*quantity,
   status:'pending',version:1});
  orders.set(id,order);idempotency.set(key,{id,fingerprint});
  audit.push(freeze({action:'SYNTHETIC_ORDER_CREATED',store_id:s.store_id,order_id:id}));
  return freeze({...copy(order),duplicate:false});
 }
 function startLink({context,order_id}){
  const s=guard(context);
  if(context.channel!=='MESSENGER')deny('SOURCE_MESSENGER_REQUIRED');
  const order=orders.get(order_id);
  if(!order||order.store_id!==s.store_id||order.owner_identity!==ident(context))
    return notFound();
  const code=otp();
  if(typeof code!=='string'||!/^\d{6}$/.test(code))deny('INVALID_OTP_GENERATOR');
  const salt=randomBytes(16).toString('hex');
  const proofId='QA-PROOF-'+String(++proofSeq).padStart(4,'0');
  // One active challenge per source + store; old challenges invalidated.
  for(const p of proofs.values())if(p.sourceIdentity===ident(context)&&!p.used)p.used=true;
  proofs.set(proofId,{storeId:s.store_id,sourceIdentity:ident(context),
   salt,digest:hash(salt,code),used:false,expiresAt:clock()+5*60*1000,attempts:0});
  audit.push(freeze({action:'PROOF_STARTED',store_id:s.store_id,proof_ref:proofId}));
  // The code is returned ONLY to a synthetic original-Messenger interaction.
  return freeze({status:'CHALLENGE_ISSUED_SYNTHETIC',proof_ref:proofId,code,expires_in_seconds:300});
 }
 function completeLink({context,proof_ref,code}){
  const s=guard(context);
  if(context.channel!=='ZALO_OA')deny('TARGET_ZALO_OA_REQUIRED');
  const p=proofs.get(proof_ref);
  if(!p||p.used||p.storeId!==s.store_id||clock()>=p.expiresAt)
    return freeze({status:'DENIED',reason:'INVALID_EXPIRED_OR_REPLAYED_PROOF'});
  if(p.attempts>=3){p.used=true;return freeze({status:'DENIED',reason:'MAX_ATTEMPTS'});}
  p.attempts++;
  const candidate=typeof code==='string'&&/^\d{6}$/.test(code)?hash(p.salt,code):Buffer.alloc(32);
  if(!timingSafeEqual(p.digest,candidate)){
   if(p.attempts>=3)p.used=true;
   return freeze({status:'DENIED',reason:'INVALID_PROOF'});
  }
  const key=linkKey(s.store_id,context.participant_id);
  const existing=links.get(key);
  if(existing&&existing!==p.sourceIdentity){
   p.used=true;
   return freeze({status:'DENIED',reason:'CONFLICTING_IDENTITY_BINDING'});
  }
  // No cross-Store identity reuse. No link from a client-supplied customer_id.
  links.set(key,p.sourceIdentity);p.used=true;
  audit.push(freeze({action:'SYNTHETIC_IDENTITY_LINKED',store_id:s.store_id,proof_ref}));
  return freeze({status:'IDENTITY_LINKED',store_id:s.store_id});
 }
 function lookupOrder({context,order_id}){
  const s=guard(context);
  const order=orders.get(order_id);
  if(!order||order.store_id!==s.store_id||order.tenant_id!==s.tenant_id)
    return notFound();
  const authorized=context.channel==='MESSENGER'?
    ident(context)===order.owner_identity:
    links.get(linkKey(s.store_id,context.participant_id))===order.owner_identity;
  if(!authorized)return notFound();
  return freeze({status:'FOUND',data:freeze({
   order_id:order.order_id,sku:order.sku,product_name:order.product_name,
   quantity:order.quantity,unit_price_vnd:order.unit_price_vnd,
   total_vnd:order.total_vnd,status:order.status,version:order.version
  })});
 }
 function unlink({context}){
  const s=guard(context);
  if(context.channel!=='ZALO_OA')deny('ZALO_UNLINK_CONTEXT_REQUIRED');
  const removed=links.delete(linkKey(s.store_id,context.participant_id));
  audit.push(freeze({action:'SYNTHETIC_IDENTITY_UNLINK',store_id:s.store_id}));
  return freeze({unlinked:removed});
 }
 function snapshot(){
  return freeze({synthetic:true,order_count:orders.size,active_proof_count:[...proofs.values()].filter(p=>!p.used).length,
   link_count:links.size,hosted_writes:0,provider_sends:0,paid_model_calls:0,
   events:audit.map(e=>({...e}))});
 }
 return freeze({mintSyntheticIngress,createQaOrder,startLink,completeLink,lookupOrder,unlink,snapshot});
}
export function sendProviderMessage(){deny('PROVIDER_SEND_DISABLED')}
export function writeHostedOrder(){deny('HOSTED_WRITER_DISABLED')}
export function executePrivilegedRpc(){deny('RPC_CHANGE_NOT_APPROVED_BY_BACKUP_GATE')}
export function invokePaidModel(){deny('PAID_MODEL_DISABLED')}
