import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign as edSign} from 'node:crypto';
import {assessPrivateOwnerFinanceConsent,CONTRACT,digest} from './hosted4b7-independent-owner-finance-consent.mjs';
import {digest as digest4b6} from './hosted4b6-private-authority-readonly-uat.mjs';
import {ACCOUNT,LEDGER,WORKER} from './hosted4b4-independent-finance-ledger-gate.mjs';
const NOW=Date.parse('2026-11-17T12:00:00.000Z');
const keys=Object.fromEntries(['broker','owner','finance'].map(x=>[x,generateKeyPairSync('ed25519')]));
const canon=x=>Array.isArray(x)?'['+x.map(canon).join(',')+']':
 x!==null&&typeof x==='object'?
 '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canon(x[k])).join(',')+'}':
 JSON.stringify(x);
const sign=(msg,key,domain)=>({
 key_id:'synthetic-'+key+'-root',
 signature:edSign(null,Buffer.from(domain+canon(msg)),keys[key].privateKey).toString('base64url')
});
const identities=['owner','finance'];
function fixSignatures(f){
 for(const role of identities){
  f.identitySignatures[role]=sign(f.identityReceipts[role],'broker',
    'T404_V174P_4B7_PRIVATE_BROKER_IDENTITY:'+role+'\n');
  f.approvalSignatures[role]=sign(f.bundle,role,
    'T404_V174P_4B7_INDEPENDENT_APPROVAL:'+role+'\n');
 }
}
function fixture(){
 const workerNames=[
  'tien404-rpc16-merchant-evidence-inactive-staging',
  'tien404-v1721h2-zalo-replay-private-nosend-staging',
  'tien404-v175e1-private-issuer-nosend-staging',
  'tien404-v175e2-ab-gateway-nosend-staging',
  'tien404-v175e2a-private-hosted-runner-nosend-staging',
  'tien404-v175e2-durable-replay-nosend-staging',
  'tien404-v175e2-installation-registry-nosend-staging',
  ...Array.from({length:23},(_,i)=>'other-worker-'+i)
 ].sort();
 const list=a=>({status:'COMPLETE',count:a.length,total_count:a.length,entries:a});
 const cloudflareSnapshot={
  account_id:ACCOUNT,source:'CLOUDFLARE_READ_ONLY_CONTROL_PLANE',capture_time_ms:NOW-10000,
  methods_used:['GET'],
  workers:list(workerNames),scripts:list(workerNames.slice()),
  durable_objects:list([
   {name:'tien404-v175e2-durable-replay-nosend-staging_ReplayBucket',
    script:'tien404-v175e2-durable-replay-nosend-staging',class:'ReplayBucket'},
   {name:'tien404-v175e2a-private-hosted-runner-nosend-staging_RunnerResults',
    script:'tien404-v175e2a-private-hosted-runner-nosend-staging',class:'RunnerResults'},
   {name:'tien404-v1721h2-zalo-replay-private-nosend-staging_ZaloBotReplayBucketV2',
    script:'tien404-v1721h2-zalo-replay-private-nosend-staging',class:'ZaloBotReplayBucketV2'}
  ]),
  access_apps:list(['TIEN404 RPC16 Merchant Evidence Staging — DENY ALL',
    'tien404-ai-git-staging - Cloudflare Pages']),
  access_policies:list([]),
  members:list([{member_ref_hash:'1'.repeat(64),status:'accepted',
   role_names:['Super Administrator - All Privileges']}]),
  billing_spend_policies:{status:'READ_ONLY_VERIFIED'}
 };
 const bundle={
  contract:CONTRACT,phase:'LEDGER_FIRST_INACTIVE_UPLOAD',
  account_id:ACCOUNT,worker_name:LEDGER,
  repo_commit_sha:'9f1fb926754de14e364c450410855e5fc19d0cf1',
  worker_manifest_sha256:'a'.repeat(64),
  cloudflare_inventory_sha256:digest4b6(cloudflareSnapshot),
  owner_member_sha256:'1'.repeat(64),owner_subject_sha256:'2'.repeat(64),
  finance_subject_sha256:'3'.repeat(64),operator_subject_sha256:'4'.repeat(64),
  rollback_subject_sha256:'5'.repeat(64),
  owner_permit_sha256:'6'.repeat(64),finance_consent_sha256:'9'.repeat(64),
  evidence_dossier_sha256:'7'.repeat(64),
  source_window_id:'synthetic-window-20261117',
  qa_worker_budget_usd:3,ledger_budget_usd:2,
  nonce:'8'.repeat(32),issued_at:new Date(NOW-1000).toISOString(),
  expires_at:new Date(NOW+240000).toISOString(),
  no_public_routes:true,no_access_changes:true,no_secrets:true,
  no_existing_workers_changed:true,no_billing_changes:true,
  no_provider_sends:true,no_commerce_writes:true,no_automatic_upload:true,
  ack_account_wide_cost_risk:true,ack_do_storage_not_hard_capped:true,
  hard_spend_cap_claimed:false
 };
 const rec=(role)=>({
  contract:'T404_V174P_4B7_BROKER_IDENTITY_RECEIPT_V1',
  role,account_id:ACCOUNT,subject_sha256:bundle[role+'_subject_sha256'],
  member_sha256:role==='owner'?bundle.owner_member_sha256:null,
  audience:'t404:private:hosted-ledger-consent',issuer_id:'INDEPENDENT_PRIVATE_IDP',
  session_id_sha256:role==='owner'?'b'.repeat(64):'c'.repeat(64),
  auth_time:new Date(NOW-15000).toISOString(),
  issued_at:new Date(NOW-12000).toISOString(),
  expires_at:new Date(NOW+90000).toISOString(),
  mfa_method:'phishing_resistant',consent_nonce:bundle.nonce,
  consent_bundle_sha256:digest(bundle),
  identity_evidence_ref:'EV-synthetic-'+role+'-20261117'
 });
 const f={
  bundle,cloudflareSnapshot,
  billingEvidence:{status:'READ_ONLY_VERIFIED',account_id:ACCOUNT,
   captured_at:new Date(NOW-12000).toISOString(),digest_sha256:bundle.finance_consent_sha256},
  identityReceipts:{owner:rec('owner'),finance:rec('finance')},
  identitySignatures:{},approvalSignatures:{},
  trustedRoots:Object.fromEntries(['broker','owner','finance'].map(role=>[role,{
   source:'EXTERNAL_PRIVATE_REGISTERED_TRUST_ROOT',key_id:'synthetic-'+role+'-root',
   spki_pem:keys[role].publicKey.export({format:'pem',type:'spki'})
  }])),now:NOW
 };
 fixSignatures(f);return f;
}
function reject(mut,reason,resign=false){
 const f=fixture();mut(f);if(resign)fixSignatures(f);
 const out=assessPrivateOwnerFinanceConsent(f);
 assert.equal(out.decision,'BLOCKED',JSON.stringify(out.reasons));
 assert(out.reasons.includes(reason),JSON.stringify(out.reasons));
 assert.equal(out.can_provision_ledger,false);
 assert.equal(out.can_upload_qa_worker,false);
 assert.equal(out.can_deploy,false);
 assert.equal(out.mutations_executed,false);
}
test('01 synthetic Owner and Finance broker/consent signatures pass math but never grant actual hosted authority',()=>{
 const a=assessPrivateOwnerFinanceConsent(fixture());
 assert.equal(a.decision,'SIGNED_CONSENT_MATH_CONSISTENT_NOT_REAL_APPROVAL',JSON.stringify(a.reasons));
 assert.deepEqual(a.reasons,[]);
 assert.equal(a.real_owner_identity_verified,false);
 assert.equal(a.real_finance_authority_verified,false);
 assert.equal(a.can_provision_ledger,false);
});
test('02 missing all evidence fails closed',()=>{
 const a=assessPrivateOwnerFinanceConsent({now:NOW});
 assert.equal(a.decision,'BLOCKED');assert(a.reasons.length>=10);
});
test('03 ACTUAL connector billing FORBIDDEN must block even with synthetic consent',()=>reject(f=>{
 f.billingEvidence.status='FORBIDDEN';
},'actual_finance_control_plane_evidence_not_FORBIDDEN'));
test('04 forged broker signature rejected',()=>reject(f=>{
 const s=f.identitySignatures.owner.signature;
 f.identitySignatures.owner.signature=(s[0]==='A'?'B':'A')+s.slice(1);
},'owner_broker_signature'));
test('05 missing broker root rejected',()=>reject(f=>{
 delete f.trustedRoots.broker;
},'independent_registered_keys'));
test('06 user-submitted unregistered root rejected',()=>reject(f=>{
 f.trustedRoots.broker.source='USER_SUPPLIED';
},'independent_registered_keys'));
test('07 owner and finance share one public key under two names rejected',()=>reject(f=>{
 f.trustedRoots.finance.spki_pem=f.trustedRoots.owner.spki_pem;
},'independent_registered_keys'));
test('08 finance signature removed rejected',()=>reject(f=>{
 delete f.approvalSignatures.finance;
},'exact_two_private_identity_and_signature_roles'));
test('09 owner signature removed rejected',()=>reject(f=>{
 delete f.approvalSignatures.owner;
},'exact_two_private_identity_and_signature_roles'));
test('10 owner signed approval tampered rejected',()=>reject(f=>{
 const s=f.approvalSignatures.owner.signature;
 f.approvalSignatures.owner.signature=(s[0]==='A'?'B':'A')+s.slice(1);
},'owner_signed_consent'));
test('11 finance signed approval tampered rejected',()=>reject(f=>{
 const s=f.approvalSignatures.finance.signature;
 f.approvalSignatures.finance.signature=(s[0]==='A'?'B':'A')+s.slice(1);
},'finance_signed_consent'));
test('12 owner and Finance are same subject => no segregation',()=>reject(f=>{
 f.bundle.finance_subject_sha256=f.bundle.owner_subject_sha256;
},'four_distinct_subject_hashes',true));
test('13 Finance subject and Rollback subject collision denied',()=>reject(f=>{
 f.bundle.finance_subject_sha256=f.bundle.rollback_subject_sha256;
},'four_distinct_subject_hashes',true));
test('14 wrong owner Cloudflare membership hash denied',()=>reject(f=>{
 f.bundle.owner_member_sha256='f'.repeat(64);
},'cloudflare_owner_member_authenticated_role_math',true));
test('15 Cloudflare Super Admin role removed denied',()=>reject(f=>{
 f.cloudflareSnapshot.members.entries[0].role_names=['Billing Read'];
 f.bundle.cloudflare_inventory_sha256=digest4b6(f.cloudflareSnapshot);
},'cloudflare_owner_member_authenticated_role_math',true));
test('16 no accepted owner member denied',()=>reject(f=>{
 f.cloudflareSnapshot.members.entries[0].status='pending';
 f.bundle.cloudflare_inventory_sha256=digest4b6(f.cloudflareSnapshot);
},'cloudflare_owner_member_authenticated_role_math',true));
test('17 finance must have independent private signed login receipt',()=>reject(f=>{
 delete f.identityReceipts.finance;
},'exact_two_private_identity_and_signature_roles'));
test('18 finance login receipt without phishing resistant MFA denied',()=>reject(f=>{
 f.identityReceipts.finance.mfa_method='password_only';
},'finance_independent_fresh_MFA_identity_receipt',true));
test('19 owner MFA old 6m denied',()=>reject(f=>{
 f.identityReceipts.owner.auth_time=new Date(NOW-6*60000).toISOString();
},'owner_independent_fresh_MFA_identity_receipt',true));
test('20 finance MFA authentication in future denied',()=>reject(f=>{
 f.identityReceipts.finance.auth_time=new Date(NOW+10000).toISOString();
},'finance_independent_fresh_MFA_identity_receipt',true));
test('21 broker audience must be exact',()=>reject(f=>{
 f.identityReceipts.owner.audience='t404:commerce:write';
},'owner_independent_fresh_MFA_identity_receipt',true));
test('22 broker issuer must be pinned',()=>reject(f=>{
 f.identityReceipts.finance.issuer_id='UNVERIFIED_CLAIM';
},'finance_independent_fresh_MFA_identity_receipt',true));
test('23 consent nonce cross-phase replay denied',()=>reject(f=>{
 f.identityReceipts.owner.consent_nonce='f'.repeat(32);
},'owner_independent_fresh_MFA_identity_receipt',true));
test('24 wrong signed consent-bundle hash denied',()=>reject(f=>{
 f.identityReceipts.finance.consent_bundle_sha256='f'.repeat(64);
},'finance_independent_fresh_MFA_identity_receipt',true));
test('25 Owner private evidence URL injection denied',()=>reject(f=>{
 f.identityReceipts.owner.document_url='https://attacker.invalid/collect';
},'owner_independent_fresh_MFA_identity_receipt',true));
test('26 credential in consent bundle denied',()=>reject(f=>{
 f.bundle.secret_token='fake-test-value';
},'exact_metadata_fields_no_raw_PII_or_URL',true));
test('27 QA Worker phase cannot reuse ledger-first consent',()=>reject(f=>{
 f.bundle.phase='QA_WORKER_FIRST_INACTIVE_UPLOAD';f.bundle.worker_name=WORKER;
},'ledger_first_scope_commit_bound',true));
test('28 signed public endpoint intent forbidden',()=>reject(f=>{
 f.bundle.no_public_routes=false;
},'no_public_production_or_automatic_mutation',true));
test('29 signed Billing change intent forbidden',()=>reject(f=>{
 f.bundle.no_billing_changes=false;
},'no_public_production_or_automatic_mutation',true));
test('30 signed automatic upload intent forbidden',()=>reject(f=>{
 f.bundle.no_automatic_upload=false;
},'no_public_production_or_automatic_mutation',true));
test('31 provider outbound sends forbidden',()=>reject(f=>{
 f.bundle.no_provider_sends=false;
},'no_public_production_or_automatic_mutation',true));
test('32 financial allocation zero denied',()=>reject(f=>{
 f.bundle.ledger_budget_usd=0;
},'separate_finite_cost_allocations_and_explicit_risk',true));
test('33 financial allocation over synthetic policy denied',()=>reject(f=>{
 f.bundle.ledger_budget_usd=25;
},'separate_finite_cost_allocations_and_explicit_risk',true));
test('34 no DO storage cost acknowledgement denied',()=>reject(f=>{
 f.bundle.ack_do_storage_not_hard_capped=false;
},'separate_finite_cost_allocations_and_explicit_risk',true));
test('35 assert hard dollar cap despite shared account denied',()=>reject(f=>{
 f.bundle.hard_spend_cap_claimed=true;
},'separate_finite_cost_allocations_and_explicit_risk',true));
test('36 packet expired denied',()=>reject(f=>{
 f.bundle.expires_at=new Date(NOW-1000).toISOString();
},'short_lived_phase_nonce_and_window',true));
test('37 stale Cloudflare GET evidence denied',()=>reject(f=>{
 f.cloudflareSnapshot.capture_time_ms=NOW-60001;
 f.bundle.cloudflare_inventory_sha256=digest4b6(f.cloudflareSnapshot);
},'current_complete_no_collision_cloudflare_read_only_inventory',true));
test('38 first ledger target already exists denied',()=>reject(f=>{
 f.cloudflareSnapshot.workers.entries[0]=LEDGER;
 f.bundle.cloudflare_inventory_sha256=digest4b6(f.cloudflareSnapshot);
},'current_complete_no_collision_cloudflare_read_only_inventory',true));
test('39 fake read-only finance status with wrong account denied',()=>reject(f=>{
 f.billingEvidence.account_id='wrong-account';
},'actual_finance_control_plane_evidence_not_FORBIDDEN'));
test('40 unknown Finance evidence field cannot bypass strict collector',()=>reject(f=>{
 f.billingEvidence.hard_cap_guaranteed=true;
},'actual_finance_control_plane_evidence_not_FORBIDDEN'));
