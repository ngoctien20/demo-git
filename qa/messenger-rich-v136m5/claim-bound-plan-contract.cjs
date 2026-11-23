'use strict';
/**
 * V21 P1 — source-only SQL admission gate: existing atomic event claim
 * MUST pre-exist, match EVERY scoped identity column, hold the exact random
 * server-side lease, remain CLAIMED and not have expired before a reply plan
 * and child parts may be inserted.
 *
 * This is a no-send synthetic SQL contract. Not a hosted migration, not an
 * authenticated public endpoint, not a durable recovery service. Its trusted
 * claimLease input must be supplied only from a private server, NEVER a client.
 *
 * Critical difference from old shape-only claimTicket: the real PostgreSQL
 * statement checks app_private.messenger_event_claims, in the SAME statement
 * that creates 1-3 reply parts. A forged JS object alone cannot satisfy it.
 */
const {createHmac,randomUUID}=require('node:crypto');
const {deriveIdentity}=require('./private-event-store.cjs');
const {SQL:ledgerSql}=require('./message-attempt-ledger.cjs');
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const DIGEST=/^[a-f0-9]{64}$/;
const fail=code=>{const e=new Error(code);e.code=code;throw e;};
const VALUES="VALUES ($1::uuid,$2::uuid,$3::uuid,$4,$5,$6,$7,$8,$9,'PREPARED')";
if(!ledgerSql.plan.includes(VALUES))
 fail('CLAIM_BOUND_LEDGER_SQL_VERSION_DRIFT');
const GUARDED_VALUES=[
 "SELECT $1::uuid,$2::uuid,$3::uuid,$4,$5,$6,$7,$8,$9,'PREPARED'",
 'WHERE EXISTS (SELECT 1 FROM app_private.messenger_event_claims ec',
 'WHERE ec.tenant_id=$2::uuid AND ec.store_id=$3::uuid AND ec.page_id=$4',
 'AND ec.sender_hash=$5 AND ec.binding_version=$6 AND ec.event_hash=$7',
 "AND ec.lease_id=$11::uuid AND ec.status='CLAIMED'",
 'AND ec.claimed_at <= $12::timestamptz',
 'AND ec.expires_at > $12::timestamptz)'
].join(' ');
const CLAIM_BOUND_PLAN_SQL=ledgerSql.plan.replace(VALUES,GUARDED_VALUES);
if(CLAIM_BOUND_PLAN_SQL===ledgerSql.plan)
 fail('CLAIM_BOUND_PLAN_NOT_GUARDED');
const SQL=Object.freeze({claimBoundPlan:CLAIM_BOUND_PLAN_SQL});
function createClaimBoundPlanCandidate({mode='BLOCKED',driver,secret,now=Date.now}={}){
 if(mode!=='SYNTHETIC_SQL_QA_ONLY')fail('CLAIM_BOUND_HOSTED_NOT_APPROVED');
 if(!driver||driver.synthetic!==true||driver.externalWrites!==false||
    driver.profile!=='SYNTHETIC_CLAIM_BOUND_TRANSACTION_MODEL'||
    typeof driver.transaction!=='function')
  fail('CLAIM_BOUND_DRIVER_NOT_APPROVED');
 if(typeof secret!=='string'||Buffer.byteLength(secret,'utf8')<32)
  fail('CLAIM_BOUND_SECRET_REQUIRED');
 if(typeof now!=='function')fail('CLAIM_BOUND_CLOCK_REQUIRED');
 async function planFromServerLease({trusted,replayKey,serverClaimLease,partDigests}={}){
  // The lease is an opaque random UUID from the trusted atomic claim writer.
  // An untrusted caller can fabricate a UUID, but the DB EXISTS prevents a
  // plan unless it matches the truly issued and currently active claim.
  if(!UUID.test(serverClaimLease||''))
   fail('CLAIM_BOUND_SERVER_LEASE_REQUIRED');
  if(!Array.isArray(partDigests)||partDigests.length<1||partDigests.length>3||
    !partDigests.every(d=>typeof d==='string'&&DIGEST.test(d)))
   fail('CLAIM_BOUND_PART_DIGESTS_INVALID');
  const i=deriveIdentity({trusted,replayKey,secret});
  const n=now();
  if(!Number.isSafeInteger(n)||n<1)fail('CLAIM_BOUND_CLOCK_INVALID');
  const digest=createHmac('sha256',secret)
   .update('tien404/messenger/reply-plan/v1\0'+partDigests.join('|'))
   .digest('hex');
  const id=randomUUID();
  const inputs=[id,i.tenantId,i.storeId,i.pageId,i.senderHash,
   i.bindingVersion,i.eventHash,digest,partDigests.length,
   partDigests,serverClaimLease,new Date(n).toISOString()];
  const result=await driver.transaction(async tx=>{
   if(!tx||typeof tx.query!=='function')
    fail('CLAIM_BOUND_TRANSACTION_REQUIRED');
   return tx.query(SQL.claimBoundPlan,inputs);
  });
  if(!result||!Array.isArray(result.rows)||result.rows.length>1)
   fail('CLAIM_BOUND_QUERY_RESULT_INVALID');
  if(result.rows.length===0)return Object.freeze({status:'CLAIM_NOT_ADMITTED_OR_DUPLICATE_HOLD',
   sendAllowed:false,retryAllowed:false,orderWritesEnabled:false});
  const row=result.rows[0];
  if(row.plan_id!==id||Number(row.expected_count)!==partDigests.length)
   fail('CLAIM_BOUND_PLAN_RESULT_INVALID');
  return Object.freeze({status:'BOUND_PLAN_PREVIEW_ONLY',
   partCount:partDigests.length,sendAllowed:false,retryAllowed:false,
   providerAccepted:false,delivered:false,orderWritesEnabled:false});
 }
 return Object.freeze({planFromServerLease,SQL,
  readiness:Object.freeze({mode:'SYNTHETIC_SQL_QA_ONLY',hostedReady:false,
   claimStoreWired:false,canIssueServerLease:false,
   providerSendEnabled:false,automaticRetryEnabled:false,
   orderWritesEnabled:false})});
}
module.exports={SQL,createClaimBoundPlanCandidate};
