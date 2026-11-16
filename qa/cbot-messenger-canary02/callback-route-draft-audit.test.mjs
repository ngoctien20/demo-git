import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {assessCallbackAndDraft} from './callback-route-draft-audit.mjs';
const dir=dirname(fileURLToPath(import.meta.url));
const b=JSON.parse(readFileSync(join(dir,'actual-callback-and-insertion-baseline-20261116.json'),'utf8'));
const d=JSON.parse(readFileSync(join(dir,'canary-exact-insertion-draft.json'),'utf8'));
const f=(x=b,y=d)=>assessCallbackAndDraft(x,y);
const deny=r=>{assert.equal(r.verdict,'NO_GO_LIVE_PATCH');for(const key of ['can_modify_published','can_send','can_write_orders','can_use_token','can_change_webhook'])assert.equal(r[key],false,key);assert.equal(r.send_count,0);};
test('screenshot Meta callback matches exact existing GET/POST n8n path',()=>{
 const r=f();deny(r);assert.equal(r.callback_path_matches_live,true);
 assert.equal(b.meta_callback_path,'/webhook/tien404-messenger-qa');
 assert.equal(b.webhook_get_path,b.webhook_post_path);
 assert.equal(b.webhook_get_node,'Webhook');assert.equal(b.webhook_post_node,'Webhook1');
});
test('image shows configured callback, masked verify token; does not show messages field',()=>{
 assert.equal(b.screenshot_callback_configured,true);
 assert.equal(b.screenshot_verify_token_masked,true);
 assert.equal(b.screenshot_messages_row_visible,false);
});
test('full page control and token are USER_ATTESTED, not read token or independent role',()=>{
 const r=f();deny(r);assert.equal(r.page_access,'USER_ATTESTED_ONLY');
 assert.equal(b.owner_full_control,'USER_ATTESTED_NOT_INDEPENDENTLY_REVIEWED');
 assert.equal(b.page_token_possession,'USER_ATTESTED_NOT_EXPOSED');
});
test('LIVE01 functional message flow and Page client receipt remain accepted',()=>{
 const r=f();deny(r);assert.equal(b.live01_execution_id,'4176');
 assert.equal(b.live01_received_by_user,true);
 assert.equal(r.reason,'STRUCTURE_MATCHES_BUT_LIVE_AUTHORIZATION_MISSING');
});
test('actual Loop One Message output 1 targets legacy Agent; candidate draft only',()=>{
 const r=f();deny(r);assert.equal(r.structural_plan_valid,true);
 assert.equal(b.loop_message_output_index,1);
 assert.equal(d.insertion_from_node,'Loop One Message');
 assert.equal(d.insertion_output_index,1);
 assert.equal(d.original_target_node,'Messenger AI Agent');
 assert.equal(d.enabled,false);
});
test('canary uses exactly shared Prepare Reply expecting output and one Send',()=>{
 assert.equal(b.prepare_accepts_incoming_output,true);
 assert.equal(d.canary_node_response_field,'output');
 assert.equal(b.shared_send_count,1);
 assert.equal(d.new_send_nodes,0);
 assert.equal(d.new_webhooks,0);
 assert.equal(d.shared_send_node,b.shared_send_node);
});
test('route must require verified HMAC, dedup, private page/recipient and TTL',()=>{
 const r=f();deny(r);assert.equal(r.structural_plan_valid,true);
 for(const k of ['guard_requires_signed_meta_event','guard_requires_deduplicated_message',
  'guard_requires_native_page_owner_attestation','guard_requires_private_page_allowlist',
  'guard_requires_private_qa_sender_allowlist','guard_requires_short_lived_one_use_consent',
  'route_mutually_exclusive'])assert.equal(d[k],true,k);
});
test('canary has no attached tool, model, HTTP or catalog/order writes',()=>{
 assert.deepEqual(d.canary_tool_workflow_nodes,[]);
 assert.deepEqual(d.canary_http_request_nodes,[]);
 assert.deepEqual(d.canary_model_nodes,[]);
 assert.equal(d.canary_order_writes,0);
 assert.equal(d.canary_catalog_reads,0);
 assert.equal(d.guard_requires_exact_input_marker,'TIEN404-CANARY-LIVE02');
});
test('mutation: wrong callback URL or GET/POST path rejects',()=>{
 for(const [k,v] of [['meta_callback_path','/webhook/other'],['webhook_get_path','something'],['webhook_post_path','wrong'],['shared_send_count',2]]){
  const x={...b,[k]:v},r=f(x,d);deny(r);
  assert.equal(r.callback_path_matches_live,false);
 }
});
test('mutation: wrong original workflow version/loop index or sender rejects',()=>{
 for(const [k,v] of [['published_version_id','unexpected'],['loop_message_output_index',0],
 ['loop_message_target','Wrong Node'],['shared_send_node','Other Send']]){
  const x={...b,[k]:v};const r=f(x,d);deny(r);
  assert.equal(r.structural_plan_valid,false);
 }
});
test('mutation: additional model, HTTP call, writer or second responder rejects',()=>{
 for(const [k,v] of [['canary_tool_workflow_nodes',['create_order']],
 ['canary_http_request_nodes',['httpRequest']],['canary_model_nodes',['OpenAI']],
 ['canary_order_writes',1],['new_webhooks',1],['new_send_nodes',1]]){
  const x=structuredClone(d);x[k]=v;const r=f(b,x);deny(r);
  assert.equal(r.structural_plan_valid,false,k);
 }
});
test('mutation: omitted sender allowlist/signature/TTL/exclusivity rejects',()=>{
 for(const k of ['guard_requires_signed_meta_event','guard_requires_deduplicated_message',
 'guard_requires_private_page_allowlist','guard_requires_private_qa_sender_allowlist',
 'guard_requires_short_lived_one_use_consent','route_mutually_exclusive']){
  const x=structuredClone(d);x[k]=false;const r=f(b,x);deny(r);
  assert.equal(r.structural_plan_valid,false,k);
 }
});
test('mutation: client-defined approvals cannot self-authorize live cutover',()=>{
 for(const k of ['owner_exact_diff_signed','private_authority_and_recipient_verified','release_authorized']){
  const x=structuredClone(d);x[k]=true;const r=f(b,x);deny(r);
  assert.equal(r.structural_plan_valid,false,k);
 }
});
test('mutation: unknown Page ID, PSID, credential or secret injected into evidence rejects',()=>{
 for(const k of ['page_id','psid','page_access_token','store_id','owner_email','approved']){
  const x={...b,[k]:'fake'};const r=f(x,d);deny(r);
  assert.equal(r.structural_plan_valid,false);
 }
});
test('unexpected secret or raw personal data not committed in either JSON file',()=>{
 const s=JSON.stringify(b)+JSON.stringify(d);
 for(const k of ['"psid"','"page_id"','"page_access_token"','"app_secret"',
 '"refresh_token"','"recipient_id"','"owner_email"','"phone"','"customer_name"']){
  assert.equal(s.includes(k),false,k);
 }
});
test('no scope of access to Meta tokens or modifications from this checker',()=>{
 const source=readFileSync(join(dir,'callback-route-draft-audit.mjs'),'utf8');
 for(const x of ['fetch(', 'axios(', 'http.request(', 'process.env.', 'sendMessage(',
  'createWorkflow(', 'updateWorkflow(', 'apply_migration('])assert.equal(source.includes(x),false,x);
});
