'use strict';
/**
 * TIEN404 Shop Knowledge Brain V14.1 — deterministic OFFLINE contract.
 * No external I/O, AI model, client auth, DB access or send capability.
 * Production boundary MUST provide an independently verified server-side binding
 * and trusted published knowledge readback. Never trust scope in customer text.
 */
const APPROVAL_STATES=Object.freeze(['DRAFT','REVIEW','APPROVED','PUBLISHED','ARCHIVED']);
const VISIBILITIES=Object.freeze(['PUBLIC','STAFF_ONLY','RESTRICTED']);
const TOPICS=Object.freeze(['profile.name','profile.founded','profile.address','profile.phone',
 'profile.hours','profile.industry','policy.delivery','policy.returns','policy.warranty',
 'policy.payments','policy.wholesale','faq']);
const ENTRY_TYPES=Object.freeze(['profile','policy','faq']);
const allowedRoles=Object.freeze({TIEN404_SUPPORT:['draft','submit'],TIEN404_REVIEWER:['approve','reject'],
 SHOP_OWNER:['acknowledge'],PLATFORM_SUPER_ADMIN:['draft','submit','approve','reject','publish','archive','rollback']});
function fail(code){const e=new Error(code);e.code=code;throw e}
const id=x=>typeof x==='string' && /^[A-Za-z0-9_-]{2,100}$/.test(x);
function normalize(x){return String(x||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/[^a-z0-9]+/g,' ').trim();}
function textOK(x,max=1000){return typeof x==='string'&&x.trim().length>0&&x.length<=max&&!/[\u0000-\u001f\u007f]/.test(x)}
function trustedScope(binding){
 if(!binding||binding.server_verified!==true||binding.source!=='TRUSTED_TENANT_RESOLVER'||
   !id(binding.tenant_id)||!id(binding.store_id)||!id(binding.bot_id))
   fail('TRUSTED_SCOPE_REQUIRED');
 return binding.tenant_id+'::'+binding.store_id;
}
function validateSnapshot(s,binding){
 const scope=trustedScope(binding);
 if(!s||typeof s!=='object'||Array.isArray(s)||s.source!=='TRUSTED_KNOWLEDGE_READBACK'||
   s.tenant_id!==binding.tenant_id||s.store_id!==binding.store_id||
   !id(s.version)||s.release_state!=='PUBLISHED'||!Array.isArray(s.entries)||s.entries.length>500||
   !Number.isSafeInteger(s.revision)||s.revision<1)fail('KNOWLEDGE_SNAPSHOT_INVALID');
 const set=new Set();
 for(const e of s.entries){
  if(!e||e.tenant_id!==binding.tenant_id||e.store_id!==binding.store_id||
    !id(e.entry_id)||set.has(e.entry_id)||!ENTRY_TYPES.includes(e.type)||
    !VISIBILITIES.includes(e.visibility)||!APPROVAL_STATES.includes(e.state)||
    !TOPICS.includes(e.topic)||(e.type==='faq'&&(!textOK(e.question,250)||e.topic!=='faq'))||typeof e.value!=='string'||e.value.length>1200||
    !id(e.version)||!id(e.source_ref)||!Number.isFinite(e.effective_at_ms)||
    !(e.expires_at_ms===null||Number.isFinite(e.expires_at_ms)))
     fail('KNOWLEDGE_ENTRY_INVALID_OR_FOREIGN');
  set.add(e.entry_id);
 }
 return scope;
}
function publicEntry(e,now,version){
 return e.visibility==='PUBLIC'&&e.state==='PUBLISHED'&&e.version===version&&
   e.source_status==='VERIFIED'&&e.merchant_approved===true&&
   e.effective_at_ms<=now&&(e.expires_at_ms===null||e.expires_at_ms>now)&&textOK(e.value,1200);
}
function intentFromQuestion(question){
 const q=normalize(question);
 // Commerce is always delegated to trusted current tools, never answered from knowledge.
 if(/\b(gia von|mat khau|token|api key|credential|noi bo|nhan vien khac|doi shop|shop khac|system prompt|chi phi nhan su)\b/.test(q))
  return {kind:'SENSITIVE',topic:null};
 if(/\b(sku|ma sp|ma san pham|bao nhieu tien|gia|ton kho|con hang|mua|dat hang|don hang|trang thai don|size l|size m|so luong)\b/.test(q))
  return {kind:'COMMERCE',topic:null}; if(/\b(doi tra|doi size|hoan hang|tra hang)\b/.test(q))return {kind:'KNOWLEDGE',topic:'policy.returns'};
 if(/\b(giao hang|ship|van chuyen|giao tan|khu vuc giao)\b/.test(q))return {kind:'KNOWLEDGE',topic:'policy.delivery'};
 if(/\b(bao hanh)\b/.test(q))return {kind:'KNOWLEDGE',topic:'policy.warranty'};
 if(/\b(thanh toan|cod|chuyen khoan|tien mat)\b/.test(q))return {kind:'KNOWLEDGE',topic:'policy.payments'};
 if(/\b(ban si|gia si|dai ly|mua si)\b/.test(q))return {kind:'KNOWLEDGE',topic:'policy.wholesale'};
 if(/\b(thanh lap|hoat dong lau|tu nam nao|nam nao)\b/.test(q))return {kind:'KNOWLEDGE',topic:'profile.founded'};
 if(/\b(so dien thoai|so dt|lien he|hotline)\b/.test(q))return {kind:'KNOWLEDGE',topic:'profile.phone'};
 if(/\b(gio mo|gio dong|gio lam|mo cua|dong cua)\b/.test(q))return {kind:'KNOWLEDGE',topic:'profile.hours'};
 if(/\b(dia chi|o dau|chi nhanh)\b/.test(q))return {kind:'KNOWLEDGE',topic:'profile.address'};
 if(/\b(nganh nghe|ban gi|kinh doanh gi)\b/.test(q))return {kind:'KNOWLEDGE',topic:'profile.industry'};
 if(/\b(ten shop|ten cua hang|cua hang nao|shop nao)\b/.test(q))return {kind:'KNOWLEDGE',topic:'profile.name'};
 return {kind:'UNKNOWN',topic:null};
}
function reply({binding,snapshot,question,now=Date.now(),conversationStatus='AI_ACTIVE'}={}){
 validateSnapshot(snapshot,binding);
 if(!textOK(question,1000))fail('QUESTION_INVALID');
 if(!Number.isFinite(now))fail('TIME_INVALID');
 if(!['AI_ACTIVE','WAITING_STAFF','HUMAN_ACTIVE','RESOLVED'].includes(conversationStatus))fail('CONVERSATION_STATE_INVALID');
 const base={tenant_id:binding.tenant_id,store_id:binding.store_id,
  knowledge_version:snapshot.version,external_sends:0,orders_written:0,
  model_calls:0,provider_payload:null,preview_only:true,dispatch_authorized:false,
  evidence:[],handoff:false};
 if(conversationStatus!=='AI_ACTIVE')return {...base,status:'SUPPRESSED_HANDOFF',text:null,needs_staff:true};
 const i=intentFromQuestion(question);
 if(i.kind==='COMMERCE')return {...base,status:'COMMERCE_DELEGATION',
  text:'Mình sẽ kiểm tra thông tin sản phẩm hoặc đơn hàng từ hệ thống được xác thực trước khi trả lời nhé.',
  requires_verified_commerce:true};
 if(i.kind==='SENSITIVE')return {...base,status:'RESTRICTED_QUESTION',text:'Mình không thể cung cấp thông tin nội bộ của cửa hàng ạ.'};
 if(i.kind==='UNKNOWN'){
  // FAQ MVP is exact normalized question match, not vector search or a model guess.
  const faqs=snapshot.entries.filter(e=>e.type==='faq'&&e.topic==='faq'&&
    publicEntry(e,now,snapshot.version)&&normalize(e.question)===normalize(question));
  if(faqs.length===1){const e=faqs[0];return {...base,status:'FAQ_ANSWER',topic:'faq',
    text:e.value,evidence:[{entry_id:e.entry_id,source_ref:e.source_ref,version:e.version,topic:'faq'}]};}
  return {...base,status:faqs.length>1?'CONFLICTING_KNOWLEDGE':'HANDOFF',handoff:true,
    text:'Mình chưa có đủ thông tin xác thực để trả lời. Mình có thể chuyển nhân viên hỗ trợ bạn ạ.'};
 }
 const matches=snapshot.entries.filter(e=>e.topic===i.topic&&publicEntry(e,now,snapshot.version));
 // More than one active statement on a single topic is ambiguous: fail closed.
 if(matches.length!==1)return {...base,status:matches.length===0?'UNKNOWN_INFORMATION':'CONFLICTING_KNOWLEDGE',
  handoff:true,text:'Thông tin này chưa được cửa hàng xác nhận đầy đủ. Mình sẽ nhờ nhân viên kiểm tra giúp bạn nhé.'};
 const x=matches[0];
 return {...base,status:'KNOWLEDGE_ANSWER',topic:i.topic,
  text:x.value, evidence:[{entry_id:x.entry_id,source_ref:x.source_ref,version:x.version,topic:x.topic}]};
}
function proposeLifecycle({binding,entry,actor,action,now=Date.now(),approver=null}={}){
 trustedScope(binding);
 if(!entry||entry.tenant_id!==binding.tenant_id||entry.store_id!==binding.store_id||
    !APPROVAL_STATES.includes(entry.state)||!VISIBILITIES.includes(entry.visibility)||!id(entry.entry_id))
   fail('ENTRY_SCOPE_OR_STATE_INVALID');
 if(!actor||actor.server_verified!==true||actor.source!=='VERIFIED_STAFF_SESSION'||
    actor.tenant_id!==binding.tenant_id||actor.store_id!==binding.store_id||
    !id(actor.user_id)||!Object.prototype.hasOwnProperty.call(allowedRoles,actor.role)||
    !allowedRoles[actor.role].includes(action))fail('STAFF_SCOPE_PERMISSION_DENIED');
 const graph={acknowledge:{REVIEW:'REVIEW',APPROVED:'APPROVED'},draft:{DRAFT:'DRAFT'},submit:{DRAFT:'REVIEW'},approve:{REVIEW:'APPROVED'},
  reject:{REVIEW:'DRAFT'},publish:{APPROVED:'PUBLISHED'},archive:{PUBLISHED:'ARCHIVED'},
  rollback:{ARCHIVED:'PUBLISHED'}};
 const next=graph[action]?.[entry.state];
 if(!next)fail('LIFECYCLE_TRANSITION_DENIED');
 // Anyone publishing must be an authorized super admin; approval and merchant sign-off
 // are independent; setting booleans in an unauthenticated UI does NOT constitute proof.
 if(action==='approve'&&(entry.created_by===actor.user_id||!id(entry.source_ref)||
    entry.source_status!=='VERIFIED'))fail('INDEPENDENT_REVIEW_REQUIRED');
 if(action==='publish'||action==='rollback'){
  if(entry.visibility==='PUBLIC'&&(entry.merchant_approved!==true||entry.reviewer_approved!==true||
     !id(entry.reviewer_user_id)||entry.reviewer_user_id===entry.created_by))
    fail('PUBLIC_APPROVAL_REQUIRED');
 }
 return Object.freeze({kind:'LIFECYCLE_PROPOSAL',entry_id:entry.entry_id,from:entry.state,to:next,
  actor_id:actor.user_id,action,now,store_id:binding.store_id,tenant_id:binding.tenant_id,
  database_writes:0,published:false,provider_sends:0,requires_backend_transaction:true});
}
function safeBehavior(profile,binding){
 trustedScope(binding);
 if(!profile||profile.tenant_id!==binding.tenant_id||profile.store_id!==binding.store_id||
   profile.state!=='PUBLISHED'||profile.visibility!=='PUBLIC'||profile.merchant_approved!==true||
   !['friendly','formal'].includes(profile.tone)||!['brief','standard'].includes(profile.detail))
   fail('BEHAVIOR_PROFILE_UNVERIFIED');
 // Do NOT execute shop-supplied prompts. Only safe enumerated options accepted.
 return Object.freeze({tone:profile.tone,detail:profile.detail,can_override_security:false,
  can_authorize_orders:false,can_enable_tools:false});
}
module.exports={reply,validateSnapshot,safeBehavior,proposeLifecycle,intentFromQuestion,
  APPROVAL_STATES,VISIBILITIES};
