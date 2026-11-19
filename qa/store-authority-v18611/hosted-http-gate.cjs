'use strict';
/** TIEN404 V18.6.12: fixed-host anonymous GET-only staging acceptance.
 * Cold Render Free instances may transiently return 503. A bounded readiness
 * probe waits for valid /health before any remaining Data GET checks. This
 * does NOT certify Production availability and NEVER retries write operations.
 */
const { strict: assert } = require('node:assert');
const { setTimeout: delay } = require('node:timers/promises');
const DATA = 'https://tien404-data-staging.onrender.com';
const AUTH = 'https://tien404-auth-staging.onrender.com';
const TENANT = '11111111-1111-4111-8111-111111111111'; // inert fixture ID
const ORDER = '22222222-2222-4222-8222-222222222222'; // inert fixture ID
const CHECKS = Object.freeze([
  { id:'data_health', base:DATA, path:'/health', expected:200, kind:'health' },
  { id:'tenant_no_auth', base:DATA, path:'/api/v1/tenants', expected:401 },
  { id:'products_no_auth', base:DATA, path:`/api/v1/tenants/${TENANT}/products`, expected:401 },
  { id:'orders_no_auth', base:DATA, path:`/api/v1/tenants/${TENANT}/orders`, expected:401 },
  { id:'confirm_write_route_absent', base:DATA, path:`/api/v1/tenants/${TENANT}/orders/${ORDER}/confirm`, expected:404 },
  { id:'cancel_write_route_absent', base:DATA, path:`/api/v1/tenants/${TENANT}/orders/${ORDER}/cancel`, expected:404 },
  { id:'quantity_write_route_absent', base:DATA, path:`/api/v1/tenants/${TENANT}/orders/${ORDER}/quantity`, expected:404 },
  { id:'openapi_disabled', base:DATA, path:'/openapi.json', expected:404 },
  { id:'auth_login_public', base:AUTH, path:'/login.html', expected:200 },
  { id:'auth_account_public_shell', base:AUTH, path:'/account.html', expected:200 },
  { id:'auth_merchant_portal_public_shell', base:AUTH, path:'/merchant-portal.html', expected:200 },
]);
const ALLOWED_HOSTS = new Set([new URL(DATA).hostname, new URL(AUTH).hostname]);
const WRITE_TOKENS = /\/(?:create|write|update|delete|revoke|migration|rest\/v1\/rpc)\b/i;
const MAX_HEALTH_ATTEMPTS = 10; // finite budget: 10 GET requests maximum, never infinite polling
const HEALTH_INTERVAL_MS = 8000;
function validateCheck(c) {
  assert(CHECKS.some(x=>x===c), 'only built-in check objects are permitted');
  const url = new URL(c.base+c.path);
  assert.equal(url.protocol, 'https:');
  assert(ALLOWED_HOSTS.has(url.hostname));
  assert(!url.username && !url.password && !url.search && !url.hash);
  assert(!WRITE_TOKENS.test(url.pathname));
  return url.toString();
}
function getOnly(url,fetchImpl) {
  return fetchImpl(url, {
    method:'GET',redirect:'manual',credentials:'omit',cache:'no-store',
    headers:{'Accept':'application/json,text/html;q=0.8'},
    signal:AbortSignal.timeout(15000)
  });
}
async function validHealth(response) {
  if(response.status!==200)return false;
  try {
    const body=await response.json();
    return !!(body && body.database_connected===false &&
      ['UNKNOWN','CONFIGURED_NOT_VERIFIED'].includes(body.status) &&
      body.source==='supabase_connection_configuration');
  } catch {return false;}
}
async function runChecks(fetchImpl=fetch,pause=delay) {
  const results=[];
  const health=CHECKS[0],url=validateCheck(health);
  const trace=[];
  let good=false;
  for(let attempt=1;attempt<=MAX_HEALTH_ATTEMPTS;attempt++) {
    let observed='NETWORK_ERROR',response;
    try {
      response=await getOnly(url,fetchImpl);
      observed=response.status;
      good=await validHealth(response);
      if(observed===200&&!good)observed='HEALTH_CONTRACT_INVALID';
    } catch { observed='NETWORK_ERROR'; good=false; }
    trace.push(observed);
    if(good)break;
    if(![502,503,504,'NETWORK_ERROR','HEALTH_CONTRACT_INVALID'].includes(observed))break;
    if(attempt<MAX_HEALTH_ATTEMPTS)await pause(HEALTH_INTERVAL_MS);
  }
  results.push({id:health.id,expected:health.expected,observed:trace.at(-1),pass:good,
    readinessAttempts:trace.length,healthTrace:trace,coldStartSuspected:trace.some(x=>[502,503,504,'NETWORK_ERROR'].includes(x))});
  for(const c of CHECKS.slice(1)) {
    if(c.base===DATA&&!good) {
      results.push({id:c.id,expected:c.expected,observed:'SKIPPED_DATA_NOT_READY',pass:false});
      continue; // never hammer protected data endpoints while health is unavailable
    }
    const target=validateCheck(c);
    let observed='NETWORK_ERROR';
    try{const r=await getOnly(target,fetchImpl);observed=r.status;}catch{}
    results.push({id:c.id,expected:c.expected,observed,pass:observed===c.expected});
  }
  return results;
}
function summarize(results) {
  const h=results[0];
  return {version:'V18.6.12',mode:'HOSTED_ANONYMOUS_GET_ONLY_WITH_BOUNDED_HEALTH_PROBE',
    count:results.length,passed:results.filter(r=>r.pass).length,failed:results.filter(r=>!r.pass).map(r=>r.id),
    readinessAttempts:h?.readinessAttempts,healthTrace:h?.healthTrace,coldStartSuspected:!!h?.coldStartSuspected,
    checks:results.map(({id,expected,observed,pass})=>({id,expected,observed,pass})),
    writeRequests:0,authenticatedRequests:0,secretsRead:0,productionReady:false,
    claims:'STAGING_WARM_READINESS_ONLY_NOT_REAL_AUTH_STORE_RLS_OR_PRODUCTION_SLO'};
}
if(require.main===module){
  (async()=>{
    if(process.env.T404_V18611B_ALLOW_HOSTED_GET!=='true')throw Error('HOSTED_GET_OPT_IN_REQUIRED');
    const result=summarize(await runChecks());
    console.log(JSON.stringify(result,null,2));
    if(result.failed.length)process.exitCode=1;
  })().catch(e=>{console.error('HOSTED_GET_NO_GO:',e.name||'Error');process.exitCode=1;});
}
module.exports={DATA,AUTH,CHECKS,MAX_HEALTH_ATTEMPTS,HEALTH_INTERVAL_MS,validateCheck,runChecks,summarize};
