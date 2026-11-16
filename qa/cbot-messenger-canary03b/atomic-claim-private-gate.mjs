/**
 * TIEN404 CBOT-MSG-CANARY-03B
 * Source-only at-most-once claim protocol and private evidence gates.
 * Not a deployed provider listener. No external storage, no Meta token.
 * A real release REQUIRES unique-key durable transactional backend and
 * independent Page/recipient authorization; this module cannot grant it.
 */
export const BASE=Object.freeze({
 workflow_id:'Z7FdV7uDvApfbURQ',
 published_version:'d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92',
 node_count:27,app_role:'ADMIN_UI_OBSERVED',
 recipient_proof:'NOT_VERIFIED_PRIVATELY',
 app_page_binding:'NOT_VERIFIED_PRIVATELY'
});
const isObj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x) &&
 Object.getPrototypeOf(x)===Object.prototype;
const BANNED_KEYS=new Set(['psid','sender_id','recipient_id','page_id',
 'access_token','app_secret','customer_name','email','phone','role','is_admin',
 'verified','approved','authorization','credential','token']);
const keys=['contract','source','app_role','page_full_control',
 'app_page_messages_subscription','qa_recipient_binding','qa_consent',
 'independent_reviewer','owner_final_patch_approval','exact_published_version',
 'rollback_private_snapshot','atomic_backend_verified','live_canary_sent'];
export function assessPrivateProofRecord(record){
 const reasons=[];
 if(!isObj(record)||Object.keys(record).length!==keys.length||
 Object.keys(record).some(k=>!keys.includes(k)||BANNED_KEYS.has(k))||
 record.contract!=='T404_CANARY03B_PRIVATE_EVIDENCE_V1'||
 record.source!=='PUBLIC_REDACTED_GATE_ONLY'||
 record.exact_published_version!==BASE.published_version||
 record.app_role!=='ADMIN_UI_OBSERVED'||
 record.page_full_control!=='OWNER_ATTESTED'||
 record.live_canary_sent!==false)
  return Object.freeze({decision:'NO_GO',reasons:['INVALID_PUBLIC_EVIDENCE'],
   can_publish:false,can_send:false});
 for(const field of [
 'app_page_messages_subscription','qa_recipient_binding','qa_consent',
 'independent_reviewer','owner_final_patch_approval',
 'rollback_private_snapshot','atomic_backend_verified'
 ]){
  if(record[field]!=='PRIVATE_EVIDENCE_NOT_PRESENT')
   return Object.freeze({decision:'NO_GO',reasons:['UNTRUSTED_PRIVATE_PROOF_SELF_ASSERTION'],
    can_publish:false,can_send:false});
  reasons.push('MISSING_'+field.toUpperCase());
 }
 return Object.freeze({decision:'NO_GO',reasons:Object.freeze(reasons),
  source_only:true,can_publish:false,can_send:false,
  native_page_verified:false,real_recipient_bound:false,
  backend_durable_certified:false,one_send_approved:false});
}
/**
 * Production adapter contract: claimOnce(grantId, metadata) must perform a
 * single durable UNIQUE INSERT with ON CONFLICT DO NOTHING in one
 * database transaction. It must NOT be a separate check+insert or an n8n
 * Data Table read followed by a write.
 *
 * In-memory store here is exclusively a QA simulator.
 */
export function createSyntheticClaimLedger(){
 const entries=new Map();
 return Object.freeze({
  async claimOnce(grantId,metadata){
   if(entries.has(grantId))return false;
   entries.set(grantId,Object.freeze({...metadata,status:'CLAIMED'}));
   return true;
  },
  read(grantId){return entries.get(grantId)||null;},
  size(){return entries.size;}
 });
}
const internalClaims=new WeakSet();
const makeBlocked=reason=>Object.freeze({
 decision:'BLOCK',reason,can_send:false,provider_sends:0,
 orders_written:0,model_calls:0,published_changed:false
});
export function createSyntheticOneShotCanary({ledger,nowMs=()=>0}={}){
 if(!ledger||typeof ledger.claimOnce!=='function'||
 typeof ledger.read!=='function')throw new Error('ATOMIC_ADAPTER_REQUIRED');
 if(typeof nowMs!=='function')throw new Error('CLOCK_REQUIRED');
 // This synthetic test authority cannot be forged via caller-provided flags.
 const issued=new WeakSet();
 function issueSyntheticProof({
  grantId='QA_GRANT_001',page='QA_PAGE',recipient='QA_PSID',
  app='QA_APP',expiresAt=60000
 }={}){
  if(grantId!=='QA_GRANT_001'||page!=='QA_PAGE'||
    recipient!=='QA_PSID'||app!=='QA_APP'||
    expiresAt!==60000)
   throw new Error('NO_REAL_OR_EXTERNAL_PROOF_ACCEPTED');
  const proof=Object.freeze({grantId,page,recipient,app,expiresAt});
  issued.add(proof);
  return proof;
 }
 async function attempt({proof,marker,event,signatureVerified=false,
  dedupVerified=false,privateConsent=false}={}){
  if(!proof||!issued.has(proof))return makeBlocked('PRIVATE_AUTHORITY_NOT_ISSUED');
  if(event===null||!isObj(event)||
    Object.keys(event).length!==5||
    event.channel!=='MESSENGER'||event.page!==proof.page||
    event.recipient!==proof.recipient||event.app!==proof.app||
    !/^QA-EVT-[A-Z0-9-]{1,40}$/.test(String(event.messageId||'')))
    return makeBlocked('INVALID_EVENT_SCOPE');
  if(nowMs()>=proof.expiresAt||nowMs()<0)
    return makeBlocked('EXPIRED_OR_INVALID_CLOCK');
  if(!signatureVerified||!dedupVerified||!privateConsent)
    return makeBlocked('UNVERIFIED_SIGNATURE_DEDUP_OR_CONSENT');
  if(marker!=='TIEN404-CANARY-LIVE02')
    return makeBlocked('NOT_ONE_ALLOWED_GREETING');
  // Key deliberately uses the ONE-USE grant (not event MID), meaning
  // multiple different Meta message IDs still cannot claim a second send.
  const success=await ledger.claimOnce(proof.grantId,{
   eventId:event.messageId,scope:'QA_ONLY',recordedAt:nowMs()
  });
  if(!success)return makeBlocked('ONE_SHOT_ALREADY_CLAIMED');
  // CLAIM DOES NOT imply the provider accepted the send. No method here
  // sends a message; in a real uncertain-send state, do not auto retry.
  return Object.freeze({
   decision:'CLAIMED_OFFLINE_ONLY',can_send:false,
   provider_sends:0,orders_written:0,model_calls:0,
   published_changed:false,claim_consumed:true,
   production_provider_token_available:false,
   delivery_guarantee:'AT_MOST_ONE_ATTEMPT_NOT_EXACTLY_ONCE'
  });
 }
 return Object.freeze({issueSyntheticProof,attempt});
}
export function verifyOneShotSqlContract(sql){
 if(typeof sql!=='string'||sql.length>10000)return false;
 const compact=sql.toLowerCase().replace(/\s+/g,' ');
 return compact.includes('unique') &&
 compact.includes('grant_id') &&
 compact.includes('insert into') &&
 compact.includes('on conflict (grant_id) do nothing') &&
 compact.includes('returning') &&
 compact.includes('security invoker') &&
 compact.includes('revoke all on function') &&
 compact.includes('row level security') &&
 !/drop table|truncate|grant all|service_role|create extension/.test(compact);
}
