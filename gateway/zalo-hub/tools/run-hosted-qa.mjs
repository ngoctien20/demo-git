// Run the isolated staged QA endpoint; the bearer key and continuation state are never printed.
// Usage: node tools/run-hosted-qa.mjs <https-worker-origin> <key-file> <report-file>
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const [origin, keyPath, reportPath] = process.argv.slice(2);
if (!origin || !keyPath || !reportPath) throw new Error('USAGE: origin key-file report-file');
const url = new URL(origin);
if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash || url.port || url.hostname !== 'tien404-zalo-lite-qa.tienmobi208.workers.dev') {
  throw new Error('ONLY_THE_ISOLATED_QA_WORKER_IS_ALLOWED');
}
const key = readFileSync(keyPath,'utf8').trim();
if (key.length < 32) throw new Error('INVALID_QA_KEY');
const health = await fetch(new URL('/health',url),{signal:AbortSignal.timeout(15000)});
const healthBody = await health.json();
if (!health.ok || healthBody.outbound_mode !== 'IN_MEMORY_STUB_ONLY' || healthBody.protocol !== 'staged-v1') throw new Error('QA_HEALTH_CHECK_FAILED');

let state, report;
const timings=[];
for (let requestNumber=1; requestNumber<=50; requestNumber++) {
  const started=Date.now();
  // Do not retry a request with an unknown outcome. A fresh QA run is safer.
  const response=await fetch(new URL('/qa/run',url),{
    method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+key},
    body:JSON.stringify(state?{state}:{}),signal:AbortSignal.timeout(25000),
  });
  let body;
  try { body=await response.json(); } catch { throw new Error('QA_RESPONSE_NOT_JSON_HTTP_'+response.status); }
  timings.push({request:requestNumber,status:response.status,duration_ms:Date.now()-started});
  if (body.done===true && body.report) { report=body.report; break; }
  if (!response.ok || body.done!==false || typeof body.state!=='string') {
    // Fixed error codes only; neither arbitrary response contents nor bearer data are logged.
    throw new Error('QA_STEP_FAILED_HTTP_'+response.status);
  }
  state=body.state;
  console.log(JSON.stringify({request:requestNumber,step:body.progress?.step,total:body.progress?.total,status:response.status}));
}
if (!report) throw new Error('QA_STEP_LIMIT_REACHED');
report.execution_environment='Cloudflare Workers + D1; Zalo/n8n providers simulated';
report.worker_origin=url.origin;
report.http_requests=timings;
report.health=healthBody;
mkdirSync(dirname(reportPath),{recursive:true});
writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({ok:report.ok,totals:report.totals,observations:report.observations,ai_smoke:report.ai_smoke,requests:timings.length}));
if (!report.ok) process.exitCode=1;
