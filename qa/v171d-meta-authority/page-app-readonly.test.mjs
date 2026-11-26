import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyReadOnly,CONTRACT} from './page-app-readonly.mjs';
const pageId='9900000001',appId='8800000001',token='QA_PRIVATE_TOKEN_FOR_OFFLINE_TEST_ONLY';
function fake({page=pageId,apps=[appId],status=200,mode='normal'}={}){
 const calls=[];
 async function fn(url,options){
  calls.push({url,method:options.method,redirect:options.redirect,authorization:options.headers?.Authorization});
  if(mode==='throw')throw Error('Do not leak token '+token);
  if(mode==='badJson')return {ok:true,json:async()=>({error:{message:'provider private error'}})};
  if(mode==='nonArray')return {ok:true,json:async()=>url.includes('subscribed_apps')?{}:{id:page}};
  return {ok:status===200,json:async()=>url.includes('subscribed_apps')?{data:apps.map(id=>({id}))}:{id:page}};
 }
 return {fn,calls};
}
const base={pageId,appId,token};
test('01 stable contract',()=>assert.match(CONTRACT,/V1$/));
test('02 app subscription visible',async()=>{
 const f=fake(),r=await verifyReadOnly({...base,fetchImpl:f.fn});
 assert.equal(r.expected_app_subscription_visible,true);
 assert.equal(r.page_token_can_read_page,true);
});
test('03 always owner unverified',async()=>{
 const f=fake(),r=await verifyReadOnly({...base,fetchImpl:f.fn});
 assert.equal(r.verified_merchant_business_owner,false);
 assert.equal(r.authorized_to_change_callback,false);
});
test('04 never imply real shadow verified',async()=>assert.equal((await verifyReadOnly({...base,fetchImpl:fake().fn})).real_shadow_callback_tested,false));
test('05 uses only two GET calls',async()=>{
 const f=fake();await verifyReadOnly({...base,fetchImpl:f.fn});
 assert.equal(f.calls.length,2);
 assert.deepEqual(f.calls.map(c=>c.method),['GET','GET']);
});
test('06 domain is exact Meta Graph',async()=>{
 const f=fake();await verifyReadOnly({...base,fetchImpl:f.fn});
 assert(f.calls.every(c=>new URL(c.url).origin==='https://graph.facebook.com'));
});
test('07 token never used in query',async()=>{
 const f=fake();await verifyReadOnly({...base,fetchImpl:f.fn});
 assert(f.calls.every(c=>!c.url.includes(token)&&c.authorization==='Bearer '+token));
});
test('08 redirects forbidden',async()=>{
 const f=fake();await verifyReadOnly({...base,fetchImpl:f.fn});
 assert(f.calls.every(c=>c.redirect==='error'));
});
test('09 missing app blocked',async()=>{
 const f=fake({apps:[]}),r=await verifyReadOnly({...base,fetchImpl:f.fn});
 assert.equal(r.expected_app_subscription_visible,false);
 assert.equal(r.verified_merchant_business_owner,false);
});
test('10 page scope mismatch denied early',async()=>{
 const f=fake({page:'9900000009'}),r=await verifyReadOnly({...base,fetchImpl:f.fn});
 assert.equal(r.status,'BLOCKED');assert.equal(f.calls.length,1);
});
test('11 Graph failure redacted',async()=>{
 const f=fake({mode:'throw'}),r=await verifyReadOnly({...base,fetchImpl:f.fn});
 assert.equal(r.status,'BLOCKED');assert(!JSON.stringify(r).includes(token));
});
test('12 provider private error redacted',async()=>{
 const f=fake({mode:'badJson'}),r=await verifyReadOnly({...base,fetchImpl:f.fn});
 assert.equal(r.status,'BLOCKED');assert(!JSON.stringify(r).includes('provider private error'));
});
test('13 malformed subscriptions blocked',async()=>{
 const f=fake({mode:'nonArray'}),r=await verifyReadOnly({...base,fetchImpl:f.fn});
 assert.equal(r.status,'BLOCKED');
});
test('14 malformed token stops before any network',async()=>{
 const f=fake(),r=await verifyReadOnly({...base,token:'bad\nvalue',fetchImpl:f.fn});
 assert.equal(r.status,'BLOCKED');assert.equal(f.calls.length,0);
});
test('15 invalid Page ID stops before network',async()=>{
 const f=fake(),r=await verifyReadOnly({...base,pageId:'../evil',fetchImpl:f.fn});
 assert.equal(r.status,'BLOCKED');assert.equal(f.calls.length,0);
});
test('16 invalid App ID stops before network',async()=>{
 const f=fake(),r=await verifyReadOnly({...base,appId:'abc',fetchImpl:f.fn});
 assert.equal(r.status,'BLOCKED');assert.equal(f.calls.length,0);
});
test('17 results never contain token or page ID',async()=>{
 const f=fake(),r=await verifyReadOnly({...base,fetchImpl:f.fn});
 assert(!JSON.stringify(r).includes(token));
 assert(!JSON.stringify(r).includes(pageId));
 assert(!JSON.stringify(r).includes(appId));
});
test('18 no Message Send API endpoints called',async()=>{
 const f=fake();await verifyReadOnly({...base,fetchImpl:f.fn});
 assert(f.calls.every(c=>!c.url.includes('/messages')&&!c.url.includes('/subscriptions?')));
});
test('19 app subscription visibility is not subscription write permission',async()=>{
 const f=fake(),r=await verifyReadOnly({...base,fetchImpl:f.fn});
 assert.equal(r.authorized_to_change_callback,false);
 assert.equal(r.real_messenger_send_count,0);
 assert.equal(r.commerce_writes,0);
});
test('20 exact read-only endpoints',async()=>{
 const f=fake();await verifyReadOnly({...base,fetchImpl:f.fn});
 assert(f.calls[0].url.endsWith('/'+pageId+'?fields=id'));
 assert(f.calls[1].url.endsWith('/'+pageId+'/subscribed_apps?fields=id'));
});
