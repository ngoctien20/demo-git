'use strict';
/**
 * TIEN404 V15.0-03–05: secure SOURCE-ONLY synthetic orchestration.
 * Reuses exact V14.8 HMAC-signed QA identity fixtures + V14.7 Bot Studio.
 * HMAC keys are FIXTURE constants; NOT provider signatures or real trust.
 * NEVER publish this module as authentication for a live channel.
 */
const {createUnifiedQaRouter,MODE}=require('../v148-unified-identity/identity-core.cjs');
const {createStudio,FIXTURES,CHANNELS}=require('../v147-custom-studio/studio-core.js');
const {planAgent}=require('../v15-agent-core/universal-agent-core.cjs');
const {runOfflineSkill,SKILLS}=require('./business-skills-registry.cjs');
const {routeNoSend,MODEL_IDS}=require('./smart-model-router.cjs');
const CHANNELS_V15={MESSENGER:'messenger',ZALO_BOT:'zalo_bot',ZALO_OA:'zalo_oa',WEB_WIDGET:'web_widget'};
const CAP_BY_ROLE={
 customer:['catalog_read','price_quote','order_draft','support_draft','order_status_read'],
 owner:['catalog_read','price_quote','order_draft','support_draft','order_status_read','owner_report_read'],
 manager:['catalog_read','price_quote','support_draft','order_status_read','owner_report_read']
};
const nowFn=()=>Date.now();
function createOfflineLabEngine({now=nowFn}={}){
 const studio=createStudio(),secretByChannel={};
 for(const [i,channel] of CHANNELS.entries())secretByChannel[channel]=Buffer.alloc(32,71+i);
 const bindings=[];
 for(const shop of ['A','B','C']){
  for(const channel of CHANNELS){
   const f=FIXTURES[shop];
   bindings.push({id:'binding_'+shop+'_'+channel,channel,environment:'qa_staging',
     provider_account_ref:'fixture_account_'+shop,provider_bot_ref:'fixture_bot_'+shop,
     tenant_id:f.tenantId,store_id:f.storeId,bot_profile_id:'qa_bot_profile_'+shop,
     shop,status:'ACTIVE',subscription_active:true,
     verified_until_ms:now()+24*60*60*1000,configuration_version:1});
  }
 }
 const router=createUnifiedQaRouter({mode:MODE,secretByChannel,bindings,studio,now});
 let nextId=0;
 async function run({shop='A',channel='MESSENGER',message,modelId='gpt-6-luna',
  role='customer',clientClaims={},conversation='qa_conversation_v15'}={}){
  const denied=(reason)=>({status:'BLOCKED',reason,synthetic:true,can_send:false,provider_sends:0,orders_written:0,paid_model_calls:0,real_data_used:false});
  if(!Object.hasOwn(FIXTURES,shop)||!CHANNELS.includes(channel)||!Object.hasOwn(CAP_BY_ROLE,role))
   return denied('UNKNOWN_QA_SHOP_CHANNEL_OR_ROLE');
  if(typeof message!=='string'||message.length<1||message.length>2000||!/^[a-z0-9_:-]{8,90}$/i.test(conversation))
   return denied('INVALID_SYNTHETIC_INPUT');
  if(!clientClaims||typeof clientClaims!=='object'||Array.isArray(clientClaims))
   return denied('INVALID_CLIENT_CLAIMS');
  const f=FIXTURES[shop],id='event_v15_'+(++nextId).toString().padStart(7,'0');
  const event={channel,environment:'qa_staging',provider_account_ref:'fixture_account_'+shop,
   provider_bot_ref:'fixture_bot_'+shop,provider_user_ref:'fixture_user_001',
   provider_conversation_ref:conversation,event_id:id,event_type:'message',
   text:message,timestamp_ms:now()};
  const rawBody=Buffer.from(JSON.stringify(event));
  const signed=router.processSignedFixture({channel,rawBody,signature:router.signFixture(channel,rawBody)});
  if(signed.trusted!==true||signed.status!=='RESOLVED'||signed.store_id!==f.storeId||
     signed.tenant_id!==f.tenantId||signed.channel!==channel||signed.policy?.can_send!==false)
    return denied('V14_8_SYNTHETIC_IDENTITY_GATE_DENIED');
  const server={source:'TRUSTED_SERVER_IDENTITY',environment:'SYNTHETIC_OFFLINE_FIXTURE',
   authorizedForStaging:true,tenantId:signed.tenant_id,storeId:signed.store_id,
   conversationId:signed.conversation_id,channel:CHANNELS_V15[channel],
   actorRole:role,policyVersion:'V15_NO_SEND_QA_V1',botProfileVersion:'V14_7_DRAFT_QA',
   sendEnabled:false,capabilities:CAP_BY_ROLE[role]};
  // Client claims CANNOT set server-side tenant, store, role, permissions or send rights.
  const input={request_id:'request_v15_'+id,message,...clientClaims};
  const plan=await planAgent(input,{resolveTrusted:async()=>server});
  const route=routeNoSend({intent:plan.intent||'NEEDS_UNDERSTANDING',requestedModel:modelId});
  const skill=plan.status==='CANDIDATE_OFFLINE_NO_SEND'&&plan.tool?
    runOfflineSkill({plan,server,fixtureStore:shop,customerText:message}):null;
  const reply=plan.status==='BLOCKED'?'[ĐÃ CHẶN] '+plan.reason:
    skill?skill.response:
    plan.response||'[QA] Cần AI model đã được phê duyệt để hiểu sâu hơn; hiện không gọi API thật.';
  return Object.freeze({
   version:'V15.0.3-OFFLINE',simulation:true,status:plan.status==='BLOCKED'?'BLOCKED':'SYNTHETIC_QA_RESULT',
   shop,channel,assistant:studio.get(shop,channel).assistantName,
   bot_profile_version:studio.get(shop,channel).bot_profile_version,
   request_id:input.request_id,reply,
   route,plan,skill,identity_provenance:'V14_8_SIGNED_SYNTHETIC_FIXTURE_ONLY',
   identity_real_provider_verified:false,owner_authenticated:false,
   metrics:{paid_model_calls:0,tool_calls_real:0,provider_sends:0,order_writes:0,
    price_model_only_usd_estimate:route.usd_model_estimate??null,
    measured_llm_latency_ms:null,quality_score:null,simulation:true},
   can_send:false,can_write_orders:false,real_data_used:false,
   signed_qa_fixture:true,pricing_is_real:false
  });
 }
 return Object.freeze({run,inspect:()=>Object.freeze({mode:'OFFLINE_SIGNED_FIXTURE_ONLY',
  qa_signer_is_not_provider:true,provider_sends:0,orders_written:0,paid_model_calls:0,
  fixture_stores:['A','B','C'],channel_count:CHANNELS.length,skill_count:Object.keys(SKILLS).length,
  model_candidates:MODEL_IDS,auth_real:false,owner_certified:false})});
}
module.exports={createOfflineLabEngine,CHANNELS_V15};
