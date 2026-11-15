'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {makeReadOnlyProbe}=require('./live03e-readonly-provider-id-attestation.cjs');
const {randomBytes}=require('node:crypto');
const BOT_ID='1459232241454765289'; // Zalo's public sample, not the TIEN404 Bot
const key=randomBytes(32);
const response={httpStatus:200,origin:'SERVER_HTTPS_ZALO_GETME',body:{ok:true,result:{id:BOT_ID,account_name:'sample.bot'}}};
const fixture=(over={})=>makeReadOnlyProbe({
 trustedGetMe:async()=>response,identityKey:key,tenantId:'tenant_b_qa',storeId:'shop_b_qa',
 trustedRuntime:'SERVER_ONLY_NO_SEND',...over
});
const blocked=async (x,why)=>{const v=await x();assert.equal(v.state,'BLOCKED');assert.equal(v.reason,why);assert.equal(v.can_send,false)};
test('fails closed without preconfigured trusted runtime',async()=>blocked(makeReadOnlyProbe(), 'TRUST_RUNTIME_UNAVAILABLE'));
test('no private key supplied is rejected',async()=>blocked(fixture({identityKey:undefined}),'TRUST_RUNTIME_UNAVAILABLE'));
test('short key rejected',async()=>blocked(fixture({identityKey:Buffer.alloc(3)}),'TRUST_RUNTIME_UNAVAILABLE'));
test('using a raw string key rejected',async()=>blocked(fixture({identityKey:'not-a-secure-server-secret'}),'TRUST_RUNTIME_UNAVAILABLE'));
test('untrusted runtime rejected',async()=>blocked(fixture({trustedRuntime:'CLIENT_APPROVED_TRUE'}),'TRUST_RUNTIME_UNAVAILABLE'));
test('no provider fetch callback blocked',async()=>blocked(fixture({trustedGetMe:undefined}),'TRUST_RUNTIME_UNAVAILABLE'));
test('invalid tenant blocked',async()=>blocked(fixture({tenantId:'bad tenant'}),'TRUST_RUNTIME_UNAVAILABLE'));
test('invalid shop blocked',async()=>blocked(fixture({storeId:'bad shop'}),'TRUST_RUNTIME_UNAVAILABLE'));
test('server provider success yields ONLY partial identity observation and never sends',async()=>{
 const result=await fixture()();
 assert.equal(result.state,'PROVIDER_ID_OBSERVED_NOT_BOUND');
 assert.equal(result.bot_shop_owner_verified,false);
 assert.equal(result.owner_pair_verified,false);
 assert.equal(result.can_send,false);
 assert.equal(result.can_promote_registry,false);
 assert.equal(result.provider_sends,0);
 assert.match(result.bot_digest,/^[0-9a-f]{64}$/);
 assert.match(result.tenant_digest,/^[0-9a-f]{64}$/);
 assert.match(result.store_digest,/^[0-9a-f]{64}$/);
 assert.ok(result.expires_ms-result.observed_ms===120000);
 assert.ok(!JSON.stringify(result).includes(BOT_ID));
 assert.ok(!JSON.stringify(result).includes('sample.bot'));
});
test('successful probes have distinct nonce-bound digests to avoid correlation',async()=>{
 const v=fixture(),a=await v(),b=await v();
 assert.notEqual(a.bot_digest,b.bot_digest);
 assert.notEqual(a.attest_nonce,b.attest_nonce);
});
test('reject provider status 401',async()=>blocked(fixture({trustedGetMe:async()=>({...response,httpStatus:401})}),'PROVIDER_GETME_UNVERIFIED'));
test('reject non-provider origin',async()=>blocked(fixture({trustedGetMe:async()=>({...response,origin:'CLIENT_FETCH'})}),'PROVIDER_GETME_UNVERIFIED'));
test('reject missing signed provider transport result',async()=>blocked(fixture({trustedGetMe:async()=>({httpStatus:200,body:response.body})}),'PROVIDER_GETME_UNVERIFIED'));
test('reject provider ok=false',async()=>blocked(fixture({trustedGetMe:async()=>({...response,body:{ok:false,result:response.body.result}})}),'PROVIDER_GETME_UNVERIFIED'));
test('reject boolean token_valid without raw result.id',async()=>blocked(fixture({trustedGetMe:async()=>({...response,body:{ok:true,bot_token_valid:true}})}),'OFFICIAL_BOT_ID_MISSING'));
test('reject missing Bot ID',async()=>blocked(fixture({trustedGetMe:async()=>({...response,body:{ok:true,result:{account_name:'fake'}}})}),'OFFICIAL_BOT_ID_MISSING'));
test('reject provider Bot ID as a number to prevent integer-loss',async()=>blocked(fixture({trustedGetMe:async()=>({...response,body:{ok:true,result:{id:1459232241454765289,account_name:'bot'}}})}),'OFFICIAL_BOT_ID_MISSING'));
test('reject fake alpha Bot ID',async()=>blocked(fixture({trustedGetMe:async()=>({...response,body:{ok:true,result:{id:'b',account_name:'bot'}}})}),'OFFICIAL_BOT_ID_MISSING'));
test('reject missing account_name',async()=>blocked(fixture({trustedGetMe:async()=>({...response,body:{ok:true,result:{id:BOT_ID}}})}),'OFFICIAL_BOT_ID_MISSING'));
test('reject overlong account_name',async()=>blocked(fixture({trustedGetMe:async()=>({...response,body:{ok:true,result:{id:BOT_ID,account_name:'b'.repeat(400)}}})}),'OFFICIAL_BOT_ID_MISSING'));
test('provider timeout/errors cannot expose raw secret in output',async()=>{
 const x=await fixture({trustedGetMe:async()=>{throw Error('TOKEN_PRIVATE_SHOULD_NOT_LOG')}})();
 assert.equal(x.state,'BLOCKED');assert.ok(!JSON.stringify(x).includes('TOKEN_PRIVATE_SHOULD_NOT_LOG'));
});
test('trusted callback is not called for invalid runtime configuration',async()=>{
 let called=0;const x=fixture({identityKey:Buffer.alloc(4),trustedGetMe:async()=>{called++;return response}});
 await blocked(x,'TRUST_RUNTIME_UNAVAILABLE');assert.equal(called,0);
});
test('caller injecting verified:true is ignored because probe accepts no parameters',async()=>{
 const x=await fixture()({botId:'attacker',verified:true,owner_id:'owner'});
 assert.equal(x.state,'PROVIDER_ID_OBSERVED_NOT_BOUND');assert.equal(x.can_send,false);
});
