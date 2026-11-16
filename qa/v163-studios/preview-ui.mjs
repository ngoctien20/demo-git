import {STAGE} from './qa-contract.mjs';
import {createFaqStudio} from './faq-studio.mjs';
import {createCostCenter} from './cost-center.mjs';
import {previewQueue} from './priority-dashboard.mjs';
import {createHandoffPreview} from './human-handoff.mjs';
import {build132Manifest,planAbLab,aggregateAbRows} from './model-ab-lab.mjs';
import {SINGLE_CASES,MULTI_PACK,MANIFEST_METADATA} from './manifest-132.mjs';
/** Browser preview: QA-only, ephemeral, no fetch/storage, not merchant auth. */
const byId=id=>document.getElementById(id);
const store=()=>byId('store').value;
const tenant=()=>store()==='QA_STORE_C'?'QA_TENANT_TWO':'QA_TENANT_ONE';
const ctx=(role)=>({stage:STAGE,enrolled:true,tenant_id:tenant(),store_id:store(),
 actor_id:role==='reviewer'?'QA_INDEPENDENT_REVIEWER':role==='staff'?'QA_STAFF_A':
 role==='system'?'QA_SYNTHETIC_SYSTEM':'QA_SYNTHETIC_OWNER',role});
const out=(id,data)=>byId(id).textContent=JSON.stringify(data,null,2);
const faq=createFaqStudio(),cost=createCostCenter(),handoff=createHandoffPreview();
let n=0;
const values={
 GREETING:['Xin chao tu Shop QA A','Xin chao tu Shop QA B','Xin chao tu Shop QA C'],
 HOURS:['QA_OPEN_08_20','QA_OPEN_09_18','QA_HOURS_UNVERIFIED'],
 SHOP_STATUS:['QA_OPEN','QA_PAUSED'],
 SUPPORT_POLICY:['QA_HANDOFF_REQUIRED','QA_REPLY_LATER']
};
function options(){
 const key=byId('faq-key').value;
 const opts=key==='GREETING'?values[key].filter(v=>v.endsWith(store().slice(-1))):values[key];
 byId('faq-val').replaceChildren(...opts.map(v=>{const o=document.createElement('option');o.value=v;o.textContent=v;return o}));
}
options();byId('faq-key').addEventListener('change',options);
for(const b of document.querySelectorAll('button[data-tab]')){
 b.addEventListener('click',()=>{
  for(const x of document.querySelectorAll('button[data-tab]'))x.setAttribute('aria-selected',String(x===b));
  for(const x of document.querySelectorAll('.panel'))x.classList.toggle('active',x.id==='panel-'+b.dataset.tab);
 });
}
byId('store').addEventListener('change',()=>{
 byId('store-scope').textContent='Shop synthetic: '+store()+' / '+tenant();
 options();byId('notice').textContent='Đã chuyển Shop QA, chưa có thay đổi dữ liệu thật.';
});
const safe=(fn)=>()=>{try{byId('notice').textContent='';fn()}catch(e){byId('notice').textContent=String(e?.message||'QA_DENIED')}};
byId('faq-draft').addEventListener('click',safe(()=>{
 const key=byId('faq-key').value,prev=faq.history(ctx('owner'),{key});
 out('faq-result',faq.edit(ctx('owner'),{key,value:byId('faq-val').value,expected_version:prev?.version||0}));
}));
byId('faq-review').addEventListener('click',safe(()=>{
 const key=byId('faq-key').value,prev=faq.history(ctx('owner'),{key});
 out('faq-result',faq.review(ctx('reviewer'),{key,version:prev?.version,approved:true,
   now_ms:Date.now(),valid_until_ms:Date.now()+300000}));
}));
byId('faq-preview').addEventListener('click',safe(()=>out('faq-result',faq.preview(ctx('owner'),{
 key:byId('faq-key').value,now_ms:Date.now()}))));
byId('faq-history').addEventListener('click',safe(()=>out('faq-result',faq.revisions(ctx('owner'),{
 key:byId('faq-key').value}))));
byId('cost-configure').addEventListener('click',safe(()=>{
 const p=cost.snapshot(ctx('owner'));
 out('cost-result',cost.configure(ctx('owner'),{cap_micro_usd:1000,expected_version:p.version||0}));
}));
byId('cost-reserve').addEventListener('click',safe(()=>{
 const event_id='QA_EVENT_'+(++n);
 const r=cost.reserve(ctx('system'),{event_id,max_micro_usd:350});
 if(r.accepted)cost.settle(ctx('system'),{event_id,used_micro_usd:350});
 out('cost-result',{reservation:r,ledger:cost.snapshot(ctx('owner'))});
}));
byId('queue-preview').addEventListener('click',safe(()=>{
 const now=Date.now(),shop=store(),t=tenant(),jobs=[
  {id:'QA_JOB_01',tenant_id:t,store_id:shop,tier:'Economy',enqueued_at_ms:now-1600,state:'PENDING_QA'},
  {id:'QA_JOB_02',tenant_id:t,store_id:shop,tier:'Standard',enqueued_at_ms:now-800,state:'PENDING_QA'},
  {id:'QA_JOB_03',tenant_id:t,store_id:shop,tier:'Priority',enqueued_at_ms:now-200,state:'PENDING_QA'}];
 out('queue-result',previewQueue(ctx('owner'),{jobs,now_ms:now,slots:3}));
}));
byId('handoff-open').addEventListener('click',safe(()=>{
 out('handoff-result',handoff.open(ctx('system'),{case_id:'QA_CASE_DEMO',reason:'HUMAN_REQUEST',customer_consent:true}));
}));
byId('handoff-assign').addEventListener('click',safe(()=>{
 out('handoff-result',handoff.assign(ctx('owner'),{case_id:'QA_CASE_DEMO',staff_id:'QA_STAFF_A'}));
}));
byId('handoff-close').addEventListener('click',safe(()=>{
 out('handoff-result',handoff.resolve(ctx('staff'),{case_id:'QA_CASE_DEMO',resolution:'RESOLVED_QA'}));
}));
byId('lab-preview').addEventListener('click',safe(()=>{
 const plan=planAbLab({manifest:build132Manifest({single:SINGLE_CASES,multi:MULTI_PACK})});
 out('lab-result',{case_count:plan.cases,models:plan.candidates,
  planned_evaluations:plan.planned_evaluations,
  scorecard:aggregateAbRows(plan.rows),actual_api_calls:plan.actual_api_calls,
  note:'Metadata-only manifest verified against CSV structure: 71 turns; 9 cases contain only one turn',
  manifest_stats:MANIFEST_METADATA});
}));
