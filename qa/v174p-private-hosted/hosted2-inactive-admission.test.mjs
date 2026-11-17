import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {evaluateStageA} from './hosted2-inactive-admission.mjs';
const cfg=JSON.parse(readFileSync(new URL('./wrangler.inactive.example.json',import.meta.url)));
const approval=JSON.parse(readFileSync(new URL('./hosted2-authorization-request.example.json',import.meta.url)));
const run=(edit=()=>{})=>{const c=structuredClone(cfg),r=structuredClone(approval);edit(c,r);return evaluateStageA(c,r);};
test('01 inactive Worker template meets strictly review-only contract',()=>{
 const x=run();assert.equal(x.status,'SOURCE_TEMPLATE_SAFE_FOR_REVIEW');
 assert.equal(x.can_deploy,false);assert.equal(x.would_modify_cloudflare,false);
});
test('02 no operator approval or budget exists in committed template',()=>{
 const x=run();assert(x.pending_authorizations.includes('owner_authorization_record'));
 assert(x.pending_authorizations.includes('qa_spend_envelope_usd'));
});
test('03 cannot turn on workers.dev before dedicated Access',()=>assert(run(c=>{c.workers_dev=true}).reasons.includes('workers_dev_off')));
test('04 cannot enable version previews before protected Access',()=>assert(run(c=>{c.preview_urls=true}).reasons.includes('preview_urls_off')));
test('05 cannot attach an unverified route',()=>assert(run(c=>{c.routes=['test.example.com/*']}).reasons.includes('no_worker_routes')));
test('06 reject any Commerce / n8n / AI service binding',()=>{
 for(const key of ['services','d1_databases','ai','queues']){
  assert(run(c=>{c[key]=[{}]}).reasons.includes('no_live_service_bindings'));
 }
});
test('07 do not place secret values in source vars',()=>assert(run(c=>{c.vars.V174P_SESSION_HMAC_KEY='not-real'}).reasons.includes('no_secret_values_in_config')));
test('08 mandatory SQLite-backed namespace',()=>assert(run(c=>{c.migrations=[{tag:'v1',new_classes:['V174PReplayGuard']}]}).reasons.includes('sqlite_only_migration')));
test('09 no missing replay DO binding allowed',()=>assert(run(c=>{c.durable_objects.bindings=[]}).reasons.includes('dedicated_sqlite_do_binding')));
test('10 owner approval cannot be inferred from approval.json alone',()=>{
 const x=run((c,r)=>{r.approval_required.owner_authorization_record='synthetic fake';r.approval_required.qa_spend_envelope_usd=9});
 assert.equal(x.can_deploy,false);
});
test('11 no real merchant scope can be introduced',()=>assert(run((c,r)=>{r.commercial_read_write_allowed=true}).reasons.includes('no_commerce_or_provider_send')));
test('12 no automatic deployment, even if other fields are marked',()=>assert(run((c,r)=>{r.deploy_strategy.automatic_deploy=true}).reasons.includes('authorization_still_pending')));
test('13 can't set Access audience without real linked Access app',()=>assert(run(c=>{c.vars.V174P_ACCESS_AUD='synthetic';}).reasons.includes('no_auto_active_origin_or_audience')));
test('14 no route override shorthand accepted',()=>assert(run(c=>{c.route='https://example.com/*';}).reasons.includes('no_worker_routes')));
test('15 no accidental cron activation',()=>assert(run(c=>{c.triggers={crons:['* * * * *']};}).reasons.includes('no_cron_or_queue_triggers')));
test('16 no production model calls in admission request',()=>assert(run((c,r)=>{r.ai_model_calls_allowed=true}).reasons.includes('no_commerce_or_provider_send')));
