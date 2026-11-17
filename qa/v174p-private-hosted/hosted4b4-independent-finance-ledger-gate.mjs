/**
 * TIEN404 V17.4P-HOSTED.4B.4
 * Independent Finance + Private Hosted Ledger Approval + First Upload GO/NO-GO.
 * PURE / NO NETWORK / NO DEPLOY. Finance signatures and registered principals
 * in a TEST fixture cannot prove real Cloudflare authority or budget.
 *
 * Critical: separately price and authorize PRIVATE ledger and inactive Worker.
 * Cloudflare Workers/DO spend limits are account-wide, not strict per-resource
 * hard caps; stored Durable Object data and subscription fees are excluded.
 */
import {createHash,createPublicKey,verify as edVerify} from 'node:crypto';
import {preflightInactivePermit,PROTECTED_V175_RESOURCES} from './hosted4b1-private-signed-permit.mjs';
import {verifyPrivateOperatorAdmission,hashPermit} from './hosted4b3-private-operator-admission.mjs';

export const CONTRACT='T404_V174P_HOSTED4B4_INDEPENDENT_FINANCE_LEDGER_GO_NO_GO_V1';
export const ACCOUNT='ac01685529c0a31fc185335f07648edf';
export const WORKER='tien404-v174p-private-qa-issuer';
export const LEDGER='tien404-v174p-private-permit-ledger';
export const LEDGER_CLASS='V174PPermitLedger';
const MAX_USD=25;
const TTL_MS=15*60*1000;
const SNAPSHOT_MS=5*60*1000;
const FIELDS=[
 'contract','account_id','scope','worker_name','ledger_worker_name',
 'ledger_class','source_git_sha','source_sha256','manifest_digest',
 'owner_permit_digest','inventory_digest','operator_subject_hash',
 'qa_worker_budget_usd','private_ledger_budget_usd','cost_window_id',
 'issued_at','expires_at','nonce',
 'allow_first_inactive_qa_worker_upload','allow_new_private_ledger_first_upload',
 'accept_account_wide_worker_do_spend_risk','accept_unlimited_stored_data_exposure',
 'accept_no_hard_per_resource_cloudflare_cap',
 'allow_account_wide_spend_limit_change','allow_billing_plan_upgrade',
 'allow_existing_worker_mutation','allow_existing_namespace_mutation',
 'allow_public_url','allow_preview','allow_workers_dev','allow_access_mutation',
 'allow_secrets','allow_outbound_sends','allow_real_commerce',
 'allow_automatic_deployment','max_public_requests_before_access',
 'private_ledger_isolation_reviewed','rollback_operator_approved'
].sort();
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const keys=x=>obj(x)?Object.keys(x).sort():[];
const arr=x=>Array.isArray(x)?x:[];
const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function canonical(x){
 if(Array.isArray(x))return '['+x.map(canonical).join(',')+']';
 if(obj(x))return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}';
 return JSON.stringify(x);
}
export const digest=x=>createHash('sha256').update(canonical(x),'utf8').digest('hex');
const isHash=x=>typeof x==='string'&&/^[0-9a-f]{64}$/.test(x);
const isSha=x=>typeof x==='string'&&/^[0-9a-f]{40}$/.test(x);
function exactTime(s){const t=typeof s==='string'?Date.parse(s):NaN;return Number.isFinite(t)&&new Date(t).toISOString()===s?t:NaN;}
function checkEd25519(payload, sig, anchor){
 try{
  if(!obj(sig)||!obj(anchor)||sig.key_id!==anchor.key_id||
     typeof anchor.spki_pem!=='string'||typeof sig.signature!=='string'||
     !/^[A-Za-z0-9_-]{86}$/.test(sig.signature))return false;
  const b=Buffer.from(sig.signature,'base64url');
  if(b.length!==64||b.toString('base64url')!==sig.signature)return false;
  const k=createPublicKey(anchor.spki_pem);
  return k.asymmetricKeyType==='ed25519'&&edVerify(null,
   Buffer.from('T404_V174P_HOSTED4B4_FINANCE_LEDGER_APPROVAL\n'+canonical(payload)),k,b);
 }catch{return false;}
}
const deny=(status,reasons,extras={})=>Object.freeze({
 contract:CONTRACT,status,reasons:[...new Set(reasons)],
 signed_packet_is_not_actual_owner_authority:true,
 private_hosted_ledger_exists_verified:false,
 spend_hard_cap_guaranteed:false,
 ...extras,
 can_upload_qa_worker:false,can_create_hosted_ledger:false,can_change_access:false,
 can_change_billing:false,can_send_provider_message:false,can_write_commerce:false,
 mutations_executed:false
});

/**
 * A deliberately NONEXECUTABLE status gate; even perfectly signed synthetic
 * packets return NO-GO FOR CLOUD UPLOAD pending an independent real operator.
 * Trust registry provenance must be checked outside editable input.
 */
export function assessIndependentFinanceAndLedger({
 financePacket,financeSignatures,financeTrust,ownerEvidence,
 operatorJwt,operatorTrust,privateRegistry,now=Date.now()
}={}){
 const errors=[],check=(s,v)=>{if(v!==true)errors.push(s);};
 const f=obj(financePacket)?financePacket:{};
 const s=obj(financeSignatures)?financeSignatures:{};
 const t=obj(financeTrust)?financeTrust:{};
 const r=obj(privateRegistry)?privateRegistry:{};
 const owner=obj(ownerEvidence)?ownerEvidence:{};
 const signedOwner=obj(owner.permit)?owner.permit:{};
 const inv=owner.inventoryEvidence?.inventory||{};
 check('strict_finance_packet_fields',eq(keys(f),FIELDS));
 check('exact_first_inactive_ledger_and_worker_scope',
   f.contract===CONTRACT&&f.account_id===ACCOUNT&&f.scope==='INACTIVE_FIRST_UPLOADS_NO_SEND'&&
   f.worker_name===WORKER&&f.ledger_worker_name===LEDGER&&f.ledger_class===LEDGER_CLASS);
 check('exact_owner_permit_and_git_source_binding',
   isSha(f.source_git_sha)&&f.source_git_sha===signedOwner.source_git_sha&&
   isHash(f.source_sha256)&&f.source_sha256===signedOwner.source_sha256&&
   isHash(f.manifest_digest)&&f.manifest_digest===signedOwner.manifest_sha256&&
   isHash(f.owner_permit_digest)&&f.owner_permit_digest===hashPermit(signedOwner)&&
   isHash(f.inventory_digest)&&f.inventory_digest===signedOwner.inventory_sha256&&
   f.inventory_digest===digest(inv));
 const pg=preflightInactivePermit({...owner,now});
 check('independently_reviewed_owner_security_signed_permit_math',
   pg.decision==='SIGNED_PACKET_INTERNALLY_CONSISTENT_REQUIRES_OPERATOR_EXECUTION_APPROVAL');
 const op=verifyPrivateOperatorAdmission({
  jwt:operatorJwt,trustConfig:operatorTrust,permit:signedOwner,now
 });
 check('operator_broker_signed_mfa_exact_permit_math',
   op.identity_admitted_for_private_review===true&&
   isHash(f.operator_subject_hash)&&f.operator_subject_hash===op.operator_subject_hash);
 check('complete_recent_cloudflare_snapshot',
   owner.inventoryEvidence?.status==='COMPLETE_READ_ONLY_NEEDS_INDEPENDENT_REVIEW'&&
   arr(owner.inventoryEvidence?.errors).length===0&&
   inv.account_id===ACCOUNT&&inv.source==='CLOUDFLARE_CONTROL_PLANE_READ_ONLY'&&
   inv.page_verification?.status==='COMPLETE'&&inv.page_verification?.cross_consistent===true&&
   Number.isSafeInteger(inv.collected_at_ms)&&inv.collected_at_ms<=now&&
   now-inv.collected_at_ms<=SNAPSHOT_MS&&
   inv.page_verification.total_workers===arr(inv.worker_names).length&&
   inv.page_verification.total_scripts===arr(inv.script_names).length&&
   arr(inv.worker_names).length>=1&&
   eq([...arr(inv.worker_names)].sort(),[...arr(inv.script_names)].sort())&&
   r.current_inventory_provenance_verified_privately===true);
 const ws=arr(inv.worker_names),ss=arr(inv.script_names),ns=arr(inv.do_namespace_names),apps=arr(inv.access_app_names);
 check('no_qa_worker_or_ledger_collision',
   !ws.includes(WORKER)&&!ss.includes(WORKER)&&
   !ws.includes(LEDGER)&&!ss.includes(LEDGER)&&
   !ns.some(n=>typeof n==='string'&&(n.includes(WORKER)||n.includes(LEDGER)))&&
   !apps.some(n=>typeof n==='string'&&(n.includes(WORKER)||n.includes(LEDGER))));
 check('protected_parallel_v175_resources_present',
   PROTECTED_V175_RESOURCES.scripts.every(x=>ss.includes(x))&&
   PROTECTED_V175_RESOURCES.namespaces.every(x=>ns.includes(x))&&
   r.parallel_resource_ownership_verified_privately===true);
 const issued=exactTime(f.issued_at),expiry=exactTime(f.expires_at);
 check('signed_finance_packet_fresh_and_one_time',
   Number.isSafeInteger(now)&&Number.isFinite(issued)&&Number.isFinite(expiry)&&
   issued<=now&&now<expiry&&expiry-issued<=TTL_MS&&now-issued<=TTL_MS&&
   typeof f.nonce==='string'&&/^[a-f0-9]{32,64}$/.test(f.nonce)&&
   r.finance_nonce_unused_verified_by_private_registry===true);
 check('independent_finance_and_ledger_security_registry',
   t.finance?.role==='finance_approver'&&t.ledger_security?.role==='security_reviewer'&&
   t.finance?.registered_out_of_band===true&&t.ledger_security?.registered_out_of_band===true&&
   t.finance?.key_id&&t.ledger_security?.key_id&&t.finance.key_id!==t.ledger_security.key_id&&
   t.finance.spki_pem!==t.ledger_security.spki_pem&&
   r.finance_identity_out_of_band_verified===true&&
   r.ledger_security_identity_out_of_band_verified===true&&
   r.operator_identity_out_of_band_verified===true&&
   r.rollback_operator_identity_out_of_band_verified===true);
 check('two_independent_finance_and_security_signatures',
   checkEd25519(f,s.finance,t.finance)&&checkEd25519(f,s.ledger_security,t.ledger_security));
 check('finance_and_owner_are_distinct_principals',
   t.finance?.key_id!==owner.trustAnchors?.owner?.key_id&&
   t.finance?.key_id!==owner.trustAnchors?.security?.key_id&&
   t.ledger_security?.key_id!==t.finance?.key_id&&
   r.finance_signer_segregation_privately_reviewed===true);
 const qa=f.qa_worker_budget_usd,ledger=f.private_ledger_budget_usd;
 check('two_separate_positive_budgets_and_combined_max_25',
   Number.isFinite(qa)&&qa>0&&qa<=MAX_USD&&
   Number.isFinite(ledger)&&ledger>0&&ledger<=MAX_USD&&
   qa+ledger<=MAX_USD&&qa<=signedOwner.incremental_budget_usd&&
   typeof f.cost_window_id==='string'&&/^[a-z0-9-]{8,80}$/.test(f.cost_window_id)&&
   r.independent_finance_cost_window_review===true);
 check('explicit_account_wide_nonhard_cost_risks',
   f.accept_account_wide_worker_do_spend_risk===true&&
   f.accept_unlimited_stored_data_exposure===true&&
   f.accept_no_hard_per_resource_cloudflare_cap===true&&
   f.allow_account_wide_spend_limit_change===false&&
   f.allow_billing_plan_upgrade===false);
 check('separate_scoped_approvals_not_expansion_to_public',
   f.allow_first_inactive_qa_worker_upload===true&&
   f.allow_new_private_ledger_first_upload===true&&
   f.private_ledger_isolation_reviewed===true&&
   f.rollback_operator_approved===true&&
   f.allow_existing_worker_mutation===false&&
   f.allow_existing_namespace_mutation===false&&
   f.allow_public_url===false&&f.allow_preview===false&&
   f.allow_workers_dev===false&&f.allow_access_mutation===false&&
   f.allow_secrets===false&&f.allow_outbound_sends===false&&
   f.allow_real_commerce===false&&f.allow_automatic_deployment===false&&
   f.max_public_requests_before_access===0);
 check('hosted_ledger_control_plane_and_operator_provenance',
   r.dedicated_hosted_ledger_private_origin_reviewed===true&&
   r.hosted_ledger_not_preexisting_confirmed===true&&
   r.independent_rollback_plan_reviewed===true&&
   r.cloudflare_rbac_least_privilege_verified_privately===true&&
   r.private_change_window_operator_separation_verified===true);
 return deny(errors.length?'BLOCKED': 'CRYPTOGRAPHICALLY_CONSISTENT_NOT_HOSTED_AUTHORIZED',
   errors,{
    owner_permit_math_ok:pg.decision==='SIGNED_PACKET_INTERNALLY_CONSISTENT_REQUIRES_OPERATOR_EXECUTION_APPROVAL',
    operator_broker_math_ok:op.identity_admitted_for_private_review===true,
    signatures_mathematically_consistent:errors.length===0,
    signed_cost_scope_checked:errors.length===0,
    signed_approval_window:typeof f.cost_window_id==='string'?f.cost_window_id:null,
    human_identity_independently_verified_by_this_code:false
   });
}
