import test from 'node:test';
import assert from 'node:assert/strict';
import {handleDedicatedQaWebhook} from '../v1723s/isolated-qa-webhook.mjs';

// All fixtures are synthetic; never provide real Bot credentials, sender IDs or chat data.
const now=1794958500000;
const route='/qa/zalo-bot/DIAGNOSTIC-FAKE-PATH-1234567890';
const secret='FAKE_ONLY_WEBHOOK_SHARED_HEADER_SECRET_123456';
const pepper='FAKE_ONLY_DIAGNOSTIC_PEPPER_1234567890';
const challenge='TIEN404-QA-FAKE-CHALLENGE-1234567890';
const SQL="INSERT OR IGNORE INTO qa_auth_rejection_once(reason) VALUES (?)";
function fakeRateLimiter({allowed=true,throwError=false}={}){
 const keys=[];
 return {keys, async limit({key}){keys.push(key);if(throwError)throw Error('LIMITER_UNAVAILABLE');return {success:allowed};}};
}
const REASONS=new Set(['CONTENT_TYPE','BODY_SIZE','BODY_PARSE','ENVELOPE',
 'EVENT_KIND','MESSAGE_SHAPE','CHALLENGE','EVENT_TIME']);
const valid={event_name:'message.text.received',message:{
 message_id:'FAKE_EVENT_ID_123456',date:now,text:challenge,
 chat:{chat_type:'PRIVATE',id:'FAKE_CHAT_ID_DO_NOT_STORE'},
 from:{is_bot:false,id:'FAKE_USER_ID_DO_NOT_STORE'}}};
function fakeDb({diagnosticsError=false}={}){
 const diagnoses=new Set(), accepted=new Set(), attempts=[], allBinds=[];
 return {diagnoses,accepted,attempts,allBinds,prepare(sql){
  if(sql===SQL)return {bind(category){
   allBinds.push(category);
   return {async run(){
    attempts.push(category);
    if(diagnosticsError)throw Error('DIAG_TABLE_UNAVAILABLE');
    assert.ok(REASONS.has(category),'only bounded diagnostic category is allowed');
    const changes=diagnoses.has(category)?0:1;
    diagnoses.add(category);
    return {success:true,meta:{changes}};
   }};
  }};
  if(sql==="INSERT OR IGNORE INTO qa_canary_once(slot,event_hmac,accepted_at_ms) VALUES('ONE',?,?)")
   return {bind(mac,ts){return {async run(){
    assert.match(mac,/^[a-f0-9]{64}$/);
    assert.equal(typeof ts,'number');
    accepted.add('ONE');
    return {success:true,meta:{changes:1}};
   }}}};
  throw Error('UNEXPECTED_QUERY');
 }};
}
function env(db,diagMode='OWNER_SCOPED_AUTH_REJECTION_ONCE'){
 return {QA_CANARY_MODE:'OWNER_SCOPED_PRIVATE_NO_SEND_ONCE',QA_CALLBACK_PATH:route,
  QA_DIAG_RATE_LIMITER:fakeRateLimiter(),
  QA_START_MS:String(now-30000),QA_END_MS:String(now+30000),
  QA_HEADER_SECRET:secret,QA_EVENT_PEPPER:pepper,QA_CHALLENGE:challenge,
  QA_EVENT_DB:db,...(diagMode===null?{}:{QA_DIAG_MODE:diagMode})};
}
function request({payload=valid,contentType='application/json',header=secret,body,
 url='https://test.invalid'+route,method='POST'}={}){
 const headers={'content-type':contentType};
 if(header!==null)headers['x-bot-api-secret-token']=header;
 return new Request(url,{method,headers,
  body:method==='POST'?(body===undefined?JSON.stringify(payload):body):undefined});
}
const cases=[
 {reason:'CONTENT_TYPE',status:415,input:{contentType:'text/plain'}},
 {reason:'BODY_SIZE',status:413,input:{body:'x'.repeat(9000)}},
 {reason:'BODY_PARSE',status:400,input:{body:'{not valid json'}},
 {reason:'ENVELOPE',status:422,input:{payload:{ok:false,result:valid}}},
 {reason:'EVENT_KIND',status:422,input:{payload:{...valid,event_name:'message.image.received'}}},
 {reason:'MESSAGE_SHAPE',status:422,input:{payload:{...valid,message:{...valid.message,chat:{chat_type:'GROUP'}}}}},
 {reason:'CHALLENGE',status:422,input:{payload:{...valid,message:{...valid.message,text:'NOT_THE_TEST_CHALLENGE'}}}},
 {reason:'EVENT_TIME',status:422,input:{payload:{...valid,message:{...valid.message,date:now-999999}}}}
];
for(const item of cases)test('authenticated, fixed-category diagnostic '+item.reason,async()=>{
 const db=fakeDb();
 const response=await handleDedicatedQaWebhook(request(item.input),env(db),now);
 assert.equal(response.status,item.status);
 assert.deepEqual([...db.diagnoses],[item.reason]);
 assert.deepEqual(db.allBinds,[item.reason]);
 assert.equal(db.accepted.size,0,'invalid request must never consume one-time event slot');
 assert.equal(await response.text(),'','no diagnostics in HTTP response body');
 assert.equal(JSON.stringify([...db.diagnoses]).includes(secret),false);
 assert.equal(JSON.stringify([...db.diagnoses]).includes(challenge),false);
});
test('no diagnostic writes for missing/wrong header, incorrect path, inactive mode, expired window',async()=>{
 const db=fakeDb(),e=env(db);
 const tests=[
  [request({header:null}),e,now,403],
  [request({header:'BAD_SHARED_HEADER'}),e,now,403],
  [request({url:'https://test.invalid/wrong'}),e,now,404],
  [request({method:'GET'}),e,now,405],
  [request(),e,now+600000,410],
  [request(),{...e,QA_CANARY_MODE:'DISABLED'},now,404]
 ];
 for(const [req,config,clock,expected] of tests)
  assert.equal((await handleDedicatedQaWebhook(req,config,clock)).status,expected);
 assert.equal(db.diagnoses.size,0);
 assert.equal(db.attempts.length,0);
 assert.equal(db.accepted.size,0);
});
test('diagnostics absent/disabled cannot change original fail-closed response or write D1',async()=>{
 const db=fakeDb();
 for(const diag of [null,'DISABLED','OWNER_SCOPE_WRONG']){
  const r=await handleDedicatedQaWebhook(request({payload:{...valid,event_name:'unknown'}}),env(db,diag),now);
  assert.equal(r.status,422);
 }
 assert.equal(db.attempts.length,0);
 assert.equal(db.diagnoses.size,0);
});
test('missing disposable diagnostic table does not turn denial into success or expose details',async()=>{
 const db=fakeDb({diagnosticsError:true});
 const r=await handleDedicatedQaWebhook(request({payload:{...valid,message:{...valid.message,text:'BAD'}}}),env(db),now);
 assert.equal(r.status,422);
 assert.equal(await r.text(),'');
 assert.deepEqual(db.attempts,['CHALLENGE']);
 assert.equal(db.accepted.size,0);
});
test('repeated same authenticated rejection stores only one durable category',async()=>{
 const db=fakeDb(),e=env(db);
 const r=await Promise.all(Array.from({length:30},()=>handleDedicatedQaWebhook(
  request({payload:{...valid,message:{...valid.message,text:'WRONG'}}}),e,now)));
 assert.ok(r.every(x=>x.status===422));
 assert.equal(db.diagnoses.size,1);
 assert.equal(db.attempts.length,30,'D1 still receives attempts: rate limiting required before hosted admission');
});
test('all rejected categories are capped at eight distinct rows, without PII',async()=>{
 const db=fakeDb(),e=env(db);
 for(const item of [...cases,...cases]){
  const r=await handleDedicatedQaWebhook(request(item.input),e,now);
  assert.equal(r.status,item.status);
 }
 assert.equal(db.diagnoses.size,8);
 assert.equal(db.accepted.size,0);
 const stored=JSON.stringify([...db.diagnoses]);
 for(const sensitive of [secret,pepper,challenge,'FAKE_CHAT_ID','FAKE_USER_ID','NOT_THE_TEST_CHALLENGE'])
  assert.equal(stored.includes(sensitive),false);
});
test('accepted exact challenge stores one receipt and zero rejection categories',async()=>{
 const db=fakeDb();
 const r=await handleDedicatedQaWebhook(request(),env(db),now);
 assert.equal(r.status,200);
 assert.equal(db.accepted.size,1);
 assert.equal(db.diagnoses.size,0);
});
test('diagnostic not yet on hosted: no outbound messages, no Commerce access in fixture',async()=>{
 const db=fakeDb(),e=env(db);
 assert.equal(Object.keys(e).some(k=>/SEND|ORDER|CUSTOMER|SUPABASE|TOKEN_BOT/i.test(k)),false);
 const r=await handleDedicatedQaWebhook(request({contentType:'text/plain'}),e,now);
 assert.equal(r.status,415);
 assert.deepEqual([...db.diagnoses],['CONTENT_TYPE']);
});

test('no limiter binding skips diagnostic SQL while preserving 422 and no PII',async()=>{
 const db=fakeDb(),settings=env(db);
 delete settings.QA_DIAG_RATE_LIMITER;
 const r=await handleDedicatedQaWebhook(request({payload:{...valid,message:{...valid.message,text:'INVALID'}}}),settings,now);
 assert.equal(r.status,422);
 assert.equal(db.attempts.length,0);
 assert.equal(db.accepted.size,0);
});
for(const scenario of [{allowed:false},{throwError:true}]){
 test('rate limiter unavailable or exhausted skips D1, preserves denial status '+JSON.stringify(scenario),async()=>{
  const db=fakeDb(),settings=env(db);
  const gate=fakeRateLimiter(scenario);
  settings.QA_DIAG_RATE_LIMITER=gate;
  const r=await handleDedicatedQaWebhook(request({payload:{...valid,message:{...valid.message,text:'WRONG'}}}),settings,now);
  assert.equal(r.status,422);
  assert.equal(await r.text(),'');
  assert.deepEqual(gate.keys,['qa-v1723u-auth-diagnostic']);
  assert.equal(db.attempts.length,0);
 });
}
test('unauthenticated request never calls limiter or D1',async()=>{
 const db=fakeDb(),settings=env(db);
 const gate=fakeRateLimiter();
 settings.QA_DIAG_RATE_LIMITER=gate;
 const r=await handleDedicatedQaWebhook(request({header:null}),settings,now);
 assert.equal(r.status,403);
 assert.equal(gate.keys.length,0);
 assert.equal(db.attempts.length,0);
});
test('one fixed limiter bucket only after authentication, never token or PII key',async()=>{
 const db=fakeDb(),settings=env(db),gate=fakeRateLimiter();
 settings.QA_DIAG_RATE_LIMITER=gate;
 for(const wrong of ['WRONG_A','WRONG_B']){
  const r=await handleDedicatedQaWebhook(request({payload:{...valid,message:{...valid.message,text:wrong}}}),settings,now);
  assert.equal(r.status,422);
 }
 assert.deepEqual(gate.keys,['qa-v1723u-auth-diagnostic','qa-v1723u-auth-diagnostic']);
 assert.equal(db.diagnoses.size,1);
 for(const privateValue of [secret,challenge,'FAKE_USER_ID','FAKE_CHAT_ID'])
  assert.ok(!gate.keys.join('').includes(privateValue));
});
