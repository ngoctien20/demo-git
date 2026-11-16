import {STAGE,qaContext,qaScope,assert,exact,positiveInt} from './qa-contract.mjs';
/** FAQ Studio is a synthetic in-memory state machine, not a hosted CMS or publisher.
 * Only pre-enrolled synthetic content is accepted; no real phone/address/prices/stock.
 */
export const FAQ_KEYS=Object.freeze(['GREETING','HOURS','SHOP_STATUS','SUPPORT_POLICY']);
const VALUES=Object.freeze({
 GREETING:['Xin chao tu Shop QA A','Xin chao tu Shop QA B','Xin chao tu Shop QA C'],
 HOURS:['QA_OPEN_08_20','QA_OPEN_09_18','QA_HOURS_UNVERIFIED'],
 SHOP_STATUS:['QA_OPEN','QA_PAUSED'],
 SUPPORT_POLICY:['QA_HANDOFF_REQUIRED','QA_REPLY_LATER']
});
export function createFaqStudio(){
 const states=new Map();
 function edit(ctx,{key,value,expected_version}){
  const actor=qaContext(ctx,['owner','manager']);
  assert(FAQ_KEYS.includes(key)&&VALUES[key].includes(value),'FAQ_SYNTHETIC_VALUE_ONLY');
  assert(positiveInt(expected_version),'FAQ_EXPECTED_VERSION_REQUIRED');
  const scope=qaScope(ctx),current=states.get(scope);
  const version=current?.version||0;
  assert(expected_version===version,'FAQ_VERSION_CONFLICT');
  const draft={version:version+1,key,value,scope,creator:actor.actor_id,
   status:'DRAFT_QA',reviewer:null,reviewed_at_ms:null,valid_until_ms:null};
  states.set(scope,draft);
  return Object.freeze({version:draft.version,status:draft.status,key:draft.key,no_send:true});
 }
 function review(ctx,{version,approved,valid_until_ms,now_ms}){
  const reviewer=qaContext(ctx,['reviewer']);
  const scope=qaScope(ctx),draft=states.get(scope);
  assert(draft&&draft.version===version&&draft.status==='DRAFT_QA','FAQ_DRAFT_NOT_FOUND_OR_STALE');
  assert(draft.creator!==reviewer.actor_id,'INDEPENDENT_REVIEW_REQUIRED');
  assert(approved===true||approved===false,'EXPLICIT_REVIEW_REQUIRED');
  assert(positiveInt(now_ms)&&positiveInt(valid_until_ms)&&valid_until_ms>now_ms&&
   valid_until_ms-now_ms<=86400000,'FAQ_VERIFICATION_TTL_REQUIRED');
  const next={...draft,status:approved?'QA_REVIEWED':'QA_REJECTED',
    reviewer:reviewer.actor_id,reviewed_at_ms:now_ms,valid_until_ms};
  states.set(scope,next);
  return Object.freeze({version:next.version,status:next.status,no_send:true,production_published:false});
 }
 function preview(ctx,{key,now_ms}){
  qaContext(ctx);assert(FAQ_KEYS.includes(key)&&positiveInt(now_ms),'INVALID_FAQ_LOOKUP');
  const record=states.get(qaScope(ctx));
  if(!record||record.key!==key)return Object.freeze({status:'NO_VERIFIED_FAQ',reply:null});
  if(record.status!=='QA_REVIEWED'||record.valid_until_ms<=now_ms)
   return Object.freeze({status:'NOT_VERIFIED_OR_EXPIRED',reply:null});
  return Object.freeze({status:'QA_VERIFIED_PREVIEW',reply:record.value,version:record.version,
    store_scope_verified_from_qa_context:true,model_called:false,no_send:true});
 }
 function history(ctx){qaContext(ctx);const v=states.get(qaScope(ctx));return v?Object.freeze({
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
