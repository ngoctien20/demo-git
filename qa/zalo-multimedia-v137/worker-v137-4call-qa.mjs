/* TIEN404 v13.7 / v13.8 - owner approved 4-call staging QA only. NO production use. */
export const ZALO_V137_TEST_ID='TIEN404_SHOP_B_MEDIA_V137_20261115';
const STAGE_ORIGIN='https://tien404-zalo-outbound-v1-staging.tienmobi208.workers.dev';
const HARD_EXPIRES='2026-11-15T09:30:00Z';
const CASES=['PHOTO','TYPING','STICKER','VOICE'];
const CLAIM_PREFIX=ZALO_V137_TEST_ID+'_';
const DOC_STICKER_ID='0e078a2fb66a5f34067b'; // Zalo official sendSticker sample; not prevalidated
const PHOTO_B64='iVBORw0KGgoAAAANSUhEUgAAANgAAABaCAMAAADthmgMAAADAFBMVEURJT7m9vlCvowAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAfZoDkAAABIElEQVR42u3c0Q6DIAyF4VPe/6EXBQo4o5s3UvKTmFTqEj+bdrswk1jhVlpwAYsKW663gAEDBgwYMGDAgAEDBgwYMGDAgAELALNtyTzYopzISY+703o+ecUsH4VQoz3IUHU8z0WFmazLWCuTJ6PByl1fwUyxYGbmsHb7LuxgZlErZj5SSmiHir1cskewblTU4aFxeESDtbl/Me5taDi+oIEBAwYMGDBgwIABAwbsMay8IrdfkLqL67tz/tm8UbY9984j+wmWj9TFSpIOW/pKtUcRAnZqSmcwrQgbijh5j9XmuYO1FgxQMf1dsSA9plWHx9m4d0MaJsUw7qeG8csDGDBgwIABAwYMGDBgwIABAwYMGDBgwBaB8Q8swGaAsUKtD4NjD21wZ2gqAAAAAElFTkSuQmCC';
const VOICE_B64='//FgQBTf/N4CAExhdmM2MS4xOS4xMDEAAhBeWqCJB1xqv+Pvz4+8kcySJESJAmSpkrU0tTptq2batnuruntbtXsrunur10YUYV1QWDRVqgsWtmMv1kwrWaaaisW3ONi1WLVTZ02dNnMtMtMlElElAwMDAwMDAwMbBgaUGBpZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZeP/xYEAGv/wA0C8A1kQISULn/t/+fz+4ERoE4g7EQk6HJk8jka/sLxLYHPBIOBmTPIc/AOHA//FgQAf//ADSLwC2VhBFQuvf/t/+fdfgFijCplladIx1YJVMMSDBJ6aP7O80KRhh0NmkmkZ2dHOrkO/wF8OA//FgQAef/ADULwCkGykEIqF16/7f/jzn7iedGoKbcRiN0mjZWnXJUMDuIuqFBvuRGgRsp5znlI5+A554//FgQAk//ADWLwCCKyIMGCEAiEAuE69f9P/x5yVx+BRq1LjyqrFFq5Gke7R482FCAmlrBPNltf5d7lleVGqYCKpxdo6fPJv0OP/xYEAH3/wA1i8ApBshDBwhAKhcd/9v/fnTj6DzzJm9PbI2cVFt52s5XweZwQs2TN5jzyWJAgsY4Dv8BfLg//FgQAif/ADWLwCkGyIMHCEAqF14/7f/pzjX0KKD5xXVF65VJ2JJMZCWvPLQJragzjjbHyz87NNNMkWIsRvgO/wFcuD/8WBACR/8ANYvAIQrKQgGIQQIQGoU69f9v/vlOb/wAU86FSYXMhGc5F2vumqQt3+yF1JIlFiQohUXynnnfKJcFemC+fhBxxz/8WBACN/8ANgvAIQrIgwcIQCoWuPH/j/8/nWa+4Bd37SJ1hrOH2ohYzRAMYjoZvcrxLY2OKOsDAwMDle1wUPORz8IOOuA//FgQAm//ADYLwCEKyIMBiEECEAiEAuFrj1/4/+/Nub6/ASPp9EyViaRhWAlNzWVoxPHTeS1+pUKZKEnAkJOPCuBMBFI1uYcXtpK4fD/8WBAFH/8ANYvIJaWGgwCQQGggCQoC0ntk+3/j/88l85fMTS3wCXyC6EvBRnRY8yruLOy0jnL9DiejNf641j0l3j2dQgH/DI7JyNtkOkSw9vmpfYo/uXrvXWpbzwi56Ur2RorH0eWXTE30ZJMS7dGnLO692qnlnstpfFGRunEha8bl6Z5xsha9LL7l18KXnR08yspPCg06IoXiBgsc4J3m53A//FgQBX//AEKLyD2Khs9BtKlTN9b6yTOtzqRJJzIEUoUG4kabSk4KbEeLOqbrfuJ9ZXYvC7H9OzilJ5x29nVhFw9KSP0DP8txzVlNEj4SGfWzG+6WeqbCm2yJaJGrvhUFna2yJaJGcyVBZ2I7paJJq6brJ6ppKa77paJJq6bViqaSmu+FokmrptsnqmkprvulokmrptsiqaSmu+5aKgm6LlBrwyYJKi5QYkMmCSovg==';
const json=(status,body)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
const seconds=()=>Math.floor(Date.now()/1000);
function secureEqual(a,b){
 if(typeof a!=='string'||typeof b!=='string'||!a||!b)return false;
 // No early return on equality of individual bytes. Hash both full values to fixed lengths.
 return Promise.all([a,b].map(v=>crypto.subtle.digest('SHA-256',new TextEncoder().encode(v))))
  .then(([aa,bb])=>{const x=new Uint8Array(aa),y=new Uint8Array(bb);let d=0;for(let i=0;i<x.length;i++)d|=x[i]^y[i];return d===0;});
}
function fixture(caseId){
 switch(caseId){
  case 'PHOTO': return {endpoint:'sendPhoto',body:{
   photo:STAGE_ORIGIN+'/v1/qa-v137/media/photo.png',
   caption:'TIEN404 QA - anh thu nghiem, khong phai san pham cua cua hang.'}};
  case 'TYPING': return {endpoint:'sendChatAction',body:{action:'typing'}};
  case 'STICKER': return {endpoint:'sendSticker',body:{sticker:DOC_STICKER_ID}};
  case 'VOICE': return {endpoint:'sendVoice',body:{
   voice_url:STAGE_ORIGIN+'/v1/qa-v137/media/voice.aac'}};
  default:return null;
 }
}
function mediaAsset(path){
 if(path!== '/v1/qa-v137/media/photo.png'&&path!== '/v1/qa-v137/media/voice.aac')return null;
 const isPhoto=path.endsWith('photo.png');
 const decoded=atob(isPhoto?PHOTO_B64:VOICE_B64);
 const bytes=Uint8Array.from(decoded,c=>c.charCodeAt(0));
 return new Response(bytes,{status:200,headers:{
  'content-type':isPhoto?'image/png':'audio/aac',
  'content-length':String(bytes.byteLength),'cache-control':'public, max-age=3600',
  'x-content-type-options':'nosniff','access-control-allow-origin':'*'}});
}
export async function v137MediaQaRoute(request,env,path,now=Date.now(),providerFetch=fetch){
 if(path==='/v1/qa-v137/media/photo.png'||path==='/v1/qa-v137/media/voice.aac'){
  if(request.method!=='GET'&&request.method!=='HEAD')return json(405,{ok:false,error:'METHOD_NOT_ALLOWED'});
  if(now>=Date.parse(HARD_EXPIRES))return json(410,{ok:false,error:'QA_MEDIA_EXPIRED'});
  const a=mediaAsset(path);
  return request.method==='HEAD'?new Response(null,{status:200,headers:a.headers}):a;
 }
 if(path!=='/v1/qa-v137/preflight'&&path!=='/v1/qa-v137/send')return null;
 if(request.method!=='POST')return json(405,{ok:false,error:'METHOD_NOT_ALLOWED'});
 if(env.ZALO_SEND_ENABLED!=='false')return json(423,{ok:false,error:'GLOBAL_KILL_SWITCH_UNEXPECTED'});
 const oldExpiry=Date.parse(String(env.ZALO_OWNER_APPROVAL_EXPIRES||''));
 if(!Number.isFinite(oldExpiry)||now>=oldExpiry||now>=Date.parse(HARD_EXPIRES))
  return json(403,{ok:false,error:'QA_APPROVAL_EXPIRED'});
 const auth=request.headers.get('authorization')||'';
 if(!auth.startsWith('Bearer ')||!await secureEqual(auth.slice(7),env.GATEWAY_AUTH_KEY))
  return json(401,{ok:false,error:'UNAUTHORIZED'});
 if(!env.ZALO_BOT_TOKEN||!env.ZALO_OWNER_CHAT_ID||!env.REPLAY_DB)
  return json(503,{ok:false,error:'REQUIRED_BINDING_MISSING'});
 if(!(request.headers.get('content-type')||'').toLowerCase().startsWith('application/json'))
  return json(415,{ok:false,error:'JSON_REQUIRED'});
 let body;
 try{
  const raw=await request.text();
  if(raw.length>450)return json(413,{ok:false,error:'BODY_TOO_LARGE'});
  body=JSON.parse(raw);
 }catch{return json(400,{ok:false,error:'INVALID_BODY'});}
 const send=path.endsWith('/send');
 if(!body||typeof body!=='object'||Array.isArray(body)||
    Object.keys(body).sort().join(',')!==(send?'case_id,chat_id,test_id':'chat_id,test_id')||
    body.test_id!==ZALO_V137_TEST_ID||typeof body.chat_id!=='string'||
    !await secureEqual(body.chat_id,env.ZALO_OWNER_CHAT_ID))
   return json(403,{ok:false,error:'QA_SHOP_B_OWNER_ONLY'});
 if(!send){
  try{
   const r=await providerFetch('https://bot-api.zaloplatforms.com/bot'+env.ZALO_BOT_TOKEN+'/getMe',{
    method:'POST',body:'{}',headers:{'content-type':'application/json'},redirect:'manual',signal:AbortSignal.timeout(5000)});
   const x=await r.json().catch(()=>({}));
   if(!r.ok||x.ok!==true)return json(502,{ok:false,error:'BOT_UNVERIFIED'});
   const used=[];
   for(const k of CASES){
    const v=await env.REPLAY_DB.prepare('SELECT state FROM outbound_claims WHERE idempotency_key = ?1')
     .bind(CLAIM_PREFIX+k).first();
    if(v)used.push({case_id:k,state:v.state});
   }
   return json(200,{ok:true,bot_verified:true,owner_verified:true,shop:'SHOP_B',
    global_send_enabled:false,external_sends:0,claimed:used,allowed_cases:CASES,expires_at:HARD_EXPIRES});
  }catch{return json(503,{ok:false,error:'QA_PREFLIGHT_FAILED'});}
 }
 const plan=fixture(body.case_id);
 if(!plan)return json(422,{ok:false,error:'QA_CASE_NOT_APPROVED'});
 if(plan.endpoint==='sendVoice'&&body.chat_id!==env.ZALO_OWNER_CHAT_ID)
  return json(403,{ok:false,error:'VOICE_ONLY_APPROVED_1_TO_1'});
 const key=CLAIM_PREFIX+body.case_id;
 try{
  const claimed=await env.REPLAY_DB.prepare(
   'INSERT INTO outbound_claims (idempotency_key, created_at, state) VALUES (?1,?2,?3) ON CONFLICT(idempotency_key) DO NOTHING'
   ).bind(key,Math.floor(now/1000),'CLAIMED_BEFORE_SEND').run();
  if(Number(claimed?.meta?.changes)!==1)
   return json(409,{ok:false,error:'ALREADY_CLAIMED_NEVER_RETRY'});
 }catch{return json(503,{ok:false,error:'IDEMPOTENCY_STORE_UNAVAILABLE'});}
 let outcome='UNKNOWN_AFTER_SEND_ATTEMPT',providerAck=false,messageIdPresent=false,httpStatus=0;
 try{
  const r=await providerFetch('https://bot-api.zaloplatforms.com/bot'+env.ZALO_BOT_TOKEN+'/'+plan.endpoint,{
   method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({chat_id:env.ZALO_OWNER_CHAT_ID,...plan.body}),
   redirect:'manual',signal:AbortSignal.timeout(8000)});
  httpStatus=r.status;
  const parsed=await r.json().catch(()=>({}));
  providerAck=r.ok&&parsed.ok===true;
  messageIdPresent=typeof parsed.result?.message_id==='string'&&parsed.result.message_id.length>0;
  outcome=providerAck?'API_ACCEPTED':'PROVIDER_REJECTED';
 }catch{}
 try{await env.REPLAY_DB.prepare('UPDATE outbound_claims SET state = ?1 WHERE idempotency_key = ?2')
  .bind(outcome,key).run();}catch{/* retain consumed claim if updating fails */}
 return json(providerAck?200:502,{ok:providerAck,case_id:body.case_id,result:outcome,
   provider_http_status:httpStatus,provider_message_id_present:messageIdPresent,
   attempts:1,external_sends_attempted:1,orders_written:0,retry_allowed:false});
}
