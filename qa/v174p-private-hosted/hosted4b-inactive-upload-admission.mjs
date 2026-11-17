/**
 * V17.4P-HOSTED.4B — Inactive Worker manifest + pinned source admission.
 * Pure offline validator; cannot deploy, create Cloudflare resources, authorize
 * account-wide billing changes, or infer an owner's identity from editable JSON.
 */
import {createHash} from 'node:crypto';
import {evaluateStageA} from './hosted2-inactive-admission.mjs';
import {assessIndependentAuthorization} from './hosted4-independent-owner-gate.mjs';

export const CONTRACT='T404_V174P_HOSTED4B_INACTIVE_UPLOAD_PREPARED_NO_DEPLOY_V1';
export const EXPECTED_WORKER='tien404-v174p-private-qa-issuer';
export const EXPECTED_MAIN='./hosted-issuer.worker.mjs';
const ALLOWED_KEYS=['name','main','compatibility_date','workers_dev',
 'preview_urls','routes','observability','vars','durable_objects','migrations'].sort();
const EXPECTED_VARS=['V174P_MODE','V174P_OWNER_PROOF_STATUS'].sort();
const REQUIREMENTS=[
 'private_owner_identity_independently_verified',
 'independent_security_reviewer_identity_verified',
 'private_qa_operator_allowlist_verified',
 'qa_hostname_or_no_public_hostname_reviewed',
 'specific_account_and_isolation_reviewed',
 'dedicated_worker_and_new_do_approval',
 'positive_cost_envelope_usd_approved',
 'worker_account_wide_cost_risk_reviewed',
 'do_account_wide_cost_risk_reviewed',
 'durable_stored_data_cost_reviewed',
 'owner_authorized_rollback_responsibility',
 'reviewer_verified_git_source_sha',
 'secret_provisioning_outside_git_reviewed',
 'no_public_routes_before_worker_access_proven',
 'explicit_operator_permission_for_inactive_upload'
];
const o=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const sorted=x=>o(x)?Object.keys(x).sort():[];
const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const digest=s=>createHash('sha256').update(s,'utf8').digest('hex');
const goodDigest=s=>typeof s==='string'&&/^[a-f0-9]{64}$/i.test(s);
const goodSha=s=>typeof s==='string'&&/^[a-f0-9]{40}$/i.test(s);
const report=(id,v,issues)=>{if(v!==true)issues.push(id);};
function checkedSource(source,expectedSha256,issues){
 report('reviewed_candidate_source_present',typeof source==='string'&&source.length>5000&&source.length<150000,issues);
 const valid=typeof source==='string';
 const hash=valid?digest(source):null;
 report('reviewed_source_sha256_matches_independent_checkpoint',
   valid&&goodDigest(expectedSha256)&&hash===expectedSha256,issues);
 if(valid){
  report('candidate_exports_same_qa_durable_object',
   /export class V174PReplayGuard\s*\{/.test(source)&&
   /export default\s*\{\s*fetch:\s*handler\s*\}/.test(source),issues);
  report('candidate_fail_closed_configuration',
   source.includes("QA_SYNTHETIC_ONLY")&&source.includes("UNVERIFIED_QA_ONLY")&&
   source.includes("V174P_ACCESS_JWKS_JSON")&&source.includes("V174P_SESSION_HMAC_KEY")&&
   source.includes("V174P_REPLAY_DO")&&source.includes("PRIVATE_ACCESS_REQUIRED"),issues);
  // Restricted *known* outbound provider endpoints; static scan cannot
  // independently prove the absence of dynamically constructed network calls.
  report('no_known_outbound_or_commerce_literals',
   !/(api\.openai\.com|graph\.facebook\.com|ngoctien20\.app\.n8n\.cloud|SUPABASE_SERVICE_ROLE|stripe\.com)/i.test(source),issues);
 }
 return hash;
}
function validateInactiveConfig(config,issues){
 const c=o(config)?config:{};
 report('exact_config_keys_no_hidden_bindings',eq(sorted(c),ALLOWED_KEYS),issues);
 report('target_dedicated_worker_name',c.name===EXPECTED_WORKER,issues);
 report('target_existing_reviewed_module',c.main===EXPECTED_MAIN,issues);
 report('verified_compatibility_date',c.compatibility_date==='2026-11-17',issues);
 report('workers_dev_off',c.workers_dev===false,issues);
 report('preview_urls_off',c.preview_urls===false,issues);
 report('no_public_routes',Array.isArray(c.routes)&&c.routes.length===0,issues);
 report('no_observability_data_capture',
   o(c.observability)&&eq(sorted(c.observability),['enabled'])&&c.observability.enabled===false,issues);
 report('exact_qa_only_vars',o(c.vars)&&eq(sorted(c.vars),EXPECTED_VARS)&&
   c.vars.V174P_MODE==='QA_SYNTHETIC_ONLY'&&
   c.vars.V174P_OWNER_PROOF_STATUS==='UNVERIFIED_QA_ONLY',issues);
 report('one_isolated_durable_binding',
   o(c.durable_objects)&&eq(sorted(c.durable_objects),['bindings'])&&
   Array.isArray(c.durable_objects.bindings)&&c.durable_objects.bindings.length===1&&
   eq(sorted(c.durable_objects.bindings[0]),['class_name','name'])&&
   c.durable_objects.bindings[0]?.name==='V174P_REPLAY_DO'&&
   c.durable_objects.bindings[0]?.class_name==='V174PReplayGuard',issues);
 report('one_sqlite_migration_no_existing_v175_class',
   Array.isArray(c.migrations)&&c.migrations.length===1&&
   eq(sorted(c.migrations[0]),['new_sqlite_classes','tag'])&&
   c.migrations[0].tag==='v1-qa-sqlite-do'&&
   Array.isArray(c.migrations[0].new_sqlite_classes)&&
   eq(c.migrations[0].new_sqlite_classes,['V174PReplayGuard']),issues);
}
export function assessInactiveUploadPlan({
 config, source, reviewedSourceSha256, expectedGitCommitSha, inventoryResult,
 ownerEnvelope, signatures, privateTrustAnchors, independentReview, privateApproval, now=Date.now()
}={}){
 const issues=[];
 validateInactiveConfig(config,issues);
 const candidateHash=checkedSource(source,reviewedSourceSha256,issues);
 report('pinned_reviewed_git_commit',
   goodSha(expectedGitCommitSha)&&independentReview?.independently_verified_source_sha===expectedGitCommitSha,
   issues);
 const inv=inventoryResult;
 report('complete_authenticated_control_plane_inventory',
   inv?.status==='COMPLETE_READ_ONLY_NEEDS_INDEPENDENT_REVIEW'&&
   Array.isArray(inv?.errors)&&inv.errors.length===0&&
   inv.inventory?.page_verification?.status==='COMPLETE'&&
   inv.inventory?.page_verification?.cross_consistent===true&&
   Number.isSafeInteger(inv.inventory?.collected_at_ms)&&
   inv.inventory.collected_at_ms<=now&&
   now-inv.inventory.collected_at_ms<=600000&&
   independentReview?.live_inventory_independently_attested===true,issues);
 const r=o(privateApproval)?privateApproval:{};
 const approvals=REQUIREMENTS.filter(k=>r[k]!==true);
 const permittedHttp=r.max_qa_requests===96;
 const budget=Number.isFinite(r.max_spend_usd)&&r.max_spend_usd>0&&r.max_spend_usd<=25;
 if(!permittedHttp)approvals.push('bounded_96_max_qa_requests');
 if(!budget)approvals.push('positive_private_dollar_budget_not_proven');
 if(r.account_wide_spending_limit_change!==false)approvals.push('explicit_no_account_wide_spend_cap_mutation');
 if(r.provider_send_allowed!==false||r.real_commerce_allowed!==false||
  r.model_calls_allowed!==false)approvals.push('zero_outbound_model_or_commerce');
 const approvalPayload={
  status:'AWAITING_EXPLICIT_OWNER_APPROVAL',
  scope:'SYNTHETIC_PRIVATE_QA_NO_SEND_NO_COMMERCE',
  deploy_strategy:{automatic_deploy:false},
  commercial_read_write_allowed:false,provider_send_allowed:false,ai_model_calls_allowed:false,
  approval_required:{}
 };
 const template=evaluateStageA(config,approvalPayload);
 report('stage_a_inactive_no_secret_template_review',
  template.status==='SOURCE_TEMPLATE_SAFE_FOR_REVIEW',issues);
 // Run cryptographic verification ourselves; never accept a caller-supplied
 // "signature_passed" flag, user-provided public key in the signed payload,
 // or editable authorization response.
 const auth=assessIndependentAuthorization(
  ownerEnvelope,signatures,privateTrustAnchors,inv?.inventory,
  independentReview,now
 );
 report('independent_owner_security_signatures_and_scope',
  auth.reasons.length===0&&auth.status==='DUAL_SIGNATURES_AND_SOURCE_CONSISTENT_NEEDS_OPERATOR_AUTHORIZATION',
  issues);
 return Object.freeze({
  contract:CONTRACT,
  state:(issues.length||approvals.length)?'BLOCKED_PREDEPLOYMENT_APPROVAL':
    'READ_ONLY_ADMISSION_REVIEWED_REQUIRES_SEPARATE_OPERATOR_ACTION',
  source_safe:issues.length===0,
  issues:[...new Set(issues)],
  missing_private_authorizations:approvals,
  signer_gate_reasons:auth.reasons,
  source_sha256:candidateHash,
  manifest_digest_sha256:typeof config==='object'&&config!==null?
    digest(JSON.stringify(config)):null,
  proposed_target:EXPECTED_WORKER,
  proposed_phase:'INACTIVE_UPLOAD_ONLY',
  max_requests_may_be_authorized:96,
  external_canary_completed:false,
  actual_cloudflare_worker_present:false,
  independently_verified_owner_identity:false,
  deployment_performed:false,
  cost_spend_performed:false,
  can_deploy:false,
  can_enable_worker_access:false,
  can_enable_public_routes:false,
  can_run_real_cloudflare_uat:false,
  can_touch_v175_resources:false,
  can_run_production_commerce:false
 });
}
export const REQUIRED_PRIVATE_APPROVALS=REQUIREMENTS;
