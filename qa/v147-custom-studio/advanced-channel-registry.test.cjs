'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const registry=require('./advanced-channel-registry.js');
const base={tenant_id:'tenant-A',store_id:'store-A'};
test('registry has nonempty unique channel-component pairs',()=>{
 const seen=new Set();for(const item of registry.REGISTRY){
  const key=item.channel+'|'+item.componentId;
  assert(!seen.has(key),key);seen.add(key);
  assert(item.documentation);assert(item.scope);assert(item.version);
  assert(item.contentLimits.verified===false);
  assert.equal(item.qaStatus,'SOURCE_PREVIEW_ONLY');
  assert.equal(item.providerSendAuthorized,false);
 }
 assert(registry.REGISTRY.length>=25);
});
test('all four channels preserve scope and no-send',()=>{
 for(const channel of registry.CHANNELS){
  const p=registry.resolve({...base,channel,componentId:'TEXT'});
  assert.equal(p.type,'TEXT');assert.equal(p.sendable,false);
  assert.equal(p.tenant_id,'tenant-A');assert.equal(p.store_id,'store-A');
 }
});
test('strict unknown channel',()=>assert.equal(registry.resolve({...base,channel:'TELEGRAM',componentId:'TEXT'}).status,'DENY'));
test('required store scope',()=>assert.equal(registry.resolve({channel:'MESSENGER',componentId:'TEXT'}).reason,'STORE_SCOPE_MISSING'));
test('Zalo Bot native carousel forbidden and safely downgraded',()=>{
 const p=registry.resolve({...base,channel:'ZALO_BOT',componentId:'PRODUCT_CAROUSEL'});
 assert.equal(p.status,'FALLBACK');assert.equal(p.type,'TEXT');assert.equal(p.sendable,false);
});
test('Zalo Bot supports documented text styles only as preview',()=>{
 const p=registry.resolve({...base,channel:'ZALO_BOT',componentId:'RICH_TEXT'});
 assert.equal(p.status,'PREVIEW_ONLY');assert.equal(p.sendable,false);
});
test('Messenger native arbitrary rich text is not assumed',()=>{
 assert.equal(registry.resolve({...base,channel:'MESSENGER',componentId:'RICH_TEXT'}).status,'FALLBACK');
});
test('OA template cannot be sent without approval even if caller spoofs grants',()=>{
 const p=registry.resolve({...base,channel:'ZALO_OA',componentId:'ZBS_TEMPLATE',permission:true,paid:true});
 assert.equal(p.status,'FALLBACK');assert.equal(p.reason,'PAID_TEMPLATE_APPROVAL_LOCKED');
});
test('OA CTA still requires independent provider account verification',()=>{
 const p=registry.resolve({...base,channel:'ZALO_OA',componentId:'OA_CTA',approved:true});
 assert.equal(p.status,'PREVIEW_ONLY');assert.equal(p.sendable,false);
});
test('signed postbacks never yield executable client commands',()=>{
 const p=registry.resolve({...base,channel:'MESSENGER',componentId:'SIGNED_POSTBACK',signed:true,nonce:'fake'});
 assert.equal(p.requiresSignedServerAction,true);assert.equal(p.actionExecutable,false);
});
test('verified store media remains required and cannot be spoofed',()=>{
 const p=registry.resolve({...base,channel:'ZALO_BOT',componentId:'PHOTO_CAPTION',assetUrl:'https://evil.invalid'});
 assert.equal(p.requiresVerifiedMedia,true);assert.equal(p.sendable,false);
});
test('cross-channel component cannot leak between stores',()=>{
 const a=registry.resolve({...base,channel:'MESSENGER',componentId:'PRODUCT_CARD'});
 const b=registry.resolve({tenant_id:'tenant-B',store_id:'store-B',channel:'MESSENGER',componentId:'PRODUCT_CARD'});
 assert.notEqual(a.store_id,b.store_id);assert.notEqual(a.tenant_id,b.tenant_id);
});
test('all capability entries are immutable',()=>{
 assert(Object.isFrozen(registry.REGISTRY));assert(Object.isFrozen(registry.REGISTRY[0]));
});
test('no component is ever live-authorized merely by documented provider API',()=>{
 assert(registry.REGISTRY.every(c=>c.providerSendAuthorized===false));
});
test('fallback for unknown component, including suspicious action name',()=>{
 for(const componentId of ['EXECUTE_SQL','CREATE_ORDER','https://evil.invalid']){
  assert.equal(registry.resolve({...base,channel:'WEB_WIDGET',componentId}).status,'FALLBACK');
 }
});
test('version is stable and prefixed',()=>assert.match(registry.VERSION,/^T404_ADV_CHANNEL_REGISTRY_/));
