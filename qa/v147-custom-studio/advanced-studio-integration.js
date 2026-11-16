'use strict';
/* TIEN404 V15.2 ADV.4
 * Optional Advanced Custom Bot Studio extension for the existing V14.7 Lab.
 * NO NETWORK / NO STORAGE / NO MODEL / NO PROVIDER SEND / NO ACTION EXECUTION.
 * Version snapshots are in-memory test fixtures, NOT merchant approval or hosted versions.
 */
(function(factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof window!=='undefined')Object.defineProperty(window,'T404AdvancedStudioV4',{value:api,writable:false});
})(function(){
  const PRESETS=Object.freeze(['BALANCED','PRODUCT_FIRST','TEXT_FIRST']);
  const CTA=Object.freeze(['VIEW_CATALOG','REQUEST_QUOTE','ASK_STAFF','VIEW_POLICY',
    'ORDER_REQUEST_DRAFT','TRACK_ORDER','OPEN_VERIFIED_LINK']);
  const ACTORS=Object.freeze(['INTERNAL_STAFF_QA','MERCHANT_QA']);
  const FIELDS=Object.freeze(['presentationPreset','ctaAction','mediaRef','linkRef']);
  const clone=x=>JSON.parse(JSON.stringify(x));
  const fail=s=>{throw Error(s)};
  const REF=/^[A-Z0-9][A-Z0-9_]{0,63}$/;
  const ASSETS=Object.freeze({
    A:Object.freeze([{ref:'QA_A_PRODUCT_PHOTO',type:'IMAGE',name:'Ảnh gạo QA — chưa có URL'},
       {ref:'QA_A_CATALOG_LINK',type:'LINK',name:'Danh mục A QA — chưa duyệt domain'}]),
    B:Object.freeze([{ref:'QA_B_PRODUCT_PHOTO',type:'IMAGE',name:'Ảnh áo QA — chưa có URL'},
       {ref:'QA_B_CATALOG_LINK',type:'LINK',name:'Danh mục B QA — chưa duyệt domain'}]),
    C:Object.freeze([{ref:'QA_C_PRODUCT_PHOTO',type:'IMAGE',name:'Ảnh xi măng QA — chưa có URL'},
       {ref:'QA_C_CATALOG_LINK',type:'LINK',name:'Danh mục C QA — chưa duyệt domain'}])
  });
  function createStudioIntegration({studioApi,registry,policy,intelligence,baseReader}={}){
    if(!studioApi||!studioApi.FIXTURES||!registry||!registry.CHANNELS||
       !policy||typeof policy.compile!=='function'||!intelligence||
       typeof intelligence.validateModelOutput!=='function'||typeof baseReader!=='function')
      fail('ADV4_TRUSTED_DEPENDENCIES_REQUIRED');
    const drafts=new Map(),histories=new Map(),audit=[];
    const stores=studioApi.FIXTURES;
    function key(shop,channel){
      if(!Object.hasOwn(stores,shop)||!registry.CHANNELS.includes(channel))fail('ADV4_STORE_CHANNEL_DENIED');
      return stores[shop].tenantId+':'+stores[shop].storeId+':'+channel;
    }
    function base(shop,channel){
      key(shop,channel);
      const f=stores[shop],cfg=baseReader(shop,channel);
      if(!cfg||cfg.tenant_id!==f.tenantId||cfg.store_id!==f.storeId||
         cfg.channel!==channel||cfg.approval_status!=='EXPERIMENTAL'||
         cfg.policy_version!=='GLOBAL_CORE_LOCKED'||
         !Number.isSafeInteger(cfg.bot_profile_version)||cfg.bot_profile_version<1)
        fail('ADV4_UNTRUSTED_BASE_SCOPE');
      return clone(cfg);
    }
    function initial(shop,channel){
      const b=base(shop,channel),f=stores[shop];
      return {
       kind:'T404_ADV4_OPTIONAL_CONFIG_DRAFT_V1',tenant_id:f.tenantId,store_id:f.storeId,
       channel,sourceShop:shop,baseBotVersion:b.bot_profile_version,
       revision:1,revisionOf:null,approval_status:'EXPERIMENTAL',approved_by:null,
       published_at:null,releaseAuthorized:false,merchantEntitlementVerified:false,
       accountCapabilityVerified:false,presentationPreset:'BALANCED',
       ctaAction:'VIEW_CATALOG',mediaRef:'NONE',linkRef:'NONE',
       syntheticOnly:true,providerSends:0,customerDataReads:0,hostedWrites:0
      };
    }
    function ensure(shop,channel){
      const k=key(shop,channel);
      if(!drafts.has(k)){
        const item=initial(shop,channel);
        drafts.set(k,item);histories.set(k,[clone(item)]);
      }
      return k;
    }
    function get(shop,channel){return clone(drafts.get(ensure(shop,channel)))}
    function assets(shop){
      if(!Object.hasOwn(ASSETS,shop))fail('ADV4_UNKNOWN_ASSET_STORE');
      return clone(ASSETS[shop].map(x=>({...x,approvedUrl:null,providerVerified:false,
        merchantConsentVerified:false,qaOnly:true})));
    }
    function validateRef(shop,ref,type){
      if(ref==='NONE')return;
      if(typeof ref!=='string'||!REF.test(ref)||
         !ASSETS[shop].some(x=>x.ref===ref&&x.type===type))
        fail('ADV4_ASSET_STORE_SCOPE_DENIED');
    }
    function auditEntry(event,shop,channel,revision,fields){
      audit.push({event,shop,channel,revision,fields:fields.slice(),evidence:'QA_IN_MEMORY_ONLY'});
    }
    function save(shop,channel,patch,{actor='INTERNAL_STAFF_QA',expectedRevision,expectedBaseVersion}={}){
      const k=ensure(shop,channel),old=get(shop,channel),currentBase=base(shop,channel);
      if(!ACTORS.includes(actor))fail('ADV4_ACTOR_DENIED');
      if(expectedRevision!==old.revision)fail('ADV4_STALE_REVISION');
      if(expectedBaseVersion!==old.baseBotVersion||
         currentBase.bot_profile_version!==old.baseBotVersion)
        fail('ADV4_STALE_BASE_CONFIG');
      if(!patch||typeof patch!=='object'||Array.isArray(patch))fail('ADV4_PATCH_INVALID');
      const changed=Object.keys(patch);
      if(!changed.length||changed.some(x=>!FIELDS.includes(x)))fail('ADV4_POLICY_SCOPE_LOCKED');
      if(actor==='MERCHANT_QA'&&changed.includes('ctaAction')&&
         !['VIEW_CATALOG','REQUEST_QUOTE','ASK_STAFF','VIEW_POLICY'].includes(patch.ctaAction))
        fail('ADV4_MERCHANT_SENSITIVE_ACTION_DENIED');
      const next=clone(old);
      for(const field of changed){
        const v=patch[field];
        if(field==='presentationPreset'){
          if(!PRESETS.includes(v))fail('ADV4_PRESET_DENIED');
        }else if(field==='ctaAction'){
          if(!CTA.includes(v))fail('ADV4_ACTION_DENIED');
        }else if(field==='mediaRef')validateRef(shop,v,'IMAGE');
        else if(field==='linkRef')validateRef(shop,v,'LINK');
        next[field]=v;
      }
      next.revision=old.revision+1;next.revisionOf=old.revision;
      next.approval_status='EXPERIMENTAL';next.approved_by=null;
      next.published_at=null;next.releaseAuthorized=false;
      drafts.set(k,next);histories.get(k).push(clone(next));
      auditEntry('SAVE_DRAFT',shop,channel,next.revision,changed);
      return clone(next);
    }
    function rebase(shop,channel,{actor='INTERNAL_STAFF_QA',expectedRevision}={}){
      if(actor!=='INTERNAL_STAFF_QA')fail('ADV4_REBASE_REQUIRES_INTERNAL_QA');
      const k=ensure(shop,channel),old=get(shop,channel),current=base(shop,channel);
      if(expectedRevision!==old.revision)fail('ADV4_STALE_REVISION');
      if(current.bot_profile_version===old.baseBotVersion)fail('ADV4_NO_REBASE_REQUIRED');
      const next={...old,baseBotVersion:current.bot_profile_version,
        revision:old.revision+1,revisionOf:old.revision,releaseAuthorized:false};
      drafts.set(k,next);histories.get(k).push(clone(next));
      auditEntry('REBASE_DRAFT',shop,channel,next.revision,['baseBotVersion']);
      return clone(next);
    }
    function history(shop,channel){
      return clone(histories.get(ensure(shop,channel)));
    }
    function rollback(shop,channel,target,{actor='INTERNAL_STAFF_QA',expectedRevision}={}){
      if(actor!=='INTERNAL_STAFF_QA')fail('ADV4_ROLLBACK_REQUIRES_INTERNAL_QA');
      const k=ensure(shop,channel),old=get(shop,channel),currentBase=base(shop,channel);
      if(expectedRevision!==old.revision)fail('ADV4_STALE_REVISION');
      const record=histories.get(k).find(x=>x.revision===target);
      if(!record||target===old.revision)fail('ADV4_ROLLBACK_TARGET_DENIED');
      if(currentBase.bot_profile_version!==old.baseBotVersion||
         record.baseBotVersion!==currentBase.bot_profile_version)
        fail('ADV4_ROLLBACK_BASE_MISMATCH');
      const next={...clone(record),revision:old.revision+1,revisionOf:target,
        approval_status:'EXPERIMENTAL',approved_by:null,published_at:null,
        releaseAuthorized:false,merchantEntitlementVerified:false,
        accountCapabilityVerified:false};
      drafts.set(k,next);histories.get(k).push(clone(next));
      auditEntry('ROLLBACK_AS_NEW_DRAFT',shop,channel,next.revision,['revisionOf']);
      return clone(next);
    }
    function preview(shop,channel,modelOutput){
      const cfg=get(shop,channel),currentBase=base(shop,channel);
      if(cfg.baseBotVersion!==currentBase.bot_profile_version)fail('ADV4_STALE_BASE_CONFIG');
      const intent=intelligence.validateModelOutput(modelOutput).intent;
      const source=intelligence.proposeFromValidatedOutput({
        modelOutput,studio:{get:(s,c)=>base(s,c)},studioApi,registry,policy,shop,channel});
      if(source.providerSends!==0||source.orderWrites!==0||source.canPublish!==false)
        fail('ADV4_UNSAFE_SOURCE_RESULT');
      const abstain=intent==='ABSTAIN',meta=abstain?null:
        registry.decision(channel,source.renderedComponent);
      const pref=cfg.presentationPreset;
      const component=abstain?'TEXT':
        pref==='TEXT_FIRST'?'TEXT':source.renderedComponent;
      const actionCapability=registry.decision(channel,'ACTION_BUTTON');
      const action={id:cfg.ctaAction,label:({
        VIEW_CATALOG:'Xem sản phẩm',REQUEST_QUOTE:'Hỏi giá',ASK_STAFF:'Gặp nhân viên',
        VIEW_POLICY:'Chính sách',ORDER_REQUEST_DRAFT:'Yêu cầu đặt hàng',
        TRACK_ORDER:'Tra đơn có xác minh',OPEN_VERIFIED_LINK:'Mở danh mục đã duyệt'
      })[cfg.ctaAction],active:false,requiresSignedServerAction:true,
        requiresCurrentStoreAuthorization:true,requiresCustomerOrOwnerVerification:
        ['ORDER_REQUEST_DRAFT','TRACK_ORDER'].includes(cfg.ctaAction),
        nativeButtonAllowed:false,fallback:'TEXT'};
      return clone({
        contract:'T404_ADV4_STUDIO_NO_SEND_PREVIEW',shop,channel,
        tenant_id:cfg.tenant_id,store_id:cfg.store_id,configRevision:cfg.revision,
        baseBotVersion:cfg.baseBotVersion,presentationPreset:pref,intent,
        renderedComponent:component,sourceRenderType:source.render?.type||'TEXT',
        sourceText:source.fallbackText||source.render?.text||'',
        mediaRef:cfg.mediaRef,linkRef:cfg.linkRef,
        mediaProviderUrl:null,linkProviderUrl:null,
        mediaApproved:false,linkDomainApproved:false,
        actionPreview:action,actionCapability:actionCapability.state,
        componentCapability:meta?.state||'ABSTAIN_SAFE_TEXT',
        requiresProviderApproval:true,merchantEntitlementVerified:false,
        accountCapabilityVerified:false,realAiEvaluated:false,
        realOrderLookup:false,signedActionIssued:false,
        senderEnabled:false,providerPayload:null,providerSends:0,hostedWrites:0,
        canExecute:false,canPublish:false,salesLiteUnchanged:true
      });
    }
    function inspect(){
      return clone({kind:'T404_ADV4_DRAFT_INSPECTION',drafts:drafts.size,
        audit,providerSends:0,hostedWrites:0,realAiCalls:0,
        paidTemplateCalls:0,canPublish:false,productionEntitlementVerified:false});
    }
    function exportDraft(shop,channel){
      return clone({kind:'T404_ADV4_UNTRUSTED_QA_EXPORT',config:get(shop,channel),
        media:assets(shop),canPublish:false,credentialsIncluded:false,
        verifiedOwnerEvidence:false,providerSends:0,hostedWrites:0});
    }
    const disabled=()=>fail('ADV4_PUBLISH_SEND_ACTION_HOSTED_DISABLED');
    return Object.freeze({get,save,rebase,rollback,history,assets,preview,exportDraft,inspect,
      publish:disabled,sendProvider:disabled,executeAction:disabled,writeHosted:disabled});
  }
  return Object.freeze({PRESETS,CTA,ACTORS,ASSETS,createStudioIntegration});
});