'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {SKILLS,prepareSkill}=require('./business-skills-gate.cjs');
const plan=(cap='price_quote',role='customer')=>({status:'CANDIDATE_OFFLINE_NO_SEND',contract_version:'V15.0-01',
  can_send:false,provider_sends:0,real_llm_calls:0,actual_orders_written:0,tools_executed:0,
  trusted_store_isolated:true,request_id:'req_qa001',session_ref:'hashed_scope',channel:'messenger',
  actor_role:role,policy_version:'OFFLINE-V1',allowed_capabilities:[cap],tool:{capability:cap,
    read_only:!cap.endsWith('_draft'),...(cap.endsWith('_draft')?{requires_confirmation:true}:{})}});
const attest=p=>({origin:'BACKEND_OFFLINE_AUTHORIZATION',authorizedForStaging:true,
  requestId:p.request_id,sessionRef:p.session_ref,channel:p.channel,actorRole:p.actor_role,
  capability:p.tool.capability,policyVersion:p.policy_version,subscriptionActive:true,
  revoked:false,canSend:false,canWriteOrders:false});
const run=(p=plan(),e={})=>prepareSkill(p,{reauthorize:async()=>({...attest(p),...e})});
test('6 skills declared, no actual executor exposed',()=>assert.equal(Object.keys(SKILLS).length,6));
test('price quote read-only boundary no tools actually run',async()=>{let r=await run();assert.equal(r.status,'READ_ONLY_ADAPTER_REQUIRED');assert.equal(r.execute_tool,false);assert.equal(r.hosted_reads,0)});
test('catalog read-only',async()=>assert.equal((await run(plan('catalog_read'))).status,'READ_ONLY_ADAPTER_REQUIRED'));
test('owner report allowed only with backend owner attestation',async()=>assert.equal((await run(plan('owner_report_read','owner'))).status,'READ_ONLY_ADAPTER_REQUIRED'));
test('customer owner report blocked',async()=>assert.equal((await run(plan('owner_report_read','customer'))).status,'BLOCKED'));
test('order draft always requires real user confirmation and hosted gate',async()=>{const r=await run(plan('order_draft'));assert.equal(r.status,'CONFIRMATION_REQUIRED');assert.equal(r.orders_written,0);assert.equal(r.execute_tool,false)});
test('support draft never sends',async()=>{const r=await run(plan('support_draft'));assert.equal(r.can_send,false);assert.equal(r.provider_sends,0)});
test('plan without injected trusted backend rejected',async()=>assert.equal((await prepareSkill(plan())).reason,'PRIVATE_BACKEND_REAUTH_REQUIRED'));
test('revoke immediately fails closed',async()=>assert.equal((await run(plan(),{revoked:true})).status,'BLOCKED'));
test('expired subscription fails closed',async()=>assert.equal((await run(plan(),{subscriptionActive:false})).status,'BLOCKED'));
test('server policy version mismatch rejected',async()=>assert.equal((await run(plan(),{policyVersion:'outdated'})).status,'BLOCKED'));
test('cross-channel mismatched backend attestation rejected',async()=>assert.equal((await run(plan(),{channel:'zalo_bot'})).status,'BLOCKED'));
test('cross-session rejected',async()=>assert.equal((await run(plan(),{sessionRef:'other_shop'})).status,'BLOCKED'));
test('backend canSend enabled is not allowed in no-send lab',async()=>assert.equal((await run(plan(),{canSend:true})).status,'BLOCKED'));
test('backend canWriteOrders enabled is not allowed in no-send lab',async()=>assert.equal((await run(plan(),{canWriteOrders:true})).status,'BLOCKED'));
test('invalid schema capability fails closed',async()=>assert.equal((await run(plan('superadmin_override'))).status,'BLOCKED'));
test('forged plan execution already happened fails closed',async()=>assert.equal((await run({...plan(),tools_executed:1})).status,'BLOCKED'));
test('read-only tool cannot be upgraded by model',async()=>assert.equal((await run({...plan(),tool:{capability:'price_quote',read_only:false}})).status,'BLOCKED'));
test('draft tool cannot omit confirmation requirement',async()=>assert.equal((await run({...plan('order_draft'),tool:{capability:'order_draft',read_only:false}})).status,'BLOCKED'));
test('status rejected if caller forges released version',async()=>assert.equal((await run({...plan(),status:'RELEASED'})).status,'BLOCKED'));
test('model API not invoked by gate',async()=>assert.equal((await run()).model_calls,0));
