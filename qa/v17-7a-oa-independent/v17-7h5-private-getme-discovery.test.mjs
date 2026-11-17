import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {discoverBotIdWithGetMeOnly} from './v17-7h5-private-getme-discovery.mjs';

const TOKEN='QA_ONLY_FAKE_PRIVATE_ZALO_BOT_TOKEN_1234567';
const ID='1459232241454765289';
const make=(change={})=>{
 const calls=[];
 const args={
  consent:'OWNER_CONSENT_GETME_DISCOVERY_ONLY',
  secretBroker:{kind:'LOCAL_EPHEMERAL_OPERATOR_SECRET',
   withSecret:async fn=>fn(TOKEN)},
  transport:{kind:'PINNED_ZALO_HTTPS_POST_READONLY',
   postReadOnly:async(m,t)=>{
    calls.push(m);assert.equal(t,TOKEN);
    return {ok:true,result:{id:ID,account_name:'bot.FakeQAUser1',account_type:'BASIC'}};
   }},
  ...change
 };
 return {calls,args};
};
const noRealAuth=r=>{
 assert.equal(r.independentHumanOwnerVerified,false);
 assert.equal(r.merchantStoreVerified,false);
 assert.equal(r.hostedCanaryApproved,false);
 assert.equal(r.canSend,false);
 assert.equal(r.canChangeWebhook,false);
 assert.equal(r.canReadOrders,false);
 assert.equal(r.canWriteOrders,false);
};
test('D01 no known Bot ID required, getMe-only returns local numeric ID',async()=>{
 const f=make(),r=await discoverBotIdWithGetMeOnly(f.args);
 assert.equal(r.status,'UNPINNED_BOT_ID_DISCOVERED_LOCAL_ONLY');
 assert.equal(r.discoveredBotId,ID);
 assert.equal(r.readMethodsAttempted,1);
 assert.deepEqual(f.calls,['getMe']);
 assert.equal(r.noWebhookInfoQueried,true);
 assert.match(r.botIdSha256,/^[a-f0-9]{64}$/);
 noRealAuth(r);
});
test('D02 no owner consent blocks before transport',async()=>{
 const f=make({consent:'YES'});
 const r=await discoverBotIdWithGetMeOnly(f.args);
 assert.equal(r.status,'BOT_ID_DISCOVERY_NO_GO');
 assert.equal(f.calls.length,0);noRealAuth(r);
});
test('D03 no local ephemeral secret blocks',async()=>{
 const f=make({secretBroker:{kind:'PROVIDER_EVENT_JSON',
  withSecret:async fn=>fn(TOKEN)}});
 assert.equal((await discoverBotIdWithGetMeOnly(f.args)).status,'BOT_ID_DISCOVERY_NO_GO');
 assert.equal(f.calls.length,0);
});
test('D04 bad Bot API shape never claims identity',async()=>{
 const f=make({transport:{kind:'PINNED_ZALO_HTTPS_POST_READONLY',
  postReadOnly:async()=>({ok:false,result:{id:ID,account_name:'bot.FakeQAUser1'}})}});
 const r=await discoverBotIdWithGetMeOnly(f.args);
 assert.equal(r.status,'BOT_ID_DISCOVERY_NO_GO');noRealAuth(r);
});
test('D05 malformed Bot ID is rejected even with ok true',async()=>{
 const f=make({transport:{kind:'PINNED_ZALO_HTTPS_POST_READONLY',
  postReadOnly:async()=>({ok:true,result:{id:'no-ID',account_name:'bot.FakeQAUser1'}})}});
 assert.equal((await discoverBotIdWithGetMeOnly(f.args)).status,'BOT_ID_DISCOVERY_NO_GO');
});
test('D06 suspicious account name cannot be accepted',async()=>{
 const f=make({transport:{kind:'PINNED_ZALO_HTTPS_POST_READONLY',
  postReadOnly:async()=>({ok:true,result:{id:ID,account_name:'evil.exe'}})}});
 assert.equal((await discoverBotIdWithGetMeOnly(f.args)).status,'BOT_ID_DISCOVERY_NO_GO');
});
test('D07 real-transport errors containing token are redacted',async()=>{
 const f=make({transport:{kind:'PINNED_ZALO_HTTPS_POST_READONLY',
  postReadOnly:async()=>{throw Error('https://bot-api.zaloplatforms.com/bot'+TOKEN+'/getMe');}}});
 const r=await discoverBotIdWithGetMeOnly(f.args);
 assert.equal(r.status,'BOT_ID_DISCOVERY_NO_GO');
 assert.equal(r.readMethodsAttempted,1);
 assert.ok(!JSON.stringify(r).includes(TOKEN));
 noRealAuth(r);
});
test('D08 invalid local token does not call provider',async()=>{
 const f=make({secretBroker:{kind:'LOCAL_EPHEMERAL_OPERATOR_SECRET',
  withSecret:async fn=>fn('bad / token')}});
 const r=await discoverBotIdWithGetMeOnly(f.args);
 assert.equal(r.status,'BOT_ID_DISCOVERY_NO_GO');
 assert.equal(f.calls.length,0);
});
test('D09 CI and non-interactive cannot invoke local operator script',()=>{
 const entry=fileURLToPath(new URL('../../scripts/v177h5-discover-bot-id.mjs',import.meta.url));
 const p=spawnSync(process.execPath,[entry],{encoding:'utf8',
  env:{...process.env,CI:'true',GITHUB_ACTIONS:'true',
   T404_H5_CONSENT:'OWNER_CONSENT_GETME_DISCOVERY_ONLY',
   T404_H5_BOT_TOKEN:TOKEN}});
 assert.notEqual(p.status,0);
 assert.match(p.stdout,/LOCAL_INTERACTIVE_READONLY_APPROVAL_REQUIRED/);
 assert.ok(!p.stdout.includes(TOKEN)&&!p.stderr.includes(TOKEN));
});
test('D10 provider only invoked once, no webhook access',async()=>{
 let n=0;
 const f=make({transport:{kind:'PINNED_ZALO_HTTPS_POST_READONLY',
  postReadOnly:async method=>{
   n++;assert.equal(method,'getMe');
   return {ok:true,result:{id:ID,account_name:'bot.FakeQAUser1'}};
  }}});
 await discoverBotIdWithGetMeOnly(f.args);
 assert.equal(n,1);
});
