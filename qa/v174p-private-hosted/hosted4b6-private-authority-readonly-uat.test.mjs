import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign as edSign} from 'node:crypto';
import {assessHostedNoDeployAuthority,CONTRACT,digest} from './hosted4b6-private-authority-readonly-uat.mjs';
import {ACCOUNT,LEDGER,WORKER} from './hosted4b4-independent-finance-ledger-gate.mjs';

const NOW=Date.parse('2026-11-17T11:47:00.000Z');
const key=generateKeyPairSync('ed25519');
const domain='T404_V174P_4B6_OUT_OF_BAND_AUTHORITY_BINDING\n';
const canonical=x=>Array.isArray(x)?'['+x.map(canonical).join(',')+']':
 x!==null&&typeof x==='object'?
  '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}':
 JSON.stringify(x);
function sign(f){
 f.witness={key_id:'synthetic-private-audit-root',
  signature:edSign(null,Buffer.from(domain+canonical(f.authorityBinding)),key.privateKey).toString('base64url')};
}
function fixture(){
 const names=[
  'tien404-rpc16-merchant-evidence-inactive-staging',
  'tien404-v1721h2-zalo-replay-private-nosend-staging',
  'tien404-v175e1-private-issuer-nosend-staging',
  'tien404-v175e2-ab-gateway-nosend-staging',
  'tien404-v175e2a-private-hosted-runner-nosend-staging',
  'tien404-v175e2-durable-replay-nosend-staging',
  'tien404-v175e2-installation-registry-nosend-staging',
  ...Array.from({length:23},(_,i)=>'other-worker-'+i)
 ].sort();
 const namespaces=[
  {name:'tien404-v175e2-durable-replay-nosend-staging_ReplayBucket',
   script:'tien404-v175e2-durable-replay-nosend-staging',class:'ReplayBucket'},
  {name:'tien404-v175e2a-private-hosted-runner-nosend-staging_RunnerResults',
   script:'tien404-v175e2a-private-hosted-runner-nosend-staging',class:'RunnerResults'},
  {name:'tien404-v1721h2-zalo-replay-private-nosend-staging_ZaloBotReplayBucketV2',
   script:'tien404-v1721h2-zalo-replay-private-nosend-staging',class:'ZaloBotReplayBucketV2'}
 ];
 const getList=x=>({status:'COMPLETE',count:x.length,total_count:x.length,entries:x});
 const cloudflareSnapshot={
  account_id:ACCOUNT,capture_time_ms:NOW-10000,
  source:'CLOUDFLARE_READ_ONLY_CONTROL_PLANE',methods_used:['GET'],
  workers:getList(names),scripts:getList([...names]),
  durable_objects:getList(namespaces),
  access_apps:getList([
   'TIEN404 RPC16 Merchant Evidence Staging — DENY ALL',
   'tien404-ai-git-staging - Cloudflare Pages'
  ]),
  access_policies:getList([]),
  members:getList([{member_ref_hash:'1'.repeat(64),status:'accepted',
   role_names:['Super Administrator - All Privileges']}]),
  billing_spend_policies:{status:'READ_ONLY_VERIFIED'}
 };
 const authorityBinding={
  contract:CONTRACT,account_id:ACCOUNT,phase:'LEDGER_FIRST_INACTIVE_UPLOAD',
  cloudflare_snapshot_sha256:digest(cloudflareSnapshot),
  owner_member_ref_hash:'1'.repeat(64),
  owner_subject_hash:'2'.repeat(64),finance_subject_hash:'3'.repeat(64),
  operator_subject_hash:'4'.repeat(64),rollback_subject_hash:'5'.repeat(64),
  finance_qa_worker_budget_usd:3,finance_ledger_budget_usd:2,
  approved_owner_permit_sha256:'6'.repeat(64),
  approved_finance_packet_sha256:'7'.repeat(64),
  authorized_actor_registry_sha256:'8'.repeat(64),
  signed_at:new Date(NOW-1000).toISOString(),
  expires_at:new Date(NOW+300000).toISOString(),nonce:'9'.repeat(32),
  read_only_only:true,allow_resource_create:false,
  allow_access_policy_change:false,allow_billing_limit_change:false,
  allow_real_commerce:false
 };
 const f={
  cloudflareSnapshot,authorityBinding,
  pinnedPrivateRoot:{source:'INDEPENDENT_PRIVATE_TRUST_ROOT',
   key_id:'synthetic-private-audit-root',spki_pem:key.publicKey.export({format:'pem',type:'spki'})},
  independentlyVerifiedDossierDigest:'a'.repeat(64),now:NOW
 };
 sign(f);
 return f;
}
function blocked(m,code,resign=false){
 const f=fixture();m(f);if(resign)sign(f);
 const r=assessHostedNoDeployAuthority(f);
 assert.equal(r.decision,'BLOCKED',JSON.stringify(r.reasons));
 assert(r.reasons.includes(code),JSON.stringify(r.reasons));
 assert.equal(r.can_provision_ledger,false);
 assert.equal(r.can_upload_qa_worker,false);
 assert.equal(r.can_deploy,false);
 assert.equal(r.mutations_executed,false);
}
test('01 synthetic signed root and complete Cloudflare snapshot consistent ONLY mathematically, still no hosted rights',()=>{
 const r=assessHostedNoDeployAuthority(fixture());
 assert.deepEqual(r.reasons,[]);
 assert.equal(r.decision,'SIGNED_READONLY_EVIDENCE_CONSISTENT_NOT_REAL_AUTHORITY');
 assert.equal(r.real_owner_verified,false);
 assert.equal(r.real_finance_verified,false);
 assert.equal(r.can_run_hosted_private_intake_uat,false);
});
test('02 empty packet blocks',()=>{
 const r=assessHostedNoDeployAuthority({now:NOW});
 assert.equal(r.decision,'BLOCKED');
 assert(r.reasons.length>=12);
});
test('03 real observed Cloudflare billing API forbidden => fail closed even if other synthetic keys valid',()=>blocked(f=>{
 f.cloudflareSnapshot.billing_spend_policies.status='FORBIDDEN';
 f.authorityBinding.cloudflare_snapshot_sha256=digest(f.cloudflareSnapshot);
},'independently_observable_cloudflare_spend_controls',true));
test('04 no signed private root cannot pass',()=>blocked(f=>{
 f.pinnedPrivateRoot=null;
},'independent_pinned_authority_root_signature_math'));
test('05 forged signed authority signature blocked',()=>blocked(f=>{
 const a=f.witness.signature;
 f.witness.signature=(a[0]==='A'?'B':'A')+a.slice(1);
},'independent_pinned_authority_root_signature_math'));
test('06 different public key fails',()=>blocked(f=>{
 f.pinnedPrivateRoot.spki_pem=generateKeyPairSync('ed25519').publicKey.export({format:'pem',type:'spki'});
},'independent_pinned_authority_root_signature_math'));
test('07 wrong root source denied',()=>blocked(f=>{
 f.pinnedPrivateRoot.source='USER_SUPPLIED';
},'independent_pinned_authority_root_signature_math'));
test('08 unsigned budget increase rejected',()=>blocked(f=>{
 f.authorityBinding.finance_ledger_budget_usd=20;
},'independent_pinned_authority_root_signature_math'));
test('09 even newly signed excessive budget denied',()=>blocked(f=>{
 f.authorityBinding.finance_ledger_budget_usd=23;
},'finance_amounts_strict_and_separately_allocated',true));
test('10 finance and owner identical subject denied',()=>blocked(f=>{
 f.authorityBinding.finance_subject_hash=f.authorityBinding.owner_subject_hash;
},'independent_real_authority_subjects_declared_and_distinct',true));
test('11 rollback and operator same subject denied',()=>blocked(f=>{
 f.authorityBinding.rollback_subject_hash=f.authorityBinding.operator_subject_hash;
},'independent_real_authority_subjects_declared_and_distinct',true));
test('12 finance missing signed hash denied',()=>blocked(f=>{
 f.authorityBinding.approved_finance_packet_sha256=null;
},'owner_finance_registry_and_dossier_pinned',true));
test('13 unsigned dossier missing denied',()=>blocked(f=>{
 f.independentlyVerifiedDossierDigest=null;
},'owner_finance_registry_and_dossier_pinned'));
test('14 stale Cloudflare GET (>60s) denied even if signed',()=>blocked(f=>{
 f.cloudflareSnapshot.capture_time_ms=NOW-60001;
 f.authorityBinding.cloudflare_snapshot_sha256=digest(f.cloudflareSnapshot);
},'snapshot_fresh_60s',true));
test('15 future Cloudflare snapshot rejected',()=>blocked(f=>{
 f.cloudflareSnapshot.capture_time_ms=NOW+1000;
 f.authorityBinding.cloudflare_snapshot_sha256=digest(f.cloudflareSnapshot);
},'snapshot_fresh_60s',true));
test('16 write method PATCH forbidden',()=>blocked(f=>{
 f.cloudflareSnapshot.methods_used=['GET','PATCH'];
 f.authorityBinding.cloudflare_snapshot_sha256=digest(f.cloudflareSnapshot);
},'account_bound_and_get_only',true));
test('17 wrong account rejected',()=>blocked(f=>{
 f.cloudflareSnapshot.account_id='another-account';
 f.authorityBinding.cloudflare_snapshot_sha256=digest(f.cloudflareSnapshot);
},'account_bound_and_get_only',true));
test('18 missing worker page fails complete pagination',()=>blocked(f=>{
 f.cloudflareSnapshot.workers.total_count=31;
 f.authorityBinding.cloudflare_snapshot_sha256=digest(f.cloudflareSnapshot);
},'full_paginated_workers',true));
test('19 missing member page fails',()=>blocked(f=>{
 f.cloudflareSnapshot.members.total_count=2;
 f.authorityBinding.cloudflare_snapshot_sha256=digest(f.cloudflareSnapshot);
},'full_paginated_members',true));
test('20 duplicate worker names fails even if count re-signed',()=>blocked(f=>{
 const a=f.cloudflareSnapshot.workers.entries;
 a[0]=a[1];
 f.authorityBinding.cloudflare_snapshot_sha256=digest(f.cloudflareSnapshot);
},'distinct_worker_and_script_names_no_target_collision',true));
test('21 malicious new QA Worker collision fails',()=>blocked(f=>{
 f.cloudflareSnapshot.workers.entries[0]=WORKER;
 f.cloudflareSnapshot.scripts.entries[0]=WORKER;
 f.authorityBinding.cloudflare_snapshot_sha256=digest(f.cloudflareSnapshot);
},'distinct_worker_and_script_names_no_target_collision',true));
test('22 malicious new private-ledger collision fails',()=>blocked(f=>{
 f.cloudflareSnapshot.workers.entries[0]=LEDGER;
 f.cloudflareSnapshot.scripts.entries[0]=LEDGER;
 f.authorityBinding.cloudflare_snapshot_sha256=digest(f.cloudflareSnapshot);
},'distinct_worker_and_script_names_no_target_collision',true));
test('23 removal V17.5 existing Durable Object fails',()=>blocked(f=>{
 f.cloudflareSnapshot.durable_objects.entries.shift();
 f.cloudflareSnapshot.durable_objects.count--;
 f.cloudflareSnapshot.durable_objects.total_count--;
 f.authorityBinding.cloudflare_snapshot_sha256=digest(f.cloudflareSnapshot);
},'existing_do_namespace_integrity',true));
test('24 unexpected new namespace owned by V17.4P fails',()=>blocked(f=>{
 f.cloudflareSnapshot.durable_objects.entries.push({
  name:LEDGER+'_V174PPermitLedger',script:LEDGER,class:'V174PPermitLedger'
 });
 f.cloudflareSnapshot.durable_objects.count++;
 f.cloudflareSnapshot.durable_objects.total_count++;
 f.authorityBinding.cloudflare_snapshot_sha256=digest(f.cloudflareSnapshot);
},'existing_do_namespace_integrity',true));
test('25 worker and script count different fails',()=>blocked(f=>{
 f.cloudflareSnapshot.scripts.entries.pop();
 f.cloudflareSnapshot.scripts.count--;
 f.cloudflareSnapshot.scripts.total_count--;
 f.authorityBinding.cloudflare_snapshot_sha256=digest(f.cloudflareSnapshot);
},'distinct_worker_and_script_names_no_target_collision',true));
test('26 superadmin role absent cannot be inferred from plugin connection',()=>blocked(f=>{
 f.cloudflareSnapshot.members.entries[0].role_names=['Billing Read'];
 f.authorityBinding.cloudflare_snapshot_sha256=digest(f.cloudflareSnapshot);
},'strict_owner_member_role_mapping_not_whoami',true));
test('27 no members => absent separate real owner evidence',()=>blocked(f=>{
 f.cloudflareSnapshot.members.entries=[];
 f.cloudflareSnapshot.members.count=0;
 f.cloudflareSnapshot.members.total_count=0;
 f.authorityBinding.cloudflare_snapshot_sha256=digest(f.cloudflareSnapshot);
},'strict_owner_member_role_mapping_not_whoami',true));
test('28 wrong owner member hash cannot forge account linkage',()=>blocked(f=>{
 f.authorityBinding.owner_member_ref_hash='e'.repeat(64);
},'strict_owner_member_role_mapping_not_whoami',true));
test('29 billing scope evidence cannot be replaced by user field',()=>blocked(f=>{
 f.cloudflareSnapshot.billing_spend_policies={status:'READ_ONLY_VERIFIED',approved_by:'owner'};
 f.authorityBinding.cloudflare_snapshot_sha256=digest(f.cloudflareSnapshot);
},'independently_observable_cloudflare_spend_controls',true));
test('30 stale authority approval signature window fails',()=>blocked(f=>{
 f.authorityBinding.expires_at=new Date(NOW-1).toISOString();
},'fresh_signed_authorization_window',true));
test('31 missing consent nonce fails even re-signed',()=>blocked(f=>{
 f.authorityBinding.nonce='';
},'fresh_signed_authorization_window',true));
test('32 signed resource creation true is still forbidden',()=>blocked(f=>{
 f.authorityBinding.allow_resource_create=true;
},'same_account_ledger_first_readonly',true));
test('33 signed Access policy change true forbidden',()=>blocked(f=>{
 f.authorityBinding.allow_access_policy_change=true;
},'same_account_ledger_first_readonly',true));
test('34 signed Billing spend limit change true forbidden',()=>blocked(f=>{
 f.authorityBinding.allow_billing_limit_change=true;
},'same_account_ledger_first_readonly',true));
test('35 signed Commerce write true forbidden',()=>blocked(f=>{
 f.authorityBinding.allow_real_commerce=true;
},'same_account_ledger_first_readonly',true));
test('36 extra field containing a dangerous URL rejected',()=>blocked(f=>{
 f.authorityBinding.external_verification_url='https://evil.example/upload';
},'exact_authority_binding_fields',true));
test('37 forged role/member email field rejected from privacy-safe snapshot',()=>blocked(f=>{
 f.cloudflareSnapshot.members.entries[0].email='do-not-commit@example.com';
 f.authorityBinding.cloudflare_snapshot_sha256=digest(f.cloudflareSnapshot);
},'complete_member_roster_no_personal_data',true));
test('38 superadmin member role accepted does NOT imply independent finance or permit in any output',()=>{
 const result=assessHostedNoDeployAuthority(fixture());
 assert.equal(result.cloudflare_member_count_observed,1);
 assert.equal(result.real_finance_verified,false);
 assert.equal(result.can_provision_ledger,false);
});
