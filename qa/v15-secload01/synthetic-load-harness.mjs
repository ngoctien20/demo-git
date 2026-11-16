#!/usr/bin/env node
/**
 * TIEN404 V15 SECLOAD synthetic-only capacity benchmark.
 *
 * IMPORTANT: Results measure Node.js in-process MOCK, not real n8n, Meta,
 * Supabase, AI provider, commercial SLA, or production throughput.
 *
 * Workload levels refer to simulated concurrent conversations, not requests
 * to any third party. Zero network, zero provider/model calls and zero writes
 * outside this process except the optional local JSON report file.
 */
import {performance} from 'node:perf_hooks';
import {writeFileSync} from 'node:fs';
import {createQACommerce,syntheticEvent} from './synthetic-security-core.mjs';
const levels=Object.freeze([
 {name:'L1',concurrent:1,requests:40},
 {name:'L2',concurrent:5,requests:50},
 {name:'L3',concurrent:10,requests:60},
 {name:'L4',concurrent:25,requests:100},
 {name:'L5',concurrent:50,requests:150},
 {name:'L6',concurrent:100,requests:200}
]);
const quantile=(xs,p)=>{const a=xs.toSorted((a,b)=>a-b),i=(a.length-1)*p,
 lo=Math.floor(i),hi=Math.ceil(i);return lo===hi?a[lo]:a[lo]*(hi-i)+a[hi]*(i-lo)};
const round=x=>Math.round(x*100)/100;
function sanitizeFinite(v){return Number.isFinite(v)?round(v):null}
async function runLevel(cfg){
 const svc=createQACommerce({mockModelMs:9,rateLimit:10000});
 const start=performance.now();
 let cursor=0;
 const completed=[];
 const queue=Array.from({length:cfg.requests},(_,i)=>({
  id:i,queuedAt:performance.now()
 }));
 async function worker(){
  for(;;){
   const i=cursor++;
   if(i>=queue.length)break;
   const req=queue[i],began=performance.now();
   const page=i%3===2?'OA-C':i%3===1?'PAGE-B':'PAGE-A';
   const channel=page==='OA-C'?'ZALO':'MESSENGER';
   const expected=page==='PAGE-A'?159000:page==='PAGE-B'?259000:359000;
   const event=syntheticEvent({page,channel,sender:'QA-SENDER-'+String(i%cfg.concurrent),
    messageId:'SECLD-'+cfg.name+'-'+i,text:'read-only quote A002'});
   const ingStart=performance.now();
   const incoming=svc.ingress(event);
   const ingFinish=performance.now();
   let result,ok=false;
   if(incoming.status===200){
    const quote=svc.quote(incoming.ctx,'A002');
    const mock=await svc.syntheticAgent(incoming.ctx);
    result=mock.status;
    ok=quote.status===200&&quote.price===expected&&quote.store===incoming.ctx.store&&
      mock.status===200;
   }else result=incoming.status;
   completed.push({
    ok,result,
    queueWaitMs:began-req.queuedAt,
    signatureRouteMs:ingFinish-ingStart,
    latencyMs:performance.now()-began
   });
  }
 }
 await Promise.all(Array.from({length:cfg.concurrent},()=>worker()));
 const wallMs=performance.now()-start;
 const error=completed.filter(x=>!x.ok).length;
 if(completed.length!==cfg.requests||error||
    svc.stats().providerSends||svc.stats().realOrderWrites||
    svc.stats().syntheticOrders||svc.stats().modelCalls!==cfg.requests)
  throw Error('SECLD_MOCK_FAIL_'+cfg.name);
 const latency=completed.map(x=>x.latencyMs),
  ack=completed.map(x=>x.signatureRouteMs),
  queueWait=completed.map(x=>x.queueWaitMs);
 return{
  scenario:cfg.name,
  model:'SYNTHETIC_NODEJS_MOCK_NOT_N8N',
  simulatedConversations:cfg.concurrent,
  requests:cfg.requests,
  durationMs:round(wallMs),
  internalMockRps:round(cfg.requests/(wallMs/1000)),
  internalMockRpm:round(cfg.requests/(wallMs/60000)),
  requestSuccessPct:round(100*(cfg.requests-error)/cfg.requests),
  failures:error,
  mockLatencyP50Ms:round(quantile(latency,.50)),
  mockLatencyP95Ms:round(quantile(latency,.95)),
  mockLatencyP99Ms:round(quantile(latency,.99)),
  syntheticSignatureRouteP95Ms:round(quantile(ack,.95)),
  mockQueueWaitP95Ms:round(quantile(queueWait,.95)),
  simulated429:completed.filter(x=>x.result===429).length,
  simulated5xx:completed.filter(x=>x.result>=500).length,
  realMetaDeliveries:0,
  realAiProviderCalls:0,
  realOrdersWritten:0,
  metaDeliveryP95Ms:null,
  n8nExecutionP95Ms:null,
  actualProductionRps:null
 };
}
export async function runSyntheticLoad(){
 const entries=[];
 for(const cfg of levels)entries.push(await runLevel(cfg));
 return{
  contract:'TIEN404_V15_SECLOAD01_SYNTHETIC_CAPACITY_V1',
  createdAtUtc:new Date().toISOString(),
  runner:'NODE_JS_LOCAL_CI_NO_NETWORK',
  hardBoundary:'DO_NOT_USE_FOR_PRODUCTION_CAPACITY_CERTIFICATION',
  requestCount:entries.reduce((s,r)=>s+r.requests,0),
  scenarioCount:entries.length,
  providerMessagesSent:0,
  paidModelCalls:0,
  realOrdersWritten:0,
  realDbTransactions:0,
  currencyCostEstimate:null,
  scenarios:entries
 };
}
if(import.meta.url===new URL('file://'+process.argv[1]).href){
 const report=await runSyntheticLoad();
 if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n',{flag:'w'});
 for(const r of report.scenarios)
  console.log(JSON.stringify({level:r.scenario,syntheticUsers:r.simulatedConversations,
   n:r.requests,mockP50Ms:r.mockLatencyP50Ms,mockP95Ms:r.mockLatencyP95Ms,
   mockP99Ms:r.mockLatencyP99Ms,internalMockRps:r.internalMockRps,
   failures:r.failures}));
 console.log('PASS SYNTHETIC_SECLD ONLY; requests='+report.requestCount+
  '; providerMessagesSent=0, realOrdersWritten=0, actualProductionRps=NOT_MEASURED');
}
