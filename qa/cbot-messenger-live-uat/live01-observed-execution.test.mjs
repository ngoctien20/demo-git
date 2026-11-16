import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
const file=join(dirname(fileURLToPath(import.meta.url)),'live01-observed-execution-4176.json');
const evidence=JSON.parse(readFileSync(file,'utf8'));
test('actual LIVE01 comes from connected n8n execution, not synthetic fixture',()=>{
 assert.equal(evidence.contract,'T404_CBOT_MSG_LIVE01_EXECUTION_READONLY_EVIDENCE_V1');
 assert.equal(evidence.source,'CONNECTED_N8N_READ_ONLY_EXECUTION_4176');
 assert.equal(evidence.workflow_id,'Z7FdV7uDvApfbURQ');
 assert.equal(evidence.execution_id,'4176');
 assert.equal(evidence.execution_mode,'webhook');
 assert.equal(evidence.execution_status,'success');
 assert.equal(evidence.inbound_marker_exact,'TIEN404-CUSTOM-LIVE01');
 assert.equal(evidence.inbound_marker_matched,true);
});
test('live message has valid signature at both n8n checks',()=>{
 assert.equal(evidence.signature_timing_safe_verified,true);
 assert.equal(evidence.meta_signature_if_node_verified,true);
 assert.equal(evidence.extract_messenger_text_executed,true);
 assert.equal(evidence.skip_duplicate_message_id_executed,true);
 assert.equal(evidence.inbound_message_id_present,true);
});
test('one live Meta send accepted, ID correlated, not proof client saw message',()=>{
 assert.equal(evidence.meta_send_http_executed_count,1);
 assert.equal(evidence.meta_send_message_id_returned,true);
 assert.equal(evidence.send_result_meta_id_matches,true);
 assert.equal(evidence.delivery_accepted_at_present,true);
 assert.equal(evidence.provider_delivery_on_client_confirmed,false);
});
test('AI Agent executed but did not call business tools or create orders',()=>{
 assert.equal(evidence.ai_agent_executed,true);
 assert.equal(evidence.ai_reply_content_class,'IDENTITY_AND_DEFAULT_GREETING');
 assert.equal(evidence.ai_output_chars,162);
 assert.equal(evidence.model_called,true);
 assert.deepEqual(evidence.business_tool_invocations,{
  create_order:0,manage_order:0,update_order_address:0,get_order_status:0,create_support_ticket:0
 });
 assert.equal(evidence.business_order_writes_observed,0);
 assert.equal(evidence.message_id_recorded_for_dedup,true);
});
test('all 11 runData nodes succeeded for single webhook UAT',()=>{
 assert.equal(evidence.actual_execution_node_count,11);
 assert.equal(evidence.all_executed_nodes_succeeded,true);
 const start=Date.parse(evidence.event_started_at_utc),
   stop=Date.parse(evidence.event_stopped_at_utc);
 assert.ok(stop>start&&stop-start<60000);
});
test('LIVE BASELINE PASS is not LIVE CUSTOMIZATION or real Store proof',()=>{
 assert.equal(evidence.verdict,'LIVE_BASELINE_TECHNICAL_PASS_USER_VISIBLE_DELIVERY_PENDING');
 for(const k of [
 'provider_delivery_on_client_confirmed',
 'page_owner_and_store_authority_independently_verified',
 'studio_draft_loaded_into_live_agent','live_customization_verified',
 'authorized_publish','authorized_live_config_change','authorized_order_write'
 ])assert.equal(evidence[k],false,k);
});
test('receipt does not publish private Page, PSID, message ID, token or customer data',()=>{
 const raw=readFileSync(file,'utf8');
 for(const k of ['page_id','psid','sender_id','recipient_id','access_token',
 'app_secret','message_id','meta_message_id','customer_phone',
 'customer_name','email','headers','raw_body','reply_text']){
  assert.equal(raw.includes('"'+k+'"'),false,k);
 }
});
test('real output remains no-go for direct Studio-to-Page publication',()=>{
 assert.equal(evidence.studio_draft_loaded_into_live_agent,false);
 assert.equal(evidence.live_customization_verified,false);
 assert.equal(evidence.authorized_publish,false);
 assert.equal(evidence.authorized_live_config_change,false);
});
