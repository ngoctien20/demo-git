/**
 * TIEN404 V17.4P-HOSTED.4B.8 — PRIVATE FINANCE DELEGATION × IDENTITY CHALLENGE.
 * PURE REVIEW-ONLY: NO NETWORK, BILLING MUTATION, PRIVATE DOCUMENT,
 * WORKER DEPLOY, HOSTED LEDGER ALLOCATION OR PUBLIC ENDPOINT.
 *
 * External trust roots / billing receipts / nonce receipts supplied by a
 * caller are mathematical inputs, NOT independently proven real authority.
 * Even a fully consistent synthetic packet always returns NO-GO.
 */
import {createHash,createPublicKey,verify as edVerify} from 'node:crypto';
import {ACCOUNT,WORKER,LEDGER} from './hosted4b4-independent-finance-ledger-gate.mjs';
import {digest as inventoryDigest} from './hosted4b6-private-authority-readonly-uat.mjs';

export const CONTRACT='T404_V174P_HOSTED4B8_INDEPENDENT_FINANCE_CHALLENGE_V1';
const roles=['owner','finance','auditor','broker','challenge_ledger'];
const ownerFields=['contract','account_id','phase','target_worker','owner_subject_sha256',
 'owner_member_sha256','finance_subject_sha256','auditor_subject_sha256',
 'rollback_subject_sha256','git_sha','manifest_sha256','inventory_sha256',
 'billing_evidence_sha256','mandate_ref','dossier_sha256','finance_authority_basis',
 'ledger_budget_usd','qa_budget_usd','cost_window_id','nonce','issued_at',
 'expires_at','no_public_url','no_existing_resource_change','no_billing_change',
 'no_access_change','no_secrets','no_provider_sends','no_commerce_writes',
 'no_auto_deploy','ack_account_wide_spend','ack_storage_not_hard_cap',
 'claim_hard_invoice_cap'].sort();
const challengeFields=['contract','account_id','delegation_sha256','nonce',
 'owner_subject_sha256','finance_subject_sha256','owner_session_sha256',
 'finance_session_sha256','owner_auth_at','finance_auth_at','owner_mfa_method','finance_mfa_method',
 'audience','phase','issued_at','expires_at','ledger_receipt_sha256'].sort();
const receiptFields=['contract','nonce_sha256','delegation_sha256','status',
 'issued_at','expires_at','ledger_instance_sha256'].sort();
const billFields=['status','account_id','captured_at','digest_sha256','independent_source'].sort();
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const keys=x=>object(x)?Object.keys(x).sort():[];
const eq=(x,y)=>JSON.stringify(x)===JSON.stringify(y);
const hash=x=>typeof x==='string'&&/^[0-9a-f]{64}$/.test(x);
const sha=x=>createHash('sha256').update(x,'utf8').digest('hex');
const iso=x=>typeof x==='string'&&Number.isFinite(Date.parse(x))&&new Date(Date.parse(x)).toISOString()===x;
function canonical(x){
 if(Array.isArray(x))return '['+x.map(canonical).join(',')+']';
 if(object(x))return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}';
 return JSON.stringify(x);
}
export const digest=x=>sha(canonical(x));
const hasFields=(x,fields)=>eq(keys(x),fields);
const fresh=(from,to,now,seconds)=>iso(from)&&iso(to)&&Number.isSafeInteger(now)&&
 Date.parse(from)<=now&&now<Date.parse(to)&&
 Date.parse(to)-Date.parse(from)<=seconds*1000&&now-Date.parse(from)<=seconds*1000;
function checkSignature(msg,signature,root,purpose){
 try {
  if(!object(signature)||!object(root)||
   root.source!=='EXTERNALLY_REGISTERED_PRIVATE_ROLE_KEY'||
   signature.key_id!==root.key_id||typeof signature.signature!=='string'||
   !/^[A-Za-z0-9_-]{86}$/.test(signature.signature))return false;
  const b=Buffer.from(signature.signature,'base64url');
  if(b.length!==64||b.toString('base64url')!==signature.signature)return false;
  const pub=createPublicKey(root.spki_pem);
  return pub.asymmetricKeyType==='ed25519'&&
   edVerify(null,Buffer.from('T404_V174P_4B8:'+purpose+'\n'+canonical(msg)),pub,b);
 }catch{return false;}
}
const noGo=(reasons,phase)=>Object.freeze({
 contract:CONTRACT,
 decision:reasons.length?'BLOCKED':'CRYPTOGRAPHICALLY_CONSISTENT_REVIEW_ONLY',
 reasons:[...new Set(reasons)],phase:phase??null,
 real_finance_mandate_verified:false,real_owner_session_verified:false,
 actual_private_challenge_verified:false,hosted_ledger_exists_verified:false,
 billing_access_or_budget_verified:false,nonce_replay_durable_verified:false,
 can_upload:false,can_create_ledger:false,can_change_access:false,
 can_change_billing:false,can_send_provider_message:false,
 can_write_commerce:false,mutations_executed:false
});

/**
 * For future private security reviewers: real trusted keys MUST be pinned in
 * an independent audited IdP+registry, not taken from caller JSON/GitHub.
 * "RESERVED" in a supplied receipt is NOT an actual hosted ledger commit.
 */
export function reviewDelegationAndChallenge({
 delegation,challenge,nonceReceipt,signatures,trustRoots,
 cloudflareSnapshot,billingEvidence,now=Date.now()
}={}){
 const e=[],assert=(name,ok)=>{if(ok!==true)e.push(name);};
 const d=object(delegation)?delegation:{};
 const c=object(challenge)?challenge:{};
 const nr=object(nonceReceipt)?nonceReceipt:{};
 const sig=object(signatures)?signatures:{};
 const t=object(trustRoots)?trustRoots:{};
 const s=object(cloudflareSnapshot)?cloudflareSnapshot:{};
 const bill=object(billingEvidence)?billingEvidence:{};
 const phase='LEDGER_FIRST_INACTIVE_UPLOAD';
 assert('strict_delegation_fields',hasFields(d,ownerFields));
 assert('exact_account_ledger_first_scope',
  d.contract===CONTRACT&&d.account_id===ACCOUNT&&d.phase===phase&&
  d.target_worker===LEDGER&&typeof d.git_sha==='string'&&/^[a-f0-9]{40}$/.test(d.git_sha)&&
  ['owner_subject_sha256','owner_member_sha256','finance_subject_sha256',
   'auditor_subject_sha256','rollback_subject_sha256','manifest_sha256',
   'inventory_sha256','billing_evidence_sha256','dossier_sha256'].every(k=>hash(d[k])));
 assert('separate_owner_finance_auditor_rollback_principals',
  new Set([d.owner_subject_sha256,d.finance_subject_sha256,
   d.auditor_subject_sha256,d.rollback_subject_sha256]).size===4);
 assert('delegation_legal_basis_and_private_mandate',
  d.finance_authority_basis==='OWNER_SIGNED_FINANCE_DELEGATION_AND_AUDITOR_REVIEW'&&
  typeof d.mandate_ref==='string'&&/^EV-[A-Za-z0-9_-]{8,64}$/.test(d.mandate_ref));
 assert('finance_and_ledger_positive_usd_scoped',
  Number.isFinite(d.qa_budget_usd)&&d.qa_budget_usd>0&&
  Number.isFinite(d.ledger_budget_usd)&&d.ledger_budget_usd>0&&
  d.qa_budget_usd+d.ledger_budget_usd<=25&&
  d.claim_hard_invoice_cap===false&&
  d.ack_account_wide_spend===true&&d.ack_storage_not_hard_cap===true);
 assert('no_public_cost_access_or_existing_service_changes',
  ['no_public_url','no_existing_resource_change','no_billing_change',
   'no_access_change','no_secrets','no_provider_sends','no_commerce_writes',
   'no_auto_deploy'].every(k=>d[k]===true));
 assert('one_day_delegation_and_unique_nonce',
  fresh(d.issued_at,d.expires_at,now,86400)&&
  typeof d.cost_window_id==='string'&&/^[a-z0-9-]{8,80}$/.test(d.cost_window_id)&&
  typeof d.nonce==='string'&&/^[a-f0-9]{64}$/.test(d.nonce));
 assert('complete_distinct_registered_role_keys',
  hasFields(t,[...roles].sort())&&
  roles.every(k=>object(t[k])&&t[k].role===k&&
   t[k].source==='EXTERNALLY_REGISTERED_PRIVATE_ROLE_KEY'&&
   typeof t[k].key_id==='string'&&t[k].key_id.length>=8&&
   typeof t[k].spki_pem==='string')&&
  new Set(roles.map(k=>t[k]?.key_id)).size===5&&
  new Set(roles.map(k=>t[k]?.spki_pem)).size===5);
 assert('exact_signed_role_sets',hasFields(sig,['owner','finance','auditor',
  'broker_challenge','owner_response','finance_response','challenge_ledger'].sort()));
 assert('owner_signed_finance_mandate',
  checkSignature(d,sig.owner,t.owner,'OWNER_FINANCE_DELEGATION'));
 assert('independent_auditor_reviews_mandate',
  checkSignature(d,sig.auditor,t.auditor,'AUDITOR_FINANCE_DELEGATION_REVIEW'));
 assert('finance_delegate_signs_acceptance',
  checkSignature(d,sig.finance,t.finance,'FINANCE_ACCEPTS_DELEGATION'));
 assert('strict_private_challenge_fields',hasFields(c,challengeFields));
 assert('challenge_binds_owner_finance_and_delegation',
  c.contract===CONTRACT&&c.account_id===ACCOUNT&&c.phase===phase&&
  c.delegation_sha256===digest(d)&&
  c.owner_subject_sha256===d.owner_subject_sha256&&
  c.finance_subject_sha256===d.finance_subject_sha256&&
  hash(c.owner_session_sha256)&&hash(c.finance_session_sha256)&&
  c.owner_session_sha256!==c.finance_session_sha256&&
  c.audience==='t404:private:finance-delegation-review'&&
  c.owner_mfa_method==='phishing_resistant'&&
  c.finance_mfa_method==='phishing_resistant'&&
  typeof c.nonce==='string'&&/^[a-f0-9]{64}$/.test(c.nonce)&&c.nonce!==d.nonce);
 assert('fresh_challenge_and_both_recent_MFA_sessions',
  fresh(c.issued_at,c.expires_at,now,120)&&
  iso(d.issued_at)&&iso(d.expires_at)&&
  Date.parse(c.issued_at)>=Date.parse(d.issued_at)&&
  Date.parse(c.expires_at)<=Date.parse(d.expires_at)&&
  iso(c.owner_auth_at)&&iso(c.finance_auth_at)&&
  Date.parse(c.owner_auth_at)<=now&&Date.parse(c.finance_auth_at)<=now&&
  now-Date.parse(c.owner_auth_at)<=300000&&
  now-Date.parse(c.finance_auth_at)<=300000);
 assert('independent_broker_challenge_signature',
  checkSignature(c,sig.broker_challenge,t.broker,'BROKER_ISSUES_PRIVATE_CHALLENGE'));
 assert('owner_fresh_challenge_response',
  checkSignature(c,sig.owner_response,t.owner,'OWNER_CHALLENGE_RESPONSE'));
 assert('finance_fresh_challenge_response',
  checkSignature(c,sig.finance_response,t.finance,'FINANCE_CHALLENGE_RESPONSE'));
 assert('strict_nonce_reservation_fields',hasFields(nr,receiptFields));
 assert('nonce_receipt_binds_challenge_not_expired',
  nr.contract===CONTRACT&&nr.status==='SYNTHETIC_RECEIPT_NOT_HOSTED_PROOF'&&
  nr.nonce_sha256===sha(c.nonce)&&nr.delegation_sha256===digest(d)&&
  hash(nr.ledger_instance_sha256)&&
  fresh(nr.issued_at,nr.expires_at,now,120)&&
  iso(c.issued_at)&&iso(c.expires_at)&&
  Date.parse(nr.issued_at)>=Date.parse(c.issued_at)&&
  Date.parse(nr.expires_at)<=Date.parse(c.expires_at)&&
  c.ledger_receipt_sha256===digest(nr));
 assert('independent_signed_nonce_reservation',
  checkSignature(nr,sig.challenge_ledger,t.challenge_ledger,'CHALLENGE_LEDGER_RESERVATION'));
 const members=s.members?.entries;
 assert('cloudflare_member_owner_role_and_full_inventory',
  s.account_id===ACCOUNT&&s.source==='CLOUDFLARE_READ_ONLY_CONTROL_PLANE'&&
  Array.isArray(members)&&s.members.count===members.length&&
  s.members.total_count===members.length&&
  members.some(m=>m.member_ref_hash===d.owner_member_sha256&&
   m.status==='accepted'&&m.role_names?.includes('Super Administrator - All Privileges'))&&
  s.workers?.count===s.workers?.total_count&&
  s.scripts?.count===s.scripts?.total_count&&
  s.durable_objects?.count===s.durable_objects?.total_count&&
  Array.isArray(s.workers?.entries)&&
  !s.workers.entries.includes(LEDGER)&&!s.workers.entries.includes(WORKER));
 const wn=s.workers?.entries,sc=s.scripts?.entries,ns=s.durable_objects?.entries;
 const protectedDo=[
  ['tien404-v175e2-durable-replay-nosend-staging_ReplayBucket',
   'tien404-v175e2-durable-replay-nosend-staging','ReplayBucket'],
  ['tien404-v175e2a-private-hosted-runner-nosend-staging_RunnerResults',
   'tien404-v175e2a-private-hosted-runner-nosend-staging','RunnerResults'],
  ['tien404-v1721h2-zalo-replay-private-nosend-staging_ZaloBotReplayBucketV2',
   'tien404-v1721h2-zalo-replay-private-nosend-staging','ZaloBotReplayBucketV2']
 ];
 assert('protected_parallel_workers_do_and_script_integrity',
  Array.isArray(wn)&&Array.isArray(sc)&&Array.isArray(ns)&&
  wn.length===s.workers?.count&&sc.length===s.scripts?.count&&
  ns.length===s.durable_objects?.count&&
  new Set(wn).size===wn.length&&
  JSON.stringify([...wn].sort())===JSON.stringify([...sc].sort())&&
  protectedDo.every(([name,script,klass])=>ns.some(x=>
    x.name===name&&x.script===script&&x.class===klass))&&
  !ns.some(x=>String(x.name).includes(LEDGER)||String(x.name).includes(WORKER)));
 assert('snapshot_fresh_and_exact_inventory_hash',
  Number.isSafeInteger(s.capture_time_ms)&&s.capture_time_ms<=now&&
  now-s.capture_time_ms<=60000&&
  d.inventory_sha256===inventoryDigest(s));
 assert('actual_finance_billing_evidence_not_403',
  hasFields(bill,billFields)&&bill.account_id===ACCOUNT&&
  bill.status==='READ_ONLY_VERIFIED'&&
  bill.independent_source==='RESTRICTED_FINANCE_AUDIT'&&
  iso(bill.captured_at)&&Date.parse(bill.captured_at)<=now&&
  now-Date.parse(bill.captured_at)<=300000&&
  hash(bill.digest_sha256)&&bill.digest_sha256===d.billing_evidence_sha256);
 return noGo(e,phase);
}
