import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign as rsaSign,createHmac} from 'node:crypto';
import issuer,{CONTRACT,V174PReplayGuard} from './hosted-issuer.worker.mjs';

const ORIGIN='https://v174p-issuer.qa.example.invalid';
const ACCESS_ISS='https://tien404qa.cloudflareaccess.com', AUD='cfaud-qa-0123456789012345';
const SECRET='QA_ONLY_SECRET_NOT_PROD_abcdefghijklmnopqrstuvwxyz_0123456789';
const {publicKey,privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const JWK={...publicKey.export({format:'jwk'}),kid:'qa-rsa',alg:'RS256',use:'sig'};
const now=()=>Math.floor(Date.now()/1000);
let env,seen,subjects;
function reset(){
 seen=new Map(),subjects=['QA_TESTER_OWNER'];
 env={V174P_MODE:'QA_SYNTHETIC_ONLY',V174P_ISSUER_ORIGIN:ORIGIN,
  V174P_ACCESS_ISSUER:ACCESS_ISS,V174P_ACCESS_AUD:AUD,
  V174P_ACCESS_JWKS_JSON:JSON.stringify({keys:[JWK]}),
  V174P_SESSION_HMAC_KEY:SECRET,V174P_OWNER_PROOF_STATUS:'UNVERIFIED_QA_ONLY',
  V174P_REPLAY_DO:{
   idFromName:name=>name,
   get:()=>({fetch:async req=>{
    const {kind,key,fingerprint}=await req.json();
    const status=kind==='session'?'admitted':(kind==='message'?
       (seen.has(key)?(seen.get(key)===fingerprint?'duplicate':'conflict'):'claimed'):'DENY');
    if(status==='claimed')seen.set(key,fingerprint);
    return new Response(JSON.stringify({status}),{status:200});
   }})
  }
 };
}
reset();
function access({sub='QA_TESTER_OWNER',iss=ACCESS_ISS,aud=AUD,exp=now()+600,
 iat=now()-10,nbf=now()-10,kid='qa-rsa',alg='RS256'}={}){
 const h=Buffer.from(JSON.stringify({typ:'JWT',alg,kid})).toString('base64url');
 const p=Buffer.from(JSON.stringify({sub,iss,aud,exp,iat,nbf})).toString('base64url');
 const sig=rsaSign('RSA-SHA256',Buffer.from(h+'.'+p),privateKey).toString('base64url');
 return h+'.'+p+'.'+sig;
}
function request(method,path,body,opts={}){
 const url=(opts.host||ORIGIN)+path;
 const headers={...(method==='POST'?{origin:ORIGIN,'content-type':'application/json'}:{}),
  'Cf-Access-Jwt-Assertion':opts.jwt===undefined?access():opts.jwt,
  ...opts.headers};
 if(opts.jwt===null)delete headers['Cf-Access-Jwt-Assertion'];
 return new Request(url,{method,headers,...(method==='POST'?{body:typeof body==='string'?body:JSON.stringify(body)}:{})});
}
async function call(method,path,body,opts={}){
 const r=await issuer.fetch(request(method,path,body,opts),opts.env||env);
 let value;const txt=await r.text();try{value=JSON.parse(txt)}catch{value=txt}
 return {status:r.status,data:value,headers:r.headers};
}
const issue=(opts={})=>call('POST','/v1/website/sessions',{installation_ref:'QA_WEB_WIDGET_A'},opts);
const message=(token,extra={},opts={})=>call('POST','/v1/website/messages',
 {installation_ref:'QA_WEB_WIDGET_A',event_id:'QA_MSG_TEST_01',requested_tool:'catalog_read',text:'QA product',...extra},
 {...opts,headers:{authorization:'Bearer '+token,...opts.headers}});
test('01 module contract',()=>assert.match(CONTRACT,/V174P/));
test('02 denies env not configured',async()=>{
 const r=await call('GET','/healthz',undefined,{env:{}});assert.equal(r.status,503);
});
test('03 requires Access JWT even on /healthz',async()=>{
 const r=await call('GET','/healthz',undefined,{jwt:null});assert.equal(r.status,401);
});
test('04 valid signed Access token admits health',async()=>{
 const r=await call('GET','/healthz');assert.equal(r.data.status,'PRIVATE_QA_READY');
});
test('05 rejects forged Access JWT signature',async()=>{
 const t=access();const r=await call('GET','/healthz',undefined,{jwt:t.slice(0,-1)+'A'});
 assert.equal(r.status,401);
});
test('06 rejects Access wrong audience',async()=>assert.equal((await call('GET','/healthz',null,{jwt:access({aud:'wrong'})})).status,401));
test('07 rejects Access wrong issuer',async()=>assert.equal((await call('GET','/healthz',null,{jwt:access({iss:'https://bad.cloudflareaccess.com'})})).status,401));
test('08 rejects Access token expired',async()=>assert.equal((await call('GET','/healthz',null,{jwt:access({exp:now()-1})})).status,401));
test('09 rejects Access token with unknown kid',async()=>assert.equal((await call('GET','/healthz',null,{jwt:access({kid:'missing'})})).status,401));
test('10 rejects Access alg none',async()=>assert.equal((await call('GET','/healthz',null,{jwt:access({alg:'none'})})).status,401));
test('11 rejects future Access nbf',async()=>assert.equal((await call('GET','/healthz',null,{jwt:access({nbf:now()+600})})).status,401));
test('12 denies unapproved issuer host',async()=>{
 const r=await call('GET','/healthz',null,{host:'https://another.example.invalid'});assert.equal(r.status,403);
});
test('13 GET QA page is protected and synthetic',async()=>{
 const r=await call('GET','/qa');assert.equal(r.status,200);
 assert.match(r.data,/CHỈ TEST/);
 assert.match(r.headers.get('content-security-policy'),/script-src 'self'/);
});
test('14 GET browser JS requires Access',async()=>{
 assert.equal((await call('GET','/qa-client.js',null,{jwt:null})).status,401);
});
test('15 GET unknown route 404',async()=>assert.equal((await call('GET','/secrets')).status,404));
test('16 POST session issues signed token',async()=>{
 const r=await issue();assert.equal(r.status,200);assert.equal(r.data.status,'QA_SESSION_ISSUED');
 assert.match(r.data.token,/^t404p1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
});
test('17 QA token 300s',async()=>assert.equal((await issue()).data.expires_in_sec,300));
test('18 no real merchant proof or customer identity',async()=>{
 const r=await issue();assert.equal(r.data.owner_verified,false);
 assert.equal(r.data.customer_identity_verified,false);
 assert.equal(r.data.hosted_store_rls_verified,false);
});
test('19 session rejects unbound Website B',async()=>{
 const r=await call('POST','/v1/website/sessions',{installation_ref:'QA_WEB_WIDGET_B'});
 assert.equal(r.status,403);
});
test('20 session rejects explicit Store B',async()=>{
 const r=await call('POST','/v1/website/sessions',{installation_ref:'QA_WEB_WIDGET_A',store_ref:'QA_STORE_B'});
 assert.equal(r.status,403);
});
test('21 session rejects client tenant claim',async()=>{
 const r=await call('POST','/v1/website/sessions',{installation_ref:'QA_WEB_WIDGET_A',tenant_id:'QA_TENANT_2'});
 assert.equal(r.status,403);
});
test('22 session rejects missing Origin',async()=>{
 const r=await issue({headers:{origin:''}});assert.equal(r.status,403);
});
test('23 session rejects foreign Origin',async()=>{
 const r=await issue({headers:{origin:'https://evil.invalid'}});assert.equal(r.status,403);
});
test('24 session rejects cross-site fetch metadata',async()=>{
 const r=await issue({headers:{'sec-fetch-site':'cross-site'}});assert.equal(r.status,403);
});
test('25 session rejects text/plain',async()=>{
 const r=await issue({headers:{'content-type':'text/plain'}});assert.equal(r.status,400);
});
test('26 session rejects malformed JSON',async()=>{
 const r=await call('POST','/v1/website/sessions','{not-json');assert.equal(r.status,400);
});
test('27 session rejects oversized JSON',async()=>{
 const r=await call('POST','/v1/website/sessions',JSON.stringify({installation_ref:'QA_WEB_WIDGET_A',payload:'X'.repeat(2200)}));
 assert.equal(r.status,400);
});
test('28 session valid message returns synthetic Store A catalog',async()=>{
 const token=(await issue()).data.token;
 const r=await message(token,{event_id:'QA_MSG_0028'});
 assert.equal(r.status,200);assert.equal(r.data.status,'QA_REPLY_PREPARED');
 assert.equal(r.data.store_ref,'QA_STORE_A');assert.equal(r.data.price_vnd,159000);
});
test('29 three distinct turns using one token',async()=>{
 const token=(await issue()).data.token;
 for(const id of ['QA_MSG_0029A','QA_MSG_0029B','QA_MSG_0029C']){
  const r=await message(token,{event_id:id});
  assert.equal(r.data.status,'QA_REPLY_PREPARED');
 }
});
test('30 duplicate message returns no second action',async()=>{
 const token=(await issue()).data.token;
 const a=await message(token,{event_id:'QA_MSG_0030'}),b=await message(token,{event_id:'QA_MSG_0030'});
 assert.equal(a.data.status,'QA_REPLY_PREPARED');assert.equal(b.data.status,'DUPLICATE_IGNORED');
});
test('31 conflicting replay denied',async()=>{
 const token=(await issue()).data.token;
 await message(token,{event_id:'QA_MSG_0031'});
 const r=await message(token,{event_id:'QA_MSG_0031',text:'changed'});
 assert.equal(r.status,403);
});
test('32 denies missing bearer',async()=>{
 const r=await call('POST','/v1/website/messages',{installation_ref:'QA_WEB_WIDGET_A',event_id:'QA_MSG_0032',requested_tool:'catalog_read',text:'test'});
 assert.equal(r.status,401);
});
test('33 denies bad session signature',async()=>{
 const token=(await issue()).data.token;const changed=token.slice(0,-1)+(token.endsWith('A')?'B':'A');
 const r=await message(changed,{event_id:'QA_MSG_0033'});
 assert.equal(r.status,403);
});
test('34 session binds to Access subject',async()=>{
 const token=(await issue()).data.token;
 const r=await message(token,{event_id:'QA_MSG_0034'},{jwt:access({sub:'ANOTHER_QA_TESTER'})});
 assert.equal(r.status,403);
});
test('35 denies create_order tool',async()=>{
 const token=(await issue()).data.token;const r=await message(token,{event_id:'QA_MSG_0035',requested_tool:'create_order'});
 assert.equal(r.status,403);
});
test('36 denies order_read',async()=>{
 const token=(await issue()).data.token;const r=await message(token,{event_id:'QA_MSG_0036',requested_tool:'order_read'});
 assert.equal(r.status,403);
});
test('37 rejects client bot_id field',async()=>{
 const token=(await issue()).data.token;const r=await message(token,{bot_id:'QA_BOT_B'});assert.equal(r.status,403);
});
test('38 rejects client verified flag',async()=>{
 const token=(await issue()).data.token;const r=await message(token,{verified:true});assert.equal(r.status,403);
});
test('39 rejects empty text',async()=>{
 const token=(await issue()).data.token;const r=await message(token,{text:''});assert.equal(r.status,403);
});
test('40 rejects 501 char text',async()=>{
 const token=(await issue()).data.token;const r=await message(token,{text:'x'.repeat(501)});assert.equal(r.status,403);
});
test('41 missing Durable Object binding fails closed',async()=>{
 const token=(await issue()).data.token,updated={...env,V174P_REPLAY_DO:null};
 const r=await message(token,{event_id:'QA_MSG_0041'},{env:updated});
 assert.equal(r.status,503);
});
test('42 no real sends, model or writes',async()=>{
 const token=(await issue()).data.token;const r=await message(token,{event_id:'QA_MSG_0042'});
 assert.deepEqual([r.data.model_calls,r.data.provider_sends,r.data.commerce_writes],[0,0,0]);
});
test('43 hosted real tenant mode denied',async()=>{
 const r=await call('GET','/healthz',undefined,{env:{...env,V174P_MODE:'OWNER_APPROVED'}});
 assert.equal(r.status,503);
});
test('44 self-attested owner proof status cannot enable real',async()=>{
 const r=await call('GET','/healthz',undefined,{env:{...env,V174P_OWNER_PROOF_STATUS:'VERIFIED'}});
 assert.equal(r.status,503);
});
test('45 bare key missing fail closed',async()=>{
 const r=await call('GET','/healthz',undefined,{env:{...env,V174P_SESSION_HMAC_KEY:''}});
 assert.equal(r.status,503);
});
test('46 pinned JWKS missing fail closed',async()=>{
 const r=await call('GET','/healthz',undefined,{env:{...env,V174P_ACCESS_JWKS_JSON:''}});
 assert.equal(r.status,503);
});
test('47 output never contains secret or Access JWT',async()=>{
 const jwt=access(),r=await call('GET','/healthz',undefined,{jwt});
 assert(!JSON.stringify(r.data).includes(jwt));assert(!JSON.stringify(r.data).includes(SECRET));
});
test('48 same-authority Access JWT cannot bypass scope with query params',async()=>{
 assert.equal((await call('GET','/healthz?store_id=QA_STORE_B')).status,403);
});
test('49 Durable Object class enforces path',async()=>{
 const doo=new V174PReplayGuard({storage:{transaction:async fn=>fn({})}});
 const r=await doo.fetch(new Request('https://durable.internal/admin',{method:'POST',body:'{}'}));
 assert.equal(r.status,405);
});
test('50 durable claim body rejects invalid key without transaction',async()=>{
 const doo=new V174PReplayGuard({storage:{transaction:async()=>{throw Error('MUST_NOT_EXECUTE');}}});
 const r=await doo.fetch(new Request('https://durable.internal/gate',{method:'POST',
  headers:{'content-type':'application/json'},
  body:JSON.stringify({kind:'message',key:'not-a-valid-HMAC',fingerprint:'x',expires_at:0})}));
 assert.equal(r.status,400);
});


test('51 accepts Cloudflare Secrets Store async .get bindings (QA-only)',async()=>{
 const managed={...env,
  V174P_SESSION_HMAC_KEY:{get:async()=>SECRET},
  V174P_ACCESS_JWKS_JSON:{get:async()=>JSON.stringify({keys:[JWK]})}};
 const r=await call('GET','/healthz',undefined,{env:managed});
 assert.equal(r.status,200);assert.equal(r.data.status,'PRIVATE_QA_READY');
});
test('52 missing managed secret denies before every route',async()=>{
 const r=await call('GET','/healthz',undefined,{env:{...env,V174P_SESSION_HMAC_KEY:{}}});
 assert.equal(r.status,503);
});
test('53 unavailable Secrets Store binding fails closed with no leak',async()=>{
 const r=await call('GET','/healthz',undefined,{env:{...env,
  V174P_SESSION_HMAC_KEY:{get:async()=>{throw Error('SECRET_VALUE_MUST_NOT_LEAK');}}}});
 assert.equal(r.status,503);assert.equal(r.data.reason,'SECRET_BINDING_UNAVAILABLE');
 assert.equal(JSON.stringify(r.data).includes('SECRET_VALUE_MUST_NOT_LEAK'),false);
});
test('54 invalid Secrets Store JWKS binding fails closed',async()=>{
 const r=await call('GET','/healthz',undefined,{env:{...env,
  V174P_ACCESS_JWKS_JSON:{get:async()=>null}}});
 assert.equal(r.status,503);
});


test('55 no Durable Object blocks issuing QA sessions before mint',async()=>{
 const r=await issue({env:{...env,V174P_REPLAY_DO:null}});
 assert.equal(r.status,503);assert.equal(r.data.status,'BLOCKED');
});
test('56 real worker maps DO session rate_limited to 429 with Retry-After',async()=>{
 const blockedDo={idFromName:x=>x,get:()=>({fetch:async()=>Response.json({status:'rate_limited'})})};
 const r=await issue({env:{...env,V174P_REPLAY_DO:blockedDo}});
 assert.equal(r.status,429);assert.equal(r.data.reason,'QA_SESSION_RATE_LIMIT');
 assert.equal(r.headers.get('retry-after'),'60');
});
test('57 real worker maps DO message rate_limited to 429 and no send',async()=>{
 const token=(await issue()).data.token;
 const blockedDo={idFromName:x=>x,get:()=>({fetch:async()=>Response.json({status:'rate_limited'})})};
 const r=await message(token,{event_id:'QA_MSG_RATE_LIMIT_0057'},{env:{...env,V174P_REPLAY_DO:blockedDo}});
 assert.equal(r.status,429);assert.equal(r.data.reason,'QA_MESSAGE_RATE_LIMIT');
 assert.deepEqual([r.data.provider_sends,r.data.model_calls,r.data.commerce_writes],[0,0,0]);
});
test('58 unknown DO answer never mints a session',async()=>{
 const unknownDo={idFromName:x=>x,get:()=>({fetch:async()=>Response.json({status:'unknown'})})};
 const r=await issue({env:{...env,V174P_REPLAY_DO:unknownDo}});
 assert.equal(r.status,503);
});
