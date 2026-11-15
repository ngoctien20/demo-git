// TIEN404 V14.5Z LIVE03C budget QA HTTP ONLY.
// Isolated D1, no Zalo, LLM, orders, billing, or external fetch.
const QA_PUBLIC_JWK=__QA_PUBLIC_JWK__;
const ROOT='TIEN404-LIVE03C-QA-V1\nPOST\n/v1/qa/reserve\n';
const STATUS={mode:'OFFLINE_QA_NO_SEND',provider_capable:false,provider_sends:0,model_calls:0,orders_written:0};
const textEncoder=new TextEncoder();
const hex=/^[0-9a-f]{64}$/;
const idPattern=/^qa_live03c_[a-z0-9_-]{3,70}$/;
const required=['kind','grant_id','scope_hash','event_hash','model_id','ts_ms','expected_revision','estimated_input_tokens','maximum_output_tokens'];
const reply=(status,body)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','cross-origin-resource-policy':'same-origin'}});
const denied=(http,error)=>reply(http,{ok:false,error,...STATUS});
function compareSafe(a,b){if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;}
function bytesB64url(s){if(typeof s!=='string'||! /^[a-zA-Z0-9_-]{86,90}$/.test(s))return null;try{return Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-s.length%4)%4)),x=>x.charCodeAt(0));}catch{return null;}}
async function authentic(raw,sig){
 const signature=bytesB64url(sig);if(!signature||signature.length!==64)return false;
 try{const key=await crypto.subtle.importKey('jwk',QA_PUBLIC_JWK,{name:'ECDSA',namedCurve:'P-256'},false,['verify']);return await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},key,signature,textEncoder.encode(ROOT+raw));}
 catch{return false;}
}
function valid(v){
 return v&&Object.getPrototypeOf(v)===Object.prototype&&Object.keys(v).length===required.length&&required.every(k=>Object.prototype.hasOwnProperty.call(v,k))&&
 v.kind==='TIEN404_LIVE03C_BUDGET_QA_V1'&&idPattern.test(v.grant_id)&&hex.test(v.scope_hash)&&hex.test(v.event_hash)&&
 v.model_id==='gpt-5.4-nano'&&Number.isSafeInteger(v.ts_ms)&&Number.isSafeInteger(v.expected_revision)&&v.expected_revision>=0&&v.expected_revision<=3&&
 Number.isSafeInteger(v.estimated_input_tokens)&&v.estimated_input_tokens>=0&&v.estimated_input_tokens<=2500&&
 Number.isSafeInteger(v.maximum_output_tokens)&&v.maximum_output_tokens>=1&&v.maximum_output_tokens<=2500;
}
async function reserve(request,env){
 if(!env.QA_BUDGET_DB)return denied(503,'D1_NOT_BOUND');
 if((request.headers.get('content-type')||'').split(';')[0].trim().toLowerCase()!=='application/json')return denied(415,'JSON_REQUIRED');
 if(Number(request.headers.get('content-length')||0)>1500)return denied(413,'BODY_TOO_LARGE');
 let raw;try{raw=await request.text();}catch{return denied(400,'READ_FAILED');}
 if(raw.length===0||raw.length>1500)return denied(413,'BODY_LIMIT');
 let data;try{data=JSON.parse(raw);}catch{return denied(400,'JSON_INVALID');}
 if(!valid(data))return denied(422,'SCHEMA_INVALID');
 if(Math.abs(Date.now()-data.ts_ms)>90000)return denied(401,'QA_TIMESTAMP_EXPIRED');
 if(!await authentic(raw,request.headers.get('x-tien404-qa-signature')))return denied(401,'SIGNATURE_REQUIRED');
 let policy;
 try{policy=await env.QA_BUDGET_DB.prepare('SELECT grant_id,scope_hash,model_id,status,environment,trust_level,issued_ms,expires_ms FROM z145z_live03c_budget_policies WHERE grant_id=? LIMIT 1').bind(data.grant_id).first();}
 catch{return denied(503,'QA_GRANT_LOOKUP_ERROR');}
 if(!policy||policy.status!=='QA_ARMED'||policy.environment!=='OFFLINE_QA'||policy.trust_level!=='SYNTHETIC_QA_ONLY'||
 !compareSafe(data.scope_hash,policy.scope_hash)||policy.model_id!==data.model_id)return denied(403,'QA_SCOPE_DENIED');
 const now=Date.now();if(now<Number(policy.issued_ms)||now>=Number(policy.expires_ms))return denied(403,'QA_EXPIRED');
 const quote=data.estimated_input_tokens*200+data.maximum_output_tokens*1250;
 try{const r=await env.QA_BUDGET_DB.prepare('INSERT INTO z145z_live03c_budget_events(grant_id,event_hash,scope_hash,expected_revision,estimated_input_tokens,maximum_output_tokens,quoted_nusd) VALUES(?,?,?,?,?,?,?) ON CONFLICT DO NOTHING RETURNING event_hash').bind(data.grant_id,data.event_hash,data.scope_hash,data.expected_revision,data.estimated_input_tokens,data.maximum_output_tokens,quote).all();
 if(r.results?.length!==1)return denied(409,'REPLAY_DETECTED');
 }catch{return denied(409,'QA_CAS_QUOTA_OR_MONEY_CAP_DENIED');}
 let state;try{state=await env.QA_BUDGET_DB.prepare('SELECT calls_reserved,tokens_reserved,money_reserved_nusd,cap_nusd,revision FROM z145z_live03c_budget_policies WHERE grant_id=?').bind(data.grant_id).first();}
 catch{return reply(200,{ok:true,status:'RESERVED_AUDIT_UNAVAILABLE',...STATUS});}
 return reply(200,{ok:true,status:'SYNTHETIC_BUDGET_RESERVED',estimate_nusd:quote,quota:{calls_reserved:state.calls_reserved,tokens_reserved:state.tokens_reserved,money_reserved_nusd:state.money_reserved_nusd,cap_nusd:state.cap_nusd,revision:state.revision},verified_real_balance:false,authorized_live_send:false,...STATUS});
}
export default {async fetch(request,env){
 const path=new URL(request.url).pathname;
 if(path==='/health'&&request.method==='GET')return reply(200,{ok:true,d1_bound:!!env.QA_BUDGET_DB,model_id:'gpt-5.4-nano',auth:'QA_EPHEMERAL_ECDSA_P256_ONLY',...STATUS});
 if(path==='/v1/send'||path.startsWith('/webhook')||path.startsWith('/v1/provider'))return denied(423,'NO_SEND_LOCKED');
 if(path==='/v1/qa/reserve'&&request.method==='POST')return reserve(request,env);
 return denied(404,'NOT_FOUND');
}};