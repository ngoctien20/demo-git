// TIEN404 V17.23S: candidate ONLY — never auto-deploy this draft.
// Separate Zalo Bot QA receiver. No provider sends, no Commerce, no customer/Order access.
const MAX_BODY=8192, MAX_WINDOW_MS=30*60*1000, MAX_SKEW_MS=3*60*1000;
const headers={'cache-control':'no-store','x-content-type-options':'nosniff'};
const reply=(status)=>new Response(null,{status,headers});
const isGoodPath=s=>typeof s==='string'&&/^\/qa\/zalo-bot\/[A-Za-z0-9_-]{24,80}$/.test(s);
function constantTimeHeader(received,expected){
 if(typeof received!=='string'||typeof expected!=='string'||expected.length<16||expected.length>256)return false;
 const a=new TextEncoder().encode(received),b=new TextEncoder().encode(expected);
 let mismatch=a.length^b.length;
 for(let i=0;i<256;i++)mismatch|=(a[i]||0)^(b[i]||0);
 return mismatch===0;
}
async function limitedBody(req){
 if(req.headers.get('content-length')&&Number(req.headers.get('content-length'))>MAX_BODY)throw Error('TOO_LARGE');
 const reader=req.body?.getReader();
 if(!reader)throw Error('EMPTY_BODY');
 const chunks=[];let count=0;
 try{
  while(true){
   const {done,value}=await reader.read();
   if(done)break;
   count+=value.byteLength;
   if(count>MAX_BODY)throw Error('TOO_LARGE');
   chunks.push(value);
  }
 }finally{try{reader.releaseLock()}catch{}}
 if(count===0)throw Error('EMPTY_BODY');
 const combined=new Uint8Array(count);let offset=0;
 for(const b of chunks){combined.set(b,offset);offset+=b.byteLength}
 return combined;
}
async function keyedDigest(data,pepper){
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(pepper),
  {name:'HMAC',hash:'SHA-256'},false,['sign']);
 const hash=await crypto.subtle.sign('HMAC',key,data);
 return Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
}
/**
 * D1 contract:
 * CREATE TABLE qa_canary_once (
 *   slot TEXT PRIMARY KEY CHECK(slot='ONE'),
 *   event_hmac TEXT NOT NULL,
 *   accepted_at_ms INTEGER NOT NULL
 * );
 * Atomic INSERT OR IGNORE accepts exactly ONE event globally per disposable DB.
 */
export async function handleDedicatedQaWebhook(req,env={},now=Date.now()){
 if(env.QA_CANARY_MODE!=='OWNER_SCOPED_PRIVATE_NO_SEND_ONCE')return reply(404);
 const path=env.QA_CALLBACK_PATH;
 if(!isGoodPath(path))return reply(503);
 const url=new URL(req.url);
 if(url.pathname!==path||url.search)return reply(404);
 if(req.method!=='POST')return reply(405);
 const from=Number(env.QA_START_MS),to=Number(env.QA_END_MS);
 if(!Number.isSafeInteger(now)||!Number.isSafeInteger(from)||!Number.isSafeInteger(to)||
    from>now||to<now||to-from<=0||to-from>MAX_WINDOW_MS)return reply(410);
 if(typeof env.QA_HEADER_SECRET!=='string'||typeof env.QA_EVENT_PEPPER!=='string'||
    env.QA_EVENT_PEPPER.length<24||!env.QA_EVENT_DB?.prepare||
    typeof env.QA_CHALLENGE!=='string'||!/^TIEN404-QA-[A-Za-z0-9_-]{16,64}$/.test(env.QA_CHALLENGE))return reply(503);
 // Zalo Bot shared-header auth is NOT a signature over the body.
 if(!constantTimeHeader(req.headers.get('x-bot-api-secret-token'),env.QA_HEADER_SECRET))
  return reply(403);
 if(!/^application\/json(?:;\s*charset=utf-8)?$/i.test(req.headers.get('content-type')||''))
  return reply(415);
 let bytes;
 try{bytes=await limitedBody(req)}catch(e){return reply(e.message==='TOO_LARGE'?413:400)}
 let event;try{event=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))}
 catch{return reply(400)}
 if(!event||Array.isArray(event)||typeof event!=='object'||event.event_name!=='message.text.received'||
    !event.message||typeof event.message!=='object'||Array.isArray(event.message))return reply(422);
 const msg=event.message;
 if(typeof msg.message_id!=='string'||msg.message_id.length<8||msg.message_id.length>128||
    msg.chat?.chat_type!=='PRIVATE'||msg.from?.is_bot!==false||
    msg.text!==env.QA_CHALLENGE||!Number.isSafeInteger(msg.date)||
    Math.abs(now-msg.date)>MAX_SKEW_MS)return reply(422);
 // No payload, message content, chat ID or user ID is stored or logged.
 let receipt;
 try{
  const mac=await keyedDigest(bytes,env.QA_EVENT_PEPPER);
  receipt=await env.QA_EVENT_DB.prepare(
   "INSERT OR IGNORE INTO qa_canary_once(slot,event_hmac,accepted_at_ms) VALUES('ONE',?,?)"
  ).bind(mac,now).run();
 }catch{return reply(503)}
 if(!receipt?.success||!Number.isInteger(receipt?.meta?.changes))return reply(503);
 // Provider gets an indistinguishable empty ACK for first delivery and retries.
 return reply(200);
}
export default {fetch:handleDedicatedQaWebhook};
