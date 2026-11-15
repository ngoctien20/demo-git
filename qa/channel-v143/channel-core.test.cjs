'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {build,fallback,checkedUrl}=require('./channel-core.cjs');
const {messengerPreview,widgetPreview,zaloFallback}=require('./renderers.cjs');
const {locate,mint,verify,theme}=require('./widget-gateway.cjs');
const SECRET='test-only-unique-messenger-secret-1234567890';
const SITE='https://merchant.qa.invalid/';
const origins=['https://img.qa.invalid'];
const binding=(channel='MESSENGER',extras={})=>({
 source:'SERVER_VERIFIED_CHANNEL_SCOPE',verified:true,serverDerived:true,
 tenantId:'tenant_a',storeId:'store_a',channel,
 subscriptionActive:true,shopActive:true,allowedImageOrigins:origins,...extras
});
const intent=(type='TEXT',extras={})=>({
 source:'TRUSTED_SALES_CORE',verified:true,tenantId:'tenant_a',
 storeId:'store_a',type,text:'Chào bạn, mình giúp gì ạ?',dispatch_authorized:false,...extras
});
const item=(extra={})=>({source:'SERVER_VERIFIED_SHOP_CATALOG',verified:true,
 tenantId:'tenant_a',storeId:'store_a',itemId:'sku_a',sku:'A001',
 name:'Áo đen',priceVnd:159000,stock:5,imageUrl:'https://img.qa.invalid/a.png',...extra});
const catalog=(items=[item()],extra={})=>({source:'TRUSTED_CATALOG_READBACK',verified:true,
 tenantId:'tenant_a',storeId:'store_a',revision:1,products:items,...extra});
const page=(extra={})=>({source:'SERVER_VERIFIED_MESSENGER_BINDING',verified:true,serverDerived:true,
 tenantId:'tenant_a',storeId:'store_a',pageId:'12345678901',recipientPsid:'98765432100',
 imageOrigins:origins,webOrigins:['https://merchant.qa.invalid'],shopSlug:'shop-a',...extra});
const config=(extra={})=>({source:'STAFF_REVIEWED_WIDGET_CONFIG',
 state:'APPROVED',shopApproved:true,primary:'#1E8D76',secondary:'#102230',
 assistantName:'Trợ lý cửa hàng',welcomeMessage:'Chào bạn!',position:'right',
 layout:'compact',suggestedActions:['Xem giá','Gặp nhân viên'],...extra});
const registry=(extra={})=>({source:'VERIFIED_PRIVATE_WIDGET_REGISTRY',verified:true,
 installations:[{widgetId:'widget_a',tenantId:'tenant_a',storeId:'store_a',
 allowedOrigins:['https://shop-a.qa.invalid'],version:1,status:'RELEASED',
 serverVerified:true,subscriptionActive:true,shopActive:true,revoked:false}],...extra});
const okProduct=()=>build({binding:binding(),intent:intent('PRODUCT_CARD',{productIds:['sku_a']}),catalog:catalog()});
const error=(fn,pattern)=>assert.throws(fn,pattern);
test('01 · trusted TEXT uses no outbound or DB writes',()=>{
 const r=build({binding:binding(),intent:intent()});
 assert.equal(r.type,'TEXT');assert.equal(r.providerSends,0);assert.equal(r.orderWrites,0);
 assert.equal(r.dispatchAuthorized,false);assert.equal(r.previewOnly,true);
});
test('02 · denies client/AI tenant scope',()=>{
 for(const b of [{source:'CLIENT_BODY'},{verified:false},{serverDerived:false},
  {tenantId:'tenant_b'},{storeId:'store_b'},{subscriptionActive:false},{shopActive:false}])
  error(()=>build({binding:binding('MESSENGER',b),intent:intent()}),/CHANNEL_SCOPE|RESPONSE_INTENT_UNTRUSTED/);
});
test('03 · intent must be explicit trusted Sales Core and no-send',()=>{
 for(const i of [{source:'MODEL_OUTPUT'},{verified:false},{tenantId:'tenant_b'},
  {storeId:'store_b'},{dispatch_authorized:true}])
 error(()=>build({binding:binding(),intent:intent('TEXT',i)}),/RESPONSE_INTENT_UNTRUSTED/);
});
test('04 · rejects prototype action or unsupported type',()=>{
 error(()=>build({binding:binding(),intent:intent('__proto__')}),/RESPONSE_INTENT_UNTRUSTED/);
});
test('05 · all fourteen response intent types are declared',()=>{
 const {TYPES}=require('./channel-core.cjs');assert.equal(TYPES.length,14);
});
test('06 · verified SKU and integer VND readback',()=>{
 const r=okProduct();assert.equal(r.products[0].sku,'A001');assert.equal(r.products[0].priceVnd,159000);
 assert.equal(r.products[0].stock,5);
});
test('07 · never accepts invented SKU not in catalog',()=>{
 error(()=>build({binding:binding(),intent:intent('PRODUCT_CARD',{productIds:['missing']}),
  catalog:catalog()}),/PRODUCT_NOT_FOUND_IN_STORE/);
});
test('08 · deny catalog rows from other shop',()=>{
 for(const x of [{storeId:'store_b'},{tenantId:'tenant_b'},{priceVnd:NaN},
  {priceVnd:'159000'},{priceVnd:-1},{stock:-1},{stock:1.5}])
 error(()=>build({binding:binding(),intent:intent('PRODUCT_CARD',{productIds:['sku_a']}),
  catalog:catalog([item(x)])}),/CATALOG_ROW_SCOPE_OR_MONEY_INVALID/);
});
test('09 · deny foreign catalog readback',()=>{
 for(const x of [{storeId:'store_b'},{tenantId:'tenant_b'},{verified:false},{revision:0}])
 error(()=>build({binding:binding(),intent:intent('PRODUCT_CARD',{productIds:['sku_a']}),
  catalog:catalog([item()],x)}),/CATALOG_READBACK_UNVERIFIED/);
});
test('10 · forbid duplicate or excessive candidate SKUs',()=>{
 for(const ids of [['sku_a','sku_a'],Array(11).fill('sku_a'),[]])
 error(()=>build({binding:binding(),intent:intent('PRODUCT_LIST',{productIds:ids}),
 catalog:catalog()}),/PRODUCT_SELECTION_INVALID/);
});
test('11 · reject dangerous image URLs and credential query strings',()=>{
 for(const url of ['http://img.qa.invalid/a.png','https://evil.invalid/a.png',
  'https://img.qa.invalid@evil.invalid/x','https://img.qa.invalid/a?token=secret',
  'https://img.qa.invalid/a#fragment','javascript:alert(1)','https://img.qa.invalid/a?tenant_id=store_a'])
 error(()=>checkedUrl(url,origins),/IMAGE_URL_NOT_ALLOWED|IMAGE_URL_INVALID/);
});
test('12 · image HTTPS allowlist can pass when exact origin matches',()=>{
 assert.equal(checkedUrl('https://img.qa.invalid/a.png',origins),'https://img.qa.invalid/a.png');
});
test('13 · inline action has no right to confirm an order',()=>{
 error(()=>build({binding:binding(),intent:intent('TEXT',{actions:[{id:'ORDER_REQUEST_START',label:'Mua',confirmed:true}]})}),/ORDER_ACTION_CANNOT_CONFIRM/);
});
test('14 · unsupported actions and duplicates denied',()=>{
 for(const actions of [[{id:'DELETE_ORDERS',label:'Xóa'}],
 [{id:'ASK_STAFF',label:'NV'},{id:'ASK_STAFF',label:'NV'}]])
 error(()=>build({binding:binding(),intent:intent('TEXT',{actions})}),/ACTION_NOT_ALLOWED/);
});
test('15 · product action must reference selected product',()=>{
 error(()=>build({binding:binding(),intent:intent('PRODUCT_CARD',{productIds:['sku_a'],
  actions:[{id:'PRODUCT_VIEW',label:'Xem',itemId:'sku_b'}]}),catalog:catalog()}),/ACTION_PRODUCT_NOT_SELECTED/);
});
test('16 · knowledge only from public merchant-approved published version',()=>{
 const k={source:'TRUSTED_PUBLISHED_KNOWLEDGE',tenantId:'tenant_a',storeId:'store_a',
 releaseState:'PUBLISHED',visibility:'PUBLIC',merchantApproved:true};
 const r=build({binding:binding(),intent:intent('KNOWLEDGE_ANSWER',{knowledge:k})});
 assert.equal(r.type,'KNOWLEDGE_ANSWER');
 for(const x of [{visibility:'STAFF_ONLY'},{releaseState:'DRAFT'},
  {merchantApproved:false},{storeId:'store_b'}])
 error(()=>build({binding:binding(),intent:intent('KNOWLEDGE_ANSWER',{knowledge:{...k,...x}})}),/KNOWLEDGE_NOT_PUBLISHED/);
});
test('17 · text fallback contains only current store verified products',()=>{
 const r=okProduct();const f=fallback(r);
 assert.match(f.text,/A001/);assert.match(f.text,/159.000/);
 assert.equal(f.dispatchAuthorized,false);
});
test('18 · reuses V13.6M signed Messenger product carousel',()=>{
 const r=messengerPreview({binding:binding(),intent:intent('PRODUCT_CARD',{productIds:['sku_a']}),
  catalog:catalog(),trustedMessenger:page(),serverActionSecret:SECRET,siteOrigin:SITE});
 const el=r.providerPayloadPreview.body.message.attachment.payload.elements[0];
 assert.equal(el.title,'Áo đen');
 assert.match(el.buttons[0].payload,/^T404M1\./);
 assert.equal(r.providerSends,0);assert.equal(r.productionReady,false);
});
test('19 · refuses stale Page-to-Store mapping',()=>{
 error(()=>messengerPreview({binding:binding(),intent:intent(),
 trustedMessenger:page({storeId:'store_b'}),serverActionSecret:SECRET,siteOrigin:SITE}),
 /MESSENGER_BINDING_MISMATCH/);
});
test('20 · uses signed Messenger Quick Replies from V13.6M',()=>{
 const r=messengerPreview({binding:binding(),intent:intent('CHOICE_MENU',{actions:[
  {id:'ASK_STAFF',label:'Gặp nhân viên'}, {id:'BROWSE_CATALOG',label:'Xem hàng'}]}),
 trustedMessenger:page(),serverActionSecret:SECRET});
 assert.equal(r.providerPayloadPreview.body.message.quick_replies.length,2);
 assert.match(r.providerPayloadPreview.body.message.quick_replies[0].payload,/^T404M1\./);
});
test('21 · Messenger cannot be converted into a Zalo request',()=>{
 error(()=>messengerPreview({binding:binding('ZALO_BOT'),intent:intent(),
 trustedMessenger:page(),serverActionSecret:SECRET}),/MESSENGER_CHANNEL_REQUIRED/);
});
test('22 · Zalo only receives text fallback and never sends',()=>{
 const x=zaloFallback({binding:binding('ZALO_BOT'),intent:intent()});
 assert.equal(x.presentation.type,'TEXT');assert.equal(x.providerSends,0);
});
test('23 · widget preview contains no internal scope identifiers',()=>{
 const t=theme(config());
 const x=widgetPreview({binding:binding('WEB_WIDGET'),intent:intent('PRODUCT_CARD',{productIds:['sku_a']}),
 catalog:catalog(),reviewedTheme:t});
 assert.equal(x.presentation.products[0].sku,'A001');
 assert.equal(x.providerSends,0);assert.equal(x.dispatchAuthorized,false);
 assert.equal('internalScope' in x.presentation,false);
});
test('24 · theme needs staff review and shop confirmation',()=>{
 for(const x of [{state:'DRAFT'},{shopApproved:false},{source:'CLIENT_BODY'}])
  error(()=>theme(config(x)),/WIDGET_CONFIG_NOT_APPROVED/);
});
test('25 · theme blocks HTML injection and CSS injection',()=>{
 for(const x of [{assistantName:'<script>alert(1)</script>'},{primary:'red'},
 {secondary:'var(--secret)'},{welcomeMessage:'hi <img src=x>'},{position:'top'},
 {layout:'admin'}])
 error(()=>theme(config(x)),/WIDGET_THEME_INVALID/);
});
test('26 · optional avatar must use approved HTTPS media origin',()=>{
 error(()=>theme(config({avatarUrl:'http://evil.invalid/p.png'}),{allowedImageOrigins:origins}),
 /IMAGE_URL_NOT_ALLOWED/);
});
test('27 · widget registry authorizes exact verified origin',()=>{
 const x=locate(registry(),'widget_a','https://shop-a.qa.invalid');
 assert.equal(x.storeId,'store_a');assert.equal(x.personalOrderReadAllowed,false);
});
test('28 · widget cannot be embedded on unverified origin',()=>{
 for(const bad of ['https://evil.invalid','https://sub.shop-a.qa.invalid',
 'https://shop-a.qa.invalid.evil.invalid','http://shop-a.qa.invalid'])
 error(()=>locate(registry(),'widget_a',bad),/WIDGET_ORIGIN_/);
});
test('29 · revoked, paused, expired or duplicate registry fails closed',()=>{
 for(const overrides of [{revoked:true},{status:'DRAFT'},
 {shopActive:false},{subscriptionActive:false}]){
  const r=registry();r.installations[0]={...r.installations[0],...overrides};
  error(()=>locate(r,'widget_a','https://shop-a.qa.invalid'),/WIDGET_INSTALL_NOT_AUTHORIZED/);
 }
 const dup=registry();dup.installations.push({...dup.installations[0]});
 error(()=>locate(dup,'widget_a','https://shop-a.qa.invalid'),/WIDGET_NOT_FOUND_OR_AMBIGUOUS/);
});
test('30 · no widget ID from client can change store or view private orders',()=>{
 const v=locate(registry(),'widget_a','https://shop-a.qa.invalid');
 assert.equal(v.tenantId,'tenant_a');assert.equal(v.storeId,'store_a');
 assert.equal(v.anonymousOnly,true);assert.equal(v.orderWrites,0);
});
test('31 · session minted by server verifies for exact install',()=>{
 const install=locate(registry(),'widget_a','https://shop-a.qa.invalid');
 const token=mint({install,serverSecret:SECRET,now:100000000});
 const out=verify({install,session:token,serverSecret:SECRET,now:100000001});
 assert.equal(out.verified,true);assert.equal(out.allowedOrderWrites,false);
 assert.equal(out.requiresDurableReplayGuard,true);assert.equal(out.requiresRateLimit,true);
});
test('32 · session tampering and cross-store replay denied',()=>{
 const install=locate(registry(),'widget_a','https://shop-a.qa.invalid');
 const token=mint({install,serverSecret:SECRET,now:100000000});
 const parts=token.split('.');
 error(()=>verify({install,session:parts[0]+'.'+parts[1]+'.'+'0'.repeat(64),
  serverSecret:SECRET,now:100000001}),/WIDGET_SESSION_MAC_INVALID/);
 error(()=>verify({install:{...install,storeId:'store_b'},session:token,
 serverSecret:SECRET,now:100000001}),/WIDGET_SESSION_EXPIRED_OR_FOREIGN/);
});
test('33 · 15-minute session expiry enforced',()=>{
 const install=locate(registry(),'widget_a','https://shop-a.qa.invalid');
 const token=mint({install,serverSecret:SECRET,now:100000000});
 error(()=>verify({install,session:token,serverSecret:SECRET,now:100000000+15*60000}),
 /WIDGET_SESSION_EXPIRED_OR_FOREIGN/);
});
test('34 · no short secret accepted',()=>{
 const install=locate(registry(),'widget_a','https://shop-a.qa.invalid');
 error(()=>mint({install,serverSecret:'123',now:100000000}),/WIDGET_SERVER_KEY_REQUIRED/);
});
test('35 · no server-side customer order authentication from anonymous widget',()=>{
 const install=locate(registry(),'widget_a','https://shop-a.qa.invalid');
 const token=mint({install,serverSecret:SECRET,now:100000000});
 const verified=verify({install,session:token,serverSecret:SECRET,now:100000100});
 assert.equal(verified.personalOrderReadAllowed,false);assert.equal(verified.allowedProviderSends,false);
});
test('36 · no HTML/Graph/DB/network calls in new implementation',()=>{
 const fs=require('node:fs');
 for(const p of ['./channel-core.cjs','./widget-gateway.cjs','./renderers.cjs']){
 const s=fs.readFileSync(require.resolve(p),'utf8');
 for(const forbidden of ['fetch(', 'https.request(', 'axios(', '.insert(', '.delete(',
 'service_role','PAGE_ACCESS_TOKEN','ZALO_BOT_TOKEN','http://graph.facebook.com/'])
 assert.equal(s.includes(forbidden),false,forbidden+' in '+p);
 }
});
