import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import https from 'node:https';
import {readFileSync} from 'node:fs';
import {createPrivateLoopbackQaIssuer} from './local-https-issuer.mjs';

const keyFile=process.env.T404_V174_QA_TLS_KEY_FILE;
const certFile=process.env.T404_V174_QA_TLS_CERT_FILE;
if(!keyFile||!certFile)throw Error('OFFLINE_TLS_QA_CERT_FILES_REQUIRED');
const app=createPrivateLoopbackQaIssuer({keyPem:readFileSync(keyFile,'utf8'),certPem:readFileSync(certFile,'utf8')});
let origin;
before(async()=>{origin=await app.listen();});
after(async()=>{await app.close();});
const req=(method,path,body=null,more={})=>new Promise((resolve,reject)=>{
 const url=new URL(origin+path);
 const str=body===null?null:typeof body==='string'?body:JSON.stringify(body);
 const headers={...(method==='POST'?{'Origin':origin,'Content-Type':'application/json'}:{}),...more.headers};
 if(str!==null)headers['Content-Length']=Buffer.byteLength(str);
 const r=https.request(url,{method,headers,rejectUnauthorized:false,timeout:5000},res=>{
  const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>{
   const raw=Buffer.concat(chunks).toString('utf8');
   let json;try{json=JSON.parse(raw);}catch{json={raw};}
   resolve({status:res.statusCode,headers:res.headers,json,raw});
  });
 });
 r.on('error',reject);r.on('timeout',()=>r.destroy(Error('QA_NETWORK_TIMEOUT')));
 if(str!==null)r.write(str);r.end();
});
const sess=()=>req('POST','/v1/website/sessions',{installation_ref:'QA_WEB_WIDGET_A'});
const msg=(token,event_id='QA_MSG_0001',extra={})=>req('POST','/v1/website/messages',
 {installation_ref:'QA_WEB_WIDGET_A',event_id,text:'Giá QA_SKU_001?',requested_tool:'catalog_read',...extra},
 {headers:{Authorization:'Bearer '+token}});
test('01 binds to loopback HTTPS 127.0.0.1 only',()=>assert.match(origin,/^https:\/\/127\.0\.0\.1:\d+$/));
test('02 health is clearly QA and never owner verified',async()=>{
 const x=await req('GET','/healthz');assert.equal(x.status,200);
 assert.equal(x.json.status,'V174_QA_LOOPBACK_ONLY');assert.equal(x.json.real_owner_verified,false);
});
test('03 public root not found',async()=>assert.equal((await req('GET','/')).status,404));
test('04 browser page HTML served with strict CSP',async()=>{
 const x=await req('GET','/qa');assert.equal(x.status,200);assert.match(x.raw,/CHỈ ĐỂ KIỂM THỬ/);
 assert.match(x.headers['content-security-policy'],/script-src 'self'/);
});
test('05 client adapter only served locally',async()=>assert.equal((await req('GET','/qa-adapter.mjs')).status,200));
test('06 script uses strict no-cache',async()=>{
 const x=await req('GET','/qa-ui.mjs');assert.equal(x.headers['cache-control'],'no-store');
});
test('07 real TLS POST issues QA signed session',async()=>{
 const x=await sess();assert.equal(x.status,200);assert.equal(x.json.status,'SESSION_ISSUED');
 assert.match(x.json.token,/^t404s1\.qa_v174\./);
});
test('08 session TTL is 300 seconds',async()=>assert.equal((await sess()).json.expires_in_sec,300));
test('09 session states synthetic only',async()=>assert.equal((await sess()).json.source_scope,'SYNTHETIC_QA_ONLY'));
test('10 issued session not verified customer identity',async()=>assert.equal((await sess()).json.customer_identity_verified,false));
test('11 rejects missing Origin header',async()=>{
 const x=await req('POST','/v1/website/sessions',{installation_ref:'QA_WEB_WIDGET_A'},{headers:{Origin:''}});
 assert.equal(x.status,403);
});
test('12 rejects wrong Origin header',async()=>{
 const x=await req('POST','/v1/website/sessions',{installation_ref:'QA_WEB_WIDGET_A'},{headers:{Origin:'https://attacker.invalid'}});
 assert.equal(x.status,403);
});
test('13 blocks cross-site Sec-Fetch-Site',async()=>{
 const x=await req('POST','/v1/website/sessions',{installation_ref:'QA_WEB_WIDGET_A'},{headers:{'Sec-Fetch-Site':'cross-site'}});
 assert.equal(x.status,403);
});
test('14 rejects Website B installation (same Tenant)',async()=>{
 const x=await req('POST','/v1/website/sessions',{installation_ref:'QA_WEB_WIDGET_B'});
 assert.equal(x.status,403);
});
test('15 rejects arbitrary widget installation',async()=>{
 const x=await req('POST','/v1/website/sessions',{installation_ref:'QA_UNKNOWN_WIDGET'});
 assert.equal(x.status,403);
});
test('16 rejects client-supplied Store on session mint',async()=>{
 const x=await req('POST','/v1/website/sessions',{installation_ref:'QA_WEB_WIDGET_A',store_ref:'QA_STORE_B'});
 assert.equal(x.status,403);
});
test('17 rejects client-supplied tenant on session mint',async()=>{
 const x=await req('POST','/v1/website/sessions',{installation_ref:'QA_WEB_WIDGET_A',tenant_ref:'QA_TENANT_2'});
 assert.equal(x.status,403);
});
test('18 rejects non JSON Content-Type',async()=>{
 const x=await req('POST','/v1/website/sessions',{installation_ref:'QA_WEB_WIDGET_A'},{headers:{'Content-Type':'text/plain'}});
 assert.equal(x.status,403);
});
test('19 rejects invalid JSON body',async()=>{
 const x=await req('POST','/v1/website/sessions','{bad-json');
 assert.equal(x.status,400);
});
test('20 rejects oversized body',async()=>{
 const x=await req('POST','/v1/website/sessions','X'.repeat(5000));assert.equal(x.status,400);
});
test('21 rejects unknown HTTP path',async()=>{
 const x=await req('POST','/admin/delete',{});assert.equal(x.status,405);
});
test('22 valid signed Website message yields deterministic mock catalog',async()=>{
 const token=(await sess()).json.token;
 const x=await msg(token,'QA_MSG_0022');assert.equal(x.status,200);
 assert.equal(x.json.status,'QA_CATALOG_REPLY_PREPARED');
 assert.equal(x.json.price_vnd,159000);assert.equal(x.json.store_ref,'QA_STORE_A');
});
test('23 valid message never calls model or sends provider messages',async()=>{
 const token=(await sess()).json.token;
 const x=await msg(token,'QA_MSG_0023');
 assert.deepEqual([x.json.provider_sends,x.json.model_calls,x.json.commerce_writes],[0,0,0]);
});
test('24 rejects bearer token absent',async()=>{
 const x=await req('POST','/v1/website/messages',{installation_ref:'QA_WEB_WIDGET_A',event_id:'QA_MSG_0024',
 text:'QA',requested_tool:'catalog_read'});assert.equal(x.status,401);
});
test('25 rejects fake bearer token',async()=>{
 const x=await msg('FAKE_TOKEN','QA_MSG_0025');assert.equal(x.status,403);
});
test('26 rejects create_order',async()=>{
 const x=await msg((await sess()).json.token,'QA_MSG_0026',{requested_tool:'create_order'});assert.equal(x.status,403);
});
test('27 rejects order_read',async()=>{
 const x=await msg((await sess()).json.token,'QA_MSG_0027',{requested_tool:'order_read'});assert.equal(x.status,403);
});
test('28 rejects customer supplied bot_id',async()=>{
 const x=await msg((await sess()).json.token,'QA_MSG_0028',{bot_id:'QA_BOT_B'});assert.equal(x.status,401);
});
test('29 rejects customer supplied store_id',async()=>{
 const x=await msg((await sess()).json.token,'QA_MSG_0029',{store_id:'QA_STORE_B'});assert.equal(x.status,401);
});
test('30 rejects customer verified flag',async()=>{
 const x=await msg((await sess()).json.token,'QA_MSG_0030',{verified:true});assert.equal(x.status,401);
});
test('31 replay returns duplicate without repeat action',async()=>{
 const token=(await sess()).json.token;
 const x=await msg(token,'QA_MSG_0031');
 const y=await msg(token,'QA_MSG_0031');
 assert.equal(x.json.status,'QA_CATALOG_REPLY_PREPARED');
 assert.equal(y.json.status,'DUPLICATE_IGNORED');
});
test('32 next turn shares session but different event ID',async()=>{
 const token=(await sess()).json.token;
 const x=await msg(token,'QA_MSG_0032'),y=await msg(token,'QA_MSG_0033');
 assert.equal(x.json.status,'QA_CATALOG_REPLY_PREPARED');assert.equal(y.json.status,'QA_CATALOG_REPLY_PREPARED');
});
test('33 UI sessions and sent messages have no customer PII',async()=>{
 const token=(await sess()).json.token;
 const x=await msg(token,'QA_MSG_0034');
 assert.equal(x.json.customer_identity_verified,false);assert.equal(x.json.hosted_rls_verified,false);
});
test('34 failure response prevents token/secret disclosure',async()=>{
 const x=await msg('INVALID','QA_MSG_0035');
 assert(!x.raw.includes('SECRET'));assert(!x.raw.includes('PRIVATE KEY'));
});
test('35 no real side effects in server stats',()=>{
 const s=app.getStats();assert.equal(s.provider_sends,0);assert.equal(s.commerce_writes,0);
 assert.equal(s.model_calls,0);assert.equal(s.real_merchant_owner_verified,false);
});
test('36 revoked installation cannot mint another session',async()=>{
 app.revoke();
 const x=await sess();assert.equal(x.status,403);
});
