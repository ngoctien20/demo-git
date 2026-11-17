/**
 * TIEN404 V17.4P-HOSTED.4B.1 — private, signed inactive-upload permit preflight.
 *
 * This module NEVER calls the Cloudflare API or authorizes an API mutation.
 * The caller MUST load trust anchors and human identity provenance from an
 * independent, access-controlled, authenticated operator system, NOT editable
 * GitHub JSON or self-asserted flags.
 *
 * The Cloudflare "spending limit" is account-wide and NOT a hard cost cap.
 * A signed USD risk envelope is only human authorization, not cost enforcement.
 */
import {createHash,createPublicKey,verify as edVerify} from 'node:crypto';

export const CONTRACT='T404_V174P_HOSTED4B1_PRIVATE_PHASE_A_SIGNED_PERMIT_V1';
export const ACCOUNT='ac01685529c0a31fc185335f07648edf';
export const WORKER='tien404-v174p-private-qa-issuer';
export const MAX_USD=25;
export const LIMIT_AGE_MS=5*60*1000;
export const LIMIT_PERMIT_MS=15*60*1000;
const lockedScripts=[
 'tien404-v175e1-private-issuer-nosend-staging',
 'tien404-v175e2-ab-gateway-nosend-staging',
 'tien404-v175e2-durable-replay-nosend-staging',
 'tien404-v175e2-installation-registry-nosend-staging',
 'tien404-v175e2a-private-hosted-runner-nosend-staging'
];
const lockedNamespaces=[
 'tien404-v175e2-durable-replay-nosend-staging_ReplayBucket',
 'tien404-v175e2a-private-hosted-runner-nosend-staging_RunnerResults'
];
const ALLOWED_KEYS=[
 'contract','intent','account_id','worker_name','new_sqlite_class',
 'source_git_sha','source_sha256','manifest_sha256','inventory_sha256',
 'signed_at','expires_at','nonce','deployment_operator_email',
 'rollback_operator_email','incremental_budget_usd','max_external_requests',
 'accept_shared_account_cost_risk','ack_spending_limit_not_hard_cap',
 'ack_do_storage_charges_excluded','no_account_wide_limit_change',
 'no_public_routes','no_preview_url','no_workers_dev',
 'no_secret_upload','no_access_modifications','no_real_customer_data',
 'no_outbound_provider_send','no_ai_model_calls','no_commerce_writes',
 'create_new_qa_worker_and_sqlite_do_only'
].sort();

const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const array=x=>Array.isArray(x)?x:[];
const keys=x=>obj(x)?Object.keys(x).sort():[];
const same=(x,y)=>JSON.stringify(x)===JSON.stringify(y);
function canonical(value) {
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 if(obj(value))return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
 return JSON.stringify(value);
}
function digest(value) {
 return createHash('sha256').update(canonical(value),'utf8').digest('hex');
}
function validEmail(x){
 return typeof x==='string'&&x.length<=180&&
  /^[a-z0-9][a-z0-9.+_-]*@[a-z0-9.-]+\.[a-z]{2,}$/.test(x)&&
  !x.includes('..')&&!x.includes('*');
}
function exactPemSignature(s,anchor,permit){
 try {
  if(!obj(s)||!obj(anchor)||s.key_id!==anchor.key_id||!anchor.registered_out_of_band ||
     typeof anchor.spki_pem!=='string'||typeof s.signature!=='string'||
     !/^[a-zA-Z0-9_-]{86}$/.test(s.signature))return false;
  const buf=Buffer.from(s.signature,'base64url');
  if(buf.length!==64)return false;
  const publicKey=createPublicKey(anchor.spki_pem);
  if(publicKey.asymmetricKeyType!=='ed25519')return false;
  return edVerify(null,Buffer.from('T404_V174P_HOSTED4B1_PHASE_A_PERMIT\n'+canonical(permit)),
    publicKey,buf);
 }catch{return false;}
}
const isSha=s=>typeof s==='string'&&/^[a-f0-9]{40}$/.test(s);
const isHash=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
const timeMs=(s)=>{
 if(typeof s!=='string')return NaN;
 const t=Date.parse(s);
 return Number.isFinite(t)&&new Date(t).toISOString()===s?t:NaN;
};
export function preflightInactivePermit({
 permit,signatures,trustAnchors,registryEvidence,
 sourceArtifact,manifestArtifact,inventoryEvidence,now=Date.now()
}={}){
 const reasons=[];
 const check=(name,yes)=>{if(yes!==true)reasons.push(name);};
 const p=obj(permit)?permit:{};
 const s=obj(signatures)?signatures:{};
 const t=obj(trustAnchors)?trustAnchors:{};
 const reg=obj(registryEvidence)?registryEvidence:{};
 const inv=obj(inventoryEvidence)?inventoryEvidence:{};
 const live=obj(inv.inventory)?inv.inventory:{};
 check('exact_permit_fields',same(keys(p),ALLOWED_KEYS));
 check('contract_and_explicit_inactive_intent',
   p.contract===CONTRACT&&p.intent==='FIRST_UPLOAD_INACTIVE_ONLY');
 check('account_worker_sqlite_scope',p.account_id===ACCOUNT&&p.worker_name===WORKER&&
   p.new_sqlite_class==='V174PReplayGuard');
 check('git_and_source_sha',isSha(p.source_git_sha)&&isHash(p.source_sha256)&&
   typeof sourceArtifact==='string'&&
   createHash('sha256').update(sourceArtifact,'utf8').digest('hex')===p.source_sha256&&
   reg.independently_verified_git_sha===p.source_git_sha&&
   reg.independently_verified_source_hash===p.source_sha256);
 check('manifest_exact_digest_and_qa_safety',
   obj(manifestArtifact)&&digest(manifestArtifact)===p.manifest_sha256&&
   manifestArtifact.name===WORKER&&manifestArtifact.main==='./hosted-issuer.worker.mjs'&&
   manifestArtifact.workers_dev===false&&manifestArtifact.preview_urls===false&&
   Array.isArray(manifestArtifact.routes)&&manifestArtifact.routes.length===0&&
   manifestArtifact.observability?.enabled===false&&
   manifestArtifact.durable_objects?.bindings?.length===1&&
   manifestArtifact.durable_objects.bindings[0].name==='V174P_REPLAY_DO'&&
   manifestArtifact.durable_objects.bindings[0].class_name==='V174PReplayGuard'&&
   manifestArtifact.migrations?.length===1&&
   same(manifestArtifact.migrations[0].new_sqlite_classes,['V174PReplayGuard'])&&
   obj(manifestArtifact.vars)&&
   same(Object.keys(manifestArtifact.vars).sort(),['V174P_MODE','V174P_OWNER_PROOF_STATUS'])&&
   manifestArtifact.vars.V174P_MODE==='QA_SYNTHETIC_ONLY'&&
   manifestArtifact.vars.V174P_OWNER_PROOF_STATUS==='UNVERIFIED_QA_ONLY');
 check('read_only_control_plane_complete_fresh_and_bound',
   inv.status==='COMPLETE_READ_ONLY_NEEDS_INDEPENDENT_REVIEW'&&
   array(inv.errors).length===0&&live.account_id===ACCOUNT&&
   live.source==='CLOUDFLARE_CONTROL_PLANE_READ_ONLY'&&
   live.page_verification?.status==='COMPLETE'&&
   live.page_verification?.cross_consistent===true&&
   Number.isSafeInteger(live.collected_at_ms)&&live.collected_at_ms<=now&&
   now-live.collected_at_ms<=LIMIT_AGE_MS&&
   reg.inventory_collected_by_independent_connector===true&&
   isHash(p.inventory_sha256)&&digest(live)===p.inventory_sha256);
 const scripts=array(live.script_names),workers=array(live.worker_names),ns=array(live.do_namespace_names),apps=array(live.access_app_names);
 check('complete_worker_script_agreement',
   workers.length>0&&scripts.length===workers.length&&
   same([...scripts].sort(),[...workers].sort())&&
   live.page_verification?.total_workers===workers.length&&
   live.page_verification?.total_scripts===scripts.length);
 check('protected_parallel_resources_present_unmodified',
   lockedScripts.every(x=>scripts.includes(x))&&
   lockedNamespaces.every(x=>ns.includes(x))&&
   reg.v175_durable_ownership_independently_reviewed===true);
 check('no_existing_target_resources',
   !scripts.includes(WORKER)&&!workers.includes(WORKER)&&
   !ns.some(x=>typeof x==='string'&&x.includes(WORKER))&&
   !apps.some(x=>typeof x==='string'&&x.includes(WORKER)));
 const start=timeMs(p.signed_at),end=timeMs(p.expires_at);
 check('short_lived_private_permit',
   Number.isSafeInteger(now)&&Number.isFinite(start)&&Number.isFinite(end)&&
   start<=now&&now<end&&now-start<=LIMIT_PERMIT_MS&&
   end-start<=LIMIT_PERMIT_MS);
 check('unique_nonce_in_signed_permit',
   typeof p.nonce==='string'&&/^[a-f0-9]{32,64}$/.test(p.nonce)&&
   reg.nonce_uniqueness_verified_by_durable_private_ledger===true);
 check('known_exact_operator_and_rollback',
   validEmail(p.deployment_operator_email)&&validEmail(p.rollback_operator_email)&&
   reg.deployment_operator_email===p.deployment_operator_email&&
   reg.rollback_operator_email===p.rollback_operator_email&&
   reg.operator_verified_out_of_band===true&&
   reg.rollback_operator_verified_out_of_band===true);
 check('positive_manual_usd_risk_envelope_not_hard_cap',
   Number.isFinite(p.incremental_budget_usd)&&p.incremental_budget_usd>0&&
   p.incremental_budget_usd<=MAX_USD&&
   p.accept_shared_account_cost_risk===true&&
   p.ack_spending_limit_not_hard_cap===true&&
   p.ack_do_storage_charges_excluded===true&&
   reg.finance_owner_cost_reviewed_out_of_band===true);
 check('no_shared_billing_limit_mutations',p.no_account_wide_limit_change===true);
 check('zero_external_http_before_access',
   p.max_external_requests===0&&p.no_public_routes===true&&p.no_preview_url===true&&
   p.no_workers_dev===true);
 check('no_credential_or_live_access_actions',
   p.no_secret_upload===true&&p.no_access_modifications===true&&
   p.no_real_customer_data===true&&p.no_outbound_provider_send===true&&
   p.no_ai_model_calls===true&&p.no_commerce_writes===true);
 check('single_new_qa_worker_namespace_only',p.create_new_qa_worker_and_sqlite_do_only===true);
 check('trust_keys_from_independent_private_registry',
   t.owner?.role==='owner'&&t.security?.role==='security_reviewer'&&
   t.owner?.registered_out_of_band===true&&t.security?.registered_out_of_band===true&&
   typeof t.owner?.key_id==='string'&&typeof t.security?.key_id==='string'&&
   t.owner.key_id!==t.security.key_id&&
   t.owner.spki_pem!==t.security.spki_pem&&
   reg.owner_real_identity_verified_out_of_band===true&&
   reg.security_reviewer_real_identity_verified_out_of_band===true);
 check('two_signed_ed25519_approvals_same_exact_packet',
   exactPemSignature(s.owner,t.owner,p)&&exactPemSignature(s.security,t.security,p));
 return Object.freeze({
  contract:CONTRACT,
  decision:reasons.length?'BLOCKED':'SIGNED_PACKET_INTERNALLY_CONSISTENT_REQUIRES_OPERATOR_EXECUTION_APPROVAL',
  reasons,
  owner_identity_material_available_to_this_validator:false,
  can_upload:false,
  can_deploy:false,
  can_change_access:false,
  can_enable_public_route:false,
  can_run_external_cloudflare_uat:false,
  actual_resource_created:false,
  actual_incremental_spend_verified:false,
  cost_hard_cap_guaranteed:false,
  rollback_requires_separate_owner_authorization:true,
  live_environment_modified:false
 });
}
export const REQUIRED_AUTHORIZATION_FIELDS=ALLOWED_KEYS;
export const PROTECTED_V175_RESOURCES=Object.freeze({scripts:lockedScripts,namespaces:lockedNamespaces});
