import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {
 createIsolatedCanaryShadow,assessRealCanaryCutover,
 verifyManualNoSendWorkflow,LIVE_AGENT_TOOLS,LIVE_WORKFLOW,CANARY_PROFILE
} from './isolated-canary-guard.mjs';
const root=dirname(fileURLToPath(import.meta.url));
const receipt=JSON.parse(readFileSync(join(root,'live01-user-receipt-20261116.json'),'utf8'));
const candidate=JSON.parse(readFileSync(join(root,'NO_SEND_MANUAL_N8N_CANARY_WORKFLOW.json'),'utf8'));
const published=Object.freeze({
 workflow_id:'Z7FdV7uDvApfbURQ',active:true,
 published_version:LIVE_WORKFLOW.published_version,
 agent_tool_names:[...LIVE_AGENT_TOOLS]
});
const proposed=Object.freeze({
 stage:'SOURCE_ONLY_CANDIDATE',no_send:true,
 target_scope:'ONE_PRIVATELY_VERIFIED_PAGE_AND_ONE_QA_RECIPIENT',
 writable_tool_nodes:0,sends_without_owner_consent:false
});
const judge=(opts={})=>assessRealCanaryCutover({
 published,receipt,proposed,...opts
});
const noGo=r=>{
 assert.equal(r.decision,'NO_GO_NOT_DEPLOYED');
 for(const x of ['can_apply_n8n_patch','can_publish','can_change_webhook',
  'can_use_meta_token','can_send','can_create_order',
  'can_read_private_page_id','can_read_hosted_custom_config']){
  assert.equal(r[x],false,x);
 }
 assert.equal(r.orders_written,0);
 assert.equal(r.provider_messages_sent,0);
 assert.equal(r.paid_model_calls,0);
};
const safe=r=>{
 assert.equal(r.synthetic_only,true);
 assert.equal(r.actual_published_version_changed,false);
 assert.equal(r.authorized_live_canary,false);
 assert.equal(r.can_publish,false);
 assert.equal(r.can_send,false);
 assert.equal(r.can_write_order,false);
 assert.equal(r.can_use_paid_model,false);
 assert.equal(r.sent_messages,0);
 assert.equal(r.orders_written,0);
 assert.equal(r.hosted_writes,0);
 assert.equal(r.model_calls,0);
};
let number=0;
const issue=(runtime,account='QA_META_A',synthetic_text='xin chao',channel='MESSENGER')=>
  runtime.issueSyntheticContext({account_id:account,
   event_id:'QA-EVT-CANARY-'+String(++number).padStart(4,'0'),
   synthetic_text,channel});
test('user confirmed visible LIVE01 matches independent n8n exec #4176',()=>{
 assert.equal(receipt.contract,'TIEN404_CBOT_MSG_LIVE01_USER_RECEIPT_V1');
 assert.equal(receipt.reference_real_execution,'4176');
 assert.equal(receipt.user_reported_response_visible,true);
 assert.equal(receipt.user_reported_response_matches_execution,true);
 assert.equal(receipt.final_live01_status,'ACCEPTED_USER_CONFIRMED');
 assert.equal(receipt.technical_pass,true);
});
test('user-confirmed rendering is NOT an independent screenshot or owner proof',()=>{
 assert.equal(receipt.independent_device_screenshot_audited,false);
 assert.equal(receipt.app_page_owner_rights_independently_attested,false);
 assert.equal(receipt.studio_custom_greeting_live,false);
 assert.equal(receipt.live_canary_published,false);
 assert.equal(receipt.can_publish,false);
 assert.equal(receipt.can_send_provider,false);
});
test('current actual Published graph still contains five legacy Agent tools',()=>{
 assert.equal(LIVE_AGENT_TOOLS.length,5);
 assert.ok(LIVE_AGENT_TOOLS.includes('create_order'));
 assert.ok(LIVE_AGENT_TOOLS.includes('manage_order'));
 assert.ok(LIVE_AGENT_TOOLS.includes('update_order_address'));
 assert.equal(published.published_version,'d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92');
});
test('real cutover remains BLOCKED despite confirmed LIVE01 receipt',()=>{
 const r=judge();noGo(r);
 assert.equal(r.actual_live01_user_receipt,true);
 assert.ok(r.reasons.includes('LEGACY_WRITABLE_AGENT_TOOLS_STILL_ATTACHED'));
 assert.ok(r.reasons.includes('REQUIRE_NO_WRITER_ROUTE_AND_NON_DUPLICATE_PROVIDER_RESPONDER'));
});
test('real Page/Store and exact workflow change must be separately authorized',()=>{
 const r=judge();noGo(r);
 for(const code of ['NATIVE_PAGE_AND_OWNER_STORE_PRIVATE_EVIDENCE_REQUIRED',
 'REQUIRE_OWNER_APPROVAL_OF_EXACT_N8N_PATCH_AND_ROLLBACK',
 'REQUIRE_QA_RECIPIENT_SCOPE_AND_RATE_BUDGET'])
 assert.ok(r.reasons.includes(code));
});
test('changing official workflow SHA/version fails preflight, never autoroutes',()=>{
 const r=judge({published:{...published,published_version:'UNEXPECTED'}});
 noGo(r);assert.ok(r.reasons.includes('ACTUAL_PUBLISHED_GRAPH_NOT_MATCHED'));
});
test('fake missing LIVE01 acknowledgement cannot authorize actual canary',()=>{
 const r=judge({receipt:{...receipt,user_reported_response_visible:false}});
 noGo(r);assert.ok(r.reasons.includes('USER_VISIBLE_BASELINE_RECEIPT_NOT_CONFIRMED'));
});
test('forged canary graph with writer cannot pass',()=>{
 const r=judge({proposed:{...proposed,writable_tool_nodes:1}});
 noGo(r);assert.ok(r.reasons.includes('PROPOSED_ISOLATED_CANARY_GRAPH_UNSAFE'));
});
test('wrong Store or recipient allowlist scope fails locked cutover',()=>{
 for(const scope of ['ALL_STORES','PUBLIC_ANY_PAGE','ALL_CUSTOMERS']){
  const r=judge({proposed:{...proposed,target_scope:scope}});
  noGo(r);assert.ok(r.reasons.includes('PROPOSED_ISOLATED_CANARY_GRAPH_UNSAFE'));
 }
});
test('fake all-private-verifications input cannot grant publish',()=>{
 const forged={...proposed,page_owner_verified:true,independent_reviewer:true,consent:true};
 const r=judge({proposed:forged});noGo(r);
 assert.equal(r.can_publish,false);
 assert.equal(r.can_send,false);
});
test('Shop A QA greeting shadow shows distinct candidate version without LIVE SEND',()=>{
 const runtime=createIsolatedCanaryShadow(),ctx=issue(runtime);
 const r=runtime.previewCanary(ctx);
 assert.equal(r.status,'OFFLINE_CANARY_PREVIEW_ONLY');
 assert.equal(r.candidate_version,CANARY_PROFILE.version);
 assert.equal(r.preview_bot_name,CANARY_PROFILE.bot_name);
 assert.equal(r.preview_greeting,CANARY_PROFILE.greeting);
 assert.equal(r.owner_approved_state,'OWNER_APPROVED_PREVIEW_ONLY');
 assert.notEqual(r.current_greeting,r.preview_greeting);
 safe(r);
});
test('Shop B QA message is untouched by Shop A Canary draft',()=>{
 const runtime=createIsolatedCanaryShadow(),a=issue(runtime,'QA_META_A'),
 b=issue(runtime,'QA_META_B');
 const ra=runtime.previewCanary(a),rb=runtime.previewCanary(b);
 assert.equal(ra.status,'OFFLINE_CANARY_PREVIEW_ONLY');
 assert.equal(rb.status,'NOT_TARGETED_SHOP_BASELINE_PREVIEW');
 assert.equal(rb.current_greeting,'Xin chào cửa hàng B');
 assert.equal(rb.profile_version,1);
 assert.notEqual(rb.current_greeting,ra.preview_greeting);
 safe(rb);
});
test('client cannot insert Store ID or clone issued context',()=>{
 const rt=createIsolatedCanaryShadow(),ctx=issue(rt);
 for(const attempt of [
  {...ctx,store_id:'QA_STORE_B'},
  {...ctx,scope:{...ctx.scope,store_id:'QA_STORE_B'}},
  {scope:ctx.scope},{},null
 ]){
  const r=rt.previewCanary(attempt);
  assert.equal(r.status,'BLOCKED');
  assert.equal(r.reason,'NON_ISSUED_CONTEXT');safe(r);
 }
});
test('untrusted raw client Page binding never mints a QA context',()=>{
 const rt=createIsolatedCanaryShadow();
 assert.throws(()=>rt.issueSyntheticContext({
  account_id:'LIVE_META_PAGE',event_id:'QA-EVT-CANARY-9999',channel:'MESSENGER',
  synthetic_text:'xin chao'
 }),/UNTRUSTED_OR_NON_SYNTHETIC_EVENT/);
});
test('wrong Store or channel identity cannot access Shop A Canary',()=>{
 const rt=createIsolatedCanaryShadow();
 assert.throws(()=>rt.issueSyntheticContext({
  account_id:'QA_META_A',channel:'ZALO_OA',
  event_id:'QA-EVT-CANARY-9998',synthetic_text:'xin chao'
 }),/CHANNEL_STORE_BINDING_UNVERIFIED/);
});
test('order-intent on Messenger QA context is blocked before canary presentation',()=>{
 const rt=createIsolatedCanaryShadow();
 const r=rt.previewCanary(issue(rt,'QA_META_A','dat SAME01'));
 assert.equal(r.status,'BLOCKED');assert.equal(r.reason,'CANARY_GREETING_ONLY');
 safe(r);
});
test('quote or support request is not allowed in simple greeting canary',()=>{
 const rt=createIsolatedCanaryShadow();
 for(const t of ['gia SAME01','ho tro','tu van san pham']){
  const r=rt.previewCanary(issue(rt,'QA_META_A',t));
  assert.equal(r.status,'BLOCKED');safe(r);
 }
});
test('draft preview marker is deterministic and not a real Page setting',()=>{
 const rt=createIsolatedCanaryShadow();
 const r=rt.previewCanary(issue(rt));
 assert.equal(r.proposed_tag,'TIEN404-CANARY-01');
 assert.equal(r.actual_page_authority_verified,false);
 assert.equal(r.actual_store_authority_verified,false);
 safe(r);
});
test('import candidate is manual, inactive, 2 nodes and no network',()=>{
 assert.equal(candidate.active,false);
 assert.equal(candidate.nodes.length,2);
 assert.equal(verifyManualNoSendWorkflow(candidate),true);
});
test('candidate does not contain any credential, webhook, send, model or business tool',()=>{
 const s=JSON.stringify(candidate);
 for(const k of ['"credentials"','"n8n-nodes-base.webhook"','httpRequest',
  'langchain','toolWorkflow','facebook.com','graph.facebook.com','api_key']){
  assert.equal(s.includes(k),false,k);
 }
});
test('adding HTTP request/credential to the candidate must be rejected',()=>{
 for(const attempt of [
  {...candidate,active:true},
  {...candidate,nodes:[...candidate.nodes,{name:'Meta SEND',type:'n8n-nodes-base.httpRequest'}]},
  {...candidate,nodes:candidate.nodes.map((n,i)=>i?{...n,credentials:{facebookApi:{id:'x'}}}:n)}
 ]){
  assert.equal(verifyManualNoSendWorkflow(attempt),false);
 }
});
test('tampered JS code with fetch/send/remote request is rejected',()=>{
 for(const inject of ['fetch("https://graph.facebook.com")',
  'sendMessage()', 'process.env.BAD_SECRET', 'axios.post()', 'toolWorkflow']){
  const copy=structuredClone(candidate);
  copy.nodes[1].parameters.jsCode+=inject;
  assert.equal(verifyManualNoSendWorkflow(copy),false,inject);
 }
});
test('tampered connections causing a hidden duplicate responder are rejected',()=>{
 const copy=structuredClone(candidate);
 copy.connections['Preview QA Greeting NO_SEND']={main:[[{node:'Meta SEND',type:'main',index:0}]]};
 assert.equal(verifyManualNoSendWorkflow(copy),false);
});
test('manual candidate returns synthetic preview only with explicit not send/write',()=>{
 const code=candidate.nodes.find(n=>n.type==='n8n-nodes-base.code')?.parameters.jsCode||'';
 assert.match(code,/NO_SEND/);
 assert.match(code,/can_send:\s*false/);
 assert.match(code,/can_write_orders:\s*false/);
 assert.match(code,/orders_written:\s*0/);
 assert.match(code,/can_publish:\s*false/);
 assert.match(code,/no_paid_model_call:\s*true/);
});
test('LIVE01 user receipt evidence carries no raw user, Meta, token or message payload',()=>{
 const raw=readFileSync(join(root,'live01-user-receipt-20261116.json'),'utf8');
 for(const k of ['"psid"','"page_id"','"page_access_token"','"sender_id"',
  '"customer_name"','"customer_phone"','"message_id"','"raw_body"',
  '"refresh_token"','"access_token"','"headers"','"email"'])
 assert.equal(raw.includes(k),false,k);
});
