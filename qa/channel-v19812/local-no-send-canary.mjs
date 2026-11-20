/**
 * TIEN404 V19.8.12 — LOCAL Zalo-style webhook NO-SEND CANARY.
 *
 * This is a local simulator with the official header name, NOT a real Zalo
 * delivery or proof of provider identity. No provider send APIs or commerce
 * mutations; only ephemeral local acknowledgment counters.
 */
import {createHash,timingSafeEqual,randomBytes} from 'node:crypto';
import http from 'node:http';

const SECRET_HEADER='x-bot-api-secret-token';
const MAX_BODY=4096;
function constantEqual(a,b){
 if(typeof a!=='string'||typeof b!=='string'||!a||!b)return false;
 const x=createHash('sha256').update(a,'utf8').digest();
 const y=createHash('sha256').update(b,'utf8').digest();
 return timingSafeEqual(x,y);
}
function ack(httpStatus,reason){
 return {httpStatus,receipt:{status:reason,receiptOnly:true,
  botIdentityBound:false,storeAuthorized:false,ownerRoleGranted:false,
  canReadHosted:false,canSend:false,canWrite:false,
  providerSends:0,commerceWrites:0,hostedReads:0,customerReply:null}};
}
export function acceptSyntheticReceipt({header,body,secret,nowMs,seen,installationRef}){
 if(!constantEqual(header,secret))return ack(403,'DENY_HEADER_AUTH');
 if(!Buffer.isBuffer(body)||body.length>MAX_BODY||body.length<2)
  return ack(413,'DENY_BODY_LIMIT');
 let payload;
 try{payload=JSON.parse(body.toString('utf8'))}catch{return ack(400,'DENY_JSON_INVALID')}
 if(!payload||payload.ok!==true||!payload.result||
  payload.result.event_name!=='message.text.received')
  return ack(202,'IGNORED_EVENT_TYPE');
 const m=payload.result.message;
 if(!m||!m.chat||m.chat.chat_type!=='PRIVATE'||m.from?.is_bot!==false)
  return ack(202,'IGNORED_NOT_PRIVATE_USER');
 if(typeof m.message_id!=='string'||!/^[a-zA-Z0-9_-]{8,80}$/.test(m.message_id)||
   !Number.isSafeInteger(m.date)||!Number.isSafeInteger(nowMs)||
   Math.abs(nowMs-m.date)>300000)
  return ack(202,'IGNORED_STALE_OR_INVALID_EVENT');
 if(!seen||typeof seen.has!=='function'||typeof seen.add!=='function'||
   installationRef!=='QA_INSTALL_A')
  return ack(403,'DENY_PRIVATE_TEST_REGISTRY');
 // This set is LOCAL QA ONLY; production requires transaction-scoped durable inbox.
 const eventDigest=createHash('sha256')
  .update(installationRef+'\0'+m.message_id).digest('hex');
 if(seen.has(eventDigest))return ack(202,'IGNORED_REPLAY');
 seen.add(eventDigest);
 // Nothing references m.text, m.chat.id or m.from.id; no provider recipient.
 return ack(200,'RECEIPT_ACCEPTED_NO_SEND');
}

export async function runLocalCanary(){
 if(process.env.T404_V19812_CANARY!=='LOCAL_NO_SEND_TEST_ONLY')
  throw Error('CANARY_LOCAL_GUARD_REQUIRED');
 if(process.env.ZALO_BOT_TOKEN||process.env.SUPABASE_ACCESS_TOKEN)
  throw Error('LIVE_PROVIDER_OR_HOSTED_CREDENTIAL_FORBIDDEN');
 const secret=randomBytes(32).toString('hex'),seen=new Set(),nowMs=Date.now();
 const server=http.createServer((req,res)=>{
  if(req.method!=='POST'||req.url!=='/v19812/qa/receipt'){
   res.writeHead(404,{'content-type':'application/json'});
   res.end(JSON.stringify(ack(404,'DENY_METHOD_OR_PATH').receipt));return;
  }
  let length=0;const chunks=[];
  req.on('data',chunk=>{
   length+=chunk.length;
   if(length>MAX_BODY){res.writeHead(413);res.end();req.destroy();return;}
   chunks.push(chunk);
  });
  req.on('end',()=>{
   if(length>MAX_BODY)return;
   const result=acceptSyntheticReceipt({
    header:req.headers[SECRET_HEADER],
    body:Buffer.concat(chunks),secret,nowMs:Date.now(),
    seen,installationRef:'QA_INSTALL_A'
   });
   res.writeHead(result.httpStatus,{'content-type':'application/json',
    'cache-control':'no-store'});
   res.end(JSON.stringify(result.receipt));
  });
 });
 await new Promise((resolve,reject)=>{
  server.once('error',reject);
  server.listen(0,'127.0.0.1',resolve);
 });
 const port=server.address().port;
 const url='http://127.0.0.1:'+port+'/v19812/qa/receipt';
 const payload=eventId=>({ok:true,result:{event_name:'message.text.received',
  message:{from:{id:'fictional-user',is_bot:false},chat:{
    id:'fictional-chat',chat_type:'PRIVATE'},message_id:eventId,
    text:'DỮ LIỆU MẪU',date:Date.now()}}});
 const cases=[
  {label:'VALID_HEADER_RECEIPT_NO_SEND',id:'QA_EVENT_0001',header:secret,status:200},
  {label:'MISSING_HEADER_DENIED',id:'QA_EVENT_0002',header:null,status:403},
  {label:'WRONG_HEADER_DENIED',id:'QA_EVENT_0003',header:'wrong',status:403},
  {label:'REPLAY_DENIED',id:'QA_EVENT_0001',header:secret,status:202},
  {label:'SECOND_UNIQUE_EVENT',id:'QA_EVENT_0004',header:secret,status:200}
 ];
 let passed=0;
 try{
  for(const c of cases){
   const headers={'content-type':'application/json'};
   if(c.header)headers[SECRET_HEADER]=c.header;
   const r=await fetch(url,{method:'POST',headers,
    body:JSON.stringify(payload(c.id)),redirect:'error',
    signal:AbortSignal.timeout(5000)});
   const body=await r.json();
   if(r.status!==c.status||body.canSend!==false||body.canWrite!==false||
      body.storeAuthorized!==false||body.botIdentityBound!==false||
      body.providerSends!==0||body.customerReply!==null)
    throw Error('NO_SEND_CANARY_FAIL_'+c.label);
   passed++;
   process.stdout.write('V19812_CANARY_PASS_'+c.label+'\n');
  }
  const r=await fetch(url,{method:'GET',signal:AbortSignal.timeout(5000)});
  if(r.status!==404)throw Error('NO_SEND_CANARY_GET_SHOULD_DENY');
  passed++;
  process.stdout.write('V19812_CANARY_PASS_GET_DENIED\n');
  process.stdout.write(JSON.stringify({
   checkpoint:'V19.8.12_PRIVATE_NO_SEND_CANARY_LOCAL_ONLY',
   testsPassed:passed,failed:0,realZaloDelivery:false,
   realZaloProviderEvidence:false,providerSends:0,
   commerceWrites:0,hostedReads:0,
   onlySyntheticEvents:true})+'\n');
 }finally{
  await new Promise(resolve=>server.close(resolve));
 }
}
if(process.argv.includes('--local-canary')){
 runLocalCanary().catch(e=>{
  const name=String(e.message||'UNKNOWN');
  process.stderr.write('V19812_NO_SEND_CANARY_BLOCKED_'+
    (/^[A-Z0-9_]+$/.test(name)?name:'INTERNAL_ERROR')+'\n');
  process.exitCode=1;
 });
}
