import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign as edSign,createHash} from 'node:crypto';
import {reviewDelegationAndChallenge,CONTRACT,digest} from './hosted4b8-finance-delegation-private-challenge.mjs';
import {digest as inventoryDigest} from './hosted4b6-private-authority-readonly-uat.mjs';
import {ACCOUNT,LEDGER,WORKER} from './hosted4b4-independent-finance-ledger-gate.mjs';

const NOW=Date.parse('2026-11-17T12:19:00.000Z');
const roleNames=['owner','finance','auditor','broker','challenge_ledger'];
const keys=Object.fromEntries(roleNames.map(x=>[x,generateKeyPairSync('ed25519')]));
const canonical=x=>Array.isArray(x)?'['+x.map(canonical).join(',')+']':
 (x!==null&&typeof x==='object'?
 '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}':
 JSON.stringify(x));
const sh=x=>createHash('sha256').update(x,'utf8').digest('hex');
const sig=(data,role,purpose)=>({
 key_id:'synthetic-'+role+'-private-k1',
 signature:edSign(null,Buffer.from('T404_V174P_4B8:'+purpose+'\n'+canonical(data)),
  keys[role].privateKey).toString('base64url')
});
const list=entries=>({status:'COMPLETE',count:entries.length,total_count:entries.length,entries});
function freshFixture(){
 const workers=[
  'tien404-rpc16-merchant-evidence-inactive-staging',
  'tien404-v1721h2-zalo-replay-private-nosend-staging',
  'tien404-v175e1-private-issuer-nosend-staging',
  'tien404-v175e2-ab-gateway-nosend-staging',
  'tien404-v175e2a-private-hosted-runner-nosend-staging',
  'tien404-v175e2-durable-replay-nosend-staging',
  'tien404-v175e2-installation-registry-nosend-staging',
  ...Array.from({length:23},(_,i)=>'unrelated-'+i)
 ].sort();
 const cloudflareSnapshot={
  account_id:ACCOUNT,source:'CLOUDFLARE_READ_ONLY_CONTROL_PLANE',
  capture_time_ms:NOW-10000,methods_used:['GET'],
  workers:list(workers),scripts:list(workers.slice()),
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
 const delegation={
  contract:CONTRACT,account_id:ACCOUNT,phase:'LEDGER_FIRST_INACTIVE_UPLOAD',
  target_worker:LEDGER,
  owner_subject_sha256:'2'.repeat(64),owner_member_sha256:'1'.repeat(64),
  finance_subject_sha256:'3'.repeat(64),auditor_subject_sha256:'4'.repeat(64),
  rollback_subject_sha256:'5'.repeat(64),
  git_sha:'d780435429954bf01d84982aea8b9f0b1c7df5d9',
  manifest_sha256:'6'.repeat(64),inventory_sha256:inventoryDigest(cloudflareSnapshot),
  billing_evidence_sha256:'7'.repeat(64),mandate_ref:'EV-private-finance-mandate-01',
  dossier_sha256:'8'.repeat(64),
  finance_authority_basis:'OWNER_SIGNED_FINANCE_DELEGATION_AND_AUDITOR_REVIEW',
  ledger_budget_usd:2,qa_budget_usd:3,cost_window_id:'qa-20261117-synthetic-a',
  nonce:'9'.repeat(64),issued_at:new Date(NOW-60_000).toISOString(),
  expires_at:new Date(NOW+3600000).toISOString(),
  no_public_url:true,no_existing_resource_change:true,no_billing_change:true,
  no_access_change:true,no_secrets:true,no_provider_sends:true,
  no_commerce_writes:true,no_auto_deploy:true,
  ack_account_wide_spend:true,ack_storage_not_hard_cap:true,
  claim_hard_invoice_cap:false
 };
 const challenge={
  contract:CONTRACT,account_id:ACCOUNT,
  delegation_sha256:digest(delegation),nonce:'a'.repeat(64),
  owner_subject_sha256:delegation.owner_subject_sha256,
  finance_subject_sha256:delegation.finance_subject_sha256,
  owner_session_sha256:'b'.repeat(64),finance_session_sha256:'c'.repeat(64),
  owner_auth_at:new Date(NOW-20_000).toISOString(),
  finance_auth_at:new Date(NOW-15_000).toISOString(),
  mfa_method:'phishing_resistant',audience:'t404:private:finance-delegation-review',
  phase:'LEDGER_FIRST_INACTIVE_UPLOAD',
  issued_at:new Date(NOW-5_000).toISOString(),
  expires_at:new Date(NOW+60_000).toISOString(),
  ledger_receipt_sha256:'0'.repeat(64)
 };
 const nonceReceipt={
  contract:CONTRACT,nonce_sha256:sh(challenge.nonce),
  delegation_sha256:digest(delegation),status:'RESERVED_LOCAL_OR_PRIVATE_LEDGER',
  issued_at:new Date(NOW-4000).toISOString(),
  expires_at:new Date(NOW+60_000).toISOString(),
  ledger_instance_sha256:'d'.repeat(64)
 };
 challenge.ledger_receipt_sha256=digest(nonceReceipt);
 const trustRoots=Object.fromEntries(roleNames.map(role=>[role,{
  source:'EXTERNALLY_REGISTERED_PRIVATE_ROLE_KEY',role,
  key_id:'synthetic-'+role+'-private-k1',
  spki_pem:keys[role].publicKey.export({format:'pem',type:'spki'})
 }]));
 const f={delegation,challenge,nonceReceipt,trustRoots,cloudflareSnapshot,
  billingEvidence:{status:'READ_ONLY_VERIFIED',account_id:ACCOUNT,
   independent_source:'RESTRICTED_FINANCE_AUDIT',
   captured_at:new Date(NOW-10_000).toISOString(),
   digest_sha256:delegation.billing_evidence_sha256},now:NOW,signatures:{}};
 resign(f);
 return f;
}
function resign(f){
 const d=f.delegation,c=f.challenge,n=f.nonceReceipt;
 f.signatures={
  owner:sig(d,'owner','OWNER_FINANCE_DELEGATION'),
  auditor:sig(d,'auditor','AUDITOR_FINANCE_DELEGATION_REVIEW'),
  finance:sig(d,'finance','FINANCE_ACCEPTS_DELEGATION'),
  broker_challenge:sig(c,'broker','BROKER_ISSUES_PRIVATE_CHALLENGE'),
  owner_response:sig(c,'owner','OWNER_CHALLENGE_RESPONSE'),
  finance_response:sig(c,'finance','FINANCE_CHALLENGE_RESPONSE'),
  challenge_ledger:sig(n,'challenge_ledger','CHALLENGE_LEDGER_RESERVATION')
 };
}
function blocked(mutate,reason,renew=false){
 const f=freshFixture();mutate(f);if(renew)resign(f);
 const r=reviewDelegationAndChallenge(f);
 assert.equal(r.decision,'BLOCKED',JSON.stringify(r.reasons));
 assert(r.reasons.includes(reason),JSON.stringify(r.reasons));
 assert.equal(r.can_upload,false);assert.equal(r.can_create_ledger,false);
 assert.equal(r.mutations_executed,false);
}
test('01 synthetic complete Owner/Finance/Auditor/Broker/ledger signatures pass math but never grant hosted deployment',()=>{
 const r=reviewDelegationAndChallenge(freshFixture());
 assert.deepEqual(r.reasons,[]);
 assert.equal(r.decision,'CRYPTOGRAPHICALLY_CONSISTENT_REVIEW_ONLY');
 assert.equal(r.real_finance_mandate_verified,false);
 assert.equal(r.actual_private_challenge_verified,false);
 assert.equal(r.can_upload,false);
});
test('02 absent evidence blocks',()=>{
 const r=reviewDelegationAndChallenge({now:NOW});
 assert.equal(r.decision,'BLOCKED');assert(r.reasons.length>10);
});
test('03 live Cloudflare billing 403 denies even if synthetic signatures are valid',()=>blocked(f=>{
 f.billingEvidence.status='FORBIDDEN';
},'actual_finance_billing_evidence_not_403'));
test('04 Finance delegation must be signed by Owner',()=>blocked(f=>{
 delete f.signatures.owner;
},'owner_signed_finance_mandate'));
test('05 independent Auditor must review the mandate',()=>blocked(f=>{
 delete f.signatures.auditor;
},'independent_auditor_reviews_mandate'));
test('06 finance delegate must accept consent independently',()=>blocked(f=>{
 delete f.signatures.finance;
},'finance_delegate_signs_acceptance'));
test('07 forged Owner delegation signature denied',()=>blocked(f=>{
 const s=f.signatures.owner.signature;
 f.signatures.owner.signature=(s[0]==='A'?'B':'A')+s.slice(1);
},'owner_signed_finance_mandate'));
test('08 wrong owner public key denies',()=>blocked(f=>{
 f.trustRoots.owner.spki_pem=keys.finance.publicKey.export({format:'pem',type:'spki'});
},'complete_distinct_registered_role_keys'));
test('09 same finance and owner subject denied',()=>blocked(f=>{
 f.delegation.finance_subject_sha256=f.delegation.owner_subject_sha256;
},'separate_owner_finance_auditor_rollback_principals',true));
test('10 same finance and Auditor identity denied',()=>blocked(f=>{
 f.delegation.auditor_subject_sha256=f.delegation.finance_subject_sha256;
},'separate_owner_finance_auditor_rollback_principals',true));
test('11 incorrect private legal mandate ref rejected',()=>blocked(f=>{
 f.delegation.mandate_ref='../../secrets';
},'delegation_legal_basis_and_private_mandate',true));
test('12 unsupported self-asserted Finance authority basis rejected',()=>blocked(f=>{
 f.delegation.finance_authority_basis='SELF_APPOINTED_SUPERADMIN';
},'delegation_legal_basis_and_private_mandate',true));
test('13 budget tamper after signing invalidates signatures',()=>blocked(f=>{
 f.delegation.ledger_budget_usd=3;
},'owner_signed_finance_mandate'));
test('14 freshly signed ledger budget of zero still blocked',()=>blocked(f=>{
 f.delegation.ledger_budget_usd=0;
},'finance_and_ledger_positive_usd_scoped',true));
test('15 combined budget > synthetic policy blocked',()=>blocked(f=>{
 f.delegation.ledger_budget_usd=25;
},'finance_and_ledger_positive_usd_scoped',true));
test('16 account-wide storage is not hard invoice cap',()=>blocked(f=>{
 f.delegation.claim_hard_invoice_cap=true;
},'finance_and_ledger_positive_usd_scoped',true));
test('17 account-wide spending exposure acknowledgment required',()=>blocked(f=>{
 f.delegation.ack_account_wide_spend=false;
},'finance_and_ledger_positive_usd_scoped',true));
test('18 public route request forbidden',()=>blocked(f=>{
 f.delegation.no_public_url=false;
},'no_public_cost_access_or_existing_service_changes',true));
test('19 modifying existing Zalo/Commerce Worker forbidden',()=>blocked(f=>{
 f.delegation.no_existing_resource_change=false;
},'no_public_cost_access_or_existing_service_changes',true));
test('20 automatic deploy forbidden',()=>blocked(f=>{
 f.delegation.no_auto_deploy=false;
},'no_public_cost_access_or_existing_service_changes',true));
test('21 billing configuration change forbidden',()=>blocked(f=>{
 f.delegation.no_billing_change=false;
},'no_public_cost_access_or_existing_service_changes',true));
test('22 provider messages forbidden',()=>blocked(f=>{
 f.delegation.no_provider_sends=false;
},'no_public_cost_access_or_existing_service_changes',true));
test('23 wrong target Worker cannot be implicitly authorized',()=>blocked(f=>{
 f.delegation.target_worker=WORKER;
},'exact_account_ledger_first_scope',true));
test('24 missing Finance signature key not independent',()=>blocked(f=>{
 f.trustRoots.finance.spki_pem=f.trustRoots.owner.spki_pem;
},'complete_distinct_registered_role_keys'));
test('25 expired Owner delegation denied',()=>blocked(f=>{
 f.delegation.expires_at=new Date(NOW-1).toISOString();
},'one_day_delegation_and_unique_nonce',true));
test('26 challenge older than 2 minutes rejected',()=>blocked(f=>{
 f.challenge.issued_at=new Date(NOW-121000).toISOString();
},'fresh_challenge_and_both_recent_MFA_sessions',true));
test('27 challenge intended for wrong audience denied',()=>blocked(f=>{
 f.challenge.audience='t404:commerce:write';
},'challenge_binds_owner_finance_and_delegation',true));
test('28 Finance must have phishing-resistant MFA',()=>blocked(f=>{
 f.challenge.mfa_method='password_only';
},'challenge_binds_owner_finance_and_delegation',true));
test('29 Finance MFA stale >5 minutes fails',()=>blocked(f=>{
 f.challenge.finance_auth_at=new Date(NOW-300001).toISOString();
},'fresh_challenge_and_both_recent_MFA_sessions',true));
test('30 Owner MFA in future fails',()=>blocked(f=>{
 f.challenge.owner_auth_at=new Date(NOW+1000).toISOString();
},'fresh_challenge_and_both_recent_MFA_sessions',true));
test('31 owner and finance cannot share one session',()=>blocked(f=>{
 f.challenge.finance_session_sha256=f.challenge.owner_session_sha256;
},'challenge_binds_owner_finance_and_delegation',true));
test('32 Broker cannot be omitted',()=>blocked(f=>{
 delete f.signatures.broker_challenge;
},'independent_broker_challenge_signature'));
test('33 Finance must sign exact fresh challenge',()=>blocked(f=>{
 delete f.signatures.finance_response;
},'finance_fresh_challenge_response'));
test('34 Owner must sign exact fresh challenge',()=>blocked(f=>{
 delete f.signatures.owner_response;
},'owner_fresh_challenge_response'));
test('35 challenge cannot reuse delegation nonce',()=>blocked(f=>{
 f.challenge.nonce=f.delegation.nonce;
},'challenge_binds_owner_finance_and_delegation',true));
test('36 challenge receipt cannot claim unrelated nonce',()=>blocked(f=>{
 f.nonceReceipt.nonce_sha256='f'.repeat(64);
},'nonce_receipt_binds_challenge_not_expired',true));
test('37 challenge ledger needs distinct signature',()=>blocked(f=>{
 delete f.signatures.challenge_ledger;
},'independent_signed_nonce_reservation'));
test('38 challenge receipt cannot extend beyond 120 sec',()=>blocked(f=>{
 f.nonceReceipt.expires_at=new Date(NOW+180000).toISOString();
},'nonce_receipt_binds_challenge_not_expired',true));
test('39 wrong owner member role cannot be a signer authority',()=>blocked(f=>{
 f.cloudflareSnapshot.members.entries[0].role_names=['Billing Read'];
 f.delegation.inventory_sha256=inventoryDigest(f.cloudflareSnapshot);
},'cloudflare_member_owner_role_and_full_inventory',true));
test('40 stale Cloudflare GET cannot bind deployment',()=>blocked(f=>{
 f.cloudflareSnapshot.capture_time_ms=NOW-61000;
 f.delegation.inventory_sha256=inventoryDigest(f.cloudflareSnapshot);
},'snapshot_fresh_and_exact_inventory_hash',true));
test('41 existing protected target collision rejected',()=>blocked(f=>{
 f.cloudflareSnapshot.workers.entries[0]=LEDGER;
 f.delegation.inventory_sha256=inventoryDigest(f.cloudflareSnapshot);
},'cloudflare_member_owner_role_and_full_inventory',true));
test('42 credential field injected into signed private request rejected',()=>blocked(f=>{
 f.delegation.access_token='fake';
},'strict_delegation_fields',true));
test('43 URL injected into challenge prohibited',()=>blocked(f=>{
 f.challenge.url='https://attacker.invalid';
},'strict_private_challenge_fields',true));
test('44 invoice billing evidence wrong account denied',()=>blocked(f=>{
 f.billingEvidence.account_id='other';
},'actual_finance_billing_evidence_not_403'));
test('45 signing private receipt alone does not prove durable nonce storage',()=>{
 const result=reviewDelegationAndChallenge(freshFixture());
 assert.equal(result.nonce_replay_durable_verified,false);
 assert.equal(result.can_create_ledger,false);
});
