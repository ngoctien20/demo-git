/**
 * TIEN404 V17.4P-HOSTED.4B.7 — independent private identity / Finance review.
 * Pure local math: NO network, secrets, Cloudflare writes or deployments.
 * Caller-supplied signing roots and consent cannot establish real authority.
 */
import {createHash,createPublicKey,verify as verifyEd} from 'node:crypto';
import {ACCOUNT,LEDGER,WORKER} from './hosted4b4-independent-finance-ledger-gate.mjs';
import {digest as digest4b6} from './hosted4b6-private-authority-readonly-uat.mjs';
export const CONTRACT='T404_V174P_HOSTED4B7_PRIVATE_OWNER_FINANCE_CONSENT_V1';
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const keys=x=>obj(x)?Object.keys(x).sort():[];
const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const sha=x=>createHash('sha256').update(x,'utf8').digest('hex');
const hash=x=>typeof x==='string'&&/^[0-9a-f]{64}$/.test(x);
const time=x=>typeof x==='string'&&Number.isFinite(Date.parse(x))&&new Date(Date.parse(x)).toISOString()===x;
const exact=(x,k)=>eq(keys(x),[...k].sort());
function canon(x){
 if(Array.isArray(x))return '['+x.map(canon).join(',')+']';
 if(obj(x))return '{'+Object.keys(x).sort().map(y=>JSON.stringify(y)+':'+canon(x[y])).join(',')+'}';
 return JSON.stringify(x);
}
export const digest=x=>sha(canon(x));
const packetKeys=[
 'contract','phase','account_id','worker_name','repo_commit_sha','worker_manifest_sha256',
 'cloudflare_inventory_sha256','owner_member_sha256','owner_subject_sha256',
 'finance_subject_sha256','operator_subject_sha256','rollback_subject_sha256',
 'owner_permit_sha256','finance_consent_sha256','evidence_dossier_sha256',
 'source_window_id','qa_worker_budget_usd','ledger_budget_usd','nonce',
 'issued_at','expires_at','no_public_routes','no_access_changes','no_secrets',
 'no_existing_workers_changed','no_billing_changes','no_provider_sends',
 'no_commerce_writes','no_automatic_upload','ack_account_wide_cost_risk',
 'ack_do_storage_not_hard_capped','hard_spend_cap_claimed'
];
const identityKeys=[
 'contract','role','account_id','subject_sha256','member_sha256',
 'audience','issuer_id','session_id_sha256','auth_time','issued_at','expires_at',
 'mfa_method','consent_nonce','consent_bundle_sha256','identity_evidence_ref'
];
function signed(msg,proof,root,domain){
 try{
  if(!obj(proof)||!obj(root)||root.source!=='EXTERNAL_PRIVATE_REGISTERED_TRUST_ROOT'||
   proof.key_id!==root.key_id||typeof proof.signature!=='string'||
   !/^[A-Za-z0-9_-]{86}$/.test(proof.signature))return false;
  const sig=Buffer.from(proof.signature,'base64url');
  if(sig.length!==64||sig.toString('base64url')!==proof.signature)return false;
  const key=createPublicKey(root.spki_pem);
  return key.asymmetricKeyType==='ed25519'&&
   verifyEd(null,Buffer.from(domain+canon(msg)),key,sig);
 }catch{return false;}
}
const fresh=(a,b,now,mins)=>time(a)&&time(b)&&Number.isSafeInteger(now)&&
 Date.parse(a)<=now&&now<Date.parse(b)&&
 Date.parse(b)-Date.parse(a)<=mins*60_000&&now-Date.parse(a)<=mins*60_000;
const finish=(err,details)=>Object.freeze({
 contract:CONTRACT,
 decision:err.length?'BLOCKED':'SIGNED_CONSENT_MATH_CONSISTENT_NOT_REAL_APPROVAL',
 reasons:[...new Set(err)],...details,
 real_owner_identity_verified:false,real_finance_authority_verified:false,
 real_private_intake_uat_verified:false,
 can_provision_ledger:false,can_upload_qa_worker:false,can_deploy:false,
 can_change_billing:false,can_change_access:false,
 can_write_commerce:false,can_send_provider_messages:false,
 mutations_executed:false
});
/**
 * Real validation depends on an independently authenticated, revocable private
 * IdP/Finance registry and live authorized control-plane collector. Those are
 * NOT available to this source-only verifier. A positive synthetic result
 * proves signature/shape consistency ONLY, not a real deployment GO.
 */
export function assessPrivateOwnerFinanceConsent({
 bundle,identityReceipts,identitySignatures,approvalSignatures,
 trustedRoots,cloudflareSnapshot,billingEvidence,now=Date.now()
}={}){
 const e=[],check=(n,v)=>{if(v!==true)e.push(n)};
 const p=obj(bundle)?bundle:{};
 const receipts=obj(identityReceipts)?identityReceipts:{};
 const identSigs=obj(identitySignatures)?identitySignatures:{};
 const approvalSigs=obj(approvalSignatures)?approvalSignatures:{};
 const trust=obj(trustedRoots)?trustedRoots:{};
 const s=obj(cloudflareSnapshot)?cloudflareSnapshot:{};
 const b=obj(billingEvidence)?billingEvidence:{};
 check('exact_metadata_fields_no_raw_PII_or_URL',exact(p,packetKeys));
 check('ledger_first_scope_commit_bound',
  p.contract===CONTRACT&&p.account_id===ACCOUNT&&
  p.phase==='LEDGER_FIRST_INACTIVE_UPLOAD'&&p.worker_name===LEDGER&&
  typeof p.repo_commit_sha==='string'&&/^[0-9a-f]{40}$/.test(p.repo_commit_sha)&&
  ['worker_manifest_sha256','cloudflare_inventory_sha256','owner_member_sha256',
   'owner_subject_sha256','finance_subject_sha256','operator_subject_sha256',
   'rollback_subject_sha256','owner_permit_sha256','finance_consent_sha256',
   'evidence_dossier_sha256'].every(n=>hash(p[n])));
 check('short_lived_phase_nonce_and_window',
  fresh(p.issued_at,p.expires_at,now,15)&&
  typeof p.nonce==='string'&&/^[a-f0-9]{32,64}$/.test(p.nonce)&&
  typeof p.source_window_id==='string'&&/^[a-z0-9-]{8,64}$/.test(p.source_window_id));
 check('no_public_production_or_automatic_mutation',
  ['no_public_routes','no_access_changes','no_secrets',
   'no_existing_workers_changed','no_billing_changes','no_provider_sends',
   'no_commerce_writes','no_automatic_upload'].every(n=>p[n]===true));
 check('separate_finite_cost_allocations_and_explicit_risk',
  typeof p.qa_worker_budget_usd==='number'&&Number.isFinite(p.qa_worker_budget_usd)&&
  p.qa_worker_budget_usd>0&&typeof p.ledger_budget_usd==='number'&&
  Number.isFinite(p.ledger_budget_usd)&&p.ledger_budget_usd>0&&
  p.ledger_budget_usd+p.qa_worker_budget_usd<=25&&
  p.ack_account_wide_cost_risk===true&&
  p.ack_do_storage_not_hard_capped===true&&p.hard_spend_cap_claimed===false);
 check('four_distinct_subject_hashes',
  new Set([p.owner_subject_sha256,p.finance_subject_sha256,
   p.operator_subject_sha256,p.rollback_subject_sha256]).size===4);
 check('exact_two_private_identity_and_signature_roles',
  exact(receipts,['owner','finance'])&&exact(identSigs,['owner','finance'])&&
  exact(approvalSigs,['owner','finance']));
 check('independent_registered_keys',
  exact(trust,['broker','owner','finance'])&&
  ['broker','owner','finance'].every(r=>obj(trust[r])&&
    trust[r].source==='EXTERNAL_PRIVATE_REGISTERED_TRUST_ROOT'&&
    typeof trust[r].key_id==='string'&&trust[r].key_id.length>=8&&
    typeof trust[r].spki_pem==='string')&&
  new Set(['broker','owner','finance'].map(r=>trust[r]?.spki_pem)).size===3&&
  new Set(['broker','owner','finance'].map(r=>trust[r]?.key_id)).size===3);
 for(const role of ['owner','finance']){
  const r=obj(receipts[role])?receipts[role]:{};
  check(role+'_independent_fresh_MFA_identity_receipt',
   exact(r,identityKeys)&&
   r.contract==='T404_V174P_4B7_BROKER_IDENTITY_RECEIPT_V1'&&
   r.role===role&&r.account_id===ACCOUNT&&
   r.issuer_id==='INDEPENDENT_PRIVATE_IDP'&&
   r.audience==='t404:private:hosted-ledger-consent'&&
   r.subject_sha256===p[role+'_subject_sha256']&&
   (role==='owner'?r.member_sha256===p.owner_member_sha256:r.member_sha256===null)&&
   hash(r.session_id_sha256)&&r.consent_bundle_sha256===digest(p)&&
   r.consent_nonce===p.nonce&&
   typeof r.identity_evidence_ref==='string'&&
   /^EV-[A-Za-z0-9_-]{8,64}$/.test(r.identity_evidence_ref)&&
   r.mfa_method==='phishing_resistant'&&
   time(r.auth_time)&&Date.parse(r.auth_time)<=now&&
   now-Date.parse(r.auth_time)<=5*60_000&&
   fresh(r.issued_at,r.expires_at,now,5));
  check(role+'_broker_signature',
   signed(r,identSigs[role],trust.broker,
   'T404_V174P_4B7_PRIVATE_BROKER_IDENTITY:'+role+'\n'));
  check(role+'_signed_consent',
   signed(p,approvalSigs[role],trust[role],
   'T404_V174P_4B7_INDEPENDENT_APPROVAL:'+role+'\n'));
 }
 const members=s.members?.entries;
 check('cloudflare_owner_member_authenticated_role_math',
  s.account_id===ACCOUNT&&s.source==='CLOUDFLARE_READ_ONLY_CONTROL_PLANE'&&
  Array.isArray(members)&&s.members?.count===members.length&&
  s.members?.total_count===members.length&&
  members.some(m=>m.member_ref_hash===p.owner_member_sha256&&
   m.status==='accepted'&&Array.isArray(m.role_names)&&
   m.role_names.includes('Super Administrator - All Privileges')));
 check('current_complete_no_collision_cloudflare_read_only_inventory',
  hash(p.cloudflare_inventory_sha256)&&
  p.cloudflare_inventory_sha256===digest4b6(s)&&
  Number.isSafeInteger(s.capture_time_ms)&&s.capture_time_ms<=now&&
  now-s.capture_time_ms<=60_000&&
  s.workers?.count===s.workers?.total_count&&
  s.scripts?.count===s.scripts?.total_count&&
  s.durable_objects?.count===s.durable_objects?.total_count&&
  Array.isArray(s.workers?.entries)&&
  !s.workers.entries.includes(WORKER)&&!s.workers.entries.includes(LEDGER));
 check('actual_finance_control_plane_evidence_not_FORBIDDEN',
  exact(b,['status','account_id','captured_at','digest_sha256'])&&
  b.status==='READ_ONLY_VERIFIED'&&b.account_id===ACCOUNT&&
  time(b.captured_at)&&now-Date.parse(b.captured_at)>=0&&
  now-Date.parse(b.captured_at)<=5*60_000&&
  hash(b.digest_sha256)&&b.digest_sha256===p.finance_consent_sha256);
 return finish(e,{
  billing_evidence_status:b.status||'UNAVAILABLE',
  observed_cloudflare_members:Array.isArray(members)?members.length:null
 });
}
