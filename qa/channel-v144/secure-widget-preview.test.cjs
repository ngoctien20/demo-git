'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createOfflineWidgetPreview}=require('./secure-widget-preview.cjs');
const SECRET='ti404-offline-widget-qa-secret-not-a-hosted-key-xyz-123';
const NOW=1794750000000;
const entries=[
 {widgetId:'widget_a',tenantId:'tenant_shared',storeId:'store_a',
  allowedOrigins:['https://shop-a.qa.invalid'],version:1,status:'RELEASED',
  serverVerified:true,subscriptionActive:true,shopActive:true,revoked:false},
 {widgetId:'widget_b',tenantId:'tenant_shared',storeId:'store_b',
  allowedOrigins:['https://shop-b.qa.invalid'],version:1,status:'RELEASED',
  serverVerified:true,subscriptionActive:true,shopActive:true,revoked:false},
 {widgetId:'widget_c',tenantId:'tenant_other',storeId:'store_c',
  allowedOrigins:['https://shop-c.qa.invalid'],version:1,status:'RELEASED',
  serverVerified:true,subscriptionActive:true,shopActive:true,revoked:false}
];
const originOf=x=>'https://shop-'+x+'.qa.invalid';
function setup({now=NOW,ledger=new Set(),changes={},intentForStore=null}={}){
 const clone=()=>entries.map(x=>({...x,allowedOrigins:[...x.allowedOrigins]}));
 const list=clone();
 const counts={registry:0,domain:0,quota:0,claim:0,catalog:0,model:0,writes:0};
 const ports={
  async loadRegistry(){counts.registry++;return {
    source:'VERIFIED_PRIVATE_WIDGET_REGISTRY',verified:true,
    installations:list};},
  async readDomainProof(scope){counts.domain++;
    return {source:'PRIVATE_STAFF_VERIFIED_DOMAIN_OWNERSHIP',verified:true,
      ...scope,expiresAt:now+3600000};},
  async consumeQuota(scope){counts.quota++;return {
    source:'DURABLE_QUOTA_LEDGER',accepted:true,...scope};},
  async claimEvent(scope){counts.claim++;
    if(ledger.has(scope.eventDigest))return {
      source:'ATOMIC_PRIVATE_EVENT_LEDGER',claimed:false,...scope};
    ledger.add(scope.eventDigest);
    return {source:'ATOMIC_PRIVATE_EVENT_LEDGER',claimed:true,...scope};},
  async readPublicCatalog(scope){counts.catalog++;
    return {source:'TRUSTED_CATALOG_READBACK',verified:true,
      tenantId:scope.tenantId,storeId:scope.storeId,revision:1,
      priceVersion:1,stockVersion:1,expiresAt:now+300000,
      products:[{source:'SERVER_VERIFIED_SHOP_CATALOG',verified:true,
        tenantId:scope.tenantId,storeId:scope.storeId,itemId:'sku_a',
        sku:scope.storeId==='store_a'?'QA-A001':scope.storeId==='store_b'?'QA-B001':'QA-C001',
        name:'Sản phẩm giả lập',priceVnd:159000,stock:5,imageUrl:null}]};},
  async readSalesIntent(scope){return intentForStore?intentForStore(scope):{
    source:'TRUSTED_SALES_CORE',verified:true,
    tenantId:scope.tenantId,storeId:scope.storeId,
    type:'TEXT',text:'Hồ sơ giả lập an toàn, chưa có đơn hàng.',
    dispatch_authorized:false};},
  async readReviewedTheme(scope){return {
    ...scope,
    source:'STAFF_REVIEWED_WIDGET_CONFIG',state:'APPROVED',shopApproved:true,
    primary:'#16A689',secondary:'#143F36',
    assistantName:'Trợ lý QA',welcomeMessage:'Chào bạn.',
    position:'right',layout:'compact',suggestedActions:[],avatarUrl:null};}
 };
 Object.assign(ports,changes);
 return {ports,counts,ledger,list};
}
function gateway(s){return createOfflineWidgetPreview({
  mode:'OFFLINE_SYNTHETIC_QA',ports:s.ports,serverSecret:SECRET,now:()=>NOW
});}
function params(w='a',over={}){return {
  widgetId:'widget_'+w,origin:originOf(w),...over
};}
function throws(p,code){return assert.rejects(p,e=>e?.code===code);}
test('No hosted/production adapter can be created',()=>{
 assert.throws(()=>createOfflineWidgetPreview(),/HOSTED_GATEWAY_NOT_AUTHORIZED/);
 assert.throws(()=>createOfflineWidgetPreview({mode:'HOSTED_READ_ONLY',ports:setup().ports,
   serverSecret:SECRET}),/HOSTED_GATEWAY_NOT_AUTHORIZED/);
});
test('All 7 server-only ports required',()=>{
 const s=setup();delete s.ports.claimEvent;
 assert.throws(()=>gateway(s),/HOSTED_GATEWAY_NOT_AUTHORIZED/);
});
test('Server session key must be 32 bytes or more',()=>{
 assert.throws(()=>createOfflineWidgetPreview({
   mode:'OFFLINE_SYNTHETIC_QA',ports:setup().ports,serverSecret:'short'
 }),/HOSTED_GATEWAY_NOT_AUTHORIZED/);
});
test('Shop A/B same tenant get independent trusted public-only sessions',async()=>{
 const g=gateway(setup()),a=await g.issueSession(params('a')),
 b=await g.issueSession(params('b'));
 assert.match(a.session,/^T404W1\./);
 assert.notEqual(a.session,b.session);
 assert.equal(a.privateOrderAccess,false);
 assert.equal(a.providerSends,0);
});
test('Two stores in different tenants remain isolated',async()=>{
 const g=gateway(setup()),a=await g.issueSession(params('a')),
 c=await g.issueSession(params('c'));
 assert.notEqual(a.session,c.session);
 await throws(g.preview({...params('c'),session:a.session,eventId:'cross_0001'}),
 'WIDGET_SESSION_EXPIRED_OR_FOREIGN');
});
test('Approved Store A TEXT preview never writes or sends',async()=>{
 const s=setup(),g=gateway(s),a=await g.issueSession(params('a'));
 const r=await g.preview({...params('a'),session:a.session,eventId:'event_0001'});
 assert.equal(r.status,'PREVIEW_ONLY');
 assert.equal(r.providerSends,0);assert.equal(r.orderWrites,0);
 assert.equal(r.modelCalls,0);assert.equal(r.privateOrderAccess,false);
 assert.equal(r.canRelease,false);
 assert.equal(r.publicPreview.text,'Hồ sơ giả lập an toàn, chưa có đơn hàng.');
 assert.equal(s.counts.claim,1);
});
test('Cross-shop replay in same tenant rejected before ledger use',async()=>{
 const s=setup(),g=gateway(s),a=await g.issueSession(params('a'));
 await throws(g.preview({...params('b'),session:a.session,eventId:'event_0002'}),
 'WIDGET_SESSION_EXPIRED_OR_FOREIGN');
 assert.equal(s.counts.claim,0);
});
test('Cannot change origin when reusing widget session',async()=>{
 const s=setup(),g=gateway(s),a=await g.issueSession(params('a'));
 await throws(g.preview({...params('a'),origin:originOf('b'),
   session:a.session,eventId:'event_0003'}),'WIDGET_ORIGIN_NOT_ALLOWED');
});
test('Unapproved installation prevents even session open',async()=>{
 const s=setup();s.list[0].status='DRAFT';
 await throws(gateway(s).issueSession(params('a')),'WIDGET_INSTALL_NOT_AUTHORIZED');
});
test('Expired subscription prevents even session open',async()=>{
 const s=setup();s.list[0].subscriptionActive=false;
 await throws(gateway(s).issueSession(params('a')),'WIDGET_INSTALL_NOT_AUTHORIZED');
});
test('Revoked Widget after session issuance fails before public reads',async()=>{
 const s=setup(),g=gateway(s),a=await g.issueSession(params('a'));
 s.list[0].revoked=true;
 await throws(g.preview({...params('a'),session:a.session,eventId:'event_0004'}),
 'WIDGET_INSTALL_NOT_AUTHORIZED');
 assert.equal(s.counts.catalog,0);
});
test('Changed install version invalidates prior session',async()=>{
 const s=setup(),g=gateway(s),a=await g.issueSession(params('a'));
 s.list[0].version++;
 await throws(g.preview({...params('a'),session:a.session,eventId:'event_0005'}),
 'WIDGET_SESSION_EXPIRED_OR_FOREIGN');
});
test('Domain ownership is rechecked on every event, not only session issue',async()=>{
 let valid=true;
 const s=setup({changes:{async readDomainProof(scope){
   return {source:'PRIVATE_STAFF_VERIFIED_DOMAIN_OWNERSHIP',verified:valid,
     ...scope,expiresAt:NOW+100000};
 }}});
 const g=gateway(s),a=await g.issueSession(params('a'));
 valid=false;
 await throws(g.preview({...params('a'),session:a.session,eventId:'event_0006'}),
 'WIDGET_DOMAIN_OWNERSHIP_NOT_VERIFIED');
});
test('Spoofed origin plus widget ID is insufficient without server domain proof',async()=>{
 const s=setup({changes:{async readDomainProof(scope){
   return {source:'CLIENT_BODY',verified:true,...scope,expiresAt:NOW+999000};
 }}});
 await throws(gateway(s).issueSession(params('a')),
 'WIDGET_DOMAIN_OWNERSHIP_NOT_VERIFIED');
});
test('Domain-proof scopes cannot cross store or tenant',async()=>{
 const s=setup({changes:{async readDomainProof(scope){
   return {source:'PRIVATE_STAFF_VERIFIED_DOMAIN_OWNERSHIP',verified:true,
     ...scope,storeId:'store_b',expiresAt:NOW+999000};
 }}});
 await throws(gateway(s).issueSession(params('a')),
 'WIDGET_DOMAIN_OWNERSHIP_NOT_VERIFIED');
});
test('Expired domain proof always denies',async()=>{
 const s=setup({changes:{async readDomainProof(scope){
   return {source:'PRIVATE_STAFF_VERIFIED_DOMAIN_OWNERSHIP',verified:true,
     ...scope,expiresAt:NOW-1};
 }}});
 await throws(gateway(s).issueSession(params('a')),
 'WIDGET_DOMAIN_OWNERSHIP_NOT_VERIFIED');
});
test('Quota refusal blocks session issuance',async()=>{
 const s=setup({changes:{async consumeQuota(scope){
   return {source:'DURABLE_QUOTA_LEDGER',accepted:false,...scope};
 }}});
 await throws(gateway(s).issueSession(params('a')),
 'WIDGET_QUOTA_DENIED_OR_UNVERIFIED');
});
test('Wrong-store quota receipt fails closed',async()=>{
 const s=setup({changes:{async consumeQuota(scope){
   return {source:'DURABLE_QUOTA_LEDGER',accepted:true,...scope,storeId:'store_c'};
 }}});
 await throws(gateway(s).issueSession(params('a')),
 'WIDGET_QUOTA_DENIED_OR_UNVERIFIED');
});
test('Quota failure on each request blocks catalog access',async()=>{
 let refused=false;
 const s=setup({changes:{async consumeQuota(scope){
   return {source:'DURABLE_QUOTA_LEDGER',accepted:!refused,...scope};
 }}});
 const g=gateway(s),a=await g.issueSession(params('a'));
 refused=true;
 await throws(g.preview({...params('a'),session:a.session,eventId:'event_0007'}),
 'WIDGET_QUOTA_DENIED_OR_UNVERIFIED');
 assert.equal(s.counts.catalog,0);
});
test('Duplicate event fails before any catalog or model request',async()=>{
 const s=setup(),g=gateway(s),a=await g.issueSession(params('a'));
 const input={...params('a'),session:a.session,eventId:'event_0008'};
 await g.preview(input);
 await throws(g.preview(input),'WIDGET_EVENT_REPLAY_OR_LEDGER_UNAVAILABLE');
 assert.equal(s.counts.catalog,1);
});
test('Two separate workers with shared synthetic ledger deny same event',async()=>{
 const shared=new Set(),s1=setup({ledger:shared}),s2=setup({ledger:shared});
 const a=gateway(s1),b=gateway(s2),ses=await a.issueSession(params('a'));
 const input={...params('a'),session:ses.session,eventId:'event_0009'};
 const results=await Promise.allSettled([a.preview(input),b.preview(input)]);
 assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
 assert.equal(results.filter(x=>x.status==='rejected').length,1);
 // This is NOT hosted Postgres atomicity or multi-region recovery evidence.
});
test('Event ledger unavailable fails closed',async()=>{
 const s=setup({changes:{async claimEvent(){throw Error('database unavailable')}}});
 const g=gateway(s),a=await g.issueSession(params('a'));
 await assert.rejects(g.preview({...params('a'),session:a.session,eventId:'event_0010'}));
 assert.equal(s.counts.catalog,0);
});
test('Forged claim receipt from different store rejected',async()=>{
 const s=setup({changes:{async claimEvent(scope){
   return {source:'ATOMIC_PRIVATE_EVENT_LEDGER',claimed:true,
     ...scope,storeId:'store_b'};
 }}});
 const g=gateway(s),a=await g.issueSession(params('a'));
 await throws(g.preview({...params('a'),session:a.session,eventId:'event_0011'}),
 'WIDGET_EVENT_REPLAY_OR_LEDGER_UNAVAILABLE');
});
test('Malformed or missing event ID rejected before ledger writes',async()=>{
 const s=setup(),g=gateway(s),a=await g.issueSession(params('a'));
 for(const eventId of ['',null,'abc','../../../bad']){
 await throws(g.preview({...params('a'),session:a.session,eventId}),
   'WIDGET_EVENT_ID_OR_SECURITY_GATE_INVALID');
 }
 assert.equal(s.counts.claim,0);
});
test('Signed session tampering is denied before event claim',async()=>{
 const s=setup(),g=gateway(s),a=await g.issueSession(params('a'));
 const changed=a.session.slice(0,-2)+'00';
 await assert.rejects(g.preview({...params('a'),session:changed,eventId:'event_0012'}));
 assert.equal(s.counts.claim,0);
});
test('Private order requests and confirmations are not in allowed preview types',async()=>{
 const s=setup({intentForStore:scope=>({
   source:'TRUSTED_SALES_CORE',verified:true,tenantId:scope.tenantId,storeId:scope.storeId,
   type:'ORDER_REQUEST_SUMMARY',text:'Đơn chưa được xác nhận',dispatch_authorized:false
 })}),g=gateway(s),a=await g.issueSession(params('a'));
 await throws(g.preview({...params('a'),session:a.session,eventId:'event_0013'}),
 'WIDGET_PRIVATE_OR_WRITE_INTENT_DENIED');
});
test('AI output cannot opt-in to sending',async()=>{
 const s=setup({intentForStore:scope=>({
   source:'TRUSTED_SALES_CORE',verified:true,tenantId:scope.tenantId,storeId:scope.storeId,
   type:'TEXT',text:'Fake',dispatch_authorized:true
 })}),g=gateway(s),a=await g.issueSession(params('a'));
 await throws(g.preview({...params('a'),session:a.session,eventId:'event_0014'}),
 'WIDGET_PRIVATE_OR_WRITE_INTENT_DENIED');
});
test('Product price and stock are sourced only from verified store catalog',async()=>{
 const s=setup({intentForStore:scope=>({
   source:'TRUSTED_SALES_CORE',verified:true,tenantId:scope.tenantId,storeId:scope.storeId,
   type:'PRODUCT_CARD',text:'Xem hàng mẫu',productIds:['sku_a'],dispatch_authorized:false
 })}),g=gateway(s),a=await g.issueSession(params('a'));
 const r=await g.preview({...params('a'),session:a.session,eventId:'event_0015'});
 assert.equal(r.publicPreview.products[0].priceVnd,159000);
 assert.equal(r.publicPreview.products[0].sku,'QA-A001');
});
test('Cross-store catalog row denied by existing V14.3 Sales Core',async()=>{
 const s=setup({changes:{async readPublicCatalog(scope){
  return {source:'TRUSTED_CATALOG_READBACK',verified:true,
    tenantId:scope.tenantId,storeId:'store_b',revision:1,
     priceVersion:1,stockVersion:1,expiresAt:NOW+300000,products:[]};
 }},intentForStore:scope=>({
  source:'TRUSTED_SALES_CORE',verified:true,tenantId:scope.tenantId,storeId:scope.storeId,
  type:'PRODUCT_CARD',text:'Xem mẫu',productIds:['sku_a'],dispatch_authorized:false
 })}),g=gateway(s),a=await g.issueSession(params('a'));
 await throws(g.preview({...params('a'),session:a.session,eventId:'event_0016'}),
 'CATALOG_READBACK_UNVERIFIED');
});
test('Knowledge draft cannot appear as PUBLIC answer',async()=>{
 const s=setup({intentForStore:scope=>({
  source:'TRUSTED_SALES_CORE',verified:true,tenantId:scope.tenantId,storeId:scope.storeId,
  type:'KNOWLEDGE_ANSWER',text:'Thông tin chưa xác minh',dispatch_authorized:false,
  knowledge:{source:'TRUSTED_PUBLISHED_KNOWLEDGE',tenantId:scope.tenantId,
    storeId:scope.storeId,releaseState:'DRAFT',visibility:'PUBLIC',merchantApproved:true}
 })}),g=gateway(s),a=await g.issueSession(params('a'));
 await throws(g.preview({...params('a'),session:a.session,eventId:'event_0017'}),
 'KNOWLEDGE_NOT_PUBLISHED');
});
test('Knowledge APPROVED PUBLIC PUBLISHED can be previewed, not sent',async()=>{
 const s=setup({intentForStore:scope=>({
  source:'TRUSTED_SALES_CORE',verified:true,tenantId:scope.tenantId,storeId:scope.storeId,
  type:'KNOWLEDGE_ANSWER',text:'Shop mở cửa từ 8h đến 20h (QA)',dispatch_authorized:false,
  knowledge:{source:'TRUSTED_PUBLISHED_KNOWLEDGE',tenantId:scope.tenantId,
    storeId:scope.storeId,releaseState:'PUBLISHED',visibility:'PUBLIC',merchantApproved:true}
 })}),g=gateway(s),a=await g.issueSession(params('a'));
 const r=await g.preview({...params('a'),session:a.session,eventId:'event_0018'});
 assert.equal(r.status,'PREVIEW_ONLY');assert.equal(r.providerSends,0);
});
test('Expired themed review blocks rendering',async()=>{
 const s=setup({changes:{async readReviewedTheme(scope){return {
  ...scope,source:'STAFF_REVIEWED_WIDGET_CONFIG',state:'DRAFT',shopApproved:false};
 }}}),g=gateway(s),a=await g.issueSession(params('a'));
 await throws(g.preview({...params('a'),session:a.session,eventId:'event_0019'}),
 'WIDGET_CONFIG_NOT_APPROVED');
});
test('Gateway never exposes methods for orders, provider sends or publish',()=>{
 const g=gateway(setup());
 for(const name of ['sendMeta','sendZalo','placeOrder','writeOrder','publishKnowledge',
  'updateCredentials','deploy','readPrivateOrder'])assert.equal(g[name],undefined);
 const state=g.releaseState;
 assert.equal(state.productionReady,false);
 assert.equal(state.hostedStoreRlsVerified,false);
 assert.equal(state.isolatedRestoreVerified,false);
});
test('Unavailable private installation registry hard denies',async()=>{
 const s=setup({changes:{async loadRegistry(){throw Error('registry database down')}}});
 await assert.rejects(gateway(s).issueSession(params('a')));
});
test('Anonymous session does not authorize private Orders even if authentic',async()=>{
 const s=setup(),g=gateway(s),a=await g.issueSession(params('a'));
 assert.equal(a.privateOrderAccess,false);
 assert.equal(g.releaseState.providerSendEnabled,false);
});

test('Cross-store reviewed branding must never render under another widget',async()=>{
 const s=setup({changes:{async readReviewedTheme(scope){return {
  ...scope,storeId:'store_b',
  source:'STAFF_REVIEWED_WIDGET_CONFIG',state:'APPROVED',shopApproved:true,
  primary:'#FFFFFF',secondary:'#000000',assistantName:'Wrong shop',
  welcomeMessage:'Phone leak',position:'right',layout:'compact',
  suggestedActions:[]};
 }}}),g=gateway(s),a=await g.issueSession(params('a'));
 await throws(g.preview({...params('a'),session:a.session,eventId:'event_0020'}),
  'WIDGET_THEME_CROSS_STORE_READBACK');
});
test('Product cards require independently versioned fresh price and stock',async()=>{
 const productIntent=scope=>({source:'TRUSTED_SALES_CORE',verified:true,
  tenantId:scope.tenantId,storeId:scope.storeId,type:'PRODUCT_CARD',
  productIds:['sku_a'],text:'Sản phẩm mẫu',dispatch_authorized:false});
 const variants=[
  {priceVersion:undefined,stockVersion:1,expiresAt:NOW+2000},
  {priceVersion:1,stockVersion:0,expiresAt:NOW+2000},
  {priceVersion:1,stockVersion:1,expiresAt:NOW-1},
 ];
 for(let i=0;i<variants.length;i++){
   const v=variants[i],s=setup({intentForStore:productIntent});
   const orig=s.ports.readPublicCatalog;
   s.ports.readPublicCatalog=async scope=>({...await orig(scope),...v});
   const g=gateway(s),a=await g.issueSession(params('a'));
   await throws(g.preview({...params('a'),session:a.session,eventId:'event_002'+i}),
     'WIDGET_PRICE_STOCK_SNAPSHOT_STALE_OR_UNVERSIONED');
 }
});
