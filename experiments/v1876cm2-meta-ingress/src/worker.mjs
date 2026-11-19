/**
 * TIEN404 V18.7.6C-M2 Cloudflare Worker source CANDIDATE, NOT DEPLOYED.
 * Only isolated QA App/Page. No provider send, AI, DB, queue, storage, forwarding,
 * customer identity linkage or orders. Not a production Store authority.
 */
const encoder=new TextEncoder();
const MAX_BYTES=65536, MAX_ENTRIES=10, MAX_EVENTS=60, WEBHOOK_PATH="/meta-qa/webhook";
const HEADERS={"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"};
const reply=(status,value)=>new Response(JSON.stringify(value),{status,headers:HEADERS});
const denied=(status,reason)=>reply(status,{ok:false,status:"QA_DENIED",reason,canSend:false,canWrite:false,storeVerified:false});
const obj=x=>x!==null&&typeof x==="object"&&!Array.isArray(x);
function secretEqual(a,b){
 if(typeof a!=="string"||typeof b!=="string")return false;
 const A=encoder.encode(a),B=encoder.encode(b);let mismatch=A.length^B.length;
 for(let i=0;i<Math.max(A.length,B.length);i++)mismatch|=(A[i]||0)^(B[i]||0);
 return mismatch===0;
}
async function boundedRaw(request){
 if(!request.body)return null;
 const len=request.headers.get("content-length");
 if(len!==null&&(/[^0-9]/.test(len)||Number(len)>MAX_BYTES))return null;
 const reader=request.body.getReader(),chunks=[];let size=0;
 try{while(true){
  const {done,value}=await reader.read();if(done)break;
  size+=value.byteLength;
  if(size>MAX_BYTES){await reader.cancel().catch(()=>undefined);return null;}
  chunks.push(value);
 }}finally{reader.releaseLock();}
 if(!size)return null;
 const out=new Uint8Array(size);let offset=0;
 for(const b of chunks){out.set(b,offset);offset+=b.byteLength;}
 return out;
}
async function verifiedSignature(signature,raw,secret){
 if(typeof signature!=="string"||!/^sha256=[0-9a-fA-F]{64}$/.test(signature))return false;
 if(typeof secret!=="string"||secret.length<32)return false;
 const bytes=Uint8Array.from(signature.slice(7).match(/.{2}/g),s=>parseInt(s,16));
 const key=await crypto.subtle.importKey("raw",encoder.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["verify"]);
 return crypto.subtle.verify("HMAC",key,bytes,raw);
}
function eventType(e,standby=false){
 if(!obj(e))return "unknown";
 if(standby)return "standby";
 if(obj(e.delivery))return "message_deliveries";
 if(obj(e.read))return "message_reads";
 if(obj(e.postback))return "messaging_postbacks";
 if(e.pass_thread_control||e.take_thread_control||e.request_thread_control)return "messaging_handovers";
 if(obj(e.policy_enforcement))return "messaging_policy_enforcement";
 if(obj(e.optin))return "messaging_optins";
 if(obj(e.referral))return "messaging_referrals";
 if(obj(e.reaction))return "message_reactions";
 if(obj(e.message)){
  if(e.message.is_echo===true)return "message_echoes";
  if(e.message.is_edit===true||e.message.edit===true)return "message_edits";
  return "messages";
 }
 return "unknown";
}
const META_CHANGE_FIELDS=new Set([
 "messages","messaging_postbacks","message_deliveries","message_reads","message_echoes",
 "message_edits","message_reactions","messaging_handovers","messaging_referrals",
 "messaging_optins","messaging_policy_enforcement","standby"
]);
function changeEventType(change){
 if(!obj(change)||typeof change.field!=="string"||!obj(change.value))return null;
 // Meta Dashboard test events can arrive as entry[].changes[] rather than messaging[].
 // This field name is trusted only AFTER raw-body HMAC verification.
 // Unknown field names are never echoed to avoid disclosing attacker-controlled values.
 if(!META_CHANGE_FIELDS.has(change.field))return "unknown_page_change";
 // Actual staging execution #5533 (19 Nov 2026) confirmed this structure.
 if(change.field==="messaging_postbacks"&&!obj(change.value.postback))return null;
 return change.field;
}
function summarizePagePayload(root){
 // Modal sample {sample:{field,value}} is NOT a verified wire event.
 if(!obj(root)||root.object!=="page"||!Array.isArray(root.entry)||root.entry.length<1||root.entry.length>MAX_ENTRIES)return null;
 const types=Object.create(null);let total=0;
 for(const entry of root.entry){
  if(!obj(entry))return null;
  if("changes" in entry){
   const changes=entry.changes;
   if(!Array.isArray(changes)||changes.length>MAX_EVENTS)return null;
   for(const change of changes){
    const t=changeEventType(change);
    if(!t)return null;
    types[t]=(types[t]||0)+1;
    if(++total>MAX_EVENTS)return null;
   }
  }
  for(const container of ["messaging","standby"]){
   if(!(container in entry))continue;
   const events=entry[container];
   if(!Array.isArray(events)||events.length>MAX_EVENTS)return null;
   for(const e of events){
    const t=eventType(e,container==="standby");types[t]=(types[t]||0)+1;
    if(++total>MAX_EVENTS)return null;
   }
  }
 }
 if(!total)return null;
 return {count:total,types:Object.fromEntries(Object.entries(types).sort())};
}
const safeMode=env=>env?.INSPECTOR_MODE==="ISOLATED_QA_ONLY"&&env?.INSPECTOR_ENABLED==="true";
export default {async fetch(request,env){
 if(!safeMode(env))return denied(503,"INSPECTOR_DISABLED");
 const url=new URL(request.url);
 if(url.pathname!==WEBHOOK_PATH)return denied(404,"UNKNOWN_PATH");
 if(request.method==="GET"){
  if(url.searchParams.get("hub.mode")!=="subscribe")return denied(403,"VERIFY_MODE_DENIED");
  if(!env?.META_VERIFY_TOKEN||env.META_VERIFY_TOKEN.length<24||
   !secretEqual(url.searchParams.get("hub.verify_token"),env.META_VERIFY_TOKEN))
   return denied(403,"VERIFY_TOKEN_DENIED");
  const challenge=url.searchParams.get("hub.challenge");
  if(!challenge||!/^[A-Za-z0-9_-]{1,128}$/.test(challenge))return denied(400,"CHALLENGE_INVALID");
  return new Response(challenge,{status:200,headers:{"content-type":"text/plain; charset=utf-8","cache-control":"no-store"}});
 }
 if(request.method!=="POST")return denied(405,"METHOD_DENIED");
 if(!request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))return denied(415,"CONTENT_TYPE_DENIED");
 const raw=await boundedRaw(request);
 if(!raw)return denied(413,"RAW_BODY_INVALID");
 if(!await verifiedSignature(request.headers.get("x-hub-signature-256"),raw,env?.META_APP_SECRET))
  return denied(401,"META_SIGNATURE_INVALID");
 let payload;
 try{payload=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(raw));}
 catch{return denied(400,"JSON_INVALID");}
 const result=summarizePagePayload(payload);
 if(!result)return denied(422,"PAGE_EVENT_FORMAT_INVALID");
 // No PII IDs, no message data, no logs, no external provider calls.
 return reply(200,{ok:true,status:"ACK_ONLY_NO_SEND",eventCount:result.count,eventTypes:result.types,
  signatureValidForSuppliedBytes:true,actualMetaDeliveryVerified:false,pageSubscriptionVerified:false,
  storeVerified:false,canSend:false,canWrite:false,canReadPrivateOrders:false});
}};
export {MAX_BYTES,MAX_EVENTS,WEBHOOK_PATH,eventType,changeEventType,summarizePagePayload};
