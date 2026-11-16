import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
const dir=dirname(fileURLToPath(import.meta.url));
const obj=JSON.parse(readFileSync(join(dir,'n8n-manual-qa-4177-observed.json'),'utf8'));
test('real connector evidence confirms n8n manual execution #4177',()=>{
 assert.equal(obj.contract,'T404_CBOT_MSG_CANARY_N8N_MANUAL_QA_EVIDENCE_V1');
 assert.equal(obj.observation,'DIRECT_CONNECTED_N8N_WORKFLOW_AND_EXECUTION_READONLY');
 assert.equal(obj.workflow_id,'VSmXkK7Y1Bb3Dg2w');
 assert.equal(obj.execution_id,'4177');
 assert.equal(obj.execution_mode,'manual');
 assert.equal(obj.execution_status,'success');
 assert.equal(obj.all_executed_nodes_success,true);
});
test('created workflow is inactive and not published or connected to Meta',()=>{
 assert.equal(obj.active,false);
 assert.equal(obj.published_version,null);
 assert.equal(obj.node_count,2);
 assert.deepEqual(obj.node_types,[
  'n8n-nodes-base.manualTrigger','n8n-nodes-base.code'
 ]);
 assert.equal(obj.assigned_credentials,0);
 assert.equal(obj.project_type,'personal');
 assert.equal(obj.parent_qa_folder,'90_QA - DIAGNOSTICS');
});
test('deterministic greeting preview is QA fixture only, no Commerce authority',()=>{
 assert.equal(obj.output_contract,'TIEN404_CBOT_CANARY_MANUAL_PREVIEW_V1');
 assert.equal(obj.output_kind,'OFFLINE_SOURCE_ONLY');
 assert.equal(obj.output_profile,'QA_STORE_A_SYNTHETIC');
 assert.equal(obj.candidate_version,2);
 assert.equal(obj.output_has_expected_greeting_tag,true);
 assert.equal(obj.synthetic_fixture_not_real_product_catalog,true);
});
test('run has zero real messages, Order/AI model work or publication permission',()=>{
 assert.equal(obj.can_send,false);
 assert.equal(obj.can_create_order,false);
 assert.equal(obj.can_publish,false);
 assert.equal(obj.provider_messages_sent,0);
 assert.equal(obj.orders_written,0);
 assert.equal(obj.paid_model_calls,0);
 assert.equal(obj.real_meta_message_sent,false);
});
test('native Page ownership, recipient proof and Published cutover are not verified',()=>{
 assert.equal(obj.native_page_proof_verified,false);
 assert.equal(obj.qa_recipient_owner_proof_verified,false);
 assert.equal(obj.real_published_agent_config_modified,false);
});
test('evidence contains no secret, Page ID, PSID, token or personal customer data',()=>{
 const text=readFileSync(join(dir,'n8n-manual-qa-4177-observed.json'),'utf8');
 for(const secret of ['"page_id"','"psid"','"access_token"','"refresh_token"',
 '"secret_ref"','"message_id"','"customer_name"','"phone"','"email"','"jwt"']){
  assert.equal(text.includes(secret),false,secret);
 }
});
