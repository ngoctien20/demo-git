import {STAGE,qaContext,qaScope,qaEvent,assert,qaId} from './qa-contract.mjs';
export const HANDOFF_REASONS=Object.freeze(['HUMAN_REQUEST','LOW_CONFIDENCE','REPEATED_FAILURE','COMPLAINT','ORDER_BLOCKED','SAFETY']);
/** Preview ticket state machine. Never persists actual customer conversations or notifies staff. */
export function createHandoffPreview(){
 const cases=new Map();
 const key=(ctx,id)=>qaScope(ctx)+'|'+qaEvent(id);
 function open(ctx,{case_id,reason,customer_consent}){
  const actor=qaContext(ctx,['system']);
  assert(HANDOFF_REASONS.includes(reason),'UNSAFE_HANDOFF_REASON');
  assert(customer_consent===true||reason==='SAFETY','HANDOFF_CONSENT_REQUIRED');
  const id=key(ctx,case_id);
  const old=cases.get(id);
  if(old)return Object.freeze({status:'DUPLICATE_PREVIEW_CASE',case_id:old.case_id,staff_notified:false});
  const record={tenant_id:actor.tenant_id,store_id:actor.store_id,case_id,reason,
     status:'QA_OPEN',assigned_staff:null,opened_by:actor.actor_id};
  cases.set(id,record);
  return Object.freeze({status:record.status,case_id,staff_notified:false,pii_stored:false,
    provider_message_sent:false,customer_consent_verified_in_qa:customer_consent});
 }
 function assign(ctx,{case_id,staff_id}){
  const actor=qaContext(ctx,['owner','manager']);
  assert(qaId(staff_id),'STAFF_QA_ID_REQUIRED');
  const record=cases.get(key(ctx,case_id));assert(record,'HANDOFF_CASE_NOT_IN_SHOP');
  assert(record.status==='QA_OPEN','HANDOFF_NOT_OPEN');
  record.assigned_staff=staff_id;record.status='QA_ASSIGNED';
  return Object.freeze({status:record.status,staff_id,real_staff_notified:false});
 }
 function resolve(ctx,{case_id,resolution}){
  const actor=qaContext(ctx,['staff','owner','manager']);
  assert(['RESOLVED_QA','UNRESOLVED_QA'].includes(resolution),'INVALID_RESOLUTION');
  const record=cases.get(key(ctx,case_id));assert(record,'HANDOFF_CASE_NOT_IN_SHOP');
  assert(record.status==='QA_ASSIGNED','HANDOFF_NOT_ASSIGNED');
  assert(actor.role!=='staff'||actor.actor_id===record.assigned_staff,'ASSIGNEE_ONLY');
  record.status=resolution;
  return Object.freeze({case_id,status:record.status,customer_notified:false,order_written:false});
 }
 function preview(ctx,{case_id}){
  qaContext(ctx,['staff','owner','manager','reviewer']);
  const record=cases.get(key(ctx,case_id));
  if(!record)return {status:'NOT_FOUND_OR_NOT_AUTHORIZED'};
  return Object.freeze({case_id:record.case_id,reason:record.reason,
    status:record.status,assigned_staff:record.assigned_staff,no_customer_data:true,
    is_live_ticket:false,stage:STAGE});
 }
 return Object.freeze({open,assign,resolve,preview});
}
export function shouldHandoff({intent,confidence,failed_attempts=0,user_wants_human=false}){
  assert(typeof intent==='string'&&/^[A-Z_]{3,32}$/.test(intent),'HANDOFF_INTENT_CODE_ONLY');
  assert(Number.isFinite(confidence)&&confidence>=0&&confidence<=1,'INVALID_CONFIDENCE');
  assert(Number.isInteger(failed_attempts)&&failed_attempts>=0,'INVALID_FAILURE_COUNT');
  const reasons=[];
  if(user_wants_human===true)reasons.push('HUMAN_REQUEST');
  if(confidence<.65)reasons.push('LOW_CONFIDENCE');
  if(failed_attempts>=2)reasons.push('REPEATED_FAILURE');
  if(intent==='COMPLAINT')reasons.push('COMPLAINT');
  if(intent==='ORDER_BLOCKED')reasons.push('ORDER_BLOCKED');
  return {route:reasons.length?'HANDOFF_PREVIEW_ONLY':'AI_OR_FAQ_PREVIEW',
    reasons,create_live_ticket:false,send_notification:false};
}
