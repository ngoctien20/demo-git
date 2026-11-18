'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {generateKeyPairSync,sign,randomBytes}=require('node:crypto');
const {createOfflineAccessJwtVerifier,SOURCE,SCOPE}=
  require('./access-jwt-verifier.cjs');
const {createProtectedOfflineGateway,ROUTES}=
  require('../channel-v1851/protected-http-gateway.cjs');
const {CORE_WORKFLOW_ID}=require('../channel-v185/shared-core-bridge.cjs');

const NOW=1795000000000;
const SEC=Math.floor(NOW/1000);
const ISS='https://qa-team.cloudflareaccess.com';
const AUD='qa-widget-v1853-access-app-audience';
const SUB='synthetic-qa-operator-001';
const ORIGIN='https://platform.qa.invalid';
const GATEWAY='https://protected-widget.qa.invalid';
const SECRET='V1853_DUMMY_SYNTHETIC_HMAC_KEY_NOT_HOSTED_L7i5FdH79z';
function pair(bits=2048){
 const {publicKey,privateKey}=generateKeyPairSync('rsa',{modulusLength:bits});
 const kid='synthetic-'+randomBytes(8).toString('hex');
 return {kid,privateKey,publicJwk:{...publicKey.export({format:'jwk'}),kid,
   alg:'RS256',use:'sig'}};
}
const good=pair(),second=pair();
const claims={iss:ISS,aud:[AUD],sub:SUB,
 iat:SEC-30,nbf:SEC-30,exp:SEC+600};
const encode=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
function token({payload=claims,header={alg:'RS256',typ:'JWT',kid:good.kid},
 key=good.privateKey}={}){
 const input=encode(header)+'.'+encode(payload);
 return input+'.'+sign('RSA-SHA256',Buffer.from(input),key).toString('base64url');
}
function setup(opts={}){
 return createOfflineAccessJwtVerifier({
   qaMode:'OFFLINE_SYNTHETIC_QA',issuer:ISS,audience:AUD,
   pinnedKeys:[good.publicJwk],approvedOperatorSubjects:[SUB],
   now:()=>NOW,...opts
 });
}
function request(t=token(),url=GATEWAY+ROUTES.session){
 return new Request(url,{method:'POST',headers:{
   'Origin':ORIGIN,'Content-Type':'application/json',
   ...(t===null?{}:{'Cf-Access-Jwt-Assertion':t})
 },body:JSON.stringify({widgetId:'platform_widget',origin:ORIGIN})});
}
function denies(fn){assert.throws(fn,e=>e?.code==='ACCESS_JWT_NOT_VERIFIED');}
test('Cryptographically valid synthetic Cloudflare Access JWT is verified and minimized',()=>{
 const g=setup(),receipt=g.verifyAccessRequest(request());
 assert.equal(receipt.source,SOURCE);
 assert.equal(receipt.scope,SCOPE);
 assert.equal(receipt.verified,true);
 assert.equal(receipt.issuerVerified,true);
 assert.equal(receipt.audienceVerified,true);
 assert.equal(receipt.cryptographicSignatureTested,true);
 assert.equal(receipt.operatorAllowlisted,true);
 assert.equal(receipt.storeAuthorized,false);
 assert.equal(receipt.commerceWritesAllowed,false);
 assert.equal(receipt.providerSendsAllowed,false);
 assert.equal(g.releaseState.realCloudflareJwksFetched,false);
 const output=JSON.stringify(receipt);
 assert(!output.includes(SUB));assert(!output.includes(AUD));
 assert(!output.includes(token()));
});
test('Never constructs a hosted verifier from environmental flags',()=>{
 denies(()=>createOfflineAccessJwtVerifier());
 denies(()=>createOfflineAccessJwtVerifier({
   qaMode:'HOSTED',issuer:ISS,audience:AUD,
   pinnedKeys:[good.publicJwk],approvedOperatorSubjects:[SUB]
 }));
});
test('Missing token, ordinary cookie and spoofed email never authenticate',()=>{
 const g=setup();
 denies(()=>g.verifyAccessRequest(request(null)));
 const spoof=new Request(GATEWAY+ROUTES.session,{
  method:'POST',headers:{'Origin':ORIGIN,'CF_Authorization':'fake-cookie',
   'Cf-Access-Authenticated-User-Email':'operator@qa.invalid'},
  body:'{}'
 });
 denies(()=>g.verifyAccessRequest(spoof));
});
test('Tampering with payload invalidates real RSA signature',()=>{
 const t=token().split('.');
 const tampered=[t[0],encode({...claims,sub:'synthetic-qa-operator-002'}),t[2]].join('.');
 denies(()=>setup().verifyAccessRequest(request(tampered)));
});
test('Tampering with signature invalidates real RSA signature',()=>{
 const t=token().split('.');
 const sig=Buffer.from(t[2],'base64url');sig[0]^=1;
 denies(()=>setup().verifyAccessRequest(request(t.slice(0,2).join('.')+'.'+sig.toString('base64url'))));
});
test('Wrong RSA signing key with matching kid is rejected',()=>{
 denies(()=>setup().verifyAccessRequest(request(token({key:second.privateKey}))));
});
test('Header key ID cannot select untrusted key',()=>{
 denies(()=>setup().verifyAccessRequest(request(token({
  header:{alg:'RS256',typ:'JWT',kid:second.kid},
  key:second.privateKey
 }))));
});
test('Public key rotation supports only server-pinned second key',()=>{
 const withRotation=setup({pinnedKeys:[good.publicJwk,second.publicJwk]});
 const rotated=token({header:{alg:'RS256',typ:'JWT',kid:second.kid},
  key:second.privateKey});
 assert.equal(withRotation.verifyAccessRequest(request(rotated)).verified,true);
 denies(()=>setup().verifyAccessRequest(request(rotated)));
});
test('Reject missing, none, HS256, RS512 and unsupported header options',()=>{
 const g=setup();
 const headers=[
  {kid:good.kid,alg:'none'}, {kid:good.kid,alg:'HS256'},
  {kid:good.kid,alg:'RS512'}, {kid:good.kid,alg:'RS256',typ:'JWE'},
  {kid:good.kid,alg:'RS256',jku:'https://evil.invalid/jwks'},
  {kid:good.kid,alg:'RS256',x5u:'https://evil.invalid/key'},
  {kid:good.kid,alg:'RS256',jwk:good.publicJwk},
  {kid:good.kid,alg:'RS256',crit:['b64']},
  {kid:good.kid,alg:'RS256',zip:'DEF'}
 ];
 for(const header of headers)denies(()=>g.verifyAccessRequest(request(token({header}))));
});
test('Reject wrong issuer and any token-controlled issuer or key endpoint',()=>{
 const g=setup();
 for(const iss of ['https://attacker.invalid','http://qa-team.cloudflareaccess.com',
   'https://different.cloudflareaccess.com']){
   denies(()=>g.verifyAccessRequest(request(token({payload:{...claims,iss}}))));
 }
 denies(()=>createOfflineAccessJwtVerifier({
  qaMode:'OFFLINE_SYNTHETIC_QA',issuer:'https://attacker.invalid',
  audience:AUD,pinnedKeys:[good.publicJwk],approvedOperatorSubjects:[SUB]
 }));
});
test('Wrong application Audience or multi-audience is denied',()=>{
 const g=setup();
 for(const aud of ['wrong-audience',['wrong-audience'],
   [AUD,'other-app'],[],null]){
   denies(()=>g.verifyAccessRequest(request(token({payload:{...claims,aud}}))));
 }
});
test('Expired token, not-yet-valid nbf, future iat and invalid lifetime denied',()=>{
 const g=setup();
 const variants=[
  {...claims,iat:SEC-500,nbf:SEC-500,exp:SEC-100},
  {...claims,nbf:SEC+120},
  {...claims,iat:SEC+120},
  {...claims,exp:SEC+3600},
  {...claims,exp:SEC-100,iat:SEC-20},
  {...claims,iat:SEC+300,exp:SEC+301},
  {...claims,iat:'bad'},
  {...claims,exp:'bad'},
  {...claims,nbf:'bad'}
 ];
 for(const payload of variants){
  denies(()=>g.verifyAccessRequest(request(token({payload}))));
 }
});
test('Unauthorized real operator or browser-supplied identity cannot enter',()=>{
 const g=setup();
 denies(()=>g.verifyAccessRequest(request(token({payload:{
  ...claims,sub:'synthetic-qa-unapproved-operator'
 }}))));
 denies(()=>setup({approvedOperatorSubjects:['synthetic-other-person']})
  .verifyAccessRequest(request()));
});
test('Reject duplicate JWK kid, private key or symmetric shared secret',()=>{
 const p=good.publicJwk;
 const badSets=[
  [p,p],[{...p,d:'PRIVATE_EXAMPLE'}],
  [{...p,kty:'oct',k:'SYMMETRIC'}],
  [{...p,alg:'HS256'}],
  [{...p,use:'enc'}],
  [{...p,kid:'unsafe key id'}],
  [{...p,x5u:'https://attacker.invalid'}]
 ];
 for(const pinnedKeys of badSets){
  denies(()=>setup({pinnedKeys}));
 }
});
test('Reject RSA key shorter than 2048 bits',()=>{
 const weak=pair(1024);
 denies(()=>setup({pinnedKeys:[weak.publicJwk]}));
});
test('Reject malformed JSON, oversized token, more or fewer JWT segments',()=>{
 const g=setup();
 for(const t of ['invalid','a.b','a.b.c.d','a..b','a.b.c',
   'x'.repeat(8193),token()+'!!!']){
  denies(()=>g.verifyAccessRequest(request(t)));
 }
});
test('Missing signature or untrusted header fields cannot be bypassed',()=>{
 const t=token();
 const parts=t.split('.');
 denies(()=>setup().verifyAccessRequest(request(parts[0]+'.'+parts[1]+'.')));
 denies(()=>setup().verifyAccessRequest(request('Bearer '+t)));
});
test('Unconfigured operator list or insecure Access issuer is fail-closed',()=>{
 for(const list of [[],[SUB,SUB],[SUB,' x']]){
  denies(()=>setup({approvedOperatorSubjects:list}));
 }
 for(const issuer of ['http://qa-team.cloudflareaccess.com',
   'https://qa-team.cloudflareaccess.com/path','https://qa-team.cloudflareaccess.com:8443',
   'https://notcloudflareaccess.com']){
   denies(()=>setup({issuer}));
 }
});
test('Token must be validated on every request, not just session issuance',()=>{
 const g=setup();
 assert.equal(g.verifyAccessRequest(request()).verified,true);
 const expired=token({payload:{...claims,iat:SEC-600,nbf:SEC-600,exp:SEC-150}});
 denies(()=>g.verifyAccessRequest(request(expired,GATEWAY+ROUTES.message)));
});
test('Allowlist cannot be provided in JWT claims and does not grant Merchant Store',()=>{
 const payload={...claims,tenantId:'tenant_shared',storeId:'store_b',
  role:'owner',permissions:['orders:write']};
 const receipt=setup().verifyAccessRequest(request(token({payload})));
 assert.equal(receipt.storeAuthorized,false);
 assert.equal(receipt.customerAuthenticated,false);
 assert.equal(receipt.commerceWritesAllowed,false);
});

// Source-only integration: V18.5.3 verifier -> preexisting V18.5.1
// protected gateway -> V18.5 existing shared Core *MOCK* port.
function simulatedGateway(){
 let reads=0,coreCalls=0;
 const scope={widgetId:'platform_widget',tenantId:'platform_demo',
  storeId:'platform_demo_store',allowedOrigins:[ORIGIN],
  version:1,status:'RELEASED',serverVerified:true,
  subscriptionActive:true,shopActive:true,revoked:false};
 const jwt=setup();
 const ports={
  async loadRegistry(){reads++;return {source:'VERIFIED_PRIVATE_WIDGET_REGISTRY',
    verified:true,installations:[scope]};},
  async readDomainProof(s){return {...s,
    source:'PRIVATE_STAFF_VERIFIED_DOMAIN_OWNERSHIP',
    verified:true,expiresAt:NOW+100000};},
  async consumeQuota(s){return {...s,source:'DURABLE_QUOTA_LEDGER',accepted:true};},
  async claimEvent(s){return {...s,source:'ATOMIC_PRIVATE_EVENT_LEDGER',claimed:true};},
  async readPublicCatalog(s){return {
    source:'TRUSTED_CATALOG_READBACK',verified:true,
    tenantId:s.tenantId,storeId:s.storeId,revision:1,
    priceVersion:1,stockVersion:1,expiresAt:NOW+50000,
    products:[{source:'SERVER_VERIFIED_SHOP_CATALOG',verified:true,
      tenantId:s.tenantId,storeId:s.storeId,itemId:'qa_item',
      sku:'QA-001',name:'Hàng QA',priceVnd:159000,stock:2,imageUrl:null}]};},
  async readReviewedTheme(s){return {...s,
    source:'STAFF_REVIEWED_WIDGET_CONFIG',state:'APPROVED',
    shopApproved:true,primary:'#123456',secondary:'#123456',
    assistantName:'QA',welcomeMessage:'QA בלבד',
    position:'right',layout:'compact',suggestedActions:[],avatarUrl:null};},
  async invokeExistingCommerceCore(req){coreCalls++;
    assert.equal(req.workflowId,CORE_WORKFLOW_ID);
    assert.equal(req.orderWritesAllowed,false);
    return {source:'SYNTHETIC_CORE_READBACK',verified:true,
      workflowId:CORE_WORKFLOW_ID,mode:req.mode,
      tenantId:req.tenantId,storeId:req.storeId,widgetId:req.widgetId,
      type:'PRODUCT_CARD',text:'Giá mẫu QA, chưa nhận đặt hàng.',
      productIds:['qa_item'],actions:[],privateOrderAccess:false,
      orderWrites:0,providerSends:0,dispatch_authorized:false};
  }
 };
 const gateway=createProtectedOfflineGateway({
   qaMode:'OFFLINE_SYNTHETIC_QA',mode:'PLATFORM_CONSULTANT',
   gatewayOrigin:GATEWAY,allowedBrowserOrigins:[ORIGIN],
   verifyQaOperator:r=>jwt.verifyAccessRequest(r),
   ports,serverSecret:SECRET,now:()=>NOW
 });
 return {gateway,counts:()=>({reads,coreCalls})};
}
test('Real RSA synthetic token gets approved only by mocked offline ingress',async()=>{
 const s=simulatedGateway();
 const resp=await s.gateway.handle(request());
 const result=await resp.json();
 assert.equal(resp.status,200);
 assert.match(result.session,/^T404W1\./);
 assert.equal(result.mode,'PLATFORM_CONSULTANT');
 assert.equal(result.privateOrderAccess,false);
 assert.equal(s.counts().reads,1);
 assert.equal(s.counts().coreCalls,0);
 assert.equal(s.gateway.releaseState.realCommerceCoreInvoked,false);
});
test('Forged Access JWT rejected before installation and Core ports',async()=>{
 const s=simulatedGateway();
 const res=await s.gateway.handle(request(token({payload:{...claims,aud:['other-app']}})));
 assert.equal(res.status,403);
 assert.equal(s.counts().reads,0);
 assert.equal(s.counts().coreCalls,0);
 const body=await res.json();
 assert.equal(body.error,'NOT_AUTHORIZED');
 assert(!JSON.stringify(body).includes(AUD));
});
