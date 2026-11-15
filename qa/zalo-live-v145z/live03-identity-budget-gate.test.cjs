'use strict';
const test=require('node:test'), assert=require('node:assert/strict');
const {generateKeyPairSync,sign,createHash}=require('node:crypto');
const {assess,ISSUER,ROLES,verifyProof}=require('./live03-identity-budget-gate.cjs');
const h=x=>createHash('sha256').update('TIEN404_LIVE03_SYNTHETIC_QA:'+x).digest('hex');
const now=Date.now();
const keys=Object.fromEntries(ROLES.map(role=>{const kp=generateKeyPairSync('ec',{namedCurve:'prime256v1'});return [ISSUER[role],kp];}));
const roots=Object.fromEntries(Object.entries(keys).map(([k,kp])=>[k,kp.publicKey.export({type:'spki',format:'pem'})]));
const base={
 provider:{provider:'zalo_bot_creator',getme_verified:true,bot_id_observed:true,bot_digest:h('bot_b')},
 registry:{bot_digest:h('bot_b'),tenant_digest:h('tenant_b'),store_digest:h('store_b'),owner_digest:h('owner_b'),registry_mode:'limited_qa',identity_status:'verified_provider_id',synthetic_fixture:false},
 owner:{owner_digest:h('owner_b'),bot_digest:h('bot_b'),qa_consent:true},
 hosted:{bot_digest:h('bot_b'),store_digest:h('store_b'),owner_digest:h('owner_b'),provider_webhook_signature_verified:true,trusted_ingress:true,atomic_replay_cas_quota:true,max_replies:3,window_ms:600000,max_tokens:2500,real_orders_disabled:true,no_send_until_approval:true,model_id:'gpt-5.4-nano'},
 gateway:{rate_input_usd_per_m:0.2,rate_output_usd_per_m:1.25,balance_usd:1,owner_hard_cap_usd:0.01,rate_source:'N8N_CLOUD_GATEWAY_SERVICE_PRICING',balance_source:'N8N_CLOUD_CONSOLE',auto_topup_enabled:false,credits_shared_instance:true,max_model_calls:3,aggregate_token_cap:2500,strict_pre_inference_reservation:true,shared_credit_concurrency_guard:true,model_id:'gpt-5.4-nano',model_approved_for_pilot:true,balance_checked_ms:now}
};
function pack(role, claims, override={}){
 const issuer=ISSUER[role],payload=JSON.stringify({issuer,purpose:'TIEN404_V145Z_LIVE03_CERTIFICATION_ONLY',evidence_id:'synthetic_'+role,issued_ms:now-1000,expires_ms:now+300000,claims,...override});
 return {payload,signature:sign('sha256',Buffer.from(payload),{key:keys[issuer].privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url')};
}
const make=(override={})=>Object.fromEntries(ROLES.map(role=>[role,pack(role,{...base[role],...(override[role]||{})})]));
const run=(override,trust=roots,clock=now)=>assess({evidence:override},trust,clock);
function reason(e,fragment){assert.ok(e.blocked_reasons.some(x=>x.includes(fragment)),JSON.stringify(e.blocked_reasons))}
test('no proofs must fail closed with zero provider send',()=>{const r=run({});assert.equal(r.status,'BLOCKED');assert.equal(r.signed_proofs_verified,0);assert.equal(r.can_send,false);assert.equal(r.provider_request,null);assert.equal(r.provider_sends,0)});
test('synthetic signed complete pack is review-only, never authorizes a Zalo send',()=>{const r=run(make());assert.equal(r.status,'ELIGIBLE_FOR_FINAL_HUMAN_REVIEW_ONLY');assert.equal(r.signed_proofs_verified,5);assert.equal(r.can_send,false);assert.equal(r.final_owner_send_authorization,false);assert.equal(r.model_cost_reference_usd,0.003125);assert.equal(r.suggested_monetary_guard_usd,0.00625)});
test('a request-provided unpinned key cannot grant trust',()=>{const r=run(make(),{});reason(r,'MISSING_TRUSTED_PROVIDER');assert.equal(r.signed_proofs_verified,0)});
test('missing provider proof blocked',()=>{const x=make();delete x.provider;reason(run(x),'MISSING_TRUSTED_PROVIDER')});
test('missing private registry proof blocked',()=>{const x=make();delete x.registry;reason(run(x),'MISSING_TRUSTED_REGISTRY')});
test('missing signed owner proof blocked',()=>{const x=make();delete x.owner;reason(run(x),'MISSING_TRUSTED_OWNER')});
test('missing n8n gateway billing proof blocked',()=>{const x=make();delete x.gateway;reason(run(x),'MISSING_TRUSTED_GATEWAY')});
test('missing hosted ingress proof blocked',()=>{const x=make();delete x.hosted;reason(run(x),'MISSING_TRUSTED_HOSTED')});
test('provider fake signature rejected',()=>{const x=make();x.provider.signature='x'.repeat(86);reason(run(x),'MISSING_TRUSTED_PROVIDER')});
test('provider payload tampering rejected',()=>{const x=make();x.provider.payload=x.provider.payload.replace('zalo_bot_creator','zalo_fake');reason(run(x),'MISSING_TRUSTED_PROVIDER')});
test('proof issuer swap rejected',()=>{const x=make();x.provider=pack('registry',base.registry);reason(run(x),'MISSING_TRUSTED_PROVIDER')});
test('wrong purpose proof rejected',()=>{const x=make();x.owner=pack('owner',base.owner,{purpose:'SEND_NOW'});reason(run(x),'MISSING_TRUSTED_OWNER')});
test('expired proof rejected',()=>{const x=make();x.provider=pack('provider',base.provider,{issued_ms:now-600000,expires_ms:now-1000});reason(run(x),'MISSING_TRUSTED_PROVIDER')});
test('future dated proof rejected',()=>{const x=make();x.owner=pack('owner',base.owner,{issued_ms:now+90000,expires_ms:now+190000});reason(run(x),'MISSING_TRUSTED_OWNER')});
test('provider without observed bot id blocked',()=>reason(run(make({provider:{bot_id_observed:false}})),'REAL_PROVIDER_BOT_ID'));
test('provider fake Bot ID mismatch blocked',()=>reason(run(make({provider:{bot_digest:h('bot_a')}})),'REAL_PROVIDER_BOT_ID'));
test('registry synthetic fixture blocked',()=>reason(run(make({registry:{synthetic_fixture:true}})),'TRUSTED_LIVE_SHOP_RESOLVER'));
test('registry dry_run rather than limited_qa blocked',()=>reason(run(make({registry:{registry_mode:'dry_run'}})),'TRUSTED_LIVE_SHOP_RESOLVER'));
test('owner mismatch blocked',()=>reason(run(make({owner:{owner_digest:h('owner_a')}})),'ONE_VERIFIED_OWNER'));
test('owner consent missing blocked',()=>reason(run(make({owner:{qa_consent:false}})),'ONE_VERIFIED_OWNER'));
test('hosted webhook not authenticated blocked',()=>reason(run(make({hosted:{provider_webhook_signature_verified:false}})),'REAL_HOSTED_SECURITY'));
test('hosted ingress untrusted blocked',()=>reason(run(make({hosted:{trusted_ingress:false}})),'REAL_HOSTED_SECURITY'));
test('hosted Orders enabled blocked',()=>reason(run(make({hosted:{real_orders_disabled:false}})),'REAL_HOSTED_SECURITY'));
test('hosted no-send switch false blocked',()=>reason(run(make({hosted:{no_send_until_approval:false}})),'REAL_HOSTED_SECURITY'));
test('hosted quota of four blocked',()=>reason(run(make({hosted:{max_replies:4}})),'REAL_HOSTED_SECURITY'));
test('gateway automatic top-up blocks certification',()=>reason(run(make({gateway:{auto_topup_enabled:true}})),'ACCOUNT_GATEWAY'));
test('gateway credit balance missing blocks',()=>reason(run(make({gateway:{balance_usd:null}})),'ACCOUNT_GATEWAY'));
test('direct provider price is not account Gateway billing proof',()=>reason(run(make({gateway:{rate_source:'OPENAI_DIRECT_LIST'}})),'ACCOUNT_GATEWAY'));
test('gateway stale balance snapshot blocked',()=>reason(run(make({gateway:{balance_checked_ms:now-300000}})),'ACCOUNT_GATEWAY'));
test('shared instance concurrency lock missing blocked',()=>reason(run(make({gateway:{shared_credit_concurrency_guard:false}})),'ACCOUNT_GATEWAY'));
test('model costs mismatch hosted config blocked',()=>reason(run(make({hosted:{model_id:'gpt-6-luna'}})),'COST_MODEL_MISMATCH'));
test('token monetary cap below worst-case blocks',()=>reason(run(make({gateway:{owner_hard_cap_usd:0.002}})),'GATEWAY_BALANCE_OR_MONEY_CAP'));
test('balance below owner cap blocks',()=>reason(run(make({gateway:{balance_usd:0.001}})),'GATEWAY_BALANCE_OR_MONEY_CAP'));
test('model not approved blocks',()=>reason(run(make({gateway:{model_approved_for_pilot:false}})),'ACCOUNT_GATEWAY'));
test('fail closed never returns dispatch even if all other checks pass',()=>{for(const x of [make(),make({gateway:{balance_usd:0}}),make({provider:{getme_verified:false}})]){const y=run(x);assert.equal(y.can_send,false);assert.equal(y.provider_request,null)}});
