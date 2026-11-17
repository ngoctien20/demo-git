/**
 * TIEN404 V17.4P-HOSTED.4B.6
 * Independent authority & hosted Cloudflare CONTROL-PLANE GET-only UAT.
 *
 * NO new endpoint, NO HTTP calls, NO resource mutation, NO secrets and
 * NO deployment executor. This module consumes *sanitized* Cloudflare GET
 * evidence and mathematical proof of a private-root-signed authority binding.
 * TEST keys and user-submitted roots NEVER constitute real human authority.
 *
 * Until an independent identity broker and Finance office issue real signed
 * attestations (outside GitHub), hosted upload remains impossible here.
 */
import {createHash,createPublicKey,verify as edVerify} from 'node:crypto';
import {ACCOUNT,WORKER,LEDGER} from './hosted4b4-independent-finance-ledger-gate.mjs';

export const CONTRACT='T404_V174P_HOSTED4B6_PRIVATE_AUTHORITY_READONLY_NO_DEPLOY_V1';
export const PHASE='LEDGER_FIRST_INACTIVE_UPLOAD';
const PROTECTED=[
 'tien404-v175e2-durable-replay-nosend-staging_ReplayBucket',
 'tien404-v175e2a-private-hosted-runner-nosend-staging_RunnerResults'
];
const isObj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const keys=x=>isObj(x)?Object.keys(x).sort():[];
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const sha=x=>createHash('sha256').update(x,'utf8').digest('hex');
const hash=x=>typeof x==='string'&&/^[0-9a-f]{64}$/.test(x);
const fmtTime=x=>typeof x==='string'&&Number.isFinite(Date.parse(x))&&new Date(Date.parse(x)).toISOString()===x;
function canonical(x){
 if(Array.isArray(x))return '['+x.map(canonical).join(',')+']';
 if(isObj(x))return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}';
 return JSON.stringify(x);
}
export const digest=x=>sha(canonical(x));
const unique=x=>Array.isArray(x)&&new Set(x).size===x.length;
const positiveUSD=x=>typeof x==='number'&&Number.isFinite(x)&&x>0&&x<=25;
const signFields=[
 'contract','account_id','phase','cloudflare_snapshot_sha256','owner_member_ref_hash',
 'owner_subject_hash','finance_subject_hash','operator_subject_hash','rollback_subject_hash',
 'finance_qa_worker_budget_usd','finance_ledger_budget_usd',
 'approved_owner_permit_sha256','approved_finance_packet_sha256',
 'authorized_actor_registry_sha256','signed_at','expires_at','nonce',
 'read_only_only','allow_resource_create','allow_access_policy_change',
 'allow_billing_limit_change','allow_real_commerce'
].sort();
const snapFields=[
 'account_id','capture_time_ms','source','methods_used','workers','scripts',
 'durable_objects','access_apps','access_policies','members','billing_spend_policies'
].sort();
const listFields=['status','count','total_count','entries'].sort();
const namespaceFields=['name','script','class'].sort();
const memberFields=['member_ref_hash','status','role_names'].sort();
const roleSuper='Super Administrator - All Privileges';
const deny=(errors,details={})=>Object.freeze({
 contract:CONTRACT,decision:errors.length?'BLOCKED':'SIGNED_READONLY_EVIDENCE_CONSISTENT_NOT_REAL_AUTHORITY',
 reasons:[...new Set(errors)],
 ...details,
 read_only_control_plane_verified_in_this_function:false,
 real_owner_verified:false,real_finance_verified:false,
 privately_attested_by_real_identity_provider:false,
 hosted_gateway_reachable:false,
 can_provision_ledger:false,can_upload_qa_worker:false,can_deploy:false,
 can_run_hosted_private_intake_uat:false,
 can_change_access:false,can_change_billing:false,
 can_write_commerce:false,can_send_provider_messages:false,
 mutations_executed:false
});
function verifyWitness(att,witness,pinned){
 try{
  if(!isObj(att)||!isObj(witness)||!isObj(pinned)||
    pinned.source!=='INDEPENDENT_PRIVATE_TRUST_ROOT'||
    pinned.key_id!==witness.key_id||typeof pinned.spki_pem!=='string'||
    typeof witness.signature!=='string'||
    !/^[A-Za-z0-9_-]{86}$/.test(witness.signature))return false;
  const b=Buffer.from(witness.signature,'base64url');
  if(b.length!==64||b.toString('base64url')!==witness.signature)return false;
  const key=createPublicKey(pinned.spki_pem);
  return key.asymmetricKeyType==='ed25519'&&
   edVerify(null,Buffer.from('T404_V174P_4B6_OUT_OF_BAND_AUTHORITY_BINDING\n'+canonical(att)),key,b);
 }catch{return false;}
}
/**
 * Snapshot should be sanitized from real GET responses by an independent,
 * authenticated collector. This code cannot establish that a caller's
 * snapshot came from Cloudflare, so successful math is NEVER hosted UAT
 * acceptance. Real GET tool results must be separately reported as such.
 */
export function assessHostedNoDeployAuthority({
 cloudflareSnapshot,authorityBinding,witness,pinnedPrivateRoot,
 independentlyVerifiedDossierDigest,now=Date.now()
}={}){
 const e=[],check=(n,yes)=>{if(yes!==true)e.push(n);};
 const s=isObj(cloudflareSnapshot)?cloudflareSnapshot:{};
 const a=isObj(authorityBinding)?authorityBinding:{};
 const w=isObj(witness)?witness:{};
 const root=isObj(pinnedPrivateRoot)?pinnedPrivateRoot:{};
 check('exact_control_plane_snapshot_fields',equal(keys(s),snapFields));
 check('account_bound_and_get_only',
   s.account_id===ACCOUNT&&s.source==='CLOUDFLARE_READ_ONLY_CONTROL_PLANE'&&
   equal(s.methods_used,['GET']));
 check('snapshot_fresh_60s',
   Number.isSafeInteger(now)&&Number.isSafeInteger(s.capture_time_ms)&&
   s.capture_time_ms<=now&&now-s.capture_time_ms<=60000);
 for(const name of ['workers','scripts','durable_objects','access_apps','access_policies','members']){
  const value=s[name];
  check('full_paginated_'+name,
   isObj(value)&&equal(keys(value),listFields)&&value.status==='COMPLETE'&&
   Number.isSafeInteger(value.count)&&Number.isSafeInteger(value.total_count)&&
   value.count===value.total_count&&Array.isArray(value.entries)&&
   value.entries.length===value.count);
 }
 const wn=s.workers?.entries,sc=s.scripts?.entries,ns=s.durable_objects?.entries,ap=s.access_apps?.entries;
 check('distinct_worker_and_script_names_no_target_collision',
   unique(wn)&&unique(sc)&&equal([...Array.isArray(wn)?wn:[]].sort(),[...Array.isArray(sc)?sc:[]].sort())&&
   !wn?.includes(WORKER)&&!wn?.includes(LEDGER));
 check('existing_do_namespace_integrity',
   Array.isArray(ns)&&ns.every(x=>isObj(x)&&equal(keys(x),namespaceFields)&&
    typeof x.name==='string'&&typeof x.script==='string'&&typeof x.class==='string')&&
   unique(Array.isArray(ns)?ns.map(x=>x.name):[])&&
   PROTECTED.every(n=>ns.some(x=>x.name===n))&&
   !ns.some(x=>x.name.includes(WORKER)||x.name.includes(LEDGER)));
 check('two_current_access_apps_without_v174p',
   Array.isArray(ap)&&unique(ap)&&!ap.some(x=>x.includes(WORKER)||x.includes(LEDGER)));
 const members=s.members?.entries;
 check('complete_member_roster_no_personal_data',
   Array.isArray(members)&&members.every(m=>isObj(m)&&equal(keys(m),memberFields)&&
    hash(m.member_ref_hash)&&m.status==='accepted'&&
    Array.isArray(m.role_names)&&unique(m.role_names)&&
    m.role_names.every(n=>typeof n==='string'&&n.length<120))&&
   unique(Array.isArray(members)?members.map(x=>x.member_ref_hash):[]));
 check('exact_authority_binding_fields',equal(keys(a),signFields));
 check('same_account_ledger_first_readonly',
   a.contract===CONTRACT&&a.account_id===ACCOUNT&&a.phase===PHASE&&
   a.read_only_only===true&&a.allow_resource_create===false&&
   a.allow_access_policy_change===false&&
   a.allow_billing_limit_change===false&&a.allow_real_commerce===false);
 check('digest_binds_current_cloudflare_snapshot',
   hash(a.cloudflare_snapshot_sha256)&&a.cloudflare_snapshot_sha256===digest(s));
 check('strict_owner_member_role_mapping_not_whoami',
   hash(a.owner_member_ref_hash)&&
   Array.isArray(members)&&members.some(m=>m.member_ref_hash===a.owner_member_ref_hash&&
    m.status==='accepted'&&m.role_names.includes(roleSuper))&&
   hash(a.owner_subject_hash));
 check('independent_real_authority_subjects_declared_and_distinct',
   ['owner_subject_hash','finance_subject_hash','operator_subject_hash','rollback_subject_hash']
    .every(n=>hash(a[n]))&&
   new Set([a.owner_subject_hash,a.finance_subject_hash,
    a.operator_subject_hash,a.rollback_subject_hash]).size===4);
 check('finance_amounts_strict_and_separately_allocated',
   positiveUSD(a.finance_qa_worker_budget_usd)&&
   positiveUSD(a.finance_ledger_budget_usd)&&
   a.finance_qa_worker_budget_usd+a.finance_ledger_budget_usd<=25);
 check('owner_finance_registry_and_dossier_pinned',
   hash(a.approved_owner_permit_sha256)&&hash(a.approved_finance_packet_sha256)&&
   hash(a.authorized_actor_registry_sha256)&&
   hash(independentlyVerifiedDossierDigest));
 check('fresh_signed_authorization_window',
   fmtTime(a.signed_at)&&fmtTime(a.expires_at)&&
   Date.parse(a.signed_at)<=now&&Date.parse(a.expires_at)>now&&
   Date.parse(a.expires_at)-Date.parse(a.signed_at)<=900000&&
   typeof a.nonce==='string'&&/^[a-f0-9]{32,64}$/.test(a.nonce));
 check('independent_pinned_authority_root_signature_math',
   verifyWitness(a,w,root));
 // Billing access is not a permission to approve costs. But a FORBIDDEN
 // spend-policy GET must never be converted to "budget reviewed".
 const bill=s.billing_spend_policies;
 check('independently_observable_cloudflare_spend_controls',
   isObj(bill)&&equal(keys(bill),['status'])&&
   bill.status==='READ_ONLY_VERIFIED');
 return deny(e,{
  cloudflare_member_count_observed:members?.length??null,
  current_v174p_worker_observed:!!wn?.includes(WORKER),
  current_v174p_ledger_observed:!!wn?.includes(LEDGER),
  finance_risk_verified_by_actual_cloudflare_billing:false
 });
}
