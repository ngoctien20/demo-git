import assert from 'node:assert/strict';
import test from 'node:test';
import {handleDedicatedQaWebhook} from '../v1723s/isolated-qa-webhook.mjs';
const now=1794958500000;
const path='/qa/zalo-bot/ISOLATED_BOT_QA_ONLY_1234567890';
const secret='DUMMY_NEW_QA_BOT_HEADER_SECRET_AAAAA';
const challenge='TIEN404-QA-UNIQUE-PRIVATE-NONCE-AAAAAAA';
const pepper='DUMMY_EVENT_PEPPER_NOT_A_REAL_SECRET_12345';
const message={from:{id:'FAKE_PRIVATE_FROM_DO_NOT_STORE',is_bot:false},
 chat:{chat_type:'PRIVATE',id:'FAKE_PRIVATE_CHAT_DO_NOT_STORE'},
 text:challenge,message_id:'FAKE_MESSAGE_ID_12345',date:now};
const flat={event_name:'message.text.received',message};
const wrapped={ok:true,result:{event_name:'message.text.received',message}};
function fakeD1(){
 const rows=new Map();
 let invocations=0;
 return {rows,get invocations(){return invocations},
  prepare(sql){
   if(sql!=="INSERT OR IGNORE INTO qa_canary_once(slot,event_hmac,accepted_at_ms) VALUES('ONE',?,?)")
    throw Error('UNEXPECTED_MUTATION');
   return {bind(hash,ts){return {async run(){
    invocations++;
    const changes=rows.has('ONE')?0:1;
    if(changes)rows.set('ONE',{hash,ts});
    return {success:true,meta:{changes}}
   }}}}
  }
 };
}
function settings(db=fakeD1()){
 return {QA_CANARY_MODE:'OWNER_SCOPED_PRIVATE_NO_SEND_ONCE',
  QA_CALLBACK_PATH:path,QA_START_MS:String(now-30000),QA_END_MS:String(now+30000),
  QA_HEADER_SECRET:secret,QA_EVENT_PEPPER:pepper,QA_CHALLENGE:challenge,QA_EVENT_DB:db};
}
function request(obj=flat,override={}){
 return new Request('https://inactive.invalid'+path,{method:'POST',
  headers:{'x-bot-api-secret-token':secret,'content-type':'application/json',...(override.headers||{})},
  body:JSON.stringify(obj)});
}
test('Worker is inert without full owner-scoped environment',async()=>{
 const r=await handleDedicatedQaWebhook(request(),{},now);
 assert.equal(r.status,404);
});
for(const [shape,payload] of [['flat',flat],['official_wrapped',wrapped]]){
 test(shape+' Zalo event fixture accepted only with all QA gates',async()=>{
  const db=fakeD1();
  const r=await handleDedicatedQaWebhook(request(payload),settings(db),now);
  assert.equal(r.status,200);
  assert.equal(db.rows.size,1);
  assert.equal(db.invocations,1);
  assert.equal(await r.text(),'');
  assert.ok(!JSON.stringify([...db.rows.values()]).includes(message.from.id));
  assert.ok(!JSON.stringify([...db.rows.values()]).includes(challenge));
 });
 test(shape+' wrong shared-header rejected before any D1 write',async()=>{
  const db=fakeD1();
  const r=await handleDedicatedQaWebhook(request(payload,{headers:{'x-bot-api-secret-token':'WRONG_HEADER'}}),settings(db),now);
  assert.equal(r.status,403);
  assert.equal(db.invocations,0);
 });
 test(shape+' exactly one atomic receipt after 10 concurrent requests',async()=>{
  const db=fakeD1(),env=settings(db);
  const rs=await Promise.all(Array.from({length:10},()=>handleDedicatedQaWebhook(request(payload),env,now)));
  assert.equal(rs.filter(x=>x.status===200).length,10);
  assert.equal(db.rows.size,1);
 });
}
for(const [name,payload] of [
 ['api_ok_false',{ok:false,result:flat}],
 ['wrapper_missing_result',{ok:true}],
 ['wrapper_null_result',{ok:true,result:null}],
 ['wrapper_nonobject_result',{ok:true,result:'bad'}],
 ['wrapper_array_result',{ok:true,result:[flat]}],
 ['wrapper_flat_mix',{...flat,ok:true,result:flat}],
 ['flat_with_result_only',{...flat,result:flat}],
 ['no_result_wrapped',{ok:true,event_name:'message.text.received',message}],
 ['unsupported_channel_event',{ok:true,result:{...flat,event_name:'message.image.received'}}],
 ['unknown_nested_result',{ok:true,result:{data:flat}}],
 ['array_top_level',[flat]],
 ['null_top_level',null],
]){
 test('reject ambiguous/unverified provider envelope '+name,async()=>{
  const db=fakeD1();
  const r=await handleDedicatedQaWebhook(request(payload),settings(db),now);
  assert.equal(r.status,422);
  assert.equal(db.invocations,0);
 });
}
test('official wrapper cannot use forged or wrong QA challenge',async()=>{
 const db=fakeD1();
 const v={ok:true,result:{...flat,message:{...message,text:'SOME_OTHER_MESSAGE'}}};
 assert.equal((await handleDedicatedQaWebhook(request(v),settings(db),now)).status,422);
 assert.equal(db.invocations,0);
});
test('neither wrapper permits group events',async()=>{
 const db=fakeD1();
 const v={ok:true,result:{...flat,message:{...message,chat:{chat_type:'GROUP'}}}};
 assert.equal((await handleDedicatedQaWebhook(request(v),settings(db),now)).status,422);
 assert.equal(db.invocations,0);
});
test('an earlier flat event consumes the single slot before official wrapper',async()=>{
 const db=fakeD1(),env=settings(db);
 assert.equal((await handleDedicatedQaWebhook(request(flat),env,now)).status,200);
 assert.equal((await handleDedicatedQaWebhook(request(wrapped),env,now)).status,200);
 assert.equal(db.rows.size,1);
});
test('no real JWT/Commerce/bot calls in receiver candidate',async()=>{
 const db=fakeD1(),r=await handleDedicatedQaWebhook(request(flat),settings(db),now);
 assert.equal(r.status,200);
 assert.deepEqual([...db.rows.keys()],['ONE']);
});
