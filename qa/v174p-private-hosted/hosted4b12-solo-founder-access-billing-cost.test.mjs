import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign as rsaSign,createHash} from 'node:crypto';
import {ACCOUNT,LEDGER,WORKER} from './hosted4b4-independent-finance-ledger-gate.mjs';
import {CONTRACT,PHASE,verifySyntheticPinnedAccessJwt,assessSoloFounderPrivateCanary}
 from './hosted4b12-solo-founder-access-billing-cost.mjs';

const NOW=Date.parse('2026-11-17T13:10:00.000Z');
const N=Math.trunc(NOW/1000),ISS='https://t404-synthetic.cloudflareaccess.com';
const AUD='t404-private-qa-synthetic-aud';
const SUB='founder-qa-synthetic-session-001';
const H=x=>createHash('sha256').update(x,'utf8').digest('hex');
const {publicKey,privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const raw=publicKey.export({format:'jwk'});
const JWK={...raw,kid:'synthetic-pinned-rsa-key',alg:'RS256',use:'sig'};
const B64=x=>Buffer.from(JSON.stringify(x),'utf8').toString('base64url');
function mint(h={},p={},secret=privateKey){
 const hdr={alg:'RS256',kid:JWK.kid,typ:'JWT',...h};
 const payload={
  iss:ISS,aud:AUD,sub:SUB,iat:N-60,nbf:N-60,exp:N+180,...p
 };
 const head=B64(hdr),body=B64(payload);
 const signature=rsaSign('RSA-SHA256',Buffer.from(head+'.'+body),secret).toString('base64url');
 return head+'.'+body+'.'+signature;
}
const offline=(token=mint(),extra={})=>verifySyntheticPinnedAccessJwt({
 token,pinnedIssuer:ISS,pinnedAudience:AUD,pinnedFounderSubjectHash:H(SUB),
 pinnedJwk:JWK,nowSeconds:N,...extra
});
const clearMath=r=>{
 assert.equal(r.live_access_verified,false);
 assert.equal(r.real_phishing_resistant_mfa_verified,false);
 assert.equal(r.can_authorize_spend,false);
 assert.equal(r.can_access_private_intake,false);
};
const protectedDO=[
 {name:'tien404-v175e2-durable-replay-nosend-staging_ReplayBucket',
 script:'tien404-v175e2-durable-replay-nosend-staging',class:'ReplayBucket'},
 {name:'tien404-v175e2a-private-hosted-runner-nosend-staging_RunnerResults',
 script:'tien404-v175e2a-private-hosted-runner-nosend-staging',class:'RunnerResults'},
 {name:'tien404-v1721h2-zalo-replay-private-nosend-staging_ZaloBotReplayBucketV2',
 script:'tien404-v1721h2-zalo-replay-private-nosend-staging',class:'ZaloBotReplayBucketV2'}
];
function fixture(){
 const names=[...new Set([
 'tien404-v175e2-durable-replay-nosend-staging',
 'tien404-v175e2a-private-hosted-runner-nosend-staging',
 'tien404-v1721h2-zalo-replay-private-nosend-staging',
 ...Array.from({length:28},(_,i)=>'parallel-unowned-synthetic-'+i)
 ])].sort();
 return {
  now:NOW,
  observation:{
   account_id:ACCOUNT,capture_time:new Date(NOW-10000).toISOString(),
   methods:['GET'],worker_count:31,script_count:31,worker_names:names,
   do_namespaces:structuredClone(protectedDO),access_app_count:2,
   access_idp_types:['cloudflare','onetimepin'],accepted_superadmin_count:1,
   billing_spend_policies_status:403,billing_usage_status:403,
   billing_profile_status:403,
   observed_by:'CONNECTED_CLOUDFLARE_READ_ONLY_NOT_ATTESTED'
  },
  desired:{
   phase:PHASE,account_id:ACCOUNT,target_ledger:LEDGER,target_qa_worker:WORKER,
   source_commit:'e56243fe50ac0ddbd65ecdf7921892604bcb407b',
   inventory_sha256:'d'.repeat(64),founder_subject_sha256:H(SUB),
   proposed_max_requests:20,proposed_max_minutes:10,proposed_max_usd:2,
   private_access_only:true,no_workers_dev:true,no_preview_url:true,
   no_custom_domain:true,no_live_sends:true,no_customer_reads:true,
   no_billing_change:true,no_access_change:true,no_auto_deploy:true
  },
  finance:{
   status:'NO_INDEPENDENT_BILLING_OR_MFA_EVIDENCE',account_id:ACCOUNT,
   source:'BILLING_API_403',reported_budget_usd:null,billing_period:null,
   founder_mfa_verified_out_of_band:false,spend_scope_verified:false,
   hosted_payment_authorized:false,real_signed_cost_risk_acceptance:false,
   real_rollback_consent:false,finance_reference:null
  },
  accessMath:offline()
 };
}
const safe=r=>{
 assert.equal(r.decision,'HARD_NO_GO');
 assert.equal(r.can_create_hosted_ledger,false);
 assert.equal(r.can_upload_qa_worker,false);
 assert.equal(r.can_change_access,false);
 assert.equal(r.can_change_billing,false);
 assert.equal(r.mutations_executed,false);
 assert.equal(r.real_cloudflare_access_mfa_verified,false);
 assert.equal(r.real_billing_cost_verified,false);
};
const block=(mut,id)=>{const f=fixture();mut(f);const r=assessSoloFounderPrivateCanary(f);safe(r);assert(r.blockers.includes(id),JSON.stringify(r.blockers));};
test('01 valid synthetic RSA Access token is CRYPTO ONLY, not live MFA',()=>{
 const r=offline();assert.equal(r.code,'OFFLINE_RSA_MATH_VALID_NOT_REAL_ACCESS');
 assert.equal(r.signature_math_verified,true);clearMath(r);
});
test('02 no token fails closed',()=>{const r=offline(null);assert.equal(r.signature_math_verified,false);clearMath(r)});
test('03 token with four segments fails',()=>assert.equal(offline(mint()+'.extra').signature_math_verified,false));
test('04 JWT none algorithm header blocked',()=>assert.equal(offline(mint({alg:'none'})).code,'JOSE_ALGORITHM_OR_KEY_REJECTED'));
test('05 JWT HS256 confusion blocked',()=>assert.equal(offline(mint({alg:'HS256'})).code,'JOSE_ALGORITHM_OR_KEY_REJECTED'));
test('06 JWT ES256 confusion blocked',()=>assert.equal(offline(mint({alg:'ES256'})).code,'JOSE_ALGORITHM_OR_KEY_REJECTED'));
test('07 wrong kid blocked',()=>assert.equal(offline(mint({kid:'attacker-kid'})).signature_math_verified,false));
test('08 header extra attacker algorithm field rejected',()=>assert.equal(offline(mint({jku:'https://attacker.invalid/key'})).signature_math_verified,false));
test('09 bearer signing without private key blocked',()=>{
 const k=generateKeyPairSync('rsa',{modulusLength:2048});
 assert.equal(offline(mint({},{},k.privateKey)).code,'JWT_SIGNATURE_MISMATCH');
});
test('10 wrong issuer blocked',()=>assert.equal(offline(mint({}, {iss:'https://bad.cloudflareaccess.com'})).signature_math_verified,false));
test('11 wrong audience blocked',()=>assert.equal(offline(mint({}, {aud:'different-private-app-aud'})).signature_math_verified,false));
test('12 array audience with additional app blocked',()=>assert.equal(offline(mint({}, {aud:[AUD,'another-app']})).signature_math_verified,false));
test('13 exact single audience array is allowed synthetically',()=>assert.equal(offline(mint({}, {aud:[AUD]})).signature_math_verified,true));
test('14 attacker subject blocked',()=>assert.equal(offline(mint({}, {sub:'other-owner-subject-qa'})).signature_math_verified,false));
test('15 expired token blocked',()=>assert.equal(offline(mint({}, {exp:N-1})).signature_math_verified,false));
test('16 nbf in future blocked',()=>assert.equal(offline(mint({}, {nbf:N+10})).signature_math_verified,false));
test('17 iat in future blocked',()=>assert.equal(offline(mint({}, {iat:N+10})).signature_math_verified,false));
test('18 JWT longer than 15 minutes blocked',()=>assert.equal(offline(mint({}, {exp:N+1000})).signature_math_verified,false));
test('19 old token issued >15 min ago blocked',()=>assert.equal(offline(mint({}, {iat:N-1000,nbf:N-1000})).signature_math_verified,false));
test('20 forged PINNED issuer domain blocked',()=>assert.equal(offline(mint(),{pinnedIssuer:'https://attacker.invalid'}).signature_math_verified,false));
test('21 JWKS supplied HS256 key blocked',()=>assert.equal(offline(mint(),{pinnedJwk:{...JWK,kty:'oct'}}).signature_math_verified,false));
test('22 pinned key lacks signature use blocked',()=>assert.equal(offline(mint(),{pinnedJwk:{...JWK,use:'enc'}}).signature_math_verified,false));
test('23 wrong independent founder hash blocked',()=>assert.equal(offline(mint(),{pinnedFounderSubjectHash:'f'.repeat(64)}).signature_math_verified,false));
test('24 tampered JWT signature blocked',()=>{
 const t=mint().split('.');t[2]=t[2].slice(0,-4)+'ABCD';
 assert.equal(offline(t.join('.')).signature_math_verified,false);
});
test('25 JWT with arbitrary oversized content blocked',()=>assert.equal(offline('A'.repeat(9000)).signature_math_verified,false));
test('26 no live human MFA inferred even after synthetic math passes',()=>{
 const r=offline();assert.equal(r.signature_math_verified,true);
 assert.equal(r.live_access_verified,false);assert.equal(r.real_phishing_resistant_mfa_verified,false);
});
test('27 full sanitized 31-worker observation structurally consistent, still real HARD NO-GO',()=>{
 const r=assessSoloFounderPrivateCanary(fixture());
 assert.equal(r.source_only_structure_passed,true);assert.equal(r.blockers.length,3);
 assert.equal(r.synthetic_cost_envelope_is_not_hard_cap,true);safe(r);
});
test('28 absent all material blocks safely',()=>{
 const r=assessSoloFounderPrivateCanary();assert(r.blockers.length>=8);safe(r);
});
test('29 stale 61-second inventory blocked',()=>block(f=>{
 f.observation.capture_time=new Date(NOW-61000).toISOString();
},'FRESH_CLOUDFLARE_READ_ONLY_OBSERVATION'));
test('30 missing GET only evidence blocked',()=>block(f=>{
 f.observation.methods=['GET','POST'];
},'FRESH_CLOUDFLARE_READ_ONLY_OBSERVATION'));
test('31 fake attested provenance cannot be assumed from caller string',()=>block(f=>{
 f.observation.observed_by='TRUST_ME_SIGNED';
},'FRESH_CLOUDFLARE_READ_ONLY_OBSERVATION'));
test('32 parallel Worker count drift fails closed until next fresh GET',()=>block(f=>{
 f.observation.worker_count=32;
},'INVENTORY_COMPLETE_AND_TARGETS_ABSENT'));
test('33 worker and script count mismatch rejected',()=>block(f=>{
 f.observation.script_count=30;
},'INVENTORY_COMPLETE_AND_TARGETS_ABSENT'));
test('34 target ledger collision rejected',()=>block(f=>{
 f.observation.worker_names[0]=LEDGER;
},'INVENTORY_COMPLETE_AND_TARGETS_ABSENT'));
test('35 target QA Worker collision rejected',()=>block(f=>{
 f.observation.worker_names[0]=WORKER;
},'INVENTORY_COMPLETE_AND_TARGETS_ABSENT'));
test('36 missing protected Zalo DO rejected',()=>block(f=>{
 f.observation.do_namespaces.pop();
},'INVENTORY_COMPLETE_AND_TARGETS_ABSENT'));
test('37 wrong protected replay DO owner rejected',()=>block(f=>{
 f.observation.do_namespaces[0].script='unexpected-owner';
},'INVENTORY_COMPLETE_AND_TARGETS_ABSENT'));
test('38 duplicated worker name rejected',()=>block(f=>{
 f.observation.worker_names[1]=f.observation.worker_names[0];
},'INVENTORY_COMPLETE_AND_TARGETS_ABSENT'));
test('39 Cloudflare OTP without separate MFA is NOT assumed sufficient',()=>block(f=>{
 f.observation.access_idp_types=['onetimepin'];
},'ACCESS_IDP_PRESENT_MFA_NOT_ASSUMED'));
test('40 duplicate IdP types rejected',()=>block(f=>{
 f.observation.access_idp_types=['cloudflare','onetimepin','onetimepin'];
},'ACCESS_IDP_PRESENT_MFA_NOT_ASSUMED'));
test('41 forged Billing 200 status from connector when actually 403 blocks',()=>block(f=>{
 f.observation.billing_spend_policies_status=200;
},'BILLING_API_403_RECORDED_NOT_LAUNDERED'));
test('42 Billing usage status absent blocks',()=>block(f=>{
 f.observation.billing_usage_status=null;
},'BILLING_API_403_RECORDED_NOT_LAUNDERED'));
test('43 wrong account in cost envelope blocks',()=>block(f=>{
 f.desired.account_id='other';
},'SOURCE_GIT_AND_NO_SEND_TARGET_SCOPE'));
test('44 invalid exact source git SHA blocks',()=>block(f=>{
 f.desired.source_commit='HEAD';
},'SOURCE_GIT_AND_NO_SEND_TARGET_SCOPE'));
test('45 live Messenger send cannot be allowed',()=>block(f=>{
 f.desired.no_live_sends=false;
},'SOURCE_GIT_AND_NO_SEND_TARGET_SCOPE'));
test('46 public development URL cannot be allowed',()=>block(f=>{
 f.desired.no_workers_dev=false;
},'SOURCE_GIT_AND_NO_SEND_TARGET_SCOPE'));
test('47 custom domain cannot be allowed',()=>block(f=>{
 f.desired.no_custom_domain=false;
},'SOURCE_GIT_AND_NO_SEND_TARGET_SCOPE'));
test('48 no auto-deploy cannot be false',()=>block(f=>{
 f.desired.no_auto_deploy=false;
},'SOURCE_GIT_AND_NO_SEND_TARGET_SCOPE'));
test('49 51 request quota exceeds synthetic ceiling',()=>block(f=>{
 f.desired.proposed_max_requests=51;
},'STRICT_SYNTHETIC_RATE_TIME_AND_USD_ENVELOPE'));
test('50 16 minute time window exceeds synthetic ceiling',()=>block(f=>{
 f.desired.proposed_max_minutes=16;
},'STRICT_SYNTHETIC_RATE_TIME_AND_USD_ENVELOPE'));
test('51 $26 exceeds synthetic ceiling',()=>block(f=>{
 f.desired.proposed_max_usd=26;
},'STRICT_SYNTHETIC_RATE_TIME_AND_USD_ENVELOPE'));
test('52 zero dollar budget invalid as a positive authorization',()=>block(f=>{
 f.desired.proposed_max_usd=0;
},'STRICT_SYNTHETIC_RATE_TIME_AND_USD_ENVELOPE'));
test('53 NaN as budget rejected',()=>block(f=>{
 f.desired.proposed_max_usd=NaN;
},'STRICT_SYNTHETIC_RATE_TIME_AND_USD_ENVELOPE'));
test('54 owner consent missing remains NO-GO regardless synthetic cost maths',()=>{
 const r=assessSoloFounderPrivateCanary(fixture());safe(r);
 assert.equal(r.approved_positive_usd_budget_verified,false);
});
test('55 real Billing UI cannot be asserted by source fixture',()=>block(f=>{
 f.finance.reported_budget_usd=2;
},'REAL_FINANCE_CONSENT_REMAINS_NULL'));
test('56 fake real Founder MFA from caller rejected',()=>block(f=>{
 f.finance.founder_mfa_verified_out_of_band=true;
},'REAL_FINANCE_CONSENT_REMAINS_NULL'));
test('57 fake invoice reference in source blocked',()=>block(f=>{
 f.finance.finance_reference='https://attacker.invalid/bill';
},'REAL_FINANCE_CONSENT_REMAINS_NULL'));
test('58 client cannot inject real public access status',()=>block(f=>{
 f.accessMath={...f.accessMath,live_access_verified:true};
},'OFFLINE_RSA_CAN_NOT_PROVE_HOSTED_ACCESS'));
test('59 extra bearer token inside observation rejected',()=>block(f=>{
 f.observation.access_token='synthetic-secret';
},'FRESH_CLOUDFLARE_READ_ONLY_OBSERVATION'));
test('60 all outputs always NO-GO even if cryptographic RSA math valid',()=>{
 for(const t of [offline(),offline(mint({}, {exp:N-1}))]){
  const f=fixture();f.accessMath=t;
  const r=assessSoloFounderPrivateCanary(f);
  safe(r);assert.equal(r.can_create_r2,false);
 }
});
