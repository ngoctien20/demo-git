'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createMerchantReadOnlyService}=require('./merchant-readonly.cjs');
const {createMenuDraftManager,compareMenuVersions,validateDraft}=require('./menu-drafts.cjs');
const {createNoSendCoreBridge}=require('./menu-core-bridge.cjs');
const {validateRichDraft}=require('./rich-text.cjs');
const REG=require('../v131/menu-registry.json');
const now=Date.parse('2026-11-15T03:00:00Z'),future=new Date(now+86400000).toISOString();
const baseSession={serverVerified:true,userId:'user-0001',expiresAt:future,displayName:'Shop chủ thử nghiệm'};
const scopes=[{userId:'user-0001',tenantId:'tenant-A',storeId:'store-A',role:'owner',active:true}];
function merchant({session=baseSession,membership=scopes,shop,billing,bot}={}){
 return createMerchantReadOnlyService({clock:()=>now,verifySession:async()=>session,
  listMemberships:async()=>membership,
  readTenant:async req=>shop??{...req,verified:true,name:'Shop A'},
  readSubscription:async req=>billing??{...req,verified:true,state:'ACTIVE',planName:'Lite',startsAt:new Date(now-86400000).toISOString(),expiresAt:future},
  readBot:async req=>bot??{...req,verified:true,connectionState:'UNKNOWN',ownerPairing:'UNKNOWN'}});
}
test('merchant no session 401',async()=>assert.equal((await merchant({session:null}).handle({method:'GET'})).status,401));
test('merchant expired session 401',async()=>assert.equal((await merchant({session:{...baseSession,expiresAt:new Date(now-1).toISOString()}}).handle({method:'GET'})).status,401));
test('merchant unsigned fake session 401',async()=>assert.equal((await merchant({session:{...baseSession,serverVerified:false}}).handle({method:'GET'})).status,401));
test('merchant denies no membership 403',async()=>assert.equal((await merchant({membership:[]}).handle({method:'GET'})).status,403));
test('merchant denies revoked membership 403',async()=>assert.equal((await merchant({membership:[{...scopes[0],active:false}]}).handle({method:'GET'})).status,403));
test('merchant denies membership for another user',async()=>assert.equal((await merchant({membership:[{...scopes[0],userId:'user-0002'}]}).handle({method:'GET'})).status,403));
test('merchant verifies scope and does not expose role from client query',async()=>{const r=await merchant().handle({method:'GET',url:'/?tenant_id=tenant-B&role=admin'});assert.equal(r.status,200);assert.equal(r.body.shop.name,'Shop A');assert.equal(r.body.shop.membership_role,'OWNER');assert.deepEqual(Object.keys(r.body),['contract_version','source','account','shop','subscription','bot','generated_at']);});
test('merchant cross-tenant readback fail closed 503',async()=>{const r=await merchant({shop:{tenantId:'tenant-B',storeId:'store-B',verified:true,name:'Other Shop'}}).handle({method:'GET'});assert.equal(r.status,503);assert.equal(r.body.error,'SERVICE_UNAVAILABLE');});
test('merchant bot scope mismatch fail closed',async()=>{assert.equal((await merchant({bot:{tenantId:'tenant-B',storeId:'store-B',verified:true}}).handle({method:'GET'})).status,503);});
test('merchant safe link only with backend verified binding',async()=>{const m=merchant({bot:{tenantId:'tenant-A',storeId:'store-A',verified:true,connectionState:'CONNECTED',bindingVerified:false,ownerPairing:'VERIFIED',verifiedLink:'https://example.com/bot',verifiedQrUrl:'javascript:alert(1)'}});const r=await m.handle({method:'GET'});assert.equal(r.body.bot.verified_link,null);assert.equal(r.body.bot.verified_qr_url,null);});
test('merchant rejects mutation methods',async()=>assert.equal((await merchant().handle({method:'POST'})).status,405));
test('merchant multi-shop selection required unless server-selected',async()=>{const other={userId:'user-0001',tenantId:'tenant-B',storeId:'store-B',active:true,role:'owner'};assert.equal((await merchant({membership:[...scopes,other]}).handle({method:'GET'})).status,409);const m=merchant({session:{...baseSession,selectedTenantId:'tenant-A',selectedStoreId:'store-A'},membership:[...scopes,other]});assert.equal((await m.handle({method:'GET'})).status,200);});
test('merchant stale server-selected shop forbidden',async()=>{const other={userId:'user-0001',tenantId:'tenant-B',storeId:'store-B',active:true,role:'owner'};assert.equal((await merchant({session:{...baseSession,selectedTenantId:'tenant-C',selectedStoreId:'store-C'},membership:[...scopes,other]}).handle({method:'GET'})).status,409);});
test('merchant rejects stale server choice even with one membership',async()=>{const selected={...baseSession,selectedTenantId:'tenant-B',selectedStoreId:'store-B'};assert.equal((await merchant({session:selected}).handle({method:'GET'})).status,409);});
test('merchant response no credential and no-store',async()=>{const r=await merchant().handle({method:'GET'});assert.equal(r.headers['cache-control'],'private, no-store');assert.equal(JSON.stringify(r).includes('service_role'),false);});
test('menu draft preserves canonical registry',()=>{const before=JSON.stringify(REG);const mgr=createMenuDraftManager();const d=mgr.create();mgr.patch(d.draftId,{actionId:'CUS_CATALOG',label:'Danh mục sản phẩm'});assert.equal(JSON.stringify(REG),before);assert.equal(mgr.get(d.draftId).diff[0].field,'label');});
test('menu draft fallback collision rejected and rollback',()=>{const mgr=createMenuDraftManager();const {draftId}=mgr.create();assert.throws(()=>mgr.patch(draftId,{actionId:'CUS_CATALOG',fallbackCommand:'2'}),/DRAFT_VALIDATION_FAILED/);assert.equal(mgr.get(draftId).registry.menus[0].actions[0].fallback_command,'1');});
test('menu cannot approve or release by itself',()=>{const mgr=createMenuDraftManager();const d=mgr.create();assert.throws(()=>mgr.transition(d.draftId,'RELEASED'),/OWNER_APPROVAL_GATE_REQUIRED/);mgr.transition(d.draftId,'REVIEW');mgr.transition(d.draftId,'CANDIDATE');assert.throws(()=>mgr.transition(d.draftId,'APPROVED'),/OWNER_APPROVAL_GATE_REQUIRED/);});
test('menu diff high risk permission changes flagged',()=>{const other=JSON.parse(JSON.stringify(REG));other.menus[0].actions[0].required_permissions=['admin:*'];assert.equal(compareMenuVersions(REG,other)[0].risk,'HIGH');});
test('menu draft rejects unsafe write flags',()=>{const d=JSON.parse(JSON.stringify(REG));d.send_enabled=true;assert.deepEqual(validateDraft(d),['UNSAFE_FLAGS']);});
test('rich text official Zalo st whitelist',()=>{const r=validateRichDraft({text:'Đơn 🛒 số 1',text_styles:[{start:0,len:11,st:['b','c_15a85f']}]});assert.deepEqual(r.text_styles[0].st,['b','c_15a85f']);assert.equal(r.providerPayload,null);});
test('rich text rejects legacy invalid type property',()=>{assert.throws(()=>validateRichDraft({text:'A',text_styles:[{start:0,len:1,type:'bold'}]}),/STYLE_NOT_WHITELISTED/);});
test('rich text rejects surrogate-pair split',()=>{assert.throws(()=>validateRichDraft({text:'A🛒B',text_styles:[{start:2,len:1,st:['b']}]}),/UTF16_RANGE_INVALID/);});
test('rich text rejects markups+styles mix',()=>{assert.throws(()=>validateRichDraft({text:'**A**',parse_mode:'markdown',text_styles:[{start:0,len:1,st:['b']}]}),/PARSE_MODE_AND_STYLES_CONFLICT/);});
test('rich text rejects unsupported color',()=>{assert.throws(()=>validateRichDraft({text:'A',text_styles:[{start:0,len:1,st:['c_ffffff']}]}),/STYLE_NOT_WHITELISTED/);});
const ctx={source:'BACKEND_AUTHENTICATED_CONTEXT',isVerified:true,providerVerified:true,botBindingVerified:true,membershipVerified:true,
 tenantId:'tenant-A',storeId:'store-A',botId:'bot-A',scopeKey:'customer-0001',actorRole:'CUSTOMER',
 permissions:['catalog:read'],subscriptionStatus:'ACTIVE',shopStatus:'OPEN',sessionExpiresAt:now+60000};
const ev=n=>({channel:'MOCK_WEB',kind:'TEXT',text:n,eventRef:'evt-'+n,menuVersion:'1.1.0'});
function bridge(overrides={}){return createNoSendCoreBridge({clock:()=>now,resolveVerifiedIngress:async()=>({...ctx,...overrides}),
 readCatalog:async req=>({...req,verified:true,sku:'F01',priceVnd:199000,stock:5,observedAt:new Date(now).toISOString()}),...overrides.bridgePorts});}
test('Menu bridge catalog returns QA only, never sends',async()=>{const r=await bridge().route(ev('1'));assert.equal(r.status,'READ_ONLY_PREVIEW');assert.equal(r.ordersWritten,0);assert.equal(r.externalSends,0);});
test('Menu bridge client actorRole not trusted',async()=>{const r=await bridge().route({...ev('2'),actorRole:'OWNER'});assert.equal(r.action_id,'CUS_PRICE');assert.equal(r.status,'READ_ONLY_PREVIEW');});
test('Menu bridge rejects expired session',async()=>{const r=await bridge({sessionExpiresAt:now-1}).route(ev('1'));assert.equal(r.status,'TRUSTED_ROUTE_DENIED');});
test('Menu bridge rejects wrong provider binding',async()=>{const r=await bridge({providerVerified:false}).route(ev('1'));assert.equal(r.status,'TRUSTED_ROUTE_DENIED');});
test('Menu bridge blocks cross-shop catalog port',async()=>{const r=await bridge({bridgePorts:{readCatalog:async req=>({...req,storeId:'store-B',verified:true})}}).route(ev('1'));assert.ok(['READ_BACKEND_FAILED','READBACK_SCOPE_UNVERIFIED'].includes(r.status));});
test('Menu bridge denies Customer Owner operation',async()=>{const r=await bridge().route(ev('OWN_APPROVE_ORDER'));assert.equal(r.status,'UNKNOWN_ACTION');});
test('Menu bridge Owner approval is proposal only',async()=>{const b=bridge({...ctx,actorRole:'OWNER',scopeKey:'owner-0001',permissions:['orders:approve']});const r=await b.route(ev('2'));assert.equal(r.status,'CONFIRMATION_REQUIRED');assert.equal(r.ordersWritten,0);});
test('Menu bridge rejects spoofed Zalo native callback',async()=>{const r=await bridge().route({channel:'ZALO_BOT',kind:'CALLBACK',eventRef:'evt-callback',actionId:'CUS_CATALOG',menuVersion:'1.1.0'});assert.equal(r.status,'TRUSTED_ROUTE_DENIED');});
