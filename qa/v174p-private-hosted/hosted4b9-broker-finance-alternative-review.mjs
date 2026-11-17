/**
 * TIEN404 V17.4P-HOSTED.4B.9
 * PRIVATE IDENTITY BROKER READINESS × FINANCE EVIDENCE ALTERNATIVES
 * × INDEPENDENT HOSTED ADMISSION REVIEW — SOURCE / NO NETWORK / NO DEPLOY.
 *
 * This gate verifies *synthetic or supplied* Ed25519 signatures and strict
 * evidence metadata. Keys, booleans and audit receipts passed by the caller
 * are NOT independently trusted human identities or hosted Access proof.
 * Nothing in this module uploads a file, calls an API, changes Cloudflare,
 * creates a private endpoint or grants finance/production permissions.
 */
import {createHash,createPublicKey,verify as verifyEd} from 'node:crypto';
import {ACCOUNT,LEDGER,WORKER} from './hosted4b4-independent-finance-ledger-gate.mjs';
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const sorted=x=>obj(x)?Object.keys(x).sort():[];
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const exact=(x,k)=>same(sorted(x),[...k].sort());
const hex=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const iso=x=>typeof x==='string'&&Number.isFinite(Date.parse(x))&&new Date(Date.parse(x)).toISOString()===x;
const sha256=x=>createHash('sha256').update(x,'utf8').digest('hex');
function canonical(x){
 if(Array.isArray(x))return '['+x.map(canonical).join(',')+']';
 if(obj(x))return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}';
 return JSON.stringify(x);
}
export const digest=x=>sha256(canonical(x));
const within=(start,end,now,maxMs)=>iso(start)&&iso(end)&&Number.isSafeInteger(now)&&
 Date.parse(start)<=now&&now<Date.parse(end)&&
 Date.parse(end)-Date.parse(start)<=maxMs&&now-Date.parse(start)<=maxMs;
export const CONTRACT='T404_V174P_HOSTED4B9_BROKER_FINANCE_ALTERNATIVE_NO_GO_V1';
export const API='CLOUDFLARE_BILLING_API_READ_ONLY';
export const PRIVATE='PRIVATE_FINANCE_DUAL_REVIEW_RECEIPT';
const roles=['finance','auditor','security','operator'];
const financeFields=[
 'contract','mode','account_id','phase','target_worker','finance_subject_hash',
 'auditor_subject_hash','owner_delegation_sha256','billing_period_id',
 'ledger_budget_usd','qa_worker_budget_usd','cost_exposure_acknowledged',
 'do_storage_exclusion_acknowledged','hard_cost_cap_guaranteed',
 'private_ref','private_source_evidence_sha256','source_readonly_http_status',
 'private_scan_status','private_redaction_status','issued_at','expires_at',
 'nonce'
];
const brokerFields=[
 'contract','status','account_id','access_ingress','public_hostname_enabled',
 'public_dev_url_enabled','preview_enabled','credentials_in_repo',
 'private_idp_status','owner_mfa_status','finance_mfa_status',
 'revocation_check_status','out_of_band_root_status','audit_ledger_status',
 'file_scan_contract_status','private_storage_status',
 'trusted_live_identity_bindings','real_hosted_uat_complete'
];
const reviewFields=[
 'contract','account_id','phase','target_worker','repo_commit_sha',
 'target_manifest_sha256','cloudflare_snapshot_sha256',
 'owner_delegation_sha256','finance_receipt_sha256','broker_readiness_sha256',
 'security_reviewer_subject_hash','operator_subject_hash',
 'nonce','issued_at','expires_at','no_public_url','no_customer_writes',
 'no_provider_sends','no_billing_change','no_access_change',
 'no_resource_creation','approval_mode'
];
const snapshotFields=['account_id','capture_time_ms','source','methods_used',
 'workers','scripts','durable_objects','access_apps','members'].sort();
const listFields=['status','count','total_count','entries'].sort();
const protectedDo=[
 ['tien404-v175e2-durable-replay-nosend-staging_ReplayBucket',
 'tien404-v175e2-durable-replay-nosend-staging','ReplayBucket'],
 ['tien404-v175e2a-private-hosted-runner-nosend-staging_RunnerResults',
 'tien404-v175e2a-private-hosted-runner-nosend-staging','RunnerResults'],
 ['tien404-v1721h2-zalo-replay-private-nosend-staging_ZaloBotReplayBucketV2',
 'tien404-v1721h2-zalo-replay-private-nosend-staging','ZaloBotReplayBucketV2']
];
function checkSig(payload,sig,anchor,purpose){
 try{
  if(!obj(sig)||!obj(anchor)||anchor.registered_source!=='INDEPENDENT_PRIVATE_REGISTRY'||
     sig.key_id!==anchor.key_id||typeof sig.signature!=='string'||
     !/^[A-Za-z0-9_-]{86}$/.test(sig.signature))return false;
  const b=Buffer.from(sig.signature,'base64url');
  if(b.length!==64||b.toString('base64url')!==sig.signature)return false;
  const key=createPublicKey(anchor.spki_pem);
  return key.asymmetricKeyType==='ed25519'&&verifyEd(null,
   Buffer.from('T404_V174P_4B9:'+purpose+'\n'+canonical(payload)),key,b);
 }catch{return false;}
}
function finish(errors,mode,brokerStatus){
 return Object.freeze({
  contract:CONTRACT,
  decision:errors.length?'BLOCKED':'CRYPTOGRAPHIC_MATH_ONLY_HOSTED_NOT_AUTHORIZED',
  reasons:[...new Set(errors)],
  assessed_finance_mode:mode||null,
  broker_readiness_status:brokerStatus||null,
  independent_live_identity_verified:false,
  finance_receipt_real_provenance_verified:false,
  private_broker_hosted_verified:false,
  private_intake_hosted_uat_passed:false,
  real_finance_delegation_accepted:false,
  durable_nonce_proof_accepted:false,
  can_create_ledger:false,can_upload_qa_worker:false,
  can_change_access:false,can_change_billing:false,
  can_upload_document:false,can_send_provider_messages:false,
  can_write_commerce:false,
  mutations_executed:false
 });
}
/**
 * Source-only review. A signed PRIVATE evidence receipt may supplement an API
 * 403 for consideration by a human independent reviewer; it does NOT turn a
 * 403 into read access or into authorization. No screenshots/PDFs/URLs here.
 */
export function assessIndependentHostedAdmission({
 financeReceipt,brokerReadiness,independentReview,cloudflareSnapshot,
 signatures,trustRoots,now=Date.now()
}={}){
 const errors=[],assert=(key,pass)=>{if(pass!==true)errors.push(key);};
 const f=obj(financeReceipt)?financeReceipt:{};
 const b=obj(brokerReadiness)?brokerReadiness:{};
 const a=obj(independentReview)?independentReview:{};
 const s=obj(cloudflareSnapshot)?cloudflareSnapshot:{};
 const sig=obj(signatures)?signatures:{};
 const t=obj(trustRoots)?trustRoots:{};

 assert('strict_finance_metadata_no_raw_files',exact(f,financeFields));
 assert('one_of_two_declared_finance_evidence_paths',
  f.contract===CONTRACT&&(f.mode===API||f.mode===PRIVATE)&&
  f.account_id===ACCOUNT&&f.phase==='LEDGER_FIRST_INACTIVE_UPLOAD'&&
  f.target_worker===LEDGER&&
  hex(f.owner_delegation_sha256)&&hex(f.private_source_evidence_sha256)&&
  hex(f.finance_subject_hash)&&hex(f.auditor_subject_hash)&&
  f.finance_subject_hash!==f.auditor_subject_hash);
 assert('signed_budget_and_storage_exposure_not_hard_cap',
  Number.isFinite(f.ledger_budget_usd)&&f.ledger_budget_usd>0&&
  Number.isFinite(f.qa_worker_budget_usd)&&f.qa_worker_budget_usd>0&&
  f.ledger_budget_usd+f.qa_worker_budget_usd<=25&&
  f.cost_exposure_acknowledged===true&&
  f.do_storage_exclusion_acknowledged===true&&
  f.hard_cost_cap_guaranteed===false&&
  typeof f.billing_period_id==='string'&&
  /^[a-z0-9-]{8,64}$/.test(f.billing_period_id));
 assert('fresh_finance_receipt_and_nonce',
  within(f.issued_at,f.expires_at,now,15*60_000)&&
  typeof f.nonce==='string'&&/^[a-f0-9]{64}$/.test(f.nonce));
 assert('api_or_private_alternative_specific_constraints',
  f.mode===API?
   (f.source_readonly_http_status===200&&f.private_ref===null&&
    f.private_scan_status==='NOT_APPLICABLE'&&
    f.private_redaction_status==='NOT_APPLICABLE'):
   (f.mode===PRIVATE&&f.source_readonly_http_status===403&&
    typeof f.private_ref==='string'&&/^EV-[A-Za-z0-9_-]{8,64}$/.test(f.private_ref)&&
    f.private_scan_status==='PRIVATE_SCANNER_PASSED'&&
    f.private_redaction_status==='PRIVATE_REVIEW_REDACTED'));
 assert('strict_source_only_private_broker_readiness',
  exact(b,brokerFields)&&b.contract===CONTRACT&&b.account_id===ACCOUNT&&
  b.status==='READINESS_SPEC_NOT_HOSTED'&&
  b.access_ingress==='REQUIRES_INDEPENDENT_CLOUDFLARE_ACCESS'&&
  b.public_hostname_enabled===false&&b.public_dev_url_enabled===false&&
  b.preview_enabled===false&&b.credentials_in_repo===false&&
  b.private_idp_status==='NOT_PROVISIONED'&&
  b.owner_mfa_status==='NOT_VERIFIED'&&b.finance_mfa_status==='NOT_VERIFIED'&&
  b.revocation_check_status==='NOT_PROVISIONED'&&
  b.out_of_band_root_status==='NOT_INSTALLED'&&
  b.audit_ledger_status==='NOT_DEPLOYED'&&
  b.file_scan_contract_status==='SPEC_ONLY'&&
  b.private_storage_status==='NOT_PROVISIONED'&&
  b.trusted_live_identity_bindings===false&&
  b.real_hosted_uat_complete===false);
 assert('independent_review_enforces_no_deploy',
  exact(a,reviewFields)&&a.contract===CONTRACT&&a.account_id===ACCOUNT&&
  a.phase==='LEDGER_FIRST_INACTIVE_UPLOAD'&&a.target_worker===LEDGER&&
  typeof a.repo_commit_sha==='string'&&/^[a-f0-9]{40}$/.test(a.repo_commit_sha)&&
  hex(a.target_manifest_sha256)&&
  a.owner_delegation_sha256===f.owner_delegation_sha256&&
  a.finance_receipt_sha256===digest(f)&&
  a.broker_readiness_sha256===digest(b)&&
  hex(a.security_reviewer_subject_hash)&&hex(a.operator_subject_hash)&&
  a.security_reviewer_subject_hash!==a.operator_subject_hash&&
  a.security_reviewer_subject_hash!==f.finance_subject_hash&&
  a.operator_subject_hash!==f.finance_subject_hash&&
  a.no_public_url===true&&a.no_customer_writes===true&&
  a.no_provider_sends===true&&a.no_billing_change===true&&
  a.no_access_change===true&&a.no_resource_creation===true&&
  a.approval_mode==='READ_ONLY_REVIEW_NOT_UPLOAD'&&
  typeof a.nonce==='string'&&/^[a-f0-9]{64}$/.test(a.nonce)&&
  a.nonce!==f.nonce&&within(a.issued_at,a.expires_at,now,5*60_000));
 assert('four_independent_pre_registered_crypto_keys',
  exact(t,roles)&&exact(sig,roles)&&
  roles.every(r=>obj(t[r])&&t[r].role===r&&
   t[r].registered_source==='INDEPENDENT_PRIVATE_REGISTRY'&&
   typeof t[r].key_id==='string'&&t[r].key_id.length>=8&&
   typeof t[r].spki_pem==='string')&&
  new Set(roles.map(r=>t[r]?.key_id)).size===roles.length&&
  new Set(roles.map(r=>t[r]?.spki_pem)).size===roles.length);
 assert('finance_and_independent_auditor_sign_same_receipt',
  checkSig(f,sig.finance,t.finance,'FINANCE_EVIDENCE_RECEIPT')&&
  checkSig(f,sig.auditor,t.auditor,'INDEPENDENT_FINANCE_AUDIT'));
 assert('security_and_operator_sign_no_deploy_review',
  checkSig(a,sig.security,t.security,'SECURITY_HOSTED_NO_GO_REVIEW')&&
  checkSig(a,sig.operator,t.operator,'OPERATOR_NO_DEPLOY_REVIEW'));
 assert('current_read_only_control_plane_inventory',
  exact(s,snapshotFields)&&s.account_id===ACCOUNT&&
  s.source==='CLOUDFLARE_READ_ONLY_CONTROL_PLANE'&&
  same(s.methods_used,['GET'])&&
  Number.isSafeInteger(s.capture_time_ms)&&s.capture_time_ms<=now&&
  now-s.capture_time_ms<=60_000&&
  ['workers','scripts','durable_objects','access_apps','members'].every(name=>
   obj(s[name])&&exact(s[name],listFields)&&s[name].status==='COMPLETE'&&
   Array.isArray(s[name].entries)&&
   s[name].entries.length===s[name].count&&s[name].count===s[name].total_count)&&
  a.cloudflare_snapshot_sha256===digest(s));
 const workers=s.workers?.entries,scripts=s.scripts?.entries,ns=s.durable_objects?.entries;
 assert('no_target_name_collision_and_preserve_protected_namespaces',
  Array.isArray(workers)&&Array.isArray(scripts)&&Array.isArray(ns)&&
  workers.length>0&&new Set(workers).size===workers.length&&
  new Set(scripts).size===scripts.length&&
  same([...workers].sort(),[...scripts].sort())&&
  !workers.includes(LEDGER)&&!workers.includes(WORKER)&&
  new Set(ns.map(v=>v.name)).size===ns.length&&
  protectedDo.every(([name,script,klass])=>
   ns.some(v=>v.name===name&&v.script===script&&v.class===klass))&&
  !ns.some(v=>typeof v.name==='string'&&
   (v.name.includes(LEDGER)||v.name.includes(WORKER))));
 return finish(errors,f.mode,b.status);
}
