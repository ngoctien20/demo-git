'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {randomBytes,createHmac}=require('node:crypto');
const {ACTIONS,MAX_TTL_MS,makeQaRegistry}=require('./advanced-secure-actions.cjs');
function fixture(overrides={}){
 return {tenantId:'qa_tenant_1',storeId:'qa_shop_a',channel:'MESSENGER',actorId:'qa_customer_a',
  sessionId:'qa_session_a',role:'CUSTOMER',identityVerified:true,membershipActive:true,
  channelBindingVerified:true,consentActive:true,entitlementActive:true,
  customerStoreLinkVerified:true,orderOwnershipVerified:true,
  authorizedOrderId:'qa_order_1',authorizedOrderStoreId:'qa_shop_a',
  explicitCustomerConfirmation:true,confirmedDraftId:'qa_draft_1',
  approvedLinkRegistryMatch:true,approvedLinkRef:'qa_link_1',...overrides};
}
function setup(o={}){
 let now=1800000000000;
 const key=randomBytes(32),registry=makeQaRegistry({key,now:()=>now,...o});
 const t=({action='VIEW_CATALOG',context=fixture(),resourceId='qa_product_a001',ttlMs=60000}={})=>
  registry.issueQa({context,action,resourceId,ttlMs});
 return {registry,key,t,clock:(n)=>{now=n},clockValue:()=>now};
}
test('01 action registry has seven explicit entries',()=>assert.equal(Object.keys(ACTIONS).length,7));
test('02 no live send/create/delete execution function',()=>{const x=setup();assert.throws(()=>x.registry.execute(),/NO_SIDE_EFFECTS_IN_QA_REGISTRY/)});
test('03 refuse missing QA cryptographic key',()=>assert.throws(()=>makeQaRegistry(),/QA_EPHEMERAL_KEY_REQUIRED/));
test('04 refuse 31-byte weak key',()=>assert.throws(()=>makeQaRegistry({key:randomBytes(31)}),/QA_EPHEMERAL_KEY_REQUIRED/));
test('05 issue only short-lived synthetic token',()=>{
 const x=setup(),r=x.t();
 assert.equal(r.scope,'DISPOSABLE_QA_ONLY');assert.equal(r.canExecute,false);assert.equal(r.token.split('.').length,3);
});
test('06 inspect receipt without executing',()=>{
 const x=setup(),token=x.t().token,seen=x.registry.inspectAndConsumeQa({token,context:fixture()});
 assert.equal(seen.validatedInDisposableQa,true);assert.equal(seen.canExecute,false);
 assert.equal(seen.durableReplayCertified,false);assert.equal(seen.productionAuthorized,false);
});
test('07 replay is rejected',()=>{
 const x=setup(),token=x.t().token;x.registry.inspectAndConsumeQa({token,context:fixture()});
 assert.throws(()=>x.registry.inspectAndConsumeQa({token,context:fixture()}),/QA_REPLAY_DENIED/);
});
test('08 expired receipt rejected',()=>{
 const x=setup(),token=x.t({ttlMs:1000}).token;
 x.clock(x.clockValue()+1000);
 assert.throws(()=>x.registry.inspectAndConsumeQa({token,context:fixture()}),/QA_TOKEN_EXPIRED_OR_FUTURE/);
});
test('09 time skew > 5sec future rejected',()=>{
 const x=setup(),token=x.t().token;x.clock(x.clockValue()-6000);
 assert.throws(()=>x.registry.inspectAndConsumeQa({token,context:fixture()}),/QA_TOKEN_EXPIRED_OR_FUTURE/);
});
test('10 too-long token validity cannot issue',()=>assert.throws(()=>setup().t({ttlMs:MAX_TTL_MS+1}),/QA_TTL_DENIED/));
test('11 too-short token validity cannot issue',()=>assert.throws(()=>setup().t({ttlMs:0}),/QA_TTL_DENIED/));
test('12 signature mutation rejected',()=>{
 const x=setup(),token=x.t().token;
 const parts=token.split('.'),s=parts[2],bad=parts[0]+'.'+parts[1]+'.'+(s[0]==='A'?'B':'A')+s.slice(1);
 assert.throws(()=>x.registry.inspectAndConsumeQa({token:bad,context:fixture()}),/QA_SIGNATURE_INVALID/);
});
test('13 different key cannot validate token',()=>{
 const x=setup(),y=setup(),token=x.t().token;
 assert.throws(()=>y.registry.inspectAndConsumeQa({token,context:fixture()}),/QA_SIGNATURE_INVALID/);
});
test('14 cross-Store A→B denied even same tenant',()=>{
 const x=setup(),token=x.t().token;
 assert.throws(()=>x.registry.inspectAndConsumeQa({token,context:fixture({storeId:'qa_shop_b'})}),/QA_ACTOR_SCOPE_MISMATCH/);
});
test('15 cross-Tenant denied',()=>{
 const x=setup(),token=x.t().token;
 assert.throws(()=>x.registry.inspectAndConsumeQa({token,context:fixture({tenantId:'qa_tenant_2'})}),/QA_ACTOR_SCOPE_MISMATCH/);
});
test('16 Messenger receipt cannot be used on Zalo Bot',()=>{
 const x=setup(),token=x.t().token;
 assert.throws(()=>x.registry.inspectAndConsumeQa({token,context:fixture({channel:'ZALO_BOT'})}),/QA_ACTOR_SCOPE_MISMATCH/);
});
test('17 Messenger receipt cannot be used on Zalo OA',()=>{
 const x=setup(),token=x.t().token;
 assert.throws(()=>x.registry.inspectAndConsumeQa({token,context:fixture({channel:'ZALO_OA'})}),/QA_ACTOR_SCOPE_MISMATCH/);
});
test('18 other actor cannot use token',()=>{
 const x=setup(),token=x.t().token;
 assert.throws(()=>x.registry.inspectAndConsumeQa({token,context:fixture({actorId:'qa_attacker'})}),/QA_ACTOR_SCOPE_MISMATCH/);
});
test('19 session rotation revokes previous click',()=>{
 const x=setup(),token=x.t().token;
 assert.throws(()=>x.registry.inspectAndConsumeQa({token,context:fixture({sessionId:'qa_session_new'})}),/QA_ACTOR_SCOPE_MISMATCH/);
});
test('20 membership revoked denies even signed token',()=>{
 const x=setup(),token=x.t().token;
 assert.throws(()=>x.registry.inspectAndConsumeQa({token,context:fixture({membershipActive:false})}),/QA_AUTH_CONTEXT_NOT_CERTIFIED/);
});
test('21 consent revoked denies',()=>{
 const x=setup(),token=x.t().token;
 assert.throws(()=>x.registry.inspectAndConsumeQa({token,context:fixture({consentActive:false})}),/QA_AUTH_CONTEXT_NOT_CERTIFIED/);
});
test('22 channel binding revoked denies',()=>{
 const x=setup(),token=x.t().token;
 assert.throws(()=>x.registry.inspectAndConsumeQa({token,context:fixture({channelBindingVerified:false})}),/QA_AUTH_CONTEXT_NOT_CERTIFIED/);
});
test('23 subscription suspended denies',()=>{
 const x=setup(),token=x.t().token;
 assert.throws(()=>x.registry.inspectAndConsumeQa({token,context:fixture({entitlementActive:false})}),/QA_AUTH_CONTEXT_NOT_CERTIFIED/);
});
test('24 identity unverified denies',()=>{
 const x=setup(),token=x.t().token;
 assert.throws(()=>x.registry.inspectAndConsumeQa({token,context:fixture({identityVerified:false})}),/QA_AUTH_CONTEXT_NOT_CERTIFIED/);
});
test('25 customer store identity link missing denies',()=>{
 const x=setup(),token=x.t().token;
 assert.throws(()=>x.registry.inspectAndConsumeQa({token,context:fixture({customerStoreLinkVerified:false})}),/QA_CUSTOMER_STORE_LINK_REQUIRED/);
});
test('26 signed order lookup requires actual customer ownership',()=>{
 const x=setup(),token=x.t({action:'TRACK_ORDER',resourceId:'qa_order_1'}).token;
 assert.throws(()=>x.registry.inspectAndConsumeQa({token,context:fixture({orderOwnershipVerified:false})}),/CUSTOMER_ORDER_OWNERSHIP_REQUIRED/);
});
test('27 cannot issue order lookup for other customer',()=>{
 const x=setup();
 assert.throws(()=>x.t({action:'TRACK_ORDER',resourceId:'qa_order_other',context:fixture({orderOwnershipVerified:false})}),/ORDER_RESOURCE_SCOPE_REQUIRED/);
});
test('28 customer order draft requires explicit confirmation',()=>{
 const x=setup();
 assert.throws(()=>x.t({action:'ORDER_REQUEST_DRAFT',context:fixture({explicitCustomerConfirmation:false})}),/CUSTOMER_CONFIRMATION_REQUIRED/);
});
test('29 signed order draft still cannot actually write order',()=>{
 const x=setup(),token=x.t({action:'ORDER_REQUEST_DRAFT',resourceId:'qa_draft_1'}).token;
 const out=x.registry.inspectAndConsumeQa({token,context:fixture()});assert.equal(out.canExecute,false);
 assert.throws(()=>x.registry.execute(),/NO_SIDE_EFFECTS_IN_QA_REGISTRY/);
});
test('30 verified link action requires trusted registry',()=>{
 const x=setup();
 assert.throws(()=>x.t({action:'OPEN_VERIFIED_LINK',context:fixture({approvedLinkRegistryMatch:false})}),/VERIFIED_LINK_REGISTRY_REQUIRED/);
});
test('31 arbitrary external URL never valid resource ID',()=>{
 const x=setup();
 assert.throws(()=>x.t({action:'OPEN_VERIFIED_LINK',resourceId:'https://evil.example'}),/RESOURCE_REFERENCE_INVALID/);
});
test('32 unknown operation rejected',()=>{
 const x=setup();assert.throws(()=>x.t({action:'DELETE_ORDERS'}),/ACTION_NOT_ALLOWLISTED/);
});
test('33 STAFF cannot request order draft',()=>{
 const x=setup(),c=fixture({role:'STAFF',ownerOrStaffRoleVerified:true});
 assert.throws(()=>x.t({context:c,action:'ORDER_REQUEST_DRAFT'}),/ACTION_ROLE_DENIED/);
});
test('34 STAFF cannot track customer orders',()=>{
 const x=setup(),c=fixture({role:'STAFF',ownerOrStaffRoleVerified:true});
 assert.throws(()=>x.t({context:c,action:'TRACK_ORDER'}),/ACTION_ROLE_DENIED/);
});
test('35 owner must have independent verified role',()=>{
 const x=setup(),c=fixture({role:'OWNER',ownerOrStaffRoleVerified:false});
 assert.throws(()=>x.t({context:c}),/QA_MERCHANT_ROLE_REQUIRED/);
});
test('36 valid verified owner read remains no-side-effects',()=>{
 const x=setup(),c=fixture({role:'OWNER',actorId:'qa_owner_a',ownerOrStaffRoleVerified:true});
 const token=x.t({context:c,action:'TRACK_ORDER',resourceId:'qa_order_1'}).token;
 const check=x.registry.inspectAndConsumeQa({token,context:c});
 assert.equal(check.canExecute,false);assert.equal(check.storeId,'qa_shop_a');
});
test('37 role change invalidates issued token',()=>{
 const x=setup(),token=x.t().token;
 const owner=fixture({role:'OWNER',ownerOrStaffRoleVerified:true});
 assert.throws(()=>x.registry.inspectAndConsumeQa({token,context:owner}),/QA_ACTOR_SCOPE_MISMATCH/);
});
test('38 unverified tenant/store/actor invalid format rejected',()=>{
 const x=setup();
 for(const patch of [{tenantId:'bad tenant'},{storeId:'..evil/path'},{actorId:'john@example.com'}])
  assert.throws(()=>x.t({context:fixture(patch)}),/QA_SCOPE_INVALID/);
});
test('39 token with valid signature but extra fields refused',()=>{
 const x=setup(),token=x.t().token;
 const parts=token.split('.');
 const obj=JSON.parse(Buffer.from(parts[1],'base64url').toString());
 obj.redirect='https://evil.example';
 parts[1]=Buffer.from(JSON.stringify(obj)).toString('base64url');
 parts[2]=createHmac('sha256',x.key).update(parts[0]+'.'+parts[1]).digest('base64url');
 assert.throws(()=>x.registry.inspectAndConsumeQa({token:parts.join('.'),context:fixture()}),/QA_TOKEN_FIELDS_INVALID/);
});
test('40 token header changed rejected',()=>{
 const x=setup(),token=x.t().token;
 assert.throws(()=>x.registry.inspectAndConsumeQa({token:'eyFake.'+token.split('.').slice(1).join('.'),context:fixture()}),/QA_TOKEN_HEADER_INVALID/);
});
test('41 without durable DB ledger source cannot certify replay',()=>{
 const x=setup();assert.equal(x.registry.inspect().usesPersistentReplay,false);
 assert.equal(x.registry.inspect().productionAuthorized,false);
});
test('42 ledger capacity fails CLOSED',()=>{
 const x=setup({maxSeen:1}),a=x.t(),b=x.t();
 x.registry.inspectAndConsumeQa({token:a.token,context:fixture()});
 assert.throws(()=>x.registry.inspectAndConsumeQa({token:b.token,context:fixture()}),/QA_REPLAY_LEDGER_FULL/);
});
test('43 expired consumed receipts purged before new one',()=>{
 const x=setup({maxSeen:1});const a=x.t({ttlMs:1000});
 x.registry.inspectAndConsumeQa({token:a.token,context:fixture()});
 x.clock(x.clockValue()+1001);const b=x.t();
 const result=x.registry.inspectAndConsumeQa({token:b.token,context:fixture()});
 assert.equal(result.replayConsumed,true);assert.equal(x.registry.inspect().ledgerSize,1);
});
test('44 malformed token cannot crash process',()=>{
 const x=setup();for(const t of ['','abc','a.b.c','.$%..','x'.repeat(2100)])
 assert.throws(()=>x.registry.inspectAndConsumeQa({token:t,context:fixture()}));
});
test('45 synthetic signing key is generated only in QA runtime',()=>{
 const x=setup();assert.equal(x.key.byteLength,32);assert.equal(x.registry.inspect().providerSends,0);
});
test('46 no secrets returned from receipt inspection',()=>{
 const x=setup(),token=x.t().token;
 const result=x.registry.inspectAndConsumeQa({token,context:fixture()});
 assert.equal(result.token,undefined);assert.equal(result.key,undefined);
});
test('47 true verification must not produce provider send or order write',()=>{
 const x=setup(),token=x.t().token;x.registry.inspectAndConsumeQa({token,context:fixture()});
 assert.equal(x.registry.inspect().providerSends,0);assert.equal(x.registry.inspect().orderWrites,0);
});
test('48 unsupported channel cannot issue',()=>{
 const x=setup();assert.throws(()=>x.t({context:fixture({channel:'TELEGRAM'})}),/QA_CHANNEL_INVALID/);
});
test('49 even signed Owner cannot query order of other Shop under same tenant',()=>{
 const x=setup(),owner=fixture({role:'OWNER',actorId:'qa_owner_a',ownerOrStaffRoleVerified:true,
 authorizedOrderId:'qa_order_b',authorizedOrderStoreId:'qa_shop_b'});
 assert.throws(()=>x.t({context:owner,action:'TRACK_ORDER',resourceId:'qa_order_b'}),/ORDER_RESOURCE_SCOPE_REQUIRED/);
});
test('50 valid customer cannot swap in a different orderId',()=>{
 const x=setup(),c=fixture({orderOwnershipVerified:true,authorizedOrderId:'qa_order_1'});
 assert.throws(()=>x.t({context:c,action:'TRACK_ORDER',resourceId:'qa_order_else'}),/ORDER_RESOURCE_SCOPE_REQUIRED/);
});
test('51 a confirmed draft receipt cannot act on another draft',()=>{
 const x=setup();
 assert.throws(()=>x.t({action:'ORDER_REQUEST_DRAFT',resourceId:'qa_draft_other'}),/CONFIRMED_DRAFT_SCOPE_REQUIRED/);
});
test('52 approved link receipt uses opaque internal ref only',()=>{
 const x=setup(),token=x.t({action:'OPEN_VERIFIED_LINK',resourceId:'qa_link_1'}).token;
 const out=x.registry.inspectAndConsumeQa({token,context:fixture()});
 assert.equal(out.canExecute,false);assert.equal(out.resourceId,'qa_link_1');
});
test('53 a different link ref cannot be opened just because domain was approved',()=>{
 const x=setup();
 assert.throws(()=>x.t({action:'OPEN_VERIFIED_LINK',resourceId:'qa_link_2'}),/APPROVED_LINK_RESOURCE_SCOPE_REQUIRED/);
});
