import test from 'node:test';
import assert from 'node:assert/strict';
import {handleDedicatedQaWebhook} from './isolated-qa-webhook.mjs';
const now=1794958500000;
const path='/qa/zalo-bot/DIFFERENT-QA-BOT-ONLY-123456';
const challenge='TIEN404-QA-ONLY-DISPOSABLE-TEST-123456';
const secret='FAKE_QA_HEADER_SECRET_1234567890',pepper='FAKE_QA_HMAC_PEPPER_SEPARATE_1234567890';
function fixtureDb(){
 const rows=new Map();let writes=0;
 return {rows,get writes(){return writes},prepare(sql){
  if(!sql.startsWith('INSERT OR IGNORE INTO qa_canary_once'))throw Error('UNEXPECTED_SQL');
  return {bind(mac,ts){return {async run(){writes++;const changes=rows.has('ONE')?0:1;if(changes)rows.set('ONE',{mac,ts});
     return {success:true,meta:{changes}}}}}};
 }};
}
const realish={event_name:'message.text.received',message:{message_id:'FAKE_MESSAGE_001',chat:{chat_type:'PRIVATE',id:'FAKE_CHAT_DO_NOT_SAVE'},
 from:{is_bot:false,id:'FAKE_SENDER_DO_NOT_SAVE'},text:challenge,date:now}};
function env(db=fixtureDb()){return {QA_CANARY_MODE:'OWNER_SCOPED_PRIVATE_NO_SEND_ONCE',QA_CALLBACK_PATH:path,
 QA_START_MS:String(now-30000),QA_END_MS:String(now+30000),QA_HEADER_SECRET:secret,QA_EVENT_PEPPER:pepper,
 QA_CHALLENGE:challenge,QA_EVENT_DB:db}};
function req({method='POST',header=secret,contentType='application/json',body=JSON.stringify(realish),url='https://qa.invalid'+path,headers={}}={}){
 return new Request(url,{method,headers:{'x-bot-api-secret-token':header,'content-type':contentType,...headers},body:method==='POST'?body:undefined});
}
async function call(overrides={},patch={},date=now){
 return handleDedicatedQaWebhook(req(overrides),{...env(),...patch},date);
}
test('default inert no credentials no route',async()=>assert.equal((await handleDedicatedQaWebhook(req(),{})).status,404));
test('wrong route denied without touching database',async()=>{
 const db=fixtureDb(),r=await handleDedicatedQaWebhook(req({url:'https://qa.invalid/other'}),env(db),now);
 assert.equal(r.status,404);assert.equal(db.writes,0);
});
test('unexpected URL query denied',async()=>assert.equal((await call({url:'https://qa.invalid'+path+'?debug=1'})).status,404));
test('GET denied',async()=>assert.equal((await call({method:'GET'})).status,405));
test('before window denied',async()=>assert.equal((await call({}, {},now-100000)).status,410));
test('after window denied',async()=>assert.equal((await call({}, {},now+100000)).status,410));
test('window longer than 30min denied',async()=>assert.equal((await call({}, {QA_END_MS:String(now+31*60*1000)})).status,410));
test('bad callback path format is not public',async()=>assert.equal((await call({}, {QA_CALLBACK_PATH:'/qa/zalo-bot/live'})).status,503));
test('missing D1 binding fails closed',async()=>assert.equal((await call({}, {QA_EVENT_DB:null})).status,503));
test('missing replay pepper denied',async()=>assert.equal((await call({}, {QA_EVENT_PEPPER:''})).status,503));
test('missing challenge denied',async()=>assert.equal((await call({}, {QA_CHALLENGE:''})).status,503));
test('missing header denied',async()=>assert.equal((await call({header:''})).status,403));
test('wrong header denied',async()=>assert.equal((await call({header:secret+'X'})).status,403));
test('wrong content type denied',async()=>assert.equal((await call({contentType:'text/plain'})).status,415));
test('UTF8 charset accepted',async()=>assert.equal((await call({contentType:'application/json; charset=UTF-8'})).status,200));
test('JSON parsing error denied',async()=>assert.equal((await call({body:'{not-json'})).status,400));
test('empty body denied',async()=>assert.equal((await call({body:''})).status,400));
test('oversize >8k denied',async()=>assert.equal((await call({body:JSON.stringify({...realish,padding:'X'.repeat(8300)})})).status,413));
test('header says larger than 8k denied',async()=>assert.equal((await call({headers:{'content-length':'99999'}})).status,413));
test('non-matching event name denied',async()=>{
 const b=JSON.stringify({...realish,event_name:'user_send_text'});
 assert.equal((await call({body:b})).status,422);
});
test('result-wrapper event denied until provider contract reviewed',async()=>{
 assert.equal((await call({body:JSON.stringify({ok:true,result:realish})})).status,422);
});
for(const [name,patch] of [
 ['missing message id',{message_id:''}],['wrong chat',{chat:{chat_type:'GROUP'}}],
 ['bot sender',{from:{is_bot:true}}],['wrong user message',{text:'Hello world'}],
 ['stale provider date',{date:now-999999}],['future provider date',{date:now+999999}],
 ['missing sender',{from:null}],['missing chat',{chat:null}],
 ['short message id',{message_id:'x'}],['incorrect challenge',{text:challenge+'-extra'}]
])test(name+' denied',async()=>{
 const b=JSON.stringify({...realish,message:{...realish.message,...patch}});
 assert.equal((await call({body:b})).status,422);
});
test('first actual-format synthetic fixture recorded once with no PII',async()=>{
 const db=fixtureDb(),r=await handleDedicatedQaWebhook(req(),env(db),now);
 assert.equal(r.status,200);assert.equal(db.rows.size,1);assert.equal(db.writes,1);
 assert.deepEqual([...db.rows.keys()],['ONE']);
 const stored=[...db.rows.values()][0];assert.match(stored.mac,/^[a-f0-9]{64}$/);
 assert.equal(JSON.stringify(stored).includes(challenge),false);
 assert.equal(JSON.stringify(stored).includes('FAKE_SENDER'),false);
 assert.equal(r.headers.get('cache-control'),'no-store');
 assert.equal(await r.text(),'');
});
test('second delivery ACK 200 but one durable record',async()=>{
 const db=fixtureDb(),v=env(db);
 const a=await handleDedicatedQaWebhook(req(),v,now);
 const b=await handleDedicatedQaWebhook(req(),v,now);
 assert.equal(a.status,200);assert.equal(b.status,200);assert.equal(db.rows.size,1);
 assert.equal(db.writes,2);
});
test('concurrent valid requests cannot create two accepted records',async()=>{
 const db=fixtureDb(),v=env(db);
 const results=await Promise.all(Array.from({length:25},()=>handleDedicatedQaWebhook(req(),v,now)));
 assert.equal(results.filter(x=>x.status===200).length,25);
 assert.equal(db.rows.size,1);
});
test('DB error denies ACK before durable commit',async()=>{
 const db={prepare(){return {bind(){return {async run(){throw Error('STORAGE_UNAVAILABLE')}}}}}};
 const r=await handleDedicatedQaWebhook(req(),env(db),now);assert.equal(r.status,503);
});
test('DB success=false fails closed',async()=>{
 const db={prepare(){return {bind(){return {async run(){return{success:false,meta:{changes:0}}}}}}}};
 assert.equal((await handleDedicatedQaWebhook(req(),env(db),now)).status,503);
});
test('D1 missing changes fails closed',async()=>{
 const db={prepare(){return {bind(){return {async run(){return{success:true,meta:{}}}}}}}};
 assert.equal((await handleDedicatedQaWebhook(req(),env(db),now)).status,503);
});
test('inactive after first event remains inaccessible',async()=>{
 const db=fixtureDb(),v=env(db);
 assert.equal((await handleDedicatedQaWebhook(req(),v,now)).status,200);
 assert.equal((await handleDedicatedQaWebhook(req(),{...v,QA_CANARY_MODE:'DISABLED'},now)).status,404);
});
test('no network, no provider send, no Commerce DB bindings in candidate',async()=>{
 const db=fixtureDb(),r=await handleDedicatedQaWebhook(req(),env(db),now);
 assert.equal(r.status,200);
 assert.deepEqual(Object.keys(env(db)).filter(x=>/SUPABASE|ORDER|META|PRODUCTION|SEND/i.test(x)),[]);
});
