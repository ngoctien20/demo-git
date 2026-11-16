import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const f=join(dirname(fileURLToPath(import.meta.url)),
 'real-n8n-qa-4181-item-pairing-receipt.json');
const x=JSON.parse(readFileSync(f,'utf8'));
test('actual n8n manual #4181 is a successful six-node pairing QA',()=>{
 assert.equal(x.contract,'T404_CBOT_MSG_CANARY03_REAL_N8N_ITEM_PAIRING_QA_V1');
 assert.equal(x.execution_id,'4181');
 assert.equal(x.execution_status,'success');
 assert.equal(x.mode,'manual');
 assert.equal(x.nodes,6);
 assert.equal(x.executed_nodes,6);
 assert.equal(x.executed_success_nodes,6);
});
test('new QA workflow is inactive and has no Meta/Orders/model capability',()=>{
 assert.equal(x.active,false);
 assert.equal(x.active_version,null);
 assert.equal(x.assigned_credentials,0);
 for(const k of ['webhook_nodes','http_send_nodes','model_nodes','tool_workflow_nodes'])
 assert.equal(x[k],0,k);
 assert.equal(x.personal_project,true);
 assert.equal(x.folder,'90_QA - DIAGNOSTICS');
});
test('exact original Prepare Messenger Reply is tested using same Loop node name',()=>{
 assert.equal(x.exact_original_prepare_messenger_reply_code_reused,true);
 assert.equal(x.loop_one_message_node_name_preserved,true);
 assert.equal(x.synthetic_sender_matched,true);
 assert.equal(x.synthetic_page_matched,true);
 assert.equal(x.synthetic_message_id_matched,true);
});
test('test is synthetic only and does not certify native Meta signatures',()=>{
 assert.equal(x.synthetic_only,true);
 assert.equal(x.real_meta_hmac_verified_in_this_execution,false);
 assert.equal(x.real_customer_id_used,false);
 assert.equal(x.real_meta_message_sent,false);
});
test('actual manual execution did not send a provider message or write Orders',()=>{
 assert.equal(x.provider_sends,0);
 assert.equal(x.paid_model_calls,0);
 assert.equal(x.orders_written,0);
});
test('no cutover authorization or atomic one-time claim was inferred',()=>{
 assert.equal(x.live_published_workflow_id,'Z7FdV7uDvApfbURQ');
 assert.equal(x.live_published_changed,false);
 assert.equal(x.real_page_qa_recipient_bound,false);
 assert.equal(x.atomic_one_time_claim_implemented,false);
 assert.equal(x.live_cutover_approved,false);
});
test('safe QA receipt has no Page, PSID, customer or API credential identifier',()=>{
 const raw=readFileSync(f,'utf8');
 for(const k of ['"page_id"','"sender_id"','"psid"','"access_token"',
 '"refresh_token"','"app_secret"','"customer_name"',
 '"customer_phone"','"message_id"','"meta_message_id"','"headers"']){
  assert.equal(raw.includes(k),false,k);
 }
});
