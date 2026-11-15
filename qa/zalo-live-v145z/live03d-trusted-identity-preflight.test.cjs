'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {makeVerifier,normalizeGetMe,REASONS}=require('./live03d-trusted-identity-preflight.cjs');
const now=Date.now();
const BOT='1459232241454765289'; // PUBLIC Zalo API DOCUMENTATION example, not user Bot ID
const SHOP='shop_b_qa', TENANT='tenant_b_qa', CHAT='qa_owner_fixture_nonsensitive';
function setup(mod={}){
 const proof={transport:'SERVER_AUTHENTICATED_PROVIDER_GETME',httpStatus:200,
   body:{ok:true,result:{id:BOT,account_name:'synthetic QA Bot',account_type:'BASIC'}}};
 const mapping={bot_provider:'zalo_bot_creator',bot_id:BOT,identity_status:'verified_provider_id',
   enabled_mode:'limited_qa',synthetic_fixture:false,tenant_id:TENANT,store_id:SHOP};
 const owner={status:'ALLOWED_STAGING_OWNER',chat_id:CHAT,expires_at:new Date(now+600000).toISOString()};
 const d={
  fetchProviderGetMe:async()=>mod.provider===undefined?proof:mod.provider,
  findServerBotMappings:async()=>mod.mappings===undefined?[mapping]:mod.mappings,
  findOwnerAllowlist:async()=>mod.owners===undefined?[owner]:mod.owners,
  verifyOwnerWithProvider:async()=>mod.pair===undefined?{verified:true,source:'TRUSTED_PROVIDER_OWNER_PAIR_ATTESTOR',owner_consent:true,checked_ms:now}:mod.pair,
  hmacKey:Buffer.alloc(32,7),expectedTenantId:TENANT,expectedStoreId:SHOP,
  ...mod.config
 };
 return {run:makeVerifier(d),p:proof,m:mapping,o:owner};
}
async function denied(mod,reason){
 const x=setup(mod);
 const r=await x.run({verified:true,botId:'attacker-controlled'},now);
 assert.equal(r.state,'BLOCKED');
 assert.equal(r.reason,reason);assert.equal(r.can_send,false);assert.equal(r.can_promote_registry,false);
 return r;
}
test('source has no owner Chat ID in result and refuses send even when all mocks pass',async()=>{
 const r=await setup().run({},now);
 assert.equal(r.state,'ELIGIBLE_FOR_SIGNED_CERTIFICATION_ONLY');
 assert.equal(r.verified,true);assert.equal(r.can_send,false);assert.equal(r.can_promote_registry,false);
 assert.equal(r.providerSends,0);assert.equal(r.expires_ms,now+120000);
 assert.match(r.provider_bot_digest,/^[0-9a-f]{64}$/);
 assert.match(r.owner_digest,/^[0-9a-f]{64}$/);
 assert.equal(JSON.stringify(r).includes(CHAT),false);
 assert.equal(JSON.stringify(r).includes(BOT),false);
});
test('getMe official Zalo doc response can be normalized',()=>{
 assert.deepEqual(normalizeGetMe({ok:true,result:{id:BOT,account_name:'bot.example'}}),{botId:BOT});
});
test('getMe malformed id is rejected',()=>assert.equal(normalizeGetMe({ok:true,result:{id:'ABC',account_name:'x'}}),null));
test('getMe without ok=true is rejected',()=>assert.equal(normalizeGetMe({ok:false,result:{id:BOT,account_name:'x'}}),null));
test('no trusted server config blocks',async()=>{
 const r=await makeVerifier({})({},now);assert.equal(r.reason,REASONS.config);
});
test('untrusted provider transport blocks',async()=>{
 const p=setup().p;p.transport='HTTP_USER_SUBMITTED';await denied({provider:p},REASONS.provider);
});
test('provider API status not 200 blocks',async()=>{
 const p=setup().p;p.httpStatus=401;await denied({provider:p},REASONS.provider);
});
test('provider token valid boolean without Bot ID blocks',async()=>{
 const p={transport:'SERVER_AUTHENTICATED_PROVIDER_GETME',httpStatus:200,body:{ok:true,bot_token_valid:true}};
 await denied({provider:p},REASONS.bot);
});
test('getMe malformed provider bot id blocks',async()=>{
 const p=setup().p;p.body.result.id='b';await denied({provider:p},REASONS.bot);
});
test('bot mapping not found blocks',async()=>{await denied({mappings:[]},REASONS.mapping)});
test('two Bot mappings for same identity ambiguous blocks',async()=>{
 const m=setup().m;await denied({mappings:[m,m]},REASONS.mapping);
});
test('synthetic fixture registry rejected',async()=>{
 const m=setup().m;await denied({mappings:[{...m,synthetic_fixture:true}]},REASONS.mapping);
});
test('registry dry run rejected',async()=>{
 const m=setup().m;await denied({mappings:[{...m,enabled_mode:'dry_run'}]},REASONS.mapping);
});
test('registry wrongly marked verified denied',async()=>{
 const m=setup().m;await denied({mappings:[{...m,identity_status:'synthetic_qa'}]},REASONS.mapping);
});
test('wrong provider name denied',async()=>{
 const m=setup().m;await denied({mappings:[{...m,bot_provider:'zalo_bot_fixture'}]},REASONS.mapping);
});
test('getMe ID not equal registry bot id denied',async()=>{
 const m=setup().m;await denied({mappings:[{...m,bot_id:'2459232241454765289'}]},REASONS.mapping);
});
test('cross tenant forbidden',async()=>{
 const m=setup().m;await denied({mappings:[{...m,tenant_id:'tenant_a_qa'}]},REASONS.scope);
});
test('cross shop forbidden',async()=>{
 const m=setup().m;await denied({mappings:[{...m,store_id:'shop_a_qa'}]},REASONS.scope);
});
test('missing Owner allowlist denied',async()=>{await denied({owners:[]},REASONS.owner)});
test('duplicate Owner allowlist denied',async()=>{
 const o=setup().o;await denied({owners:[o,o]},REASONS.owner);
});
test('owner allowlist expired denied',async()=>{
 const o=setup().o;await denied({owners:[{...o,expires_at:new Date(now-1000).toISOString()}]},REASONS.expired);
});
test('owner status not ALLOWED_STAGING_OWNER denied',async()=>{
 const o=setup().o;await denied({owners:[{...o,status:'REVOKED'}]},REASONS.owner);
});
test('owner chat id missing denied',async()=>{
 const o=setup().o;await denied({owners:[{...o,chat_id:''}]},REASONS.owner);
});
test('owner independent provider association missing denied',async()=>{
 await denied({pair:{verified:false,source:'TRUSTED_PROVIDER_OWNER_PAIR_ATTESTOR',owner_consent:true,checked_ms:now}},REASONS.consent);
});
test('owner verified from synthetic client is denied',async()=>{
 await denied({pair:{verified:true,source:'CLIENT_VERIFIED_TRUE',owner_consent:true,checked_ms:now}},REASONS.consent);
});
test('owner explicit consent missing denied',async()=>{
 await denied({pair:{verified:true,source:'TRUSTED_PROVIDER_OWNER_PAIR_ATTESTOR',owner_consent:false,checked_ms:now}},REASONS.consent);
});
test('owner verification too old denied',async()=>{
 await denied({pair:{verified:true,source:'TRUSTED_PROVIDER_OWNER_PAIR_ATTESTOR',owner_consent:true,checked_ms:now-140000}},REASONS.consent);
});
test('callback provider errors fail closed without revealing secrets',async()=>{
 const r=await makeVerifier({
  fetchProviderGetMe:async()=>{throw Error('TOKEN_SHOULD_NEVER_LOG');},
  findServerBotMappings:async()=>[],
  findOwnerAllowlist:async()=>[],
  verifyOwnerWithProvider:async()=>false,
  hmacKey:Buffer.alloc(32,11),expectedTenantId:TENANT,expectedStoreId:SHOP
 })({},now);
 assert.equal(r.state,'BLOCKED');assert.equal(JSON.stringify(r).includes('TOKEN_SHOULD_NEVER_LOG'),false);
});
test('no HMAC key or short key denied',async()=>{
 for(const value of [undefined,Buffer.alloc(5), 'secret']){
  const r=await setup({config:{hmacKey:value}}).run({},now);assert.equal(r.reason,REASONS.config);
 }
});
test('client-supplied fields never replace server trusted ID',async()=>{
 const r=await setup().run({botId:'fake',store_id:'fake',verified:true,owner_chat_id:'fake'},now);
 assert.equal(r.state,'ELIGIBLE_FOR_SIGNED_CERTIFICATION_ONLY');
 assert.equal(r.can_send,false);
});
test('missing provider callback denies before data requests',async()=>{
 const r=await setup({config:{fetchProviderGetMe:null}}).run({},now);
 assert.equal(r.state,'BLOCKED');assert.equal(r.reason,REASONS.config);
});
