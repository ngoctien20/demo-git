/**
 * TIEN404 V17.4P-HOSTED.4B.2 — SOURCE-ONLY:
 * atomic one-use permit reservation and before/after change-set review.
 *
 * No Cloudflare mutation, no deployment executor, no secrets, no owner identity.
 * A successful synthetic claim is NOT evidence of a real durable ledger.
 */
import {createHash} from 'node:crypto';
import {preflightInactivePermit,ACCOUNT,WORKER} from './hosted4b1-private-signed-permit.mjs';

export const CONTRACT='T404_V174P_HOSTED4B2_ATOMIC_CLAIM_OFFLINE_ONLY_V1';
const DO_NAME=WORKER+'_V174PReplayGuard';
const isObj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const list=x=>Array.isArray(x)?x:[];
const hash=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x),'utf8').digest('hex');
const sortedString=x=>[...x].sort().join('|');
const unique=xs=>new Set(xs).size===xs.length;
const VALID_UUID=x=>typeof x==='string'&&/^[a-f0-9]{32}$/i.test(x);
function indexBy(items,name){
 if(!Array.isArray(items)||items.some(x=>!isObj(x)||typeof x[name]!=='string')||
    !unique(items.map(x=>x[name])))return null;
 return new Map(items.map(x=>[x[name],x]));
}
function equalObj(a,b){return JSON.stringify(a)===JSON.stringify(b);}
function diffResource(before,after,key,target){
 const b=indexBy(before,key),a=indexBy(after,key);
 if(!a||!b)return null;
 const removed=[...b.keys()].filter(k=>!a.has(k));
 const added=[...a.keys()].filter(k=>!b.has(k));
 const changed=[...b.keys()].filter(k=>a.has(k)&&!equalObj(b.get(k),a.get(k)));
 if(removed.length||changed.length||added.length!==1||added[0]!==target)return null;
 return a.get(target);
}
const DISABLED=Object.freeze({
 can_upload:false,can_deploy:false,can_change_access:false,
 can_enable_public_route:false,can_run_cloudflare_uat:false
});
/**
 * Reserve in a TRUSTED private durable ledger, before asking an operator to
 * consider a manual upload. Failure is final: never release a consumed permit.
 *
 * Ledger must atomically deduplicate both nonce_hash AND (account,worker,phase);
 * an in-memory Map is suitable for TESTS ONLY, not multi-process production.
 *
 * The callback getFreshInventory must retrieve an independent Cloudflare GET,
 * not a user-provided fixture. It is invoked only AFTER a successful reservation;
 * no writes are performed by this module apart from the operator-supplied ledger.
 */
export async function preparePrivatePermitForManualReview({
 evidence,privateLedger,getFreshInventory,now=Date.now()
}={}){
 const gate=preflightInactivePermit({...evidence,now});
 const base={contract:CONTRACT,...DISABLED,hosted_mutation:false};
 if(gate.decision!=='SIGNED_PACKET_INTERNALLY_CONSISTENT_REQUIRES_OPERATOR_EXECUTION_APPROVAL')
  return Object.freeze({...base,status:'BLOCKED_PERMIT_PREFLIGHT',reasons:gate.reasons,
   ledger_mutation_attempted:false});
 if(!privateLedger||typeof privateLedger.claimOnce!=='function'||
    typeof getFreshInventory!=='function')
  return Object.freeze({...base,status:'BLOCKED_TRUSTED_LEDGER_OR_READER_MISSING',
    ledger_mutation_attempted:false});
 const p=evidence?.permit;
 const prior=evidence?.inventoryEvidence?.inventory;
 const nonceKey=hash('T404_V174P4B2_NONCE:'+p.account_id+':'+p.nonce);
 const permitKey=hash('T404_V174P4B2_PACKET:'+JSON.stringify(p));
 let claim;
 try{
  claim=await privateLedger.claimOnce({
   nonce_hash:nonceKey,permit_hash:permitKey,
   account_id:ACCOUNT,worker_name:WORKER,phase:'FIRST_UPLOAD_INACTIVE_ONLY',
   expires_at:p.expires_at
  });
 }catch{
  return Object.freeze({...base,status:'BLOCKED_LEDGER_ERROR',
    ledger_mutation_attempted:true});
 }
 if(!isObj(claim)||claim.claimed!==true||claim.durable_commit_confirmed!==true||
    typeof claim.receipt_id!=='string'||claim.receipt_id.length<8)
  return Object.freeze({...base,status:'BLOCKED_NONCE_REPLAY_OR_LEDGER_UNCERTAIN',
    ledger_mutation_attempted:true});
 let refreshed;
 try{refreshed=await getFreshInventory();}
 catch{
  return Object.freeze({...base,status:'BLOCKED_INVENTORY_REFRESH_FAILED_PERMIT_CONSUMED',
   ledger_mutation_attempted:true,permit_consumed:true});
 }
 const fresh=refreshed?.inventory;
 const sameAsSigned=isObj(fresh)&&refreshed.status==='COMPLETE_READ_ONLY_NEEDS_INDEPENDENT_REVIEW'&&
   list(refreshed.errors).length===0&&fresh.account_id===ACCOUNT&&
   fresh.page_verification?.status==='COMPLETE'&&
   fresh.page_verification?.cross_consistent===true&&
   Number.isSafeInteger(fresh.collected_at_ms)&&fresh.collected_at_ms<=now&&
   now-fresh.collected_at_ms<=60_000&&
   sameResourceNames(fresh,prior)&&
   !list(fresh.worker_names).includes(WORKER)&&
   !list(fresh.do_namespace_names).some(n=>n.includes(WORKER));
 if(!sameAsSigned)
  return Object.freeze({...base,status:'BLOCKED_CLOUD_INVENTORY_DRIFT_PERMIT_CONSUMED',
    ledger_mutation_attempted:true,permit_consumed:true});
 // Informational result only. A separate, independently authenticated HUMAN
 // operator must re-confirm permissions and use a bounded manual change window.
 return Object.freeze({...base,status:'ONE_TIME_PERMIT_RESERVED_FOR_MANUAL_REVIEW_ONLY',
  ledger_mutation_attempted:true,permit_consumed:true,
  receipt_hash:hash(claim.receipt_id),reverified_inventory:true});
}
function sameResourceNames(a,b){
 return isObj(a)&&isObj(b)&&
  ['script_names','worker_names','do_namespace_names','access_app_names']
    .every(k=>Array.isArray(a[k])&&Array.isArray(b[k])&&
      unique(a[k])&&unique(b[k])&&sortedString(a[k])===sortedString(b[k]))&&
  a.page_verification?.total_workers===b.page_verification?.total_workers&&
  a.page_verification?.total_scripts===b.page_verification?.total_scripts;
}
/**
 * Independently compare complete raw Cloudflare snapshots collected before
 * and after a FUTURE explicitly approved inactive first upload. This does NOT
 * execute the upload or prove a public endpoint is impossible.
 *
 * Objects must carry stable resource IDs and the independent route/exposure
 * control-plane evidence. A missing namespace, a renamed V17.5 DO, an
 * Access/domain/policy change or an unintended trigger fails closed.
 */
export function assessInactiveCloudflareChangeSet({
 before,after,exposure,independentReview
}={}){
 const reasons=[];
 const check=(key,yes)=>{if(yes!==true)reasons.push(key);};
 const b=isObj(before)?before:{},a=isObj(after)?after:{};
 check('verified_exact_target_account',
   b.account_id===ACCOUNT&&a.account_id===ACCOUNT);
 const bw=indexBy(b.workers,'name'),aw=indexBy(a.workers,'name');
 const bs=indexBy(b.scripts,'id'),as=indexBy(a.scripts,'id');
 const bd=indexBy(b.namespaces,'id'),ad=indexBy(a.namespaces,'id');
 check('complete_distinct_ids_and_names',
   !!bw&&!!aw&&!!bs&&!!as&&!!bd&&!!ad&&
   unique(list(b.workers).map(x=>x.id))&&
   unique(list(a.workers).map(x=>x.id))&&
   unique(list(b.namespaces).map(x=>x.name))&&
   unique(list(a.namespaces).map(x=>x.name)));
 const newWorker=diffResource(b.workers,a.workers,'name',WORKER);
 const newScript=diffResource(b.scripts,a.scripts,'id',WORKER);
 const newNS=(()=>{if(!bd||!ad)return null;
   const added=[...ad.keys()].filter(id=>!bd.has(id));
   const removed=[...bd.keys()].filter(id=>!ad.has(id));
   const changed=[...bd.keys()].filter(id=>ad.has(id)&&!equalObj(bd.get(id),ad.get(id)));
   if(added.length!==1||removed.length||changed.length)return null;
   return ad.get(added[0]);
 })();
 check('exactly_one_new_dedicated_worker_and_version',
   !!newWorker&&VALID_UUID(newWorker.id)&&!!newScript);
 check('exactly_one_new_owned_sqlite_namespace',
   !!newNS&&VALID_UUID(newNS.id)&&newNS.name===DO_NAME&&
   newNS.script===WORKER&&newNS.class==='V174PReplayGuard');
 for(const key of ['access_apps','access_policies','domains']){
  const x=indexBy(b[key],'id'),y=indexBy(a[key],'id');
  check('no_unapproved_'+key+'_changes',!!x&&!!y&&
    x.size===y.size&&[...x].every(([id,z])=>y.has(id)&&equalObj(y.get(id),z)));
 }
 check('independent_no_public_exposure_proof',
   isObj(exposure)&&exposure.worker_name===WORKER&&
   exposure.workers_dev===false&&exposure.preview_urls===false&&
   Array.isArray(exposure.routes)&&exposure.routes.length===0&&
   exposure.cron_triggers===0&&exposure.queue_consumers===0&&
   exposure.other_public_bindings===0&&
   independentReview?.control_plane_exposure_verified===true);
 check('independent_resource_id_review',
   independentReview?.before_after_connector_attested===true&&
   independentReview?.v175_namespace_ids_preserved===true);
 return Object.freeze({
  contract:CONTRACT,
  status:reasons.length?'BLOCKED_OR_INCOMPLETE':'SOURCE_EVIDENCE_CONSISTENT_REQUIRES_INDEPENDENT_ACCEPTANCE',
  reasons,
  candidate_worker_name:WORKER,
  candidate_worker_id:!reasons.length?newWorker.id:null,
  candidate_namespace_id:!reasons.length?newNS.id:null,
  cloudflare_mutations_performed_by_this_check:false,
  new_worker_exists_in_actual_cloudflare_unverified:true,
  can_enable_public_url:false,
  can_enable_provider_sends:false,
  commerce_authorized:false,
  ...DISABLED
 });
}
