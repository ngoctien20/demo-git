import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {
 inspectSyntheticProviderReceipt,describeSourceOnlyProviderCanary
} from './v17-7f-provider-crypto-fixture-offline.mjs';

const NOW=1794912000000;
const SECRET='QA_ONLY_synthetic_crypto_key_000001';
const PAGE='meta-page-qa-0001';
const BOT='zalo-bot-qa-0001';
const MID='event-qa-0000001';
const INSTALL='installation-qa-001';
const signed=raw=>'sha256='+createHmac('sha256',SECRET).update(raw).digest('hex');
function fixture(channel='MESSENGER'){
 const body=channel==='MESSENGER'?
   {object:'page',entry:[{id:PAGE,messaging:[{
     sender:{id:'synthetic-customer-0001'},recipient:{id:PAGE},
     message:{mid:MID,text:'QA only'}}]}]}:
   {ok:true,result:{event_name:'message.text.received',message:{
     message_id:MID,from:{id:'synthetic-customer-0001'},
     chat:{id:'qa-private-chat-0001',chat_type:'PRIVATE'},
     date:NOW,text:'QA only'}}};
 const rawBody=Buffer.from(JSON.stringify(body),'utf8');
 const expected={
  mode:'OFFLINE_SYNTHETIC_CRYPTO',channel,noSend:true,
  noCommerceRead:true,noCommerceWrite:true,noDeploy:true,
  qaOnlySecret:SECRET,installationRef:INSTALL,eventRef:MID,
  expectedProviderRef:channel==='MESSENGER'?PAGE:BOT
 };
 const input={
  httpMethod:'POST',channel,contentType:'application/json',rawBody,
  installationRef:INSTALL,eventRef:MID,providerRef:expected.expectedProviderRef,
  receivedAtMs:NOW,
  headers:[[channel==='MESSENGER'?'X-Hub-Signature-256':'X-Bot-Api-Secret-Token',
    channel==='MESSENGER'?signed(rawBody):SECRET]]
 };
 const seen=new Set();
 const deps={mode:'OFFLINE_MEMORY_ONLY',nowMs:NOW,
  reserveOnce:async k=>seen.has(k)?false:(seen.add(k),true)};
 return {body,input,expected,deps};
}
function resign(f){
 f.input.rawBody=Buffer.from(JSON.stringify(f.body),'utf8');
 if(f.input.channel==='MESSENGER')
  f.input.headers=[['X-Hub-Signature-256',signed(f.input.rawBody)]];
}
function locked(r){
 for(const field of ['realProviderVerified','realProviderOwnerVerified',
  'realPageOrBotInstallationVerified','realSignedEventReceived',
  'realReplayServiceVerified','realRateLimitVerified',
  'realStoreJwtRlsVerified','allowProviderSend',
  'allowCommerceRead','allowOrderWrite','allowStockWrite',
  'canPublish','canDeploy'])assert.equal(r[field],false,field);
 assert.equal(r.actualProviderMessagesReceived,0);
 assert.equal(r.actualProviderMessagesSent,0);
 assert.equal(r.actualOrdersWritten,0);
}
async function reject(reason,mutate,channel='MESSENGER'){
 const f=fixture(channel);mutate(f);
 const result=await inspectSyntheticProviderReceipt(f.input,f.expected,f.deps);
 assert.equal(result.shapeCandidate,false,JSON.stringify(result));
 assert.equal(result.reason,reason);locked(result);
}
for(const channel of ['MESSENGER','ZALO_BOT']){
 test(channel+' fixture matches native crypto shape but cannot claim real provider',async()=>{
  const f=fixture(channel);
  const r=await inspectSyntheticProviderReceipt(f.input,f.expected,f.deps);
  assert.equal(r.shapeCandidate,true);assert.equal(r.syntheticCryptoMatched,true);
  assert.equal(r.channel,channel);locked(r);
  assert.equal(JSON.stringify(r).includes(SECRET),false);
  assert.equal(JSON.stringify(r).includes(PAGE),false);
  assert.equal(JSON.stringify(r).includes('QA only'),false);
 });
}
test('No Zalo OA native signature fallback in Bot verifier',async()=>reject(
 'NO_NATIVE_PROVIDER_CANARY_FOR_THIS_CHANNEL',f=>f.input.channel='ZALO_OA','ZALO_BOT'));
test('Zalo Bot cannot use Meta signature envelope',async()=>reject(
 'MISSING_OR_DUPLICATE_NATIVE_HEADER',f=>f.input.headers=[['X-Hub-Signature-256','sha256='+'0'.repeat(64)]],'ZALO_BOT'));
test('Meta cannot use Zalo Bot header',async()=>reject(
 'MISSING_OR_DUPLICATE_NATIVE_HEADER',f=>f.input.headers=[['X-Bot-Api-Secret-Token',SECRET]]));
test('duplicate case-insensitive Meta signatures denied',async()=>reject(
 'MISSING_OR_DUPLICATE_NATIVE_HEADER',f=>f.input.headers.push(['x-hub-signature-256',signed(f.input.rawBody)])));
test('duplicate Zalo Bot headers denied',async()=>reject(
 'MISSING_OR_DUPLICATE_NATIVE_HEADER',f=>f.input.headers.push(['x-bot-api-secret-token',SECRET]),'ZALO_BOT'));
test('missing native header denied',async()=>reject(
 'MISSING_OR_DUPLICATE_NATIVE_HEADER',f=>f.input.headers=[]));
test('Meta requires sha256=hex exact prefix',async()=>reject(
 'META_NATIVE_SIGNATURE_FORMAT_INVALID',f=>f.input.headers[0][1]=signed(f.input.rawBody).replace('sha256=','mac=')));
test('Meta HMAC tamper is rejected over raw bytes',async()=>reject(
 'PROVIDER_FIXTURE_CRYPTO_MISMATCH',f=>f.input.rawBody=Buffer.from(f.input.rawBody.toString().replace('QA only','Evil payload'))));
test('Meta body pretty printing after signed raw bytes is rejected',async()=>reject(
 'PROVIDER_FIXTURE_CRYPTO_MISMATCH',f=>f.input.rawBody=Buffer.from(JSON.stringify(f.body,null,2))));
test('Meta invalid signature different App Secret denied',async()=>reject(
 'PROVIDER_FIXTURE_CRYPTO_MISMATCH',f=>f.input.headers[0][1]='sha256='+'0'.repeat(64)));
test('Zalo Bot invalid token value denied',async()=>reject(
 'PROVIDER_FIXTURE_CRYPTO_MISMATCH',f=>f.input.headers[0][1]='QA_ONLY_wrong_token_value_9999','ZALO_BOT'));
test('Zalo Bot token is not HMAC',async()=>reject(
 'PROVIDER_FIXTURE_CRYPTO_MISMATCH',f=>f.input.headers[0][1]=signed(f.input.rawBody),'ZALO_BOT'));
test('real-like secret rejected even when native header matches',async()=>reject(
 'PRIVATE_SYNTHETIC_GATE_MISSING',f=>f.expected.qaOnlySecret='real-provider-app-secret-should-not-run'));
test('no implicit activation to hosted mode',async()=>reject(
 'PRIVATE_SYNTHETIC_GATE_MISSING',f=>f.expected.mode='HOSTED'));
test('provider canary with outbound send enabled blocked',async()=>reject(
 'PRIVATE_SYNTHETIC_GATE_MISSING',f=>f.expected.noSend=false));
test('canary with Commerce read enabled blocked',async()=>reject(
 'PRIVATE_SYNTHETIC_GATE_MISSING',f=>f.expected.noCommerceRead=false));
test('canary with order writes enabled blocked',async()=>reject(
 'PRIVATE_SYNTHETIC_GATE_MISSING',f=>f.expected.noCommerceWrite=false));
test('canary with deploy enabled blocked',async()=>reject(
 'PRIVATE_SYNTHETIC_GATE_MISSING',f=>f.expected.noDeploy=false));
test('wrong expected installation must be denied',async()=>reject(
 'PROVIDER_INSTALLATION_OR_EVENT_SCOPE_MISMATCH',f=>f.expected.installationRef='other-installation-01'));
test('wrong Meta Page must be denied',async()=>reject(
 'PROVIDER_INSTALLATION_OR_EVENT_SCOPE_MISMATCH',f=>f.input.providerRef='other-meta-page-01'));
test('wrong Zalo Bot ID must be denied',async()=>reject(
 'PROVIDER_INSTALLATION_OR_EVENT_SCOPE_MISMATCH',f=>f.input.providerRef='other-zalo-bot-01','ZALO_BOT'));
test('wrong eventRef must be denied',async()=>reject(
 'PROVIDER_INSTALLATION_OR_EVENT_SCOPE_MISMATCH',f=>f.input.eventRef='other-event-0001'));
test('non-POST request cannot match',async()=>reject(
 'HTTP_OR_RAW_BYTES_FORMAT_INVALID',f=>f.input.httpMethod='GET'));
test('unsupported media type cannot match',async()=>reject(
 'HTTP_OR_RAW_BYTES_FORMAT_INVALID',f=>f.input.contentType='text/plain'));
test('non-raw body cannot match',async()=>reject(
 'HTTP_OR_RAW_BYTES_FORMAT_INVALID',f=>f.input.rawBody=f.input.rawBody.toString()));
test('oversize body cannot match',async()=>reject(
 'HTTP_OR_RAW_BYTES_FORMAT_INVALID',f=>f.input.rawBody=Buffer.alloc(20000,65)));
test('stale receipt denied',async()=>reject(
 'EVENT_RECEIPT_TIME_WINDOW_INVALID',f=>f.input.receivedAtMs=NOW-700000));
test('future receipt denied',async()=>reject(
 'EVENT_RECEIPT_TIME_WINDOW_INVALID',f=>f.input.receivedAtMs=NOW+700000));
test('Meta authenticated invalid JSON denied',async()=>reject(
 'BODY_JSON_INVALID_AFTER_AUTH',f=>{f.input.rawBody=Buffer.from('this is not JSON');f.input.headers[0][1]=signed(f.input.rawBody)}));
test('Meta authenticated wrong Page event rejected',async()=>reject(
 'META_PAGE_AND_MESSAGE_BINDING_MISMATCH',f=>{f.body.entry[0].id='wrong-page-001';resign(f)}));
test('Meta authenticated wrong Page recipient rejected',async()=>reject(
 'META_PAGE_AND_MESSAGE_BINDING_MISMATCH',f=>{f.body.entry[0].messaging[0].recipient.id='wrong-page-001';resign(f)}));
test('Meta authenticated wrong MID rejected',async()=>reject(
 'META_PAGE_AND_MESSAGE_BINDING_MISMATCH',f=>{f.body.entry[0].messaging[0].message.mid='another-mid-0001';resign(f)}));
test('Meta cannot promote tenantId from signed body',async()=>reject(
 'PROVIDER_BODY_CANNOT_ASSIGN_STORE_OR_COMMERCE_AUTHORITY',f=>{f.body.tenantId='tenant-a-attacker';resign(f)}));
test('Zalo Bot cannot promote Store ID from body',async()=>reject(
 'PROVIDER_BODY_CANNOT_ASSIGN_STORE_OR_COMMERCE_AUTHORITY',f=>{f.body.storeId='store-B-fake';resign(f)},'ZALO_BOT'));
test('Zalo Bot wrong message ID rejected',async()=>reject(
 'ZALO_BOT_TEXT_EVENT_SHAPE_INVALID',f=>{f.body.result.message.message_id='other-message-12345';resign(f)},'ZALO_BOT'));
test('Zalo Bot non-text event denied',async()=>reject(
 'ZALO_BOT_TEXT_EVENT_SHAPE_INVALID',f=>{f.body.result.event_name='message.image.received';resign(f)},'ZALO_BOT'));
test('old incorrect V17.7F root-only Zalo Bot event is rejected',async()=>reject(
 'ZALO_BOT_TEXT_EVENT_SHAPE_INVALID',f=>{
   f.body={event_name:'message.text.received',message:f.body.result.message};resign(f)
 },'ZALO_BOT'));
test('Zalo Bot webhook requires ok true',async()=>reject(
 'ZALO_BOT_TEXT_EVENT_SHAPE_INVALID',f=>{f.body.ok=false;resign(f)},'ZALO_BOT'));
test('Zalo Bot webhook rejects stale embedded date',async()=>reject(
 'ZALO_BOT_TEXT_EVENT_SHAPE_INVALID',f=>{f.body.result.message.date=NOW-700000;resign(f)},'ZALO_BOT'));
test('Zalo Bot webhook denies group event for private-chat canary',async()=>reject(
 'ZALO_BOT_TEXT_EVENT_SHAPE_INVALID',f=>{f.body.result.message.chat.chat_type='GROUP';resign(f)},'ZALO_BOT'));
test('durable replay failure must deny, not proceed',async()=>reject(
 'REPLAY_BACKEND_UNAVAILABLE',f=>f.deps.reserveOnce=async()=>{throw Error('no store')}));
test('duplicate Meta MID/installation is denied',async()=>{
 const f=fixture();
 const a=await inspectSyntheticProviderReceipt(f.input,f.expected,f.deps);
 const b=await inspectSyntheticProviderReceipt(f.input,f.expected,f.deps);
 assert.equal(a.shapeCandidate,true);
 assert.equal(b.shapeCandidate,false);assert.equal(b.reason,'DUPLICATE_PROVIDER_EVENT_FIXTURE');locked(b);
});
test('duplicate Zalo Bot MID/installation is denied',async()=>{
 const f=fixture('ZALO_BOT');
 const a=await inspectSyntheticProviderReceipt(f.input,f.expected,f.deps);
 const b=await inspectSyntheticProviderReceipt(f.input,f.expected,f.deps);
 assert.equal(a.shapeCandidate,true);
 assert.equal(b.shapeCandidate,false);assert.equal(b.reason,'DUPLICATE_PROVIDER_EVENT_FIXTURE');locked(b);
});
test('registry never auto-enables public callback',()=>{
 const x=describeSourceOnlyProviderCanary();
 assert.deepEqual(x.providerChannels,['MESSENGER','ZALO_BOT']);
 assert.equal(x.merchantEvidenceIngress,'RPC16_ACCESS_DENY_ALL_UNCHANGED');
 assert.equal(x.providerCanaryIngress,'NOT_DEPLOYED_NOT_PUBLIC');
 assert.equal(x.humanAccessNotReusedAsProviderWebhook,true);
 assert.equal(x.outboundConnections,0);assert.equal(x.commerceConnections,0);
 assert.equal(x.canDeploy,false);assert.equal(x.canSend,false);
});
