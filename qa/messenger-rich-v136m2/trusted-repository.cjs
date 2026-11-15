'use strict';
/**
 * TIEN404 V13.6M.2 — Trusted Messenger Page/Store + Catalog repository.
 * NO credentials, networking, Meta sender, SQL writes or external service imports.
 * PRIVATE server must inject a truly restricted read-only DB connection.
 * Current staging lacks the schema below: live access must FAIL CLOSED.
 */
const PAGE=/^[0-9]{5,30}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SKU=/^[A-Za-z0-9_-]{1,64}$/;
const SHA=/^[a-f0-9]{64}$/;
const MAX_ROWS=100;
const REQUIRED_SCHEMA=Object.freeze(['public.stores','public.store_memberships',
 'app_private.messenger_page_bindings','public.products.store_id']);
const DB_PROBE=[
 "SELECT",
 "to_regclass('public.stores') IS NOT NULL AS stores_ready,",
 "to_regclass('public.store_memberships') IS NOT NULL AS store_memberships_ready,",
 "to_regclass('app_private.messenger_page_bindings') IS NOT NULL AS page_bindings_ready,",
 "EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'",
 "AND table_name='products' AND column_name='store_id') AS products_store_id_ready,",
 "EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace",
 "WHERE n.nspname='public' AND c.relname='products'",
 "AND c.relrowsecurity AND c.relforcerowsecurity) AS products_rls_ready,",
 "EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace",
 "WHERE n.nspname='public' AND c.relname='stores'",
 "AND c.relrowsecurity AND c.relforcerowsecurity) AS stores_rls_ready,",
 "EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace",
 "WHERE n.nspname='public' AND c.relname='store_memberships'",
 "AND c.relrowsecurity AND c.relforcerowsecurity) AS memberships_rls_ready"
].join('\n');
const SQL=Object.freeze({
 binding:[
 "SELECT b.page_id, b.tenant_id::text AS tenant_id, b.store_id::text AS store_id,",
 "b.state AS binding_state, b.owner_verified, b.inbound_enabled,",
 "b.version AS binding_version, s.status AS store_state,",
 "EXISTS (SELECT 1 FROM public.store_memberships sm",
 "JOIN public.tenant_memberships tm ON tm.tenant_id=sm.tenant_id",
 "AND tm.user_id=sm.user_id AND tm.active=true",
 "WHERE sm.tenant_id=b.tenant_id AND sm.store_id=b.store_id",
 "AND sm.active=true AND sm.role IN ('SHOP_OWNER','SHOP_MANAGER')) AS owner_membership_confirmed",
 "FROM app_private.messenger_page_bindings b",
 "JOIN public.stores s ON s.id=b.store_id AND s.tenant_id=b.tenant_id",
 "WHERE b.page_id=$1 LIMIT 2"
 ].join('\n'),
 catalog:[
 "SELECT p.id::text AS id, p.tenant_id::text AS tenant_id,",
 "p.store_id::text AS store_id, p.sku, p.name,",
 "p.price_vnd::text AS price_vnd, p.stock_on_hand, p.is_active",
 "FROM public.products p",
 "JOIN public.stores s ON s.id=p.store_id AND s.tenant_id=p.tenant_id",
 "WHERE p.tenant_id=$1::uuid AND p.store_id=$2::uuid",
 "AND p.is_active=true AND s.status='active'",
 "ORDER BY p.sku ASC LIMIT $3"
 ].join('\n')
});
class Denied extends Error{constructor(code){super(code);this.name='Denied';this.code=code}}
const reject=code=>{throw new Denied(code)};
const validHttpsOrigin=u=>{
 if(typeof u!=='string')return false;
 try{const x=new URL(u);return x.origin===u&&x.protocol==='https:'&&!x.username&&!x.password&&!x.hash}
 catch{return false}
};
function assertRestrictedDb(db){
 if(!db||db.readOnly!==true||db.bypassRls!==false||
    typeof db.query!=='function'||db.authorizedProfile!=='RESTRICTED_MESSENGER_READONLY')
   reject('RESTRICTED_DB_PORT_REQUIRED');
}
function safeRows(r,max=MAX_ROWS+1){
 if(!r||!Array.isArray(r.rows)||r.rows.length>max)reject('DB_RESPONSE_INVALID');
 return r.rows;
}
function validateCatalogRow(row,t,s){
 if(!row||row.tenant_id!==t||row.store_id!==s||row.is_active!==true||
    !SKU.test(row.sku||'')||typeof row.name!=='string'||!row.name.trim()||
    Array.from(row.name.trim()).length>80||/[\u0000-\u001f\u007f]/.test(row.name)||
    !Number.isSafeInteger(row.stock_on_hand)||row.stock_on_hand<0)
    reject('CATALOG_ROW_SCOPE_INVALID');
 if(typeof row.price_vnd!=='string'||!/^(0|[1-9][0-9]{0,15})$/.test(row.price_vnd)||
    BigInt(row.price_vnd)>BigInt(Number.MAX_SAFE_INTEGER))reject('CATALOG_PRICE_INVALID');
 return Object.freeze({tenant_id:t,store_id:s,sku:row.sku,name:row.name.trim(),
    price_vnd:row.price_vnd,stock_on_hand:row.stock_on_hand,is_active:true});
}
async function inspectSchema(db){
 assertRestrictedDb(db);
 const rows=safeRows(await db.query(DB_PROBE,[]),1);
 if(rows.length!==1)reject('SCHEMA_INSPECTION_UNVERIFIED');
 const r=rows[0],missing=[];
 if(r.stores_ready!==true)missing.push('public.stores');
 if(r.store_memberships_ready!==true)missing.push('public.store_memberships');
 if(r.page_bindings_ready!==true)missing.push('app_private.messenger_page_bindings');
 if(r.products_store_id_ready!==true)missing.push('public.products.store_id');
 if(r.products_rls_ready!==true)missing.push('products FORCE RLS');
 if(r.stores_rls_ready!==true)missing.push('stores FORCE RLS');
 if(r.memberships_rls_ready!==true)missing.push('store_memberships FORCE RLS');
 return Object.freeze({status:missing.length?'BLOCKED':'SCHEMA_READY_FOR_HOSTED_QA',
    missing,canSendMessenger:false,canWriteOrders:false,canModifySchema:false});
}
/**
 * Per-request private ports. The only trusted scope comes from exact page binding,
 * active store and active owner/manager membership in authoritative DB.
 * Demo fixtures may simulate the DB contract but do not authorize live access.
 */
async function createTrustedPorts({db,readEntitlement,readPublicConfig,replayCheck,
 mode='OFFLINE_TEST',now=Date.now}={}){
 assertRestrictedDb(db);
 if(mode!=='OFFLINE_TEST'&&mode!=='HOSTED_READ_ONLY')reject('MODE_NOT_APPROVED');
 if(typeof readEntitlement!=='function'||typeof readPublicConfig!=='function'||
    typeof replayCheck!=='function'||typeof now!=='function')reject('PRIVATE_BACKEND_PORT_MISSING');
 const gate=await inspectSchema(db);
 if(gate.status!=='SCHEMA_READY_FOR_HOSTED_QA')reject('CANONICAL_STORE_RLS_MISSING');
 const issuedScopes=new Map();
 const key=(t,s)=>t+'|'+s;
 function scope(t,s){
   const result=issuedScopes.get(key(t,s));
   if(!result||result.closed===true)reject('SCOPE_NOT_ISSUED_BY_RESOLVER');
   return result;
 }
 async function getConfig(t,s){
  const x=await readPublicConfig({tenantId:t,storeId:s,mode});
  if(!x||x.source!=='TRUSTED_PRIVATE_PUBLIC_SHOP_CONFIG'||
     x.tenantId!==t||x.storeId!==s||!SKU.test(x.shopSlug||'')||
     !Array.isArray(x.webOrigins)||x.webOrigins.length<1||
     !x.webOrigins.every(validHttpsOrigin)||!Array.isArray(x.imageOrigins)||
     !x.imageOrigins.every(validHttpsOrigin))reject('PUBLIC_SHOP_CONFIG_UNVERIFIED');
  return x;
 }
 const ports={
  async resolveBinding({pageId,senderPsid}={}){
   if(!PAGE.test(pageId||'')||!PAGE.test(senderPsid||''))reject('PAGE_SENDER_INVALID');
   const rows=safeRows(await db.query(SQL.binding,[pageId]),2);
   if(rows.length!==1)reject(rows.length===0?'PAGE_NOT_BOUND':'PAGE_AMBIGUOUS');
   const b=rows[0];
   if(b.page_id!==pageId||!UUID.test(b.tenant_id||'')||!UUID.test(b.store_id||'')||
      b.binding_state!=='active'||b.owner_verified!==true||
      b.inbound_enabled!==true||!Number.isInteger(b.binding_version)||b.binding_version<1||
      b.store_state!=='active'||b.owner_membership_confirmed!==true)
      reject('CHANNEL_BINDING_NOT_AUTHORIZED');
   const config=await getConfig(b.tenant_id,b.store_id);
   const prior=issuedScopes.get(key(b.tenant_id,b.store_id));
   if(prior&&(prior.pageId!==pageId||prior.senderPsid!==senderPsid))
     reject('SCOPE_REUSE_ACROSS_PAGE_OR_SENDER');
   issuedScopes.set(key(b.tenant_id,b.store_id),{pageId,senderPsid,
      bindingVersion:b.binding_version,entitlementChecked:false,closed:false});
   return Object.freeze({source:'SERVER_VERIFIED_MESSENGER_BINDING',
    verified:true,serverDerived:true,pageId,recipientPsid:senderPsid,
    tenantId:b.tenant_id,storeId:b.store_id,shopSlug:config.shopSlug,
    webOrigins:config.webOrigins,imageOrigins:config.imageOrigins});
  },
  async readShopStatus({tenantId,storeId}={}){
   const proof=scope(tenantId,storeId);
   const p=await readEntitlement({tenantId,storeId,pageId:proof.pageId,
     bindingVersion:proof.bindingVersion,mode});
   if(!p||p.source!=='TRUSTED_PRIVATE_ENTITLEMENT'||
      p.tenantId!==tenantId||p.storeId!==storeId||
      p.active!==true||p.botPaused!==false||p.featureEnabled!==true||
      !Number.isSafeInteger(p.expiresAtMs)||p.expiresAtMs<=now())
      reject('SHOP_OR_SUBSCRIPTION_UNAUTHORIZED');
   proof.entitlementChecked=true;
   return Object.freeze({source:'SERVER_VERIFIED_SHOP_STATUS',tenantId,storeId,
    active:true,botPaused:false,entitlement:'MESSENGER_RICH_UI_CANDIDATE',
    expiresAt:new Date(p.expiresAtMs).toISOString()});
  },
  async readCatalog({tenantId,storeId,readOnly,limit}={}){
   const proof=scope(tenantId,storeId);
   if(proof.entitlementChecked!==true)reject('ENTITLEMENT_GATE_REQUIRED');
   if(readOnly!==true||!Number.isInteger(limit)||limit<1||limit>MAX_ROWS)
     reject('CATALOG_READ_SCOPE_REQUIRED');
   const rows=safeRows(await db.query(SQL.catalog,[tenantId,storeId,limit+1]));
   if(rows.length>limit)reject('CATALOG_LIMIT_EXCEEDED');
   const safe=rows.map(x=>validateCatalogRow(x,tenantId,storeId));
   if(new Set(safe.map(x=>x.sku)).size!==safe.length)
     reject('CATALOG_DUPLICATE_SKU');
   return Object.freeze({source:'SERVER_VERIFIED_TENANT_CATALOG',tenantId,storeId,
    repositoryScope:'SERVER_STORE_BOUND',readOnly:true,serverAuthorized:true,
    isolationProof:'STORE_RLS_VERIFIED',rows:safe});
  },
  async checkAndReserveEvent({tenantId,storeId,replayKey,mode:requested}={}){
   const proof=scope(tenantId,storeId);
   if(proof.entitlementChecked!==true)reject('ENTITLEMENT_GATE_REQUIRED');
   if(requested!=='DRY_RUN'||!SHA.test(replayKey||''))reject('REPLAY_DRY_RUN_ONLY');
   const r=await replayCheck({tenantId,storeId,pageId:proof.pageId,
     senderPsid:proof.senderPsid,bindingVersion:proof.bindingVersion,
     replayKey,mode:'DRY_RUN'});
   if(!r||r.mode!=='DRY_RUN'||typeof r.firstSeen!=='boolean'||
      r.externalWriteOccurred!==false)reject('REPLAY_CHECK_NOT_SAFE');
   return {source:'SERVER_VERIFIED_REPLAY_GUARD',tenantId,storeId,
     firstSeen:r.firstSeen,mode:'DRY_RUN'};
  }
 };
 return Object.freeze({ports:Object.freeze(ports),gate,mode});
}
module.exports={createTrustedPorts,inspectSchema,validateCatalogRow,
 Denied,REQUIRED_SCHEMA,DB_PROBE,SQL};
