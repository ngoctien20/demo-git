/**
 * TIEN404 CBOT-MSG-UAT-01 — REAL PUBLISHED READINESS ASSESSMENT,
 * plus TEST-ONLY reuse of the V16.7 synthetic Merchant Runtime.
 *
 * LIVE bot settings were read as METADATA via n8n connector. This module
 * cannot query Meta, obtain a Page token, post a message, write Orders,
 * or mutate n8n/Supabase. It never issues live authorization.
 */
import {createSyntheticMerchantRuntime} from '../v167-merchant/merchant-registry.mjs';

const BASELINE_KEYS=Object.freeze([
 'contract','workflow_id','workflow_name','published_active','published_version',
 'published_node_count','published_system_prompt_length',
 'published_prompt_has_dynamic_profile_binding',
 'published_prompt_mentions_bot_profile_version',
 'published_has_legacy_demo_order_tools',
 'published_uses_demo_google_sheets',
 'published_has_meta_signature_verifier',
 'published_extracts_postbacks',
 'app_level_messages_subscription',
 'app_level_postbacks_subscription',
 'page_level_subscription',
 'page_owner_consent',
 'trusted_page_to_store_binding',
 'live_custom_profile_applied',
 'recent_webhook_success_ids'
]);
const VALID_UNKNOWN='NOT_VERIFIED';
const isPlain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
const deny=(reasons)=>Object.freeze({
 contract:'T404_CBOT_MSG_LIVE_UAT_PRECHECK_V1',
 verdict:'NO_GO_LIVE_CUSTOM_PROFILE',
 reasons:Object.freeze([...reasons]),
 actual_messenger_webhook_operational:true,
 custom_studio_deployed_to_published:false,
 app_and_page_subscriptions_verified:false,
 page_to_store_owner_verified:false,
 real_config_change_tested:false,
 can_publish:false,can_modify_published:false,can_write_orders:false,
 can_send_provider:false,can_change_credentials:false,
 ai_model_calls:0,provider_messages_sent:0,orders_written:0,
 source_only:true
});
export function assessPublishedMessengerCustomization(evidence){
 const reasons=[];
 if(!isPlain(evidence)||Object.keys(evidence).length!==BASELINE_KEYS.length||
    Object.keys(evidence).some(k=>!BASELINE_KEYS.includes(k))||
    evidence.contract!=='TIEN404_PUBLISHED_MESSENGER_READONLY_20261116'||
    evidence.workflow_id!=='Z7FdV7uDvApfbURQ'||
    evidence.published_active!==true||
    evidence.published_node_count!==27||
    evidence.published_version!=='d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92'||
    !Number.isSafeInteger(evidence.published_system_prompt_length)||
    evidence.published_system_prompt_length<100||
    evidence.published_has_meta_signature_verifier!==true||
    evidence.published_extracts_postbacks!==true||
    !Array.isArray(evidence.recent_webhook_success_ids)||
    ![3865,3866,3867,3868].every(i=>evidence.recent_webhook_success_ids.includes(i))||
    evidence.recent_webhook_success_ids.some(i=>!Number.isSafeInteger(i))){
   return deny(['INVALID_OR_UNTRUSTED_PUBLISHED_BASELINE']);
 }
 if(evidence.published_prompt_has_dynamic_profile_binding!==false||
    evidence.published_prompt_mentions_bot_profile_version!==false||
    evidence.live_custom_profile_applied!==VALID_UNKNOWN){
   return deny(['ACTUAL_PUBLISHED_CONFIG_CLAIM_NOT_INDEPENDENTLY_VERIFIED']);
 }
 reasons.push('PUBLISHED_MESSENGER_PROMPT_STATIC_NOT_CONNECTED_TO_MERCHANT_STUDIO');
 if(evidence.published_has_legacy_demo_order_tools!==true||
    evidence.published_uses_demo_google_sheets!==true)
  return deny(['LEGACY_DEMO_TOOL_FACTS_CHANGED_REQUIRE_NEW_AUDIT']);
 reasons.push('LEGACY_DEMO_ORDER_TOOLS_CONNECTED_UNSAFE_FOR_CUSTOM_LIVE_UAT');
 for(const key of ['app_level_messages_subscription','app_level_postbacks_subscription',
   'page_level_subscription','page_owner_consent','trusted_page_to_store_binding']){
  if(evidence[key]!==VALID_UNKNOWN)
    return deny(['SELF_ASSERTED_APP_PAGE_OR_STORE_PROOF_NOT_ACCEPTED']);
  reasons.push(key.toUpperCase()+'_UNVERIFIED');
 }
 return deny(reasons);
}

/**
 * Creates a test-only config change for Shop A and verifies the runtime
 * can PREVIEW it separately without publishing or changing Shop B.
 * No Meta event is ingested. No real Shop A/B/C is authenticated here.
 */
export function trialCustomProfileInExistingSyntheticRuntime(){
 const runtime=createSyntheticMerchantRuntime();
 const sourceEvent=(account,event_id)=>({
  contract:'QA_VERIFIED_CHANNEL_EVENT_V1',
  channel:'MESSENGER',account_id:account,event_id,synthetic_text:'xin chao'
 });
 const beforeA=runtime.route(runtime.resolveTrustedQaChannel(
  sourceEvent('QA_META_A','QA-EVT-CUSTOM-A-BEFORE')));
 const beforeB=runtime.route(runtime.resolveTrustedQaChannel(
  sourceEvent('QA_META_B','QA-EVT-CUSTOM-B-BEFORE')));
 const draft=runtime.proposeBotChange({
  actor_id:'QA_MANAGER_A',store_id:'QA_STORE_A',expected_version:1,
  patch:{
   bot_name:'Trợ lý Tạp hóa A UAT',
   greeting:'TIEN404 QA: Chào bạn! Tôi hỗ trợ tạp hóa A, không tạo đơn thật.',
   tone:'thân thiện',business_hours:'07:00-20:00',wholesale_enabled:true
  }
 });
 const approved=runtime.ownerApproveDraft({
  actor_id:'QA_OWNER_A',store_id:'QA_STORE_A',candidate_version:draft.candidate_version
 });
 const preview=runtime.previewApprovedDraft({
  actor_id:'QA_OWNER_A',store_id:'QA_STORE_A'
 });
 const afterA=runtime.route(runtime.resolveTrustedQaChannel(
  sourceEvent('QA_META_A','QA-EVT-CUSTOM-A-AFTER')));
 const afterB=runtime.route(runtime.resolveTrustedQaChannel(
  sourceEvent('QA_META_B','QA-EVT-CUSTOM-B-AFTER')));
 const snapshot=runtime.mockSnapshot();
 return Object.freeze({
  status:'SOURCE_ONLY_CUSTOM_DRAFT_PREVIEW',
  beforeA:beforeA.answer_preview,
  beforeB:beforeB.answer_preview,
  afterA:afterA.answer_preview,
  afterB:afterB.answer_preview,
  draft_state:approved.state,
  preview_bot_name:preview.bot_name,
  preview_greeting:preview.greeting,
  preview_not_published:preview.not_published,
  preview_no_send:preview.no_send,
  audit_count:snapshot.audit.length,
  provider_sends:snapshot.liveProviderSends,
  hosted_writes:snapshot.hostedDbWrites,
  model_calls:snapshot.modelApiCalls,
  real_page_verified:false,
  actual_published_profile_changed:false,
  can_publish:false
 });
}
