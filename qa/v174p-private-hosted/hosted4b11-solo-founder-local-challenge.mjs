/**
 * TIEN404 V17.4P-HOSTED.4B.11 — SOLO FOUNDER LOCAL IDENTITY CHALLENGE
 *
 * Owner and Finance may be the same real human in a one-person project.
 * Do NOT invent independent Finance/Auditor humans or reuse production keys.
 *
 * This is an in-memory, LOCAL ONLY proof of protocol behavior. No IdP,
 * durable ledger, Cloudflare signed identity, real finance evidence, remote
 * access, hosted resource deployment or billable operation is provided.
 */
import {createHash,createPublicKey,randomBytes,verify as edVerify} from 'node:crypto';
import {ACCOUNT} from './hosted4b4-independent-finance-ledger-gate.mjs';

export const CONTRACT='T404_V174P_HOSTED4B11_SOLO_FOUNDER_LOCAL_ACCEPTANCE_V1';
export const LOCAL_SCOPE='LOCAL_CHALLENGE_QA_NO_HOSTED_UPLOAD';
export const SINGLE_FOUNDER_ROLE='OWNER_AND_FINANCE_SAME_REAL_HUMAN';
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const hash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const sha=x=>createHash('sha256').update(x,'utf8').digest('hex');
function canonical(x) {
 if(Array.isArray(x))return '['+x.map(canonical).join(',')+']';
 if(obj(x))return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}';
 return JSON.stringify(x);
}
export const digest=x=>sha(canonical(x));
const noGo=(code,detail={})=>Object.freeze({
 contract:CONTRACT,code,status:'NO_HOSTED_AUTHORITY',...detail,
 independence_claimed:false,real_founder_identity_verified:false,
 real_finance_budget_verified:false,cloudflare_billing_403_resolved:false,
 private_hosted_idp_verified:false,durable_replay_verified:false,
 can_create_hosted_ledger:false,can_upload_qa_worker:false,
 can_change_billing:false,can_change_access:false,
 can_accept_real_finance_document:false,can_send_provider_messages:false,
 can_write_commerce:false,mutations_executed:false
});
const validSignature=s=>typeof s==='string'&&/^[A-Za-z0-9_-]{86}$/.test(s) &&
 Buffer.from(s,'base64url').length===64 &&
 Buffer.from(s,'base64url').toString('base64url')===s;
function getKey(pem){
 const k=createPublicKey(pem);
 if(k.asymmetricKeyType!=='ed25519')throw Error('Ed25519 public key required');
 return k;
}
/** Local ephemeral admission; fixed pre-registered public key from explicit
 * constructor config. A public key supplied via this constructor is NOT
 * independently certified identity proof.
 */
export function createLocalSoloFounderChallenge({
 expectedGitSha,founderSubjectHash,registeredKeyId,registeredSpkiPem,
 accountId=ACCOUNT,clock=()=>Date.now(),maxPending=32
}={}){
 if(accountId!==ACCOUNT||typeof expectedGitSha!=='string'||
    !/^[a-f0-9]{40}$/.test(expectedGitSha)||!hash(founderSubjectHash)||
    typeof registeredKeyId!=='string'||!/^[a-z0-9-]{8,80}$/.test(registeredKeyId)||
    typeof registeredSpkiPem!=='string'||!Number.isSafeInteger(maxPending)||
    maxPending<1||maxPending>256||typeof clock!=='function')throw Error('Invalid local-only configuration');
 const key=getKey(registeredSpkiPem);
 const pending=new Map();
 let successes=0,attempted=0;
 function issue({
  account_id,source_git_sha,subject_sha256,scope,identity_mode,
  role_separation_waiver,owner_finance_same_person_ack,
  account_spend_risk_ack,no_hard_invoice_cap_ack,source_only
 }={}){
  const at=clock();
  if(!Number.isSafeInteger(at)||account_id!==ACCOUNT||
     source_git_sha!==expectedGitSha||subject_sha256!==founderSubjectHash||
     scope!==LOCAL_SCOPE||identity_mode!==SINGLE_FOUNDER_ROLE||
     role_separation_waiver!=='SOLO_FOUNDER_QA_ONLY'||
     owner_finance_same_person_ack!==true||
     account_spend_risk_ack!==true||no_hard_invoice_cap_ack!==true||
     source_only!==true)return noGo('INVALID_LOCAL_SCOPE_OR_ACK');
  for(const [nonce,v] of pending){
   if(v.expiresAt<=at)pending.delete(nonce);
  }
  if(pending.size>=maxPending)return noGo('LOCAL_RATE_LIMIT');
  const nonce=randomBytes(32).toString('hex');
  const payload=Object.freeze({
   contract:CONTRACT,account_id:ACCOUNT,
   source_git_sha:expectedGitSha,subject_sha256:founderSubjectHash,
   scope:LOCAL_SCOPE,identity_mode:SINGLE_FOUNDER_ROLE,
   role_separation_waiver:'SOLO_FOUNDER_QA_ONLY',
   independent_finance_or_auditor_present:false,
   nonce,issued_at:new Date(at).toISOString(),
   expires_at:new Date(at+120000).toISOString()
  });
  pending.set(nonce,{payload,expiresAt:at+120000,attempts:0,used:false});
  return Object.freeze({...noGo('LOCAL_CHALLENGE_ISSUED_NOT_HOSTED'),
   challenge:payload});
 }
 function complete({challenge,signature,key_id}={}){
  attempted++;
  const nonce=challenge?.nonce;
  const v=typeof nonce==='string'?pending.get(nonce):undefined;
  const at=clock();
  if(!v)return noGo('CHALLENGE_UNKNOWN_OR_EVICTED');
  if(v.used)return noGo('REPLAY_REJECTED');
  if(!Number.isSafeInteger(at)||at<v.expiresAt-120000||at>=v.expiresAt){
   pending.delete(nonce);
   return noGo('CHALLENGE_EXPIRED');
  }
  if(v.attempts>=3)return noGo('CHALLENGE_ATTEMPTS_EXHAUSTED');
  v.attempts++;
  if(!obj(challenge)||digest(challenge)!==digest(v.payload)||
     key_id!==registeredKeyId||!validSignature(signature)){
   return noGo('INVALID_CHALLENGE_BINDING_OR_SIGNATURE');
  }
  const matched=edVerify(null,Buffer.from('T404_4B11_LOCAL_CHALLENGE\n'+canonical(challenge)),
   key,Buffer.from(signature,'base64url'));
  if(!matched)return noGo('CRYPTO_SIGNATURE_INVALID');
  v.used=true;
  successes++;
  return noGo('LOCAL_CRYPTO_CHALLENGE_ACCEPTED_NOT_REAL_IDENTITY',{
   local_challenge_math_passed:true,local_nonce_single_use_enforced_in_memory:true
  });
 }
 function stats(){return Object.freeze({
  in_memory_pending:pending.size,local_attempts:attempted,
  successful_local_signatures:successes,
  survives_restart:false,hosted_ledger_verified:false
 });}
 return Object.freeze({issue,complete,stats});
}
/**
 * Solo-Founder governance decision: correct roles without fictitious humans.
 * A stated chat authorization is not an independently authenticated release
 * permit. Only local test work can proceed; hosting & new spend remain NO-GO.
 */
export function assessSoloFounderGovernance({
 founder_role,owner_finance_same_real_person,
 separate_independent_finance_claim,external_human_auditor_claim,
 explicit_owner_authorized_local_qa,external_billing_approval,
 private_broker_hosted,real_finance_spend_usd_approved,
 private_rollback_consent,requested_scope
}={}){
 const reasons=[];
 if(founder_role!==SINGLE_FOUNDER_ROLE||owner_finance_same_real_person!==true)
  reasons.push('NO_GENUINE_SOLO_FOUNDER_ROLE');
 if(separate_independent_finance_claim!==false||external_human_auditor_claim!==false)
  reasons.push('FICTITIOUS_INDEPENDENT_PERSON_FORBIDDEN');
 if(explicit_owner_authorized_local_qa!==true||requested_scope!==LOCAL_SCOPE)
  reasons.push('LOCAL_QA_SCOPE_NOT_AUTHORIZED');
 if(external_billing_approval!==false||private_broker_hosted!==false||
    real_finance_spend_usd_approved!==null||private_rollback_consent!==false)
  reasons.push('UNVERIFIED_HOSTED_EVIDENCE_SELF_ASSERTED');
 return noGo(reasons.length?'GOVERNANCE_BLOCKED':'SOLO_FOUNDER_LOCAL_QA_READY',{
  reasons,can_run_local_no_send_qa:reasons.length===0,
  independent_technical_qa_required:true,
  human_finance_auditor_independence_available:false
 });
}
