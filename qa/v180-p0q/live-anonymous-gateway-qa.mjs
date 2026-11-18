// TIEN404 V18.0-P0Q: Real hosted anonymous security checks.
// Do not send access tokens, credentials, real account/order IDs, or write requests.
import assert from 'node:assert/strict';
const origin='https://tien404-data-staging.onrender.com';
const dummy='00000000-0000-4000-8000-000000000000';
async function read(path, status) {
  const response=await fetch(origin+path,{
    method:'GET', redirect:'error',
    headers:{Accept:'application/json'},
    signal:AbortSignal.timeout(55000)
  });
  assert.equal(response.status,status,'Unexpected HTTP status at '+path);
  assert.match(response.headers.get('cache-control')||'',/no-store/i);
  assert.equal(response.headers.get('x-content-type-options'),'nosniff');
  assert.match(response.headers.get('content-type')||'',/application\/json/i);
  const body=await response.text();
  assert.ok(body.length>5 && body.length<1800,'Unexpected body length');
  return JSON.parse(body);
}
const health=await read('/health',200);
assert.equal(health.production_readiness,'NOT_APPROVED');
assert.equal(health.database_connected,false);
assert.equal(health.mode,'staging');
assert.ok(['UNKNOWN','CONFIGURED_NOT_VERIFIED'].includes(health.status));
console.log('P0Q_LIVE_PUBLIC_HEALTH_STAGING_NOT_PRODUCTION');
for(const path of ['/api/v1/tenants',
 '/api/v1/tenants/'+dummy+'/products',
 '/api/v1/tenants/'+dummy+'/orders']) {
  const result=await read(path,401);
  assert.equal(result.detail,'AUTH_REQUIRED');
  console.log('P0Q_ANONYMOUS_DENIED '+path+' HTTP_401');
}
console.log('P0Q_REAL_HOSTED_ANON_GATE_PASS; NO_JWT; NO_USER_DATA; NO_STORE_AUTH_VERIFIED');
