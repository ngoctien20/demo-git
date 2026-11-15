'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {METHOD_SPECS,OFFLINE_ASSETS,draft,draftGallery,readOnlyWebhookResult,
sanitizeProviderResponse}=require('./contracts.cjs');
const ERR=(f,re)=>assert.throws(f,re);
test('exactly five Bot methods, POST and official references',()=>{
 const methods=['getWebhookInfo','sendPhoto','sendChatAction','sendSticker','sendVoice'];
 assert.deepEqual(Object.keys(METHOD_SPECS).sort(),methods.sort());
 for(const api of methods){
  const s=METHOD_SPECS[api];assert.equal(s.apiMethod,api);
  assert.equal(s.document,'https://docs.zaloplatforms.com/docs/BOT/apis/'+api);
  assert.ok(s.category==='READ_ONLY'||s.sideEffect==='SEND');
 }
});
test('all five drafts are offline, with no recipient or transport',()=>{
 const cases=draftGallery();assert.equal(cases.length,5);
 for(const x of cases){
  assert.equal(x.request_method,'POST');assert.equal(x.dry_run,true);
  assert.equal(x.provider_call_allowed,false);assert.equal(x.no_live_asset,true);
  assert.equal(x.external_sends,0);assert.equal(x.orders_written,0);
  assert.equal(x.webhook_changes,0);assert.ok(!('chat_id' in x.body));
  assert.ok(!('BOT_TOKEN' in x));assert.ok(!('endpoint' in x));
  assert.equal(x.source,'ZALO_BOT_CREATOR_OFFICIAL_API');
 }
});
test('getWebhookInfo empty body, no recipient, read-only',()=>{
 const x=draft('getWebhookInfo');
 assert.deepEqual(x.body,{});assert.equal(x.requires_server_bound_recipient,false);
 assert.equal(x.api_side_effect,'NONE');
});
test('getWebhookInfo rejects every mutation/extra parameter',()=>{
 for(const o of [{url:'https://example.test'},{chat_id:'qa'},{token:'secret'},{webhook:'new'},{disable_webhook:true}])
 ERR(()=>draft('getWebhookInfo',o),/OPTIONS_NOT_ALLOWED/);
});
test('getWebhookInfo redacts host, path, query and credentials',()=>{
 const x=readOnlyWebhookResult({ok:true,result:{url:'https://private.example.test/webhook?secret=123',updated_at:1749633372026}});
 assert.equal(x.configured,true);assert.equal(x.url_redacted,true);
 assert.equal(x.updated_at_valid,true);
 assert.equal(JSON.stringify(x).includes('private.example'),false);
 assert.equal(JSON.stringify(x).includes('secret'),false);
});
test('getWebhookInfo unconfigured remains read-only',()=>{
 assert.equal(readOnlyWebhookResult({ok:true,result:{url:'',updated_at:0}}).configured,false);
 assert.equal(sanitizeProviderResponse('getWebhookInfo',{ok:true,result:{url:''}}).readonly,true);
});
test('getWebhookInfo invalid result is fail-closed',()=>{
 for(const value of [{ok:false,error:'secret'},{ok:true,result:null},{ok:true,result:[]}])
 ERR(()=>readOnlyWebhookResult(value),/WEBHOOK_RESULT_INVALID/);
});
test('sendPhoto only fixed nonroutable image and caption',()=>{
 const x=draft('sendPhoto',{assetKey:'productImage',caption:'Ảnh sản phẩm QA 🛍️'});
 assert.equal(x.body.caption,'Ảnh sản phẩm QA 🛍️');
 assert.equal(x.body.photo,'https://media.qa.invalid/products/catalog-qa.jpg');
 assert.equal(x.requires_server_bound_recipient,true);
 assert.equal(x.api_side_effect,'SEND');
 assert.equal(OFFLINE_ASSETS.productImage.approved_for_send,false);
});
test('sendPhoto 2000 char accepted, 2001 rejected',()=>{
 assert.equal(draft('sendPhoto',{assetKey:'productImage',caption:'a'.repeat(2000)}).body.caption.length,2000);
 ERR(()=>draft('sendPhoto',{assetKey:'productImage',caption:'a'.repeat(2001)}),/CAPTION_LENGTH_INVALID/);
});
test('sendPhoto blocks empty caption and arbitrary URL',()=>{
 ERR(()=>draft('sendPhoto',{assetKey:'productImage',caption:''}),/CAPTION_LENGTH_INVALID/);
 ERR(()=>draft('sendPhoto',{assetKey:'https://evil.test/x.jpg',caption:'x'}),/IMAGE_ASSET_NOT_ALLOWLISTED/);
 ERR(()=>draft('sendPhoto',{assetKey:'productImage',caption:'x',photo:'https://evil.test/x.jpg'}),/OPTIONS_NOT_ALLOWED/);
});
test('sendPhoto disallows client recipient, tenant and credentials',()=>{
 for(const name of ['chat_id','tenant_id','store_id','BOT_TOKEN','token','httpMethod']){
  ERR(()=>draft('sendPhoto',{assetKey:'productImage',caption:'test',[name]:'attacker'}),/OPTIONS_NOT_ALLOWED/);
 }
});
test('sendChatAction only typing, not upload_photo',()=>{
 const x=draft('sendChatAction',{action:'typing'});
 assert.deepEqual(x.body,{action:'typing'});
 for(const action of ['upload_photo','record_voice','typing...','','delete'])
 ERR(()=>draft('sendChatAction',{action}),/ACTION_UNSUPPORTED/);
});
test('typing is not a completed provider send',()=>{
 const x=draft('sendChatAction',{action:'typing'});
 assert.equal(x.provider_call_allowed,false);assert.equal(x.requires_server_bound_recipient,true);
 assert.equal(x.client_rendering_verified,false);
});
test('sendSticker documentation fixture is not verified for account',()=>{
 const x=draft('sendSticker',{assetKey:'stickerExample'});
 assert.equal(x.body.sticker,'0e078a2fb66a5f34067b');
 assert.equal(OFFLINE_ASSETS.stickerExample.approved_for_send,false);
 assert.match(OFFLINE_ASSETS.stickerExample.provenance,/UNVERIFIED/);
});
test('sendSticker blocks arbitrary ID',()=>{
 ERR(()=>draft('sendSticker',{assetKey:'001122deadbeef'}),/STICKER_SOURCE_UNVERIFIED/);
 ERR(()=>draft('sendSticker',{assetKey:'stickerExample',sticker:'other'}),/OPTIONS_NOT_ALLOWED/);
});
test('sendVoice only AAC in private 1:1',()=>{
 const x=draft('sendVoice',{assetKey:'customerVoice',chatType:'private'});
 assert.deepEqual(x.body,{voice_url:'https://media.qa.invalid/voice/hello-qa.aac'});
 assert.equal(x.body.voice_url.endsWith('.aac'),true);
 assert.equal('caption' in x.body,false);
});
test('sendVoice forbids groups, unknown URLs and caption',()=>{
 for(const chatType of ['group','channel','unknown',''])
 ERR(()=>draft('sendVoice',{assetKey:'customerVoice',chatType}),/VOICE_ONLY_1_TO_1/);
 ERR(()=>draft('sendVoice',{assetKey:'https://third.party/voice.aac',chatType:'private'}),/VOICE_ASSET_NOT_ALLOWLISTED/);
 ERR(()=>draft('sendVoice',{assetKey:'customerVoice',chatType:'private',caption:'bad'}),/OPTIONS_NOT_ALLOWED/);
});
test('media URLs are reserved .invalid examples only',()=>{
 for(const a of [OFFLINE_ASSETS.productImage,OFFLINE_ASSETS.customerVoice]){
  assert.equal(new URL(a.url).hostname,'media.qa.invalid');
  assert.equal(a.approved_for_send,false);assert.match(a.provenance,/SYNTHETIC/);
 }
});
test('no unspecified provider write methods may enter draft',()=>{
 for(const a of ['sendMessage','setWebhook','deleteWebhook','getUpdates','getMe','/v1/send','constructor','__proto__'])
 ERR(()=>draft(a),/API_UNSUPPORTED/);
});
test('invalid options are rejected for all operations',()=>{
 for(const api of Object.keys(METHOD_SPECS)){
  for(const bad of [null,[],42,'oops'])ERR(()=>draft(api,bad),/OPTIONS_INVALID/);
 }
});
test('getWebhookInfo is isolated from send drafts',()=>{
 for(const x of draftGallery()){
  assert.ok(x.api_method!=='getWebhookInfo'||Object.keys(x.body).length===0);
  assert.ok(x.api_method==='getWebhookInfo'||x.requires_server_bound_recipient);
 }
});
test('provider ACK not conflated with delivered/rendereed',()=>{
 const x=sanitizeProviderResponse('sendPhoto',{ok:true,result:{message_id:'private-provider-id',date:123}});
 assert.equal(x.provider_accepted,true);assert.equal(x.provider_message_id_present,true);
 assert.equal(x.message_delivery_proven,false);assert.equal(x.client_rendering_verified,false);
 assert.equal(JSON.stringify(x).includes('private-provider-id'),false);
});
test('ChatAction ACK can have no message ID',()=>{
 const x=sanitizeProviderResponse('sendChatAction',{ok:true});
 assert.equal(x.provider_accepted,true);assert.equal(x.provider_message_id_present,false);
 assert.equal(x.message_delivery_proven,false);
});
test('provider negative result cannot be treated as delivery',()=>{
 for(const api of ['sendPhoto','sendSticker','sendVoice','sendChatAction']){
  const x=sanitizeProviderResponse(api,{ok:false,description:'NO_PERMISSION'});
  assert.equal(x.provider_accepted,false);assert.equal(x.message_delivery_proven,false);
 }
});
test('source cannot access secrets, endpoints or real HTTP',()=>{
 const s=fs.readFileSync(require.resolve('./contracts.cjs'),'utf8');
 const forbidden=['fetch(','.post(','axios','require("http")','require("https")',
 'ZALO_BOT_TOKEN','GATEWAY_AUTH_KEY','service_role','localStorage','sessionStorage',
 'n8n.cloud','new Request(','setWebhook(', 'deleteWebhook('];
 for(const term of forbidden)assert.equal(s.includes(term),false,term);
});
test('stable gallery order',()=>{
 assert.deepEqual(draftGallery().map(x=>x.api_method),[
  'getWebhookInfo','sendPhoto','sendChatAction','sendSticker','sendVoice']);
});
