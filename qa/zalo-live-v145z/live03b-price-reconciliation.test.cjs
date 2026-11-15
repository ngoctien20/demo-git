'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {RATE,ENVELOPE,OBSERVED_BALANCE,asNanoUsd,quote,assessPilot}=require('./live03b-price-reconciliation.cjs');
const scenario={
  model_id:'gpt-5.4-nano',
  price_source:RATE.source,
  max_calls:3,max_replies:3,max_tokens:2500,window_ms:600000,
  balance_usd:0.59,balance_current_attested:true,
  auto_topup_enabled:false,
  owner_cap_usd:0.01,owner_cap_approved:true,
  shared_instance_cost_lock:true,
  authoritative_llm_usage_reconciliation:true,
  token_reservation_before_inference:true,
  real_bot_shop_owner_verified:true
};
test('exact n8n service pricing row is gpt-5.4-nano and 0.20/1.25',()=>{
 assert.equal(RATE.model_id,'gpt-5.4-nano');
 assert.equal(RATE.input_usd_per_million,0.20);
 assert.equal(RATE.output_usd_per_million,1.25);
 assert.match(RATE.source,/N8N_SERVICE_PRICING/);
});
test('illustrative maximum all output 2500 tokens is $0.003125',()=>{
 assert.equal(quote({input_tokens:0,output_tokens:2500}).model_cost_usd,0.003125);
});
test('all input 2500 tokens costs $0.0005',()=>{
 assert.equal(quote({input_tokens:2500,output_tokens:0}).model_cost_usd,0.0005);
});
test('prior observed synthetic prompt 156+42 would cost 0.0000837 under the price row',()=>{
 assert.equal(quote({input_tokens:156,output_tokens:42}).model_cost_usd,0.0000837);
});
test('mixed two thousand input 500 output is 0.001025',()=>{
 assert.equal(quote({input_tokens:2000,output_tokens:500}).model_cost_usd,0.001025);
});
test('all valid quotes remain estimates with no provider send',()=>{
 for(const q of [{input_tokens:0,output_tokens:0},{input_tokens:1,output_tokens:1},{input_tokens:2499,output_tokens:1}]){
  const x=quote(q); assert.equal(x.can_send,false);assert.equal(x.real_n8n_invoice_verified,false);
 }
});
test('gpt-5-nano pricing cannot be applied to gpt-5.4-nano',()=>{
 const x=quote({input_tokens:0,output_tokens:2500},'gpt-5-nano');
 assert.equal(x.status,'BLOCKED'); assert.equal(x.can_send,false);
});
test('aggregate token 2501 blocked',()=>assert.equal(quote({input_tokens:2000,output_tokens:501}).status,'BLOCKED'));
test('negative token rejected',()=>assert.equal(quote({input_tokens:-1,output_tokens:500}).status,'BLOCKED'));
test('fractional tokens rejected',()=>assert.equal(quote({input_tokens:0.4,output_tokens:500}).status,'BLOCKED'));
test('NaN and other invalid tokens rejected',()=>{
 assert.equal(quote({input_tokens:NaN,output_tokens:1}).status,'BLOCKED');
 assert.equal(quote({input_tokens:null,output_tokens:1}).status,'BLOCKED');
});
test('nanodollar price converter rejects negative and untrusted rates',()=>{
 assert.throws(()=>asNanoUsd(-1,0),/TOKEN_OR_RATE_INVALID/);
 assert.throws(()=>asNanoUsd(1,1,{input_usd_per_million:0,output_usd_per_million:1.25}),/TOKEN_OR_RATE_INVALID/);
});
test('default budget audit fails closed',()=>{
 const x=assessPilot();assert.equal(x.status,'BLOCKED');assert.equal(x.can_send,false);assert.ok(x.reasons.length>4);
});
test('owner screenshot balance is a snapshot, not live signed balance',()=>{
 assert.equal(OBSERVED_BALANCE.amount_usd,0.59);
 assert.equal(OBSERVED_BALANCE.is_live_api_verified,false);
 const x=assessPilot({...scenario,balance_current_attested:false});
 assert.ok(x.reasons.includes('LIVE_SHARED_BALANCE_NOT_ATTESTED'));
});
test('auto top up enabled or unknown blocks budget certification',()=>{
 for(const auto of [null,true,undefined]){
  const x=assessPilot({...scenario,auto_topup_enabled:auto});
  assert.ok(x.reasons.includes('AUTO_TOPUP_NOT_VERIFIED_DISABLED'));
 }
});
test('owner cap missing or not approved blocks budget',()=>{
 for(const cap of [0,null,-1]){
  const x=assessPilot({...scenario,owner_cap_usd:cap});
  assert.ok(x.reasons.includes('OWNER_MONEY_CAP_UNAPPROVED'));
 }
 const x=assessPilot({...scenario,owner_cap_approved:false});
 assert.ok(x.reasons.includes('OWNER_MONEY_CAP_UNAPPROVED'));
});
test('missing real per instance concurrency guard blocks',()=>{
 const x=assessPilot({...scenario,shared_instance_cost_lock:false});
 assert.ok(x.reasons.includes('HOSTED_MONEY_TOKEN_GUARD_UNVERIFIED'));
});
test('failure to reconcile actual LLM tokens blocks',()=>{
 const x=assessPilot({...scenario,authoritative_llm_usage_reconciliation:false});
 assert.ok(x.reasons.includes('HOSTED_MONEY_TOKEN_GUARD_UNVERIFIED'));
});
test('identity still needs verified real bot-shop-owner binding',()=>{
 const x=assessPilot({...scenario,real_bot_shop_owner_verified:false});
 assert.ok(x.reasons.includes('LIVE_IDENTITY_NOT_VERIFIED'));
});
test('even caller claims with every checkbox green cannot authorize real sending',()=>{
 const x=assessPilot(scenario);
 assert.equal(x.status,'SOURCE_CLAIMS_REQUIRE_SIGNED_ATTESTATION');
 assert.equal(x.can_send,false);assert.equal(x.external_calls,0);
 assert.equal(x.maximum_model_only_usd,0.003125);assert.equal(x.suggested_two_x_buffer_usd,0.00625);
});
test('different model and wrong pricing source block',()=>{
 const x=assessPilot({...scenario,model_id:'gpt-5-nano',price_source:'OPENAI_DIRECT_API'});
 assert.ok(x.reasons.includes('ACTUAL_MODEL_MISMATCH'));
 assert.ok(x.reasons.includes('N8N_PRICE_SOURCE_UNMATCHED'));
});
test('three calls, 10 minutes, 2500 token limit must exactly match',()=>{
 for(const [k,value] of [['max_calls',4],['max_replies',4],['max_tokens',2501],['window_ms',700000]]){
  const x=assessPilot({...scenario,[k]:value});
  assert.ok(x.reasons.includes('ENVELOPE_NOT_ENFORCED'));
 }
});
