/**
 * TIEN404 V17.4P: Cloudflare Workers private hosted issuer CANDIDATE.
 * NO WORKER DEPLOYMENT authorized by this source. No merchant approval inferred.
 * Only synthetic QA Web Widget A/Shop A, no real Commerce, models or external sends.
 * Access app must also be configured to gate the deployment URL. This code
 * independently verifies signed Access JWT before using any endpoint.
 * Never put private keys, Access JWTs, PSIDs, customers or secrets in GitHub.
 */
export const CONTRACT='T404_V174P_CLOUDFLARE_PRIVATE_ISSUER_QA_V1';
const ORIGIN_RE=/^https:\/\/[a-z0-9.-]+(?::[1-9][0-9]{0,4})?$/;
const INSTALL='QA_WEB_WIDGET_A';
const TENANT='QA_TENANT_1', STORE='QA_STORE_A',BOT='QA_BOT_A';
const SCOPE='QA_CATALOG_ONLY';
const MAX_BODY=2048;
const ASCII=new TextEncoder();
const DECODE=new TextDecoder();
function bytes(x){return ASCII.encode(x);}
function b64u(arr){let s='';for(const b of new Uint8Array(arr))s+=String.fromCharCode(b);return btoa(s).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');}
function unb64(s){
 if(typeof s!=='string'||s.length<2||s.length>4096||!/^[A-Za-z0-9_-]+$/.test(s))throw Error('BASE64URL_FORMAT');
 const pad=s.replace(/-/g,'+').replace(/_/g,'/');
 const x=atob(pad+'='.repeat((4-pad.length%4)%4));
 return Uint8Array.from(x,c=>c.charCodeAt(0));
}
function parseObject(s){
 const obj=JSON.parse(s);
 if(!obj||Array.isArray(obj)||typeof obj!=='object')throw Error('JSON_OBJECT_REQUIRED');
 return obj;
}
const secretOk=e=>typeof e==='string'&&e.length>=32&&e.length<=4096&&!/[\r\n]/.test(e);
function configured(env){
 return env?.V174P_MODE==='QA_SYNTHETIC_ONLY'&&ORIGIN_RE.test(env?.V174P_ISSUER_ORIGIN||'')&&
  /^https:\/\/[a-z0-9.-]+$/.test(env?.V174P_ACCESS_ISSUER||'')&&
  typeof env?.V174P_ACCESS_AUD==='string'&&/^[a-zA-Z0-9_-]{10,100}$/.test(env.V174P_ACCESS_AUD)&&
  secretOk(env?.V174P_SESSION_HMAC_KEY)&&typeof env.V174P_ACCESS_JWKS_JSON==='string'&&
  env.V174P_ACCESS_JWKS_JSON.length>=40&&env.V174P_ACCESS_JWKS_JSON.length<30000 &&
  env.V174P_OWNER_PROOF_STATUS==='UNVERIFIED_QA_ONLY';
}
function reply(value,status=200,html=false){
 return new Response(html?value:JSON.stringify(value),{status,headers:{
  'Content-Type':html?'text/html; charset=utf-8':'application/json; charset=utf-8',
  'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY',
  'Referrer-Policy':'no-referrer',
  'Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'"
 }});
}
const deny=(reason,status=403)=>reply({status:'BLOCKED',reason,
 merchant_owner_verified:false,customer_identity_verified:false,hosted_store_rls_verified:false,
 provider_sends:0,model_calls:0,commerce_writes:0},status);
const validAud=(a,expected)=>typeof a==='string'?a===expected:Array.isArray(a)&&a.includes(expected);
async function verifyAccess(req,env,now){
 const token=req.headers.get('Cf-Access-Jwt-Assertion');
 if(!token||token.length>9000)return null;
 const parts=token.split('.');
 if(parts.length!==3||parts.some(x=>!x||x.length>5000))return null;
 try{
  if(parts.some(part=>b64u(unb64(part))!==part))return null;
  const h=parseObject(DECODE.decode(unb64(parts[0])));
  const p=parseObject(DECODE.decode(unb64(parts[1])));
  if(h.alg!=='RS256'||typeof h.kid!=='string'||h.kid.length>128||
   Object.hasOwn(h,'crit')||p.iss!==env.V174P_ACCESS_ISSUER||
   !validAud(p.aud,env.V174P_ACCESS_AUD)||typeof p.sub!=='string'||p.sub.length<5||
   !Number.isSafeInteger(p.exp)||p.exp<=now||p.exp>now+86400||
   !Number.isSafeInteger(p.iat)||p.iat>now+30||p.iat<now-86400||
   (p.nbf!==undefined&&(!Number.isSafeInteger(p.nbf)||p.nbf>now)))return null;
  const jwks=parseObject(env.V174P_ACCESS_JWKS_JSON);
  if(!Array.isArray(jwks.keys)||jwks.keys.length>20)return null;
  const matching=jwks.keys.filter(k=>k.kid===h.kid&&k.kty==='RSA'&&k.alg==='RS256'&&
   (k.use===undefined||k.use==='sig')&&typeof k.n==='string'&&typeof k.e==='string');
  if(matching.length!==1)return null;
  const pub=await crypto.subtle.importKey('jwk',matching[0],{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  const signed=bytes(parts[0]+'.'+parts[1]);
  const ok=await crypto.subtle.verify('RSASSA-PKCS1-v1_5',pub,unb64(parts[2]),signed);
  return ok?{sub:p.sub}:null;
 }catch{return null;}
}
async function hmac(secret,value){
 const key=await crypto.subtle.importKey('raw',bytes(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return b64u(await crypto.subtle.sign('HMAC',key,bytes(value)));
}
async function constEq(a,b){
 if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;
 const x=bytes(a),y=bytes(b);let diff=0;for(let i=0;i<x.length;i++)diff|=x[i]^y[i];return diff===0;
}
async function jsonBody(req){
 if(req.headers.get('content-type')!=='application/json')throw Error('CONTENT_TYPE');
 if((Number(req.headers.get('content-length'))||0)>MAX_BODY)throw Error('BODY_LIMIT');
 const str=await req.text();
 if(bytes(str).length===0||bytes(str).length>MAX_BODY)throw Error('BODY_LIMIT');
 return parseObject(str);
}
function exact(obj,keys){return Object.keys(obj).length===keys.length&&keys.every(k=>Object.hasOwn(obj,k));}
function apiGuard(req,env,access){
 const url=new URL(req.url);
 if(url.origin!==env.V174P_ISSUER_ORIGIN||req.headers.get('origin')!==url.origin||
  req.headers.get('sec-fetch-site')==='cross-site')return false;
 return !!access;
}
const HTML='<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TIEN404 V17.4P private QA</title></head><body><h1>TIEN404 Private QA — No Send</h1><p id="disclaimer">CHỈ TEST — không phải shop thật, không tạo đơn hoặc gửi tin.</p><section aria-label="Hội thoại QA" id="messages"></section><form id="form"><label for="message">Tin nhắn QA</label><input id="message" maxlength="500" required><button>Gửi thử</button></form><p id="status" role="status">Chưa cấp phiên</p><script src="/qa-client.js" type="module"></script></body></html>';
const JS=String.raw`let jwt=null,expires=0;const log=document.getElementById('messages');const form=document.getElementById('form');const status=document.getElementById('status');function add(txt){const e=document.createElement('p');e.textContent=txt;log.appendChild(e)}form.addEventListener('submit',async e=>{e.preventDefault();const input=document.getElementById('message');const text=input.value;input.value='';try{if(!jwt||Date.now()>=expires){const r=await fetch('/v1/website/sessions',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({installation_ref:'QA_WEB_WIDGET_A'})});if(!r.ok)throw Error('NO_SESSION');const j=await r.json();if(j.status!=='QA_SESSION_ISSUED')throw Error('NO_SESSION');jwt=j.token;expires=Date.now()+Math.min(j.expires_in_sec,300)*1000}const id='QA_MSG_'+crypto.randomUUID().replaceAll('-','').toUpperCase();const r=await fetch('/v1/website/messages',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json',Authorization:'Bearer '+jwt},body:JSON.stringify({installation_ref:'QA_WEB_WIDGET_A',event_id:id,requested_tool:'catalog_read',text})});if(!r.ok)throw Error('REJECTED');const j=await r.json();if(j.status!=='QA_REPLY_PREPARED'||j.provider_sends!==0||j.commerce_writes!==0)throw Error('UNSAFE');add(j.reply);status.textContent='QA NO SEND — không có đơn thật'}catch{add('QA bị chặn — không có thao tác thật');status.textContent='BLOCKED'}});`;
async function resolveManagedSecret(value){
 if(typeof value==='string')return value; // Per-Worker secret binding
 if(value&&typeof value.get==='function')return await value.get(); // Cloudflare Secrets Store binding
 return null; // fail closed: never use a mock/default key in hosted mode
}
async function handler(req,bindings){
 // Resolve both managed Secrets Store bindings before any route, including healthz.
 // No secret values, exceptions or Access JWTs are returned/logged to clients.
 let env;
 try {
  env={...bindings,
   V174P_SESSION_HMAC_KEY:await resolveManagedSecret(bindings?.V174P_SESSION_HMAC_KEY),
   V174P_ACCESS_JWKS_JSON:await resolveManagedSecret(bindings?.V174P_ACCESS_JWKS_JSON)};
 }catch{return deny('SECRET_BINDING_UNAVAILABLE',503);}
 if(!configured(env))return deny('NOT_CONFIGURED',503);
 let url;try{url=new URL(req.url);}catch{return deny('INVALID_URL');}
 if(url.origin!==env.V174P_ISSUER_ORIGIN)return deny('UNAPPROVED_HOST');
 if(url.search||url.hash)return deny('UNEXPECTED_QUERY');
 const now=Math.floor(Date.now()/1000),access=await verifyAccess(req,env,now);
 if(!access)return deny('PRIVATE_ACCESS_REQUIRED',401);
 if(req.method==='GET'){
  if(url.pathname==='/healthz')return reply({status:'PRIVATE_QA_READY',owner_verified:false,hosted_store_rls_verified:false});
  if(url.pathname==='/qa')return reply(HTML,200,true);
  if(url.pathname==='/qa-client.js')return new Response(JS,{status:200,headers:{'Content-Type':'text/javascript; charset=utf-8',
   'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
   'Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'"}});
  return deny('UNKNOWN_ROUTE',404);
 }
 if(req.method!=='POST'||!['/v1/website/sessions','/v1/website/messages'].includes(url.pathname))return deny('METHOD_NOT_ALLOWED',405);
 if(!apiGuard(req,env,access))return deny('CROSS_ORIGIN_REQUEST');
 let b;try{b=await jsonBody(req);}catch{return deny('BOUNDED_JSON_REQUIRED',400);}
 const subSig=await hmac(env.V174P_SESSION_HMAC_KEY,access.sub);
 if(url.pathname==='/v1/website/sessions'){
  if(!exact(b,['installation_ref'])||b.installation_ref!==INSTALL)return deny('UNBOUND_QA_WIDGET');
  const sid=b64u(crypto.getRandomValues(new Uint8Array(24)));
  const payload={v:1,iss:env.V174P_ISSUER_ORIGIN,aud:'t404-qa-widget',iat:now,exp:now+300,sid,
   channel:'website',installation_ref:INSTALL,tenant_ref:TENANT,store_ref:STORE,
   bot_ref:BOT,bot_version:'QA_BOT_A_V1',scope:SCOPE,access_sub_sig:subSig};
  const data=b64u(bytes(JSON.stringify(payload))),sig=await hmac(env.V174P_SESSION_HMAC_KEY,'t404p1.'+data);
  return reply({status:'QA_SESSION_ISSUED',token:'t404p1.'+data+'.'+sig,expires_in_sec:300,
   owner_verified:false,customer_identity_verified:false,hosted_store_rls_verified:false,
   provider_sends:0,model_calls:0,commerce_writes:0});
 }
 if(!exact(b,['installation_ref','event_id','requested_tool','text'])||
  b.installation_ref!==INSTALL||b.requested_tool!=='catalog_read'||
  typeof b.event_id!=='string'||!/^QA_MSG_[A-Z0-9_]{2,80}$/.test(b.event_id)||
  typeof b.text!=='string'||b.text.length<1||b.text.length>500)return deny('UNAUTHORIZED_MESSAGE_ACTION');
 const bearer=req.headers.get('authorization');
 if(!bearer?.startsWith('Bearer ')||bearer.length>2500)return deny('SESSION_REQUIRED',401);
 const token=bearer.slice(7),t=token.split('.');
 if(t.length!==3||t[0]!=='t404p1'||t[1].length>1800||t[2].length>80)return deny('SESSION_FORMAT');
 if(!await constEq(await hmac(env.V174P_SESSION_HMAC_KEY,'t404p1.'+t[1]),t[2]))return deny('SESSION_HMAC_INVALID');
 let p;try{p=parseObject(DECODE.decode(unb64(t[1])));}catch{return deny('SESSION_DATA_INVALID');}
 const expected=['v','iss','aud','iat','exp','sid','channel','installation_ref','tenant_ref','store_ref','bot_ref','bot_version','scope','access_sub_sig'];
 if(!exact(p,expected)||p.v!==1||p.iss!==env.V174P_ISSUER_ORIGIN||p.aud!=='t404-qa-widget'||
 p.channel!=='website'||p.installation_ref!==INSTALL||p.tenant_ref!==TENANT||p.store_ref!==STORE||
 p.bot_ref!==BOT||p.bot_version!=='QA_BOT_A_V1'||p.scope!==SCOPE||p.access_sub_sig!==subSig||
 typeof p.sid!=='string'||!/^[A-Za-z0-9_-]{32}$/.test(p.sid)||
 !Number.isSafeInteger(p.iat)||!Number.isSafeInteger(p.exp)||p.exp-p.iat!==300||p.iat>now+30||p.exp<=now)
 return deny('SESSION_SCOPE_INVALID');
 if(!env.V174P_REPLAY_DO?.idFromName||!env.V174P_REPLAY_DO?.get)return deny('DURABLE_CLAIM_NOT_CONFIGURED',503);
 const k=await hmac(env.V174P_SESSION_HMAC_KEY,p.sid+'|'+b.event_id);
 const fingerprint=await hmac(env.V174P_SESSION_HMAC_KEY,b.text+'|'+b.requested_tool);
 let claim;
 try{
  const stub=env.V174P_REPLAY_DO.get(env.V174P_REPLAY_DO.idFromName('QA_ONLY_V174P'));
  const resp=await stub.fetch(new Request('https://durable.internal/claim',{method:'POST',
   headers:{'Content-Type':'application/json'},body:JSON.stringify({key:k,fingerprint,expires_at:p.exp})}));
  if(!resp.ok)return deny('DURABLE_CLAIM_UNAVAILABLE',503);
  claim=(await resp.json()).status;
 }catch{return deny('DURABLE_CLAIM_UNAVAILABLE',503);}
 if(claim==='duplicate')return reply({status:'DUPLICATE_IGNORED',provider_sends:0,model_calls:0,commerce_writes:0});
 if(claim!=='claimed')return deny('REPLAY_OR_CLAIM_CONFLICT');
 return reply({status:'QA_REPLY_PREPARED',reply:'Ví dụ QA: QA_SKU_001 giá 159000 VND, tồn 5.',
   store_ref:STORE,bot_ref:BOT,price_vnd:159000,stock:5,
   outbound:'MOCK_ONLY_NOT_SENT',owner_verified:false,customer_identity_verified:false,
   hosted_store_rls_verified:false,provider_sends:0,model_calls:0,commerce_writes:0});
}
export default {fetch:handler};

/**
 * Deploy requires SQLite-backed Durable Object namespace binding (NOT created).
 * Use transactional storage to prevent duplicate-claim races across isolates.
 */
export class V174PReplayGuard {
 constructor(state){this.state=state;}
 async fetch(request){
  if(new URL(request.url).pathname!=='/claim'||request.method!=='POST')return reply({status:'DENY'},405);
  let body;try{body=await request.json();}catch{return reply({status:'DENY'},400);}
  if(!body||typeof body.key!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(body.key)||
  typeof body.fingerprint!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(body.fingerprint)||
  !Number.isSafeInteger(body.expires_at))return reply({status:'DENY'},400);
  const result=await this.state.storage.transaction(async txn=>{
   const prior=await txn.get('event:'+body.key);
   if(prior)return prior.fingerprint===body.fingerprint?'duplicate':'conflict';
   await txn.put('event:'+body.key,{fingerprint:body.fingerprint,expires_at:body.expires_at});
   return 'claimed';
  });
  return reply({status:result});
 }
}
