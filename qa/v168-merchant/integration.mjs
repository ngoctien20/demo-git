/**
 * V16.8 source-only integration rehearsal.
 * Real provider webhook auth / JWT / durable outbox / sends remain completely absent.
 * All accepted messages use fixed QA fixtures and synthetic HMAC only.
 */
import {createSyntheticMerchantRuntime,compareCloneVsShared,TIER_LIMITS} from '../v167-merchant/merchant-registry.mjs';
import {CONTRACT,REQUIRED_MODE,handleQaFetch,signQaHmac,handleQaBatch,costPreview} from '../v16-hybrid/hybrid-core.mjs';
import {faqStudioUiContract} from '../v163-studios/faq-studio.mjs';
import {priorityDashboardUiContract} from '../v163-studios/priority-dashboard.mjs';
import {createCostCenter} from '../v163-studios/cost-center.mjs';
import {createHandoffPreview} from '../v163-studios/human-handoff.mjs';
import {previewImport,sampleCsvForStore,parseCsv} from './import-preview.mjs';
const fail=x=>{throw Error(x)};
const CHANNEL_ACCOUNTS=Object.freeze({
 QA_PAGE_A:Object.freeze({provider:'messenger',reg:'QA_META_A',channel:'MESSENGER',
  tenant:'QA_TENANT_1',store:'QA_STORE_A'}),
 QA_PAGE_B:Object.freeze({provider:'messenger',reg:'QA_META_B',channel:'MESSENGER',
  tenant:'QA_TENANT_1',store:'QA_STORE_B'}),
 QA_ZALO_C:Object.freeze({provider:'zalo',reg:'QA_ZALO_C',channel:'ZALO_BOT',
  tenant:'QA_TENANT_2',store:'QA_STORE_C'})
});
const MESSAGES=Object.freeze({
 'xin chao':'xin chao',
 'xin gia ao thun':'gia SAME01',
 'tu van ao':'tu van san pham',
 'toi muon dat hang':'dat SAME01',
 'can gap nhan vien':'ho tro'
});
export function studioConnections(){
 return Object.freeze({
   faq:faqStudioUiContract(),
   priority:priorityDashboardUiContract(),
   costCenter:'V16.3 createCostCenter exported, LOCAL_SYNTHETIC_MEMORY_ONLY',
   handoff:'V16.3 human handoff API, LOCAL_SYNTHETIC_MEMORY_ONLY',
   merchantRegistry:'V16.7 createSyntheticMerchantRuntime imported',
   gateway:'V16.1 handleQaFetch/signQaHmac/handleQaBatch imported',
   importer:'V16.8 parseCsv/previewImport imported',
   no_n8n_call:true,no_external_api:true,no_real_messages:true
 });
}
export function createStagingSession(){
 const registry=createSyntheticMerchantRuntime();
 const claimed=new Map(),processed=new Map(),limit=new Map(),items=[];
 const outbox={
  async reserve(key,message){
   if(claimed.get(key)==='ENQUEUED')return 'DUPLICATE';
   if(claimed.get(key)==='RESERVED')return 'BUSY';
   claimed.set(key,'RESERVED');return 'RESERVED';
  },
  async markEnqueued(key){claimed.set(key,'ENQUEUED')},
  async retryable(key){claimed.delete(key)}
 };
 const handoff=createHandoffPreview();
 const environment={
  V16_MODE:REQUIRED_MODE,QA_HMAC_SECRET:'QA_V168_SYNTHETIC_HMAC_DO_NOT_USE',
  QA_REGISTRY:{async lookup(channel,account){
   const a=CHANNEL_ACCOUNTS[account];
   return a&&a.provider===channel?{
    tenant_id:a.tenant,store_id:a.store,active:true,greeting:'Xin chào QA mock'
   }:null;
  }},
  QA_LIMITS:{async admit(key,time){
   const k=key+':'+Math.floor(time/60000);
   const n=limit.get(k)||0;
   if(n>=50)return false;
   limit.set(k,n+1);return true;
  }},
  QA_OUTBOX:outbox,
  QA_QUEUE:{async send(message){items.push(structuredClone(message))}},
  QA_PREVIEWS:{async recordOnce(key,v){if(!processed.has(key))processed.set(key,v)}}
 };
 const replayCounter={messages:0,enqueued:0,providerSends:0,modelCalls:0,commerceWrites:0};
 async function simulate({account='QA_PAGE_A',text='xin chao',event='QA-EVENT-0001',now=Date.now()}={}){
  const a=CHANNEL_ACCOUNTS[account];
  if(!a)fail('UNKNOWN_QA_ACCOUNT');
  if(!Object.hasOwn(MESSAGES,text))fail('UNSUPPORTED_SYNTHETIC_TEXT');
  const fixture={contract:CONTRACT,channel:a.provider,account_id:account,event_id:event,
   occurred_at:new Date(now).toISOString(),synthetic_text:text,synthetic:true};
  const raw=JSON.stringify(fixture);
  const signature=await signQaHmac(raw,environment.QA_HMAC_SECRET);
  const req=new Request('https://synthetic.invalid/__qa/v16/event',{
   method:'POST',headers:{'Content-Type':'application/json','x-t404-qa-signature':signature},body:raw
  });
  const res=await handleQaFetch(req,environment,now),body=await res.json();
  if(res.status!==202)return Object.freeze({status:'BLOCKED',code:body.reason||body.status,http_status:res.status,
    provider_send:false,commerce_write:false});
  const last=items.at(-1);
  if(body.status==='DUPLICATE_ACK')return Object.freeze({status:'DUPLICATE_ACK',store_id:a.store,
   provider_send:false,commerce_write:false});
  if(!last||last.store_id!==a.store||last.tenant_id!==a.tenant)fail('GATEWAY_REGISTRY_SCOPE_MISMATCH');
  // A fixed QA test adapter maps the provider account to registry account.
  // It never trusts tenant/store fields embedded in a message or an LLM answer.
  const scope=registry.resolveTrustedQaChannel({
   contract:'QA_VERIFIED_CHANNEL_EVENT_V1',channel:a.channel,account_id:a.reg,
   event_id:event.replace('QA-EVENT-','QA-EVT-'),
   synthetic_text:MESSAGES[text]
  });
  if(scope.store_id!==last.store_id||scope.tenant_id!==last.tenant_id)fail('CROSS_STORE_GATEWAY_DENIED');
  const routed=registry.route(scope),envelope=registry.workflowEnvelope(scope);
  await handleQaBatch({messages:[{body:last,ack(){}}]},environment);
  replayCounter.messages++;replayCounter.enqueued=items.length;
  return Object.freeze({status:'INTEGRATED_SYNTHETIC_PREVIEW',tenant_id:a.tenant,store_id:a.store,
   route:routed.intent,response:routed,catalog:routed.catalog??null,
   n8n_envelope:envelope,hybrid_mock_receipt:true,no_send:true,
   no_model_call:true,order_write:false});
 }
 function importForAccount(account){
  const a=CHANNEL_ACCOUNTS[account];if(!a)fail('UNKNOWN_QA_ACCOUNT');
  const regScope=registry.resolveTrustedQaChannel({
   contract:'QA_VERIFIED_CHANNEL_EVENT_V1',channel:a.channel,account_id:a.reg,
   event_id:'QA-EVT-IMPORT01',synthetic_text:'gia SAME01'
  });
  const before=registry.viewCatalog(regScope,'SAME01');
  return previewImport({store_id:a.store,rows:parseCsv(sampleCsvForStore(a.store)),
   existing:[{sku:before.sku,name:before.name,price_vnd:before.price_vnd,stock:before.stock,unit:
    a.store==='QA_STORE_A'?'túi':a.store==='QA_STORE_B'?'cái':'bao'}]});
 }
 function readEvidence(){return Object.freeze({
  ...replayCounter,previews:processed.size,duplicateProtectedQA:claimed.size,
  no_hosted_writes:true,no_cloudflare_deployment:true,no_real_provider_verification:true
 })}
 return Object.freeze({simulate,importForAccount,readEvidence,registry,costCenter:createCostCenter(),handoff});
}
export function planCosts({shops,messagesPerShop=1000,modelFraction=0.3,
 orchestrationFraction=0.1,inputTokens=3000,outputTokens=300,
 inputUsdPerMillion=0.1,outputUsdPerMillion=0.5,
 fixedMonthlyUsd=0,supportMonthlyUsdPerShop=0}){
 if(![1,5,20,50,100,500].includes(shops)||
  !Number.isSafeInteger(messagesPerShop)||messagesPerShop<0||messagesPerShop>1000000||
  ![modelFraction,orchestrationFraction].every(n=>Number.isFinite(n)&&n>=0&&n<=1)||
  ![inputUsdPerMillion,outputUsdPerMillion,fixedMonthlyUsd,supportMonthlyUsdPerShop].every(n=>Number.isFinite(n)&&n>=0))
   fail('INVALID_PLANNING_ASSUMPTIONS');
 const messages=shops*messagesPerShop;
 const modelTurns=Math.ceil(messages*modelFraction);
 const n8nEvents=Math.ceil(messages*orchestrationFraction);
 const modelUsd=costPreview({messages:modelTurns,inputTokens,outputTokens,
  inputPerMillion:inputUsdPerMillion,outputPerMillion:outputUsdPerMillion});
 return Object.freeze({shops,messages,modelTurns,n8nInvocations:n8nEvents,
   modelUsd:Number(modelUsd.toFixed(6)),
   sharedFixedPerShopUsd:Number((fixedMonthlyUsd/shops).toFixed(6)),
   totalKnownComponentsUsd:Number((modelUsd+fixedMonthlyUsd+supportMonthlyUsdPerShop*shops).toFixed(6)),
   perShopKnownComponentsUsd:Number(((modelUsd+fixedMonthlyUsd)/shops+supportMonthlyUsdPerShop).toFixed(6)),
   orphanedInfrastructureCosts:['n8n tier and execution overages','Queues/DO/DB',
     'provider charges','staff onboarding','backup/retention','tax','AI tool iterations'],
   hypothetical:true,rateSource:'USER_SUPPLIED_ASSUMPTIONS_NOT_LIVE_PRICING',
   no_purchase:true,cloneComparison:compareCloneVsShared({
    shops,messagesPerShop,orchestrationRate:orchestrationFraction})
 });
}
