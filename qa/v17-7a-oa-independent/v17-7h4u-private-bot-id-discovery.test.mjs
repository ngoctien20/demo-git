import test from 'node:test';
import assert from 'node:assert/strict';
import {discoverExistingBotIdReadOnly,explicitDiscoveryConsent} from './v17-7h4u-private-bot-id-discovery.mjs';

const id='1459232241454765289',token='FAKE_TOKEN_LOCAL_TEST_ONLY_123456789';
const setup=(response={ok:true,result:{id,account_name:'bot.private-qa-test'}})=>{
 const calls=[];
 const broker={kind:'LOCAL_EPHEMERAL_OPERATOR_SECRET',async withSecret(fn){return await fn(token)}};
 const transport={kind:'PINNED_ZALO_HTTPS_POST_READONLY',async postReadOnly(method,secret){
  calls.push({method,secret});return response;
 }};
 return {calls,input:{approval:explicitDiscoveryConsent,secretBroker:broker,
  transport,now:()=>1795000000000}};
};
const deny=r=>{
 for(const key of ['botCreatorOwnerVerified','realStoreBindingVerified',
 'providerSessionIndependentlyVerified','canSend','canSetWebhook',
 'canDeleteWebhook','canGetUpdates','canReadOrders','canGrantStore',
 'canPromoteCore','canDeploy'])assert.equal(r[key],false,key);
 assert.equal(JSON.stringify(r).includes(token),false);
};
test('one getMe returns Bot ID locally without pre-existing ID',async()=>{
 const q=setup(),r=await discoverExistingBotIdReadOnly(q.input);
 assert.equal(r.status,'PRIVATE_GETME_BOT_ID_DISCOVERED_NOT_OWNER_VERIFIED');
 assert.equal(r.localBotId,id);assert.equal(r.localAccountName,'bot.private-qa-test');
 assert.equal(r.methodCallsAttempted,1);assert.equal(q.calls.length,1);
 assert.deepEqual(q.calls.map(x=>x.method),['getMe']);
 assert.equal(r.originalWebhookUnchanged,true);deny(r);
});
test('without consent never requests the provider',async()=>{
 const q=setup();q.input.approval='NONE';
 const r=await discoverExistingBotIdReadOnly(q.input);
 assert.equal(q.calls.length,0);assert.equal(r.status,'PRIVATE_BOT_DISCOVERY_NO_GO');deny(r);
});
test('null preflight denied',async()=>deny(await discoverExistingBotIdReadOnly(null)));
test('no broker denied without provider call',async()=>{const q=setup();delete q.input.secretBroker;deny(await discoverExistingBotIdReadOnly(q.input));assert.equal(q.calls.length,0)});
test('fake transport kind rejected',async()=>{const q=setup();q.input.transport.kind='UNTRUSTED';deny(await discoverExistingBotIdReadOnly(q.input));assert.equal(q.calls.length,0)});
for(const [label,response]of [
 ['invalid ok',{ok:false,result:{id,account_name:'bot.private-qa-test'}}],
 ['missing id',{ok:true,result:{account_name:'bot.private-qa-test'}}],
 ['non-numeric id',{ok:true,result:{id:'QA_STORE_A',account_name:'bot.private-qa-test'}}],
 ['unsafe JSON number id',{ok:true,result:{id:1459232241454765200,account_name:'bot.private-qa-test'}}],
 ['empty account_name',{ok:true,result:{id,account_name:''}}],
 ['missing result',{ok:true}],
 ['array result',{ok:true,result:[{id,account_name:'bot.private-qa-test'}]}],
 ['null response',null]
])test('malformed '+label+' is denied',async()=>{
 const q=setup(response),r=await discoverExistingBotIdReadOnly(q.input);
 assert.equal(r.status,'PRIVATE_BOT_DISCOVERY_NO_GO');deny(r);
});
test('network throw is redacted and fails closed',async()=>{
 const q=setup();q.input.transport.postReadOnly=async()=>{throw Error('SECRET:'+token)};
 const r=await discoverExistingBotIdReadOnly(q.input);
 assert.equal(r.reason,'PRIVATE_GETME_FAILED_REDACTED');deny(r);
});
test('invalid token rejected without provider call',async()=>{
 const q=setup();q.input.secretBroker.withSecret=async(fn)=>fn('bad token');
 const r=await discoverExistingBotIdReadOnly(q.input);
 assert.equal(q.calls.length,0);deny(r);
});
test('invalid local clock denied',async()=>{
 const q=setup();q.input.now=()=>NaN;
 const r=await discoverExistingBotIdReadOnly(q.input);
 assert.equal(r.reason,'LOCAL_CLOCK_INVALID');deny(r);
});
test('never invokes second method even on valid Bot identity',async()=>{
 const q=setup();const r=await discoverExistingBotIdReadOnly(q.input);
 assert.deepEqual(q.calls.map(x=>x.method),['getMe']);deny(r);
});
