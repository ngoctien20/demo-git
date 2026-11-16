import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {
 MUST_REVIEW,REQUIRED_CANARY_NODES,reviewSingleResponderTopology,
 reviewNativeOwnershipAndCutover
} from './native-owner-cutover-gate.mjs';
const dir=dirname(fileURLToPath(import.meta.url));
const evidence=JSON.parse(readFileSync(join(dir,'actual-readonly-baseline-20261116.json'),'utf8'));
const design=JSON.parse(readFileSync(join(dir,'single-responder-cutover-source-design.json'),'utf8'));
const ec=()=>structuredClone(evidence);
const dc=()=>structuredClone(design);
const block=r=>{
 assert.equal(r.verdict,'NO_GO_NO_LIVE_CUTOVER');
 for(const k of ['independent_meta_page_owner_verified','independent_store_binding_verified',
  'private_recipient_allowlist_verified','workflow_diff_signed',
  'can_change_published','can_change_meta_subscription','can_activate_canary',
  'can_send_provider','can_write_orders','can_read_customer_data','can_use_credentials'])
   assert.equal(r[k],false,k);
 assert.equal(r.provider_messages_sent,0);
 assert.equal(r.orders_written,0);
 assert.equal(r.model_api_calls,0);
};
test('real n8n current published graph has 5 direct attached legacy tool paths',()=>{
 assert.equal(evidence.workflow_id,'Z7FdV7uDvApfbURQ');
 assert.equal(evidence.published_version,'d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92');
 assert.equal(evidence.published_node_count,27);
 assert.equal(evidence.published_send_nodes,1);
 assert.equal(evidence.legacy_ai_tool_nodes.length,5);
});
test('actual hosted Store registry still missing; no fake owner or Page subscription claim',()=>{
 assert.equal(evidence.hosted_channel_bindings,0);
 assert.equal(evidence.canonical_store_tables,0);
 assert.equal(evidence.store_membership_tables,0);
 assert.equal(evidence.store_scoped_select_policies,0);
 for(const k of ['real_meta_app_page_subscription','real_native_page_admin',
    'real_merchant_page_store_consent','real_qa_recipient_verified'])
  assert.equal(evidence[k],'NOT_OBSERVED',k);
});
test('actual live01 user receipt and manual 4177 are separate evidence kinds',()=>{
 assert.equal(evidence.live01_actual_execution,'4176');
 assert.equal(evidence.live01_user_confirmed,true);
 assert.equal(evidence.qa_manual_workflow_id,'VSmXkK7Y1Bb3Dg2w');
 assert.equal(evidence.qa_manual_execution_id,'4177');
 assert.equal(evidence.qa_manual_execution_status,'success');
 assert.equal(evidence.qa_manual_workflow_active,false);
});
test('source-only one-Webhook one-Sender canary design is structurally valid, disabled',()=>{
 const r=reviewSingleResponderTopology(dc());
 assert.equal(r.pass,true);
 assert.deepEqual(r.reasons,[]);
 assert.equal(design.canary_enabled,false);
 assert.equal(design.message_ingress_count,1);
 assert.equal(design.send_node_count,1);
});
test('structurally valid design STILL has hard real-world NO-GO for cutover',()=>{
 const r=reviewNativeOwnershipAndCutover(ec(),dc());block(r);
 assert.equal(r.structural_canary_candidate_valid,true);
 assert.ok(r.reasons.includes('NATIVE_PAGE_OWNER_CONSENT_NOT_REVIEWED'));
 assert.ok(r.reasons.includes('MERCHANT_TO_STORE_CONSENT_NOT_REVIEWED'));
 assert.ok(r.reasons.includes('PRIVATE_QA_RECIPIENT_NOT_BOUND'));
});
test('no real owner or Store proof can come from LIVE01 delivered Meta message',()=>{
 const r=reviewNativeOwnershipAndCutover(ec(),dc());block(r);
 assert.ok(r.reasons.includes('NO_REAL_HOSTED_PROVIDER_BINDING'));
 assert.ok(r.reasons.includes('CANONICAL_STORE_AND_MEMBERSHIP_MISSING'));
 assert.ok(r.reasons.includes('NO_HOSTED_STORE_SELECT_RLS'));
});
test('signed private evidence checklist is explicit but no self-signing',()=>{
 assert.ok(MUST_REVIEW.includes('META_BUSINESS_PAGE_NATIVE_ADMIN_ROLE'));
 assert.ok(MUST_REVIEW.includes('META_PAGE_SUBSCRIBED_APPS_READ_ONLY'));
 assert.ok(MUST_REVIEW.includes('MERCHANT_CONSENT_EXACT_PAGE_TENANT_STORE'));
 assert.ok(MUST_REVIEW.includes('PRIVATE_QA_PSID_OWNERSHIP_AND_EXPIRING_ALLOWLIST'));
 assert.ok(MUST_REVIEW.includes('SINGLE_RESPONDER_VERSIONED_CONFIG_ROLLBACK'));
});
test('fake operator-approved Page/recipient flags cannot create real GO',()=>{
 for(const k of ['real_meta_app_page_subscription','real_native_page_admin',
 'real_merchant_page_store_consent','real_qa_recipient_verified']){
  const z=ec();z[k]='VERIFIED_PRIVATE';const r=reviewNativeOwnershipAndCutover(z,dc());
  block(r);assert.deepEqual(r.reasons,['SELF_REPORTED_NATIVE_PROOF_NOT_ACCEPTED']);
 }
});
test('fake privately signed ticket is not accepted as independent verification',()=>{
 const z=ec();z.private_review_ticket='QA-PASS';
 const r=reviewNativeOwnershipAndCutover(z,dc());
 block(r);assert.deepEqual(r.reasons,['INVALID_OR_SELF_ASSERTED_REAL_EVIDENCE']);
});
test('tampered PUBLISHED workflow or changed version must cause new audit',()=>{
 for(const [k,v] of [
  ['workflow_id','OTHER'],['published_version','fake_sha'],['published_active',false],
  ['published_node_count',26],['published_dynamic_profile',true],
  ['published_send_nodes',2],['actual_published_patch_applied',true]
 ]){
  const z=ec();z[k]=v;const r=reviewNativeOwnershipAndCutover(z,dc());
  block(r);assert.deepEqual(r.reasons,['INVALID_OR_SELF_ASSERTED_REAL_EVIDENCE'],k);
 }
});
test('actor tries to add credentials, store_id, Page ID, token or recipient to source evidence',()=>{
 for(const k of ['page_id','psid','tenant_id','store_id','app_access_token',
  'approved_by','owner_name','signature','jwt']){
  const z=ec();z[k]='spoofed';
  const r=reviewNativeOwnershipAndCutover(z,dc());block(r);
  assert.deepEqual(r.reasons,['INVALID_OR_SELF_ASSERTED_REAL_EVIDENCE'],k);
 }
});
test('invalid hosted counts fail closed',()=>{
 for(const v of [-1,'0',null,1.4,Infinity]){
  const z=ec();z.hosted_channel_bindings=v;
  const r=reviewNativeOwnershipAndCutover(z,dc());block(r);
  assert.deepEqual(r.reasons,['UNTRUSTED_HOSTED_AGGREGATE']);
 }
});
test('future-looking complete Store metadata cannot grant Meta Page authority',()=>{
 const z=ec();z.hosted_channel_bindings=1;z.canonical_store_tables=1;
 z.store_membership_tables=1;z.store_scoped_select_policies=3;
 const r=reviewNativeOwnershipAndCutover(z,dc());block(r);
 assert.equal(r.structural_canary_candidate_valid,true);
 assert.ok(r.reasons.includes('META_APP_PAGE_SUBSCRIPTION_PRIVATE_EVIDENCE_NOT_REVIEWED'));
});
test('cannot turn disabled draft into live canary',()=>{
 const z=dc();z.canary_enabled=true;
 const r=reviewSingleResponderTopology(z);
 assert.equal(r.pass,false);
 assert.ok(r.reasons.includes('MUST_HAVE_ONE_INBOUND_ONE_OUTBOUND_DISABLED_CANARY'));
});
test('cannot add second webhook ingress or second send node',()=>{
 for(const [k,v] of [['message_ingress_count',2],['send_node_count',2]]){
  const z=dc();z[k]=v;const r=reviewSingleResponderTopology(z);
  assert.equal(r.pass,false);
  assert.ok(r.reasons.includes('MUST_HAVE_ONE_INBOUND_ONE_OUTBOUND_DISABLED_CANARY'));
 }
});
test('cannot bypass HMAC signature or dedup on QA route',()=>{
 for(const node of ['HMAC_VERIFIED','DEDUP_VERIFIED']){
  const z=dc();
  z.canary_edges=z.canary_edges.filter(x=>!x.includes(node));
  const r=reviewSingleResponderTopology(z);
  assert.equal(r.pass,false);
  assert.ok(r.reasons.includes('CANARY_BYPASS_OR_EXTRA_EDGE'));
 }
});
test('cannot bypass Page/Store authority and QA recipient allowlist',()=>{
 for(const node of ['PRIVATE_PAGE_STORE_RESOLVER','QA_RECIPIENT_ALLOWLIST']){
  const z=dc();z.canary_edges=z.canary_edges.filter(x=>!x.includes(node));
  const r=reviewSingleResponderTopology(z);
  assert.equal(r.pass,false);
  assert.ok(r.reasons.includes('CANARY_BYPASS_OR_EXTRA_EDGE'));
 }
});
test('cannot bypass approved config version or rate and TTL guard',()=>{
 for(const node of ['APPROVED_PROFILE_VERSION','CANARY_RATE_TTL_GUARD']){
  const z=dc();z.canary_edges=z.canary_edges.filter(x=>!x.includes(node));
  const r=reviewSingleResponderTopology(z);
  assert.equal(r.pass,false);
  assert.ok(r.reasons.includes('CANARY_BYPASS_OR_EXTRA_EDGE'));
 }
});
test('QA branch may never flow into legacy writable AI Agent',()=>{
 const z=dc();z.canary_edges.splice(7,0,['CANARY_DETERMINISTIC_REPLY','LEGACY_MESSENGER_AGENT']);
 const r=reviewSingleResponderTopology(z);
 assert.equal(r.pass,false);
 assert.ok(r.reasons.includes('CANARY_REACHES_WRITABLE_AGENT'));
});
test('source design must account for all five legacy writer tool connections',()=>{
 const z=dc();z.agent_tools_attached_to_baseline.pop();
 const r=reviewSingleResponderTopology(z);
 assert.equal(r.pass,false);
 assert.ok(r.reasons.includes('PUBLISHED_BASELINE_WRITER_TOOLS_NOT_ACCOUNTED'));
});
test('QA route cannot contain an HTTP call, sub-workflow or AI Agent node',()=>{
 for(const kind of ['HTTP_REQUEST','TOOL_WORKFLOW','AI_AGENT','EXECUTE_COMMAND']){
  const z=dc();z.canary_node_types.CANARY_DETERMINISTIC_REPLY=kind;
  const r=reviewSingleResponderTopology(z);
  assert.equal(r.pass,false);
  assert.ok(r.reasons.includes('UNSAFE_CANARY_NODE_TYPE'));
 }
});
test('duplicate route/outbound edge and unexpected fallback are denied',()=>{
 const z=dc();z.canary_edges.push(z.canary_edges[0]);
 let r=reviewSingleResponderTopology(z);
 assert.equal(r.pass,false);
 assert.ok(r.reasons.includes('DUPLICATE_CANARY_EDGE'));
 const y=dc();y.baseline_edges.push(['CANARY_EXCLUSIVE_ROUTER','SEND_ONCE_EXISTING_NODE']);
 r=reviewSingleResponderTopology(y);assert.equal(r.pass,false);
 assert.ok(r.reasons.includes('BASELINE_ROUTE_NOT_EXCLUSIVE_OR_NOT_ACCOUNTED'));
});
test('malformed input and object schema are rejected by structural review',()=>{
 for(const v of [undefined,{},'APPROVED',[],null,{...dc(),extra:'OK'}]){
  const r=reviewSingleResponderTopology(v);
  assert.equal(r.pass,false);
  assert.ok(r.reasons.includes('INVALID_TOPOLOGY_SCHEMA'));
 }
});
test('source baseline cannot contain raw Meta account, owner, PSID or secrets',()=>{
 const s=readFileSync(join(dir,'actual-readonly-baseline-20261116.json'),'utf8');
 for(const field of ['"app_access_token"','"page_id"','"psid"',
 '"owner_name"','"email"','"phone"','"headers"','"raw_body"',
 '"secret_ref"','"recipient_id"','"message_id"']){
  assert.equal(s.includes(field),false,field);
 }
});
