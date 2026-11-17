/**
 * TIEN404 V17.4P-HOSTED.4B.10
 * Real Finance Evidence Authority × Private Broker Admission Preflight
 * × Independent NO-DEPLOY Acceptance.
 *
 * Source-only and fail-closed. This source does not retrieve live Cloudflare
 * data, accept raw financial documents, deploy a Worker, or verify humans.
 * A caller-controlled receipt or public key is never proof of true authority.
 */
import {ACCOUNT,LEDGER,WORKER} from './hosted4b4-independent-finance-ledger-gate.mjs';

export const CONTRACT='T404_V174P_HOSTED4B10_INDEPENDENT_NO_DEPLOY_PREFLIGHT_V1';
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const exact=(x,fields)=>obj(x)&&eq(Object.keys(x).sort(),[...fields].sort());
const hash=x=>typeof x==='string'&&/^[0-9a-f]{64}$/.test(x);
const iso=x=>typeof x==='string'&&!Number.isNaN(Date.parse(x))&&new Date(Date.parse(x)).toISOString()===x;
const evidenceRef=x=>typeof x==='string'&&/^EV-[A-Za-z0-9_-]{8,64}$/.test(x);
const positive=x=>typeof x==='number'&&Number.isFinite(x)&&x>0;
const legalBasis=['DIRECT_BILLING_READ_ONLY','PRIVATE_DUAL_ATTESTED_FINANCE_REPORT'];
const receiptFields=[
 'account_id','evidence_path','source_http_status','billing_period',
 'finance_mandate_ref','invoice_or_usage_ref','finance_subject_hash',
 'auditor_subject_hash','finance_signer_registry_ref','auditor_signer_registry_ref',
 'attested_ledger_usd','attested_qa_worker_usd','explicit_cost_risk_acceptance',
 'hard_invoice_cap_guaranteed','private_scan_result',
 'private_redaction_result','proof_collected_at','proof_expires_at'
];
const brokerFields=[
 'account_id','mode','private_idp','access_protection','mfa_policy',
 'finance_and_owner_principals','private_storage','malware_scan',
 'trust_roots_out_of_band','durable_replay_ledger',
 'revocation_check','audit_log','hosted_browser_uat',
 'public_development_url','public_custom_domain','secrets_in_git',
 'payment_changes','production_webhook_binding'
];
const observationFields=[
 'account_id','method','observed_at','worker_count','script_count',
 'do_namespaces','access_apps_count','account_members_count',
 'accepted_super_admin_count','ledger_worker_exists',
 'qa_worker_exists','billing_spend_policies_http',
 'billing_usage_http','provenance'
];
const requiredDO=[
 {name:'tien404-v175e2-durable-replay-nosend-staging_ReplayBucket',script:'tien404-v175e2-durable-replay-nosend-staging',class:'ReplayBucket'},
 {name:'tien404-v175e2a-private-hosted-runner-nosend-staging_RunnerResults',script:'tien404-v175e2a-private-hosted-runner-nosend-staging',class:'RunnerResults'},
 {name:'tien404-v1721h2-zalo-replay-private-nosend-staging_ZaloBotReplayBucketV2',script:'tien404-v1721h2-zalo-replay-private-nosend-staging',class:'ZaloBotReplayBucketV2'}
];
const decisionFields=[
 'account_id','phase','target_worker','source_git_sha',
 'owner_consented','finance_consented','security_reviewed','operator_verified',
 'independent_auditor_verified','finance_scope_window','private_broker_approved',
 'rollback_approved','read_only_review','can_change_billing','can_create_ledger',
 'can_upload_qa_worker','can_modify_access','can_touch_commerce'
];
const maxFinanceAge=15*60_000;
const stop=(checks,detail)=>Object.freeze({
 contract:CONTRACT,decision:'HARD_NO_GO',
 checks:Object.freeze(checks.map(x=>Object.freeze(x))),
 blockers:Object.freeze(checks.filter(x=>x.status!=='SATISFIED_SYNTHETIC').map(x=>x.id)),
 ...detail,
 real_finance_authority_verified:false,
 real_private_broker_verified:false,
 independent_hosted_admission_accepted:false,
 real_hosted_uat_completed:false,
 can_create_ledger:false,can_upload_qa_worker:false,
 can_enable_public_url:false,can_change_access:false,
 can_change_billing:false,can_store_private_document:false,
 can_write_commerce:false,can_send_provider_messages:false,
 mutations_executed:false
});
/**
 * Evaluates only a sanitized admission evidence *contract*. No trust root,
 * staff credentials, bank/invoice bytes, URL, JWT or Merchant PII is accepted.
 * Authenticated real collection, mandate validity and role enrollment must
 * occur in a separate, independently approved private system.
 */
export function assessRealFinanceNoDeployPreflight({
 observation,finance,broker,independentDecision,now=Date.now()
}={}){
 const o=obj(observation)?observation:{};
 const f=obj(finance)?finance:{};
 const b=obj(broker)?broker:{};
 const d=obj(independentDecision)?independentDecision:{};
 const checks=[],add=(id,pass)=>checks.push({id,status:pass?'SATISFIED_SYNTHETIC':'BLOCKED'});
 const nowValid=Number.isSafeInteger(now);
 add('strict_sanitized_read_only_observation',exact(o,observationFields)&&
  o.account_id===ACCOUNT&&o.method==='GET_ONLY'&&
  o.provenance==='TOOL_RESULT_SUMMARY_NOT_SIGNED_OR_ATTESTED'&&
  iso(o.observed_at)&&nowValid&&Date.parse(o.observed_at)<=now&&
  now-Date.parse(o.observed_at)<=60_000);
 add('complete_noncolliding_cloudflare_inventory',Number.isSafeInteger(o.worker_count)&&
  o.worker_count>0&&o.worker_count===o.script_count&&
  Number.isSafeInteger(o.access_apps_count)&&o.access_apps_count>=1&&
  Number.isSafeInteger(o.account_members_count)&&o.account_members_count>=1&&
  o.accepted_super_admin_count===1&&o.accepted_super_admin_count<=o.account_members_count&&
  o.ledger_worker_exists===false&&o.qa_worker_exists===false&&
  Array.isArray(o.do_namespaces)&&o.do_namespaces.length>=3&&
  o.do_namespaces.every(x=>exact(x,['name','script','class'])&&
   typeof x.name==='string'&&typeof x.script==='string'&&typeof x.class==='string')&&
  new Set(o.do_namespaces.map(x=>x.name)).size===o.do_namespaces.length&&
  requiredDO.every(y=>o.do_namespaces.some(x=>eq(x,y))));
 add('honest_current_cloudflare_billing_status',
  o.billing_spend_policies_http===403&&o.billing_usage_http===403);
 add('strict_finance_receipt_no_url_or_raw_document',
  exact(f,receiptFields)&&f.account_id===ACCOUNT&&
  legalBasis.includes(f.evidence_path)&&
  typeof f.billing_period==='string'&&/^[0-9]{4}-[0-9]{2}$/.test(f.billing_period)&&
  evidenceRef(f.finance_mandate_ref)&&evidenceRef(f.invoice_or_usage_ref)&&
  evidenceRef(f.finance_signer_registry_ref)&&
  evidenceRef(f.auditor_signer_registry_ref)&&
  hash(f.finance_subject_hash)&&hash(f.auditor_subject_hash)&&
  f.finance_subject_hash!==f.auditor_subject_hash);
 add('signed_finance_evidence_source_mode_not_laundered_403',
  f.evidence_path==='DIRECT_BILLING_READ_ONLY'?
   (f.source_http_status===200&&f.private_scan_result==='NOT_APPLICABLE'&&
    f.private_redaction_result==='NOT_APPLICABLE'):
   (f.evidence_path==='PRIVATE_DUAL_ATTESTED_FINANCE_REPORT'&&
    f.source_http_status===403&&
    f.private_scan_result==='PRIVATE_QUARANTINE_PASS'&&
    f.private_redaction_result==='RESTRICTED_REVIEW_PASS'));
 add('positive_usd_scoped_finance_exposure_not_hard_cap',
  positive(f.attested_ledger_usd)&&positive(f.attested_qa_worker_usd)&&
  f.attested_ledger_usd+f.attested_qa_worker_usd<=25&&
  f.explicit_cost_risk_acceptance===true&&f.hard_invoice_cap_guaranteed===false);
 add('finance_receipt_short_lived',
  iso(f.proof_collected_at)&&iso(f.proof_expires_at)&&nowValid&&
  Date.parse(f.proof_collected_at)<=now&&Date.parse(f.proof_expires_at)>now&&
  Date.parse(f.proof_expires_at)-Date.parse(f.proof_collected_at)<=maxFinanceAge);
 add('broker_explicitly_not_hosted_in_source',
  exact(b,brokerFields)&&b.account_id===ACCOUNT&&
  b.mode==='SOURCE_ONLY_NO_INTAKE_ENDPOINT'&&
  ['private_idp','access_protection','mfa_policy','finance_and_owner_principals',
   'private_storage','malware_scan','trust_roots_out_of_band',
   'durable_replay_ledger','revocation_check','audit_log','hosted_browser_uat']
    .every(x=>b[x]==='NOT_VERIFIED')&&
  ['public_development_url','public_custom_domain','secrets_in_git',
   'payment_changes','production_webhook_binding'].every(x=>b[x]===false));
 add('review_is_explicitly_no_deploy_and_no_consent_claim',
  exact(d,decisionFields)&&d.account_id===ACCOUNT&&
  d.phase==='LEDGER_FIRST_INACTIVE_UPLOAD'&&d.target_worker===LEDGER&&
  typeof d.source_git_sha==='string'&&/^[0-9a-f]{40}$/.test(d.source_git_sha)&&
  d.finance_scope_window==='REAL_SIGNED_FINANCE_WINDOW_NOT_ESTABLISHED'&&
  ['owner_consented','finance_consented','security_reviewed','operator_verified',
   'independent_auditor_verified','private_broker_approved','rollback_approved',
   'can_change_billing','can_create_ledger','can_upload_qa_worker',
   'can_modify_access','can_touch_commerce'].every(x=>d[x]===false)&&
  d.read_only_review===true);
 // Always check the *real prerequisites* separately. A synthetic pass above
 // can never make the next four checks pass; no caller-supplied flags allow it.
 add('real_finance_delegate_verified_by_external_authority',false);
 add('real_scoped_owner_finance_security_rollback_consent',false);
 add('hosted_access_mfa_revocation_and_intake_uat',false);
 add('independent_durable_one_use_nonce_commit',false);
 return stop(checks,{evidence_path:legalBasis.includes(f.evidence_path)?f.evidence_path:null,
  cloudflare_billing_http:o.billing_spend_policies_http??null,
  current_target_ledger_observed:o.ledger_worker_exists??null,
  current_target_worker_observed:o.qa_worker_exists??null,
  all_metadata_shape_checks_satisfied:checks.slice(0,9).every(x=>x.status==='SATISFIED_SYNTHETIC')
 });
}
/**
 * Local-only proposed private Worker entrypoint; no deploy config or binding.
 * Cloudflare Access ctx.access on a future directly protected Worker is
 * necessary but insufficient. This handler NEVER returns a finance artifact
 * or a green admission decision, even for a synthetic authenticated principal.
 */
export async function privateBrokerNoDeployPreflight(request,env={},ctx={}){
 const noCache={'cache-control':'no-store, max-age=0','content-type':'application/json; charset=utf-8',
  'x-content-type-options':'nosniff','referrer-policy':'no-referrer'};
 const respond=(status,code)=>new Response(JSON.stringify({
  contract:CONTRACT,status:'NO_GO',code,can_create_ledger:false,
  can_upload_document:false,can_touch_commerce:false
 }),{status,headers:noCache});
 if(request?.method!=='GET')return respond(405,'READ_ONLY_GET_REQUIRED');
 let url;
 try{url=new URL(request.url);}catch{return respond(400,'INVALID_REQUEST');}
 if(url.pathname!=='/private/admission/preflight'||url.search||request.headers.has('authorization')){
  return respond(404,'NO_PUBLIC_INTAKE');
 }
 if(!ctx?.access||typeof ctx.access.getIdentity!=='function'){
  return respond(403,'ACCESS_AUTH_REQUIRED');
 }
 try{
  const identity=await ctx.access.getIdentity();
  if(!identity||typeof identity.email!=='string'||identity.email.length<3){
   return respond(403,'VERIFIED_ACCESS_IDENTITY_REQUIRED');
  }
 }catch{return respond(403,'ACCESS_IDENTITY_UNAVAILABLE');}
 return respond(503,'PRIVATE_BROKER_NOT_DEPLOYED_NO_FINANCE_AUTHORITY');
}
