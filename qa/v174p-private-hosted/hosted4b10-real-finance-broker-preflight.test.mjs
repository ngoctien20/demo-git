import test from 'node:test';
import assert from 'node:assert/strict';
import {ACCOUNT,LEDGER,WORKER} from './hosted4b4-independent-finance-ledger-gate.mjs';
import {assessRealFinanceNoDeployPreflight,privateBrokerNoDeployPreflight,CONTRACT}
 from './hosted4b10-real-finance-broker-preflight.mjs';
const NOW=Date.parse('2026-11-17T12:42:00.000Z');
const protectedDO=[
 {name:'tien404-v175e2-durable-replay-nosend-staging_ReplayBucket',
 script:'tien404-v175e2-durable-replay-nosend-staging',class:'ReplayBucket'},
 {name:'tien404-v175e2a-private-hosted-runner-nosend-staging_RunnerResults',
 script:'tien404-v175e2a-private-hosted-runner-nosend-staging',class:'RunnerResults'},
 {name:'tien404-v1721h2-zalo-replay-private-nosend-staging_ZaloBotReplayBucketV2',
 script:'tien404-v1721h2-zalo-replay-private-nosend-staging',class:'ZaloBotReplayBucketV2'}
];
function fixture(){
 return {
  now:NOW,
  observation:{
   account_id:ACCOUNT,method:'GET_ONLY',
   observed_at:new Date(NOW-10000).toISOString(),
   worker_count:30,script_count:30,do_namespaces:structuredClone(protectedDO),
   access_apps_count:2,account_members_count:1,accepted_super_admin_count:1,
   ledger_worker_exists:false,qa_worker_exists:false,
   billing_spend_policies_http:403,billing_usage_http:403,
   provenance:'TOOL_RESULT_SUMMARY_NOT_SIGNED_OR_ATTESTED'
  },
  finance:{
   account_id:ACCOUNT,evidence_path:'PRIVATE_DUAL_ATTESTED_FINANCE_REPORT',
   source_http_status:403,billing_period:'2026-11',
   finance_mandate_ref:'EV-finance-mandate-qa-001',
   invoice_or_usage_ref:'EV-finance-billing-qa-002',
   finance_subject_hash:'1'.repeat(64),auditor_subject_hash:'2'.repeat(64),
   finance_signer_registry_ref:'EV-registered-finance-k1',
   auditor_signer_registry_ref:'EV-registered-auditor-k1',
   attested_ledger_usd:2,attested_qa_worker_usd:3,
   explicit_cost_risk_acceptance:true,hard_invoice_cap_guaranteed:false,
   private_scan_result:'PRIVATE_QUARANTINE_PASS',
   private_redaction_result:'RESTRICTED_REVIEW_PASS',
   proof_collected_at:new Date(NOW-30000).toISOString(),
   proof_expires_at:new Date(NOW+120000).toISOString()
  },
  broker:{
   account_id:ACCOUNT,mode:'SOURCE_ONLY_NO_INTAKE_ENDPOINT',
   private_idp:'NOT_VERIFIED',access_protection:'NOT_VERIFIED',
   mfa_policy:'NOT_VERIFIED',finance_and_owner_principals:'NOT_VERIFIED',
   private_storage:'NOT_VERIFIED',malware_scan:'NOT_VERIFIED',
   trust_roots_out_of_band:'NOT_VERIFIED',durable_replay_ledger:'NOT_VERIFIED',
   revocation_check:'NOT_VERIFIED',audit_log:'NOT_VERIFIED',
   hosted_browser_uat:'NOT_VERIFIED',
   public_development_url:false,public_custom_domain:false,
   secrets_in_git:false,payment_changes:false,
   production_webhook_binding:false
  },
  independentDecision:{
   account_id:ACCOUNT,phase:'LEDGER_FIRST_INACTIVE_UPLOAD',
   target_worker:LEDGER,
   source_git_sha:'162eb7e2d171f0a7b4f9185efd27877a5ec51e71',
   owner_consented:false,finance_consented:false,security_reviewed:false,
   operator_verified:false,independent_auditor_verified:false,
   finance_scope_window:'REAL_SIGNED_FINANCE_WINDOW_NOT_ESTABLISHED',
   private_broker_approved:false,rollback_approved:false,
   read_only_review:true,can_change_billing:false,can_create_ledger:false,
   can_upload_qa_worker:false,can_modify_access:false,
   can_touch_commerce:false
  }
 };
}
function expectBlocked(mut,reason){
 const f=fixture();mut(f);
 const r=assessRealFinanceNoDeployPreflight(f);
 assert.equal(r.decision,'HARD_NO_GO');
 assert(r.blockers.includes(reason),JSON.stringify(r.blockers));
 assert.equal(r.can_create_ledger,false);
 assert.equal(r.can_upload_qa_worker,false);
 assert.equal(r.can_change_billing,false);
 assert.equal(r.mutations_executed,false);
}
const statusFor=(f,id)=>assessRealFinanceNoDeployPreflight(f).checks.find(x=>x.id===id)?.status;

test('01 synthetic alternate Finance receipt shapes consistent yet still hard no-go',()=>{
 const r=assessRealFinanceNoDeployPreflight(fixture());
 assert.equal(r.decision,'HARD_NO_GO');
 assert.equal(r.all_metadata_shape_checks_satisfied,true);
 assert.equal(r.real_finance_authority_verified,false);
 assert.equal(r.independent_hosted_admission_accepted,false);
 assert.equal(r.blockers.length,4);
});
test('02 empty inputs fail closed',()=>{
 const r=assessRealFinanceNoDeployPreflight({now:NOW});
 assert.equal(r.decision,'HARD_NO_GO');
 assert(r.blockers.length>8);
});
test('03 current 403 never becomes actual independent Finance permission',()=>{
 const r=assessRealFinanceNoDeployPreflight(fixture());
 assert.equal(r.cloudflare_billing_http,403);
 assert.equal(r.can_create_ledger,false);
 assert(r.blockers.includes('real_finance_delegate_verified_by_external_authority'));
});
test('04 API 200 Finance claim contradicts current Cloudflare 403',()=>expectBlocked(f=>{
 f.finance.evidence_path='DIRECT_BILLING_READ_ONLY';
 f.finance.source_http_status=403;
},'signed_finance_evidence_source_mode_not_laundered_403'));
test('05 account id swapped invalidates observed control-plane',()=>expectBlocked(f=>{
 f.observation.account_id='different-account';
},'strict_sanitized_read_only_observation'));
test('06 GET_ONLY replaced by POST invalidates observation',()=>expectBlocked(f=>{
 f.observation.method='POST';
},'strict_sanitized_read_only_observation'));
test('07 stale GET over 60 seconds blocked',()=>expectBlocked(f=>{
 f.observation.observed_at=new Date(NOW-60001).toISOString();
},'strict_sanitized_read_only_observation'));
test('08 GET timestamp in future blocked',()=>expectBlocked(f=>{
 f.observation.observed_at=new Date(NOW+1000).toISOString();
},'strict_sanitized_read_only_observation'));
test('09 caller pretending signed Cloudflare collection not independently attested',()=>expectBlocked(f=>{
 f.observation.provenance='SIGNED_REAL_CLOUDFLARE';
},'strict_sanitized_read_only_observation'));
test('10 raw merchant email field forbidden in observer report',()=>expectBlocked(f=>{
 f.observation.member_email='staff@example.com';
},'strict_sanitized_read_only_observation'));
test('11 not fully matching Worker/script total blocked',()=>expectBlocked(f=>{
 f.observation.script_count=29;
},'complete_noncolliding_cloudflare_inventory'));
test('12 missing durable object Zalo blocks',()=>expectBlocked(f=>{
 f.observation.do_namespaces.pop();
},'complete_noncolliding_cloudflare_inventory'));
test('13 wrong Durable Object owner script blocks',()=>expectBlocked(f=>{
 f.observation.do_namespaces[2].script='unverified-worker';
},'complete_noncolliding_cloudflare_inventory'));
test('14 mutated Durable Object class blocks',()=>expectBlocked(f=>{
 f.observation.do_namespaces[0].class='ForgedClass';
},'complete_noncolliding_cloudflare_inventory'));
test('15 namespace duplicate name blocked',()=>expectBlocked(f=>{
 f.observation.do_namespaces[2].name=f.observation.do_namespaces[1].name;
},'complete_noncolliding_cloudflare_inventory'));
test('16 if ledger exists, current first-upload admission must block',()=>expectBlocked(f=>{
 f.observation.ledger_worker_exists=true;
},'complete_noncolliding_cloudflare_inventory'));
test('17 if QA Worker already deployed first-upload admission must block',()=>expectBlocked(f=>{
 f.observation.qa_worker_exists=true;
},'complete_noncolliding_cloudflare_inventory'));
test('18 unverifiable admin count does not prove Finance',()=>expectBlocked(f=>{
 f.observation.accepted_super_admin_count=0;
},'complete_noncolliding_cloudflare_inventory'));
test('19 dishonest Billing 200 in tool 403 report blocked',()=>expectBlocked(f=>{
 f.observation.billing_spend_policies_http=200;
},'honest_current_cloudflare_billing_status'));
test('20 missing billing usage HTTP status blocked',()=>expectBlocked(f=>{
 f.observation.billing_usage_http=null;
},'honest_current_cloudflare_billing_status'));
test('21 unapproved evidence path blocked',()=>expectBlocked(f=>{
 f.finance.evidence_path='EMAIL_ATTACHMENT_FROM_UNKNOWN';
},'strict_finance_receipt_no_url_or_raw_document'));
test('22 malicious invoice public URL blocked',()=>expectBlocked(f=>{
 f.finance.invoice_or_usage_ref='https://unknown.invalid/upload';
},'strict_finance_receipt_no_url_or_raw_document'));
test('23 invoice raw bytes in source rejected',()=>expectBlocked(f=>{
 f.finance.invoice_bytes='base64-decoded-test';
},'strict_finance_receipt_no_url_or_raw_document'));
test('24 credential field in finance source rejected',()=>expectBlocked(f=>{
 f.finance.api_token='synthetic-secret';
},'strict_finance_receipt_no_url_or_raw_document'));
test('25 owner mandate ref must be opaque',()=>expectBlocked(f=>{
 f.finance.finance_mandate_ref='../../finance';
},'strict_finance_receipt_no_url_or_raw_document'));
test('26 Finance and Auditor cannot have same subject',()=>expectBlocked(f=>{
 f.finance.auditor_subject_hash=f.finance.finance_subject_hash;
},'strict_finance_receipt_no_url_or_raw_document'));
test('27 private alternative needs 403 in receipt',()=>expectBlocked(f=>{
 f.finance.source_http_status=200;
},'signed_finance_evidence_source_mode_not_laundered_403'));
test('28 private scanner failure blocks',()=>expectBlocked(f=>{
 f.finance.private_scan_result='MALWARE_DETECTED';
},'signed_finance_evidence_source_mode_not_laundered_403'));
test('29 private evidence must be redacted',()=>expectBlocked(f=>{
 f.finance.private_redaction_result='NOT_REDACTED';
},'signed_finance_evidence_source_mode_not_laundered_403'));
test('30 budget zero blocked',()=>expectBlocked(f=>{
 f.finance.attested_ledger_usd=0;
},'positive_usd_scoped_finance_exposure_not_hard_cap'));
test('31 budget above synthetic cap blocked',()=>expectBlocked(f=>{
 f.finance.attested_ledger_usd=24;
},'positive_usd_scoped_finance_exposure_not_hard_cap'));
test('32 claiming hard invoice cap is false blocked',()=>expectBlocked(f=>{
 f.finance.hard_invoice_cap_guaranteed=true;
},'positive_usd_scoped_finance_exposure_not_hard_cap'));
test('33 missing storage risk acceptance blocked',()=>expectBlocked(f=>{
 f.finance.explicit_cost_risk_acceptance=false;
},'positive_usd_scoped_finance_exposure_not_hard_cap'));
test('34 expired private Finance receipt blocked',()=>expectBlocked(f=>{
 f.finance.proof_expires_at=new Date(NOW-1).toISOString();
},'finance_receipt_short_lived'));
test('35 overly long Finance receipt blocked',()=>expectBlocked(f=>{
 f.finance.proof_expires_at=new Date(NOW+15*60000).toISOString();
},'finance_receipt_short_lived'));
test('36 turning on public Worker URL blocked',()=>expectBlocked(f=>{
 f.broker.public_development_url=true;
},'broker_explicitly_not_hosted_in_source'));
test('37 claiming configured IdP in source without hosted evidence blocked',()=>expectBlocked(f=>{
 f.broker.private_idp='LIVE_VERIFIED';
},'broker_explicitly_not_hosted_in_source'));
test('38 forged Access-protected ingress flag blocked',()=>expectBlocked(f=>{
 f.broker.access_protection='VERIFIED';
},'broker_explicitly_not_hosted_in_source'));
test('39 compromised scans must not be enabled in source',()=>expectBlocked(f=>{
 f.broker.malware_scan='DISABLED';
},'broker_explicitly_not_hosted_in_source'));
test('40 separate hardened audit missing makes source contract invalid',()=>expectBlocked(f=>{
 f.broker.audit_log='PRODUCTION_ENABLED';
},'broker_explicitly_not_hosted_in_source'));
test('41 adding token field to broker rejected',()=>expectBlocked(f=>{
 f.broker.secrets_json={authorization:'fake'};
},'broker_explicitly_not_hosted_in_source'));
test('42 public custom domain enabled blocked',()=>expectBlocked(f=>{
 f.broker.public_custom_domain=true;
},'broker_explicitly_not_hosted_in_source'));
test('43 operator decision cannot self-authorize',()=>expectBlocked(f=>{
 f.independentDecision.operator_verified=true;
},'review_is_explicitly_no_deploy_and_no_consent_claim'));
test('44 owner consent cannot be sourced from untrusted template',()=>expectBlocked(f=>{
 f.independentDecision.owner_consented=true;
},'review_is_explicitly_no_deploy_and_no_consent_claim'));
test('45 finance consent cannot be sourced from template',()=>expectBlocked(f=>{
 f.independentDecision.finance_consented=true;
},'review_is_explicitly_no_deploy_and_no_consent_claim'));
test('46 source gate cannot authorize billing edits',()=>expectBlocked(f=>{
 f.independentDecision.can_change_billing=true;
},'review_is_explicitly_no_deploy_and_no_consent_claim'));
test('47 source gate cannot authorize ledger creation',()=>expectBlocked(f=>{
 f.independentDecision.can_create_ledger=true;
},'review_is_explicitly_no_deploy_and_no_consent_claim'));
test('48 source gate cannot authorize real Commerce writes',()=>expectBlocked(f=>{
 f.independentDecision.can_touch_commerce=true;
},'review_is_explicitly_no_deploy_and_no_consent_claim'));
test('49 target phases cannot swap QA Worker for first Ledger',()=>expectBlocked(f=>{
 f.independentDecision.target_worker=WORKER;
},'review_is_explicitly_no_deploy_and_no_consent_claim'));
test('50 a synthetic complete metadata test still has four independent real blockers',()=>{
 const f=fixture();
 assert.equal(statusFor(f,'broker_explicitly_not_hosted_in_source'),'SATISFIED_SYNTHETIC');
 assert.equal(statusFor(f,'real_finance_delegate_verified_by_external_authority'),'BLOCKED');
});
async function call(url='https://internal.invalid/private/admission/preflight',method='GET',ctx={},headers={}){
 const r=await privateBrokerNoDeployPreflight(new Request(url,{method,headers}),{},ctx);
 const data=await r.json();
 assert.equal(data.contract,CONTRACT);
 assert.equal(data.status,'NO_GO');
 assert.equal(data.can_create_ledger,false);
 assert.equal(data.can_upload_document,false);
 assert.equal(data.can_touch_commerce,false);
 assert.equal(r.headers.get('cache-control'),'no-store, max-age=0');
 return {r,data};
}
test('51 local broker GET without Access => 403 fail-closed',async()=>{
 const {r,data}=await call();
 assert.equal(r.status,403);assert.equal(data.code,'ACCESS_AUTH_REQUIRED');
});
test('52 local broker POST rejected regardless Access',async()=>{
 const {r}=await call(undefined,'POST',{access:{getIdentity:async()=>({email:'synthetic@example.com'})}});
 assert.equal(r.status,405);
});
test('53 local broker arbitrary route never enabled',async()=>{
 const {r}=await call('https://internal.invalid/production/send');
 assert.equal(r.status,404);
});
test('54 local broker query injection rejected',async()=>{
 const {r}=await call('https://internal.invalid/private/admission/preflight?url=http://127.0.0.1');
 assert.equal(r.status,404);
});
test('55 local broker authorization header blocked by private get-only contract',async()=>{
 const {r}=await call(undefined,'GET',{}, {authorization:'Bearer fake-synthetic-token'});
 assert.equal(r.status,404);
});
test('56 local broker Access identity error fails closed',async()=>{
 const {r}=await call(undefined,'GET',{access:{getIdentity:async()=>{throw Error('unauthorized')}}});
 assert.equal(r.status,403);
});
test('57 local broker null identity fails closed',async()=>{
 const {r}=await call(undefined,'GET',{access:{getIdentity:async()=>null}});
 assert.equal(r.status,403);
});
test('58 local synthetic Access identity still NO GO and returns 503',async()=>{
 const {r,data}=await call(undefined,'GET',{access:{getIdentity:async()=>({email:'synthetic@example.com'})}});
 assert.equal(r.status,503);
 assert.equal(data.code,'PRIVATE_BROKER_NOT_DEPLOYED_NO_FINANCE_AUTHORITY');
});
test('59 local broker response excludes raw simulated identity/credentials',async()=>{
 const {r}=await call(undefined,'GET',{access:{getIdentity:async()=>({email:'private-fixture@example.com',secret:'synthetic'})}});
 const body=await r.text().catch(()=>null);
 assert.equal(body,null);
});
test('60 local no-deploy broker never claims real hosted deployment even if ctx.access is present',async()=>{
 const {data}=await call(undefined,'GET',{access:{getIdentity:async()=>({email:'owner@synthetic.invalid'})}});
 assert.equal(data.can_create_ledger,false);
 assert.equal(data.can_touch_commerce,false);
});
