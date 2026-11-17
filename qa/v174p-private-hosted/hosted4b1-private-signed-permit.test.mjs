import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash,generateKeyPairSync,sign as edSign} from 'node:crypto';
import {preflightInactivePermit,CONTRACT,ACCOUNT,WORKER,PROTECTED_V175_RESOURCES} from './hosted4b1-private-signed-permit.mjs';

const NOW=Date.parse('2026-11-17T08:25:00.000Z');
const GIT_SHA='40682fbc38e63713e3a05d15c27d792bb7bb301a';
const ownerPair=generateKeyPairSync('ed25519');
const secPair=generateKeyPairSync('ed25519');
const canonical=x=>Array.isArray(x)?'['+x.map(canonical).join(',')+']':
 (x!==null&&typeof x==='object'?
  '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}':
  JSON.stringify(x));
const hash=x=>createHash('sha256').update(canonical(x),'utf8').digest('hex');
const source=readFileSync(new URL('./hosted-issuer.worker.mjs',import.meta.url),'utf8');
const manifest=JSON.parse(readFileSync(new URL('./wrangler.hosted4b.inactive.example.json',import.meta.url),'utf8'));
const sign=(packet,kid,pair)=>({
 key_id:kid,signature:edSign(null,
 Buffer.from('T404_V174P_HOSTED4B1_PHASE_A_PERMIT\n'+canonical(packet)),
 pair.privateKey).toString('base64url')
});
function fixture(){
 const workerNames=[
  ...PROTECTED_V175_RESOURCES.scripts,
  ...Array.from({length:23},(_,i)=>'unrelated-worker-'+i)
 ].sort();
 const inventory={
  account_id:ACCOUNT,
  source:'CLOUDFLARE_CONTROL_PLANE_READ_ONLY',
  collected_at_ms:NOW-30*1000,
  worker_names:workerNames,
  script_names:workerNames.slice(),
  do_namespace_names:PROTECTED_V175_RESOURCES.namespaces.slice(),
  access_app_names:['existing Pages Access app'],
  page_verification:{status:'COMPLETE',cross_consistent:true,total_workers:28,total_scripts:28}
 };
 const packet={
  contract:CONTRACT,intent:'FIRST_UPLOAD_INACTIVE_ONLY',
  account_id:ACCOUNT,worker_name:WORKER,new_sqlite_class:'V174PReplayGuard',
  source_git_sha:GIT_SHA,
  source_sha256:createHash('sha256').update(source,'utf8').digest('hex'),
  manifest_sha256:hash(manifest),inventory_sha256:hash(inventory),
  signed_at:new Date(NOW-1000).toISOString(),
  expires_at:new Date(NOW+7*60*1000).toISOString(),
  nonce:'a'.repeat(32),
  deployment_operator_email:'operator@example.com',
  rollback_operator_email:'rollback@example.com',
  incremental_budget_usd:5,max_external_requests:0,
  accept_shared_account_cost_risk:true,
  ack_spending_limit_not_hard_cap:true,
  ack_do_storage_charges_excluded:true,
  no_account_wide_limit_change:true,
  no_public_routes:true,no_preview_url:true,no_workers_dev:true,
  no_secret_upload:true,no_access_modifications:true,
  no_real_customer_data:true,no_outbound_provider_send:true,
  no_ai_model_calls:true,no_commerce_writes:true,
  create_new_qa_worker_and_sqlite_do_only:true
 };
 const trustAnchors={
  owner:{role:'owner',key_id:'synthetic-test-owner-key',registered_out_of_band:true,
   spki_pem:ownerPair.publicKey.export({type:'spki',format:'pem'})},
  security:{role:'security_reviewer',key_id:'synthetic-test-security-key',registered_out_of_band:true,
   spki_pem:secPair.publicKey.export({type:'spki',format:'pem'})}
 };
 const registryEvidence={
  independently_verified_git_sha:GIT_SHA,
  independently_verified_source_hash:packet.source_sha256,
  inventory_collected_by_independent_connector:true,
  v175_durable_ownership_independently_reviewed:true,
  nonce_uniqueness_verified_by_durable_private_ledger:true,
  deployment_operator_email:packet.deployment_operator_email,
  rollback_operator_email:packet.rollback_operator_email,
  operator_verified_out_of_band:true,
  rollback_operator_verified_out_of_band:true,
  finance_owner_cost_reviewed_out_of_band:true,
  owner_real_identity_verified_out_of_band:true,
  security_reviewer_real_identity_verified_out_of_band:true
 };
 const signatures={owner:sign(packet,trustAnchors.owner.key_id,ownerPair),
   security:sign(packet,trustAnchors.security.key_id,secPair)};
 return {permit:packet,signatures,trustAnchors,registryEvidence,
  sourceArtifact:source,manifestArtifact:structuredClone(manifest),
  inventoryEvidence:{status:'COMPLETE_READ_ONLY_NEEDS_INDEPENDENT_REVIEW',
    errors:[],inventory},now:NOW};
}
const resign=f=>{
 f.signatures.owner=sign(f.permit,f.trustAnchors.owner.key_id,ownerPair);
 f.signatures.security=sign(f.permit,f.trustAnchors.security.key_id,secPair);
};
const evaluate=f=>preflightInactivePermit(f);
const deny=(mut,id,resignAfter=false)=>{
 const f=fixture();mut(f);if(resignAfter)resign(f);
 const r=evaluate(f);
 assert.equal(r.decision,'BLOCKED');
 assert(r.reasons.includes(id),JSON.stringify(r.reasons));
 assert.equal(r.can_upload,false);assert.equal(r.can_deploy,false);
 assert.equal(r.can_change_access,false);assert.equal(r.can_run_external_cloudflare_uat,false);
};
test('01 synthetic dual signature mathematical proof is review-only and never upload authority',()=>{
 const r=evaluate(fixture());
 assert.deepEqual(r.reasons,[]);
 assert.match(r.decision,/REQUIRES_OPERATOR_EXECUTION_APPROVAL/);
 assert.equal(r.can_upload,false);
 assert.equal(r.cost_hard_cap_guaranteed,false);
 assert.equal(r.actual_resource_created,false);
 assert.equal(r.owner_identity_material_available_to_this_validator,false);
});
test('02 no permit / signatures / trust or evidence blocks',()=>{
 const r=preflightInactivePermit({now:NOW});
 assert.equal(r.decision,'BLOCKED');assert.equal(r.can_upload,false);
 assert(r.reasons.length>=10);
});
test('03 signed budget mutation invalidates both signatures',()=>{
 deny(f=>{f.permit.incremental_budget_usd=9},'two_signed_ed25519_approvals_same_exact_packet');
});
test('04 same signed packet with only owner signature invalidates',()=>{
 deny(f=>{delete f.signatures.security},'two_signed_ed25519_approvals_same_exact_packet');
});
test('05 security signature cannot reuse owner key',()=>{
 deny(f=>{f.trustAnchors.security=f.trustAnchors.owner},
  'trust_keys_from_independent_private_registry');
});
test('06 self-provided attacker public key mismatches expected signature',()=>{
 deny(f=>{f.trustAnchors.owner.spki_pem=secPair.publicKey.export({type:'spki',format:'pem'})},
  'two_signed_ed25519_approvals_same_exact_packet');
});
test('07 no private trust registry',()=>{
 deny(f=>{f.trustAnchors.owner.registered_out_of_band=false},
  'trust_keys_from_independent_private_registry');
});
test('08 no real owner identity attestation',()=>{
 deny(f=>{f.registryEvidence.owner_real_identity_verified_out_of_band=false},
  'trust_keys_from_independent_private_registry');
});
test('09 no independent reviewer identity attestation',()=>{
 deny(f=>{f.registryEvidence.security_reviewer_real_identity_verified_out_of_band=false},
  'trust_keys_from_independent_private_registry');
});
test('10 wrong Cloudflare account with valid new signatures denied',()=>{
 deny(f=>{f.permit.account_id='other account'},'account_worker_sqlite_scope',true);
});
test('11 targeting V17.5 worker even with signed packet denied',()=>{
 deny(f=>{f.permit.worker_name=PROTECTED_V175_RESOURCES.scripts[0]},
  'account_worker_sqlite_scope',true);
});
test('12 wrong SHA of reviewed commit even with newly signed permit',()=>{
 deny(f=>{f.permit.source_git_sha='f'.repeat(40)},
  'git_and_source_sha',true);
});
test('13 changed source content must invalidate signed pin',()=>{
 deny(f=>{f.sourceArtifact+=' malicious addition'},'git_and_source_sha');
});
test('14 modified full manifest even when re-signed must stay no-route',()=>{
 deny(f=>{
  f.manifestArtifact.routes=['existing.example.com/*'];
  f.permit.manifest_sha256=hash(f.manifestArtifact);
 },'manifest_exact_digest_and_qa_safety',true);
});
test('15 hidden service binding even when re-signed rejected',()=>{
 deny(f=>{
  f.manifestArtifact.services=[{binding:'ADMIN',service:'production'}];
  f.permit.manifest_sha256=hash(f.manifestArtifact);
 },'manifest_exact_digest_and_qa_safety',true);
});
test('16 malicious secret var in new manifest rejected',()=>{
 deny(f=>{
  f.manifestArtifact.vars.PROD_SERVICE_TOKEN='synthetic-test-only';
  f.permit.manifest_sha256=hash(f.manifestArtifact);
 },'manifest_exact_digest_and_qa_safety',true);
});
test('17 request activation in phase A denied with valid signatures',()=>{
 deny(f=>{f.permit.intent='DEPLOY_TO_PUBLIC'},'contract_and_explicit_inactive_intent',true);
});
test('18 user attempts to turn workers.dev on',()=>{
 deny(f=>{f.permit.no_workers_dev=false},'zero_external_http_before_access',true);
});
test('19 attempt to allow HTTP requests pre-Access denied',()=>{
 deny(f=>{f.permit.max_external_requests=96},'zero_external_http_before_access',true);
});
test('20 cannot enable public route',()=>{
 deny(f=>{f.permit.no_public_routes=false},'zero_external_http_before_access',true);
});
test('21 cannot modify Access in this phase',()=>{
 deny(f=>{f.permit.no_access_modifications=false},
  'no_credential_or_live_access_actions',true);
});
test('22 cannot upload managed secrets in phase A',()=>{
 deny(f=>{f.permit.no_secret_upload=false},'no_credential_or_live_access_actions',true);
});
test('23 no real merchant/customer data',()=>{
 deny(f=>{f.permit.no_real_customer_data=false},'no_credential_or_live_access_actions',true);
});
test('24 no provider sends or model calls',()=>{
 deny(f=>{f.permit.no_outbound_provider_send=false},
  'no_credential_or_live_access_actions',true);
});
test('25 no commerce writes',()=>{
 deny(f=>{f.permit.no_commerce_writes=false},'no_credential_or_live_access_actions',true);
});
test('26 a declared budget of zero cannot be authorized',()=>{
 deny(f=>{f.permit.incremental_budget_usd=0},
  'positive_manual_usd_risk_envelope_not_hard_cap',true);
});
test('27 budget over maximum 25 USD is out of scope',()=>{
 deny(f=>{f.permit.incremental_budget_usd=25.01},
  'positive_manual_usd_risk_envelope_not_hard_cap',true);
});
test('28 cannot claim Cloudflare spend cap guarantees an invoice ceiling',()=>{
 deny(f=>{f.permit.ack_spending_limit_not_hard_cap=false},
  'positive_manual_usd_risk_envelope_not_hard_cap',true);
});
test('29 DO stored data fees explicitly acknowledged',()=>{
 deny(f=>{f.permit.ack_do_storage_charges_excluded=false},
  'positive_manual_usd_risk_envelope_not_hard_cap',true);
});
test('30 no account-wide spending limits change',()=>{
 deny(f=>{f.permit.no_account_wide_limit_change=false},
  'no_shared_billing_limit_mutations',true);
});
test('31 no verified finance risk signoff',()=>{
 deny(f=>{f.registryEvidence.finance_owner_cost_reviewed_out_of_band=false},
  'positive_manual_usd_risk_envelope_not_hard_cap');
});
test('32 operator identity must be from private registry',()=>{
 deny(f=>{f.registryEvidence.deployment_operator_email='different@example.com'},
  'known_exact_operator_and_rollback');
});
test('33 wildcard operator identity rejected',()=>{
 deny(f=>{f.permit.deployment_operator_email='*@example.com'},
  'known_exact_operator_and_rollback',true);
});
test('34 changed rollback operator requires validation',()=>{
 deny(f=>{f.registryEvidence.rollback_operator_verified_out_of_band=false},
  'known_exact_operator_and_rollback');
});
test('35 missing nonce ledger replay protection cannot be self-attested',()=>{
 deny(f=>{f.registryEvidence.nonce_uniqueness_verified_by_durable_private_ledger=false},
  'unique_nonce_in_signed_permit');
});
test('36 expired permit even when signatures valid',()=>{
 deny(f=>{f.permit.expires_at=new Date(NOW-1).toISOString()},
  'short_lived_private_permit',true);
});
test('37 permit lifetime greater than 15 minutes denied',()=>{
 deny(f=>{f.permit.expires_at=new Date(NOW+20*60000).toISOString()},
  'short_lived_private_permit',true);
});
test('38 inventory stale over five minutes rejected',()=>{
 deny(f=>{f.inventoryEvidence.inventory.collected_at_ms=NOW-300001;
 f.permit.inventory_sha256=hash(f.inventoryEvidence.inventory)},
 'read_only_control_plane_complete_fresh_and_bound',true);
});
test('39 wrong inventory snapshot hash rejected',()=>{
 deny(f=>{f.permit.inventory_sha256='f'.repeat(64)},
  'read_only_control_plane_complete_fresh_and_bound',true);
});
test('40 truncated partial Cloudflare Workers response rejected',()=>{
 deny(f=>{f.inventoryEvidence.inventory.page_verification.status='INCOMPLETE';
 f.permit.inventory_sha256=hash(f.inventoryEvidence.inventory)},
 'read_only_control_plane_complete_fresh_and_bound',true);
});
test('41 missing V17.5 script in snapshot rejected',()=>{
 deny(f=>{
  f.inventoryEvidence.inventory.worker_names=f.inventoryEvidence.inventory.worker_names
   .filter(x=>x!==PROTECTED_V175_RESOURCES.scripts[0]);
  f.inventoryEvidence.inventory.script_names=f.inventoryEvidence.inventory.script_names
   .filter(x=>x!==PROTECTED_V175_RESOURCES.scripts[0]);
  f.inventoryEvidence.inventory.page_verification.total_workers=27;
  f.inventoryEvidence.inventory.page_verification.total_scripts=27;
  f.permit.inventory_sha256=hash(f.inventoryEvidence.inventory);
 },'protected_parallel_resources_present_unmodified',true);
});
test('42 existing target Worker collision denied',()=>{
 deny(f=>{
  f.inventoryEvidence.inventory.worker_names.push(WORKER);
  f.inventoryEvidence.inventory.script_names.push(WORKER);
  f.inventoryEvidence.inventory.page_verification.total_workers=29;
  f.inventoryEvidence.inventory.page_verification.total_scripts=29;
  f.permit.inventory_sha256=hash(f.inventoryEvidence.inventory);
 },'no_existing_target_resources',true);
});
test('43 no Access creation through Phase A',()=>{
 deny(f=>{f.permit.create_new_qa_worker_and_sqlite_do_only=false},
  'single_new_qa_worker_namespace_only',true);
});
test('44 added unknown signed field still rejected',()=>{
 deny(f=>{f.permit.auto_deploy=true},'exact_permit_fields',true);
});
test('45 even all synthetic approvals passed never allow mutating shared Cloudflare',()=>{
 const x=evaluate(fixture());
 assert.equal(x.can_upload,false);assert.equal(x.can_change_access,false);
 assert.equal(x.can_deploy,false);assert.equal(x.actual_incremental_spend_verified,false);
});
