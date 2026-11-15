'use strict';
/**
 * TIEN404 AI V14 — image event and SKU preview core.
 * OFFLINE / EXPERIMENTAL: no network, no vision-model call, no database, no sends.
 * Trust boundary: ingress must authenticate webhook BEFORE calling this module;
 * trustedBinding must be built from a server-side Bot→Tenant→Store registry,
 * never from inbound customer-controlled JSON. A caller-controlled "verified"
 * Boolean is NOT a substitute for that upstream trust boundary.
 */
const MAX_TEXT=1000;
const knownEvents=new Set(['message.image.received','message.text.received','message.voice.received','message.sticker.received','message.unsupported.received']);
function reject(code){const e=new Error(code);e.code=code;throw e;}
function validId(s){return typeof s==='string'&&/^[a-zA-Z0-9_-]{2,100}$/.test(s);}
function words(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/[^a-z0-9]+/g,' ').trim().split(/\s+/).filter(Boolean);}
function normalize(s){return words(s).join(' ');}
function checkTrusted(ingress,binding){
 if(!ingress||ingress.authenticated!==true||ingress.source!=='VERIFIED_ZALO_WEBHOOK')reject('WEBHOOK_AUTH_REQUIRED');
 if(!binding||binding.source!=='TRUSTED_TENANT_RESOLVER'||binding.verified!==true||
    !validId(binding.bot_id)||!validId(binding.tenant_id)||!validId(binding.store_id))reject('TRUSTED_STORE_REQUIRED');
 // This function cannot prove a registry lookup occurred. Caller MUST own that boundary.
}
function safePhotoUrl(value,allowedHosts){
 if(typeof value!=='string'||!value||value.length>4096)reject('MEDIA_URL_INVALID');
 if(!Array.isArray(allowedHosts)||allowedHosts.length===0)reject('MEDIA_HOST_POLICY_REQUIRED');
 let u;try{u=new URL(value)}catch{reject('MEDIA_URL_INVALID')}
 if(u.protocol!=='https:'||u.username||u.password||u.port||
   !u.hostname||u.hash||/\.$/.test(u.hostname))reject('MEDIA_URL_INVALID');
 if(/^\d+\.\d+\.\d+\.\d+$/.test(u.hostname)||u.hostname.includes(':')||
    u.hostname==='localhost'||u.hostname.endsWith('.local'))reject('MEDIA_URL_INVALID');
 if(!allowedHosts.some(h=>typeof h==='string'&&h.toLowerCase()===u.hostname.toLowerCase()))reject('MEDIA_HOST_NOT_ALLOWED');
 // IMPORTANT: DNS/IP, redirects, file bytes and MIME MUST be re-checked by an
 // allowlisted egress proxy after resolution, on EVERY hop. No fetch here.
 return {media_host:u.hostname,media_field_detected:true};
}
function normalizeImageEvent(raw,{ingress,binding,allowedHosts=[],seenIds=[]}={}){
 checkTrusted(ingress,binding);
 if(!raw||typeof raw!=='object'||Array.isArray(raw))reject('EVENT_INVALID');
 const e=(raw.result&&typeof raw.result==='object')?raw.result:raw;
 const type=e.event_name;
 if(!knownEvents.has(type))reject('EVENT_UNRECOGNIZED');
 if(type!=='message.image.received')return Object.freeze({accepted:false,reason:'NON_IMAGE_EVENT',event_type:type,external_sends:0});
 const m=e.message;
 if(!m||typeof m!=='object')reject('MESSAGE_INVALID');
 if(m.from?.is_bot===true||m.from?.isbot===true)reject('BOT_SELF_MESSAGE');
 if(m.chat?.chat_type!=='PRIVATE')reject('PRIVATE_CHAT_REQUIRED');
 if(!validId(m.chat?.id)||!validId(m.message_id))reject('MESSAGE_ID_INVALID');
 if(m.from?.id!==m.chat.id)reject('CHAT_ID_MISMATCH');
 if(!Array.isArray(seenIds)||seenIds.length>10000)reject('DEDUP_POLICY_INVALID');
 const eventKey=[binding.tenant_id,binding.store_id,binding.bot_id,m.message_id].join('::');
 if(seenIds.includes(eventKey))return Object.freeze({accepted:false,reason:'DUPLICATE_IGNORED',event_key:eventKey,external_sends:0});
 const photo=m.photo_url??m.photo;
 if(m.photo_url&&m.photo&&m.photo_url!==m.photo)reject('MEDIA_FIELD_CONFLICT');
 const safe=safePhotoUrl(photo,allowedHosts);
 const caption=typeof m.caption==='string'?m.caption:'';
 if(caption.length>MAX_TEXT||/[\u0000-\u001f]/.test(caption))reject('CAPTION_INVALID');
 return Object.freeze({
   accepted:true,event_type:type,event_key:eventKey,
   tenant_id:binding.tenant_id,store_id:binding.store_id,bot_id:binding.bot_id,
   image_media_pending:true,caption:caption,media_host:safe.media_host,
   // Deliberately no raw URL, tokens, headers, chat identity or image bytes in output.
   requires_secure_media_fetch:true,authenticated_ingress:true,
   external_sends:0,orders_written:0,production_ready:false
 });
}
function verifyVisionResult(result,{qaMode=false}={}){
 if(!result||typeof result!=='object'||Array.isArray(result))reject('VISION_RESULT_MISSING');
 if(result.provenance!=='QA_FIXTURE'&&result.provenance!=='VERIFIED_MODEL_ADAPTER')reject('VISION_PROVENANCE_INVALID');
 if(result.provenance==='QA_FIXTURE'&&!qaMode)reject('QA_VISION_NOT_ALLOWED_LIVE');
 if(result.provenance==='VERIFIED_MODEL_ADAPTER')reject('LIVE_VISION_ADAPTER_NOT_IMPLEMENTED');
 if(!['usable','low_quality','unsupported'].includes(result.quality))reject('VISION_QUALITY_INVALID');
 const tags=result.attributes||{};
 if(!tags||typeof tags!=='object'||Array.isArray(tags))reject('VISION_ATTRIBUTES_INVALID');
 const output={};
 for(const k of ['category','color','style','brand','visible_sku']){
   const v=tags[k];
   if(v!=null&&(typeof v!=='string'||v.length>100||/[\u0000-\u001f]/.test(v)))reject('VISION_ATTRIBUTE_INVALID');
   output[k]=v==null?null:v.trim();
 }
 if(!Array.isArray(result.detected_text)||result.detected_text.length>15||
   result.detected_text.some(x=>typeof x!=='string'||x.length>120))reject('VISION_TEXT_INVALID');
 return Object.freeze({provenance:'QA_FIXTURE',quality:result.quality,attributes:output,
   detected_text:[...result.detected_text],requires_clarification:result.requires_clarification===true});
}
function verifyCatalog(catalog,binding){
 if(!Array.isArray(catalog)||catalog.length>300)reject('CATALOG_INVALID');
 const seen=new Set();
 return catalog.map(p=>{
  if(!p||p.source!=='VERIFIED_STORE_CATALOG'||
   p.tenant_id!==binding.tenant_id||p.store_id!==binding.store_id||
   !validId(p.sku)||typeof p.name!=='string'||p.name.length>250||
   !Number.isSafeInteger(p.price_vnd)||p.price_vnd<0||
   !Number.isSafeInteger(p.stock)||p.stock<0||
   typeof p.is_active!=='boolean'||!Number.isFinite(p.verified_at_ms))
   reject('CATALOG_UNVERIFIED_OR_CROSS_STORE');
  if(seen.has(p.sku))reject('CATALOG_DUPLICATE_SKU');
  seen.add(p.sku);
  return {...p};
 });
}
function matchProduct({binding,event,vision,catalog,now=Date.now(),maxAgeMs=180000}){
 checkTrusted({authenticated:true,source:'VERIFIED_ZALO_WEBHOOK'},binding);
 if(!event||event.accepted!==true||event.tenant_id!==binding.tenant_id||
   event.store_id!==binding.store_id||event.bot_id!==binding.bot_id)reject('EVENT_SCOPE_INVALID');
 if(!vision||vision.provenance!=='QA_FIXTURE')reject('VISION_VERIFICATION_REQUIRED');
 const list=verifyCatalog(catalog,binding);
 if(vision.quality!=='usable'||vision.requires_clarification)
   return {status:'CLARIFY_IMAGE',candidates:[],verified_sku:null};
 const sku=vision.attributes.visible_sku;
 let exact=null;
 if(sku)exact=list.find(p=>p.is_active&&p.sku.toUpperCase()===sku.toUpperCase())||null;
 if(exact){
  const fresh=now-exact.verified_at_ms>=0&&now-exact.verified_at_ms<=maxAgeMs;
  if(!fresh)return {status:'REVERIFY_PRICE_STOCK',verified_sku:exact.sku,candidates:[]};
  return {status:'EXACT_SKU_VERIFIED',verified_sku:exact.sku,product:exact,candidates:[]};
 }
 // Similarity here is only for *candidate suggestions*, never verified SKU.
 const tokens=new Set([
   ...words(vision.attributes.category),...words(vision.attributes.color),
   ...words(vision.attributes.style),...vision.detected_text.flatMap(words)]);
 const ranked=list.filter(p=>p.is_active).map(p=>{
    const hay=new Set([...words(p.name),...(Array.isArray(p.attributes)?p.attributes.flatMap(words):[])]);
    let score=0;for(const t of tokens)if(hay.has(t))score++;
    return {sku:p.sku,name:p.name,evidence_hits:score};
 }).filter(p=>p.evidence_hits>0).sort((a,b)=>b.evidence_hits-a.evidence_hits||a.sku.localeCompare(b.sku));
 return {status:ranked.length?'SIMILAR_CANDIDATES':'UNKNOWN_PRODUCT',
   verified_sku:null,candidates:ranked.slice(0,3)};
}
function previewReply(match){
 if(!match||typeof match!=='object')reject('MATCH_INVALID');
 let text='Mình chưa xác định được sản phẩm từ ảnh. Bạn có thể gửi ảnh rõ hơn hoặc cho mình biết tên mẫu được không ạ?';
 if(match.status==='EXACT_SKU_VERIFIED'){
  const p=match.product;
  text='Dạ, shop có mẫu '+p.name+' (mã '+p.sku+'). Giá tham khảo đã kiểm tra: '+p.price_vnd.toLocaleString('vi-VN')+
   'đ; tồn kho ghi nhận: '+p.stock+'. Bạn muốn chọn màu, size và số lượng nào ạ?';
 }else if(match.status==='REVERIFY_PRICE_STOCK'){
  text='Mình tìm thấy mã '+match.verified_sku+', nhưng cần kiểm tra lại giá và tồn kho trước khi tư vấn ạ.';
 }else if(match.status==='SIMILAR_CANDIDATES'){
  text='Shop có một số mẫu tương tự: '+match.candidates.map(p=>p.name+' ('+p.sku+')').join('; ')+
   '. Bạn chọn mẫu nào để mình kiểm tra chính xác ạ?';
 }else if(match.status==='CLARIFY_IMAGE')text='Ảnh chưa đủ rõ để nhận diện. Bạn gửi giúp mình ảnh gần hơn hoặc cho biết đặc điểm sản phẩm nhé.';
 return Object.freeze({status:match.status,text,verified_sku:match.status==='EXACT_SKU_VERIFIED'?match.verified_sku:null,
   channel:'ZALO_BOT',provider_payload:null,dispatch_authorized:false,
   provider_sends:0,orders_written:0,outbox_written:0,production_ready:false,preview_only:true});
}
module.exports={normalizeImageEvent,verifyVisionResult,verifyCatalog,matchProduct,previewReply,safePhotoUrl};
