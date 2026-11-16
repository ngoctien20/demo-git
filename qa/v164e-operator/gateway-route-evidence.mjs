/**
 * TIEN404 V16.4E: REAL n8n gateway coverage snapshot (2026-11-16),
 * from READ-ONLY connector list_n8n_gateway_services.
 * This is platform-side node/credential availability ONLY, not a provider
 * model entitlement, an authenticated key or a verified billing balance.
 */
import {canaryPlan} from '../v164c-canary/canary-budget.mjs';
export const CONTRACT='T404_V164E_GATEWAY_CAPABILITY_NOT_ENTITLEMENT_V1';
export const OBSERVATION=Object.freeze({
 observed_on:'2026-11-16',
 channel:'N8N_CLOUD_GATEWAY',
 source:'CONNECTED_N8N_READ_ONLY_GATEWAY_SERVICES_LIST',
 gateway_credentials_available:true,
 supported_credential_types:Object.freeze(['openAiApi','googlePalmApi']),
 supported_chat_node_types:Object.freeze([
  '@n8n/n8n-nodes-langchain.lmChatOpenAi',
  '@n8n/n8n-nodes-langchain.lmChatGoogleGemini']),
 model_ids_visible:false,
 project_model_entitlement_verified:false,
 actual_model_list_verified:false,
 rate_limit_rpm_tpm_rpd_verified:false,
 hard_budget_cap_verified:false,
 billable_token_prices_verified:false,
 data_retention_terms_approved:false,
 provider_api_calls_for_this_check:0,
 source_messages_uploaded:false
});
const assert=(a,b)=>{if(!a)throw Error(b)};
const exact=(x,k)=>x&&typeof x==='object'&&!Array.isArray(x)
 &&Object.keys(x).length===k.length&&k.every(y=>Object.hasOwn(x,y));
export function providerRouteReview({route='N8N_GATEWAY',provider='openai',model_id=null}={}){
 assert(['N8N_GATEWAY','DIRECT_PROVIDER'].includes(route),'ROUTE_NOT_ALLOWLISTED');
 assert(['openai','google'].includes(provider),'PROVIDER_NOT_ALLOWLISTED');
 assert(model_id===null||typeof model_id==='string'&&/^[a-z0-9._-]{3,64}$/.test(model_id),
  'MODEL_ID_FORMAT_REQUIRED');
 const node=provider==='openai'?OBSERVATION.supported_chat_node_types[0]:OBSERVATION.supported_chat_node_types[1];
 return Object.freeze({contract:CONTRACT,route,provider,claimed_model_id:model_id,
  n8n_gateway_credential_type:route==='N8N_GATEWAY'?(provider==='openai'?'openAiApi':'googlePalmApi'):null,
  gateway_chat_node_covered:route==='N8N_GATEWAY'&&OBSERVATION.supported_chat_node_types.includes(node),
  exact_model_available_to_tien404:null,
  project_rpm:null,project_tpm:null,project_rpd:null,
  account_billing_authorized:false,
  provider_data_terms_approved:false,
  evidence_method:'PRIVATE_READ_ONLY_OPERATOR_PROJECT_REVIEW_REQUIRED',
  status:'BLOCKED_ACCOUNT_ENTITLEMENT_NOT_VERIFIED',
  canary_cases:canaryPlan().case_count,
  canary_request_budget_approved:false});
}
export function verifyOperatorFacts(facts){
 const fields=['route','provider','model_id','visibility_evidence_sha256',
  'quota_evidence_sha256','billing_evidence_sha256','terms_evidence_sha256',
  'operator_role_evidence_sha256','independent_reviewer_evidence_sha256'];
 assert(exact(facts,fields),'EXACT_EVIDENCE_FACTS_REQUIRED');
 providerRouteReview(facts);
 const HEX=/^[0-9a-f]{64}$/;
 for(const k of fields.slice(3))assert(facts[k]===null||typeof facts[k]==='string'&&HEX.test(facts[k]),
  'EVIDENCE_SHA_OR_NULL_REQUIRED');
 const missing=fields.slice(3).filter(k=>facts[k]===null);
 return Object.freeze({status:'CLAIMS_INDEXED_AWAITING_EXTERNAL_HUMAN_VERIFICATION',
  metadata_hash_fields_present:fields.slice(3).length-missing.length,
  missing_evidence:missing,
  no_credential_or_project_id_accepted:true,
  evidence_hash_does_not_establish_authenticity:true,
  real_model_entitlement_certified:false,
  live_execution_authorized:false});
}
export const invokeGatewayModel=()=>{throw Error('V164E_GATEWAY_PAID_CALL_DISABLED')};
export const openProviderCredential=()=>{throw Error('V164E_NO_CREDENTIAL_READ')};
