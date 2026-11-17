import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {inspectPrivateTwoMethodBotReadback} from './v17-7h4-private-real-readback-gate.mjs';
import {createPinnedZaloHttpsReadOnlyTransport,pinnedZaloApiHostname} from './v17-7h4-private-pinned-https-transport.mjs';

const ID='1459232241454765289';
const TOKEN='QA_ONLY_PRIVATE_FAKE_BOT_TOKEN_0123456789_ABC';
const APPROVAL='OWNER_CONSENT_TWO_READONLY_METHODS_ONLY';
const status=(x,s)=>{assert.equal(x.status,s);assert.equal(x.storeOwnerVerified,false);
 assert.equal(x.botCreatorOwnerIndependentlyVerified,false);
 assert.equal(x.hostedNoSendCanaryAuthorized,false);
 assert.equal(x.canSend,false);
 assert.equal(x.canSetWebhook,false);
 assert.equal(x.canDeploy,false);
};
function setup(opts={}){
 const methods=[];
 const base={
  expectedBotId:ID,approval:APPROVAL,
  secretBroker:{kind:'LOCAL_EPHEMERAL_OPERATOR_SECRET',withSecret:fn=>fn(TOKEN)},
  transport:{kind:'PINNED_ZALO_HTTPS_POST_READONLY',
   postReadOnly:async(method,token)=>{
    assert.equal(token,TOKEN);methods.push(method);
    if(method==='getMe')return {ok:true,result:{id:ID,account_name:'bot.QA123456',account_type:'BASIC'}};
    if(method==='getWebhookInfo')return {ok:true,result:{url:'',updated_at:0}};
    throw Error('FORBIDDEN_MUTATION');
   }},
  now:()=>Date.parse('2026-11-17T15:05:00Z')
 };
 return {config:{...base,...opts},methods};
}
test('H4-01 two-method approved local readback gives digest only, NOT owner admission',async()=>{
 const f=setup(),x=await inspectPrivateTwoMethodBotReadback(f.config);
 status(x,'PRIVATE_TWO_READONLY_RESPONSES_MATCH_BOT_OWNER_UNVERIFIED');
 assert.deepEqual(f.methods,['getMe','getWebhookInfo']);
 assert.equal(x.methodCallsAttempted,2);
 assert.match(x.botIdSha256,/^[a-f0-9]{64}$/);
 assert.equal(x.webhookConfigured,false);
 assert.equal(x.webhookUrlSha256,null);
 assert.equal('url' in x,false);assert.equal('botToken' in x,false);
 assert.equal(JSON.stringify(x).includes(TOKEN),false);
 assert.equal(JSON.stringify(x).includes(ID),false);
});
test('H4-02 existing webhook gets digest-only HARD STOP, never repoint',async()=>{
 const f=setup(),u='https://existing.example.test/qa-hook?test=123';
 f.config.transport.postReadOnly=async(method)=>{
  f.methods.push(method);
  return method==='getMe'?{ok:true,result:{id:ID,account_name:'bot.QA12345'}}:
   {ok:true,result:{url:u,updated_at:1749633372026}};
 };
 const x=await inspectPrivateTwoMethodBotReadback(f.config);
 status(x,'EXISTING_WEBHOOK_HARD_STOP_OWNER_UNVERIFIED');
 assert.equal(x.webhookConfigured,true);
 assert.match(x.webhookUrlSha256,/^[a-f0-9]{64}$/);
 assert.equal(JSON.stringify(x).includes(u),false);
 assert.deepEqual(f.methods,['getMe','getWebhookInfo']);
});
test('H4-03 token in exception is always redacted',async()=>{
 const f=setup();
 f.config.transport.postReadOnly=async()=>{throw Error('Request failed https://bot-api.zaloplatforms.com/bot'+TOKEN+'/getMe');};
 const x=await inspectPrivateTwoMethodBotReadback(f.config);
 status(x,'PRIVATE_READBACK_NO_GO');
 assert.doesNotMatch(JSON.stringify(x),new RegExp(TOKEN));
 assert.equal(x.methodCallsAttempted,1);
});
test('H4-04 no approval no network',async()=>{
 const f=setup({approval:'MAYBE'});
 const x=await inspectPrivateTwoMethodBotReadback(f.config);
 status(x,'PRIVATE_READBACK_NO_GO');assert.equal(f.methods.length,0);
});
test('H4-05 incorrect pinned Bot ID prevents HTTP',async()=>{
 const f=setup({expectedBotId:'INVALID_USER_BOT'});
 const x=await inspectPrivateTwoMethodBotReadback(f.config);
 status(x,'PRIVATE_READBACK_NO_GO');assert.equal(f.methods.length,0);
});
test('H4-06 mismatched getMe Bot ID does not call getWebhookInfo',async()=>{
 const f=setup();
 f.config.transport.postReadOnly=async(method)=>{
  f.methods.push(method);
  return {ok:true,result:{id:'1459232241454765299',account_name:'bot.QA12345'}};
 };
 const x=await inspectPrivateTwoMethodBotReadback(f.config);
 status(x,'PRIVATE_READBACK_NO_GO');
 assert.deepEqual(f.methods,['getMe']);
});
test('H4-07 no trusted private secret broker means no calls',async()=>{
 const f=setup({secretBroker:{kind:'PUBLIC_PASTED_TOKEN',withSecret:fn=>fn(TOKEN)}});
 const x=await inspectPrivateTwoMethodBotReadback(f.config);
 status(x,'PRIVATE_READBACK_NO_GO');assert.equal(f.methods.length,0);
});
test('H4-08 invalid tokens denied without HTTP requests',async()=>{
 const f=setup({secretBroker:{kind:'LOCAL_EPHEMERAL_OPERATOR_SECRET',withSecret:fn=>fn('bad/../token')}});
 const x=await inspectPrivateTwoMethodBotReadback(f.config);
 status(x,'PRIVATE_READBACK_NO_GO');assert.equal(f.methods.length,0);
});
test('H4-09 malformed or forged getWebhookInfo result rejected',async()=>{
 const f=setup();
 f.config.transport.postReadOnly=async(method)=>{
  f.methods.push(method);
  return method==='getMe'?{ok:true,result:{id:ID,account_name:'bot.QA12345'}}:
    {ok:true,result:{url:'http://insecure.example.test',updated_at:1749633372026}};
 };
 const x=await inspectPrivateTwoMethodBotReadback(f.config);
 status(x,'PRIVATE_READBACK_NO_GO');
});
test('H4-10 provider error ok=false is a NO-GO not proof',async()=>{
 const f=setup();
 f.config.transport.postReadOnly=async()=>({ok:false,error_code:404,result:{}});
 status(await inspectPrivateTwoMethodBotReadback(f.config),'PRIVATE_READBACK_NO_GO');
});
test('H4-11 missing webhook timestamp never silently becomes success',async()=>{
 const f=setup();
 f.config.transport.postReadOnly=async(method)=>method==='getMe'?
  {ok:true,result:{id:ID,account_name:'bot.QA12345'}}:
  {ok:true,result:{url:'https://existing.example.test'}};
 status(await inspectPrivateTwoMethodBotReadback(f.config),'PRIVATE_READBACK_NO_GO');
});
test('H4-12 run exactly TWO methods, never setWebhook or getUpdates',async()=>{
 const f=setup(),x=await inspectPrivateTwoMethodBotReadback(f.config);
 assert.equal(x.methodCallsAttempted,2);
 assert.deepEqual(f.methods,['getMe','getWebhookInfo']);
 assert.ok(!f.methods.includes('setWebhook')&&!f.methods.includes('getUpdates'));
});
function fakeRequester({statusCode=200,contentType='application/json',body={ok:true,result:{id:ID}}}={}){
 const recorded=[];
 const requestFn=(url,opts,onResponse)=>{
  recorded.push({host:url.hostname,pathname:url.pathname,opts});
  const req=new EventEmitter();
  req.setTimeout=(ms,cb)=>{recorded.at(-1).timeout=ms;req.timeoutHandler=cb;};
  req.destroy=()=>req.emit('error',Error('unsafe url bot'+TOKEN));
  req.end=()=>{
   queueMicrotask(()=>{
    const res=new EventEmitter();
    res.statusCode=statusCode;res.headers={'content-type':contentType};
    res.resume=()=>{};
    onResponse(res);
    res.emit('data',Buffer.from(JSON.stringify(body)));
    res.emit('end');
   });
  };
  return req;
 };
 return {requestFn,recorded};
}
test('H4-13 HTTPS transport only pinned Zalo host, POST, TLS and no redirect',async()=>{
 const f=fakeRequester();
 const q=createPinnedZaloHttpsReadOnlyTransport({requestFn:f.requestFn});
 const r=await q.postReadOnly('getMe',TOKEN);
 assert.equal(r.ok,true);
 assert.equal(pinnedZaloApiHostname,'bot-api.zaloplatforms.com');
 assert.equal(f.recorded.length,1);
 assert.equal(f.recorded[0].host,'bot-api.zaloplatforms.com');
 assert.equal(f.recorded[0].opts.method,'POST');
 assert.equal(f.recorded[0].opts.rejectUnauthorized,true);
 assert.equal(f.recorded[0].opts.minVersion,'TLSv1.2');
 assert.equal(f.recorded[0].timeout,7000);
});
test('H4-14 actual transport rejects all mutating Bot API methods BEFORE network',async()=>{
 const f=fakeRequester(),q=createPinnedZaloHttpsReadOnlyTransport({requestFn:f.requestFn});
 for(const method of ['sendMessage','setWebhook','deleteWebhook','getUpdates','getMe/../sendMessage']){
  await assert.rejects(q.postReadOnly(method,TOKEN));
 }
 assert.equal(f.recorded.length,0);
});
test('H4-15 token containing URL control characters denied BEFORE network',async()=>{
 const f=fakeRequester(),q=createPinnedZaloHttpsReadOnlyTransport({requestFn:f.requestFn});
 await assert.rejects(q.postReadOnly('getMe','TOKEN_1234567890123456?bad=1'));
 assert.equal(f.recorded.length,0);
});
test('H4-16 Zalo Bot API redirect is denied, not followed',async()=>{
 const f=fakeRequester({statusCode:302}),q=createPinnedZaloHttpsReadOnlyTransport({requestFn:f.requestFn});
 await assert.rejects(q.postReadOnly('getMe',TOKEN),/REDACTED/);
 assert.equal(f.recorded.length,1);
});
test('H4-17 private HTTPS transport scrubs thrown error containing token',async()=>{
 const q=createPinnedZaloHttpsReadOnlyTransport({
  requestFn:()=>{throw Error('https://bot-api.zaloplatforms.com/bot'+TOKEN+'/getMe');}
 });
 let msg='';
 try{await q.postReadOnly('getMe',TOKEN);}catch(e){msg=e.message;}
 assert.match(msg,/REDACTED/);assert.equal(msg.includes(TOKEN),false);
});
test('H4-18 CI cannot invoke the private real provider CLI',()=>{
 const entry=fileURLToPath(new URL('../../scripts/v177h4-private-bot-readback.mjs',import.meta.url));
 const p=spawnSync(process.execPath,[entry],{encoding:'utf8',env:{
  ...process.env,CI:'true',GITHUB_ACTIONS:'true',T404_H4_OPERATOR_CONSENT:APPROVAL,
  T404_H4_EXPECTED_BOT_ID:ID,T404_H4_BOT_TOKEN:TOKEN
 }});
 assert.notEqual(p.status,0);
 assert.match(p.stdout,/LOCAL_INTERACTIVE_EXPLICIT_CONSENT_REQUIRED/);
 assert.ok(!p.stdout.includes(TOKEN));
 assert.ok(!p.stderr.includes(TOKEN));
});
