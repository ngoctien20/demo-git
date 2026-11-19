'use strict';
/** TIEN404 V18.6.11B — anonymous GET-only Render staging UAT.
 * The only destinations are the two fixed Render staging hosts. Do not add POST,
 * auth headers, cookies, redirect following, write paths or secret output.
 */
const { strict: assert } = require('node:assert');
const { setTimeout: delay } = require('node:timers/promises');
const DATA = 'https://tien404-data-staging.onrender.com';
const AUTH = 'https://tien404-auth-staging.onrender.com';
const TENANT = '11111111-1111-4111-8111-111111111111'; // inert fixture ID, no user records
const ORDER = '22222222-2222-4222-8222-222222222222';  // inert fixture ID
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
function validateCheck(c) {
  assert(CHECKS.some(x=>x===c), 'only built-in check objects are permitted');
  const url = new URL(c.base+c.path);
  assert.equal(url.protocol, 'https:');
  assert(ALLOWED_HOSTS.has(url.hostname));
  assert(!url.username && !url.password && !url.search && !url.hash);
  assert(!WRITE_TOKENS.test(url.pathname));
  return url.toString();
}
async function runChecks(fetchImpl=fetch, pause=delay) {
  const results=[];
  for (const c of CHECKS) {
    const url=validateCheck(c);
    let response;
    // Only one bounded retry for temporary proxy/cold-start errors; never retry auth failures.
    for(let attempt=0;attempt<2;attempt++) {
      response=await fetchImpl(url, {
        method:'GET', redirect:'manual', credentials:'omit', cache:'no-store',
        headers:{'Accept':'application/json,text/html;q=0.8'},
        signal:AbortSignal.timeout(c.id==='data_health'?115000:25000)
      });
      if(attempt===0 && [502,503,504].includes(response.status)) { await pause(3000); continue; }
      break;
    }
    const result={id:c.id,expected:c.expected,observed:response.status,pass:response.status===c.expected};
    if(result.pass && c.kind==='health') {
      try {
        const body=await response.json();
        result.pass=body && body.database_connected===false &&
          ['UNKNOWN','CONFIGURED_NOT_VERIFIED'].includes(body.status) &&
          body.source==='supabase_connection_configuration';
      } catch { result.pass=false; }
    }
    results.push(result);
  }
  return results;
}
function summarize(results) {
  return {version:'V18.6.11B',mode:'HOSTED_ANONYMOUS_GET_ONLY',count:results.length,
    passed:results.filter(r=>r.pass).length, failed:results.filter(r=>!r.pass).map(r=>r.id),
    checks:results.map(({id,expected,observed,pass})=>({id,expected,observed,pass})),
    writeRequests:0, authenticatedRequests:0, secretsRead:0,
    claims:'HTTP_STATUS_ONLY_NOT_REAL_AUTH_OR_STORE_RLS'};
}
if (require.main === module) {
  (async()=>{
    if(process.env.T404_V18611B_ALLOW_HOSTED_GET!=='true') throw Error('HOSTED_GET_OPT_IN_REQUIRED');
    const result=summarize(await runChecks());
    console.log(JSON.stringify(result,null,2));
    if(result.failed.length) process.exitCode=1;
  })().catch(e=>{ console.error('HOSTED_GET_NO_GO:',e.name||'Error');process.exitCode=1; });
}
module.exports={DATA,AUTH,CHECKS,validateCheck,runChecks,summarize};
