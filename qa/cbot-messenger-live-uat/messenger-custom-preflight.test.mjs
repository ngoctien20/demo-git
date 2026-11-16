import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {createSyntheticMerchantRuntime} from '../v167-merchant/merchant-registry.mjs';
import {
 assessPublishedMessengerCustomization,trialCustomProfileInExistingSyntheticRuntime
} from './messenger-custom-preflight.mjs';
const baseline=JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)),
 'actual-published-messenger-metadata-20261116.json'),'utf8'));
const clone=()=>structuredClone(baseline);
function noLive(r){
 assert.equal(r.verdict,'NO_GO_LIVE_CUSTOM_PROFILE');
 for(const k of ['custom_studio_deployed_to_published','app_and_page_subscriptions_verified',
  'page_to_store_owner_verified','real_config_change_tested','can_publish',
  'can_modify_published','can_write_orders','can_send_provider','can_change_credentials'])
  assert.equal(r[k],false,k);
 assert.equal(r.orders_written,0);
 assert.equal(r.provider_messages_sent,0);
 assert.equal(r.ai_model_calls,0);
}
test('actual observed Published Messenger baseline has same active 27-node version',()=>{
 assert.equal(baseline.workflow_id,'Z7FdV7uDvApfbURQ');
 assert.equal(baseline.published_version,'d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92');
 assert.equal(baseline.published_node_count,27);
 assert.equal(baseline.published_system_prompt_length,6984);
 assert.equal(baseline.published_active,true);
});
test('real Published Messenger is static prompt, not deployed Merchant config',()=>{
 const r=assessPublishedMessengerCustomization(clone());noLive(r);
 assert.ok(r.reasons.includes('PUBLISHED_MESSENGER_PROMPT_STATIC_NOT_CONNECTED_TO_MERCHANT_STUDIO'));
 assert.ok(r.reasons.includes('LEGACY_DEMO_ORDER_TOOLS_CONNECTED_UNSAFE_FOR_CUSTOM_LIVE_UAT'));
});
test('four historic webhook success executions do not certify live custom behavior',()=>{
 const r=assessPublishedMessengerCustomization(clone());noLive(r);
 assert.deepEqual(baseline.recent_webhook_success_ids,[3865,3866,3867,3868]);
 assert.equal(r.real_config_change_tested,false);
});
test('app and Page subscribed fields remain unverified despite visible Meta field list',()=>{
 const r=assessPublishedMessengerCustomization(clone());noLive(r);
 assert.ok(r.reasons.includes('APP_LEVEL_MESSAGES_SUBSCRIPTION_UNVERIFIED'));
 assert.ok(r.reasons.includes('APP_LEVEL_POSTBACKS_SUBSCRIPTION_UNVERIFIED'));
 assert.ok(r.reasons.includes('PAGE_LEVEL_SUBSCRIPTION_UNVERIFIED'));
});
test('Page owner consent and trusted binding are independently required',()=>{
 const r=assessPublishedMessengerCustomization(clone());noLive(r);
 assert.ok(r.reasons.includes('PAGE_OWNER_CONSENT_UNVERIFIED'));
 assert.ok(r.reasons.includes('TRUSTED_PAGE_TO_STORE_BINDING_UNVERIFIED'));
});
test('self-reported Page or webhook subscription yes must not become verified',()=>{
 for(const k of ['app_level_messages_subscription','app_level_postbacks_subscription',
 'page_level_subscription','page_owner_consent','trusted_page_to_store_binding']){
  const changed=clone();changed[k]='VERIFIED';
  const r=assessPublishedMessengerCustomization(changed);noLive(r);
  assert.deepEqual(r.reasons,['SELF_ASSERTED_APP_PAGE_OR_STORE_PROOF_NOT_ACCEPTED']);
 }
});
test('future Published config claims cannot pass without a new live version audit',()=>{
 const changed=clone();changed.published_prompt_has_dynamic_profile_binding=true;
 const r=assessPublishedMessengerCustomization(changed);noLive(r);
 assert.deepEqual(r.reasons,['ACTUAL_PUBLISHED_CONFIG_CLAIM_NOT_INDEPENDENTLY_VERIFIED']);
});
test('new unknown configuration, secrets, customer data cannot be injected into baseline',()=>{
 for(const k of ['page_id','token','page_access_token','psid',
  'customer_phone','store_owner','real_send','approval']){
  const changed=clone();changed[k]='ATTACKER';
  const r=assessPublishedMessengerCustomization(changed);noLive(r);
  assert.deepEqual(r.reasons,['INVALID_OR_UNTRUSTED_PUBLISHED_BASELINE']);
 }
});
test('wrong workflow version or absent signature verification fails closed',()=>{
 for(const [k,value] of [
  ['workflow_id','other'],['published_version','fake'],
  ['published_active',false],['published_has_meta_signature_verifier',false],
  ['published_extracts_postbacks',false]
 ]){
  const changed=clone();changed[k]=value;
  const r=assessPublishedMessengerCustomization(changed);noLive(r);
  assert.deepEqual(r.reasons,['INVALID_OR_UNTRUSTED_PUBLISHED_BASELINE']);
 }
});
test('preview A name/greeting can be configured with existing runtime without Published change',()=>{
 const r=trialCustomProfileInExistingSyntheticRuntime();
 assert.equal(r.status,'SOURCE_ONLY_CUSTOM_DRAFT_PREVIEW');
 assert.equal(r.preview_bot_name,'Trợ lý Tạp hóa A UAT');
 assert.match(r.preview_greeting,/TIEN404 QA/);
 assert.equal(r.preview_not_published,true);
 assert.equal(r.preview_no_send,true);
 assert.equal(r.actual_published_profile_changed,false);
 assert.equal(r.provider_sends,0);
 assert.equal(r.hosted_writes,0);
 assert.equal(r.model_calls,0);
 assert.equal(r.can_publish,false);
});
test('changing Shop A QA draft does not change active A or B reply',()=>{
 const r=trialCustomProfileInExistingSyntheticRuntime();
 assert.equal(r.beforeA,r.afterA);
 assert.equal(r.beforeB,r.afterB);
 assert.notEqual(r.beforeA,r.beforeB);
 assert.notEqual(r.beforeA,r.preview_greeting);
 assert.equal(r.draft_state,'OWNER_APPROVED_PREVIEW_ONLY');
});
test('wrong Shop actor cannot customize other Shop via runtime',()=>{
 const rt=createSyntheticMerchantRuntime();
 assert.throws(()=>rt.proposeBotChange({
  actor_id:'QA_OWNER_B',store_id:'QA_STORE_A',expected_version:1,
  patch:{greeting:'Unauthorized B override'}
 }),/ACTOR_STORE_SCOPE_DENIED/);
});
test('non-manager Shop A staff cannot customize via runtime',()=>{
 const rt=createSyntheticMerchantRuntime();
 assert.throws(()=>rt.proposeBotChange({
  actor_id:'QA_STAFF_A',store_id:'QA_STORE_A',expected_version:1,
  patch:{greeting:'Unauthorized staff'}
 }),/ROLE_CANNOT_EDIT_BOT/);
});
test('client cannot override global Core Policy through a bot custom patch',()=>{
 const rt=createSyntheticMerchantRuntime();
 assert.throws(()=>rt.proposeBotChange({
  actor_id:'QA_MANAGER_A',store_id:'QA_STORE_A',expected_version:1,
  patch:{policy_version:'PUBLISHED_BYPASS'}
 }),/PATCH_FIELDS_DENIED/);
});
test('stale bot version and invalid tone are denied',()=>{
 const rt=createSyntheticMerchantRuntime();
 assert.throws(()=>rt.proposeBotChange({
  actor_id:'QA_MANAGER_A',store_id:'QA_STORE_A',expected_version:999,
  patch:{tone:'cao cấp'}
 }),/CONFIG_VERSION_CONFLICT/);
 assert.throws(()=>rt.proposeBotChange({
  actor_id:'QA_MANAGER_A',store_id:'QA_STORE_A',expected_version:1,
  patch:{tone:'OWNER_PRIVILEGED'}
 }),/INVALID_TONE/);
});
test('an expired subscription cannot edit bot config',()=>{
 const rt=createSyntheticMerchantRuntime();
 rt.setSubscriptionForSyntheticTest('QA_STORE_A','EXPIRED');
 assert.throws(()=>rt.proposeBotChange({
  actor_id:'QA_MANAGER_A',store_id:'QA_STORE_A',expected_version:1,
  patch:{greeting:'Test'}
 }),/INACTIVE_STORE_CANNOT_EDIT/);
});
test('blind clone of saved config never grants live provider send',()=>{
 const r=trialCustomProfileInExistingSyntheticRuntime();
 const altered={...r,can_publish:true,actual_published_profile_changed:true};
 assert.equal(r.can_publish,false);
 assert.equal(r.actual_published_profile_changed,false);
 assert.notDeepEqual(altered,r);
});
