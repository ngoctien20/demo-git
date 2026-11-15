'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const h=require('./hosted-jwt-read-qa.cjs');
const A='11111111-1111-4111-8111-111111111111';
const B='22222222-2222-4222-8222-222222222222';
const SA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const TENANT='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const env={TIEN404_QA_ALLOW_HOSTED_READ_ONLY:'EXPLICIT_STAGING_JWT_READ_QA_APPROVED',
  TIEN404_QA_SAME_TENANT_ASSERTION:'YES_AUTHORIZED_SAME_TENANT_FIXTURES',
  QA_A_ACCESS_TOKEN:'jwt-a-offline-mock',QA_B_ACCESS_TOKEN:'jwt-b-offline-mock',
  SUPABASE_PUBLISHABLE_KEY:'sb_publishable_mockkey',QA_STORE_A_UUID:SA,
  QA_STORE_B_UUID:SB,QA_SKU_A:'FIX-A',QA_SKU_B:'FIX-B'};
test('Default without env is BLOCKED and never makes network calls',()=>{
 assert.equal(h.configFromEnv({}).ready,false);
});
test('Wrong project/plan flag is BLOCKED',()=>{
 assert.equal(h.configFromEnv({...env,TIEN404_QA_SAME_TENANT_ASSERTION:'NO'}).ready,false);
});
test('Refuse identical JWT tokens, cannot fake two users',()=>{
 assert.equal(h.configFromEnv({...env,QA_B_ACCESS_TOKEN:env.QA_A_ACCESS_TOKEN}).ready,false);
});
test('Cannot supply a service-role-like non-publishable key',()=>{
 assert.equal(h.configFromEnv({...env,SUPABASE_PUBLISHABLE_KEY:'service_role_DO_NOT_USE'}).ready,false);
});
test('Must pass explicit operator flag and same-tenant QA flag',()=>{
 const c=h.configFromEnv(env);assert.equal(c.ready,true);
});
const response=(value,status=200)=>({ok:status===200,status,json:async()=>value});
function server({differentTenants=false,leak=false,missingMembership=false}={}){
 const calls=[];
 async function fetchImpl(url,options){
  calls.push({url,method:options.method,
    // intentional: NEVER retain JWT or apikey in test output
    auth_a:options.headers.Authorization==='Bearer '+env.QA_A_ACCESS_TOKEN});
  assert.equal(options.method,'GET');assert.ok(url.startsWith('https://ifxlvrhyjhbzbrkdsida.supabase.co/'));
  const isA=options.headers.Authorization==='Bearer '+env.QA_A_ACCESS_TOKEN;
  const isB=options.headers.Authorization==='Bearer '+env.QA_B_ACCESS_TOKEN;
  assert.ok(isA||isB);
  if(url.endsWith('/auth/v1/user'))return response({id:isA?A:B,is_anonymous:false});
  if(url.includes('/rest/v1/store_memberships?')){
   if(missingMembership&&isB)return response([]);
   return response([{tenant_id:differentTenants&&isB?'dddddddd-dddd-4ddd-8ddd-dddddddddddd':TENANT,
     store_id:isA?SA:SB,user_id:isA?A:B,role:'SHOP_OWNER'}]);
  }
  if(url.includes('/rest/v1/products?')){
   const own=(isA&&url.includes(SA))||(isB&&url.includes(SB));
   if(own||leak){return response([{
      id:'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      tenant_id:TENANT,store_id:url.includes(SA)?SA:SB,
      sku:url.includes(SA)?'FIX-A':'FIX-B'}]);}
   return response([]);
  }
  throw Error('Unexpected endpoint');
 }
 return {fetchImpl,calls};
}
test('Four positive/negative GET reads succeed with two genuinely different user identities',async()=>{
 const srv=server();const result=await h.hostedReadQa(h.configFromEnv(env),srv.fetchImpl);
 assert.equal(result.checks.length,4);assert.equal(result.writes,0);
 assert.equal(result.service_role_used,false);
 assert.ok(result.checks.every(c=>c.pass===true));
 assert.equal(srv.calls.length,8);assert.ok(srv.calls.every(c=>c.method==='GET'));
 assert.equal(JSON.stringify(result).includes('jwt-'),false);
});
test('Two tenants cannot count as same-tenant isolation',async()=>{
 await assert.rejects(h.hostedReadQa(h.configFromEnv(env),server({differentTenants:true}).fetchImpl),/SAME_TENANT/);
});
test('User without own store membership fails hosted QA',async()=>{
 await assert.rejects(h.hostedReadQa(h.configFromEnv(env),server({missingMembership:true}).fetchImpl),/MEMBERSHIP/);
});
test('Cross-store single row is detected as RLS leak',async()=>{
 await assert.rejects(h.hostedReadQa(h.configFromEnv(env),server({leak:true}).fetchImpl),/CROSS_STORE_RLS_LEAK/);
});
test('Cannot run with unapproved config',async()=>{
 await assert.rejects(h.hostedReadQa(h.configFromEnv({}),()=>{throw Error('MUST_NOT_SEND_NETWORK')}),/NOT_AUTHORIZED/);
});
