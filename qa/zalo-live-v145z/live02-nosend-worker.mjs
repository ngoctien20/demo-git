// TIEN404 V14.5Z-LIVE02 — SYNTHETIC QA ONLY; no provider, model, or customer access.
const MODE = 'DRY_RUN_NO_SEND';
const QA_PUBLIC_JWK = __QA_PUBLIC_JWK__;
const STATUS = {source:'TIEN404_LIVE02_D1_QA',mode:MODE,sends:0,orders_written:0,customer_writes:0,provider_capable:false};
const digestPattern=/^[0-9a-f]{64}$/;
const grantPattern=/^qa_live02_[a-z0-9_-]{3,48}$/;
const expectedKeys=['kind','grant_id','tenant_hash','store_hash','bot_hash','recipient_hash','session_hash','event_hash','ts_ms','expected_revision','sequence','reserve_tokens'];
const encoder=new TextEncoder();
function respond(status,body){return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','cross-origin-resource-policy':'same-origin'}});}
function noSend(status=423,reason='NO_SEND_LOCKED'){return respond(status,{ok:false,error:reason,...STATUS});}
function equalsSafe(a,b){if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;let v=0;for(let i=0;i<a.length;i++)v|=a.charCodeAt(i)^b.charCodeAt(i);return v===0;}
function b64urlBytes(s){if(typeof s!=='string'||! /^[A-Za-z0-9_-]{86,90}$/.test(s))return null;try{const b=atob(s.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-s.length%4)%4));return Uint8Array.from(b,c=>c.charCodeAt(0));}catch{return null;}}
async function verifiedSignature(raw,header,path){
 const sig=b64urlBytes(header);if(!sig)return false;
 try{
  const key=await crypto.subtle.importKey('jwk',QA_PUBLIC_JWK,{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
  return await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},key,sig,encoder.encode('TIEN404-LIVE02-QA-V1\nPOST\n'+path+'\n'+raw));
 }catch{return false;}
}
function validBody(x){
 return x&&Object.getPrototypeOf(x)===Object.prototype&&Object.keys(x).length===expectedKeys.length&&expectedKeys.every(k=>Object.prototype.hasOwnProperty.call(x,k))&&
 x.kind==='TIEN404_LIVE02_QA_V1'&&grantPattern.test(x.grant_id)&&
 [x.tenant_hash,x.store_hash,x.bot_hash,x.recipient_hash,x.session_hash,x.event_hash].every(z=>typeof z==='string'&&digestPattern.test(z))&&
 Number.isSafeInteger(x.ts_ms)&&Number.isSafeInteger(x.expected_revision)&&x.expected_revision>=0&&
 Number.isSafeInteger(x.sequence)&&x.sequence>0&&x.sequence<=3&&Number.isSafeInteger(x.reserve_tokens)&&x.reserve_tokens>=1&&x.reserve_tokens<=2500;
}
const grantSQL='SELECT grant_id,tenant_hash,store_hash,bot_hash,recipient_hash,issued_ms,expires_ms,status,environment FROM z145z_live01_grants WHERE grant_id=? LIMIT 1';
const claimSQL='INSERT INTO z145z_live01_atomic_claims(grant_id,event_hash,session_hash,expected_revision,sequence,reserve_tokens) VALUES(?,?,?,?,?,?) ON CONFLICT DO NOTHING RETURNING event_hash';
const quotaSQL='SELECT replies_claimed,model_calls_claimed,tokens_reserved FROM z145z_live01_quotas WHERE grant_id=? LIMIT 1';
async function handleClaim(request,env,path){
 if(!env.LIVE02_DB)return noSend(503,'D1_NOT_BOUND');
 if((request.headers.get('content-type')||'').split(';')[0].trim().toLowerCase()!=='application/json')return noSend(415,'JSON_REQUIRED');
 if(Number(request.headers.get('content-length')||0)>2048)return noSend(413,'BODY_TOO_LARGE');
 let raw;try{raw=await request.text();}catch{return noSend(400,'BODY_READ_ERROR');}
 if(raw.length===0||raw.length>2048)return noSend(413,'BODY_LIMIT');
 let data;try{data=JSON.parse(raw);}catch{return noSend(400,'BAD_JSON');}
 if(!validBody(data))return noSend(422,'QA_SCHEMA_INVALID');
 if(Math.abs(Date.now()-data.ts_ms)>90000)return noSend(401,'SIGNED_REQUEST_EXPIRED');
 if(!await verifiedSignature(raw,request.headers.get('x-tien404-qa-signature'),path))return noSend(401,'QA_SIGNATURE_REQUIRED');
 // IMPORTANT: signer is a TEMPORARY TEST signer, NOT Zalo Bot or merchant identity.
 // Scope is looked up in server-bound D1. Never rely on client-provided verified=true.
 let grant;
 try{grant=await env.LIVE02_DB.prepare(grantSQL).bind(data.grant_id).first();}catch{return noSend(503,'QA_SCOPE_LOOKUP_FAILED');}
 if(!grant||grant.status!=='QA_ARMED'||grant.environment!=='OFFLINE_QA'||
  !equalsSafe(grant.tenant_hash,data.tenant_hash)||
  !equalsSafe(grant.store_hash,data.store_hash)||
  !equalsSafe(grant.bot_hash,data.bot_hash)||
  !equalsSafe(grant.recipient_hash,data.recipient_hash))return noSend(403,'QA_BINDING_DENIED');
 const now=Date.now();
 if(now<Number(grant.issued_ms)||now>=Number(grant.expires_ms))return noSend(403,'QA_GRANT_NOT_ACTIVE');
 try{
  const x=await env.LIVE02_DB.prepare(claimSQL).bind(data.grant_id,data.event_hash,data.session_hash,data.expected_revision,data.sequence,data.reserve_tokens).all();
  if(x.results?.length!==1)return noSend(409,'REPLAY_OR_DUPLICATE');
 }catch{return noSend(409,'ATOMIC_CAS_OR_QUOTA_DENIED');}
 let q;
 try{q=await env.LIVE02_DB.prepare(quotaSQL).bind(data.grant_id).first();}catch{return respond(200,{ok:true,status:'QA_RESERVED_AUDIT_UNAVAILABLE',...STATUS});}
 return respond(200,{ok:true,status:'QA_ATOMIC_RESERVED',binding:'SIGNED_SYNTHETIC_QA_ONLY',quota:{replies_claimed:q.replies_claimed,model_calls_claimed:q.model_calls_claimed,tokens_reserved:q.tokens_reserved,limit_replies:3,limit_tokens:2500},...STATUS});
}
export default {async fetch(request,env){
 const u=new URL(request.url);
 if(request.method==='GET'&&u.pathname==='/health')return respond(200,{ok:true,d1_bound:!!env.LIVE02_DB,auth:'ECDSA_P256_EPHEMERAL_QA_PUBLIC_ONLY',...STATUS});
 if(u.pathname==='/v1/send'||u.pathname.startsWith('/v1/provider')||u.pathname.startsWith('/webhook'))return noSend();
 if(request.method==='POST'&&u.pathname==='/v1/qa/claim')return handleClaim(request,env,u.pathname);
 return noSend(404,'NOT_FOUND');
}};