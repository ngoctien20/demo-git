import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {generateKeyPairSync,sign as edSign,createHash} from 'node:crypto';
import {preparePrivatePermitForManualReview,assessInactiveCloudflareChangeSet,CONTRACT} from './hosted4b2-atomic-permit-and-postflight.mjs';
import {CONTRACT as SIGNED_CONTRACT,ACCOUNT,WORKER,PROTECTED_V175_RESOURCES} from './hosted4b1-private-signed-permit.mjs';

const NOW=Date.parse('2026-11-17T08:35:00.000Z');
const SHA='763d215450c2908875f3f5860292d0a9bb872170';
const owner=generateKeyPairSync('ed25519'),security=generateKeyPairSync('ed25519');
const canonical=x=>Array.isArray(x)?'['+x.map(canonical).join(',')+']':
 (x!==null&&typeof x==='object'?'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}':JSON.stringify(x));
const sha=x=>createHash('sha256').update(typeof x==='string'?x:canonical(x),'utf8').digest('hex');
const sign=(p,k,pair)=>({key_id:k,signature:edSign(null,
 Buffer.from('T404_V174P_HOSTED4B1_PHASE_A_PERMIT\n'+canonical(p)),pair.privateKey).toString('base64url')});
const source=readFileSync(new URL('./hosted-issuer.worker.mjs',import.meta.url),'utf8');
const manifest=JSON.parse(readFileSync(new URL('./wrangler.hosted4b.inactive.example.json',import.meta.url),'utf8'));
function packet(){
 const names=[...PROTECTED_V175_RESOURCES.scripts,...Array.from({length:23},(_,i)=>'qa-existing-'+i)].sort();
 const inv={
  account_id:ACCOUNT,source:'CLOUDFLARE_CONTROL_PLANE_READ_ONLY',
  collected_at_ms:NOW-20000,worker_names:names,script_names:names.slice(),
  do_namespace_names:PROTECTED_V175_RESOURCES.namespaces.slice(),
  access_app_names:['old Pages app'],
  page_verification:{status:'COMPLETE',cross_consistent:true,total_workers:28,total_scripts:28}
 };
 const permit={
  contract:SIGNED_CONTRACT,intent:'FIRST_UPLOAD_INACTIVE_ONLY',
  account_id:ACCOUNT,worker_name:WORKER,new_sqlite_class:'V174PReplayGuard',
  source_git_sha:SHA,source_sha256:sha(source),
  manifest_sha256:sha(manifest),inventory_sha256:sha(inv),
  signed_at:new Date(NOW-2000).toISOString(),expires_at:new Date(NOW+600000).toISOString(),
  nonce:'b'.repeat(32),deployment_operator_email:'operator@example.com',
  rollback_operator_email:'rollback@example.com',
  incremental_budget_usd:5,max_external_requests:0,
  accept_shared_account_cost_risk:true,
  ack_spending_limit_not_hard_cap:true,
  ack_do_storage_charges_excluded:true,
  no_account_wide_limit_change:true,no_public_routes:true,
  no_preview_url:true,no_workers_dev:true,no_secret_upload:true,
  no_access_modifications:true,no_real_customer_data:true,
  no_outbound_provider_send:true,no_ai_model_calls:true,no_commerce_writes:true,
  create_new_qa_worker_and_sqlite_do_only:true
 };
 const trustAnchors={
  owner:{role:'owner',key_id:'synthetic-operator-test-owner',registered_out_of_band:true,
   spki_pem:owner.publicKey.export({type:'spki',format:'pem'})},
  security:{role:'security_reviewer',key_id:'synthetic-operator-test-security',registered_out_of_band:true,
   spki_pem:security.publicKey.export({type:'spki',format:'pem'})}
 };
 const registryEvidence={
  independently_verified_git_sha:SHA,independently_verified_source_hash:permit.source_sha256,
  inventory_collected_by_independent_connector:true,v175_durable_ownership_independently_reviewed:true,
  nonce_uniqueness_verified_by_durable_private_ledger:true,
  deployment_operator_email:permit.deployment_operator_email,
  rollback_operator_email:permit.rollback_operator_email,operator_verified_out_of_band:true,
  rollback_operator_verified_out_of_band:true,finance_owner_cost_reviewed_out_of_band:true,
  owner_real_identity_verified_out_of_band:true,security_reviewer_real_identity_verified_out_of_band:true
 };
 return {
  permit,signatures:{owner:sign(permit,trustAnchors.owner.key_id,owner),
    security:sign(permit,trustAnchors.security.key_id,security)},
  trustAnchors,registryEvidence,sourceArtifact:source,manifestArtifact:structuredClone(manifest),
  inventoryEvidence:{status:'COMPLETE_READ_ONLY_NEEDS_INDEPENDENT_REVIEW',errors:[],inventory:inv}
 };
}
function atomicTestLedger(){
 const nonceSet=new Set(),targetSet=new Set();
 return {claimOnce:async ({nonce_hash,account_id,worker_name,phase})=>{
  const key=account_id+'/'+worker_name+'/'+phase;
  // TEST-ONLY synchronous critical section models two SQL unique constraints.
  // A real distributed operator must use an independently hosted durable DB.
  if(nonceSet.has(nonce_hash)||targetSet.has(key))return {claimed:false};
  nonceSet.add(nonce_hash);targetSet.add(key);
  return {claimed:true,durable_commit_confirmed:true,receipt_id:'synthetic-receipt-id-'+nonceSet.size};
 }};
}
const readCurrent=ev=>async()=>structuredClone(ev.inventoryEvidence);
function beforeAfter(){
 const workers=Array.from({length:28},(_,i)=>({name:'other-worker-'+i,id:i.toString(16).padStart(32,'0')}));
 const scripts=workers.map(w=>({id:w.name}));
 const namespaces=PROTECTED_V175_RESOURCES.namespaces.map((name,i)=>({
  id:(i+41).toString(16).padStart(32,'0'),name,
  script:i===0?'tien404-v175e2-durable-replay-nosend-staging':'tien404-v175e2a-private-hosted-runner-nosend-staging',
  class:i===0?'ReplayBucket':'RunnerResults'
 }));
 const before={
  account_id:ACCOUNT,workers,scripts,namespaces,
  access_apps:[{id:'1'.repeat(32),name:'old pages',policy_ids:[]}],
  access_policies:[],domains:[{id:'2'.repeat(32),name:'unrelated.example.com'}]
 };
 const after=structuredClone(before);
 after.workers.push({name:WORKER,id:'e'.repeat(32)});
 after.scripts.push({id:WORKER});
 after.namespaces.push({
  id:'f'.repeat(32),name:WORKER+'_V174PReplayGuard',
  script:WORKER,class:'V174PReplayGuard'
 });
 return {before,after,exposure:{
  worker_name:WORKER,workers_dev:false,preview_urls:false,routes:[],
  cron_triggers:0,queue_consumers:0,other_public_bindings:0
 },independentReview:{
  control_plane_exposure_verified:true,before_after_connector_attested:true,
  v175_namespace_ids_preserved:true
 }};
}
test('01 complete synthetic postflight exactly one new isolated Worker + namespace gives review-only status',()=>{
 const r=assessInactiveCloudflareChangeSet(beforeAfter());
 assert.equal(r.contract,CONTRACT);assert.deepEqual(r.reasons,[]);
 assert.equal(r.status,'SOURCE_EVIDENCE_CONSISTENT_REQUIRES_INDEPENDENT_ACCEPTANCE');
 assert.equal(r.can_deploy,false);assert.equal(r.can_enable_public_route,false);
});
test('02 no evidence cannot claim postflight success',()=>{
 const r=assessInactiveCloudflareChangeSet();
 assert.equal(r.status,'BLOCKED_OR_INCOMPLETE');assert(r.reasons.length>4);
});
function postFail(mut,code){
 const f=beforeAfter();mut(f);
 const r=assessInactiveCloudflareChangeSet(f);
 assert(r.reasons.includes(code),JSON.stringify(r.reasons));
 assert.equal(r.can_deploy,false);
}
test('03 renamed pre-existing Worker is forbidden',()=>postFail(
 f=>{f.after.workers[0].name='tampered';},'exactly_one_new_dedicated_worker_and_version'));
test('04 deleted pre-existing Worker is forbidden',()=>postFail(
 f=>{f.after.workers.pop();f.after.workers.pop();},'exactly_one_new_dedicated_worker_and_version'));
test('05 modified existing Worker UUID is forbidden',()=>postFail(
 f=>{f.after.workers[1].id='d'.repeat(32);},'exactly_one_new_dedicated_worker_and_version'));
test('06 unexpected second Worker is forbidden',()=>postFail(
 f=>{f.after.workers.push({name:'unexpected',id:'c'.repeat(32)})},'exactly_one_new_dedicated_worker_and_version'));
test('07 pre-existing DO changed is forbidden',()=>postFail(
 f=>{f.after.namespaces[0].script='attacker';},'exactly_one_new_owned_sqlite_namespace'));
test('08 unexpected DO class is forbidden',()=>postFail(
 f=>{f.after.namespaces[2].class='RunnerResults';},'exactly_one_new_owned_sqlite_namespace'));
test('09 unexpected extra DO is forbidden',()=>postFail(
 f=>{f.after.namespaces.push({id:'d'.repeat(32),name:'extra',script:'extra',class:'Extra'})},'exactly_one_new_owned_sqlite_namespace'));
test('10 changing Pages Access is forbidden',()=>postFail(
 f=>{f.after.access_apps[0].policy_ids.push('new-policy')},'no_unapproved_access_apps_changes'));
test('11 new Access policy in Phase A is forbidden',()=>postFail(
 f=>{f.after.access_policies.push({id:'a'.repeat(32),name:'unknown'})},'no_unapproved_access_policies_changes'));
test('12 creating new domain in Phase A is forbidden',()=>postFail(
 f=>{f.after.domains.push({id:'a'.repeat(32),name:'qa.example.com'})},'no_unapproved_domains_changes'));
test('13 workers.dev must stay disabled',()=>postFail(
 f=>{f.exposure.workers_dev=true},'independent_no_public_exposure_proof'));
test('14 preview URLs must stay disabled',()=>postFail(
 f=>{f.exposure.preview_urls=true},'independent_no_public_exposure_proof'));
test('15 cron triggers forbidden',()=>postFail(
 f=>{f.exposure.cron_triggers=1},'independent_no_public_exposure_proof'));
test('16 third-party routing change forbidden',()=>postFail(
 f=>{f.exposure.routes=['*']},'independent_no_public_exposure_proof'));
test('17 security owner independently verifies exposure',()=>postFail(
 f=>{f.independentReview.control_plane_exposure_verified=false},'independent_no_public_exposure_proof'));
test('18 independent DO owner/ID proof required',()=>postFail(
 f=>{f.independentReview.v175_namespace_ids_preserved=false},'independent_resource_id_review'));
test('19 missing trusted ledger blocks without consuming',async()=>{
 const f=packet(),r=await preparePrivatePermitForManualReview({evidence:f,now:NOW});
 assert.equal(r.status,'BLOCKED_TRUSTED_LEDGER_OR_READER_MISSING');
 assert.equal(r.ledger_mutation_attempted,false);
});
test('20 invalid unsigned permit blocked before ledger',async()=>{
 const f=packet();f.signatures=null;
 let called=false;
 const r=await preparePrivatePermitForManualReview({
  evidence:f,now:NOW,privateLedger:{claimOnce:async()=>{called=true;throw Error('unreachable')}},
  getFreshInventory:readCurrent(f)
 });
 assert.equal(r.status,'BLOCKED_PERMIT_PREFLIGHT');assert.equal(called,false);
});
test('21 one use permit only yields nondeployable manual review state',async()=>{
 const f=packet(),ledger=atomicTestLedger();
 const r=await preparePrivatePermitForManualReview({evidence:f,now:NOW,privateLedger:ledger,
  getFreshInventory:readCurrent(f)});
 assert.equal(r.status,'ONE_TIME_PERMIT_RESERVED_FOR_MANUAL_REVIEW_ONLY');
 assert.equal(r.can_upload,false);assert.equal(r.can_deploy,false);
 assert.equal(r.permit_consumed,true);
});
test('22 duplicate concurrent attempts for same nonce: exactly one winner',async()=>{
 const f=packet(),ledger=atomicTestLedger();
 const results=await Promise.all(Array.from({length:20},()=>preparePrivatePermitForManualReview({
  evidence:f,privateLedger:ledger,getFreshInventory:readCurrent(f),now:NOW
 })));
 assert.equal(results.filter(x=>x.status==='ONE_TIME_PERMIT_RESERVED_FOR_MANUAL_REVIEW_ONLY').length,1);
 assert.equal(results.filter(x=>x.status==='BLOCKED_NONCE_REPLAY_OR_LEDGER_UNCERTAIN').length,19);
 assert(results.every(x=>x.can_upload===false));
});
test('23 claim ledger fails closed if durable commit is uncertain',async()=>{
 const f=packet();
 const r=await preparePrivatePermitForManualReview({evidence:f,now:NOW,
  privateLedger:{claimOnce:async()=>({claimed:true,receipt_id:'uncertain-claim'})},
  getFreshInventory:readCurrent(f)});
 assert.equal(r.status,'BLOCKED_NONCE_REPLAY_OR_LEDGER_UNCERTAIN');
});
test('24 ledger error fails closed',async()=>{
 const f=packet();
 const r=await preparePrivatePermitForManualReview({evidence:f,now:NOW,
  privateLedger:{claimOnce:async()=>{throw Error('db down')}},
  getFreshInventory:readCurrent(f)});
 assert.equal(r.status,'BLOCKED_LEDGER_ERROR');assert.equal(r.can_upload,false);
});
test('25 claimed permit never reused when Cloudflare inventory drifts',async()=>{
 const f=packet(),ledger=atomicTestLedger();
 const getFreshInventory=async()=>{
  const x=structuredClone(f.inventoryEvidence);
  x.inventory.worker_names.push(WORKER);
  return x;
 };
 const first=await preparePrivatePermitForManualReview({evidence:f,now:NOW,
  privateLedger:ledger,getFreshInventory});
 assert.equal(first.status,'BLOCKED_CLOUD_INVENTORY_DRIFT_PERMIT_CONSUMED');
 const second=await preparePrivatePermitForManualReview({evidence:f,now:NOW,
  privateLedger:ledger,getFreshInventory:readCurrent(f)});
 assert.equal(second.status,'BLOCKED_NONCE_REPLAY_OR_LEDGER_UNCERTAIN');
});
test('26 inventory reader failure consumes nonce, refuses replay',async()=>{
 const f=packet(),ledger=atomicTestLedger();
 const first=await preparePrivatePermitForManualReview({evidence:f,now:NOW,privateLedger:ledger,
  getFreshInventory:async()=>{throw Error('GET 503')}});
 assert.equal(first.status,'BLOCKED_INVENTORY_REFRESH_FAILED_PERMIT_CONSUMED');
 const again=await preparePrivatePermitForManualReview({evidence:f,now:NOW,privateLedger:ledger,
  getFreshInventory:readCurrent(f)});
 assert.equal(again.status,'BLOCKED_NONCE_REPLAY_OR_LEDGER_UNCERTAIN');
});
test('27 refreshed inventory must be no more than 60s old',async()=>{
 const f=packet(),ledger=atomicTestLedger(),getFreshInventory=async()=>{
  const x=structuredClone(f.inventoryEvidence);
  x.inventory.collected_at_ms=NOW-61000;return x;
 };
 const r=await preparePrivatePermitForManualReview({evidence:f,now:NOW,privateLedger:ledger,
  getFreshInventory});
 assert.equal(r.status,'BLOCKED_CLOUD_INVENTORY_DRIFT_PERMIT_CONSUMED');
});
test('28 two differently signed nonces for same first-upload Worker cannot both claim target',async()=>{
 const first=packet(),second=packet(),ledger=atomicTestLedger();
 second.permit.nonce='c'.repeat(32);
 second.signatures.owner=sign(second.permit,second.trustAnchors.owner.key_id,owner);
 second.signatures.security=sign(second.permit,second.trustAnchors.security.key_id,security);
 const results=await Promise.all([
  preparePrivatePermitForManualReview({evidence:first,privateLedger:ledger,getFreshInventory:readCurrent(first),now:NOW}),
  preparePrivatePermitForManualReview({evidence:second,privateLedger:ledger,getFreshInventory:readCurrent(second),now:NOW})
 ]);
 assert.equal(results.filter(r=>r.status==='ONE_TIME_PERMIT_RESERVED_FOR_MANUAL_REVIEW_ONLY').length,1);
 assert.equal(results.filter(r=>r.status==='BLOCKED_NONCE_REPLAY_OR_LEDGER_UNCERTAIN').length,1);
});
