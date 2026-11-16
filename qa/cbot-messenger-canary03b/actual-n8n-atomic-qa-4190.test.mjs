import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const file=join(dirname(fileURLToPath(import.meta.url)),'actual-n8n-atomic-qa-4190.json');
const d=JSON.parse(readFileSync(file,'utf8'));
test('actual connected n8n manual execution 4190 is success',()=>{
 assert.equal(d.contract,'T404_CBOT_MSG_CANARY03B_N8N_SYNTHETIC_ATOMIC_QA_RECEIPT_V1');
 assert.equal(d.source,'CONNECTED_N8N_READ_ONLY_EXECUTION_4190');
 assert.equal(d.execution_id,'4190');
 assert.equal(d.execution_status,'success');
 assert.equal(d.execution_mode,'manual');
 assert.equal(d.executed_nodes_success,2);
});
test('QA workflow is inactive, 2 nodes and no provider/credentials',()=>{
 assert.equal(d.active,false);
 assert.equal(d.active_version,null);
 assert.equal(d.node_count,2);
 assert.deepEqual(d.node_types,['n8n-nodes-base.manualTrigger','n8n-nodes-base.code']);
 assert.equal(d.assigned_credentials,0);
 assert.equal(d.webhook_nodes,0);
 assert.equal(d.send_nodes,0);
});
test('100 competing claims: exactly one accepted, 99 rejected and differing MID blocked',()=>{
 assert.equal(d.expected_attempts,100);
 assert.equal(d.one_grant_approved_preview,1);
 assert.equal(d.concurrent_synthetic_rejections,99);
 assert.equal(d.second_distinct_mid_rejected,true);
});
test('manual QA is single-process only, not durable multi-worker proof',()=>{
 assert.equal(d.backend,'MEMORY_ONLY_NOT_DURABLE');
 assert.equal(d.hosted_atomic_transaction_verified,false);
 assert.equal(d.multi_worker_race_tested,false);
 assert.equal(d.process_restart_persistence_tested,false);
});
test('actual QA never sent to Meta, made Orders or called a paid model',()=>{
 assert.equal(d.provider_messages_sent,0);
 assert.equal(d.orders_written,0);
 assert.equal(d.paid_model_calls,0);
 assert.equal(d.published_changes,0);
 assert.equal(d.actual_live_canary_sent,false);
});
test('user privacy and native authority are not inferred from synthetic flags',()=>{
 assert.equal(d.real_page_recipient_verified,false);
 assert.equal(d.real_meta_hmac_in_this_execution,false);
 assert.equal(d.native_qa_consent_verified,false);
});
test('sanitized receipt contains no native Meta user, Page or secret data',()=>{
 const text=readFileSync(file,'utf8');
 for(const key of ['"psid"','"page_id"','"sender_id"','"recipient_id"',
 '"access_token"','"app_secret"','"phone"','"email"','"raw_webhook"'])
  assert.equal(text.includes(key),false,key);
});
