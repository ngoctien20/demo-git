import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign as edSign} from 'node:crypto';
import {ACCOUNT,LEDGER,WORKER} from './hosted4b4-independent-finance-ledger-gate.mjs';
import {assessIndependentHostedAdmission,CONTRACT,API,PRIVATE,digest}
 from './hosted4b9-broker-finance-alternative-review.mjs';
const NOW=Date.parse('2026-11-17T12:32:00.000Z');
const roles=['finance','auditor','security','operator'];
const keypairs=Object.fromEntries(roles.map(r=>[r,generateKeyPairSync('ed25519')]));
const canonical=x=>Array.isArray(x)?'['+x.map(canonical).join(',')+']':
 x!==null&&typeof x==='object'?
 '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}':
 JSON.stringify(x);
const sig=(data,role,purpose)=>({
 key_id:'qa-synthetic-'+role+'-key',
 signature:edSign(null,Buffer.from('T404_V174P_4B9:'+purpose+'\n'+canonical(data)),
 keypairs[role].privateKey).toString('base64url')
});
const list=x=>({status:'COMPLETE',count:x.length,total_count:x.length,entries:x});
function makeFixture(mode=PRIVATE){
 const workers=[
 'tien404-rpc16-merchant-evidence-inactive-staging',
 'tien404-v1721h2-zalo-replay-private-nosend-staging',
 'tien404-v175e1-private-issuer-nosend-staging',
 'tien404-v175e2-ab-gateway-nosend-staging',
 'tien404-v175e2a-private-hosted-runner-nosend-staging',
 'tien404-v175e2-durable-replay-nosend-staging',
 'tien404-v175e2-installation-registry-nosend-staging',
 ...Array.from({length:23},(_,i)=>'unrelated-synthetic-'+i)
 ].sort();
 const ns=[
 {name:'tien404-v175e2-durable-replay-nosend-staging_ReplayBucket',script:'tien404-v175e2-durable-replay-nosend-staging',class:'ReplayBucket'},
 {name:'tien404-v175e2a-private-hosted-runner-nosend-staging_RunnerResults',script:'tien404-v175e2a-private-hosted-runner-nosend-staging',class:'RunnerResults'},
 {name:'tien404-v1721h2-zalo-replay-private-nosend-staging_ZaloBotReplayBucketV2',script:'tien404-v1721h2-zalo-replay-private-nosend-staging',class:'ZaloBotReplayBucketV2'}
 ];
 const cloudflareSnapshot={
  account_id:ACCOUNT,capture_time_ms:NOW-15000,
  source:'CLOUDFLARE_READ_ONLY_CONTROL_PLANE',methods_used:['GET'],
  workers:list(workers),scripts:list(workers.slice()),
  durable_objects:list(ns),
  access_apps:list(['TIEN404 RPC16 Merchant Evidence Staging — DENY ALL',
   'tien404-ai-git-staging - Cloudflare Pages']),
  members:list([{member_ref_hash:'1'.repeat(64),status:'accepted',
    role_names:['Super Administrator - All Privileges']}])
 };
 const brokerReadiness={
  contract:CONTRACT,status:'READINESS_SPEC_NOT_HOSTED',account_id:ACCOUNT,
  access_ingress:'REQUIRES_INDEPENDENT_CLOUDFLARE_ACCESS',
  public_hostname_enabled:false,public_dev_url_enabled:false,
  preview_enabled:false,credentials_in_repo:false,
  private_idp_status:'NOT_PROVISIONED',owner_mfa_status:'NOT_VERIFIED',
  finance_mfa_status:'NOT_VERIFIED',revocation_check_status:'NOT_PROVISIONED',
  out_of_band_root_status:'NOT_INSTALLED',audit_ledger_status:'NOT_DEPLOYED',
  file_scan_contract_status:'SPEC_ONLY',private_storage_status:'NOT_PROVISIONED',
  trusted_live_identity_bindings:false,real_hosted_uat_complete:false
 };
 const financeReceipt={
  contract:CONTRACT,mode,account_id:ACCOUNT,
  phase:'LEDGER_FIRST_INACTIVE_UPLOAD',target_worker:LEDGER,
  finance_subject_hash:'2'.repeat(64),auditor_subject_hash:'3'.repeat(64),
  owner_delegation_sha256:'4'.repeat(64),
  billing_period_id:'2026-11-staging',
  ledger_budget_usd:2,qa_worker_budget_usd:3,
  cost_exposure_acknowledged:true,do_storage_exclusion_acknowledged:true,
  hard_cost_cap_guaranteed:false,
  private_ref:mode===PRIVATE?'EV-restricted-finance-receipt-001':null,
  private_source_evidence_sha256:'5'.repeat(64),
  source_readonly_http_status:mode===PRIVATE?403:200,
  private_scan_status:mode===PRIVATE?'PRIVATE_SCANNER_PASSED':'NOT_APPLICABLE',
  private_redaction_status:mode===PRIVATE?'PRIVATE_REVIEW_REDACTED':'NOT_APPLICABLE',
  issued_at:new Date(NOW-30000).toISOString(),
  expires_at:new Date(NOW+120000).toISOString(),
  nonce:'6'.repeat(64)
 };
 const independentReview={
  contract:CONTRACT,account_id:ACCOUNT,phase:'LEDGER_FIRST_INACTIVE_UPLOAD',
  target_worker:LEDGER,repo_commit_sha:'8d669d152ed8df1c47b2bf2b52256f770948f8fc',
  target_manifest_sha256:'7'.repeat(64),
  cloudflare_snapshot_sha256:digest(cloudflareSnapshot),
  owner_delegation_sha256:financeReceipt.owner_delegation_sha256,
  finance_receipt_sha256:digest(financeReceipt),
  broker_readiness_sha256:digest(brokerReadiness),
  security_reviewer_subject_hash:'8'.repeat(64),
  operator_subject_hash:'9'.repeat(64),
  nonce:'a'.repeat(64),
  issued_at:new Date(NOW-5000).toISOString(),
  expires_at:new Date(NOW+60000).toISOString(),
  no_public_url:true,no_customer_writes:true,no_provider_sends:true,
  no_billing_change:true,no_access_change:true,no_resource_creation:true,
  approval_mode:'READ_ONLY_REVIEW_NOT_UPLOAD'
 };
 const f={financeReceipt,brokerReadiness,independentReview,cloudflareSnapshot,
  trustRoots:Object.fromEntries(roles.map(role=>[role,{
    role,registered_source:'INDEPENDENT_PRIVATE_REGISTRY',
    key_id:'qa-synthetic-'+role+'-key',
    spki_pem:keypairs[role].publicKey.export({format:'pem',type:'spki'})
  }])),signatures:{},now:NOW};
 resign(f);return f;
}
function resign(f){
 f.signatures={
  finance:sig(f.financeReceipt,'finance','FINANCE_EVIDENCE_RECEIPT'),
  auditor:sig(f.financeReceipt,'auditor','INDEPENDENT_FINANCE_AUDIT'),
  security:sig(f.independentReview,'security','SECURITY_HOSTED_NO_GO_REVIEW'),
  operator:sig(f.independentReview,'operator','OPERATOR_NO_DEPLOY_REVIEW')
 };
}
function fail(change,reason,resigned=false,mode=PRIVATE){
 const f=makeFixture(mode);
 change(f);if(resigned)resign(f);
 const result=assessIndependentHostedAdmission(f);
 assert.equal(result.decision,'BLOCKED',JSON.stringify(result.reasons));
 assert(result.reasons.includes(reason),JSON.stringify(result.reasons));
 assert.equal(result.can_create_ledger,false);
 assert.equal(result.can_upload_qa_worker,false);
 assert.equal(result.can_upload_document,false);
 assert.equal(result.mutations_executed,false);
}
test('01 synthetic private Finance alternative mathematically consistent is STILL hosted NO GO',()=>{
 const r=assessIndependentHostedAdmission(makeFixture());
 assert.deepEqual(r.reasons,[]);
 assert.equal(r.decision,'CRYPTOGRAPHIC_MATH_ONLY_HOSTED_NOT_AUTHORIZED');
 assert.equal(r.assessed_finance_mode,PRIVATE);
 assert.equal(r.finance_receipt_real_provenance_verified,false);
 assert.equal(r.can_create_ledger,false);
});
test('02 synthetic billing API success mathematically consistent not a Finance GO',()=>{
 const r=assessIndependentHostedAdmission(makeFixture(API));
 assert.deepEqual(r.reasons,[]);
 assert.equal(r.assessed_finance_mode,API);
 assert.equal(r.can_create_ledger,false);
 assert.equal(r.independent_live_identity_verified,false);
});
test('03 no information blocks',()=>{
 const r=assessIndependentHostedAdmission({now:NOW});
 assert.equal(r.decision,'BLOCKED');assert(r.reasons.length>6);
});
test('04 actual billing 403 must NOT be disguised as API 200',()=>fail(f=>{
 f.financeReceipt.mode=API;
},'api_or_private_alternative_specific_constraints',true));
test('05 private document alternative requires 403 status distinct from API',()=>fail(f=>{
 f.financeReceipt.source_readonly_http_status=200;
},'api_or_private_alternative_specific_constraints',true));
test('06 alternate private receipt requires restricted opaque ref',()=>fail(f=>{
 f.financeReceipt.private_ref=null;
},'api_or_private_alternative_specific_constraints',true));
test('07 direct URL cannot be supplied as evidence ref',()=>fail(f=>{
 f.financeReceipt.private_ref='https://evil.invalid/finance';
},'api_or_private_alternative_specific_constraints',true));
test('08 traversal in evidence reference rejected',()=>fail(f=>{
 f.financeReceipt.private_ref='../../private-invoices';
},'api_or_private_alternative_specific_constraints',true));
test('09 extra raw invoice bytes forbidden in metadata schema',()=>fail(f=>{
 f.financeReceipt.invoice_pdf='raw-attachment';
},'strict_finance_metadata_no_raw_files',true));
test('10 extra credential field forbidden in broker readiness',()=>fail(f=>{
 f.brokerReadiness.api_token='fake-secret';
},'strict_source_only_private_broker_readiness',true));
test('11 private scanner not confirmed => reject',()=>fail(f=>{
 f.financeReceipt.private_scan_status='UNKNOWN';
},'api_or_private_alternative_specific_constraints',true));
test('12 finance private review not redacted => reject',()=>fail(f=>{
 f.financeReceipt.private_redaction_status='NOT_REDACTED';
},'api_or_private_alternative_specific_constraints',true));
test('13 owner delegation hash missing => reject',()=>fail(f=>{
 f.financeReceipt.owner_delegation_sha256=null;
},'one_of_two_declared_finance_evidence_paths',true));
test('14 owner delegation mismatches review => reject',()=>fail(f=>{
 f.independentReview.owner_delegation_sha256='e'.repeat(64);
},'independent_review_enforces_no_deploy',true));
test('15 signed finance receipt digest mismatch => reject',()=>fail(f=>{
 f.independentReview.finance_receipt_sha256='e'.repeat(64);
},'independent_review_enforces_no_deploy',true));
test('16 same auditor and finance principal forbidden',()=>fail(f=>{
 f.financeReceipt.auditor_subject_hash=f.financeReceipt.finance_subject_hash;
},'one_of_two_declared_finance_evidence_paths',true));
test('17 Finance signature missing => deny',()=>fail(f=>{
 delete f.signatures.finance;
},'four_independent_pre_registered_crypto_keys'));
test('18 independent Auditor signature missing => deny',()=>fail(f=>{
 delete f.signatures.auditor;
},'finance_and_independent_auditor_sign_same_receipt'));
test('19 fake finance signature byte denied',()=>fail(f=>{
 const a=f.signatures.finance.signature;
 f.signatures.finance.signature=(a[0]==='A'?'B':'A')+a.slice(1);
},'finance_and_independent_auditor_sign_same_receipt'));
test('20 public key alias points to same material => reject',()=>fail(f=>{
 f.trustRoots.auditor.spki_pem=f.trustRoots.finance.spki_pem;
},'four_independent_pre_registered_crypto_keys'));
test('21 test root not independently registered => reject',()=>fail(f=>{
 f.trustRoots.finance.registered_source='CALLER_SUPPLIED';
},'four_independent_pre_registered_crypto_keys'));
test('22 Security signature omitted => deny',()=>fail(f=>{
 delete f.signatures.security;
},'four_independent_pre_registered_crypto_keys'));
test('23 Operator consent signature omitted => deny',()=>fail(f=>{
 delete f.signatures.operator;
},'security_and_operator_sign_no_deploy_review'));
test('24 reusing Finance signature for Security cannot work',()=>fail(f=>{
 f.signatures.security=f.signatures.finance;
},'security_and_operator_sign_no_deploy_review'));
test('25 no broker ingress can be made public',()=>fail(f=>{
 f.brokerReadiness.public_dev_url_enabled=true;
},'strict_source_only_private_broker_readiness',true));
test('26 real hosted UAT cannot be self-asserted from source JSON',()=>fail(f=>{
 f.brokerReadiness.real_hosted_uat_complete=true;
},'strict_source_only_private_broker_readiness',true));
test('27 MFA status NOT_VERIFIED may not be forged in repo',()=>fail(f=>{
 f.brokerReadiness.finance_mfa_status='VERIFIED';
},'strict_source_only_private_broker_readiness',true));
test('28 private registry root cannot claim INSTALLED via fixture',()=>fail(f=>{
 f.brokerReadiness.out_of_band_root_status='INSTALLED';
},'strict_source_only_private_broker_readiness',true));
test('29 none of the hosted ingress may be silently enabled',()=>fail(f=>{
 f.brokerReadiness.public_hostname_enabled=true;
},'strict_source_only_private_broker_readiness',true));
test('30 budget sum over synthetic policy denied',()=>fail(f=>{
 f.financeReceipt.ledger_budget_usd=24;
},'signed_budget_and_storage_exposure_not_hard_cap',true));
test('31 budget zero denied',()=>fail(f=>{
 f.financeReceipt.qa_worker_budget_usd=0;
},'signed_budget_and_storage_exposure_not_hard_cap',true));
test('32 absolute hard cost cap falsely guaranteed rejected',()=>fail(f=>{
 f.financeReceipt.hard_cost_cap_guaranteed=true;
},'signed_budget_and_storage_exposure_not_hard_cap',true));
test('33 DO stored-data exposure must be acknowledged',()=>fail(f=>{
 f.financeReceipt.do_storage_exclusion_acknowledged=false;
},'signed_budget_and_storage_exposure_not_hard_cap',true));
test('34 Finance budget cannot be old',()=>fail(f=>{
 f.financeReceipt.expires_at=new Date(NOW-1000).toISOString();
},'fresh_finance_receipt_and_nonce',true));
test('35 duplicate use of finance nonce as security review nonce denied',()=>fail(f=>{
 f.independentReview.nonce=f.financeReceipt.nonce;
},'independent_review_enforces_no_deploy',true));
test('36 wrong QA Worker target denied for ledger first',()=>fail(f=>{
 f.financeReceipt.target_worker=WORKER;
},'one_of_two_declared_finance_evidence_paths',true));
test('37 review cannot expand into actual ledger creation',()=>fail(f=>{
 f.independentReview.no_resource_creation=false;
},'independent_review_enforces_no_deploy',true));
test('38 signed Access modification denied',()=>fail(f=>{
 f.independentReview.no_access_change=false;
},'independent_review_enforces_no_deploy',true));
test('39 signed provider send denied',()=>fail(f=>{
 f.independentReview.no_provider_sends=false;
},'independent_review_enforces_no_deploy',true));
test('40 partial Worker page count denied',()=>fail(f=>{
 f.cloudflareSnapshot.workers.total_count=40;
 f.independentReview.cloudflare_snapshot_sha256=digest(f.cloudflareSnapshot);
},'current_read_only_control_plane_inventory',true));
test('41 stale live Cloudflare inventory denied',()=>fail(f=>{
 f.cloudflareSnapshot.capture_time_ms=NOW-60001;
 f.independentReview.cloudflare_snapshot_sha256=digest(f.cloudflareSnapshot);
},'current_read_only_control_plane_inventory',true));
test('42 modifying protected Zalo DO class denied',()=>fail(f=>{
 f.cloudflareSnapshot.durable_objects.entries[2].class='OtherClass';
 f.independentReview.cloudflare_snapshot_sha256=digest(f.cloudflareSnapshot);
},'no_target_name_collision_and_preserve_protected_namespaces',true));
test('43 existing Worker ledger collision blocks release review',()=>fail(f=>{
 f.cloudflareSnapshot.workers.entries[0]=LEDGER;
 f.cloudflareSnapshot.scripts.entries[0]=LEDGER;
 f.independentReview.cloudflare_snapshot_sha256=digest(f.cloudflareSnapshot);
},'no_target_name_collision_and_preserve_protected_namespaces',true));
test('44 forged read-only HTTP PATCH disallowed',()=>fail(f=>{
 f.cloudflareSnapshot.methods_used=['GET','PATCH'];
 f.independentReview.cloudflare_snapshot_sha256=digest(f.cloudflareSnapshot);
},'current_read_only_control_plane_inventory',true));
test('45 approval nonce must not allow public URL',()=>fail(f=>{
 f.independentReview.no_public_url=false;
},'independent_review_enforces_no_deploy',true));
test('46 no synthetic positive branch may grant hosted, secrets, or provider sends',()=>{
 for(const mode of [API,PRIVATE]){
  const r=assessIndependentHostedAdmission(makeFixture(mode));
  assert.equal(r.can_create_ledger,false);
  assert.equal(r.can_upload_document,false);
  assert.equal(r.can_send_provider_messages,false);
  assert.equal(r.private_intake_hosted_uat_passed,false);
  assert.equal(r.mutations_executed,false);
 }
});
