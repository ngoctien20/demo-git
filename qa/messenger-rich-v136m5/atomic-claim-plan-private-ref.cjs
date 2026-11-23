'use strict';
/**
 * TIEN404 V21 P1 — atomic scoped event claim + plan + 1..3 parts + private ref.
 * OFFLINE SYNTHETIC TEST CONTRACT, NOT HOSTED MIGRATION OR MESSENGER SENDER.
 *
 * This standalone candidate extends (does not replace) atomic-claim-plan.cjs.
 * The private HMAC reference is derived from exactly the same domain, scope
 * and plan UUID as message-reconciliation-inspector.cjs / operator bridge.
 *
 * One PostgreSQL statement:
 *  claimed (unique scoped event, private lease)
 *     -> prepared (unique reply plan)
 *       -> parts (1..3 planned messages)
 *       -> mapped (ONE immutable opaque reference -> plan/scope)
 * No client may submit a reference or plan UUID; no lease, PSID, raw id,
 * raw sender hash or token is returned. Duplicate/rejected = NO SEND HOLD.
 *
 * If one mapping conflicts (reference collision or plan-id collision), the
 * callback MUST throw before commit and the transaction driver MUST roll back
 * ALL claim+plan+parts+mapping state. A claim surviving a failed mapping is P1.
 */
const {createHmac,randomUUID}=require('node:crypto');
const {deriveIdentity}=require('./private-event-store.cjs');
const {SQL:atomic}=require('./atomic-claim-plan.cjs');
const HASH=/^[a-f0-9]{64}$/;
const fail=code=>{const e=new Error(code);e.code=code;throw e;};
const ANCHOR='RETURNING plan_id ) SELECT p.id::text AS plan_id';
const END='WHERE (SELECT count(*) FROM parts)=p.expected_count';
if(!atomic.claimAndPlan.includes(ANCHOR)||!atomic.claimAndPlan.endsWith(END))
 fail('ATOMIC_REF_BASE_SQL_VERSION_DRIFT');
const MAPPING=[
 'RETURNING plan_id',
 '), mapped AS (',
 'INSERT INTO app_private.messenger_reconciliation_refs',
 '(reference,plan_id,tenant_id,store_id,page_id)',
 'SELECT $14,p.id,$2::uuid,$3::uuid,$4 FROM prepared p',
 'ON CONFLICT DO NOTHING',
 'RETURNING plan_id',
 ') SELECT p.id::text AS plan_id'
].join(' ');
const ATOMIC_REF_SQL=atomic.claimAndPlan.replace(ANCHOR,MAPPING)
 .replace(END,END+' AND (SELECT count(*) FROM mapped)=1');
if(ATOMIC_REF_SQL===atomic.claimAndPlan||
   !ATOMIC_REF_SQL.includes('FROM prepared p ON CONFLICT DO NOTHING RETURNING plan_id'))
 fail('ATOMIC_REF_STATEMENT_NOT_BOUND');
const SQL=Object.freeze({claimPlanPartsAndRef:ATOMIC_REF_SQL});
const HOLD=Object.freeze({status:'DUPLICATE_OR_REF_CONFLICT_HOLD',
 sendAllowed:false,retryAllowed:false,providerAccepted:false,
 delivered:false,orderWritesEnabled:false});
function referenceFor(secret,identity,id){
 return createHmac('sha256',secret)
  .update('tien404/messenger/reconcile/ref/v1\0'+
   [identity.tenantId,identity.storeId,identity.pageId,id].join('|'))
  .digest('hex').slice(0,32);
}
function createAtomicClaimPlanPrivateRefCandidate({
 mode='BLOCKED',driver,secret,referenceSecret,now=Date.now,
 retentionMs=7*86400000
}={}){
 if(mode!=='SYNTHETIC_SQL_QA_ONLY')fail('ATOMIC_REF_HOSTED_NOT_APPROVED');
 if(!driver||driver.synthetic!==true||driver.externalWrites!==false||
    driver.rollbackOnThrow!==true||
    driver.profile!=='SYNTHETIC_ATOMIC_PLAN_PRIVATE_REF_TX'||
    typeof driver.transaction!=='function')
  fail('ATOMIC_REF_DRIVER_DENIED');
 for(const key of [secret,referenceSecret]){
  if(typeof key!=='string'||Buffer.byteLength(key,'utf8')<32)
   fail('ATOMIC_REF_HMAC_KEY_REQUIRED');
 }
 if(typeof now!=='function'||!Number.isSafeInteger(retentionMs)||
    retentionMs<86400000||retentionMs>30*86400000)
  fail('ATOMIC_REF_CLOCK_OR_TTL_INVALID');
 async function prepare({trusted,replayKey,partDigests}={}){
  if(!Array.isArray(partDigests)||partDigests.length<1||
     partDigests.length>3||
     !partDigests.every(x=>typeof x==='string'&&HASH.test(x)))
   fail('ATOMIC_REF_PART_DIGESTS_INVALID');
  const identity=deriveIdentity({trusted,replayKey,secret});
  const stamp=now();
  if(!Number.isSafeInteger(stamp)||stamp<1||
     !Number.isSafeInteger(stamp+retentionMs))
   fail('ATOMIC_REF_CLOCK_INVALID');
  const planId=randomUUID();
  const lease=randomUUID();
  const ref=referenceFor(referenceSecret,identity,planId);
  const planDigest=createHmac('sha256',secret)
   .update('tien404/messenger/reply-plan/v1\0'+partDigests.join('|'))
   .digest('hex');
  const args=[planId,identity.tenantId,identity.storeId,
   identity.pageId,identity.senderHash,identity.bindingVersion,
   identity.eventHash,planDigest,partDigests.length,partDigests,
   lease,new Date(stamp).toISOString(),
   new Date(stamp+retentionMs).toISOString(),ref];
  try{
   const committed=await driver.transaction(async tx=>{
    if(!tx||typeof tx.query!=='function')
     fail('ATOMIC_REF_TRANSACTION_PORT_REQUIRED');
    const answer=await tx.query(SQL.claimPlanPartsAndRef,args);
    if(!answer||!Array.isArray(answer.rows)||answer.rows.length>1)
     fail('ATOMIC_REF_SQL_RESPONSE_INVALID');
    // MUST throw from within the DB transaction to roll back claim + plan +
    // parts if the private mapping failed, disappeared or had a conflict.
    if(answer.rows.length===0)fail('ATOMIC_REF_ROLLBACK_HOLD');
    const row=answer.rows[0];
    if(row.plan_id!==planId||Number(row.expected_count)!==partDigests.length)
     fail('ATOMIC_REF_ROW_MISMATCH');
    return row;
   });
   if(!committed||committed.plan_id!==planId)
    fail('ATOMIC_REF_COMMIT_UNVERIFIED');
   // Do not return even the HMAC ref here: it is a private operator lookup
   // record, not a customer-facing order link / access credential.
   return Object.freeze({status:'ATOMIC_PRIVATE_REF_PREVIEW_ONLY',
    partCount:partDigests.length,referencePersisted:true,
    sendAllowed:false,retryAllowed:false,providerAccepted:false,
    delivered:false,orderWritesEnabled:false});
  }catch(e){
   if(e?.code==='ATOMIC_REF_ROLLBACK_HOLD')return HOLD;
   throw e; // uncertain driver/transaction error: never authorize retries
  }
 }
 return Object.freeze({prepare,SQL,readiness:Object.freeze({
  mode:'SYNTHETIC_SQL_QA_ONLY',hostedReady:false,
  privateReferenceStorageApproved:false,hostedRlsVerified:false,
  providerSendEnabled:false,automaticRetryEnabled:false,
  orderWritesEnabled:false,realWebhookWired:false
 })});
}
module.exports={SQL,createAtomicClaimPlanPrivateRefCandidate};
