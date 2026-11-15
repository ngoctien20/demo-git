'use strict';
/**
 * V14.8 offline CPU-only routing benchmark.
 * No provider, network, LLM, database, encryption keys or real customer data.
 * It does NOT measure n8n, browser delivery, Supabase, Workers or real webhook latency.
 */
const {buildResolver}=require('./unified-identity-resolver.cjs');
const {performance}=require('node:perf_hooks');
const {createHmac}=require('node:crypto');
const SECRET=Buffer.from('V148_BENCHMARK_FAKE_SIGNER_NOT_META_OR_ZALO_20261116');
const now=Date.parse('2026-11-16T09:00:00Z');
const origin=[
 ['messenger','meta','PAGE_A','BOT_A','STORE_QA_A','TENANT_QA_1'],
 ['messenger','meta','PAGE_B','BOT_B','STORE_QA_B','TENANT_QA_1'],
 ['zalo_bot','zalo','ZBOT_C','BOT_C','STORE_QA_C','TENANT_QA_2'],
 ['zalo_oa','zalo','ZOA_A','BOT_OA_A','STORE_QA_A','TENANT_QA_1'],
 ['website_widget','firstparty','WEBSITE_B','WIDGET_B','STORE_QA_B','TENANT_QA_1']
];
const bindings=origin.map(([channel,provider,account,bot,store,tenant],i)=>({
 id:'BINDING_QA_BENCH_'+i,tenant_id:tenant,store_id:store,
 bot_profile_id:'BOT_QA_PROFILE_'+i,
 channel,provider,environment:'qa',provider_account_ref:account,provider_bot_ref:bot,
 status:'active',binding_version:1,config_version:1,subscription_active:true,
 store_active:true,can_process:true,can_send:false,
 greeting:'Xin chào cửa hàng QA',hours:'08:00–21:00'
}));
const catalog=[
 {store_id:'STORE_QA_A',sku:'A002',name:'Áo trắng QA A',price_vnd:159000,stock:25,active:true},
 {store_id:'STORE_QA_B',sku:'A002',name:'Áo trắng QA B',price_vnd:209000,stock:8,active:true},
 {store_id:'STORE_QA_C',sku:'C001',name:'Sản phẩm QA C',price_vnd:99000,stock:12,active:true}
];
const opts={mode:'OFFLINE_SYNTHETIC_NO_SEND',adapterSecret:SECRET,bindings,products:catalog,now:()=>now};
let serial=0;
function input(binding,text){
 const b=typeof binding==='number'?bindings[binding]:binding;
 const item={event_id:'B_'+(++serial),trace_id:'TRACE_BENCH',channel:b.channel,provider:b.provider,
  environment:'qa',provider_account_ref:b.provider_account_ref,provider_bot_ref:b.provider_bot_ref,
  provider_user_ref:'QA_SYNTHETIC_USER',provider_conversation_ref:'CONV_BENCH',
  event_type:'message',occurred_at:now,text};
 const rawBody=Buffer.from(JSON.stringify(item));
 return {rawBody,signature:'sha256='+createHmac('sha256',SECRET).update(rawBody).digest('hex')};
}
function percentile(sorted,p){return sorted[Math.min(sorted.length-1,Math.ceil(sorted.length*p)-1)];}
function bench(label,total,selector,{cold=false}={}){
 const warm=buildResolver(opts),times=[];
 let errors=0;
 for(let i=0;i<total;i++){
  const f=input(...selector(i));
  const t0=performance.now();
  const g=cold?buildResolver(opts):warm;
  const res=g.route(f);
  times.push(performance.now()-t0);
  if(!res.trusted||res.can_send!==false||res.provider_sends!==0)errors++;
 }
 times.sort((a,b)=>a-b);
 const out={label,iterations:total,cold,cpu_only:true,p50_ms:+percentile(times,0.5).toFixed(4),
  p95_ms:+percentile(times,0.95).toFixed(4),p99_ms:+percentile(times,0.99).toFixed(4),
  max_ms:+times[times.length-1].toFixed(4),error_count:errors,
  provider_messages_sent:0,hosted_writes:0,real_llm_requests:0};
 if(errors)process.exitCode=1;
 return out;
}
const all=[
 bench('greeting_warm_100',100,i=>[i%5,'Xin chào']),
 bench('catalog_warm_100',100,i=>[i%5===2?2:i%5, i%5===2?'Báo giá C001':'Shop có sản phẩm A002 không?']),
 bench('quote_warm_100',100,i=>[i%5===2?2:i%5, i%5===2?'Báo giá C001':'Báo giá A002']),
 bench('multi_channel_warm_500',500,i=>[i%5,i%5===2?'Báo giá C001':'Báo giá A002']),
 bench('greeting_cold_100',100,i=>[i%5,'Xin chào'],{cold:true}),
 bench('catalog_cold_100',100,i=>[i%5, i%5===2?'Báo giá C001':'Shop có sản phẩm A002 không?'],{cold:true}),
 bench('quote_cold_100',100,i=>[i%5, i%5===2?'Báo giá C001':'Báo giá A002'],{cold:true})
];
const summary={benchmark:'TIEN404_V14_8_SYNTHETIC_CPU_BENCH_V1',sample_count:all.reduce((n,x)=>n+x.iterations,0),
 on_platform_n8n:false,measured_real_meta_or_zalo_latency:false,measured_real_ai_latency:false,
 methodology:'Node perf_hooks includes candidate signature validation, binding resolution, in-memory catalog and route; excludes payload-signing fixture setup; one run of each test; noisy CI shared runner',
 scenarios:all};
console.log(JSON.stringify(summary,null,2));
if(process.env.GITHUB_STEP_SUMMARY){
 const fs=require('node:fs');
 fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,'## TIEN404 V14.8 CPU-only candidate benchmark\n\n'+
  '|Case|N|p50 ms|p95 ms|p99 ms|Errors|\n|---|---:|---:|---:|---:|---:|\n'+
  all.map(x=>'|'+x.label+'|'+x.iterations+'|'+x.p50_ms+'|'+x.p95_ms+'|'+x.p99_ms+'|'+x.error_count+'|').join('\n')+
  '\n\n**Not real provider or n8n latency. No production SLO certification.**\n');
}
