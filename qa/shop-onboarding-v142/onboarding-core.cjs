'use strict';
/**
 * V14.2 — deterministic Vietnamese Shop Onboarding interview.
 * Never invokes an LLM, writes a database, publishes Knowledge, or sends messages.
 * Each answer is evidence FROM SHOP, not verified truth or an executable prompt.
 */
const {AccessError}=require('../store-rls-v142/store-boundary.cjs');
const FIELDS=Object.freeze([
 {id:'shop_name',label:'Tên cửa hàng',question:'Shop mình tên là gì ạ?',required:true,type:'name'},
 {id:'industry',label:'Ngành kinh doanh',question:'Shop mình đang kinh doanh ngành hàng nào?',required:true,type:'text'},
 {id:'founding_year',label:'Năm thành lập',question:'Shop thành lập năm nào? Nếu chưa rõ, chọn “Chưa biết”.',required:false,type:'year'},
 {id:'public_phone',label:'Số điện thoại công khai',question:'Số điện thoại nào shop cho phép công khai? Có thể để trống.',required:false,type:'phone'},
 {id:'address',label:'Địa chỉ cửa hàng',question:'Shop đang ở địa chỉ nào? Nếu chưa xác minh, chọn “Chưa biết”.',required:true,type:'text'},
 {id:'opening_hours',label:'Giờ hoạt động',question:'Shop mở cửa vào thời gian nào? Ví dụ: 08:00–20:00.',required:true,type:'hours'},
 {id:'delivery_area',label:'Khu vực giao hàng',question:'Shop giao hàng đến khu vực nào? Nếu chưa có chính sách, chọn “Chưa biết”.',required:false,type:'text'},
 {id:'delivery_policy',label:'Chính sách giao hàng',question:'Shop có chính sách giao hàng/phí ship như thế nào?',required:false,type:'policy'},
 {id:'returns_policy',label:'Chính sách đổi trả',question:'Điều kiện đổi trả hàng của shop là gì?',required:false,type:'policy'},
 {id:'payment_methods',label:'Phương thức thanh toán',question:'Shop nhận những cách thanh toán nào? Ví dụ: tiền mặt, chuyển khoản, COD.',required:false,type:'text'},
 {id:'ai_tone',label:'Phong cách tư vấn',question:'Bạn muốn trợ lý tư vấn thân thiện hay trang trọng?',required:false,type:'tone'}
]);
const PROMPT_WARNING=/\b(ignore previous|disregard instructions|system prompt|api key|service role|credential|mat khau|bỏ qua hướng dẫn|bỏ qua quy tắc|cấp quyền admin)\b/i;
const safeStr=(x)=>typeof x==='string'&&x.trim()&&x.length<=600&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(x);
function issue(code){throw new AccessError(code,422);}
function checkContext(context){
 if(!context||context.source!=='SERVER_AUTHENTICATED_STORE_SESSION'||
   typeof context.user_id!=='string'||!context.tenant_id||!context.store_id||
   !['SHOP_OWNER','SHOP_MANAGER','TIEN404_SUPPORT','PLATFORM_SUPER_ADMIN'].includes(context.role))
   issue('VERIFIED_STORE_CONTEXT_REQUIRED');
}
function start(context){
 checkContext(context);
 return {
  contract:'V14_2_ONBOARDING_DRAFT_ONLY',tenant_id:context.tenant_id,
  store_id:context.store_id,created_by:context.user_id,
  state:'DRAFT',index:0,answers:{},unknown:[],flags:[],seen_turn_ids:[],
  started_at:new Date().toISOString(),database_writes:0,provider_sends:0,
  bot_tool_calls:0,will_publish:false
 };
}
function validate(field,value,yearNow=new Date().getFullYear()){
 if(!safeStr(value))issue('FIELD_VALUE_INVALID');
 const v=value.trim().replace(/[ \t]+/g,' ');
 if(PROMPT_WARNING.test(v))issue('CONTENT_REQUIRES_STAFF_REVIEW');
 if(v.length>(field.type==='policy'?600:field.type==='text'?250:120))issue('FIELD_VALUE_TOO_LONG');
 if(field.type==='year' && (!/^\d{4}$/.test(v)||+v<1900||+v>yearNow))issue('FOUNDING_YEAR_INVALID');
 if(field.type==='phone' && !/^(?:0\d{9}|\+84\d{9})$/.test(v))issue('PUBLIC_PHONE_INVALID');
 if(field.type==='tone' && !['thân thiện','trang trọng'].includes(v.toLocaleLowerCase('vi-VN')))
   issue('AI_TONE_ENUM_REQUIRED');
 if(field.type==='hours' && !/^(?:[0-2]\d:[0-5]\d)(?:\s*[-–—]\s*[0-2]\d:[0-5]\d)?(?:[ ;,].*)?$/i.test(v))
  issue('OPENING_HOURS_NEEDS_FORMAT');
 if(field.type==='name' && (v.length<2||v.length>100))issue('SHOP_NAME_INVALID');
 return v;
}
function current(session){
 if(session?.contract!=='V14_2_ONBOARDING_DRAFT_ONLY'||session.state!=='DRAFT'||
    !Number.isInteger(session.index)||session.index<0||session.index>FIELDS.length)issue('DRAFT_SESSION_INVALID');
 return FIELDS[session.index]||null;
}
function step(session,{field_id,value,turn_id,skip=false}={}){
 const f=current(session);
 if(!f)issue('INTERVIEW_ALREADY_COMPLETE');
 if(typeof turn_id!=='string'||!/^[a-zA-Z0-9_-]{4,60}$/.test(turn_id))issue('TURN_ID_REQUIRED');
 if(session.seen_turn_ids.includes(turn_id))return {...session,duplicate_ignored:true};
 if(session.seen_turn_ids.length>=100)issue('TOO_MANY_TURNS');
 if(field_id!==f.id)issue('UNEXPECTED_FIELD_OR_ORDER');
 const unknown=skip||value===null||(typeof value==='string'&&
  /^(chưa biết|chua biet|không rõ|khong ro|bỏ qua|bo qua)$/i.test(value.trim()));
 const answers={...session.answers};const missing=[...session.unknown];
 if(unknown){if(!missing.includes(f.id))missing.push(f.id);delete answers[f.id]}
 else{answers[f.id]=validate(f,value);const index=missing.indexOf(f.id);if(index>=0)missing.splice(index,1)}
 return {...session,index:session.index+1,answers,unknown:missing,
   seen_turn_ids:[...session.seen_turn_ids,turn_id],duplicate_ignored:false,
   database_writes:0,provider_sends:0,bot_tool_calls:0,will_publish:false};
}
function review(session){
 const next=current(session);
 const missingRequired=FIELDS.filter(f=>f.required&&!session.answers[f.id]).map(f=>f.id);
 const missingOptional=FIELDS.filter(f=>!f.required&&!session.answers[f.id]).map(f=>f.id);
 return {
  status:next?'IN_PROGRESS':missingRequired.length?'INCOMPLETE_DRAFT':'READY_FOR_STAFF_REVIEW',
  next,next_question:next?.question||null,
  answered:Object.keys(session.answers).length,missing_required:missingRequired,
  missing_optional:missingOptional,publication_allowed:false,
  owner_approval_recorded:false,reviewer_approval_recorded:false,
  verified_source_count:0,knowledge_published:false,
  hint:'Các câu trả lời chỉ là thông tin do shop khai báo, chưa được xác minh.'
 };
}
function exportDraft(context,session){
 checkContext(context);const st=review(session);
 if(session.tenant_id!==context.tenant_id||session.store_id!==context.store_id||
    session.created_by!==context.user_id)issue('DRAFT_CROSS_STORE_OR_USER_DENIED');
 if(st.status==='IN_PROGRESS')issue('INTERVIEW_NOT_FINISHED');
 const out={schema_version:'shop-onboarding-v14.2',tenant_id:context.tenant_id,
   store_id:context.store_id,submitted_by:context.user_id,source_kind:'MERCHANT_SELF_REPORTED',
   knowledge_lifecycle:'DRAFT',verification_state:'UNVERIFIED',visibility:'STAFF_ONLY',
   merchant_publication_approved:false,staff_review_approved:false,
   fields:{...session.answers},missing_required:st.missing_required,
   missing_optional:st.missing_optional,requires_owner_confirmation:true,
   publish_allowed:false, database_writes:0, provider_sends:0,
   note:'Cần nhân viên xác minh và chủ shop duyệt trước khi phát hành cho AI.'};
 return Object.freeze(out);
}
module.exports={FIELDS,start,step,current,review,exportDraft,validate,checkContext};
