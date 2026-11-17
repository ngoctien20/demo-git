import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash,generateKeyPairSync,sign as cryptoSign} from 'node:crypto';
import {CONTRACT,ACCOUNT,WORKER,LEDGER,digest,assessIndependentFinanceAndLedger} from './hosted4b4-independent-finance-ledger-gate.mjs';
import {hashPermit,verifyPrivateOperatorAdmission} from './hosted4b3-private-operator-admission.mjs';
import {PROTECTED_V175_RESOURCES} from './hosted4b1-private-signed-permit.mjs';

const NOW=Date.parse('2026-11-17T10:50:00.000Z');
const EPOCH=NOW/1000;
const ownerKey=generateKeyPairSync('ed25519');
const ownerSecurityKey=generateKeyPairSync('ed25519');
const financeKey=generateKeyPairSync('ed25519');
const ledgerSecurityKey=generateKeyPairSync('ed25519');
const brokerKey=generateKeyPairSync('rsa',{modulusLength:2048});
const source=readFileSync(new URL('./hosted-issuer.worker.mjs',import.meta.url),'utf8');
const manifest=JSON.parse(readFileSync(new URL('./wrangler.hosted4b.inactive.example.json',import.meta.url),'utf8'));
const sourceSha=createHash('sha256').update(source,'utf8').digest('hex');
const sha='53dda238068039e1cc45336239eada7b0eacb9ad';
const canonical=x=>Array.isArray(x)?'['+x.map(canonical).join(',')+']':
 (x!==null&&typeof x==='object'?
  '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}':
  JSON.stringify(x));
const signed=(data,pair,kid,prefix)=>({
 key_id:kid,signature:cryptoSign(null,Buffer.from(prefix+'\n'+canonical(data)),
 pair.privateKey).toString('base64url')
});
function brokerToken(permit,change={}){
 const h=Buffer.from(JSON.stringify({alg:'RS256',kid:'synthetic-broker'})).toString('base64url');
 const c=Buffer.from(JSON.stringify({
  iss:'https://qa-identity.example.com',aud:'t404-private-qa-admission',
  sub:'synthetic-op-001',email:'operator@example.com',email_verified:true,
  role:'qa_deployment_operator',scope:'t404:qa:inactive-first-upload',
  iat:EPOCH-20,nbf:EPOCH-20,exp:EPOCH+180,auth_time:EPOCH-25,
  amr:['password','mfa'],permit_sha256:hashPermit(permit),...change
 })).toString('base64url');
 return h+'.'+c+'.'+cryptoSign('RSA-SHA256',Buffer.from(h+'.'+c),brokerKey.privateKey).toString('base64url');
}
function fixture(){
 const all=[...PROTECTED_V175_RESOURCES.scripts,
  'tien404-rpc16-merchant-evidence-inactive-staging',
  ...Array.from({length:23},(_,i)=>'unrelated-'+i)].sort();
 const inventory={
  account_id:ACCOUNT,source:'CLOUDFLARE_CONTROL_PLANE_READ_ONLY',
  collected_at_ms:NOW-30_000,worker_names:all,script_names:all.slice(),
  do_namespace_names:PROTECTED_V175_RESOURCES.namespaces.slice(),
  access_app_names:['TIEN404 RPC16 Merchant Evidence Staging — DENY ALL',
   'tien404-ai-git-staging - Cloudflare Pages'],
  page_verification:{status:'COMPLETE',cross_consistent:true,total_workers:29,total_scripts:29}
 };
 const permit={
  contract:'T404_V174P_HOSTED4B1_PRIVATE_PHASE_A_SIGNED_PERMIT_V1',
  intent:'FIRST_UPLOAD_INACTIVE_ONLY',account_id:ACCOUNT,
  worker_name:WORKER,new_sqlite_class:'V174PReplayGuard',
  source_git_sha:sha,source_sha256:sourceSha,
  manifest_sha256:digest(manifest),inventory_sha256:digest(inventory),
  signed_at:new Date(NOW-1000).toISOString(),expires_at:new Date(NOW+7*60_000).toISOString(),
  nonce:'a'.repeat(32),deployment_operator_email:'operator@example.com',
  rollback_operator_email:'rollback@example.com',incremental_budget_usd:5,
  max_external_requests:0,accept_shared_account_cost_risk:true,
  ack_spending_limit_not_hard_cap:true,ack_do_storage_charges_excluded:true,
  no_account_wide_limit_change:true,no_public_routes:true,no_preview_url:true,
  no_workers_dev:true,no_secret_upload:true,no_access_modifications:true,
  no_real_customer_data:true,no_outbound_provider_send:true,
  no_ai_model_calls:true,no_commerce_writes:true,
  create_new_qa_worker_and_sqlite_do_only:true
 };
 const ownerTrust={
  owner:{role:'owner',key_id:'synthetic-owner-key',registered_out_of_band:true,
   spki_pem:ownerKey.publicKey.export({type:'spki',format:'pem'})},
  security:{role:'security_reviewer',key_id:'synthetic-owner-security-key',
   registered_out_of_band:true,
   spki_pem:ownerSecurityKey.publicKey.export({type:'spki',format:'pem'})}
 };
 const ownerEvidence={
  permit,signatures:{
   owner:signed(permit,ownerKey,'synthetic-owner-key','T404_V174P_HOSTED4B1_PHASE_A_PERMIT'),
   security:signed(permit,ownerSecurityKey,'synthetic-owner-security-key',
     'T404_V174P_HOSTED4B1_PHASE_A_PERMIT')
  },trustAnchors:ownerTrust,
  registryEvidence:{
   independently_verified_git_sha:sha,
   independently_verified_source_hash:sourceSha,
   inventory_collected_by_independent_connector:true,
   v175_durable_ownership_independently_reviewed:true,
   nonce_uniqueness_verified_by_durable_private_ledger:true,
   deployment_operator_email:'operator@example.com',
   rollback_operator_email:'rollback@example.com',
   operator_verified_out_of_band:true,
   rollback_operator_verified_out_of_band:true,
   finance_owner_cost_reviewed_out_of_band:true,
   owner_real_identity_verified_out_of_band:true,
   security_reviewer_real_identity_verified_out_of_band:true
  },sourceArtifact:source,manifestArtifact:structuredClone(manifest),
  inventoryEvidence:{status:'COMPLETE_READ_ONLY_NEEDS_INDEPENDENT_REVIEW',
   errors:[],inventory}
 };
 const operatorTrust={
  source:'PRIVATE_IDENTITY_BROKER_OUT_OF_BAND',
  independent_operator_registry_verified:true,
  kid:'synthetic-broker',
  spki_pem:brokerKey.publicKey.export({type:'spki',format:'pem'}),
  issuer:'https://qa-identity.example.com',audience:'t404-private-qa-admission',
  authorized_operator_subject:'synthetic-op-001',
  authorized_operator_email:'operator@example.com'
 };
 const jwt=brokerToken(permit);
 const operator=verifyPrivateOperatorAdmission({jwt,trustConfig:operatorTrust,permit,now:NOW});
 const financePacket={
  contract:CONTRACT,account_id:ACCOUNT,
  scope:'INACTIVE_FIRST_UPLOADS_NO_SEND',
  worker_name:WORKER,ledger_worker_name:LEDGER,ledger_class:'V174PPermitLedger',
  source_git_sha:permit.source_git_sha,source_sha256:permit.source_sha256,
  manifest_digest:permit.manifest_sha256,
  owner_permit_digest:hashPermit(permit),inventory_digest:digest(inventory),
  operator_subject_hash:operator.operator_subject_hash,
  qa_worker_budget_usd:3,private_ledger_budget_usd:2,
  cost_window_id:'qa-20261117-a',
  issued_at:new Date(NOW-1000).toISOString(),
  expires_at:new Date(NOW+7*60_000).toISOString(),
  nonce:'b'.repeat(32),
  allow_first_inactive_qa_worker_upload:true,
  allow_new_private_ledger_first_upload:true,
  accept_account_wide_worker_do_spend_risk:true,
  accept_unlimited_stored_data_exposure:true,
  accept_no_hard_per_resource_cloudflare_cap:true,
  allow_account_wide_spend_limit_change:false,
  allow_billing_plan_upgrade:false,
  allow_existing_worker_mutation:false,
  allow_existing_namespace_mutation:false,
  allow_public_url:false,allow_preview:false,allow_workers_dev:false,
  allow_access_mutation:false,allow_secrets:false,
  allow_outbound_sends:false,allow_real_commerce:false,
  allow_automatic_deployment:false,max_public_requests_before_access:0,
  private_ledger_isolation_reviewed:true,rollback_operator_approved:true
 };
 const financeTrust={
  finance:{role:'finance_approver',key_id:'synthetic-finance-key',
   registered_out_of_band:true,spki_pem:financeKey.publicKey.export({type:'spki',format:'pem'})},
  ledger_security:{role:'security_reviewer',key_id:'synthetic-ledger-security-key',
   registered_out_of_band:true,spki_pem:ledgerSecurityKey.publicKey.export({type:'spki',format:'pem'})}
 };
 const privateRegistry={
  current_inventory_provenance_verified_privately:true,
  parallel_resource_ownership_verified_privately:true,
  finance_nonce_unused_verified_by_private_registry:true,
  finance_identity_out_of_band_verified:true,
  ledger_security_identity_out_of_band_verified:true,
  operator_identity_out_of_band_verified:true,
  rollback_operator_identity_out_of_band_verified:true,
  finance_signer_segregation_privately_reviewed:true,
  independent_finance_cost_window_review:true,
  dedicated_hosted_ledger_private_origin_reviewed:true,
  hosted_ledger_not_preexisting_confirmed:true,
  independent_rollback_plan_reviewed:true,
  cloudflare_rbac_least_privilege_verified_privately:true,
  private_change_window_operator_separation_verified:true
 };
 const data={financePacket,financeTrust,ownerEvidence,operatorJwt:jwt,
  operatorTrust,privateRegistry,now:NOW};
 resign(data);
 return data;
}
function resign(d){
 d.financeSignatures={
  finance:signed(d.financePacket,financeKey,d.financeTrust.finance.key_id,
   'T404_V174P_HOSTED4B4_FINANCE_LEDGER_APPROVAL'),
  ledger_security:signed(d.financePacket,ledgerSecurityKey,d.financeTrust.ledger_security.key_id,
   'T404_V174P_HOSTED4B4_FINANCE_LEDGER_APPROVAL')
 };
}
function reject(mut,reason,resignAfter=false){
 const f=fixture();mut(f);if(resignAfter)resign(f);
 const r=assessIndependentFinanceAndLedger(f);
 assert.equal(r.status,'BLOCKED',JSON.stringify(r.reasons));
 assert(r.reasons.includes(reason),JSON.stringify(r.reasons));
 assert.equal(r.can_upload_qa_worker,false);
 assert.equal(r.can_create_hosted_ledger,false);
 assert.equal(r.mutations_executed,false);
}
test('01 synthetic independent owner/security/finance/ledger reviewer + operator is only mathematical consistency',()=>{
 const r=assessIndependentFinanceAndLedger(fixture());
 assert.equal(r.status,'CRYPTOGRAPHICALLY_CONSISTENT_NOT_HOSTED_AUTHORIZED',JSON.stringify(r.reasons));
 assert.deepEqual(r.reasons,[]);
 assert.equal(r.can_upload_qa_worker,false);
 assert.equal(r.can_create_hosted_ledger,false);
 assert.equal(r.human_identity_independently_verified_by_this_code,false);
});
test('02 missing ALL financial evidence fails closed',()=>{
 const r=assessIndependentFinanceAndLedger({now:NOW});
 assert.equal(r.status,'BLOCKED');assert(r.reasons.length>10);
});
test('03 unsigned finance packet rejected',()=>reject(f=>{f.financeSignatures=null},
 'two_independent_finance_and_security_signatures'));
test('04 security review signature missing',()=>reject(f=>{delete f.financeSignatures.ledger_security},
 'two_independent_finance_and_security_signatures'));
test('05 budget change after signature rejected',()=>reject(f=>{f.financePacket.private_ledger_budget_usd=3},
 'two_independent_finance_and_security_signatures'));
test('06 budget change even freshly re-signed must respect owner permit',()=>reject(
 f=>{f.financePacket.qa_worker_budget_usd=6},
 'two_separate_positive_budgets_and_combined_max_25',true));
test('07 ledger budget zero is forbidden',()=>reject(
 f=>{f.financePacket.private_ledger_budget_usd=0},
 'two_separate_positive_budgets_and_combined_max_25',true));
test('08 negative QA budget denied',()=>reject(
 f=>{f.financePacket.qa_worker_budget_usd=-1},
 'two_separate_positive_budgets_and_combined_max_25',true));
test('09 combined USD budget over 25 denied',()=>reject(
 f=>{f.financePacket.private_ledger_budget_usd=26},
 'two_separate_positive_budgets_and_combined_max_25',true));
test('10 account-wide limit change denied',()=>reject(
 f=>{f.financePacket.allow_account_wide_spend_limit_change=true},
 'explicit_account_wide_nonhard_cost_risks',true));
test('11 billing plan upgrade not approved',()=>reject(
 f=>{f.financePacket.allow_billing_plan_upgrade=true},
 'explicit_account_wide_nonhard_cost_risks',true));
test('12 no fake hard Cloudflare cap claim',()=>reject(
 f=>{f.financePacket.accept_no_hard_per_resource_cloudflare_cap=false},
 'explicit_account_wide_nonhard_cost_risks',true));
test('13 stored Durable Object charges must be acknowledged',()=>reject(
 f=>{f.financePacket.accept_unlimited_stored_data_exposure=false},
 'explicit_account_wide_nonhard_cost_risks',true));
test('14 public URL forbidden',()=>reject(
 f=>{f.financePacket.allow_public_url=true},
 'separate_scoped_approvals_not_expansion_to_public',true));
test('15 previews forbidden',()=>reject(
 f=>{f.financePacket.allow_preview=true},
 'separate_scoped_approvals_not_expansion_to_public',true));
test('16 account Access changes forbidden',()=>reject(
 f=>{f.financePacket.allow_access_mutation=true},
 'separate_scoped_approvals_not_expansion_to_public',true));
test('17 secret uploads forbidden',()=>reject(
 f=>{f.financePacket.allow_secrets=true},
 'separate_scoped_approvals_not_expansion_to_public',true));
test('18 provider sends forbidden',()=>reject(
 f=>{f.financePacket.allow_outbound_sends=true},
 'separate_scoped_approvals_not_expansion_to_public',true));
test('19 Commerce actions forbidden',()=>reject(
 f=>{f.financePacket.allow_real_commerce=true},
 'separate_scoped_approvals_not_expansion_to_public',true));
test('20 automatic deployment forbidden',()=>reject(
 f=>{f.financePacket.allow_automatic_deployment=true},
 'separate_scoped_approvals_not_expansion_to_public',true));
test('21 nonzero public requests before Access forbidden',()=>reject(
 f=>{f.financePacket.max_public_requests_before_access=1},
 'separate_scoped_approvals_not_expansion_to_public',true));
test('22 protected existing Worker mutation forbidden',()=>reject(
 f=>{f.financePacket.allow_existing_worker_mutation=true},
 'separate_scoped_approvals_not_expansion_to_public',true));
test('23 protected namespace mutation forbidden',()=>reject(
 f=>{f.financePacket.allow_existing_namespace_mutation=true},
 'separate_scoped_approvals_not_expansion_to_public',true));
test('24 ledger provisioning needs separate approval',()=>reject(
 f=>{f.financePacket.allow_new_private_ledger_first_upload=false},
 'separate_scoped_approvals_not_expansion_to_public',true));
test('25 fake legacy inventory collision with another target blocks',()=>reject(f=>{
 f.ownerEvidence.inventoryEvidence.inventory.worker_names.push(LEDGER);
 f.ownerEvidence.inventoryEvidence.inventory.script_names.push(LEDGER);
 f.ownerEvidence.inventoryEvidence.inventory.page_verification.total_workers++;
 f.ownerEvidence.inventoryEvidence.inventory.page_verification.total_scripts++;
},'no_qa_worker_or_ledger_collision'));
test('26 stale Cloudflare inventory blocks',()=>reject(f=>{
 f.ownerEvidence.inventoryEvidence.inventory.collected_at_ms=NOW-300001;
},'complete_recent_cloudflare_snapshot'));
test('27 absent V17.5 script blocks',()=>reject(f=>{
 f.ownerEvidence.inventoryEvidence.inventory.script_names=
 f.ownerEvidence.inventoryEvidence.inventory.script_names.filter(x=>x!==PROTECTED_V175_RESOURCES.scripts[0]);
},'protected_parallel_v175_resources_present'));
test('28 wrong Cloudflare account signed finance packet blocks',()=>reject(
 f=>{f.financePacket.account_id='bad-account'},
 'exact_first_inactive_ledger_and_worker_scope',true));
test('29 signed changed source commit cannot bypass immutable owner permit',()=>reject(
 f=>{f.financePacket.source_git_sha='f'.repeat(40)},
 'exact_owner_permit_and_git_source_binding',true));
test('30 wrong permit digest blocks',()=>reject(
 f=>{f.financePacket.owner_permit_digest='f'.repeat(64)},
 'exact_owner_permit_and_git_source_binding',true));
test('31 expired finance attestation blocks',()=>reject(
 f=>{f.financePacket.expires_at=new Date(NOW-1).toISOString()},
 'signed_finance_packet_fresh_and_one_time',true));
test('32 >15-minute finance approval invalid even re-signed',()=>reject(
 f=>{f.financePacket.expires_at=new Date(NOW+16*60000).toISOString()},
 'signed_finance_packet_fresh_and_one_time',true));
test('33 unregistered independent finance attestation blocks',()=>reject(f=>{
 f.privateRegistry.finance_identity_out_of_band_verified=false;
},'independent_finance_and_ledger_security_registry'));
test('34 independent ledger security signer missing private attestation blocks',()=>reject(f=>{
 f.privateRegistry.ledger_security_identity_out_of_band_verified=false;
},'independent_finance_and_ledger_security_registry'));
test('35 finance signer must not impersonate owner',()=>reject(f=>{
 f.financeTrust.finance.key_id=f.ownerEvidence.trustAnchors.owner.key_id;
},'finance_and_owner_are_distinct_principals'));
test('36 operator JWT without MFA blocks even valid finance signatures',()=>reject(f=>{
 f.operatorJwt=brokerToken(f.ownerEvidence.permit,{amr:['password']});
},'operator_broker_signed_mfa_exact_permit_math'));
test('37 missing finance cost review rejects',()=>reject(f=>{
 f.privateRegistry.independent_finance_cost_window_review=false;
},'two_separate_positive_budgets_and_combined_max_25'));
test('38 no rollback operator review rejects',()=>reject(f=>{
 f.privateRegistry.independent_rollback_plan_reviewed=false;
},'hosted_ledger_control_plane_and_operator_provenance'));
test('39 missing least privilege CF identity review rejects',()=>reject(f=>{
 f.privateRegistry.cloudflare_rbac_least_privilege_verified_privately=false;
},'hosted_ledger_control_plane_and_operator_provenance'));
test('40 extra unknown field cannot hide privileges',()=>reject(f=>{
 f.financePacket.allow_cron_job=true;
},'strict_finance_packet_fields',true));
