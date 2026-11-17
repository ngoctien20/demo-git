/**
 * TIEN404 V17.4P-HOSTED.4B.5 — PRIVATE EVIDENCE DOSSIER REVIEW ONLY.
 * No raw documents, credentials, file URLs, network, Cloudflare writes,
 * billable resource creations, or deployment capabilities.
 * An independent authenticated registry MUST provide trusted signer keys;
 * caller-supplied booleans and synthetic keys are NOT real human authority.
 */
import {createHash,createPublicKey,verify as verifySig} from 'node:crypto';
import {ACCOUNT,WORKER,LEDGER} from './hosted4b4-independent-finance-ledger-gate.mjs';

export const CONTRACT='T404_V174P_HOSTED4B5_PRIVATE_ATTESTED_DOSSIER_V1';
export const PHASE_LEDGER='LEDGER_FIRST_INACTIVE_UPLOAD';
export const PHASE_QA='QA_WORKER_FIRST_INACTIVE_UPLOAD';
const roles=['owner','finance','security','operator','rollback'];
const sha256=v=>createHash('sha256').update(v,'utf8').digest('hex');
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const k=x=>obj(x)?Object.keys(x).sort():[];
const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const has=(x,y)=>Array.isArray(x)&&x.includes(y);
const hash=x=>typeof x==='string'&&/^[0-9a-f]{64}$/.test(x);
const iso=x=>typeof x==='string'&&Number.isFinite(Date.parse(x))&&new Date(Date.parse(x)).toISOString()===x;
const packetKeys=['contract','phase','account_id','target_worker','source_git_sha',
 'owner_permit_sha256','finance_packet_sha256','inventory_sha256',
 'target_manifest_sha256','qa_budget_usd','ledger_budget_usd',
 'private_evidence_refs','issued_at','expires_at','nonce',
 'public_routes_allowed','preview_allowed','workers_dev_allowed',
 'existing_resources_mutation_allowed','production_writes_allowed',
 'budget_limits_mutation_allowed','automated_upload_allowed',
 'ledger_receipt_sha256'].sort();
const proofKinds=['owner_authority','finance_authority','security_review',
 'operator_mfa','rollback_acceptance'].sort();
const refKeys=['ref_id','sha256','kind'].sort();
const receiptKeys=['contract','resource','worker_name','worker_id',
 'namespace_id','namespace_name','created_at','inventory_before_sha256',
 'inventory_after_sha256','no_public_route','no_preview','no_workers_dev',
 'no_existing_resource_change','no_secrets','no_provider_sends'].sort();
function canon(x){
 if(Array.isArray(x))return '['+x.map(canon).join(',')+']';
 if(obj(x))return '{'+Object.keys(x).sort().map(y=>JSON.stringify(y)+':'+canon(x[y])).join(',')+'}';
 return JSON.stringify(x);
}
export const digest=x=>sha256(canon(x));
const domain=(phase,role)=>'T404_V174P_4B5_SIGNED_EVIDENCE:'+phase+':'+role+'\n';
function checkSignature(msg,s,anchor,prefix){
 try{
  if(!obj(s)||!obj(anchor)||anchor.registered_out_of_band!==true||
     s.key_id!==anchor.key_id||typeof s.signature!=='string'||
     !/^[A-Za-z0-9_-]{86}$/.test(s.signature))return false;
  const b=Buffer.from(s.signature,'base64url');
  if(b.length!==64||b.toString('base64url')!==s.signature)return false;
  const p=createPublicKey(anchor.spki_pem);
  return p.asymmetricKeyType==='ed25519'&&
   verifySig(null,Buffer.from(prefix+canon(msg)),p,b);
 }catch{return false;}
}
const fresh=(start,stop,now,ttl)=>{
 if(!iso(start)||!iso(stop)||!Number.isSafeInteger(now))return false;
 const a=Date.parse(start),b=Date.parse(stop);
 return a<=now&&now<b&&b-a<=ttl&&now-a<=ttl;
};
const finish=(errors,phase)=>Object.freeze({
 contract:CONTRACT,
 decision:errors.length?'BLOCKED':'SIGNED_METADATA_MATH_CONSISTENT_NOT_REAL_AUTHORIZATION',
 reasons:[...new Set(errors)],reviewed_phase:phase||null,
 operator_identity_verified_in_real_private_system:false,
 hosted_ledger_currently_deployed_verified:false,
 cost_hard_cap_guaranteed:false,
 can_upload:false,can_create_ledger:false,can_upload_qa_worker:false,
 can_change_access:false,can_change_secrets:false,can_change_billing:false,
 can_write_commerce:false,can_send_live_messages:false,
 cloudflare_writes_made:false
});
/**
 * Metadata only: ref_id plus SHA256; no user files or URLs are accepted.
 * Five independently keyed signatures are scoped to exactly one phase.
 * Even valid mathematics does not turn untrusted passed-in keys into identity.
 */
export function assessPrivateEvidenceDossier({
 packet,signatures,trustedRegistry,inventory,
 priorLedgerAcceptance,now=Date.now()
}={}){
 const e=[],check=(name,valid)=>{if(valid!==true)e.push(name);};
 const p=obj(packet)?packet:{};
 const s=obj(signatures)?signatures:{};
 const trust=obj(trustedRegistry)?trustedRegistry:{};
 const inv=obj(inventory)?inventory:{};
 const phase=p.phase;
 check('exact_metadata_only_fields',eq(k(p),packetKeys));
 check('target_account_and_phase',
   p.contract===CONTRACT&&p.account_id===ACCOUNT&&
   (phase===PHASE_LEDGER||phase===PHASE_QA)&&
   p.target_worker===(phase===PHASE_LEDGER?LEDGER:WORKER));
 check('immutable_source_and_approval_hashes',
   typeof p.source_git_sha==='string'&&/^[0-9a-f]{40}$/.test(p.source_git_sha)&&
   ['owner_permit_sha256','finance_packet_sha256','inventory_sha256',
    'target_manifest_sha256'].every(n=>hash(p[n])));
 check('short_lived_15_minute_packet',fresh(p.issued_at,p.expires_at,now,900000));
 check('unique_nonce',typeof p.nonce==='string'&&/^[a-f0-9]{32,64}$/.test(p.nonce));
 check('no_public_network_or_writes',
   p.public_routes_allowed===false&&p.preview_allowed===false&&
   p.workers_dev_allowed===false&&p.existing_resources_mutation_allowed===false&&
   p.production_writes_allowed===false&&p.budget_limits_mutation_allowed===false&&
   p.automated_upload_allowed===false);
 check('two_distinct_positive_usd_risk_allocations',
   Number.isFinite(p.qa_budget_usd)&&p.qa_budget_usd>0&&
   Number.isFinite(p.ledger_budget_usd)&&p.ledger_budget_usd>0&&
   p.qa_budget_usd+p.ledger_budget_usd<=25);
 const refs=p.private_evidence_refs;
 check('five_private_opaque_evidence_references_only',
   obj(refs)&&eq(k(refs),proofKinds)&&proofKinds.every(n=>{
    const x=refs[n];
    return obj(x)&&eq(k(x),refKeys)&&
     typeof x.ref_id==='string'&&/^EV-[A-Za-z0-9_-]{8,64}$/.test(x.ref_id)&&
     hash(x.sha256)&&x.kind===n;
   }));
 const pub=roles.map(n=>trust[n]?.spki_pem);
 check('five_independent_out_of_band_role_keys',
   roles.every(n=>obj(trust[n])&&trust[n].role===n&&
    trust[n].registered_out_of_band===true&&
    typeof trust[n].key_id==='string'&&trust[n].key_id.length>5&&
    typeof trust[n].spki_pem==='string')&&
   new Set(pub).size===roles.length&&
   new Set(roles.map(n=>trust[n]?.key_id)).size===roles.length);
 check('five_independently_signed_phase_bound_attestations',
   eq(k(s),[...roles].sort())&&
   roles.every(n=>checkSignature(p,s[n],trust[n],domain(phase,n))));
 check('exact_independent_registry_roles',
   eq(k(trust),[...roles,...(phase===PHASE_QA?['ledger_postflight']:[])].sort()));
 const x=inv.snapshot;
 check('fresh_full_independent_inventory_digest',
   inv.account_id===ACCOUNT&&
   inv.status==='COMPLETE_READ_ONLY_NEEDS_INDEPENDENT_REVIEW'&&
   Array.isArray(inv.errors)&&inv.errors.length===0&&
   obj(x)&&p.inventory_sha256===digest(x)&&
   Array.isArray(x.worker_names)&&Array.isArray(x.script_names)&&
   x.worker_names.length===x.script_names.length&&x.worker_names.length>0&&
   eq([...x.worker_names].sort(),[...x.script_names].sort())&&
   Number.isSafeInteger(x.collected_at_ms)&&now>=x.collected_at_ms&&
   now-x.collected_at_ms<=60000&&
   x.page_verification?.cross_consistent===true&&
   x.page_verification?.total_workers===x.worker_names.length&&
   x.page_verification?.total_scripts===x.script_names.length&&
   Array.isArray(x.do_namespace_names)&&
   [
    'tien404-v175e2-durable-replay-nosend-staging_ReplayBucket',
    'tien404-v175e2a-private-hosted-runner-nosend-staging_RunnerResults'
   ].every(q=>x.do_namespace_names.includes(q))&&
   new Set(x.worker_names).size===x.worker_names.length&&
   new Set(x.do_namespace_names).size===x.do_namespace_names.length);
 check('target_resource_absent',
   !has(x?.worker_names,p.target_worker)&&
   !has(x?.script_names,p.target_worker)&&
   !has(x?.access_app_names,p.target_worker));
 if(phase===PHASE_LEDGER){
  check('ledger_phase_requires_no_prior_receipt',
   p.ledger_receipt_sha256===null&&priorLedgerAcceptance==null);
  check('ledger_not_yet_present',!has(x?.worker_names,LEDGER));
 }else if(phase===PHASE_QA){
  check('qa_rejected_until_ledger_in_current_inventory',
   has(x?.worker_names,LEDGER)&&!has(x?.worker_names,WORKER)&&
   has(x?.do_namespace_names,LEDGER+'_V174PPermitLedger'));
  const l=obj(priorLedgerAcceptance)?priorLedgerAcceptance:{};
  const receipt=obj(l.receipt)?l.receipt:{};
  const anchor=trust.ledger_postflight;
  check('exact_prior_ledger_receipt_bound_to_new_inventory',
   hash(p.ledger_receipt_sha256)&&p.ledger_receipt_sha256===digest(receipt)&&
   eq(k(receipt),receiptKeys)&&
   receipt.contract==='T404_V174P_HOSTED_LEDGER_POSTFLIGHT_V1'&&
   receipt.resource===PHASE_LEDGER&&receipt.worker_name===LEDGER&&
   iso(receipt.created_at)&&Date.parse(receipt.created_at)<=now&&
   now-Date.parse(receipt.created_at)<=24*60*60*1000&&
   typeof receipt.worker_id==='string'&&/^[0-9a-f]{32}$/.test(receipt.worker_id)&&
   typeof receipt.namespace_id==='string'&&/^[0-9a-f]{32}$/.test(receipt.namespace_id)&&
   receipt.namespace_name===LEDGER+'_V174PPermitLedger'&&
   hash(receipt.inventory_before_sha256)&&
   receipt.inventory_after_sha256===digest(x)&&
   receipt.no_public_route===true&&receipt.no_preview===true&&
   receipt.no_workers_dev===true&&receipt.no_existing_resource_change===true&&
   receipt.no_secrets===true&&receipt.no_provider_sends===true);
  check('private_independent_ledger_postflight_signature',
   obj(anchor)&&anchor.role==='ledger_postflight'&&
   !pub.includes(anchor.spki_pem)&&
   checkSignature(receipt,l.signature,anchor,
    'T404_V174P_4B5_LEDGER_POSTFLIGHT_REVIEW\n'));
 }
 return finish(e,phase);
}
export const REQUIRED_ROLES=Object.freeze([...roles]);
export const PRIVATE_EVIDENCE_CATEGORIES=Object.freeze([...proofKinds]);
