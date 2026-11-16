import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const file=join(dirname(fileURLToPath(import.meta.url)),
 'real-n8n-qa-disposable-restore-4182-4184.json');
const x=JSON.parse(readFileSync(file,'utf8'));
test('real connector receipt is n8n QA restored version, not self-reported synthetic output',()=>{
 assert.equal(x.contract,'T404_CBOT_MSG_CANARY03B_N8N_DISPOSABLE_RESTORE_DRILL_V1');
 assert.equal(x.evidence_origin,'CONNECTED_N8N_ACTUAL_QA_WORKFLOW_HISTORY_AND_EXECUTIONS');
 assert.equal(x.workflow_id,'WK6LZpISig65uZhg');
});
test('actual starting QA version had only manual+Code and passed baseline #4182',()=>{
 assert.equal(x.initial_saved_version_id,'65414180-5ba1-4ad5-8570-02cbdc6679d7');
 assert.equal(x.initial_node_count,2);
 assert.equal(x.initial_exec,'4182');
 assert.equal(x.initial_exec_success,true);
});
test('patch version added only one Code node and ran #4183 successfully',()=>{
 assert.equal(x.patched_version_id,'d13a68cf-1b9b-4634-af88-988f35f08fed');
 assert.equal(x.patched_node_count,3);
 assert.equal(x.patch_applied_operations,2);
 assert.equal(x.patch_added_node_type,'n8n-nodes-base.code');
 assert.equal(x.patched_exec,'4183');
 assert.equal(x.patched_exec_success,true);
});
test('actual restore tool created new version from exactly original QA baseline',()=>{
 assert.equal(x.restore_source_version,x.initial_saved_version_id);
 assert.equal(x.restore_reported_success,true);
 assert.equal(x.restored_new_version_id,'f9961a8e-d86d-41b1-a2e4-f249b1c90dc8');
 assert.equal(x.restored_node_count,2);
 assert.equal(x.restored_nodes_parameters_match_initial,true);
 assert.equal(x.restored_connections_match_initial,true);
});
test('post-restore actual manual #4184 output confirms baseline functionality',()=>{
 assert.equal(x.restored_run,'4184');
 assert.equal(x.restored_run_success,true);
 assert.equal(x.restored_runtime_contract,'T404_CANARY03B_N8N_RESTORE_BASELINE_V1');
 assert.equal(x.restored_runtime_state,'BASELINE_LOCKED');
});
test('QA drill is still inactive, unpublished and isolated in diagnostic folder',()=>{
 assert.equal(x.final_workflow_active,false);
 assert.equal(x.final_workflow_published_version,null);
 assert.equal(x.folder,'90_QA - DIAGNOSTICS');
 assert.deepEqual(x.final_node_types,['n8n-nodes-base.manualTrigger','n8n-nodes-base.code']);
});
test('none of the three manual executions can use external tokens or send',()=>{
 for(const k of ['credential_slots','webhook_nodes','meta_send_nodes','model_nodes',
   'customer_order_writes','provider_messages_sent']) assert.equal(x[k],0,k);
});
test('neither hosted Supabase nor original Published Messenger was edited',()=>{
 assert.equal(x.hosted_supabase_migration_performed,false);
 assert.equal(x.original_messenger_published_modified,false);
 assert.equal(x.original_messenger_encrypted_private_backup_verified,false);
 assert.equal(x.original_27_node_published_restore_tested,false);
});
test('real n8n QA restore pass cannot create a Production launch authorization',()=>{
 assert.equal(x.external_independent_human_reviewer_signed,false);
 assert.equal(x.live_canary_authorized,false);
 assert.equal(x.result,'DISPOSABLE_N8N_DRAFT_RESTORE_TESTED_NOT_PRODUCTION_CERTIFIED');
});
test('receipt never contains real PSID, Page ID, MID, user or any credential',()=>{
 const raw=readFileSync(file,'utf8');
 for(const s of ['"page_id"','"psid"','"sender_id"','"recipient_id"',
 '"access_token"','"app_secret"','"credentials"','"customer_name"',
 '"customer_phone"','"meta_message_id"','"raw_webhook_body"']){
  assert.equal(raw.includes(s),false,s);
 }
});
