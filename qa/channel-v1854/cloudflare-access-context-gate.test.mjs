'use strict';
import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './worker-v144-access-canary-candidate.mjs';
import {verifyPrivateAccess} from './cloudflare-access-context-gate.mjs';

const AUD='a'.repeat(64);
const EMAIL='qa-founder@example.invalid';
const ENV={T404_ACCESS_AUD:AUD,T404_QA_OPERATOR_EMAIL:EMAIL};
const goodCtx={access:{aud:AUD,getIdentity:async()=>({email:EMAIL,id:'synthetic-id'})}};
const req=(path,method='GET',headers={})=>new Request(
  'https://tien404-widget-gateway-v144-staging.tienmobi208.workers.dev'+path,
  {method,headers}
);

test('Missing Cloudflare Access context is denied',async()=>{
 const r=await verifyPrivateAccess({},ENV);
 assert.equal(r.ok,false);assert.equal(r.status,403);
 assert.equal(r.code,'ACCESS_CONTEXT_REQUIRED');
});
test('Browser-supplied JWT header cannot replace ctx.access',async()=>{
 const request=req('/__v1854/access-canary','GET',{
  'Cf-Access-Jwt-Assertion':'eyJhbGciOiJub25lIn0.eyJzdWIiOiJmb3JnZWQifQ.'
 });
 const response=await worker.fetch(request,ENV,{});
 assert.equal(response.status,403);
 assert.equal((await response.json()).error,'ACCESS_CONTEXT_REQUIRED');
});
test('Missing or malformed server-side Access config fails closed',async()=>{
 for(const env of [{},{...ENV,T404_ACCESS_AUD:'bad'},
  {...ENV,T404_QA_OPERATOR_EMAIL:'bad-email'},
  {...ENV,T404_QA_OPERATOR_EMAIL:''}]){
  const r=await verifyPrivateAccess(goodCtx,env);
  assert.equal(r.ok,false);assert.equal(r.status,503);
  assert.equal(r.code,'ACCESS_CONFIGURATION_INVALID');
 }
});
test('Wrong Access app audience is denied',async()=>{
 for(const aud of ['b'.repeat(64),[AUD,'b'.repeat(64)],[],null]){
  const r=await verifyPrivateAccess({access:{aud,getIdentity:async()=>({email:EMAIL})}},ENV);
  assert.equal(r.ok,false);assert.equal(r.code,'ACCESS_AUDIENCE_MISMATCH');
 }
});
test('Identity API failure or missing email is denied',async()=>{
 const a=await verifyPrivateAccess({access:{aud:AUD,getIdentity:async()=>{throw Error('private')}}},ENV);
 const b=await verifyPrivateAccess({access:{aud:AUD,getIdentity:async()=>({})}},ENV);
 assert.equal(a.code,'ACCESS_IDENTITY_UNAVAILABLE');
 assert.equal(b.code,'ACCESS_IDENTITY_INVALID');
});
test('Non-allowlisted operator is denied even with valid Access audience',async()=>{
 const r=await verifyPrivateAccess({access:{aud:AUD,getIdentity:async()=>({email:'other@example.invalid'})}},ENV);
 assert.equal(r.ok,false);assert.equal(r.code,'ACCESS_OPERATOR_NOT_ALLOWLISTED');
});
test('Allowlisted operator is admitted without returning identity or token',async()=>{
 const r=await verifyPrivateAccess(goodCtx,ENV);
 assert.equal(r.ok,true);assert.equal(r.audienceVerified,true);
 assert.equal(r.operatorAllowlisted,true);
 const text=JSON.stringify(r);
 assert(!text.includes(EMAIL));assert(!text.includes('synthetic-id'));
 assert(!text.includes(AUD));assert(!text.includes('token'));
});
test('Email comparison trims and normalizes case, but not identity aliases',async()=>{
 const r=await verifyPrivateAccess({access:{aud:AUD,getIdentity:async()=>({email:' QA-Founder@Example.Invalid '})}},ENV);
 assert.equal(r.ok,true);
 const alias=await verifyPrivateAccess({access:{aud:AUD,getIdentity:async()=>({email:'qa-founder+alias@example.invalid'})}},ENV);
 assert.equal(alias.ok,false);
});
test('Access canary is private and returns no identity fields',async()=>{
 const response=await worker.fetch(req('/__v1854/access-canary'),ENV,goodCtx);
 assert.equal(response.status,200);
 const data=await response.json();
 assert.equal(data.canary,'CLOUDFLARE_ACCESS_CONTEXT_VERIFIED');
 assert.equal(data.audienceVerified,true);assert.equal(data.operatorAllowlisted,true);
 assert.equal(data.privateOrderAccess,false);assert.equal(data.orderWrites,0);
 assert.equal(data.providerSends,0);assert.equal(data.productionReady,false);
 assert(!JSON.stringify(data).includes(EMAIL));
 assert.equal(response.headers.get('cache-control'),'no-store, max-age=0');
});
test('Health endpoint is protected by the same Access gate',async()=>{
 const denied=await worker.fetch(req('/__v144/health'),ENV,{});
 const allowed=await worker.fetch(req('/__v144/health'),ENV,goodCtx);
 assert.equal(denied.status,403);assert.equal(allowed.status,200);
 assert.equal((await allowed.json()).state,'LOCKED');
});
test('Session and message routes remain locked even for approved QA operator',async()=>{
 for(const [path,method] of [['/v1/widget/session','POST'],['/v1/widget/message','POST'],
  ['/v1/widget/install','POST'],['/v1/widget/anything','POST']]){
  const response=await worker.fetch(req(path,method),ENV,goodCtx);
  assert.equal(response.status,423);
  const body=await response.json();
  assert.equal(body.error,'COMMERCE_READONLY_ADAPTER_NOT_ADMITTED');
  assert.equal(body.productionReady,false);
 }
});
test('CORS preflight is not bypassed and no CORS headers are emitted',async()=>{
 const response=await worker.fetch(req('/v1/widget/message','OPTIONS'),ENV,goodCtx);
 assert.equal(response.status,423);
 assert.equal(response.headers.get('access-control-allow-origin'),null);
 const otherOptions=await worker.fetch(req('/__v1854/access-canary','OPTIONS'),ENV,goodCtx);
 assert.equal(otherOptions.status,405);
 assert.equal(otherOptions.headers.get('access-control-allow-origin'),null);
 const denied=await worker.fetch(req('/v1/widget/message','OPTIONS'),ENV,{});
 assert.equal(denied.status,403);
});
test('Unknown paths are not reflected and Access gate runs before routing',async()=>{
 const denied=await worker.fetch(req('/private?secret=do-not-reflect'),ENV,{});
 assert.equal(denied.status,403);
 assert.equal((await denied.json()).error,'ACCESS_CONTEXT_REQUIRED');
 const allowed=await worker.fetch(req('/not-found'),ENV,goodCtx);
 assert.equal(allowed.status,404);
});
