import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign as cryptoSign} from 'node:crypto';
import {ACCOUNT} from './hosted4b4-independent-finance-ledger-gate.mjs';
import {CONTRACT,LOCAL_SCOPE,SINGLE_FOUNDER_ROLE,
 createLocalSoloFounderChallenge,assessSoloFounderGovernance
} from './hosted4b11-solo-founder-local-challenge.mjs';
const NOW=Date.parse('2026-11-17T13:00:00.000Z');
const GIT_SHA='f48354e2e3a2fc6ca365c124a308b80c1dc5627a';
const H='a'.repeat(64),KEY_ID='local-fixture-owner-key-1';
const k=generateKeyPairSync('ed25519');
const canonical=x=>Array.isArray(x)?'['+x.map(canonical).join(',')+']':
 x!==null&&typeof x==='object'?
 '{'+Object.keys(x).sort().map(z=>JSON.stringify(z)+':'+canonical(x[z])).join(',')+'}':
 JSON.stringify(x);
const sign=(p,key=k,domain='T404_4B11_LOCAL_CHALLENGE\n')=>
 cryptoSign(null,Buffer.from(domain+canonical(p)),key.privateKey).toString('base64url');
function setup(extra={}){
 let now=NOW;
 const gate=createLocalSoloFounderChallenge({
  accountId:ACCOUNT,expectedGitSha:GIT_SHA,founderSubjectHash:H,
  registeredKeyId:KEY_ID,registeredSpkiPem:k.publicKey.export({format:'pem',type:'spki'}),
  clock:()=>now,...extra
 });
 const request={
  account_id:ACCOUNT,source_git_sha:GIT_SHA,subject_sha256:H,
  scope:LOCAL_SCOPE,identity_mode:SINGLE_FOUNDER_ROLE,
  role_separation_waiver:'SOLO_FOUNDER_QA_ONLY',
  owner_finance_same_person_ack:true,account_spend_risk_ack:true,
  no_hard_invoice_cap_ack:true,source_only:true
 };
 const issue=()=>gate.issue(request);
 const complete=(c,signature=sign(c),key_id=KEY_ID)=>gate.complete({challenge:c,signature,key_id});
 return {gate,request,issue,complete,setTime:x=>{now=x;},getTime:()=>now};
}
const safe=r=>{
 assert.equal(r.can_create_hosted_ledger,false);
 assert.equal(r.can_upload_qa_worker,false);
 assert.equal(r.can_change_billing,false);
 assert.equal(r.can_change_access,false);
 assert.equal(r.real_founder_identity_verified,false);
 assert.equal(r.real_finance_budget_verified,false);
 assert.equal(r.mutations_executed,false);
};
const governance=()=>({
 founder_role:SINGLE_FOUNDER_ROLE,owner_finance_same_real_person:true,
 separate_independent_finance_claim:false,external_human_auditor_claim:false,
 explicit_owner_authorized_local_qa:true,external_billing_approval:false,
 private_broker_hosted:false,real_finance_spend_usd_approved:null,
 private_rollback_consent:false,requested_scope:LOCAL_SCOPE
});
test('01 Solo founder may be both legal owner and finance in local QA without fabricating two humans',()=>{
 const r=assessSoloFounderGovernance(governance());
 assert.equal(r.code,'SOLO_FOUNDER_LOCAL_QA_READY');
 assert.equal(r.can_run_local_no_send_qa,true);
 assert.equal(r.human_finance_auditor_independence_available,false);
 safe(r);
});
test('02 missing governance is blocked',()=>{const r=assessSoloFounderGovernance();assert.equal(r.can_run_local_no_send_qa,false);safe(r);});
test('03 two falsely independent humans rejected',()=>{
 const r=assessSoloFounderGovernance({...governance(),external_human_auditor_claim:true});
 assert(r.reasons.includes('FICTITIOUS_INDEPENDENT_PERSON_FORBIDDEN'));safe(r);
});
test('04 false independent Finance signer rejected',()=>{
 const r=assessSoloFounderGovernance({...governance(),separate_independent_finance_claim:true});
 assert.equal(r.can_run_local_no_send_qa,false);safe(r);
});
test('05 Owner/Finance identity mismatch rejected',()=>{
 const r=assessSoloFounderGovernance({...governance(),owner_finance_same_real_person:false});
 assert(r.reasons.includes('NO_GENUINE_SOLO_FOUNDER_ROLE'));safe(r);
});
test('06 local QA must have the founder stated permission',()=>{
 const r=assessSoloFounderGovernance({...governance(),explicit_owner_authorized_local_qa:false});
 assert.equal(r.can_run_local_no_send_qa,false);safe(r);
});
test('07 production / hosted scope never inherits this permission',()=>{
 const r=assessSoloFounderGovernance({...governance(),requested_scope:'PRODUCTION_WRITE'});
 assert.equal(r.can_run_local_no_send_qa,false);safe(r);
});
test('08 real Finance budget may not be invented by source policy',()=>{
 const r=assessSoloFounderGovernance({...governance(),real_finance_spend_usd_approved:25});
 assert(r.reasons.includes('UNVERIFIED_HOSTED_EVIDENCE_SELF_ASSERTED'));safe(r);
});
test('09 external billing approval cannot be asserted true',()=>{
 const r=assessSoloFounderGovernance({...governance(),external_billing_approval:true});
 assert.equal(r.can_run_local_no_send_qa,false);safe(r);
});
test('10 private hosted broker may not be asserted deployed',()=>{
 const r=assessSoloFounderGovernance({...governance(),private_broker_hosted:true});
 assert.equal(r.can_run_local_no_send_qa,false);safe(r);
});
test('11 rollback consent is a separate future proof',()=>{
 const r=assessSoloFounderGovernance({...governance(),private_rollback_consent:true});
 assert.equal(r.can_run_local_no_send_qa,false);safe(r);
});
test('12 local challenge issued is not a real owner authentication',()=>{
 const {issue}=setup();const v=issue();
 assert.equal(v.code,'LOCAL_CHALLENGE_ISSUED_NOT_HOSTED');
 assert.equal(v.challenge.contract,CONTRACT);
 assert.equal(v.challenge.scope,LOCAL_SCOPE);
 assert.equal(v.challenge.independent_finance_or_auditor_present,false);safe(v);
});
test('13 signed local challenge accepted for math only',()=>{
 const {issue,complete}=setup();const c=issue().challenge;
 const r=complete(c);
 assert.equal(r.code,'LOCAL_CRYPTO_CHALLENGE_ACCEPTED_NOT_REAL_IDENTITY');
 assert.equal(r.local_challenge_math_passed,true);
 assert.equal(r.real_founder_identity_verified,false);safe(r);
});
test('14 replay of a consumed nonce is rejected',()=>{
 const {issue,complete}=setup();const c=issue().challenge;complete(c);
 const r=complete(c);assert.equal(r.code,'REPLAY_REJECTED');safe(r);
});
test('15 unknown challenge nonce fails closed',()=>{
 const {issue,complete}=setup();const c=issue().challenge;
 const r=complete({...c,nonce:'f'.repeat(64)});
 assert.equal(r.code,'CHALLENGE_UNKNOWN_OR_EVICTED');safe(r);
});
test('16 changed challenge Git commit fails signature binding',()=>{
 const {issue,complete}=setup();const c=issue().challenge;
 const r=complete({...c,source_git_sha:'f'.repeat(40)});
 assert.equal(r.code,'INVALID_CHALLENGE_BINDING_OR_SIGNATURE');safe(r);
});
test('17 changed approved role fails signature binding',()=>{
 const {issue,complete}=setup();const c=issue().challenge;
 const r=complete({...c,identity_mode:'OWNER'});
 assert.equal(r.code,'INVALID_CHALLENGE_BINDING_OR_SIGNATURE');safe(r);
});
test('18 signed wrong domain cannot satisfy Ed25519 challenge',()=>{
 const {issue,complete}=setup();const c=issue().challenge;
 const r=complete(c,sign(c,k,'T404_ATTEMPT_WRONG_DOMAIN\n'));
 assert.equal(r.code,'CRYPTO_SIGNATURE_INVALID');safe(r);
});
test('19 incorrect key ID fails',()=>{
 const {issue,complete}=setup();const c=issue().challenge;
 const r=complete(c,sign(c),'other-key-identifier');
 assert.equal(r.code,'INVALID_CHALLENGE_BINDING_OR_SIGNATURE');safe(r);
});
test('20 another cryptographic public key is rejected',()=>{
 const {issue,complete}=setup();const c=issue().challenge;
 const outsider=generateKeyPairSync('ed25519');
 const r=complete(c,sign(c,outsider));
 assert.equal(r.code,'CRYPTO_SIGNATURE_INVALID');safe(r);
});
test('21 fake non-base64url signature cannot pass',()=>{
 const {issue,complete}=setup();const c=issue().challenge;
 const r=complete(c,'not-base64-!!!');
 assert.equal(r.code,'INVALID_CHALLENGE_BINDING_OR_SIGNATURE');safe(r);
});
test('22 a challenge expires at 120 seconds',()=>{
 const a=setup();const c=a.issue().challenge;
 a.setTime(NOW+120000);const r=a.complete(c);
 assert.equal(r.code,'CHALLENGE_EXPIRED');safe(r);
});
test('23 challenge is accepted before expiry, still no hosted rights',()=>{
 const a=setup();const c=a.issue().challenge;
 a.setTime(NOW+119999);const r=a.complete(c);
 assert.equal(r.code,'LOCAL_CRYPTO_CHALLENGE_ACCEPTED_NOT_REAL_IDENTITY');safe(r);
});
test('24 issue with wrong account blocked',()=>{
 const a=setup();a.request.account_id='other';
 const r=a.issue();assert.equal(r.code,'INVALID_LOCAL_SCOPE_OR_ACK');safe(r);
});
test('25 issue with wrong source SHA blocked',()=>{
 const a=setup();a.request.source_git_sha='f'.repeat(40);
 const r=a.issue();assert.equal(r.code,'INVALID_LOCAL_SCOPE_OR_ACK');safe(r);
});
test('26 wrong subject hash blocked',()=>{
 const a=setup();a.request.subject_sha256='1'.repeat(64);
 const r=a.issue();assert.equal(r.code,'INVALID_LOCAL_SCOPE_OR_ACK');safe(r);
});
test('27 external hosted scope forbidden',()=>{
 const a=setup();a.request.scope='HOSTED_LEDGER_CREATE';
 const r=a.issue();assert.equal(r.code,'INVALID_LOCAL_SCOPE_OR_ACK');safe(r);
});
test('28 fake Finance independence mode forbidden',()=>{
 const a=setup();a.request.identity_mode='OWNER_PLUS_INDEPENDENT_FINANCE';
 const r=a.issue();assert.equal(r.code,'INVALID_LOCAL_SCOPE_OR_ACK');safe(r);
});
test('29 waiver must be exactly limited to solo founder QA',()=>{
 const a=setup();a.request.role_separation_waiver='ALL_PRODUCTION';
 const r=a.issue();assert.equal(r.code,'INVALID_LOCAL_SCOPE_OR_ACK');safe(r);
});
test('30 explicit same-person acknowledgment required',()=>{
 const a=setup();a.request.owner_finance_same_person_ack=false;
 const r=a.issue();assert.equal(r.code,'INVALID_LOCAL_SCOPE_OR_ACK');safe(r);
});
test('31 account-wide spend risk acknowledgment required',()=>{
 const a=setup();a.request.account_spend_risk_ack=false;
 const r=a.issue();assert.equal(r.code,'INVALID_LOCAL_SCOPE_OR_ACK');safe(r);
});
test('32 DO stored data fee and non-hard cap acknowledgment required',()=>{
 const a=setup();a.request.no_hard_invoice_cap_ack=false;
 const r=a.issue();assert.equal(r.code,'INVALID_LOCAL_SCOPE_OR_ACK');safe(r);
});
test('33 no source-only flag cannot become an upload permit',()=>{
 const a=setup();a.request.source_only=false;
 const r=a.issue();assert.equal(r.code,'INVALID_LOCAL_SCOPE_OR_ACK');safe(r);
});
test('34 rate cap limits outstanding local challenges',()=>{
 const a=setup({maxPending:1});
 const v=a.issue();assert.ok(v.challenge);
 const r=a.issue();assert.equal(r.code,'LOCAL_RATE_LIMIT');safe(r);
});
test('35 expiration evicts outstanding challenge',()=>{
 const a=setup({maxPending:1});a.issue();
 a.setTime(NOW+120000);
 const r=a.issue();assert.equal(r.code,'LOCAL_CHALLENGE_ISSUED_NOT_HOSTED');safe(r);
});
test('36 three malformed signature attempts exhaust challenge',()=>{
 const a=setup();const c=a.issue().challenge;
 for(let i=0;i<3;i++)a.complete(c,'invalid');
 const r=a.complete(c);assert.equal(r.code,'CHALLENGE_ATTEMPTS_EXHAUSTED');safe(r);
});
test('37 constructor rejects RSA key substitute',()=>{
 const outsider=generateKeyPairSync('rsa',{modulusLength:2048});
 assert.throws(()=>setup({registeredSpkiPem:outsider.publicKey.export({format:'pem',type:'spki'})}),/Ed25519/);
});
test('38 constructor rejects foreign Cloudflare account',()=>assert.throws(()=>setup({accountId:'foreign-account'})));
test('39 constructor rejects invalid source commit',()=>assert.throws(()=>setup({expectedGitSha:'HEAD'})));
test('40 constructor rejects invalid subject',()=>assert.throws(()=>setup({founderSubjectHash:'person@example.com'})));
test('41 constructor rejects unbounded local pending requests',()=>assert.throws(()=>setup({maxPending:10000})));
test('42 local stats admit that memory is not durable storage',()=>{
 const a=setup(),c=a.issue().challenge;a.complete(c);
 const s=a.gate.stats();
 assert.equal(s.survives_restart,false);
 assert.equal(s.hosted_ledger_verified,false);
 assert.equal(s.successful_local_signatures,1);
});
test('43 fresh process cannot validate nonce from previous process',()=>{
 const a=setup();const c=a.issue().challenge;
 const b=setup();const r=b.complete(c);
 assert.equal(r.code,'CHALLENGE_UNKNOWN_OR_EVICTED');safe(r);
});
test('44 multiple independent local nonces have different values',()=>{
 const a=setup();const x=a.issue().challenge;const y=a.issue().challenge;
 assert.notEqual(x.nonce,y.nonce);
});
test('45 outcome never returns founder email, credentials or finance bill',()=>{
 const a=setup();const c=a.issue().challenge;const r=a.complete(c);
 const out=JSON.stringify(r);
 assert.equal(out.includes('private_key'),false);
 assert.equal(out.includes('billing_invoice'),false);
 assert.equal(out.includes('authorization_token'),false);safe(r);
});
