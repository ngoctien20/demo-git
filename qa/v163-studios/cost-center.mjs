import {STAGE,qaContext,qaScope,qaEvent,assert,positiveInt} from './qa-contract.mjs';
/** In-memory synthetic unit accounting, never a billing ledger or durable hard cap.
 * All money below is INTEGER micro-USD, not VND, no external API called.
 */
export function createCostCenter(){
 const stores=new Map();
 const key=(ctx,id)=>qaScope(ctx)+'|'+qaEvent(id);
 function configure(ctx,{cap_micro_usd,expected_version=0}){
  qaContext(ctx,['owner','manager']);
  assert(positiveInt(cap_micro_usd)&&cap_micro_usd>0&&positiveInt(expected_version),'INVALID_BUDGET');
  const s=qaScope(ctx),old=stores.get(s),version=old?.version||0;
  assert(expected_version===version,'BUDGET_VERSION_CONFLICT');
  assert(!old||old.committed+old.reserved<=cap_micro_usd,'BUDGET_BELOW_COMMITTED_OR_RESERVED');
  const state=old?{...old,cap:cap_micro_usd,version:version+1}:{cap:cap_micro_usd,version:1,
     committed:0,reserved:0,events:new Map(),warnings:new Set()};
  stores.set(s,state);
  return {version:state.version,status:'QA_BUDGET_CONFIGURED',persistent:false,no_billing:true};
 }
 function alerts(state){
  const percent=100*(state.reserved+state.committed)/state.cap;
  const fired=[];
  for(const threshold of [70,90,100])if(percent>=threshold&&!state.warnings.has(threshold)){
   state.warnings.add(threshold);fired.push(threshold);
  }
  return fired;
 }
 function reserve(ctx,{event_id,max_micro_usd}){
  qaContext(ctx,['system']);qaEvent(event_id);
  assert(positiveInt(max_micro_usd)&&max_micro_usd>0,'INVALID_RESERVATION');
  const s=stores.get(qaScope(ctx));
  assert(s,'SHOP_BUDGET_NOT_CONFIGURED');
  const id=key(ctx,event_id),prior=s.events.get(id);
  if(prior)return {status:'DUPLICATE_RESERVATION',state:prior.status,
    accepted:prior.status!=='DENIED',no_api_call:true};
  if(s.committed+s.reserved+max_micro_usd>s.cap){
   s.events.set(id,{status:'DENIED',max:0,settled:0});
   return {status:'HARD_CAP_BLOCKED_SYNTHETIC',accepted:false,alerts:[],
     no_api_call:true,needs_fallback:true};
  }
  s.events.set(id,{status:'RESERVED',max:max_micro_usd,settled:0});
  s.reserved+=max_micro_usd;
  return {status:'RESERVED_QA',accepted:true,alerts:alerts(s),no_api_call:true};
 }
 function settle(ctx,{event_id,used_micro_usd}){
  qaContext(ctx,['system']);qaEvent(event_id);
  assert(positiveInt(used_micro_usd),'INVALID_SETTLEMENT');
  const s=stores.get(qaScope(ctx));assert(s,'SHOP_BUDGET_NOT_CONFIGURED');
  const item=s.events.get(key(ctx,event_id));assert(item,'RESERVATION_REQUIRED');
  if(item.status==='SETTLED')return {status:'DUPLICATE_SETTLEMENT',charged_again:false};
  assert(item.status==='RESERVED'&&used_micro_usd<=item.max,'SETTLEMENT_EXCEEDS_RESERVATION');
  item.status='SETTLED';item.settled=used_micro_usd;s.reserved-=item.max;s.committed+=used_micro_usd;
  return {status:'QA_SETTLED_ESTIMATE',refund_micro_usd:item.max-used_micro_usd,
    alerts:alerts(s),is_real_provider_spend:false,provider_invoice_verified:false};
 }
 function release(ctx,{event_id}){
  qaContext(ctx,['system']);qaEvent(event_id);
  const s=stores.get(qaScope(ctx));assert(s,'SHOP_BUDGET_NOT_CONFIGURED');
  const item=s.events.get(key(ctx,event_id));assert(item,'RESERVATION_REQUIRED');
  if(item.status==='RELEASED')return {status:'DUPLICATE_RELEASE'};
  assert(item.status==='RESERVED','CANNOT_RELEASE_SETTLED');
  s.reserved-=item.max;item.status='RELEASED';return {status:'QA_RELEASED',refund_micro_usd:item.max};
 }
 function snapshot(ctx){
  qaContext(ctx,['owner','manager','reviewer']);
  const s=stores.get(qaScope(ctx));if(!s)return {status:'NOT_CONFIGURED'};
  return Object.freeze({status:'QA_BUDGET_PREVIEW',version:s.version,cap_micro_usd:s.cap,
   reserved_micro_usd:s.reserved,estimated_spent_micro_usd:s.committed,
   headroom_micro_usd:s.cap-s.reserved-s.committed,warning_levels:[...s.warnings].sort((a,b)=>a-b),
   actual_cost_usd:null,merchant_invoice:null,hard_cap_durable:false,stage:STAGE});
 }
 return Object.freeze({configure,reserve,settle,release,snapshot});
}
