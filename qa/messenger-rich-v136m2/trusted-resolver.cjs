'use strict';
// TIEN404 V13.6M.2 — server-side contract, NO DB connection, NO Meta send.
// Instantiate ONLY inside a trusted backend with a separately authorized repository.
// The example tests inject synthetic QA stores; that is not hosted RLS evidence.
const {processCandidate}=require('../messenger-rich-v136m1/integration.cjs');
const ID=/^[A-Za-z0-9_-]{1,64}$/, PAGE=/^\d{5,30}$/, HASH=/^[a-f0-9]{64}$/;
const deny=code=>{const e=new Error(code);e.code=code;throw e};
const validId=x=>typeof x==='string'&&ID.test(x);
const isOrigin=x=>{try{const u=new URL(x);return u.protocol==='https:'&&!u.username&&!u.password&&!u.hash&&u.pathname==='/'&&!u.search}catch{return false}};
function createTrustedPorts({repository,mode='BLOCKED',now=Date.now}={}){
  // A compiled module cannot prove a runtime backend: a backend must supply a
  // server-owned repository. In absence of verified schema/session, fail closed.
  const required=['findPageBindingRows','findStoreRuntime','findCatalogPolicy','readStoreCatalog'];
  if(!repository||required.some(k=>typeof repository[k]!=='function'))
    deny('TRUSTED_SERVER_REPOSITORY_REQUIRED');
  if(mode!=='SYNTHETIC_QA_ONLY'&&mode!=='HOSTED_STORE_RLS_VERIFIED')
    deny('HOSTED_STORE_RLS_NOT_APPROVED');
  const authorized=new Map(),replay=new Set();
  const scope=(tenantId,storeId)=>{
    const key=tenantId+'|'+storeId,bind=authorized.get(key);
    if(!bind||!validId(tenantId)||!validId(storeId))deny('UNRESOLVED_SHOP_SCOPE');
    return bind;
  };
  return Object.freeze({
    async resolveBinding({pageId,senderPsid}={}){
      if(!PAGE.test(pageId||'')||!PAGE.test(senderPsid||''))deny('META_PAGE_PSID_INVALID');
      // No tenant_id/store_id supplied by the incoming user may be used.
      const rows=await repository.findPageBindingRows({provider:'MESSENGER',pageId});
      if(!Array.isArray(rows)||rows.length!==1)deny('PAGE_BINDING_NOT_UNIQUE');
      const b=rows[0];
      if(!b||b.provider!=='MESSENGER'||b.page_id!==pageId||
        b.verified!==true||b.enabled!==true||b.status!=='ACTIVE'||
        !validId(b.tenant_id)||!validId(b.store_id)||!validId(b.shop_slug)||
        !Array.isArray(b.web_origins)||!b.web_origins.length||
        b.web_origins.some(x=>!isOrigin(x))||
        !Array.isArray(b.image_origins)||b.image_origins.some(x=>!isOrigin(x)))
        deny('PAGE_BINDING_UNVERIFIED');
      const binding=Object.freeze({
        source:'SERVER_VERIFIED_MESSENGER_BINDING',serverDerived:true,verified:true,
        pageId,recipientPsid:senderPsid,tenantId:b.tenant_id,storeId:b.store_id,
        shopSlug:b.shop_slug,webOrigins:b.web_origins.map(x=>new URL(x).origin),
        imageOrigins:b.image_origins.map(x=>new URL(x).origin)
      });
      const key=b.tenant_id+'|'+b.store_id;
      const prior=authorized.get(key);
      if(prior&&prior.pageId!==pageId)deny('MULTIPLE_PAGES_SAME_REQUEST_SCOPE');
      authorized.set(key,binding);
      return binding;
    },
    async readShopStatus({tenantId,storeId}={}){
      scope(tenantId,storeId);
      const s=await repository.findStoreRuntime({tenantId,storeId});
      if(!s||s.tenant_id!==tenantId||s.store_id!==storeId||
        typeof s.active!=='boolean'||typeof s.bot_paused!=='boolean'||
        s.entitlement!=='MESSENGER_RICH_UI_CANDIDATE'||
        !Number.isFinite(Date.parse(s.expires_at)))deny('STORE_STATUS_SOURCE_UNVERIFIED');
      return {source:'SERVER_VERIFIED_SHOP_STATUS',tenantId,storeId,
        active:s.active,botPaused:s.bot_paused,entitlement:s.entitlement,
        expiresAt:s.expires_at};
    },
    async readCatalog({tenantId,storeId,readOnly,limit}={}){
      scope(tenantId,storeId);
      if(readOnly!==true||!Number.isInteger(limit)||limit<1||limit>100)
        deny('CATALOG_READ_ONLY_LIMIT_REQUIRED');
      const p=await repository.findCatalogPolicy({tenantId,storeId});
      if(!p||p.tenant_id!==tenantId||p.store_id!==storeId||
        p.store_column_verified!==true||p.store_authorization_verified!==true||
        p.read_only!==true||p.mode!==mode||
        (mode==='HOSTED_STORE_RLS_VERIFIED' &&
          (p.hosted_user_jwt_verified!==true||p.same_tenant_store_rls_tested!==true)))
        deny('CATALOG_STORE_RLS_PROOF_REQUIRED');
      const rows=await repository.readStoreCatalog({tenantId,storeId,limit,readOnly:true});
      if(!Array.isArray(rows)||rows.length>limit||
        rows.some(r=>!r||r.tenant_id!==tenantId||r.store_id!==storeId))
        deny('CROSS_STORE_CATALOG_ROW_DENIED');
      return {source:'SERVER_VERIFIED_TENANT_CATALOG',tenantId,storeId,
        serverAuthorized:true,readOnly:true,isolationProof:'STORE_RLS_VERIFIED',
        repositoryScope:'SERVER_STORE_BOUND',rows};
    },
    async checkAndReserveEvent({tenantId,storeId,channel,replayKey,mode:requestMode}={}){
      scope(tenantId,storeId);
      if(channel!=='MESSENGER'||requestMode!=='DRY_RUN'||!HASH.test(replayKey||''))
        deny('REPLAY_DRY_RUN_ONLY');
      const key=tenantId+'|'+storeId+'|'+replayKey,firstSeen=!replay.has(key);
      replay.add(key);
      // This is in-memory DRY_RUN idempotency only. Not a persistent outbox.
      return {source:'SERVER_VERIFIED_REPLAY_GUARD',tenantId,storeId,
        firstSeen,mode:'DRY_RUN',persistent:false};
    }
  });
}
async function processV136M2({repository,mode='BLOCKED',rawBody,signature,appSecret,
  actionSecret,siteOrigin,now=Date.now}={}){
  const ports=createTrustedPorts({repository,mode,now});
  const preview=await processCandidate({ports,rawBody,signature,appSecret,
    actionSecret,siteOrigin,now});
  return {...preview,stage:'MESSENGER_RICH_UI_V136M2',
    previewOnly:true,sendEnabled:false,allowedOrderWrites:false,
    persistentReplayReady:false,hostedReady:false};
}
module.exports={createTrustedPorts,processV136M2};
