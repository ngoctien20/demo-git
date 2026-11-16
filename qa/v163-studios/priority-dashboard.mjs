import {scheduleSynthetic,percentile} from '../v162-capacity/capacity-core.mjs';
import {STAGE,TIERS,qaContext,qaId,assert,exact,positiveInt} from './qa-contract.mjs';
/** Metadata-only synthetic queue dashboard; not Cloudflare Queues or a live scheduler. */
const FIELDS=['id','tenant_id','store_id','tier','enqueued_at_ms','state'];
const STATES=['PENDING_QA','RUNNING_QA','DONE_QA','FAILED_QA'];
function validateJob(j,now){
 assert(exact(j,FIELDS),'QUEUE_METADATA_ONLY');
 assert(qaId(j.id)&&qaId(j.tenant_id)&&qaId(j.store_id),'QA_JOB_SCOPE_REQUIRED');
 assert(TIERS.includes(j.tier)&&STATES.includes(j.state),'INVALID_LANE_STATE');
 assert(positiveInt(j.enqueued_at_ms)&&j.enqueued_at_ms<=now,'INVALID_QUEUE_TIME');
}
export function previewQueue(ctx,{jobs,now_ms,slots=10}){
 const actor=qaContext(ctx,['owner','manager','reviewer']);
 assert(Array.isArray(jobs)&&jobs.length<=2000&&positiveInt(now_ms),'INVALID_QUEUE_INPUT');
 jobs.forEach(j=>validateJob(j,now_ms));
 // Manager sees a single Shop. Reviewer can aggregate only within the same tenant.
 const visible=jobs.filter(j=>j.tenant_id===actor.tenant_id&&
   (actor.role==='reviewer'||j.store_id===actor.store_id));
 const pending=visible.filter(j=>j.state==='PENDING_QA');
 const sched=scheduleSynthetic({jobs:pending.map(j=>({id:j.id,store:j.store_id,tier:j.tier})),slots});
 const lanes=Object.fromEntries(TIERS.map(tier=>{
  const all=visible.filter(j=>j.tier===tier),waiting=all.filter(j=>j.state==='PENDING_QA');
  const ages=waiting.map(j=>now_ms-j.enqueued_at_ms);
  return [tier,{pending:waiting.length,running:all.filter(j=>j.state==='RUNNING_QA').length,
    failed:all.filter(j=>j.state==='FAILED_QA').length,
    oldest_wait_ms:ages.length?Math.max(...ages):null,
    p95_pending_age_ms:percentile(ages,.95),
    admitted_in_simulation:sched.perTier[tier]}];
 }));
 const pausedShops=new Set(pending.map(j=>j.store_id));
 return Object.freeze({status:'SYNTHETIC_QUEUE_DASHBOARD_ONLY',stage:STAGE,
   tenant_scope:actor.tenant_id,store_scope:actor.role==='reviewer'?null:actor.store_id,
   lanes,pending_total:pending.length,synthetic_slots:slots,
   mock_admission:sched.scheduled.length,simulated_pending_after_admission:sched.pending,
   scoped_shops_with_pending:pausedShops.size,actual_queue_depth:null,
   actual_throughput_rpm:null,actual_customer_p95_ms:null,no_cloudflare_queue_calls:true});
}
export function priorityDashboardUiContract(){return Object.freeze({
 title:'Priority Queue Dashboard',tabs:['Hang doi','Cong bang','Su co','Danh sach cho'],
 views:['Cua hang hien tai','Tong quan an danh cho reviewer'],
 no_raw_messages:true,queue_provider_connected:false,release_status:'PROPOSED'
});}
