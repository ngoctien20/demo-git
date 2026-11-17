/**
 * TIEN404 V17.4P-HOSTED.4B.12 — Solo-Founder Real Access MFA × Billing
 * Authority Read-Only UAT × Cost-Bounded Private Canary Admission (NO-GO).
 *
 * Source-only: NO Cloudflare calls, network access, DOM, secrets, paid
 * mutations, file upload, real invoices, customer data or live provider send.
 *
 * Offline RSA JWT verification proves only mathematical signature matching
 * against the *caller-provided*, synthetically pinned public key. It DOES NOT
 * prove that a live Cloudflare Access app, IdP or phishing-resistant MFA used
 * that key. Thus no function in this module may authorize a hosted action.
 */
import {createHash,createPublicKey,verify as cryptoVerify} from 'node:crypto';
import {ACCOUNT,LEDGER,WORKER} from './hosted4b4-independent-finance-ledger-gate.mjs';

export const CONTRACT='T404_V174P_HOSTED4B12_SOLO_FOUNDER_ACCESS_BILLING_CANARY_NOGO_V1';
export const PHASE='PRIVATE_CANARY_ADMISSION_REVIEW_NO_DEPLOY';
export const ALLOWED_METHOD='GET_ONLY';
const isObject=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const sha256=x=>createHash('sha256').update(x,'utf8').digest('hex');
const hex=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const sortedKeys=x=>isObject(x)?Object.keys(x).sort():[];
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const exact=(x,k)=>equal(sortedKeys(x),[...k].sort());
const safeTime=v=>typeof v==='string'&&!Number.isNaN(Date.parse(v))&&new Date(Date.parse(v)).toISOString()===v;
const forbiddenOpaque=(x)=>typeof x==='string'&&/^[a-z0-9-]{8,80}$/.test(x);
const noGo=(code,extra={})=>Object.freeze({
 contract:CONTRACT,decision:'HARD_NO_GO',code,...extra,
 real_cloudflare_access_mfa_verified:false,
 founder_real_identity_verified:false,
 live_jwks_provenance_verified:false,
 real_billing_cost_verified:false,
 approved_positive_usd_budget_verified:false,
 private_hosted_browser_uat_passed:false,
 private_durable_nonce_accepted:false,
 can_create_hosted_ledger:false,can_upload_qa_worker:false,
 can_change_billing:false,can_change_access:false,
 can_create_r2:false,can_enable_public_url:false,
 can_send_messenger_zalo:false,can_touch_customer_data:false,
 mutations_executed:false
});
const decodePart=(seg,max)=>{
 if(typeof seg!=='string'||seg.length<2||seg.length>max||!(/^[A-Za-z0-9_-]+$/).test(seg))
  return null;
 const buf=Buffer.from(seg,'base64url');
 if(buf.toString('base64url')!==seg)return null;
 try{return JSON.parse(buf.toString('utf8'))}catch{return null;}
};
/** OFFLINE cryptographic JWT check; public keys/issuer supplied at invocation
 * must not be mistaken for independent Cloudflare trust roots.
 */
export function verifySyntheticPinnedAccessJwt({
 token,pinnedIssuer,pinnedAudience,pinnedFounderSubjectHash,pinnedJwk,nowSeconds
}={}){
 const base=()=>({signature_math_verified:false,live_access_verified:false,
   real_phishing_resistant_mfa_verified:false,can_authorize_spend:false,
   can_access_private_intake:false});
 const deny=code=>Object.freeze({...base(),code});
 if(typeof token!=='string'||token.length>8192||token.split('.').length!==3||
  typeof pinnedIssuer!=='string'||!/^https:\/\/[a-z0-9.-]+\.cloudflareaccess\.com$/.test(pinnedIssuer)||
  !forbiddenOpaque(pinnedAudience)||!hex(pinnedFounderSubjectHash)||
  !Number.isSafeInteger(nowSeconds)||!isObject(pinnedJwk)||
  pinnedJwk.kty!=='RSA'||pinnedJwk.alg!=='RS256'||
  pinnedJwk.use!=='sig'||typeof pinnedJwk.kid!=='string'||!forbiddenOpaque(pinnedJwk.kid)||
  typeof pinnedJwk.n!=='string'||typeof pinnedJwk.e!=='string')
  return deny('STRICT_OFFLINE_JWT_INPUT_REQUIRED');
 const segments=token.split('.');
 const header=decodePart(segments[0],1024),claims=decodePart(segments[1],4096);
 if(!isObject(header)||!exact(header,['alg','kid','typ'])||
   header.alg!=='RS256'||header.typ!=='JWT'||header.kid!==pinnedJwk.kid)
   return deny('JOSE_ALGORITHM_OR_KEY_REJECTED');
 const audValid=typeof claims?.aud==='string'?claims.aud===pinnedAudience:
  Array.isArray(claims?.aud)&&claims.aud.length===1&&claims.aud[0]===pinnedAudience;
 if(!isObject(claims)||claims.iss!==pinnedIssuer||!audValid||
   typeof claims.sub!=='string'||claims.sub.length<8||claims.sub.length>256||
   sha256(claims.sub)!==pinnedFounderSubjectHash||
   !Number.isSafeInteger(claims.exp)||!Number.isSafeInteger(claims.iat)||
   !Number.isSafeInteger(claims.nbf)||claims.exp<=nowSeconds||
   claims.nbf>nowSeconds||claims.iat>nowSeconds||
   claims.exp-claims.iat>15*60||nowSeconds-claims.iat>15*60||
   claims.exp<=claims.iat||claims.nbf<claims.iat)
   return deny('ISSUER_AUDIENCE_SUBJECT_OR_TTL_REJECTED');
 const s=segments[2];
 if(!/^[A-Za-z0-9_-]+$/.test(s)||s.length>1024)
  return deny('INVALID_SIGNATURE_ENCODING');
 const bytes=Buffer.from(s,'base64url');
 if(bytes.length<256||bytes.length>1024||bytes.toString('base64url')!==s)
  return deny('INVALID_SIGNATURE_ENCODING');
 try{
  const {kty,n,e}=pinnedJwk;
  const key=createPublicKey({key:{kty,n,e},format:'jwk'});
  if(key.asymmetricKeyType!=='rsa'||(key.asymmetricKeyDetails?.modulusLength||0)<2048)
   return deny('WEAK_OR_INVALID_JWK');
  if(!cryptoVerify('RSA-SHA256',Buffer.from(segments[0]+'.'+segments[1]),key,bytes))
   return deny('JWT_SIGNATURE_MISMATCH');
 }catch{return deny('JWK_OR_SIGNATURE_ERROR')}
 return Object.freeze({...base(),code:'OFFLINE_RSA_MATH_VALID_NOT_REAL_ACCESS',
   signature_math_verified:true});
}

const protectedDO=[
 ['tien404-v175e2-durable-replay-nosend-staging_ReplayBucket',
  'tien404-v175e2-durable-replay-nosend-staging','ReplayBucket'],
 ['tien404-v175e2a-private-hosted-runner-nosend-staging_RunnerResults',
  'tien404-v175e2a-private-hosted-runner-nosend-staging','RunnerResults'],
 ['tien404-v1721h2-zalo-replay-private-nosend-staging_ZaloBotReplayBucketV2',
  'tien404-v1721h2-zalo-replay-private-nosend-staging','ZaloBotReplayBucketV2']
];
const observationKeys=[
 'account_id','capture_time','methods','worker_count','script_count',
 'worker_names','do_namespaces','access_app_count','access_idp_types',
 'accepted_superadmin_count','billing_spend_policies_status',
 'billing_usage_status','billing_profile_status','observed_by'
];
const desiredKeys=[
 'phase','account_id','target_ledger','target_qa_worker','source_commit',
 'inventory_sha256','founder_subject_sha256','proposed_max_requests',
 'proposed_max_minutes','proposed_max_usd','private_access_only',
 'no_workers_dev','no_preview_url','no_custom_domain','no_live_sends',
 'no_customer_reads','no_billing_change','no_access_change','no_auto_deploy'
];
const financeKeys=[
 'status','account_id','source','reported_budget_usd','billing_period',
 'founder_mfa_verified_out_of_band','spend_scope_verified','hosted_payment_authorized',
 'real_signed_cost_risk_acceptance','real_rollback_consent',
 'finance_reference'
];
/**
 * A current GET snapshot entered here is still untrusted JSON; verify
 * provenance through a separate independent control-plane collector.
 * This function only enforces source-local consistency and default DENY.
 */
export function assessSoloFounderPrivateCanary({observation,desired,finance,accessMath,now=Date.now()}={}){
 const o=isObject(observation)?observation:{},d=isObject(desired)?desired:{},f=isObject(finance)?finance:{};
 const checks=[],add=(id,passed)=>checks.push({id,status:passed===true?'STRUCTURE_OK_ONLY':'BLOCKED'});
 add('FRESH_CLOUDFLARE_READ_ONLY_OBSERVATION',
  exact(o,observationKeys)&&o.account_id===ACCOUNT&&
  equal(o.methods,['GET'])&&o.observed_by==='CONNECTED_CLOUDFLARE_READ_ONLY_NOT_ATTESTED'&&
  safeTime(o.capture_time)&&Number.isSafeInteger(now)&&
  Date.parse(o.capture_time)<=now&&now-Date.parse(o.capture_time)<=60_000);
 add('INVENTORY_COMPLETE_AND_TARGETS_ABSENT',
  Number.isSafeInteger(o.worker_count)&&o.worker_count>0&&
  o.worker_count===o.script_count&&
  Array.isArray(o.worker_names)&&o.worker_names.length===o.worker_count&&
  new Set(o.worker_names).size===o.worker_names.length&&
  !o.worker_names.includes(LEDGER)&&!o.worker_names.includes(WORKER)&&
  Array.isArray(o.do_namespaces)&&o.do_namespaces.length>=protectedDO.length&&
  new Set(o.do_namespaces.map(v=>v.name)).size===o.do_namespaces.length&&
  protectedDO.every(([name,script,clazz])=>o.do_namespaces.some(v=>
   v.name===name&&v.script===script&&v.class===clazz))&&
  o.access_app_count>=1&&o.accepted_superadmin_count===1);
 add('ACCESS_IDP_PRESENT_MFA_NOT_ASSUMED',
  Array.isArray(o.access_idp_types)&&
  o.access_idp_types.includes('cloudflare')&&
  o.access_idp_types.includes('onetimepin')&&
  new Set(o.access_idp_types).size===o.access_idp_types.length);
 add('BILLING_API_403_RECORDED_NOT_LAUNDERED',
  o.billing_spend_policies_status===403&&o.billing_usage_status===403&&
  o.billing_profile_status===403);
 add('SOURCE_GIT_AND_NO_SEND_TARGET_SCOPE',
  exact(d,desiredKeys)&&d.phase===PHASE&&d.account_id===ACCOUNT&&
  d.target_ledger===LEDGER&&d.target_qa_worker===WORKER&&
  typeof d.source_commit==='string'&&/^[a-f0-9]{40}$/.test(d.source_commit)&&
  hex(d.inventory_sha256)&&hex(d.founder_subject_sha256)&&
  ['private_access_only','no_workers_dev','no_preview_url','no_custom_domain',
   'no_live_sends','no_customer_reads','no_billing_change','no_access_change',
   'no_auto_deploy'].every(k=>d[k]===true));
 add('STRICT_SYNTHETIC_RATE_TIME_AND_USD_ENVELOPE',
  Number.isSafeInteger(d.proposed_max_requests)&&
  d.proposed_max_requests>=1&&d.proposed_max_requests<=50&&
  Number.isSafeInteger(d.proposed_max_minutes)&&
  d.proposed_max_minutes>=1&&d.proposed_max_minutes<=15&&
  typeof d.proposed_max_usd==='number'&&Number.isFinite(d.proposed_max_usd)&&
  d.proposed_max_usd>0&&d.proposed_max_usd<=25);
 add('REAL_FINANCE_CONSENT_REMAINS_NULL',
  exact(f,financeKeys)&&f.account_id===ACCOUNT&&
  f.status==='NO_INDEPENDENT_BILLING_OR_MFA_EVIDENCE'&&
  f.source==='BILLING_API_403'&&
  f.reported_budget_usd===null&&f.billing_period===null&&
  f.founder_mfa_verified_out_of_band===false&&
  f.spend_scope_verified===false&&f.hosted_payment_authorized===false&&
  f.real_signed_cost_risk_acceptance===false&&f.real_rollback_consent===false&&
  f.finance_reference===null);
 add('OFFLINE_RSA_CAN_NOT_PROVE_HOSTED_ACCESS',
  isObject(accessMath)&&accessMath.real_phishing_resistant_mfa_verified===false&&
  accessMath.live_access_verified===false&&
  accessMath.can_authorize_spend===false);
 add('REAL_FOUNDER_MFA_WITH_ACCESS_PROTECTED_HOSTED_UAT',false);
 add('FINANCE_BILLING_PERMISSION_AND_REAL_APPROVED_COST',false);
 add('SIGNED_ONE_USE_PRIVATE_LEDGER_AND_RELEASE_ROLLBACK',false);
 return noGo('SOLO_FOUNDER_PRIVATE_CANARY_ADMISSION_NOT_AUTHORIZED',{
  checks:Object.freeze(checks),
  blockers:Object.freeze(checks.filter(v=>v.status==='BLOCKED').map(v=>v.id)),
  source_only_structure_passed:checks.slice(0,8).every(v=>v.status==='STRUCTURE_OK_ONLY'),
  detected_parallel_workers:o.worker_count??null,
  existing_idp_types_sanitized:Array.isArray(o.access_idp_types)?[...o.access_idp_types]:[],
  synthetic_cost_envelope_is_not_hard_cap:true
 });
}
