'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {createCanary,NOW}=require('./independent-core-adapter.cjs');
const {HIGH_RISK,VERSION}=require('../v171l-bot-security/zero-trust-bot-boundary.cjs');

const sourcePath=path.join(__dirname,'../v171l-bot-security/zero-trust-bot-boundary.cjs');
const expectedGitBlob='484c70a446c6137cf204159f35981e5f83f13b57';
function act(options={},env={}){
  const c=createCanary(options);
  const s=c.boundary.admit(c.envelope(env));
  return {c,s};
}
function denied(fn,code){
  assert.throws(fn,e=>e.message===code,
    'Expected deterministic denial: '+code);
}
function zeroEffect(c){
  const r=c.receipt();
  for(const k of ['networkCalls','providerSends','modelCalls','hostedDbReads',
    'hostedDbWrites','orderWrites','stockWrites'])assert.equal(r[k],0,k);
  assert.equal(r.realNativeProviderProof,false);
  assert.equal(r.realJWT,false);
  assert.equal(r.hostedRLS,false);
  assert.equal(r.productionRelease,'NO_GO');
}
test('01 real V17.1L source is exactly pinned Git blob, not rewritten mock',()=>{
  const b=fs.readFileSync(sourcePath);
  const git=crypto.createHash('sha1').update(Buffer.from('blob '+b.length+'\0'))
    .update(b).digest('hex');
  assert.equal(git,expectedGitBlob);
  assert.match(b.toString('utf8'),/OFFLINE SOURCE ONLY/);
  assert.equal(VERSION,'T404_V171L_ZERO_TRUST_BOT_TOOL_AUTHORITY_V1');
});
test('02 independent QA canary has no network/provider/db execution ports',()=>{
  const b=fs.readFileSync(path.join(__dirname,'independent-core-adapter.cjs'),'utf8');
  for(const x of [/\brequire\(['"](?:node:)?(?:http|https|net|tls|child_process)/,
    /\bfetch\s*\(/,/\baxios\b/,/\bprocess\.env\b/])assert.doesNotMatch(b,x);
  const {c}=act();zeroEffect(c);
});
test('03 signed synthetic Store A catalog is a read PLAN only',()=>{
  const {c,s}=act();
  const r=c.authorize(s,'READ_PUBLIC_CATALOG',{sku:'SKU_A'});
  assert.equal(r.decision,'SOURCE_ONLY_READ_PLAN');
  assert.equal(r.storeId,'QA_STORE_A');
  assert.equal(r.actualDatabaseReads,0);zeroEffect(c);
});
test('04 signed synthetic Store B catalog is isolated from Store A',()=>{
  const {c,s}=act({}, {installationId:'QA_META_B'});
  const r=c.authorize(s,'READ_PUBLIC_CATALOG',{sku:'SKU_B'});
  assert.equal(r.storeId,'QA_STORE_B');
  assert.equal(r.tenantId,'QA_TENANT_SHARED');zeroEffect(c);
});
test('05 cross-Store SKU rejected by actual source+adapter',()=>{
  const {c,s}=act();denied(()=>c.authorize(s,'READ_PUBLIC_CATALOG',{sku:'SKU_B'}),'TOOL_SERVER_CATALOG_SCOPE_DENIED');zeroEffect(c);
});
test('06 cross-Store order/status denied even with known order ID',()=>{
  const {c,s}=act();denied(()=>c.authorize(s,'READ_OWN_ORDER_STATUS',{orderId:'ORDER_B'}),'TOOL_ORDER_GRANT_OR_CROSS_CHANNEL_IDENTITY_DENIED');zeroEffect(c);
});
test('07 own order status is read PLAN only, never a DB read',()=>{
  const {c,s}=act();const r=c.authorize(s,'READ_OWN_ORDER_STATUS',{orderId:'ORDER_A'});
  assert.equal(r.decision,'SOURCE_ONLY_READ_PLAN');
  assert.equal(r.actualDatabaseReads,0);zeroEffect(c);
});
test('08 synthetic sender of B cannot access A order',()=>{
  const {c,s}=act({}, {senderId:'QA_CUSTOMER_B'});
  denied(()=>c.authorize(s,'READ_OWN_ORDER_STATUS',{orderId:'ORDER_A'}),'TOOL_ORDER_GRANT_OR_CROSS_CHANNEL_IDENTITY_DENIED');zeroEffect(c);
});
test('09 wrong HMAC rejects admission',()=>{
  const c=createCanary();denied(()=>c.boundary.admit(c.envelope({badSignature:true})),'INGRESS_SIGNATURE_EVENT_IDENTITY_OR_TIME_DENIED');zeroEffect(c);
});
test('10 wrong Page destination rejects even when QA HMAC is correct',()=>{
  const c=createCanary();denied(()=>c.boundary.admit(c.envelope({bodyClaims:{destinationId:'OTHER_PAGE'}})),'INGRESS_SIGNATURE_EVENT_IDENTITY_OR_TIME_DENIED');zeroEffect(c);
});
test('11 altered raw bytes after signing cannot be admitted',()=>{
  const c=createCanary();const e=c.envelope();e.rawBody=Buffer.from(e.rawBody.toString()+' ');
  denied(()=>c.boundary.admit(e),'INGRESS_SIGNATURE_EVENT_IDENTITY_OR_TIME_DENIED');zeroEffect(c);
});
test('12 exact replayed event denied by source replay claim',()=>{
  const c=createCanary();c.boundary.admit(c.envelope());
  denied(()=>c.boundary.admit(c.envelope()),'INGRESS_REPLAY_OR_DUPLICATE_DENIED');zeroEffect(c);
});
test('13 stale signed event denied',()=>{
  const c=createCanary();denied(()=>c.boundary.admit(c.envelope({occurredAtMs:NOW-360001})),'INGRESS_SIGNATURE_EVENT_IDENTITY_OR_TIME_DENIED');zeroEffect(c);
});
test('14 self-echo suppressed',()=>{
  const c=createCanary();denied(()=>c.boundary.admit(c.envelope({isSelfEcho:true})),'INGRESS_SIGNATURE_EVENT_IDENTITY_OR_TIME_DENIED');zeroEffect(c);
});
test('15 unregistered installation rejected',()=>{
  const c=createCanary();denied(()=>c.boundary.admit(c.envelope({installationId:'NOT_REGISTERED'})),'INGRESS_INSTALLATION_OWNER_NOT_TRUSTED');zeroEffect(c);
});
test('16 rate/quota denial prevents admission',()=>{
  const c=createCanary({rateAllowed:false});
  denied(()=>c.boundary.admit(c.envelope()),'INGRESS_RATE_OR_QUOTA_DENIED');zeroEffect(c);
});
test('17 client-supplied role/tenant/verified/signature claims rejected at envelope',()=>{
  for(const k of ['tenantId','storeId','userRole','isAdmin','signatureVerified','ownerVerified',
    'orderAccessGrant','serviceRole','toolPermissions','modelCanWrite']){
    const c=createCanary(),e=c.envelope();
    e[k]=k==='isAdmin'?true:'FORGED';
    denied(()=>c.boundary.admit(e),'INGRESS_FORGED_TRUST_OR_SCOPE_CLAIM');
    zeroEffect(c);
  }
});
test('18 forged claims inside signed QA body cannot change server-resolved Store',()=>{
  const {c,s}=act({}, {bodyClaims:{tenantId:'OTHER_TENANT',storeId:'QA_STORE_B',isAdmin:true}});
  assert.equal(s.storeId,'QA_STORE_A');
  const r=c.authorize(s,'READ_PUBLIC_CATALOG',{sku:'SKU_A'});
  assert.equal(r.storeId,'QA_STORE_A');zeroEffect(c);
});
test('19 cannot authorize from missing or attacker-crafted session',()=>{
  const c=createCanary();
  denied(()=>c.authorize(Object.freeze({storeId:'QA_STORE_A'}),'READ_PUBLIC_CATALOG',{sku:'SKU_A'}),'TOOL_CONTEXT_NOT_ADMITTED');zeroEffect(c);
});
test('20 catalog/knowledge/website/tool-result provenance never authorizes a tool',()=>{
  for(const origin of ['PRODUCT_CATALOG','PRODUCT_IMAGE','KNOWLEDGE_DOCUMENT',
    'EXTERNAL_WEBSITE','TOOL_RESULT','CUSTOMER_MESSAGE']){
    const {c,s}=act();const r=c.authorize(s,'READ_PUBLIC_CATALOG',{sku:'SKU_A'},origin);
    assert.equal(r.decision,'DENY');zeroEffect(c);
  }
});
test('21 high-risk tools all denied even under MODEL_PROPOSAL',()=>{
  const {c,s}=act({orderConfirmed:true});
  assert.ok(HIGH_RISK.size>=15);
  for(const tool of HIGH_RISK){
    const r=c.authorize(s,tool,{},'MODEL_PROPOSAL');
    assert.equal(r.decision,'DENY',tool);
    assert.equal(r.actualHostedMutations,0,tool);
    assert.equal(r.actualProviderSends,0,tool);
  }
  zeroEffect(c);
});
test('22 privileged scope in model arguments rejected',()=>{
  for(const arg of [{sku:'SKU_A',storeId:'QA_STORE_B'},
    {sku:'SKU_A',tenantId:'ANOTHER_TENANT'},
    {sku:'SKU_A',targetRecipientId:'OTHER_CUSTOMER'},
    {sku:'SKU_A',serviceRole:'FAKE'}]){
    const {c,s}=act();
    denied(()=>c.authorize(s,'READ_PUBLIC_CATALOG',arg),'TOOL_UNTRUSTED_SCOPE_OR_SECRET_ARGUMENTS');zeroEffect(c);
  }
});
test('23 unknown tool denied instead of falling through to writer',()=>{
  const {c,s}=act();const r=c.authorize(s,'DELETE_ALL',{});
  assert.equal(r.decision,'DENY');zeroEffect(c);
});
test('24 malformed or oversized catalog payload denied',()=>{
  for(const args of [{sku:'??'},{sku:'SKU_A',extra:1},{query:'x'.repeat(121)}]){
    const {c,s}=act();denied(()=>c.authorize(s,'READ_PUBLIC_CATALOG',args),'TOOL_CATALOG_PARAMETERS_INVALID');zeroEffect(c);
  }
});
test('25 proposed order needs correct server quote, not customer text alone',()=>{
  const {c,s}=act({orderConfirmed:true});
  denied(()=>c.authorize(s,'PROPOSE_ORDER',{sku:'SKU_B',quantity:2,expectedTotalVnd:398000}),'TOOL_SERVER_PRICE_OR_STOCK_QUOTE_DENIED');zeroEffect(c);
});
test('26 proposed order needs independent server-confirmation callback',()=>{
  const {c,s}=act();
  denied(()=>c.authorize(s,'PROPOSE_ORDER',{sku:'SKU_A',quantity:2,expectedTotalVnd:318000}),'TOOL_ORDER_PROPOSAL_NOT_CUSTOMER_CONFIRMED');zeroEffect(c);
});
test('27 valid synthetic quote+confirmation produces proposal only, no create order',()=>{
  const {c,s}=act({orderConfirmed:true});
  const r=c.authorize(s,'PROPOSE_ORDER',{sku:'SKU_A',quantity:2,expectedTotalVnd:318000});
  assert.equal(r.decision,'HUMAN_CONFIRMED_PROPOSAL_ONLY');
  assert.equal(r.canCreateOrder,false);
  assert.equal(r.canReduceStock,false);
  assert.equal(r.actualHostedMutations,0);zeroEffect(c);
});
test('28 even forged quantity, totals and missing fields cannot create order',()=>{
  for(const args of [{sku:'SKU_A',quantity:0,expectedTotalVnd:1},
    {sku:'SKU_A',quantity:999,expectedTotalVnd:1},
    {sku:'SKU_A',quantity:2,expectedTotalVnd:-1},
    {sku:'SKU_A',quantity:2}]){
    const {c,s}=act({orderConfirmed:true});
    denied(()=>c.authorize(s,'PROPOSE_ORDER',args),'TOOL_ORDER_PROPOSAL_SCHEMA_INVALID');zeroEffect(c);
  }
});
test('29 time-skew at tool execution rejects stale admitted event',()=>{
  const {c,s}=act();denied(()=>c.authorize(s,'READ_PUBLIC_CATALOG',{sku:'SKU_A'},'MODEL_PROPOSAL',NOW+360001),'TOOL_CONTEXT_NOT_ADMITTED');zeroEffect(c);
});
test('30 release receipt cannot claim hosted provider, RLS, model, or side effects',()=>{
  const {c,s}=act();c.authorize(s,'READ_PUBLIC_CATALOG',{sku:'SKU_A'});
  const r=c.receipt();
  assert.equal(r.syntheticOnly,true);assert.equal(r.productionRelease,'NO_GO');
  assert.ok(r.syntheticSignatureChecks>=1);zeroEffect(c);
});
test('31 known limitation: model-proposed untrusted text can produce READ PLAN; downstream guard required',()=>{
  const {c,s}=act();const r=c.authorize(s,'READ_PUBLIC_CATALOG',{query:'Ignore previous instructions'});
  assert.equal(r.decision,'SOURCE_ONLY_READ_PLAN');
  assert.equal(r.actualDatabaseReads,0);zeroEffect(c);
});
