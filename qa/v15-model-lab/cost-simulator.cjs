'use strict';
/**
 * TIEN404 V15.0-02 — Deterministic NO-API model-token cost simulator.
 * No model inference, account access, credentials, purchases, provider calls,
 * authorization grants or merchant data. Prices are a dated docs snapshot.
 * Model quote != total commercial SaaS cost.
 */
const catalog=require('./model-pricing-snapshot.json');
const rateMap=new Map(catalog.models.map(x=>[x.id,x]));
const INPUT_KEYS=['inputTokens','outputTokens','cachedInputTokens','reasoningOutputTokens','toolCalls','retryCount'];
const safeInteger=(v,name)=>{if(!Number.isSafeInteger(v)||v<0)throw Error('INVALID_'+name);return v};
const dec=n=>Math.round((n+Number.EPSILON)*1e9)/1e9;
function quoteModel({modelId,inputTokens,outputTokens,cachedInputTokens=0,reasoningOutputTokens=0,mode='standard',toolCalls=0,retryCount=0}={}){
 const m=rateMap.get(modelId);
 if(!m)throw Error('MODEL_ID_NOT_IN_OFFICIAL_SNAPSHOT');
 for(const [k,v] of Object.entries({inputTokens,outputTokens,cachedInputTokens,reasoningOutputTokens,toolCalls,retryCount}))safeInteger(v,k);
 if(cachedInputTokens>inputTokens)throw Error('CACHED_INPUT_GREATER_THAN_INPUT');
 if(reasoningOutputTokens>outputTokens)throw Error('REASONING_IS_SUBSET_OF_OUTPUT_NOT_ADDITIVE');
 if(!['standard','off_peak'].includes(mode)||mode==='off_peak'&&!m.off_peak)throw Error('UNVERIFIED_PRICING_MODE');
 const pricing=mode==='off_peak'?m.off_peak:m.standard;
 if(m.long_context&&inputTokens>m.long_context.threshold&&mode==='standard') {
   return Object.freeze({...priced(m.long_context),tier:'LONG_CONTEXT_OVER_100K',warning:'HAIKU_LONG_CONTEXT_RATE_APPLIED',snapshotId:m.id});
 }
 return Object.freeze({...priced(pricing),tier:mode==='off_peak'?'OFF_PEAK':'STANDARD',snapshotId:m.id});
 function priced(rate){
   const uncachedInputTokens=inputTokens-cachedInputTokens;
   const inputCost=uncachedInputTokens*rate.input/1e6;
   const cacheCost=cachedInputTokens*rate.cached_input/1e6;
   const outputCost=outputTokens*rate.output/1e6;
   return {
     modelId:m.id,source:m.source,mode,usd_model_only:dec(inputCost+cacheCost+outputCost),
     usd_uncached_input:dec(inputCost),usd_cached_input:dec(cacheCost),
     usd_output_including_reasoning:dec(outputCost),
     tokens:{inputTokens,outputTokens,cachedInputTokens,uncachedInputTokens,reasoningOutputTokens,toolCalls,retryCount},
     unknown_charges:['TOOL_PROVIDER_FEES','N8N_EXECUTION_PLAN','DATABASE','GATEWAY_FEES','NOTIFICATIONS','PROMPT_CACHE_STORAGE','RETRIES_EXTRA_TOKENS','DATA_RESIDENCY'],
     usd_full_task_total:null,cost_per_successful_task_usd:null,
     task_quality_verified:false,commercially_approved:false,
     can_send:false,can_modify_production:false
   };
 }
}
const DEFAULT_SYNTHETIC={turnsPerConversation:5,inputTokensPerTurn:1200,outputTokensPerTurn:180,conversationsPerStorePerMonth:1000};
function scenario({modelId,conversations,turnsPerConversation=5,inputTokensPerTurn=1200,outputTokensPerTurn=180,mode='standard',cachedFraction=0,verifiedSuccessRate=null}={}){
 for(const [k,v] of Object.entries({conversations,turnsPerConversation,inputTokensPerTurn,outputTokensPerTurn}))safeInteger(v,k);
 if(conversations===0||turnsPerConversation===0||!Number.isFinite(cachedFraction)||cachedFraction<0||cachedFraction>1)
  throw Error('INVALID_SCENARIO');
 const totals={inputTokens:conversations*turnsPerConversation*inputTokensPerTurn,outputTokens:conversations*turnsPerConversation*outputTokensPerTurn};
 if(!Number.isSafeInteger(totals.inputTokens)||!Number.isSafeInteger(totals.outputTokens))throw Error('SCENARIO_TOKEN_OVERFLOW');
 const cost=quoteModel({modelId,...totals,cachedInputTokens:Math.floor(totals.inputTokens*cachedFraction),mode});
 if(verifiedSuccessRate!==null)throw Error('MODEL_SUCCESS_RATE_MUST_COME_FROM_ACTUAL_BENCHMARK');
 return Object.freeze({scenario:'HYPOTHETICAL_SYNTHETIC_ONLY',conversations,turnsPerConversation,
   inputTokensPerTurn,outputTokensPerTurn,cachedFraction,
   usd_model_only:cost.usd_model_only,usd_total_saas:null,
   outputReasoningIncluded:true,cost_per_successful_task_usd:null,
   modelId,mode,accuracy: 'NOT_BENCHMARKED',toolCallingChargesIncluded:false,otherOverheadIncluded:false,
   can_send:false,can_upgrade_subscription:false});
}
function table(modelId,mode='standard'){
 const byConversations=[1000,10000,100000].map(conversations=>scenario({modelId,mode,conversations}));
 const byStores=[10,50,100].map(stores=>({
   stores,conversationsPerStorePerMonth:DEFAULT_SYNTHETIC.conversationsPerStorePerMonth,
   ...scenario({modelId,mode,conversations:stores*DEFAULT_SYNTHETIC.conversationsPerStorePerMonth})
 }));
 return Object.freeze({modelId,mode,assumptions:DEFAULT_SYNTHETIC,byConversations,byStores,
  fullSaaSForecastAvailable:false,selectedAsDefault:false});
}
module.exports={quoteModel,scenario,table,DEFAULT_SYNTHETIC,modelCatalog:catalog.models};
