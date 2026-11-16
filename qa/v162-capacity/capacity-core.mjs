/** V16.2 — offline only. No network, secrets, provider, customer data or writes. */
export const LEVELS=Object.freeze(['Economy','Standard','Priority']);
export const METRICS=Object.freeze(['webhook_ack_ms','queue_wait_ms','ai_inference_ms','catalog_read_ms','tool_execution_ms','provider_send_ms','customer_reply_e2e_ms']);
export const NO_PROOF=null;
const VALID_MODES=new Set(['webhook','manual','integrated','synthetic','evaluation']);
const VALID_CHANNELS=new Set(['messenger','zalo','website']);
const allowed=new Set(['trace_id','source_kind','execution_mode','execution_success','channel','tenant_tag','store_tag','intent','error_class','provider_accepted','provider_delivery_verified','model_input_tokens','model_output_tokens','cost_actual_usd',...METRICS]);
const qaTag=v=>typeof v==='string'&&/^QA_[A-Z0-9_]{1,40}$/.test(v);
function numericOrNull(v){return v===null||(typeof v==='number'&&Number.isFinite(v)&&v>=0)}
export function sanitizeTrace(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(x=>!allowed.has(x)))throw Error('UNKNOWN_TRACE_FIELD_PII_GUARD');
 if(!qaTag(input.trace_id)||!qaTag(input.tenant_tag)||!qaTag(input.store_tag))throw Error('PSEUDONYM_REQUIRED');
 if(!VALID_MODES.has(input.execution_mode)||!VALID_CHANNELS.has(input.channel)||!['LOCAL_SYNTHETIC','N8N_METADATA_READONLY'].includes(input.source_kind))throw Error('INVALID_TRACE_KIND');
 if(typeof input.execution_success!=='boolean'||typeof input.provider_accepted!=='boolean')throw Error('UNKNOWN_EXECUTION_OUTCOME');
 if(input.provider_delivery_verified!==false)throw Error('PROVIDER_DELIVERY_PROOF_UNAVAILABLE');
 for(const k of METRICS)if(!numericOrNull(input[k]??null))throw Error('INVALID_STAGE_METRIC');
 if(input.customer_reply_e2e_ms!==null&&input.customer_reply_e2e_ms!==undefined)throw Error('NO_CUSTOMER_E2E_PROOF');
 for(const k of ['model_input_tokens','model_output_tokens','cost_actual_usd'])if(!numericOrNull(input[k]??null))throw Error('INVALID_USAGE_METRIC');
 if(input.source_kind==='LOCAL_SYNTHETIC'&&input.cost_actual_usd!=null)throw Error('MOCK_IS_NOT_REAL_COST');
 if(input.intent!==null&&input.intent!==undefined&&!/^[a-z_]{1,24}$/.test(input.intent))throw Error('INVALID_INTENT');
 if(input.error_class!==null&&input.error_class!==undefined&&!/^[A-Z_]{1,36}$/.test(input.error_class))throw Error('INVALID_ERROR_CLASS');
 return Object.freeze(Object.fromEntries([...allowed].map(k=>[k,input[k]??null])));
}
export function percentile(vals,p){
 if(!Array.isArray(vals)||!Number.isFinite(p)||p<0||p>1)throw Error('INVALID_PERCENTILE');
 const a=vals.filter(x=>typeof x==='number'&&Number.isFinite(x)&&x>=0).sort((a,b)=>a-b);
 return a.length?a[Math.max(0,Math.ceil(a.length*p)-1)]:null;
}
export function summarize(traces,stage,{minimumSample=100,sourceKind=null,executionMode=null}={}){
 if(!METRICS.includes(stage))throw Error('INVALID_STAGE');
 const selected=traces.filter(x=>(sourceKind===null||x.source_kind===sourceKind)&&(executionMode===null||x.execution_mode===executionMode));
 const values=selected.map(x=>x[stage]).filter(x=>x!==null);
 return {stage,samples:values.length,executions:selected.length,coverage:selected.length?values.length/selected.length:null,
  p50:percentile(values,.5),p90:percentile(values,.9),p95:percentile(values,.95),p99:percentile(values,.99),
  productionCertified:false,adequateForExploration:values.length>=minimumSample};
}
const QUALITY_STATUS=new Set(['PASS','FAIL','BLOCKED','NOT_RUN']);
export function qualityVerdict(row){
 if(!row||typeof row!=='object'||typeof row.case_id!=='string')throw Error('INVALID_QA_CASE');
 const output=String(row.actual_output??'').trim();
 if(!output)return {case_id:row.case_id,status:'NOT_RUN',reason:'EMPTY_ACTUAL_OUTPUT'};
 const decision=row.reviewer_status;
 if(!QUALITY_STATUS.has(decision)||!row.execution_evidence||!row.catalog_fixture_version||!row.tool_trace_evidence)
  return {case_id:row.case_id,status:'BLOCKED',reason:'INDEPENDENT_EVIDENCE_MISSING'};
 if(decision==='PASS')return {case_id:row.case_id,status:'BLOCKED',reason:'EXTERNAL_INDEPENDENT_ACCEPTANCE_REQUIRED'};
 return {case_id:row.case_id,status:decision,reason:'REVIEW_PENDING_INDEPENDENT_ACCEPTANCE'};
}
/** Weighted round robin over active tier queues; order is deterministic, never bypasses per-shop cap. */
export function scheduleSynthetic({jobs,slots=10,perShopCaps={Economy:1,Standard:2,Priority:5},weights={Economy:1,Standard:2,Priority:4}}){
 if(!Array.isArray(jobs)||!Number.isSafeInteger(slots)||slots<1||slots>100)throw Error('BAD_SCHEDULER_INPUT');
 const queues=Object.fromEntries(LEVELS.map(x=>[x,[]]));
 for(const j of jobs){if(!LEVELS.includes(j.tier)||!qaTag(j.store)||!qaTag(j.id))throw Error('BAD_SYNTHETIC_JOB');queues[j.tier].push(j)}
 const picked=[],byStore=new Map(),cycles=Math.min(100000,jobs.length+1);
 for(let loop=0;loop<cycles&&picked.length<slots;loop++){
  let progress=false;
  for(const tier of LEVELS){
   const queue=queues[tier],quota=weights[tier],cap=perShopCaps[tier];
   if(!Number.isInteger(quota)||quota<1||!Number.isInteger(cap)||cap<1)throw Error('BAD_TIER_POLICY');
   let attempts=queue.length;
   for(let j=0;j<quota&&attempts>0&&queue.length&&picked.length<slots;){
    const item=queue.shift();attempts--;
    if((byStore.get(item.store)||0)>=cap){queue.push(item);continue}
    picked.push(item);byStore.set(item.store,(byStore.get(item.store)||0)+1);progress=true;j++;
   }
  }
  if(!progress)break;
 }
 return {scheduled:picked.map(x=>x.id),perTier:Object.fromEntries(LEVELS.map(t=>[t,picked.filter(x=>x.tier===t).length])),pending:jobs.length-picked.length,
   provenance:'DETERMINISTIC_OFFLINE_SCHEDULER_ONLY',realThroughputRps:null,realLatencyP95Ms:null};
}
export function demandEstimate(activeUsers,messagesPerActiveUserMinute,aiRatio,aiDurationSeconds){
 const a=[activeUsers,messagesPerActiveUserMinute,aiRatio,aiDurationSeconds];
 if(a.some(x=>!Number.isFinite(x)||x<0)||aiRatio>1)throw Error('BAD_DEMAND_ASSUMPTION');
 const messagesPerMinute=activeUsers*messagesPerActiveUserMinute,aiCallsPerMinute=messagesPerMinute*aiRatio;
 return {messagesPerMinute,aiCallsPerMinute,aiInFlightExpected:aiCallsPerMinute*aiDurationSeconds/60,
  status:'ASSUMPTION_NOT_MEASURED_CAPACITY'};
}
