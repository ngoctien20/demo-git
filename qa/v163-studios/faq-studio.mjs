import {STAGE,qaContext,qaScope,assert,positiveInt} from './qa-contract.mjs';
/** FAQ Studio: synthetic per-Shop PER-KEY revisions, no hosted CMS/publisher or real PII. */
export const FAQ_KEYS=Object.freeze(['GREETING','HOURS','SHOP_STATUS','SUPPORT_POLICY']);
const VALUES=Object.freeze({
 GREETING:['Xin chao tu Shop QA A','Xin chao tu Shop QA B','Xin chao tu Shop QA C'],
 HOURS:['QA_OPEN_08_20','QA_OPEN_09_18','QA_HOURS_UNVERIFIED'],
 SHOP_STATUS:['QA_OPEN','QA_PAUSED'],
 SUPPORT_POLICY:['QA_HANDOFF_REQUIRED','QA_REPLY_LATER']
});
export function createFaqStudio(){
 const states=new Map();
 const id=(ctx,key)=>qaScope(ctx)+'|'+key;
 const checkKey=key=>assert(FAQ_KEYS.includes(key),'FAQ_KEY_NOT_ALLOWED');
 function edit(ctx,{key,value,expected_version}){
  const actor=qaContext(ctx,['owner','manager']);checkKey(key);
  assert(VALUES[key].includes(value),'FAQ_SYNTHETIC_VALUE_ONLY');
  assert(positiveInt(expected_version),'FAQ_EXPECTED_VERSION_REQUIRED');
  const k=id(ctx,key),current=states.get(k),version=current?.version||0;
  assert(expected_version===version,'FAQ_VERSION_CONFLICT');
  const draft={version:version+1,key,value,scope:qaScope(ctx),creator:actor.actor_id,
   status:'DRAFT_QA',reviewer:null,reviewed_at_ms:null,valid_until_ms:null};
  states.set(k,draft);
  return Object.freeze({version:draft.version,status:draft.status,key,no_send:true});
 }
 function review(ctx,{key,version,approved,valid_until_ms,now_ms}){
  const reviewer=qaContext(ctx,['reviewer']);checkKey(key);
  const k=id(ctx,key),draft=states.get(k);
  assert(draft&&draft.version===version&&draft.status==='DRAFT_QA','FAQ_DRAFT_NOT_FOUND_OR_STALE');
  assert(draft.creator!==reviewer.actor_id,'INDEPENDENT_REVIEW_REQUIRED');
  assert(approved===true||approved===false,'EXPLICIT_REVIEW_REQUIRED');
  assert(positiveInt(now_ms)&&positiveInt(valid_until_ms)&&valid_until_ms>now_ms&&
   valid_until_ms-now_ms<=86400000,'FAQ_VERIFICATION_TTL_REQUIRED');
  const next={...draft,status:approved?'QA_REVIEWED':'QA_REJECTED',
    reviewer:reviewer.actor_id,reviewed_at_ms:now_ms,valid_until_ms};
  states.set(k,next);
  return Object.freeze({version:next.version,status:next.status,key,no_send:true,production_published:false});
 }
 function preview(ctx,{key,now_ms}){
  qaContext(ctx);checkKey(key);assert(positiveInt(now_ms),'INVALID_FAQ_LOOKUP');
  const record=states.get(id(ctx,key));
  if(!record)return Object.freeze({status:'NO_VERIFIED_FAQ',reply:null});
  if(record.status!=='QA_REVIEWED'||record.valid_until_ms<=now_ms)
   return Object.freeze({status:'NOT_VERIFIED_OR_EXPIRED',reply:null});
  return Object.freeze({status:'QA_VERIFIED_PREVIEW',reply:record.value,version:record.version,
    store_scope_verified_from_qa_context:true,model_called:false,no_send:true});
 }
 function history(ctx,{key}){qaContext(ctx);checkKey(key);const v=states.get(id(ctx,key));return v?Object.freeze({
   version:v.version,key:v.key,status:v.status,creator:v.creator,reviewer:v.reviewer,
   valid_until_ms:v.valid_until_ms,source:'SYNTHETIC_MEMORY_ONLY'
  }):null;}
 return Object.freeze({edit,review,preview,history,stage:STAGE});
}
export function faqStudioUiContract(){return Object.freeze({
 title:'FAQ Studio',tabs:['Ban nhap','Cho kiem tra','Da xac minh','Het hieu luc'],
 editable_keys:FAQ_KEYS,requires_review:true,commit_target:'NONE_NO_SEND',
 host_data_cms_integrated:false,mobile_first_design:'PROPOSED_ONLY'
});}
