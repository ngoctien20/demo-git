'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createHmac}=require('node:crypto');
const {createTrustedPorts,inspectSchema,validateCatalogRow,DB_PROBE,SQL}=require('./trusted-repository.cjs');
const {processCandidate}=require('../messenger-rich-v136m1/integration.cjs');
const {sign}=require('../messenger-rich-v136m/adapter.cjs');
const NOW=Date.parse('2026-11-15T10:00:00.000Z'),now=()=>NOW;
const TA='11111111-1111-4111-8111-111111111111';
const TB='22222222-2222-4222-8222-222222222222';
const SA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const SC='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const PAGE_A='12345678901234567',PAGE_B='98765432109876543',PSID='55555555555555555';
const APP='LOCAL_META_TEST_SIGNING_SECRET_NOT_REAL_1234567890';
const SECRET='LOCAL_ACTION_SIGNING_SECRET_NOT_REAL_0987654321';
const binding=(page=PAGE_A,t=TA,s=SA)=>({page_id:page,tenant_id:t,store_id:s,
 binding_state:'active',owner_verified:true,inbound_enabled:true,binding_version:1,
 store_state:'active',owner_membership_confirmed:true});
const product=(t=TA,s=SA,sku='QA_A001')=>({id:SA,tenant_id:t,store_id:s,
 sku,name:'Sản phẩm kiểm thử',price_vnd:'159000',stock_on_hand:3,is_active:true});
function fixture(overrides={}){
 const queries=[],bindingRows=overrides.bindingRows||{
  [PAGE_A]:[binding(PAGE_A,TA,SA)], [PAGE_B]:[binding(PAGE_B,TA,SB)]
 };
 const products=overrides.products||[product(TA,SA,'QA_A001'),product(TA,SB,'QA_B001'),product(TB,SC,'QA_C001')];
 const readiness={stores_ready:true,store_memberships_ready:true,
  page_bindings_ready:true,products_store_id_ready:true,products_rls_ready:true,
  stores_rls_ready:true,memberships_rls_ready:true,...overrides.readiness};
 const db={readOnly:true,bypassRls:false,authorizedProfile:'RESTRICTED_MESSENGER_READONLY',
  query:async(sql,values)=>{
   queries.push({sql,values});
   if(sql===DB_PROBE)return {rows:[readiness]};
   if(sql===SQL.binding)return {rows:bindingRows[values[0]]||[]};
   if(sql===SQL.catalog){
    if(overrides.rogueCatalog)return {rows:overrides.rogueCatalog};
    return {rows:products.filter(r=>r.tenant_id===values[0]&&
      r.store_id===values[1]&&r.is_active===true).slice(0,values[2])};
   }
   throw Error('UNEXPECTED_DB_STATEMENT');
  }
 };
 const seen=new Set();
 const portsCfg={
  db,
  readPublicConfig:async({tenantId,storeId})=>({
   source:'TRUSTED_PRIVATE_PUBLIC_SHOP_CONFIG',tenantId,storeId,
   shopSlug:storeId===SA?'qa-a':'qa-b',
   webOrigins:['https://shop.example.invalid'],imageOrigins:[]
  }),
  readEntitlement:async({tenantId,storeId})=>({
   source:'TRUSTED_PRIVATE_ENTITLEMENT',tenantId,storeId,
   active:true,botPaused:false,featureEnabled:true,
   expiresAtMs:NOW+15*60*1000
  }),
  replayCheck:async({tenantId,storeId,replayKey,mode})=>{
   const k=tenantId+'|'+storeId+'|'+replayKey,firstSeen=!seen.has(k);
   seen.add(k);
   return {mode,firstSeen,externalWriteOccurred:false};
  },
  mode:'OFFLINE_TEST',now,...overrides.ports
 };
 return {db,queries,portsCfg};
}
async function make(overrides){
 const f=fixture(overrides);
 return {...f,...await createTrustedPorts(f.portsCfg)};
}
async function bindAndEnable(f,page=PAGE_A,psid=PSID){
 const b=await f.ports.resolveBinding({pageId:page,senderPsid:psid});
 await f.ports.readShopStatus({tenantId:b.tenantId,storeId:b.storeId});
 return b;
}
function signedMeta(page=PAGE_A,psid=PSID,action='BROWSE_CATALOG',id='NONE'){
 const trusted={source:'SERVER_VERIFIED_MESSENGER_BINDING',serverDerived:true,verified:true,
   pageId:page,recipientPsid:psid,tenantId:TA,storeId:page===PAGE_A?SA:SB,
   shopSlug:page===PAGE_A?'qa-a':'qa-b',
   imageOrigins:[],webOrigins:['https://shop.example.invalid']};
 const payload=sign({trusted,secret:SECRET,action,itemId:id,now});
 const rawBody=JSON.stringify({object:'page',entry:[{id:page,messaging:[{
  sender:{id:psid},recipient:{id:page},timestamp:NOW,
  postback:{payload,mid:'QA-MID-001'}
 }]}]});
 const signature='sha256='+createHmac('sha256',APP).update(rawBody).digest('hex');
 return {rawBody,signature,appSecret:APP,actionSecret:SECRET,
  siteOrigin:'https://shop.example.invalid',now};
}
test('schema preflight requires all V14.2 canonical and private Page tables',async()=>{
 const {db}=fixture();
 const r=await inspectSchema(db);
 assert.equal(r.status,'SCHEMA_READY_FOR_HOSTED_QA');
 assert.deepEqual(r.missing,[]);
 assert.equal(r.canSendMessenger,false);
});
test('missing public.stores blocks all real and offline createPorts',async()=>{
 const f=fixture({readiness:{stores_ready:false}});
 assert.deepEqual((await inspectSchema(f.db)).missing,['public.stores']);
 await assert.rejects(createTrustedPorts(f.portsCfg),/CANONICAL_STORE_RLS_MISSING/);
});
test('missing store_memberships blocks',async()=>assert.rejects(
 createTrustedPorts(fixture({readiness:{store_memberships_ready:false}}).portsCfg),
 /CANONICAL_STORE_RLS_MISSING/));
test('missing private Messenger binding registry blocks',async()=>assert.rejects(
 createTrustedPorts(fixture({readiness:{page_bindings_ready:false}}).portsCfg),
 /CANONICAL_STORE_RLS_MISSING/));
test('missing products.store_id blocks',async()=>assert.rejects(
 createTrustedPorts(fixture({readiness:{products_store_id_ready:false}}).portsCfg),
 /CANONICAL_STORE_RLS_MISSING/));
test('products RLS disabled blocks',async()=>assert.rejects(
 createTrustedPorts(fixture({readiness:{products_rls_ready:false}}).portsCfg),
 /CANONICAL_STORE_RLS_MISSING/));
test('stores FORCE RLS disabled blocks',async()=>assert.rejects(
 createTrustedPorts(fixture({readiness:{stores_rls_ready:false}}).portsCfg),
 /CANONICAL_STORE_RLS_MISSING/));
test('store_memberships FORCE RLS disabled blocks',async()=>assert.rejects(
 createTrustedPorts(fixture({readiness:{memberships_rls_ready:false}}).portsCfg),
 /CANONICAL_STORE_RLS_MISSING/));
test('reject elevated bypass-RLS DB port',async()=>{
 const f=fixture();f.db.bypassRls=true;
 await assert.rejects(createTrustedPorts(f.portsCfg),/RESTRICTED_DB_PORT_REQUIRED/);
});
test('reject absent read-only DB flag',async()=>{
 const f=fixture();f.db.readOnly=false;
 await assert.rejects(createTrustedPorts(f.portsCfg),/RESTRICTED_DB_PORT_REQUIRED/);
});
test('unknown hosting mode denied',async()=>assert.rejects(
 createTrustedPorts({...fixture().portsCfg,mode:'PRODUCTION_SEND'}),/MODE_NOT_APPROVED/));
test('missing trusted entitlement backend blocked',async()=>assert.rejects(
 createTrustedPorts({...fixture().portsCfg,readEntitlement:null}),/PRIVATE_BACKEND_PORT_MISSING/));
test('private query always exact prepared SELECT placeholders with no writes',async()=>{
 const f=await make(),b=await bindAndEnable(f);
 await f.ports.readCatalog({tenantId:b.tenantId,storeId:b.storeId,readOnly:true,limit:10});
 assert.equal(f.queries.length,3);
 assert.ok(f.queries.every(q=>/^\s*SELECT\b/i.test(q.sql)));
 assert.ok(f.queries.every(q=>!/(\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bALTER\b|\bCREATE\b|\bDROP\b)\s+(?:INTO|TABLE|FROM)/i.test(q.sql)));
 assert.deepEqual(f.queries[1].values,[PAGE_A]);
 assert.deepEqual(f.queries[2].values,[TA,SA,11]);
 assert.match(f.queries[2].sql,/p\.tenant_id=\$1::uuid/);
 assert.match(f.queries[2].sql,/p\.store_id=\$2::uuid/);
});
test('Page A resolves server-selected tenant/store from DB only',async()=>{
 const f=await make(),b=await f.ports.resolveBinding({pageId:PAGE_A,senderPsid:PSID});
 assert.equal(b.tenantId,TA);assert.equal(b.storeId,SA);
 assert.equal(b.pageId,PAGE_A);assert.equal(b.recipientPsid,PSID);
 assert.equal(b.shopSlug,'qa-a');
 assert.equal(Object.isFrozen(b),true);
});
test('Page B of SAME tenant resolves different store',async()=>{
 const f=await make(),b=await f.ports.resolveBinding({pageId:PAGE_B,senderPsid:PSID});
 assert.equal(b.tenantId,TA);assert.equal(b.storeId,SB);assert.equal(b.shopSlug,'qa-b');
});
test('unknown Page always denied',async()=>assert.rejects(
 (await make()).ports.resolveBinding({pageId:'77777777777777777',senderPsid:PSID}),/PAGE_NOT_BOUND/));
test('duplicate Page binding ambiguity denied',async()=>assert.rejects(
 (await make({bindingRows:{[PAGE_A]:[binding(),binding(PAGE_A,TB,SC)]}}))
 .ports.resolveBinding({pageId:PAGE_A,senderPsid:PSID}),/PAGE_AMBIGUOUS/));
test('client tenant claim and SQL injection cannot choose Page binding',async()=>assert.rejects(
 (await make()).ports.resolveBinding({pageId:"1' OR TRUE --",senderPsid:PSID}),/PAGE_SENDER_INVALID/));
test('unverified owner approval denied',async()=>assert.rejects(
 (await make({bindingRows:{[PAGE_A]:[{...binding(),owner_verified:false}]}}))
 .ports.resolveBinding({pageId:PAGE_A,senderPsid:PSID}),/CHANNEL_BINDING_NOT_AUTHORIZED/));
test('missing active store owner membership denied',async()=>assert.rejects(
 (await make({bindingRows:{[PAGE_A]:[{...binding(),owner_membership_confirmed:false}]}}))
 .ports.resolveBinding({pageId:PAGE_A,senderPsid:PSID}),/CHANNEL_BINDING_NOT_AUTHORIZED/));
test('paused store denied at binding stage',async()=>assert.rejects(
 (await make({bindingRows:{[PAGE_A]:[{...binding(),store_state:'paused'}]}}))
 .ports.resolveBinding({pageId:PAGE_A,senderPsid:PSID}),/CHANNEL_BINDING_NOT_AUTHORIZED/));
test('disabled channel denied at binding stage',async()=>assert.rejects(
 (await make({bindingRows:{[PAGE_A]:[{...binding(),inbound_enabled:false}]}}))
 .ports.resolveBinding({pageId:PAGE_A,senderPsid:PSID}),/CHANNEL_BINDING_NOT_AUTHORIZED/));
test('revoked Page binding denied at binding stage',async()=>assert.rejects(
 (await make({bindingRows:{[PAGE_A]:[{...binding(),binding_state:'revoked'}]}}))
 .ports.resolveBinding({pageId:PAGE_A,senderPsid:PSID}),/CHANNEL_BINDING_NOT_AUTHORIZED/));
test('cannot call readCatalog before trusted binding',async()=>assert.rejects(
 (await make()).ports.readCatalog({tenantId:TA,storeId:SA,readOnly:true,limit:10}),/SCOPE_NOT_ISSUED_BY_RESOLVER/));
test('cannot call readCatalog before entitlement validation',async()=>{
 const f=await make(),b=await f.ports.resolveBinding({pageId:PAGE_A,senderPsid:PSID});
 await assert.rejects(f.ports.readCatalog({tenantId:b.tenantId,storeId:b.storeId,readOnly:true,limit:10}),/ENTITLEMENT_GATE_REQUIRED/);
});
test('cannot call readCatalog with foreign store even in same tenant',async()=>{
 const f=await make(),b=await bindAndEnable(f);
 await assert.rejects(f.ports.readCatalog({tenantId:b.tenantId,storeId:SB,readOnly:true,limit:10}),/SCOPE_NOT_ISSUED_BY_RESOLVER/);
});
test('cannot call readCatalog with foreign tenant',async()=>{
 const f=await make();await bindAndEnable(f);
 await assert.rejects(f.ports.readCatalog({tenantId:TB,storeId:SA,readOnly:true,limit:10}),/SCOPE_NOT_ISSUED_BY_RESOLVER/);
});
test('Page A reads only product A not product B in same tenant',async()=>{
 const f=await make(),b=await bindAndEnable(f);
 const d=await f.ports.readCatalog({tenantId:b.tenantId,storeId:b.storeId,readOnly:true,limit:10});
 assert.equal(d.rows.length,1);assert.equal(d.rows[0].sku,'QA_A001');
 assert.equal(d.isolationProof,'STORE_RLS_VERIFIED');assert.equal(d.repositoryScope,'SERVER_STORE_BOUND');
});
test('Page B reads only product B in SAME tenant',async()=>{
 const f=await make(),b=await bindAndEnable(f,PAGE_B);
 const d=await f.ports.readCatalog({tenantId:b.tenantId,storeId:b.storeId,readOnly:true,limit:10});
 assert.equal(d.rows.length,1);assert.equal(d.rows[0].sku,'QA_B001');
});
test('buggy DB response with Shop B product in Shop A is rejected (defense in depth)',async()=>{
 const f=await make({rogueCatalog:[product(TA,SB,'QA_B001')]}),b=await bindAndEnable(f);
 await assert.rejects(f.ports.readCatalog({tenantId:b.tenantId,storeId:b.storeId,readOnly:true,limit:10}),
 /CATALOG_ROW_SCOPE_INVALID/);
});
test('negative money rejected even from supposedly trusted database',()=>assert.throws(
 ()=>validateCatalogRow({...product(),price_vnd:'-100'},TA,SA),/CATALOG_PRICE_INVALID/));
test('formatted price rejected to prevent 0 or 159 conversion',()=>assert.throws(
 ()=>validateCatalogRow({...product(),price_vnd:'159.000đ'},TA,SA),/CATALOG_PRICE_INVALID/));
test('unsafe VND bigint rejected',()=>assert.throws(
 ()=>validateCatalogRow({...product(),price_vnd:'9999999999999999'},TA,SA),/CATALOG_PRICE_INVALID/));
test('negative stock denied',()=>assert.throws(
 ()=>validateCatalogRow({...product(),stock_on_hand:-1},TA,SA),/CATALOG_ROW_SCOPE_INVALID/));
test('same tenant cross-store row denied',()=>assert.throws(
 ()=>validateCatalogRow(product(TA,SB),TA,SA),/CATALOG_ROW_SCOPE_INVALID/));
test('cross tenant row denied',()=>assert.throws(
 ()=>validateCatalogRow(product(TB,SA),TA,SA),/CATALOG_ROW_SCOPE_INVALID/));
test('catalog requests must be read-only',async()=>{
 const f=await make(),b=await bindAndEnable(f);
 await assert.rejects(f.ports.readCatalog({tenantId:b.tenantId,storeId:b.storeId,readOnly:false,limit:10}),/CATALOG_READ_SCOPE_REQUIRED/);
});
test('catalog unbounded read rejected',async()=>{
 const f=await make(),b=await bindAndEnable(f);
 await assert.rejects(f.ports.readCatalog({tenantId:b.tenantId,storeId:b.storeId,readOnly:true,limit:1000}),/CATALOG_READ_SCOPE_REQUIRED/);
});
test('unknown entitlement provider result fails closed',async()=>{
 const f=await make({ports:{readEntitlement:async()=>null}});
 const b=await f.ports.resolveBinding({pageId:PAGE_A,senderPsid:PSID});
 await assert.rejects(f.ports.readShopStatus({tenantId:b.tenantId,storeId:b.storeId}),/SHOP_OR_SUBSCRIPTION_UNAUTHORIZED/);
});
test('expired entitlement denies',async()=>{
 const f=await make({ports:{readEntitlement:async()=>({
 source:'TRUSTED_PRIVATE_ENTITLEMENT',tenantId:TA,storeId:SA,
 active:true,botPaused:false,featureEnabled:true,expiresAtMs:NOW-1})}});
 const b=await f.ports.resolveBinding({pageId:PAGE_A,senderPsid:PSID});
 await assert.rejects(f.ports.readShopStatus({tenantId:b.tenantId,storeId:b.storeId}),/SHOP_OR_SUBSCRIPTION_UNAUTHORIZED/);
});
test('missing shop public catalog origin blocks binding',async()=>{
 const f=await make({ports:{readPublicConfig:async()=>({
 source:'TRUSTED_PRIVATE_PUBLIC_SHOP_CONFIG',tenantId:TA,storeId:SA,
 shopSlug:'qa-a',webOrigins:['http://evil.example'],imageOrigins:[]})}});
 await assert.rejects(f.ports.resolveBinding({pageId:PAGE_A,senderPsid:PSID}),/PUBLIC_SHOP_CONFIG_UNVERIFIED/);
});
test('replay guard is strictly DRY_RUN and rejects external writes',async()=>{
 const f=await make(),b=await bindAndEnable(f);
 await assert.rejects(f.ports.checkAndReserveEvent({tenantId:b.tenantId,storeId:b.storeId,
 replayKey:'a'.repeat(64),mode:'LIVE'}),/REPLAY_DRY_RUN_ONLY/);
});
test('dry-run replay checks suppress duplicate only within same safe scope',async()=>{
 const f=await make(),b=await bindAndEnable(f),args={
  tenantId:b.tenantId,storeId:b.storeId,replayKey:'a'.repeat(64),mode:'DRY_RUN'};
 assert.equal((await f.ports.checkAndReserveEvent(args)).firstSeen,true);
 assert.equal((await f.ports.checkAndReserveEvent(args)).firstSeen,false);
});
test('full Meta signed Page A webhook maps ONLY A catalog and never sends',async()=>{
 const f=await make();
 const result=await processCandidate({...signedMeta(PAGE_A),ports:f.ports});
 const ev=result.events[0];const card=ev.prepared.body.message.attachment.payload.elements[0];
 assert.equal(ev.route,'BROWSE_CATALOG');
 assert.equal(card.title,'Sản phẩm kiểm thử');
 assert.match(card.subtitle,/159\.000/);
 assert.equal(ev.prepared.sendEnabled,false);
 assert.equal(ev.allowedOrderWrites,false);
 assert.equal(result.sendEnabled,false);
});
test('full Meta signed Page B same tenant maps ONLY B store catalog',async()=>{
 const f=await make();
 const out=await processCandidate({...signedMeta(PAGE_B),ports:f.ports});
 const card=out.events[0].prepared.body.message.attachment.payload.elements[0];
 assert.equal(card.title,'Sản phẩm kiểm thử');
 assert.equal(out.events[0].route,'BROWSE_CATALOG');
 assert.equal(out.sendEnabled,false);
 assert.deepEqual(f.queries.filter(q=>q.sql===SQL.catalog).map(q=>q.values),[[TA,SB,101]]);
});
test('same Page tampered signature prevents all DB lookups',async()=>{
 const f=await make();
 await assert.rejects(processCandidate({...signedMeta(PAGE_A),
 signature:'sha256='+'0'.repeat(64),ports:f.ports}),/META_SIGNATURE_INVALID/);
 assert.deepEqual(f.queries.filter(q=>q.sql===SQL.binding),[]);
});
test('tampered action payload cannot choose foreign store',async()=>{
 const f=await make();
 const v=signedMeta(PAGE_A),x=JSON.parse(v.rawBody);
 x.entry[0].messaging[0].postback.payload='T404M1.invalid.forged';
 v.rawBody=JSON.stringify(x);
 v.signature='sha256='+createHmac('sha256',APP).update(v.rawBody).digest('hex');
 await assert.rejects(processCandidate({...v,ports:f.ports}),/ACTION_PAYLOAD_INVALID/);
});
test('Page binding verified for A cannot accept Page B signed event',async()=>{
 const f=await make({bindingRows:{[PAGE_B]:[{...binding(PAGE_A,TA,SA)}]}});
 await assert.rejects(processCandidate({...signedMeta(PAGE_B),ports:f.ports}),/CHANNEL_BINDING_NOT_AUTHORIZED/);
});
