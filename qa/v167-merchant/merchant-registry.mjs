/**
 * TIEN404 V16.7 — INTERNAL synthetic Merchant Configuration Registry.
 * Not production auth, not a Store RLS substitute, not a deployed Worker.
 * ZERO external calls, NO PII, NO customer rows, NO paid inference, NO SEND.
 * The only legitimate principal and channel bindings here are fixed QA fixtures.
 */
export const REGISTRY_CONTRACT='TIEN404_MERCHANT_CONFIG_V16_7_SYNTHETIC';
export const RUNTIME_CONTRACT='TIEN404_SHARED_RUNTIME_V16_7_NO_SEND';
export const NO_SEND='SYNTHETIC_ONLY_NO_SEND';
const fail=code=>{throw new Error(code)};
const own=(v,k)=>Object.prototype.hasOwnProperty.call(v,k);
const isPlain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const clone=v=>JSON.parse(JSON.stringify(v));
const goodText=(s,min,max)=>typeof s==='string'&&s.trim().length>=min&&s.trim().length<=max&&!/[<>\u0000-\u001f\u007f]/.test(s);
const f=(x)=>Object.freeze(x);
const CHANNELS=f(['MESSENGER','ZALO_BOT','ZALO_OA','WEBSITE']);
const PLANS=f({ECONOMY:f({rpm:5,aiConcurrency:1,modelPolicy:'ECONOMY_MOCK'}),
 STANDARD:f({rpm:15,aiConcurrency:2,modelPolicy:'STANDARD_MOCK'}),
 PRIORITY:f({rpm:30,aiConcurrency:5,modelPolicy:'PRIORITY_MOCK'})});
const INDUSTRIES=f({
 GROCERY:f({unit:'gói',attrs:['brand','package_size','wholesale_minimum'],tone:'thân thiện'}),
 FASHION:f({unit:'cái',attrs:['size','color','material'],tone:'thân thiện'}),
 MATERIALS:f({unit:'bao',attrs:['unit','grade','bulk_price'],tone:'kỹ thuật'}),
 WHOLESALE:f({unit:'thùng',attrs:['unit','tier_min_qty','bulk_price'],tone:'chuyên nghiệp'})
});
const REGISTRATIONS=f([
 f({tenant_id:'QA_TENANT_1',store_id:'QA_STORE_A',account_id:'QA_META_A',channel:'MESSENGER',
    merchant_name:'Tạp hóa A',industry:'GROCERY',plan:'ECONOMY',owner_id:'QA_OWNER_A',approved:true,
    config:f({bot_name:'Trợ lý A',greeting:'Xin chào cửa hàng A',tone:'thân thiện',business_hours:'06:00-21:00',
      wholesale_enabled:true,prompt_version:'qa-prompt-1',knowledge_version:'qa-know-1',policy_version:'GLOBAL_CORE_LOCKED'}),
    catalog:f([f({sku:'SAME01',name:'Gạo A',price_vnd:159000,stock:12,unit:'túi',version:1})])}),
 f({tenant_id:'QA_TENANT_1',store_id:'QA_STORE_B',account_id:'QA_META_B',channel:'MESSENGER',
    merchant_name:'Thời trang B',industry:'FASHION',plan:'STANDARD',owner_id:'QA_OWNER_B',approved:true,
    config:f({bot_name:'Trợ lý B',greeting:'Xin chào cửa hàng B',tone:'thân thiện',business_hours:'09:00-22:00',
      wholesale_enabled:false,prompt_version:'qa-prompt-1',knowledge_version:'qa-know-1',policy_version:'GLOBAL_CORE_LOCKED'}),
    catalog:f([f({sku:'SAME01',name:'Áo B',price_vnd:209000,stock:7,unit:'cái',version:1})])}),
 f({tenant_id:'QA_TENANT_2',store_id:'QA_STORE_C',account_id:'QA_ZALO_C',channel:'ZALO_BOT',
    merchant_name:'Vật liệu C',industry:'MATERIALS',plan:'PRIORITY',owner_id:'QA_OWNER_C',approved:true,
    config:f({bot_name:'Trợ lý C',greeting:'Xin chào vật liệu C',tone:'kỹ thuật',business_hours:'07:00-17:00',
      wholesale_enabled:true,prompt_version:'qa-prompt-1',knowledge_version:'qa-know-1',policy_version:'GLOBAL_CORE_LOCKED'}),
    catalog:f([f({sku:'SAME01',name:'Xi măng C',price_vnd:259000,stock:3,unit:'bao',version:1})])})
]);
const ACTORS=f([
 f({id:'QA_OWNER_A',store_id:'QA_STORE_A',kind:'OWNER',enabled:true}),
 f({id:'QA_OWNER_B',store_id:'QA_STORE_B',kind:'OWNER',enabled:true}),
 f({id:'QA_OWNER_C',store_id:'QA_STORE_C',kind:'OWNER',enabled:true}),
 f({id:'QA_MANAGER_A',store_id:'QA_STORE_A',kind:'MANAGER',enabled:true}),
 f({id:'QA_STAFF_A',store_id:'QA_STORE_A',kind:'STAFF',enabled:true}),
 f({id:'QA_TIEN404_SUPPORT',store_id:'QA_STORE_A',kind:'TIEN404_SUPPORT',enabled:true}),
 f({id:'QA_TIEN404_EXPIRED',store_id:'QA_STORE_A',kind:'TIEN404_SUPPORT',enabled:false})
]);
const PATCH_KEYS=f(['bot_name','greeting','tone','business_hours','wholesale_enabled']);
const TONES=f(['thân thiện','chuyên nghiệp','cao cấp','kỹ thuật','ngắn gọn']);
function validatePatch(p){
 if(!isPlain(p)||!Object.keys(p).length||Object.keys(p).some(k=>!PATCH_KEYS.includes(k)))fail('PATCH_FIELDS_DENIED');
 for(const [k,v] of Object.entries(p)){
  if(k==='wholesale_enabled'){if(typeof v!=='boolean')fail('INVALID_WHOLESALE_FLAG')}
  else if(k==='tone'){if(!TONES.includes(v))fail('INVALID_TONE')}
  else if(k==='business_hours'){if(!/^([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-3]):[0-5]\d$/.test(v))fail('INVALID_HOURS')}
  else if(!goodText(v,2,k==='greeting'?180:60))fail('INVALID_TEXT');
 }
}
function validateSourceEvent(event){
 if(!isPlain(event)||Object.keys(event).some(k=>!['contract','channel','account_id','event_id','synthetic_text'].includes(k))||
  event.contract!=='QA_VERIFIED_CHANNEL_EVENT_V1'||!CHANNELS.includes(event.channel)||
  typeof event.account_id!=='string'||!/^QA_[A-Z0-9_]{2,48}$/.test(event.account_id)||
  typeof event.event_id!=='string'||!/^QA-EVT-[A-Z0-9_-]{4,48}$/.test(event.event_id)||
  !['xin chao','gia SAME01','tu van san pham','dat SAME01','ho tro'].includes(event.synthetic_text))
   fail('UNTRUSTED_OR_NON_SYNTHETIC_EVENT');
}
export function createSyntheticMerchantRuntime(){
 const stores=new Map(REGISTRATIONS.map(r=>[r.store_id,{...clone(r),active:true,subscription_status:'ACTIVE',bot_version:1}]));
 const bindings=new Map(REGISTRATIONS.map(r=>[r.channel+'|'+r.account_id,r.store_id]));
 const actors=new Map(ACTORS.map(a=>[a.id,clone(a)]));
 const drafts=new Map(),audit=[],issued=new WeakSet();
 let auditSeq=0;
 const actorFor=(id,store)=>{
  const a=actors.get(id);
  if(!a||!a.enabled||a.store_id!==store)fail('ACTOR_STORE_SCOPE_DENIED');
  return a;
 };
 const storeFor=id=>{
  const v=stores.get(id);if(!v)fail('UNKNOWN_STORE');return v;
 };
 function resolveTrustedQaChannel(event){
  validateSourceEvent(event);
  const storeId=bindings.get(event.channel+'|'+event.account_id);
  if(!storeId)fail('CHANNEL_STORE_BINDING_UNVERIFIED');
  const store=storeFor(storeId);
  if(store.subscription_status!=='ACTIVE'||!store.active)fail('SUBSCRIPTION_OR_STORE_INACTIVE');
  const scoped=Object.freeze({
   contract:RUNTIME_CONTRACT,tenant_id:store.tenant_id,store_id:store.store_id,
   channel:event.channel,event_id:event.event_id,plan:store.plan,
   config_version:store.bot_version,synthetic_text:event.synthetic_text
  });
  issued.add(scoped);
  return scoped;
 }
 function verifyIssued(scope){
  if(!scope||!issued.has(scope)||scope.contract!==RUNTIME_CONTRACT)fail('TRUSTED_RUNTIME_SCOPE_REQUIRED');
  const shop=storeFor(scope.store_id);
  if(shop.tenant_id!==scope.tenant_id||shop.bot_version!==scope.config_version||
     shop.subscription_status!=='ACTIVE'||!shop.active)fail('STALE_OR_REVOKED_RUNTIME_SCOPE');
  return shop;
 }
 function viewCatalog(scope,sku){
  const s=verifyIssued(scope);
  if(typeof sku!=='string'||!/^SAME01$/.test(sku))fail('CATALOG_QUERY_INVALID');
  const p=s.catalog.find(x=>x.sku===sku);
  if(!p)return Object.freeze({status:'NOT_FOUND',no_send:true});
  return Object.freeze({status:'CATALOG_PREVIEW',tenant_id:s.tenant_id,store_id:s.store_id,
   sku:p.sku,name:p.name,price_vnd:p.price_vnd,stock:p.stock,price_version:p.version,no_send:true});
 }
 function route(scope){
  const s=verifyIssued(scope);
  const entitlement=PLANS[s.plan];
  if(!entitlement)fail('UNKNOWN_PLAN');
  const v=scope.synthetic_text;
  if(v==='xin chao')return Object.freeze({intent:'FAST_FAQ',answer_preview:s.config.greeting,
    bot_version:s.bot_version,no_send:true});
  if(v==='gia SAME01')return Object.freeze({intent:'FAST_CATALOG',catalog:viewCatalog(scope,'SAME01'),no_send:true});
  if(v==='dat SAME01')return Object.freeze({intent:'COMMERCE_BLOCKED',requires:'HOSTED_OWNER_RLS_TRANSACTION_APPROVAL',no_send:true});
  if(v==='ho tro')return Object.freeze({intent:'HANDOFF_PREVIEW',createTicket:false,no_send:true});
  return Object.freeze({intent:'AI_PREVIEW',model_policy:entitlement.modelPolicy,invoke_model:false,
    max_concurrent_ai:entitlement.aiConcurrency,no_send:true});
 }
 function workflowEnvelope(scope){
  const s=verifyIssued(scope);
  const res=route(scope);
  return Object.freeze({contract:RUNTIME_CONTRACT,version:1,qa_only:true,no_send:true,
   tenant_id:s.tenant_id,store_id:s.store_id,channel:scope.channel,
   event_id:scope.event_id,intent:res.intent,bot_version:s.bot_version,
   config_version:s.bot_version,capability:'READ_ONLY_PREVIEW',
   requires_trusted_hosted_attestation:true,order_write:false,provider_send:false,
   model_call:false});
 }
 function proposeBotChange({actor_id,store_id,expected_version,patch}){
  const actor=actorFor(actor_id,store_id);
  if(!['OWNER','MANAGER','TIEN404_SUPPORT'].includes(actor.kind))fail('ROLE_CANNOT_EDIT_BOT');
  const s=storeFor(store_id);
  if(s.subscription_status!=='ACTIVE')fail('INACTIVE_STORE_CANNOT_EDIT');
  if(!Number.isSafeInteger(expected_version)||expected_version!==s.bot_version)fail('CONFIG_VERSION_CONFLICT');
  if(drafts.has(store_id))fail('OPEN_DRAFT_REQUIRES_REVIEW');
  validatePatch(patch);
  const next={...s.config,...clone(patch)};
  const d={contract:REGISTRY_CONTRACT,store_id,tenant_id:s.tenant_id,from_version:s.bot_version,
   candidate_version:s.bot_version+1,config:next,proposed_by:actor_id,
   state:'DRAFT',approved_by:null,qa_status:'NOT_RUN',publish_status:'BLOCKED'};
  drafts.set(store_id,d);
  audit.push({seq:++auditSeq,store_id,action:'DRAFT_CREATED',version:d.candidate_version});
  return clone(d);
 }
 function inspectDraft(actor_id,store_id){
  actorFor(actor_id,store_id);
  return drafts.has(store_id)?clone(drafts.get(store_id)):null;
 }
 function ownerApproveDraft({actor_id,store_id,candidate_version}){
  const actor=actorFor(actor_id,store_id);
  if(actor.kind!=='OWNER')fail('ONLY_OWNER_APPROVES');
  const d=drafts.get(store_id);
  if(!d||d.candidate_version!==candidate_version)fail('DRAFT_NOT_FOUND_OR_STALE');
  if(d.proposed_by===actor_id)fail('SEPARATION_OF_DUTIES');
  const s=storeFor(store_id);
  if(d.from_version!==s.bot_version)fail('DRAFT_PARENT_STALE');
  d.state='OWNER_APPROVED_PREVIEW_ONLY';d.approved_by=actor_id;
  audit.push({seq:++auditSeq,store_id,action:'OWNER_APPROVED_PREVIEW_ONLY',version:d.candidate_version});
  return clone(d);
 }
 function previewApprovedDraft({actor_id,store_id}){
  actorFor(actor_id,store_id);
  const d=drafts.get(store_id);
  if(!d||d.state!=='OWNER_APPROVED_PREVIEW_ONLY')fail('NO_APPROVED_DRAFT');
  return Object.freeze({bot_name:d.config.bot_name,greeting:d.config.greeting,
   store_id,tenant_id:d.tenant_id,preview_version:d.candidate_version,no_send:true,not_published:true});
 }
 function exportPublicProfile({actor_id,store_id}){
  const actor=actorFor(actor_id,store_id);
  if(!['OWNER','MANAGER','TIEN404_SUPPORT'].includes(actor.kind))fail('PROFILE_EXPORT_FORBIDDEN');
  const s=storeFor(store_id);
  return Object.freeze({store_id:s.store_id,tenant_id:s.tenant_id,
   merchant_name:s.merchant_name,industry:s.industry,
   bot_name:s.config.bot_name,business_hours:s.config.business_hours,
   bot_version:s.bot_version,no_send:true});
 }
 function setSubscriptionForSyntheticTest(store_id,status){
  if(!['ACTIVE','EXPIRED'].includes(status))fail('INVALID_SUBSCRIPTION');
  const s=storeFor(store_id);s.subscription_status=status;
  audit.push({seq:++auditSeq,store_id,action:'SYNTHETIC_SUBSCRIPTION_TEST',status});
 }
 function mockSnapshot(){return Object.freeze({
  shops:[...stores.values()].map(x=>({tenant_id:x.tenant_id,store_id:x.store_id,industry:x.industry,plan:x.plan,
   subscription_status:x.subscription_status,bot_version:x.bot_version})),
  drafts:[...drafts.values()].map(x=>({store_id:x.store_id,state:x.state,candidate_version:x.candidate_version})),
  audit:audit.map(x=>clone(x)),liveProviderSends:0,hostedDbWrites:0,modelApiCalls:0
 })}
 return Object.freeze({resolveTrustedQaChannel,viewCatalog,route,workflowEnvelope,proposeBotChange,
  ownerApproveDraft,inspectDraft,previewApprovedDraft,exportPublicProfile,
  setSubscriptionForSyntheticTest,mockSnapshot});
}
export const INDUSTRY_ATTRIBUTES=INDUSTRIES;
export const TIER_LIMITS=PLANS;
export function compareCloneVsShared({shops,messagesPerShop,orchestrationRate}){
 if(!Number.isSafeInteger(shops)||shops<1||shops>1000||!Number.isSafeInteger(messagesPerShop)||
  messagesPerShop<0||messagesPerShop>1000000||typeof orchestrationRate!=='number'||
  !Number.isFinite(orchestrationRate)||orchestrationRate<0||orchestrationRate>1)
   fail('INVALID_CAPACITY_ASSUMPTION');
 const total=shops*messagesPerShop;
 const estimated=Math.ceil(total*orchestrationRate);
 return Object.freeze({shops,monthlyMessages:total,
  naiveOneExecutionPerMessage:total,estimatedSharedOrchestratorInvocations:estimated,
  workflowCloneCountHypothesis:shops*6,sharedCoreWorkflowLibraryHypothesis:6,
  hypotheticalOnly:true,notAccountBilling:true,
  note:'Nested workflow executions, cron, retries, provider costs and actual plan limits remain unverified'});
}
export function publishToProduction(){fail('V167_NO_RELEASE_OR_HOSTED_COMMERCE')}
export function callRealModel(){fail('V167_NO_RELEASE_OR_HOSTED_COMMERCE')}
export function writeRealOrder(){fail('V167_NO_RELEASE_OR_HOSTED_COMMERCE')}
export function sendRealMessage(){fail('V167_NO_RELEASE_OR_HOSTED_COMMERCE')}
