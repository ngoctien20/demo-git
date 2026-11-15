'use strict';
/**
 * V14.8 reproducible OFFLINE MICROBENCHMARK only; never measure/claim real
 * Meta, Zalo, n8n scheduling, provider delivery, network RTT, or AI inference.
 * Tests 100+ greeting/catalog/quote per channel (1,200+ total).
 */
const {performance}=require('node:perf_hooks');
const {createUnifiedQaRouter,MODE}=require('./identity-core.cjs');
const {createStudio,FIXTURES,CHANNELS}=require('../v147-custom-studio/studio-core.js');
const NOW=Date.parse('2026-11-16T05:00:00+09:00');
const keys=Object.fromEntries(CHANNELS.map(c=>[c,Buffer.from(('V148_TEST_SECRET_'+c+'_').repeat(4))]));
const bindings=Object.entries(FIXTURES).flatMap(([shop,s])=>CHANNELS.map(channel=>({
 id:'binding_'+channel+'_'+shop,channel,environment:'qa_staging',
 provider_account_ref:'qa_account_'+channel+'_'+shop,
 provider_bot_ref:'qa_bot_'+channel+'_'+shop,
 tenant_id:s.tenantId,store_id:s.storeId,
 bot_profile_id:'qa_botprofile_'+shop+'_'+channel,shop,status:'ACTIVE',
 subscription_active:true,verified_until_ms:NOW+3600000,configuration_version:1
})));
function engine(){return createUnifiedQaRouter({mode:MODE,secretByChannel:keys,bindings,
 studio:createStudio(),now:()=>NOW});}
let serial=0;
const SAMPLE={
 GREETING:'Xin chào',CATALOG:'Shop có mã A001 không?',QUOTE:'Báo giá A001'
};
function event(router,channel,shop,text){
 const rec=bindings.find(b=>b.shop===shop&&b.channel===channel);
 const data={channel,environment:'qa_staging',
 provider_account_ref:rec.provider_account_ref,provider_bot_ref:rec.provider_bot_ref,
 provider_user_ref:'qa_benchmark_user',provider_conversation_ref:'qa_conversation_01',
 event_id:'qa_bench_'+String(++serial).padStart(10,'0'),
 event_type:'message',text,timestamp_ms:NOW};
 const rawBody=Buffer.from(JSON.stringify(data));
 return {channel,rawBody,signature:router.signFixture(channel,rawBody)};
}
const samples=[],groups={};
function record(group,elapsed){samples.push(elapsed);(groups[group]??=[]).push(elapsed);}
const pct=(x,p)=>{const z=[...x].sort((a,b)=>a-b);
 return Number(z[Math.min(z.length-1,Math.ceil(z.length*p)-1)].toFixed(4));};
function inspect(x){return {samples:x.length,p50_ms:pct(x,.5),p95_ms:pct(x,.95),
 p99_ms:pct(x,.99),max_ms:Number(Math.max(...x).toFixed(4))};}
const warm=engine();
for(const channel of CHANNELS){
 for(const [category,text] of Object.entries(SAMPLE)){
  for(let i=0;i<100;i++){
   const shop=['A','B','C'][i%3],f=event(warm,channel,shop,text);
   const t=performance.now(),r=warm.processSignedFixture(f),elapsed=performance.now()-t;
   if(r.status!=='RESOLVED'||r.provider_sends!==0||r.hosted_writes!==0)
    throw Error('BENCHMARK_QA_INVARIANT_FAIL '+channel+' '+category);
   record('warm|'+channel+'|'+category,elapsed);
  }
 }
}
// Cold constructor + signed ingress, 120 samples (10/channel/category).
const cold=[],coldByChannel={};
for(const channel of CHANNELS){
 for(const [category,text] of Object.entries(SAMPLE)){
  for(let i=0;i<10;i++){
   const t=performance.now(),q=engine();
   const f=event(q,channel,'A',text),r=q.processSignedFixture(f);
   const elapsed=performance.now()-t;
   if(r.status!=='RESOLVED')throw Error('COLD_QA_FAIL');
   cold.push(elapsed);(coldByChannel[channel]??=[]).push(elapsed);
  }
 }
}
const summary={
 version:'V14.8-QA-BENCH-V1',scope:'NODE_IN_PROCESS_SYNTHETIC_NO_NETWORK_NO_LLM',
 warm:inspect(samples),cold_including_constructor:inspect(cold),
 per_group:Object.fromEntries(Object.entries(groups).map(([k,v])=>[k,inspect(v)])),
 warm_per_channel:Object.fromEntries(CHANNELS.map(c=>[c,inspect(
  Object.entries(groups).filter(([k])=>k.startsWith('warm|'+c+'|'))
   .flatMap(([,v])=>v))])),
 cold_per_channel:Object.fromEntries(Object.entries(coldByChannel).map(([k,v])=>[k,inspect(v)])),
 cache_stats:warm.inspect(),comparison_with_actual_messenger:{
 valid_apples_to_apples:false,real_inference_measured:false,
 real_provider_send_latency_measured:false,hosted_database_latency_measured:false,
 real_inbound_to_customer_visible_not_measured:true
 },
 cost:{provider_sends:0,llm_api_calls:0,hosted_writes:0,
 measured_provider_billing:false,estimated_live_cost:null}
};
if(summary.warm.samples<1200||summary.cold_including_constructor.samples<120)
 throw Error('INSUFFICIENT_BENCHMARK_SAMPLES');
process.stdout.write(JSON.stringify(summary,null,2)+'\n');
