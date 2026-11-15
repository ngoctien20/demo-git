'use strict';
/** V15.0-05 Smart Model Router — deterministic recommendations, NO inference. */
const {quoteModel,modelCatalog}=require('../v15-model-lab/cost-simulator.cjs');
const allowed=new Set(modelCatalog.filter(m=>m.role.startsWith('shortlist_')).map(m=>m.id));
const BLOCK=(reason,extras={})=>Object.freeze({status:'BLOCKED',reason,selected_model:null,provider_call_allowed:false,can_send:false,real_llm_calls:0,usd_spent:0,owner_approved:false,...extras});
function routeNoSend({intent,estimatedInputTokens=1200,estimatedOutputTokens=180,requestedModel='gpt-6-luna',ownerApprovedBudgetUsd=null,providerEntitlementVerified=false,hostedReservationVerified=false,sideEffectsOccurred=false}={}){
 if(typeof intent!=='string'||!Number.isSafeInteger(estimatedInputTokens)||estimatedInputTokens<0||
  !Number.isSafeInteger(estimatedOutputTokens)||estimatedOutputTokens<0||
  estimatedInputTokens>100000||estimatedOutputTokens>10000)return BLOCK('INVALID_ROUTE_INPUT');
 if(sideEffectsOccurred)return BLOCK('NO_FALLBACK_AFTER_SIDE_EFFECTS');
 if(intent==='GREETING')return Object.freeze({status:'DETERMINISTIC_NO_MODEL',selected_model:null,recommended_model:null,
  usd_model_estimate:0,estimate_is_synthetic:true,provider_call_allowed:false,real_llm_calls:0,can_send:false,usd_spent:0});
 if(!allowed.has(requestedModel))return BLOCK('MODEL_NOT_IN_RESEARCH_SHORTLIST');
 let estimate;
 try{estimate=quoteModel({modelId:requestedModel,inputTokens:estimatedInputTokens,outputTokens:estimatedOutputTokens})}catch{return BLOCK('PRICE_UNKNOWN_OR_INVALID')}
 const risky=['ORDER_CHANGE','OWNER_REPORT','ORDER_DRAFT'].includes(intent);
 return Object.freeze({status:'OFFLINE_MODEL_CANDIDATE_ONLY',recommended_model:requestedModel,selected_model:null,
  intent,route_tier:risky?'BACKEND_POLICY_FIRST':'LOW_COST_FIRST',usd_model_estimate:estimate.usd_model_only,
  estimate_is_synthetic:true,account_entitlement_verified:providerEntitlementVerified===true,
  budget_hard_cap_approved:typeof ownerApprovedBudgetUsd==='number'&&ownerApprovedBudgetUsd>=0,
  hosted_budget_reserved:hostedReservationVerified===true,
  reason_not_dispatched:'NO_PAID_API_APPROVAL_AND_NO_AUTHENTICATED_PROVIDER_ROUTE',
  provider_call_allowed:false,can_send:false,real_llm_calls:0,usd_spent:0,
  fallback_mode:'NONE_NO_SIDE_EFFECT_REPLAY'});
}
module.exports={routeNoSend,MODEL_IDS:[...allowed].sort()};
