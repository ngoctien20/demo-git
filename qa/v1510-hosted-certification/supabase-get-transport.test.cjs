'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createPrivateGetTransport}=require('./supabase-get-transport.cjs');
const origin='https://ifxlvrhyjhbzbrkdsida.supabase.co',pk='sb_publishable_qa_fake_public_key_no_secret';
const bearer='eyJhbGciOiJub25lIn0.eyJyb2xlIjoiYXV0aGVudGljYXRlZCJ9.mock-signature-only';
const opts={projectUrl:origin,publicApiKey:pk};
const oid='00000031-0000-4000-8000-000000000000';
test('only exact Supabase staging project origin allowed',()=>{
 assert.throws(()=>createPrivateGetTransport({...opts,projectUrl:'https://other.supabase.co',fetchImpl:async()=>{}}),/WRONG_ORIGIN/);
});
test('reject secret and missing API keys',()=>{
 for(const publicApiKey of ['sb_secret_12345678901234567890123','tiny'])
  assert.throws(()=>createPrivateGetTransport({...opts,publicApiKey,fetchImpl:async()=>{}}),/PUBLISHABLE_OR_ANON_KEY_ONLY/);
});
test('no automatic network without private transport',()=>{
 assert.throws(()=>createPrivateGetTransport(opts),/PRIVATE_FETCH_IMPL_REQUIRED/);
});
test('Auth getUser is strict GET with same actor bearer and no PII response',async()=>{
 const calls=[],t=createPrivateGetTransport({...opts,fetchImpl:async(url,req)=>{
  calls.push([url,req]);return{status:200,json:async()=>({id:'qa_user',aud:'authenticated',email:'hidden@example.com'})};
 }});
 const r=await t.getUser({token:bearer,method:'GET',path:'/auth/v1/user'});
 assert.deepEqual(r,{id:'qa_user',aud:'authenticated'});
 assert.equal(calls[0][1].headers.Authorization,'Bearer '+bearer);
 assert.equal(calls[0][1].method,'GET');assert.equal(calls[0][1].redirect,'error');
 assert.ok(!JSON.stringify(r).includes('@'));
});
test('order GET fixed projection exact UUID and no PII',async()=>{
 const calls=[],t=createPrivateGetTransport({...opts,fetchImpl:async(url,req)=>{
  calls.push([url,req]);return{status:200,json:async()=>[{id:oid,tenant_id:oid,store_id:oid,status:'pending',phone:'hidden'}]};
 }});
 const rows=await t.readOrder({token:bearer,method:'GET',resource:'orders',select:'id,tenant_id,store_id,status',filter:{id:oid}});
 assert.equal(rows[0].id,oid);assert.equal(rows[0].phone,undefined);
 const parsed=new URL(calls[0][0]);
 assert.equal(parsed.origin,origin);assert.equal(parsed.searchParams.get('id'),'eq.'+oid);assert.equal(parsed.searchParams.get('limit'),'2');
});
test('write methods, freeform columns and bad UUID rejected before any GET',async()=>{
 let contacted=false,t=createPrivateGetTransport({...opts,fetchImpl:async()=>{contacted=true}});
 await assert.rejects(()=>t.readOrder({token:bearer,method:'POST',resource:'orders',select:'*',filter:{id:'bad'}}),/STRICT_ORDER_GET_CONTRACT_REQUIRED/);
 await assert.rejects(()=>t.getUser({token:bearer,method:'POST',path:'/auth/v1/user'}),/GET_USER_CONTRACT_REQUIRED/);
 assert.equal(contacted,false);
});
test('403 response fails with redacted constant error',async()=>{
 const t=createPrivateGetTransport({...opts,fetchImpl:async()=>({status:403,json:async()=>({secret:bearer})})});
 await assert.rejects(()=>t.getUser({token:bearer,method:'GET',path:'/auth/v1/user'}),
  e=>e.message==='AUTH_OR_RLS_READ_FAILED'&&!e.message.includes(bearer));
});
test('service-role bearer is never allowed',async()=>{
 const t=createPrivateGetTransport({...opts,fetchImpl:async()=>({status:200,json:async()=>({})})});
 const token='eyJhbGciOiJub25lIn0.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.mock-signature-only';
 await assert.rejects(()=>t.getUser({token,method:'GET',path:'/auth/v1/user'}),/INVALID_ACTOR_BEARER/);
});
