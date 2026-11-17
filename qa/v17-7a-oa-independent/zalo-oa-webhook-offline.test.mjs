import test from 'node:test';
import assert from 'node:assert/strict';
import {signSyntheticOaWebhook,inspectSyntheticOaWebhook} from './zalo-oa-webhook-offline.mjs';

const NOW=1794912000000;
const appId='360846524940903967',oaId='388613280878808645';
const secret='QA_ONLY_mock_signature_key_1234';
function f(){
 const payload={app_id:appId,sender:{id:'246845883529197922'},
  recipient:{id:oaId},event_name:'user_send_text',
  message:{text:'QA: xem sản phẩm?',msg_id:'96d3cdf3af150460909'},
  timestamp:String(NOW-1000)};
 const rawBody=Buffer.from(JSON.stringify(payload),'utf8');
 const headers={'X-ZEvent-Signature':signSyntheticOaWebhook(rawBody,appId,secret)};
 const expected={appId,oaId,offlineSecret:secret,noSend:true,noCommerceWrite:true};
 const seen=new Set();
 const deps={mode:'OFFLINE_FIXTURE_ONLY',liveEnabled:false,nowMs:NOW,
   reserveOnce:async k=>{if(seen.has(k))return false;seen.add(k);return true}};
 return {payload,rawBody,headers,expected,deps};
}
async function denied(reason,fn){
 const x=f();fn(x);
 const r=await inspectSyntheticOaWebhook(x,x.expected,x.deps);
 assert.equal(r.fixtureAccepted,false,JSON.stringify(r));
 assert.equal(r.reason,reason);assert.equal(r.canSend,false);
 assert.equal(r.canWriteOrders,false);assert.equal(r.canPublish,false);
 assert.equal(r.realSignatureVerified,false);
}
test('official X-ZEvent-Signature shaped offline raw bytes are only synthetic',async()=>{
 const x=f(),r=await inspectSyntheticOaWebhook(x,x.expected,x.deps);
 assert.equal(r.fixtureAccepted,true);
 assert.equal(r.realSignatureVerified,false);assert.equal(r.oaOwnerVerified,false);
 assert.equal(r.storeRlsVerified,false);
 assert.equal(r.canSend,false);assert.equal(r.canWriteOrders,false);
 assert.equal(JSON.stringify(r).includes(secret),false);
 assert.equal(JSON.stringify(r).includes(x.payload.message.text),false);
});
test('synthetic helper never accepts real-looking secret outside explicit QA prefix',()=>{
 const x=f();assert.equal(signSyntheticOaWebhook(x.rawBody,appId,'real-secret'),null);
});
test('Zalo Bot header does not satisfy OA header',async()=>denied('NATIVE_HEADER_FORMAT_MISSING_OR_DUPLICATE',x=>{x.headers={'X-Bot-Api-Secret-Token':'mock'}}));
test('wrong OA header name from blog not accepted',async()=>denied('NATIVE_HEADER_FORMAT_MISSING_OR_DUPLICATE',x=>{x.headers={'X-Zalo-Signature':x.headers['X-ZEvent-Signature']}}));
test('duplicate case insensitive signature headers rejected',async()=>denied('NATIVE_HEADER_FORMAT_MISSING_OR_DUPLICATE',x=>{x.headers['x-zevent-signature']=x.headers['X-ZEvent-Signature']}));
test('missing signature rejected',async()=>denied('NATIVE_HEADER_FORMAT_MISSING_OR_DUPLICATE',x=>{x.headers={}}));
test('invalid mac prefix rejected',async()=>denied('NATIVE_HEADER_FORMAT_MISSING_OR_DUPLICATE',x=>{x.headers['X-ZEvent-Signature']='sha256='+ 'a'.repeat(64)}));
test('invalid signature MAC rejected',async()=>denied('RAW_BODY_MAC_MISMATCH',x=>{x.headers['X-ZEvent-Signature']='mac='+'0'.repeat(64)}));
test('modify raw signed body without changing MAC rejected',async()=>denied('RAW_BODY_MAC_MISMATCH',x=>{x.rawBody=Buffer.from(x.rawBody.toString().replace('sản phẩm','đơn hàng'))}));
test('reformatted signed JSON not equivalent bytes',async()=>denied('RAW_BODY_MAC_MISMATCH',x=>{x.rawBody=Buffer.from(JSON.stringify(JSON.parse(x.rawBody.toString()),null,2))}));
test('signed but wrong OA recipient rejected',async()=>denied('APP_OA_EVENT_NOT_EXACTLY_BOUND',x=>{
 x.payload.recipient.id='12345678901';x.rawBody=Buffer.from(JSON.stringify(x.payload));
 x.headers['X-ZEvent-Signature']=signSyntheticOaWebhook(x.rawBody,appId,secret);
}));
test('signed but wrong app id rejected',async()=>denied('APP_OA_EVENT_NOT_EXACTLY_BOUND',x=>{
 x.payload.app_id='4444444444';x.rawBody=Buffer.from(JSON.stringify(x.payload));
 x.headers['X-ZEvent-Signature']=signSyntheticOaWebhook(x.rawBody,'4444444444',secret);
}));
test('signed OA send event cannot appear as customer message',async()=>denied('APP_OA_EVENT_NOT_EXACTLY_BOUND',x=>{
 x.payload.event_name='oa_send_text';x.rawBody=Buffer.from(JSON.stringify(x.payload));
 x.headers['X-ZEvent-Signature']=signSyntheticOaWebhook(x.rawBody,appId,secret);
}));
test('group webhook event needs its own adapter',async()=>denied('APP_OA_EVENT_NOT_EXACTLY_BOUND',x=>{
 x.payload.event_name='user_send_group_text';x.rawBody=Buffer.from(JSON.stringify(x.payload));
 x.headers['X-ZEvent-Signature']=signSyntheticOaWebhook(x.rawBody,appId,secret);
}));
test('stale signed event rejected',async()=>denied('STALE_OR_BAD_EVENT_TIMESTAMP',x=>{
 x.payload.timestamp=String(NOW-600000);x.rawBody=Buffer.from(JSON.stringify(x.payload));
 x.headers['X-ZEvent-Signature']=signSyntheticOaWebhook(x.rawBody,appId,secret);
}));
test('future signed event rejected',async()=>denied('STALE_OR_BAD_EVENT_TIMESTAMP',x=>{
 x.payload.timestamp=String(NOW+600000);x.rawBody=Buffer.from(JSON.stringify(x.payload));
 x.headers['X-ZEvent-Signature']=signSyntheticOaWebhook(x.rawBody,appId,secret);
}));
test('body too large rejected before signature',async()=>denied('BAD_RAW_BODY_OR_HEADERS',x=>{x.rawBody=Buffer.alloc(40000,65)}));
test('body not raw Buffer rejected',async()=>denied('BAD_RAW_BODY_OR_HEADERS',x=>{x.rawBody=x.rawBody.toString()}));
test('invalid utf8 rejected',async()=>denied('INVALID_RAW_JSON_ENCODING',x=>{x.rawBody=Buffer.from([0xff,0xfe,0xfd,0x00,...Buffer.alloc(30,65)])}));
test('invalid JSON rejected',async()=>denied('INVALID_RAW_JSON_ENCODING',x=>{x.rawBody=Buffer.from('{ broken: this is not json 1234567890}')} ));
test('missing message id rejected',async()=>denied('MESSAGE_SHAPE_NOT_ALLOWED',x=>{
 delete x.payload.message.msg_id;x.rawBody=Buffer.from(JSON.stringify(x.payload));
 x.headers['X-ZEvent-Signature']=signSyntheticOaWebhook(x.rawBody,appId,secret);
}));
test('empty text rejected',async()=>denied('MESSAGE_SHAPE_NOT_ALLOWED',x=>{
 x.payload.message.text='';x.rawBody=Buffer.from(JSON.stringify(x.payload));
 x.headers['X-ZEvent-Signature']=signSyntheticOaWebhook(x.rawBody,appId,secret);
}));
test('owner proof cannot be enabled by fixture flag',async()=>denied('PRIVATE_QA_WEBHOOK_GATE_MISSING',x=>{x.deps.liveEnabled=true}));
test('actual secret not provided rejected',async()=>denied('PRIVATE_QA_WEBHOOK_GATE_MISSING',x=>{x.expected.offlineSecret='not-fixture-key'}));
test('Commerce send enabled rejected',async()=>denied('PRIVATE_QA_WEBHOOK_GATE_MISSING',x=>{x.expected.noSend=false}));
test('Commerce write enabled rejected',async()=>denied('PRIVATE_QA_WEBHOOK_GATE_MISSING',x=>{x.expected.noCommerceWrite=false}));
test('Replay backend error is hard deny',async()=>denied('DURABLE_REPLAY_SERVICE_UNAVAILABLE',x=>{x.deps.reserveOnce=async()=>{throw Error('down')}}));
test('identical signed event is replay denied',async()=>{
 const x=f();const one=await inspectSyntheticOaWebhook(x,x.expected,x.deps);
 const two=await inspectSyntheticOaWebhook(x,x.expected,x.deps);
 assert.equal(one.fixtureAccepted,true);assert.equal(two.fixtureAccepted,false);
 assert.equal(two.reason,'DUPLICATE_ZALO_OA_EVENT');
});
