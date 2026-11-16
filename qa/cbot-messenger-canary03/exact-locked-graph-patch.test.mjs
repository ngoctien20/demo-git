import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {verifyObservedBaseline,previewLockedExactPatch,
 CANARY03_ADDED_NAMES as NEW,CANARY03_LEGACY_TOOL_NAMES as TOOLS,
 CANARY03_BASELINE as BASE} from './exact-locked-graph-patch.mjs';
const root=dirname(fileURLToPath(import.meta.url));
const baseline=JSON.parse(readFileSync(join(root,
 'actual-published-redacted-topology-27nodes.json'),'utf8'));
const copy=()=>structuredClone(baseline);
const patched=()=>previewLockedExactPatch(copy());
const noGo=r=>{
 assert.equal(r.can_apply_published,false);
 assert.equal(r.can_send,false);
 assert.equal(r.can_write_order,false);
 assert.equal(r.can_use_credentials,false);
 assert.equal(r.can_activate,false);
 assert.equal(r.live_patch_exported,false);
};
test('redacted fixture is directly derived from exact published 27-node version',()=>{
 assert.equal(baseline.contract,'T404_CBOT_CANARY03_REDACTED_ACTUAL_TOPOLOGY_ONLY');
 assert.equal(baseline.source,'CONNECTED_N8N_READ_ONLY_SNAPSHOT_20261116');
 assert.equal(baseline.id,BASE.workflow_id);
 assert.equal(baseline.activeVersionId,BASE.active_version);
 assert.equal(baseline.nodes.length,BASE.node_count);
 assert.equal(baseline.active,true);
});
test('actual published topology passes all strict baseline checks',()=>{
 const r=verifyObservedBaseline(copy());
 assert.equal(r.valid,true,JSON.stringify(r.errors));
 assert.deepEqual(r.errors,[]);
});
test('source blueprint adds five exact nodes, but cannot deploy itself',()=>{
 const r=patched();noGo(r);
 assert.equal(r.status,'PATCH_BLUEPRINT_VALID_LOCKED_NOT_APPLIED');
 assert.equal(r.original_node_count,27);
 assert.equal(r.proposed_node_count,32);
 assert.equal(r.changes.added_nodes.length,5);
});
test('patch replaces ONLY Loop output index 1 Agent edge with locked guard',()=>{
 const r=patched();noGo(r);
 assert.equal(r.changes.replace_connection.from,'Loop One Message');
 assert.equal(r.changes.replace_connection.output_index,1);
 assert.deepEqual(r.changes.replace_connection.old,[{node:'Messenger AI Agent',type:'main',index:0}]);
 assert.deepEqual(r.changes.replace_connection.new,[{node:NEW.guard,type:'main',index:0}]);
});
test('Guard node code has hardcoded non-client-overridable disabled route',()=>{
 const r=patched();
 const guard=r.changes.added_nodes.find(x=>x.name===NEW.guard);
 assert.equal(guard.type,'n8n-nodes-base.code');
 assert.match(guard.parameters.jsCode,/t404_canary_match:false/);
 assert.match(guard.parameters.jsCode,/t404_qa_block:false/);
 assert.match(guard.parameters.jsCode,/LOCKED_AWAITING_PRIVATE_OWNER_REVIEW/);
 assert.doesNotMatch(guard.parameters.jsCode,/process\.env|fetch\(|getWorkflowStaticData/);
 noGo(r);
});
test('exclusive IF branch true=deterministic greeting false=QA block check',()=>{
 const r=patched();
 assert.deepEqual(r.changes.add_connections[NEW.guard].main[0].map(x=>x.node),[NEW.ifMatch]);
 assert.deepEqual(r.changes.add_connections[NEW.ifMatch].main.map(x=>x[0].node),
  [NEW.greeting,NEW.ifBlock]);
 assert.deepEqual(r.changes.add_connections[NEW.ifBlock].main.map(x=>x[0].node),
  [NEW.drop,'Messenger AI Agent']);
 noGo(r);
});
test('Canary greeting goes only to existing Prepare → Send without legacy Agent',()=>{
 const r=patched();noGo(r);
 assert.equal(r.canary_path_reaches_ai_agent,false);
 assert.equal(r.canary_path_reaches_single_sender,true);
 assert.equal(r.structurally_no_write_canary_path,true);
 assert.deepEqual(r.changes.add_connections[NEW.greeting].main[0].map(x=>x.node),
  ['Prepare Messenger Reply']);
});
test('QA-block node emits zero items and has no outgoing Send connection',()=>{
 const r=patched();noGo(r);
 const drop=r.changes.added_nodes.find(x=>x.name===NEW.drop);
 assert.equal(drop.type,'n8n-nodes-base.code');
 assert.match(drop.parameters.jsCode,/return \[\];/);
 assert.equal(r.drop_path_reaches_sender,false);
 assert.equal(r.changes.add_connections[NEW.drop],undefined);
});
test('Prepare's real Loop item pairing contract must be kept unchanged',()=>{
 const r=patched();noGo(r);
 const p=baseline.nodes.find(x=>x.name==='Prepare Messenger Reply');
 assert.match(p.parameters.jsCode,/context\.currentRunIndex/);
 assert.match(p.parameters.jsCode,/Loop One Message/);
 assert.equal(r.changes.added_nodes.some(x=>x.name==='Prepare Messenger Reply'),false);
});
test('No new webhook, provider send, Agent, toolWorkflow, credential or HTTP',()=>{
 const r=patched();noGo(r);
 assert.equal(r.new_webhook_nodes,0);
 assert.equal(r.new_provider_send_nodes,0);
 const names=r.changes.added_nodes.map(x=>x.type);
 assert.equal(names.filter(x=>x==='n8n-nodes-base.code').length,3);
 assert.equal(names.filter(x=>x==='n8n-nodes-base.if').length,2);
 assert.equal(r.changes.added_nodes.some(x=>x.credentials),false);
 assert.equal(r.changes.added_nodes.some(x=>/webhook|httpRequest|langchain|toolWorkflow/.test(x.type)),false);
});
test('Fixed greeting is deterministic and only outputs expected field',()=>{
 const r=patched(),node=r.changes.added_nodes.find(x=>x.name===NEW.greeting);
 assert.match(node.parameters.jsCode,/output:'TIEN404-CANARY-01:/);
 assert.match(node.parameters.jsCode,/pairedItem/);
 assert.doesNotMatch(node.parameters.jsCode,/create_order|manage_order|sendMessage|fetch\(/);
});
test('IF nodes compare trusted guard booleans not user-supplied chat text',()=>{
 const r=patched(),a=r.changes.added_nodes.find(x=>x.name===NEW.ifMatch),
 b=r.changes.added_nodes.find(x=>x.name===NEW.ifBlock);
 assert.equal(a.parameters.conditions.conditions[0].leftValue,'={{ $json.t404_canary_match }}');
 assert.equal(b.parameters.conditions.conditions[0].leftValue,'={{ $json.t404_qa_block }}');
 assert.equal(a.parameters.conditions.conditions[0].operator.operation,'true');
 assert.equal(b.parameters.conditions.conditions[0].operator.operation,'true');
});
test('preview retains live legacy writer tool connections without triggering them',()=>{
 const r=patched();noGo(r);
 assert.equal(r.existing_legacy_tool_edges_preserved,true);
 assert.deepEqual(TOOLS,['create_order','update_order_address','manage_order','get_order_status','create_support_ticket']);
});
test('Wrong workflow ID, published version, active state or node count fail closed',()=>{
 for(const [k,v] of [['id','OTHER'],['activeVersionId','v999'],['active',false]]){
  const x=copy();x[k]=v;const r=previewLockedExactPatch(x);
  noGo(r);assert.equal(r.status,'BLOCKED_BASELINE_MISMATCH');
 }
 const z=copy();z.nodes.pop();const r=previewLockedExactPatch(z);
 noGo(r);assert.equal(r.status,'BLOCKED_BASELINE_MISMATCH');
});
test('Changed Loop branch or Agent→Prepare / Prepare→Send aborts patch',()=>{
 for(const [from,to] of [
 ['Loop One Message','WrongAgent'],
 ['Messenger AI Agent','OtherPrepare'],
 ['Prepare Messenger Reply','OtherSend']
 ]){
  const z=copy();
  const output=from==='Loop One Message'?1:0;
  z.connections[from].main[output]=[{node:to,type:'main',index:0}];
  const r=previewLockedExactPatch(z);noGo(r);
  assert.equal(r.status,'BLOCKED_BASELINE_MISMATCH');
 }
});
test('Any changed signed webhook/dedup chain aborts patch',()=>{
 for(const n of ['Webhook1','Crypto','Verify Signature Timing-Safe',
 'Respond to Webhook2','Extract Messenger Text','Skip Duplicate Message ID']){
  const z=copy();z.connections[n].main[0]=[{node:'Injected',type:'main',index:0}];
  const r=previewLockedExactPatch(z);noGo(r);
  assert.equal(r.status,'BLOCKED_BASELINE_MISMATCH');
 }
});
test('New duplicate sender or altered GET/POST path aborts patch',()=>{
 const x=copy();x.nodes.find(n=>n.name==='Webhook1').parameters.path='other';
 assert.equal(previewLockedExactPatch(x).status,'BLOCKED_BASELINE_MISMATCH');
 const y=copy();y.nodes.push(y.nodes[0]);assert.equal(previewLockedExactPatch(y).status,'BLOCKED_BASELINE_MISMATCH');
});
test('Missing any legacy tool→Agent connection is an unexpected graph change',()=>{
 for(const name of TOOLS){
  const x=copy();x.connections[name].ai_tool=[[]];
  const r=previewLockedExactPatch(x);
  noGo(r);assert.equal(r.status,'BLOCKED_BASELINE_MISMATCH',name);
 }
});
test('Any alteration to Prepare Reply Loop item semantics aborts patch',()=>{
 const x=copy();x.nodes.find(n=>n.name==='Prepare Messenger Reply').parameters.jsCode='return [];';
 const r=previewLockedExactPatch(x);noGo(r);
 assert.equal(r.status,'BLOCKED_BASELINE_MISMATCH');
});
test('Refusing repeated application prevents duplicate canary layers',()=>{
 const x=copy();x.nodes[0].name=NEW.guard;
 const r=previewLockedExactPatch(x);noGo(r);
 assert.equal(r.status,'BLOCKED_BASELINE_MISMATCH');
});
test('Meta subscription, consent, recipient proof and atomic one-shot claim stay false',()=>{
 const r=patched();noGo(r);
 assert.equal(r.real_page_target_verified,false);
 assert.equal(r.private_qa_recipient_bound,false);
 assert.equal(r.atomic_one_shot_guard_implemented,false);
 assert.equal(r.changes.owner_exact_diff_signed,undefined);
 assert.equal(r.changes.publish_authorized,false);
});
test('Mock source input cannot be mutated by preview builder',()=>{
 const x=copy(),snapshot=JSON.stringify(x);
 const r=previewLockedExactPatch(x);noGo(r);
 assert.equal(JSON.stringify(x),snapshot);
});
test('Redacted live topology and patch specification contain no Page/PSID/token data',()=>{
 const src=readFileSync(join(root,'actual-published-redacted-topology-27nodes.json'),'utf8');
 const rendered=JSON.stringify(patched());
 for(const k of ['"page_id"','"sender_id"','"psid"','"access_token"','"app_secret"',
  '"customer_phone"','"customer_name"','"credential"','"headers"','"raw_body"']){
  assert.equal(src.includes(k),false,k);
  assert.equal(rendered.includes(k),false,k);
 }
});
