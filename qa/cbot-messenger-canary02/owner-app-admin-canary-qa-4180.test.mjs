import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const file=join(dirname(fileURLToPath(import.meta.url)),'owner-app-admin-canary-qa-4180-evidence.json');
const x=JSON.parse(readFileSync(file,'utf8'));
test('native Meta screenshot supports app Administrator role only',()=>{
 assert.equal(x.meta_app_name,'TIEN404 AI Messenger');
 assert.equal(x.meta_app_admin_role_visible,true);
 assert.equal(x.meta_page_full_control_claim,'USER_ATTESTED');
 assert.equal(x.meta_page_business_admin_independently_verified,false);
 assert.equal(x.meta_app_publish_ui_readonly,'CHUA_DANG');
});
test('read-only developer view does not certify App Review or Page subscription',()=>{
 assert.equal(x.meta_app_permission_review_verified,false);
 assert.equal(x.meta_page_app_messages_subscription_verified,false);
 assert.equal(x.native_page_role_proof_complete,false);
});
test('owner approval is for controlled QA, not an unspecified production patch',()=>{
 assert.equal(x.owner_test_approval,'APPROVED_QA_TEST_SCOPE');
 assert.equal(x.approved_live_published_cutover,false);
 assert.equal(x.approved_real_provider_send,false);
 assert.equal(x.can_publish,false);
 assert.equal(x.can_send_provider,false);
});
test('published Messenger baseline retained exactly',()=>{
 assert.equal(x.live_messenger_workflow_id,'Z7FdV7uDvApfbURQ');
 assert.equal(x.live_published_version,'d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92');
 assert.equal(x.live_published_active,true);
 assert.equal(x.live_writer_tool_links,5);
 assert.equal(x.no_published_change,true);
});
test('actual 4-node n8n manual QA is inactive without API, send, credentials or models',()=>{
 assert.equal(x.qa_workflow_id,'bOaSukunPYUWg2pS');
 assert.equal(x.qa_workflow_active,false);
 assert.equal(x.qa_published_version,null);
 assert.equal(x.qa_node_count,4);
 assert.deepEqual(new Set(x.qa_node_types),new Set(['n8n-nodes-base.manualTrigger','n8n-nodes-base.code']));
 for(const k of ['qa_assigned_credentials','qa_webhook_nodes','qa_meta_send_nodes','qa_external_ai_model_nodes'])
  assert.equal(x[k],0,k);
});
test('execution #4180 succeeded with 13 synthetic decisions',()=>{
 assert.equal(x.qa_execution_id,'4180');
 assert.equal(x.qa_execution_mode,'manual');
 assert.equal(x.qa_execution_status,'success');
 assert.equal(x.qa_executed_nodes,4);
 assert.equal(x.qa_executed_nodes_success,4);
 assert.equal(x.qa_fixtures_total,13);
 assert.equal(x.qa_cases_passed,13);
 assert.equal(x.qa_cases_allowed_preview,1);
 assert.equal(x.qa_cases_denied,12);
});
test('synthetic HMAC and Page scope are NOT real Meta signatures or PSID attestation',()=>{
 assert.equal(x.qa_hmac_condition,'SYNTHETIC_FLAG_ONLY_NOT_NATIVE_SIGNATURE');
 assert.equal(x.qa_page_and_sender_ids,'SYNTHETIC_PLACEHOLDERS_ONLY');
 assert.equal(x.single_recipient_real_binding_complete,false);
});
test('no Order write, provider send or paid model in actual QA execution',()=>{
 assert.equal(x.qa_orders_written,0);
 assert.equal(x.qa_provider_messages_sent,0);
 assert.equal(x.qa_paid_model_calls,0);
 assert.equal(x.exact_live_patch_reviewed_and_backed_up,false);
});
test('receipt does not contain real Meta IDs, account tokens, user identifiers or private content',()=>{
 const raw=readFileSync(file,'utf8');
 for(const key of ['"page_id"','"psid"','"sender_id"','"access_token"',
  '"refresh_token"','"app_secret"','"owner_email"','"customer_name"',
  '"customer_phone"','"raw_webhook_body"','"authorization"'])
  assert.equal(raw.includes(key),false,key);
});
test('a successfully executed synthetic case never grants production authority',()=>{
 assert.equal(x.qa_cases_passed,13);
 assert.equal(x.approved_live_published_cutover,false);
 assert.equal(x.approved_real_provider_send,false);
 assert.equal(x.native_page_role_proof_complete,false);
 assert.equal(x.single_recipient_real_binding_complete,false);
});
