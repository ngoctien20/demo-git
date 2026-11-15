'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const h=require('./hosted-jwt-acceptance.cjs');
const U=[
 'aaaaaaaa-0000-4000-8000-000000000001',
 'bbbbbbbb-0000-4000-8000-000000000002',
 'cccccccc-0000-4000-8000-000000000003',
 'dddddddd-0000-4000-8000-000000000004'];
const S=[
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'];
const O=[
 'aaaaaaaa-2222-4222-8222-aaaaaaaaaaaa',
 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb',
 'cccccccc-2222-4222-8222-cccccccccccc'];
const SK=['QA-AX','QA-BX','QA-CX'];
const TENANT_A='11111111-1111-4111-8111-111111111111';
const TENANT_C='33333333-3333-4333-8333-333333333333';
const jwt=i=>'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJxYS0'+i+'In0.signature_example_'+i+'_synthetic';
const ENV={
 TIEN404_V1442_QA_APPROVAL:h.APPROVAL,
 TIEN404_V1442_RESTORE_GATE:h.RESTORE_GATE,
 TIEN404_V1442_PROJECT_REF:h.PROJECT,
 SUPABASE_PUBLISHABLE_KEY:'sb_publishable_synthetic_not_real_qa',
 QA_A_ACCESS_TOKEN:jwt('A'),QA_B_ACCESS_TOKEN:jwt('B'),
 QA_C_ACCESS_TOKEN:jwt('C'),QA_REVOKED_ACCESS_TOKEN:jwt('R'),
 QA_STORE_A_UUID:S[0],QA_STORE_B_UUID:S[1],QA_STORE_C_UUID:S[2],
 QA_ORDER_A_UUID:O[0],QA_ORDER_B_UUID:O[1],QA_ORDER_C_UUID:O[2],
 QA_SKU_A:SK[0],QA_SKU_B:SK[1],QA_SKU_C:SK[2]
};
function mock({leak=false,revokedLeak=false,differentTenants=false,
 duplicateUser=false,missingPositive=false,staffActive=false,
 membershipOverlap=false,errorStatus=false,nonJson=false}={}){
 const calls=[],jwtIndex=Object.values(ENV).slice(0,0);
 const tokens=[ENV.QA_A_ACCESS_TOKEN,ENV.QA_B_ACCESS_TOKEN,
   ENV.QA_C_ACCESS_TOKEN,ENV.QA_REVOKED_ACCESS_TOKEN];
 const replies=(data,status=200)=>({ok:status===200,status,
   json:async()=>nonJson?Promise.reject(Error('bad json')):data});
 const handler=async(url,opts)=>{
   assert.equal(url.startsWith('https://ifxlvrhyjhbzbrkdsida.supabase.co/'),true);
   assert.equal(opts.method,'GET');assert.equal(opts.redirect,'error');
   assert.equal(opts.cache,'no-store');
   assert.equal(opts.headers['Cache-Control'],'no-store');
   assert.equal(opts.headers.apikey,ENV.SUPABASE_PUBLISHABLE_KEY);
   const token=opts.headers.Authorization.slice('Bearer '.length);
   const idx=tokens.indexOf(token);assert.ok(idx>=0);
   calls.push({path:new URL(url).pathname,actor:idx,method:opts.method});
   if(errorStatus)return replies({},403);
   const u=new URL(url);
   if(u.pathname==='/auth/v1/user')
      return replies({id:duplicateUser&&idx===1?U[0]:U[idx],is_anonymous:false});
   if(u.pathname==='/rest/v1/store_memberships'){
     if(idx===3)return replies(staffActive?[{
       store_id:S[0],tenant_id:TENANT_A,user_id:U[idx],active:true,role:'SHOP_VIEWER'}]:[]);
     const tenant=(idx===2||differentTenants&&idx===1)?TENANT_C:TENANT_A;
     const row={store_id:S[idx],tenant_id:tenant,user_id:U[idx],
       active:true,role:'SHOP_OWNER'};
     return replies(membershipOverlap&&idx===0?[row,{...row,store_id:S[1]}]:[row]);
   }
   if(u.pathname==='/rest/v1/products'||u.pathname==='/rest/v1/orders'){
     const target=S.findIndex(s=>u.searchParams.get('store_id')==='eq.'+s);
     const own=idx===target;
     if(target<0)throw Error('bad target');
     const isProducts=u.pathname.endsWith('/products');
     const matchKey=isProducts?'sku':'id';
     const correct=u.searchParams.get(matchKey)==='eq.'+(isProducts?SK[target]:O[target]);
     if(correct&&(own||leak&&idx<3||revokedLeak&&idx===3)&&
       !(missingPositive&&own&&idx===0))
       return replies([{
        tenant_id:target===2?TENANT_C:TENANT_A,store_id:S[target],
        id:isProducts?'eeeeeeee-4444-4444-8444-eeeeeeeeeeee':O[target],
        ...(isProducts?{sku:SK[target]}:{})
       }]);
     return replies([]);
   }
   throw Error('unexpected path');
 };
 return {handler,calls};
}
async function expectCode(p,code){await assert.rejects(p,e=>e?.code===code);}
const cfg=()=>h.configFromEnv(ENV);
test('01 · Default is closed and has no network',()=>{
 const c=h.configFromEnv({});
 assert.equal(c.ready,false);assert.equal(c.code,'HOSTED_QA_GATES_CLOSED');
});
test('02 · Missing operator explicit approval blocks',()=>{
 assert.equal(h.configFromEnv({...ENV,TIEN404_V1442_QA_APPROVAL:'YES'}).ready,false);
});
test('03 · Restore-and-RLS gate is never assumed from backup TOC',()=>{
 assert.equal(h.configFromEnv({...ENV,TIEN404_V1442_RESTORE_GATE:'BACKUP_TOC_ONLY'}).ready,false);
});
test('04 · Cannot accidentally run against a different project ref',()=>{
 assert.equal(h.configFromEnv({...ENV,TIEN404_V1442_PROJECT_REF:'production'}).ready,false);
});
test('05 · Service-role and other non-publishable keys are rejected',()=>{
 for(const k of ['service_role','sb_secret_v2_not_allowed','anon-legacy']){
  assert.equal(h.configFromEnv({...ENV,SUPABASE_PUBLISHABLE_KEY:k}).ready,false);
 }
});
test('06 · Non-JWT-like session placeholders do not pass config',()=>{
 assert.equal(h.configFromEnv({...ENV,QA_A_ACCESS_TOKEN:'fake-token'}).ready,false);
});
test('07 · Identical access token cannot impersonate independent users',()=>{
 assert.equal(h.configFromEnv({...ENV,QA_B_ACCESS_TOKEN:ENV.QA_A_ACCESS_TOKEN}).ready,false);
});
test('08 · Duplicate Store UUIDs denied',()=>{
 assert.equal(h.configFromEnv({...ENV,QA_STORE_C_UUID:S[1]}).ready,false);
});
test('09 · Bad SKU and missing own order fixture rejected',()=>{
 assert.equal(h.configFromEnv({...ENV,QA_SKU_A:'price=0 and stock > 0'}).ready,false);
 assert.equal(h.configFromEnv({...ENV,QA_ORDER_A_UUID:''}).ready,false);
});
test('10 · Correct synthetic operator-only config permits Mock, not live by itself',()=>{
 assert.equal(cfg().ready,true);
 assert.equal(cfg().projectRef,h.PROJECT);
});
test('11 · All 24 scope checks PASS with valid 4 distinct synthetic Auth users',async()=>{
 const api=mock(),result=await h.hostedJwtAcceptance(cfg(),api.handler);
 assert.equal(result.checks,24);assert.equal(result.positiveCases,6);
 assert.equal(result.negativeCases,12);assert.equal(result.revokedStaffNegativeCases,6);
 assert.equal(result.writeRequests,0);assert.equal(result.serviceRoleUsed,false);
 assert.equal(result.realAuthUserEndpointUsed,true);
 assert.equal(api.calls.length,32);assert.ok(api.calls.every(x=>x.method==='GET'));
 assert.equal(JSON.stringify(result).includes(ENV.QA_A_ACCESS_TOKEN),false);
});
test('12 · Two different users in separate tenants cannot prove same-tenant',async()=>{
 await expectCode(h.hostedJwtAcceptance(cfg(),mock({differentTenants:true}).handler),
  'HOSTED_QA_TENANTS_NOT_ISOLATED');
});
test('13 · Matching JWT string but duplicated Auth identity denied',async()=>{
 await expectCode(h.hostedJwtAcceptance(cfg(),mock({duplicateUser:true}).handler),
  'HOSTED_QA_IDENTITY_NOT_INDEPENDENT');
});
test('14 · Staff member still actively assigned is not a revoked fixture',async()=>{
 await expectCode(h.hostedJwtAcceptance(cfg(),mock({staffActive:true}).handler),
  'HOSTED_QA_SCOPE_OVERLAP');
});
test('15 · Two-store assignment cannot be used as negative isolation fixture',async()=>{
 await expectCode(h.hostedJwtAcceptance(cfg(),mock({membershipOverlap:true}).handler),
  'HOSTED_QA_SCOPE_OVERLAP');
});
test('16 · Missing positive own-store product/Order MUST fail, no vacuous PASS',async()=>{
 await expectCode(h.hostedJwtAcceptance(cfg(),mock({missingPositive:true}).handler),
  'HOSTED_QA_POSITIVE_FIXTURE_MISSING');
});
test('17 · Foreign-store row leaked to valid user must fail',async()=>{
 await expectCode(h.hostedJwtAcceptance(cfg(),mock({leak:true}).handler),
  'HOSTED_QA_CROSS_STORE_LEAK');
});
test('18 · Row leaked to revoked staff user must fail',async()=>{
 await expectCode(h.hostedJwtAcceptance(cfg(),mock({revokedLeak:true}).handler),
  'HOSTED_QA_REVOKED_STAFF_LEAK');
});
test('19 · 403 network response never interpreted as empty RLS success',async()=>{
 await expectCode(h.hostedJwtAcceptance(cfg(),mock({errorStatus:true}).handler),
  'HOSTED_QA_TOKEN_REJECTED');
});
test('20 · Invalid JSON payload does not count as a negative row test',async()=>{
 await expectCode(h.hostedJwtAcceptance(cfg(),mock({nonJson:true}).handler),
  'HOSTED_QA_INVALID_RESPONSE');
});
test('21 · No operator config never reaches transport',async()=>{
 let hit=0;
 await expectCode(h.hostedJwtAcceptance(h.configFromEnv({}),
   async()=>{hit++;throw Error('network should not be called')}),
  'HOSTED_QA_GATES_CLOSED');
 assert.equal(hit,0);
});
test('22 · API table and path cannot be arbitrary or call RPC or mutation',async()=>{
 await expectCode(h.call({path:'/rest/v1/rpc/execute',
   token:ENV.QA_A_ACCESS_TOKEN,key:ENV.SUPABASE_PUBLISHABLE_KEY,
   fetchImpl:async()=>{throw Error('network must not execute');}}),
   'HOSTED_QA_REQUEST_REJECTED');
});
test('23 · No DELETE/POST/PUT/PATCH or service role used anywhere in test suite',()=>{
 const fs=require('node:fs');
 const source=fs.readFileSync(require.resolve('./hosted-jwt-acceptance.cjs'),'utf8');
 for(const unsafe of ["method:'POST'","method:'PATCH'","method:'DELETE'",
  "method:'PUT'","/rpc/","process.env.SUPABASE_SERVICE_ROLE_KEY"])
   assert.equal(source.includes(unsafe),false,unsafe);
});
test('24 · Normalized success report does not contain row IDs or personal data',async()=>{
 const api=mock(),out=await h.hostedJwtAcceptance(cfg(),api.handler);
 const str=JSON.stringify(out);
 assert.equal(str.includes(S[0]),false);
 assert.equal(str.includes(O[0]),false);
 assert.equal(str.includes(U[0]),false);
 assert.equal(str.includes(TENANT_A),false);
});
