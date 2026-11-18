'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createProtectedConsentHttpRoute}=require('./v172c24-private-consent-https-handler.cjs');
const origin='https://qa-private.example.test',endpoint=origin+'/private/qa-consent/intake';
const authorization='Bearer '+['a'.repeat(30),'b'.repeat(30),'c'.repeat(40)].join('.');
const scope='synthetic_catalog_readonly_no_send_no_write';
const body={requestedScope:scope,consentAction:'accept',challenge:'a'.repeat(24)};
function fixture(change={}){
 const calls=[];
 const backend={
  intake:async arg=>{calls.push(['intake',arg]);return {status:'PRIVATE_CONSENT_RECORDED_NOT_UAT_GO',slot:'QA_A'}},
  reviewPair:async arg=>{calls.push(['review',arg]);return {status:'REVIEW_REQUIRED_NOT_JWT_GO'}}
 };
 const cfg={backend,allowedOrigin:origin,
  verifyDeploymentGate:async()=>({approved:true,isolatedDisposable:true,noSend:true,recoveryApproved:true,independentReviewerApproved:true}),
  checkRateLimit:async()=>true,...change};
 const route=createProtectedConsentHttpRoute(cfg);
 const req=(data=body,{url=endpoint,method='POST',requestOrigin=origin,auth=authorization,
  contentType='application/json'}={})=>new Request(url,{method,headers:{
  'origin':requestOrigin,'authorization':auth,'content-type':contentType},
  ...(method==='POST'?{body:JSON.stringify(data)}:{})});
 return {calls,route,req};
}
test('synthetic valid intake yields only redacted no-UAT response',async()=>{
 const {calls,route,req}=fixture();const res=await route(req());
 assert.equal(res.status,202);assert.deepEqual(await res.json(),{status:'PRIVATE_CONSENT_RECORDED_NOT_UAT_GO'});
 assert.equal(calls.length,1);assert.equal(calls[0][1].bearer,authorization);
 assert.equal(res.headers.get('cache-control'),'no-store, max-age=0');
});
test('review always remains human review required even if backend says success',async()=>{
 const {route,req}=fixture();const res=await route(req({},{
 url:origin+'/private/qa-consent/review-pair'}));
 assert.equal(res.status,202);
 assert.deepEqual(await res.json(),{status:'REVIEW_REQUIRED_NOT_JWT_GO'});
});
for(const [name,opts,data] of [
 ['wrong origin',{requestOrigin:'https://evil.test'}],
 ['missing origin',{requestOrigin:null}],
 ['invalid target origin',{url:'https://evil.test/private/qa-consent/intake'}],
 ['non-matching route',{url:origin+'/api/commerce/orders'}],
 ['query string',{url:endpoint+'?return=token'}],
 ['unsupported content type',{contentType:'text/plain'}],
 ['invalid Authorization',{auth:'Bearer secret'}],
 ['wrong scope',{}, {...body,requestedScope:'order-write'}],
 ['extra caller-controlled subject',{}, {...body,subjectRef:'other'}],
 ['attempted tenant override',{}, {...body,tenant:'evil'}],
 ['missing action',{}, {...body,consentAction:null}],
 ['short challenge',{}, {...body,challenge:'x'}]
])test('DENY '+name,async()=>{
 const {route,req,calls}=fixture();
 let request=req(data===undefined?body:data,opts);
 if(name==='missing origin'){
  request=new Request(endpoint,{method:'POST',headers:{authorization,'content-type':'application/json'},body:JSON.stringify(body)});
 }
 const res=await route(request);assert.notEqual(res.status,202);assert.equal(calls.length,0);
});
test('DENY disabled deployment gate before consent backend',async()=>{
 const {route,req,calls}=fixture({verifyDeploymentGate:async()=>({approved:false})});
 assert.equal((await route(req())).status,403);assert.equal(calls.length,0);
});
test('DENY rate limit failure',async()=>{
 const {route,req,calls}=fixture({checkRateLimit:async()=>false});
 assert.equal((await route(req())).status,429);assert.equal(calls.length,0);
});
test('DENY missing reviewer auth using real backend output status',async()=>{
 const {route,req,calls}=fixture({backend:{
  intake:async()=>({status:'DENY'}),
  reviewPair:async()=>({status:'DENY'})
 }});
 const res=await route(req({}, {url:origin+'/private/qa-consent/review-pair'}));
 assert.equal(res.status,403);assert.equal(calls.length,0);
});
test('DENY oversized body',async()=>{
 const {route,calls}=fixture();
 const res=await route(new Request(endpoint,{method:'POST',headers:{
  origin,authorization,'content-type':'application/json'},
  body:JSON.stringify({...body,challenge:'x'.repeat(2500)})}));
 assert.equal(res.status,413);assert.equal(calls.length,0);
});
test('DENY wrong method',async()=>{
 const {route,req}=fixture();
 assert.equal((await route(req(undefined,{method:'GET'}))).status,405);
});
test('deny incomplete server config',()=>{
 assert.throws(()=>createProtectedConsentHttpRoute({allowedOrigin:origin}),/PROTECTED_ROUTE_SERVER_CONFIG_MISSING/);
});

test('DENY oversized chunked UTF-8 body without Content-Length',async()=>{
 const {route,calls}=fixture();
 const stream=new ReadableStream({start(controller){
  controller.enqueue(new TextEncoder().encode('x'.repeat(800)));
  controller.enqueue(new TextEncoder().encode('y'.repeat(800)));
  controller.close();
 }});
 const request=new Request(endpoint,{method:'POST',duplex:'half',headers:{
  origin,authorization,'content-type':'application/json'},body:stream});
 assert.equal(request.headers.get('content-length'),null);
 assert.equal((await route(request)).status,413);
 assert.equal(calls.length,0);
});
test('DENY malformed UTF-8 stream without backend access',async()=>{
 const {route,calls}=fixture();
 const stream=new ReadableStream({start(controller){
  controller.enqueue(Uint8Array.from([0xc3,0x28]));
  controller.close();
 }});
 const request=new Request(endpoint,{method:'POST',duplex:'half',headers:{
  origin,authorization,'content-type':'application/json'},body:stream});
 assert.notEqual((await route(request)).status,202);
 assert.equal(calls.length,0);
});
