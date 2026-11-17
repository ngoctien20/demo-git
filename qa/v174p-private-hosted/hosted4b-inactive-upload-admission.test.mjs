import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {assessInactiveUploadPlan,REQUIRED_PRIVATE_APPROVALS,CONTRACT} from './hosted4b-inactive-upload-admission.mjs';

const ROOT=new URL('./',import.meta.url);
const CONFIG=JSON.parse(readFileSync(new URL('wrangler.hosted4b.inactive.example.json',ROOT),'utf8'));
const SOURCE=readFileSync(new URL('hosted-issuer.worker.mjs',ROOT),'utf8');
const SHA='103341cc547c0ba7b07d13243677877195e26edc';
const NOW=Date.parse('2026-11-17T08:00:00.000Z');
const hash=s=>createHash('sha256').update(s,'utf8').digest('hex');
function fixture(){
 const scripts=[
  'tien404-v175e1-private-issuer-nosend-staging',
  'tien404-v175e2-ab-gateway-nosend-staging',
  'tien404-v175e2-durable-replay-nosend-staging',
  'tien404-v175e2-installation-registry-nosend-staging',
  'tien404-v175e2a-private-hosted-runner-nosend-staging','synthetic-unrelated-worker'
 ];
 return {
  config:structuredClone(CONFIG),source:SOURCE,reviewedSourceSha256:hash(SOURCE),
  expectedGitCommitSha:SHA,
  inventoryResult:{
   status:'COMPLETE_READ_ONLY_NEEDS_INDEPENDENT_REVIEW',errors:[],
   inventory:{
    account_id:'ac01685529c0a31fc185335f07648edf',source:'CLOUDFLARE_CONTROL_PLANE_READ_ONLY',
    collected_at_ms:NOW-60000,script_names:scripts,
    worker_names:['synthetic-unrelated-worker'],
    access_app_names:['Pages existing Access'],
    do_namespace_names:[
     'tien404-v175e2-durable-replay-nosend-staging_ReplayBucket',
     'tien404-v175e2a-private-hosted-runner-nosend-staging_RunnerResults'
    ],
    page_verification:{status:'COMPLETE',cross_consistent:true,
      total_workers:1,total_scripts:scripts.length}
   }
  },
  ownerEnvelope:null,signatures:null,privateTrustAnchors:null,
  independentReview:{
   independently_verified_source_sha:SHA,live_inventory_independently_attested:true,
   verified_no_cross_workstream_bindings:true,
   owner_budget_reviewed_independently:true,
   operator_identity_reviewed_independently:true,
   rollback_plan_reviewed_independently:true,no_public_route_attested:true
  },
  privateApproval:{
   ...Object.fromEntries(REQUIRED_PRIVATE_APPROVALS.map(k=>[k,true])),
   max_spend_usd:5,max_qa_requests:96,account_wide_spending_limit_change:false,
   provider_send_allowed:false,real_commerce_allowed:false,model_calls_allowed:false
  },
  now:NOW
 };
}
function evalFixture(f){return assessInactiveUploadPlan(f);}
function denies(mut,id){
 const f=fixture();mut(f);const outcome=evalFixture(f);
 assert(outcome.issues.includes(id),JSON.stringify(outcome.issues));
 assert.equal(outcome.can_deploy,false);
 assert.equal(outcome.can_enable_public_routes,false);
 assert.equal(outcome.can_run_real_cloudflare_uat,false);
}
test('01 reviewed inactive configuration and unchanged source are safe FOR REVIEW ONLY',()=>{
 const r=evalFixture(fixture());
 assert.equal(r.contract,CONTRACT);
 assert.equal(r.source_template_safe_for_review,true);
 assert.deepEqual(r.issues,['independent_owner_security_signatures_and_scope']);
 assert.equal(r.state,'BLOCKED_PREDEPLOYMENT_APPROVAL');
 assert.equal(r.can_deploy,false);
 assert.equal(r.deployment_performed,false);
});
test('02 even every editable private-approval flag TRUE cannot mint deployment authority',()=>{
 const f=fixture();const r=evalFixture(f);
 assert.deepEqual(r.missing_private_authorizations,[]);
 assert(r.signer_gate_reasons.length>0);
 assert.equal(r.can_deploy,false);
});
test('03 missing private approvals enumerated without displaying PII',()=>{
 const f=fixture();f.privateApproval={};
 const r=evalFixture(f);
 assert(r.missing_private_authorizations.includes('private_owner_identity_independently_verified'));
 assert(r.missing_private_authorizations.includes('positive_private_dollar_budget_not_proven'));
 assert.equal(r.can_deploy,false);
});
test('04 source signature mismatch after one-byte mutation',()=>denies(
 f=>{f.source+=' ';},'reviewed_source_sha256_matches_independent_checkpoint'));
test('05 independently reviewed SHA256 missing',()=>denies(
 f=>{f.reviewedSourceSha256=null;},'reviewed_source_sha256_matches_independent_checkpoint'));
test('06 wrong Git commit SHA',()=>denies(
 f=>{f.expectedGitCommitSha='1'.repeat(40);},'pinned_reviewed_git_commit'));
test('07 independent commit review must exist',()=>denies(
 f=>{f.independentReview.independently_verified_source_sha=null;},'pinned_reviewed_git_commit'));
test('08 unsafe different Worker name',()=>denies(
 f=>{f.config.name='tien404-v175e2a-private-hosted-runner-nosend-staging';},'target_dedicated_worker_name'));
test('09 workers.dev cannot become public',()=>denies(
 f=>{f.config.workers_dev=true;},'workers_dev_off'));
test('10 preview URL must stay disabled',()=>denies(
 f=>{f.config.preview_urls=true;},'preview_urls_off'));
test('11 public worker route must stay empty',()=>denies(
 f=>{f.config.routes=['qa.example.com/*'];},'no_public_routes'));
test('12 no observability traces until privacy review',()=>denies(
 f=>{f.config.observability.enabled=true;},'no_observability_data_capture'));
test('13 no hidden cron trigger key',()=>denies(
 f=>{f.config.triggers={crons:['* * * * *']};},'exact_config_keys_no_hidden_bindings'));
test('14 no account-wide service binding',()=>denies(
 f=>{f.config.services=[{binding:'ADMIN',service:'some-other-worker'}];},'exact_config_keys_no_hidden_bindings'));
test('15 no privileged vars',()=>denies(
 f=>{f.config.vars.SUPABASE_SERVICE_ROLE='injected';},'exact_qa_only_vars'));
test('16 no Access JWT issuer values in plain-text wrangler vars',()=>denies(
 f=>{f.config.vars.V174P_ACCESS_JWKS_JSON='attacker';},'exact_qa_only_vars'));
test('17 no different main script',()=>denies(
 f=>{f.config.main='./stolen.worker.mjs';},'target_existing_reviewed_module'));
test('18 compatibility date must not change silently',()=>denies(
 f=>{f.config.compatibility_date='2027-01-01';},'verified_compatibility_date'));
test('19 no shared V17.5 Durable Object binding',()=>denies(
 f=>{f.config.durable_objects.bindings[0].class_name='ReplayBucket';},'one_isolated_durable_binding'));
test('20 no second binding to V17.5 DO',()=>denies(
 f=>{f.config.durable_objects.bindings.push({name:'V175',class_name:'RunnerResults'});},'one_isolated_durable_binding'));
test('21 only fresh SQLite class migration',()=>denies(
 f=>{f.config.migrations[0].new_sqlite_classes=['ReplayBucket'];},'one_sqlite_migration_no_existing_v175_class'));
test('22 inventory must not be stale',()=>denies(
 f=>{f.inventoryResult.inventory.collected_at_ms=NOW-600001;},'complete_authenticated_control_plane_inventory'));
test('23 incomplete pagination proof denied',()=>denies(
 f=>{f.inventoryResult.inventory.page_verification.status='INCOMPLETE';},'complete_authenticated_control_plane_inventory'));
test('24 mere JSON inventory flagged "not independently attested" denied',()=>denies(
 f=>{f.independentReview.live_inventory_independently_attested=false;},'complete_authenticated_control_plane_inventory'));
test('25 injected source with external provider literal denied',()=>denies(
 f=>{f.source='/* api.openai.com */\n'+f.source;f.reviewedSourceSha256=hash(f.source);},'no_known_outbound_or_commerce_literals'));
test('26 source missing ReplayGuard class denied',()=>denies(
 f=>{f.source=f.source.replace('export class V174PReplayGuard','class V174PReplayGuard');f.reviewedSourceSha256=hash(f.source);},'candidate_exports_same_qa_durable_object'));
test('27 bundled config must have no auto deploy flag',()=>denies(
 f=>{f.config.deploy={automatic:true};},'exact_config_keys_no_hidden_bindings'));
test('28 budget must be positive and bounded even if all other flags TRUE',()=>{
 const f=fixture();f.privateApproval.max_spend_usd=0;
 const r=evalFixture(f);assert(r.missing_private_authorizations.includes('positive_private_dollar_budget_not_proven'));
 assert.equal(r.can_deploy,false);
});
test('29 max request authorization fixed at 96 only',()=>{
 const f=fixture();f.privateApproval.max_qa_requests=200;
 const r=evalFixture(f);assert(r.missing_private_authorizations.includes('bounded_96_max_qa_requests'));
 assert.equal(r.can_deploy,false);
});
test('30 account-wide limits cannot be silently modified',()=>{
 const f=fixture();f.privateApproval.account_wide_spending_limit_change=true;
 const r=evalFixture(f);
 assert(r.missing_private_authorizations.includes('explicit_no_account_wide_spend_cap_mutation'));
});
test('31 explicit no-send and no-Commerce flags required',()=>{
 const f=fixture();f.privateApproval.provider_send_allowed=true;
 const r=evalFixture(f);assert(r.missing_private_authorizations.includes('zero_outbound_model_or_commerce'));
});
test('32 empty or missing source fails closed',()=>denies(
 f=>{f.source='';},'reviewed_candidate_source_present'));
