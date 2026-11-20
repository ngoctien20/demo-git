import assert from 'node:assert/strict';
import {acceptSyntheticReceipt} from './local-no-send-canary.mjs';
const now=1795188000000;
const secret='a'.repeat(64);
const body=()=>({ok:true,result:{event_name:'message.text.received',
 message:{from:{id:'fake-user',is_bot:false},
  chat:{id:'fake-chat',chat_type:'PRIVATE'},
  text:'SENSITIVE_TEXT_MUST_NOT_LEAK',message_id:'QA_EVENT_0001',date:now}}});
function run(mutate,header=secret,seen=new Set(),install='QA_INSTALL_A'){
 const x=body();mutate(x);
 return acceptSyntheticReceipt({header,body:Buffer.from(JSON.stringify(x)),
  secret,nowMs:now,seen,installationRef:install});
}
const cases=[
 ['correct shared secret + private event',x=>{},200],
 ['missing header',x=>{},403,null],
 ['wrong header',x=>{},403,'bad'],
 ['duplicate header array',x=>{},403,[secret,secret]],
 ['empty header',x=>{},403,''],
 ['wrong provider envelope ok',x=>{x.ok=false},202],
 ['non text event',x=>{x.result.event_name='message.photo.received'},202],
 ['group chat',x=>{x.result.message.chat.chat_type='GROUP'},202],
 ['Bot echo',x=>{x.result.message.from.is_bot=true},202],
 ['wrong field typed chat',x=>{x.result.message.chat=null},202],
 ['missing sender',x=>{delete x.result.message.from},202],
 ['message-id invalid',x=>{x.result.message.message_id='!'},202],
 ['message timestamp stale',x=>{x.result.message.date=now-400000},202],
 ['message timestamp future',x=>{x.result.message.date=now+400000},202],
 ['message timestamp malformed',x=>{x.result.message.date='now'},202],
 ['missing message',x=>{delete x.result.message},202],
 ['untrusted Store claim ignored and no authority',x=>{x.result.storeId='STORE_B'},200],
 ['untrusted owner claim ignored and no authority',x=>{x.result.ownerRole='superadmin'},200]
];
let count=0;
for(const [name,mutate,status,header] of cases){
 const r=run(mutate,header===undefined?secret:header);
 assert.equal(r.httpStatus,status,name);
 assert.equal(r.receipt.canSend,false,name);
 assert.equal(r.receipt.canReadHosted,false,name);
 assert.equal(r.receipt.canWrite,false,name);
 assert.equal(r.receipt.providerSends,0,name);
 assert.equal(r.receipt.commerceWrites,0,name);
 assert.equal(r.receipt.hostedReads,0,name);
 assert.equal(r.receipt.storeAuthorized,false,name);
 assert.equal(r.receipt.botIdentityBound,false,name);
 assert.equal(r.receipt.ownerRoleGranted,false,name);
 assert.equal(r.receipt.customerReply,null,name);
 assert.equal(JSON.stringify(r.receipt).includes('SENSITIVE_TEXT'),false,name);
 count++;
}
const seen=new Set();
assert.equal(run(()=>{},secret,seen).httpStatus,200);count++;
assert.equal(run(()=>{},secret,seen).httpStatus,202);count++;
assert.equal(run(()=>{},secret,new Set(),'QA_INSTALL_B').httpStatus,403);count++;
const malformed=acceptSyntheticReceipt({header:secret,body:Buffer.from('{'),
 secret,nowMs:now,seen:new Set(),installationRef:'QA_INSTALL_A'});
assert.equal(malformed.httpStatus,413===malformed.httpStatus?413:400);count++;
const oversized=acceptSyntheticReceipt({header:secret,body:Buffer.alloc(4097),
 secret,nowMs:now,seen:new Set(),installationRef:'QA_INSTALL_A'});
assert.equal(oversized.httpStatus,413);count++;
console.log('TIEN404_V19812_NO_SEND_CANARY_UNIT_PASS='+count);
console.log('REAL_PROVIDER_REQUESTS=0');
