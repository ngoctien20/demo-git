import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {
 constructReviewOnlyCandidate,independentlyReviewAndRestore
} from './independent-restore-roundtrip.mjs';
import {CANARY03_ADDED_NAMES as N} from
 '../cbot-messenger-canary03/exact-locked-graph-patch.mjs';
const dir=dirname(fileURLToPath(import.meta.url));
const f=(x)=>JSON.parse(readFileSync(join(dir,x),'utf8'));
const original=JSON.parse(readFileSync(join(dir,
 '../cbot-messenger-canary03/actual-published-redacted-topology-27nodes.json'),'utf8'));
const version=f('original-published-restore-source-evidence.json');
const recipient=f('live01-private-recipient-provenance-20261116.json');
const sample=()=>constructReviewOnlyCandidate(structuredClone(original));
const baselineReview=()=>independentlyReviewAndRestore(original,sample().candidate);
function mustFail(r,reason){
 assert.equal(r.status,'NO_GO_LIVE_RESTORE');
 assert.equal(r.reason,reason);
 assert.equal(r.source_roundtrip_pass,false);
 assert.equal(r.private_backup_certified,false);
 assert.equal(r.real_restore_rehearsal_pass,false);
 assert.equal(r.can_publish,false);
 assert.equal(r.can_send,false);
}
test('n8n history has exact current active Published version retrievable',()=>{
 assert.equal(version.workflow_id,'Z7FdV7uDvApfbURQ');
 assert.equal(version.expected_active_version,original.activeVersionId);
 assert.equal(version.pinned_version_history_present,true);
 assert.equal(version.pinned_version_retrieved_readonly,true);
 assert.equal(version.pinned_version_metadata_matches_current_nodes,true);
 assert.equal(version.pinned_version_connections_match_current,true);
 assert.equal(version.published_node_count,27);
});
test('n8n history source != separate encrypted backup or actual restore',()=>{
 assert.equal(version.observed_version_history_entries,1);
 assert.equal(version.history_prune_risk,'ONLY_ONE_VERSION_VISIBLE');
 assert.equal(version.independent_private_encrypted_export_seen,false);
 assert.equal(version.executable_restore_performed,false);
 assert.equal(version.staged_clone_restore_rehearsal_performed,false);
 assert.equal(version.restore_certification,'RESTORE_VERSION_RETRIEVABLE_ONLY_NOT_BACKUP_CERTIFIED');
});
test('LIVE01 privately paired source recipient but no private QA allowlist',()=>{
 assert.equal(recipient.execution_id,'4176');
 assert.equal(recipient.valid_hmac,true);
 assert.equal(recipient.inbound_sender_page_message_id_paired_to_prepare,true);
 assert.equal(recipient.outbound_meta_recipient_matches_original_sender,true);
 assert.equal(recipient.meta_send_mid_matches_verifier,true);
 assert.equal(recipient.human_visible_reply_confirmed_by_user,true);
 assert.equal(recipient.exact_private_qa_psid_bound,false);
 assert.equal(recipient.can_send_live_canary,false);
});
test('source simulated 27→32 locked patch has exactly five new nodes',()=>{
 const r=sample();
 assert.equal(r.status,'REDUCTED_SOURCE_ONLY_PATCH_SIMULATED');
 assert.equal(r.candidate.nodes.length,32);
 assert.equal(r.candidate.activeVersionId,original.activeVersionId);
 assert.equal(original.nodes.length,27);
});
test('independent source restore reconstructs identical redacted 27-node baseline',()=>{
 const r=baselineReview();
 assert.equal(r.status,'SOURCE_ONLY_ROUNDTRIP_PASS_LIVE_RESTORE_NO_GO');
 assert.equal(r.source_roundtrip_pass,true);
 assert.equal(r.restored_node_count,27);
 assert.equal(r.original_published_version,original.activeVersionId);
 assert.equal(r.private_backup_certified,false);
 assert.equal(r.real_restore_rehearsal_pass,false);
 assert.equal(r.provider_messages_sent,0);
 assert.equal(r.orders_written,0);
});
test('no accidental mutation to the original source fixture',()=>{
 const before=JSON.stringify(original);
 sample();baselineReview();
 assert.equal(JSON.stringify(original),before);
});
test('changing a pre-existing live node code is detected before rollback',()=>{
 const c=sample().candidate;
 c.nodes.find(n=>n.name==='Prepare Messenger Reply').parameters.jsCode='return [];';
 mustFail(independentlyReviewAndRestore(original,c),'EXISTING_NODE_PARAMETERS_MUTATED');
});
test('changing a pre-existing webhook path is blocked',()=>{
 const c=sample().candidate;
 c.nodes.find(n=>n.name==='Webhook1').parameters.path='fake-path';
 mustFail(independentlyReviewAndRestore(original,c),'EXISTING_NODE_PARAMETERS_MUTATED');
});
test('unexpected change to legacy Agent tool connector is blocked',()=>{
 const c=sample().candidate;
 c.connections.create_order.ai_tool=[[]];
 mustFail(independentlyReviewAndRestore(original,c),'OTHER_EXISTING_CONNECTION_MUTATED');
});
test('unexpected new provider Send edge is blocked',()=>{
 const c=sample().candidate;
 c.connections[N.drop]={main:[[{node:'Send Messenger Reply - CONFIGURE TOKEN',type:'main',index:0}]]};
 mustFail(independentlyReviewAndRestore(original,c),'UNEXPECTED_NEW_CONNECTION_SOURCE');
});
test('duplicate arbitrary node cannot pass 32-node round trip',()=>{
 const c=sample().candidate;
 c.nodes.push({...c.nodes[0],name:'Fake API Sender'});
 mustFail(independentlyReviewAndRestore(original,c),'SOURCE_VERSION_OR_NODE_COUNT_CHANGED');
});
test('injecting credentials into Canary guard is blocked',()=>{
 const c=sample().candidate;
 c.nodes.find(n=>n.name===N.guard).credentials={facebook:{id:'fake_test'}};
 mustFail(independentlyReviewAndRestore(original,c),'NEW_CREDENTIAL_OR_EXTERNAL_NODE');
});
test('replacing Canary guard by HTTP node is blocked',()=>{
 const c=sample().candidate;
 c.nodes.find(n=>n.name===N.guard).type='n8n-nodes-base.httpRequest';
 mustFail(independentlyReviewAndRestore(original,c),'NEW_CREDENTIAL_OR_EXTERNAL_NODE');
});
test('changing Canary match to true is blocked',()=>{
 const c=sample().candidate;
 c.nodes.find(n=>n.name===N.guard).parameters.jsCode=
  'return [{json:{t404_canary_match:true,t404_qa_block:false}}];';
 mustFail(independentlyReviewAndRestore(original,c),'CANARY_GUARD_NOT_LOCKED');
});
test('changing Loop output edge to unknown recipient bypass is blocked',()=>{
 const c=sample().candidate;
 c.connections['Loop One Message'].main[1]=[
  {node:'Fake Direct Send',type:'main',index:0}];
 mustFail(independentlyReviewAndRestore(original,c),'LOOP_NOT_EXACTLY_LOCKED');
});
test('extra Canary branch to legacy Agent is blocked',()=>{
 const c=sample().candidate;
 c.connections[N.greeting].main[0].push(
  {node:'Messenger AI Agent',type:'main',index:0});
 mustFail(independentlyReviewAndRestore(original,c),'NEW_CANARY_CONNECTION_CHANGED');
});
test('unmatched original Published version cannot be source-restored',()=>{
 const c=sample().candidate;
 c.activeVersionId='unknown version';
 mustFail(independentlyReviewAndRestore(original,c),'SOURCE_VERSION_OR_NODE_COUNT_CHANGED');
});
test('GitHub receipts contain no real Facebook Page/PSID/token data',()=>{
 const raw=readFileSync(join(dir,'live01-private-recipient-provenance-20261116.json'),'utf8')+
 readFileSync(join(dir,'original-published-restore-source-evidence.json'),'utf8');
 for(const s of ['"page_id"','"psid"','"recipient_id"','"sender_id"',
 '"access_token"','"app_secret"','"customer_phone"','"customer_name"',
 '"raw_body"','"headers"']){
  assert.equal(raw.includes(s),false,s);
 }
});
test('round trip review is not a real n8n restore or a Publish authorization',()=>{
 const r=baselineReview();
 assert.equal(r.can_publish,false);
 assert.equal(r.can_send,false);
 assert.equal(r.real_restore_rehearsal_pass,false);
 assert.equal(r.private_backup_certified,false);
});
