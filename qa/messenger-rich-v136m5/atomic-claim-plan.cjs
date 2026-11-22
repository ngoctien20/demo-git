'use strict';
/**
 * V21 P1 candidate — atomic inbound claim + reply plan + 1-3 child parts.
 * A SINGLE LOCAL SQL transaction, no lease/capability transfer between modules.
 * OFFLINE SYNTHETIC ONLY. No Meta transport or hosted DB/Orders access.
 *
 * SQL design:
 *  1. INSERT a scoped inbound claim with private random lease, ON CONFLICT DO NOTHING
 *  2. INSERT plan SELECT FROM inserted claim, ON CONFLICT DO NOTHING
 *  3. INSERT parts SELECT FROM inserted plan; child RLS is direct tenant/store/Page
 *  4. return a minimal plan result, NEVER claim lease, raw PSID or plan UUID
 *
 * On zero plan rows the client callback THROWS to require transaction ROLLBACK.
 * Thus a stale plan cannot leave behind a newly inserted orphan claim.
 * A duplicate webhook is a HOLD, not a new send or retry capability.
 *
 * The mock "trusted" binding must originate from real HMAC + private server
 * resolver in a future approved service. This is NOT a production gateway.
 */
const {createHmac,randomUUID}=require('node:crypto');
const {deriveIdentity,SQL:inboundSql}=require('./private-event-store.cjs');
const {SQL:ledgerSql}=require('./message-attempt-ledger.cjs');
const HASH=/^[a-f0-9]{64}$/;
const fail=code=>{const e=new Error(code);e.code=code;throw e;};
if(!inboundSql.claim.includes('ON CONFLICT') ||
   !ledgerSql.plan.includes('messenger_send_parts'))
 fail('ATOMIC_CLAIM_PLAN_SOURCE_DRIFT');
const CLAIM_PLAN_SQL=[
 'WITH claimed AS (',
 'INSERT INTO app_private.messenger_event_claims',
 '(tenant_id,store_id,page_id,sender_hash,binding_version,event_hash,',
 'status,lease_id,claimed_at,expires_at)',
 "SELECT $2::uuid,$3::uuid,$4,$5,$6,$7,'CLAIMED',$11::uuid,$12::timestamptz,$13::timestamptz",
 // Avoid orphan claim if a plan already exists but the historical claim was
 // purged. Uniqueness still protects concurrent first-seen acquisitions.
 'WHERE NOT EXISTS (SELECT 1 FROM app_private.messenger_send_plans older',
 'WHERE older.tenant_id=$2::uuid AND older.store_id=$3::uuid',
 'AND older.page_id=$4 AND older.sender_hash=$5',
 'AND older.binding_version=$6 AND older.event_hash=$7)',
 'ON CONFLICT (tenant_id,store_id,page_id,sender_hash,binding_version,event_hash)',
 'DO NOTHING',
 'RETURNING tenant_id,store_id,page_id,sender_hash,binding_version,event_hash',
 '), prepared AS (',
 'INSERT INTO app_private.messenger_send_plans',
 '(id,tenant_id,store_id,page_id,sender_hash,binding_version,event_hash,plan_digest,expected_count,status)',
 "SELECT $1::uuid,c.tenant_id,c.store_id,c.page_id,c.sender_hash,c.binding_version,c.event_hash,$8,$9,'PREPARED'",
 'FROM claimed c',
 'ON CONFLICT (tenant_id,store_id,page_id,sender_hash,binding_version,event_hash) DO NOTHING',
 'RETURNING id,expected_count',
 '), parts AS (',
 'INSERT INTO app_private.messenger_send_parts',
 '(plan_id,tenant_id,store_id,page_id,part_no,body_digest,status)',
 "SELECT p.id,$2::uuid,$3::uuid,$4,g.n,($10::text[])[g.n],'PLANNED'",
 'FROM prepared p CROSS JOIN generate_series(1,$9::int) AS g(n)',
 'RETURNING plan_id',
 ')',
 'SELECT p.id::text AS plan_id,p.expected_count::int AS expected_count',
 'FROM prepared p',
 'WHERE (SELECT count(*) FROM parts)=p.expected_count'
].join(' ');
const SQL=Object.freeze({claimAndPlan:CLAIM_PLAN_SQL});
const DUPLICATE=Object.freeze({status:'DUPLICATE_OR_NOT_ADMITTED_HOLD',
 sendAllowed:false,retryAllowed:false,orderWritesEnabled:false,
 providerAccepted:false,delivered:false});
function createAtomicClaimPlanCandidate({
 mode='BLOCKED',driver,secret,now=Date.now,retentionMs=7*86400000
}={}){
 if(mode!=='SYNTHETIC_SQL_QA_ONLY')fail('ATOMIC_CLAIM_PLAN_HOSTED_NOT_APPROVED');
 if(!driver||driver.synthetic!==true||driver.externalWrites!==false||
    driver.profile!=='SYNTHETIC_ATOMIC_CLAIM_PLAN_TX'||
    driver.rollbackOnThrow!==true||typeof driver.transaction!=='function')
   fail('ATOMIC_CLAIM_PLAN_TRANSACTION_DRIVER_DENIED');
 if(typeof secret!=='string'||Buffer.byteLength(secret,'utf8')<32)
   fail('ATOMIC_CLAIM_PLAN_SECRET_REQUIRED');
 if(typeof now!=='function'||!Number.isSafeInteger(retentionMs)||
    retentionMs<86400000||retentionMs>30*86400000)
   fail('ATOMIC_CLAIM_PLAN_CLOCK_OR_TTL_INVALID');

 async function prepare({trusted,replayKey,partDigests}={}){
  if(!Array.isArray(partDigests)||partDigests.length<1||partDigests.length>3||
    !partDigests.every(v=>typeof v==='string'&&HASH.test(v)))
   fail('ATOMIC_CLAIM_PLAN_PART_DIGESTS_INVALID');
  const identity=deriveIdentity({trusted,replayKey,secret});
  const stamp=now();
  if(!Number.isSafeInteger(stamp)||stamp<1||
     !Number.isSafeInteger(stamp+retentionMs))
   fail('ATOMIC_CLAIM_PLAN_CLOCK_INVALID');
  const planId=randomUUID(),privateLease=randomUUID();
  const digest=createHmac('sha256',secret)
   .update('tien404/messenger/reply-plan/v1\0'+partDigests.join('|')).digest('hex');
  const values=[
   planId,identity.tenantId,identity.storeId,identity.pageId,
   identity.senderHash,identity.bindingVersion,identity.eventHash,digest,
   partDigests.length,partDigests,privateLease,
   new Date(stamp).toISOString(),new Date(stamp+retentionMs).toISOString()
  ];
  try{
   const result=await driver.transaction(async tx=>{
    if(!tx||typeof tx.query!=='function')
     fail('ATOMIC_CLAIM_PLAN_QUERY_PORT_REQUIRED');
    const reply=await tx.query(SQL.claimAndPlan,values);
    if(!reply||!Array.isArray(reply.rows)||reply.rows.length>1)
     fail('ATOMIC_CLAIM_PLAN_QUERY_RESULT_UNVERIFIED');
    // Throw INSIDE transaction, never after a possible COMMIT.
    if(reply.rows.length===0)fail('ATOMIC_CLAIM_PLAN_ROLLBACK_DUPLICATE');
    const row=reply.rows[0];
    if(row.plan_id!==planId||Number(row.expected_count)!==partDigests.length)
     fail('ATOMIC_CLAIM_PLAN_RESULT_INVALID');
    return row;
   });
   if(!result||result.plan_id!==planId)fail('ATOMIC_CLAIM_PLAN_COMMIT_UNVERIFIED');
   return Object.freeze({status:'ATOMIC_PLAN_PREVIEW_ONLY',
    partCount:partDigests.length,sendAllowed:false,retryAllowed:false,
    providerAccepted:false,delivered:false,orderWritesEnabled:false});
  }catch(e){
   if(e?.code==='ATOMIC_CLAIM_PLAN_ROLLBACK_DUPLICATE')return DUPLICATE;
   throw e; // failure is never interpreted as safe retry
  }
 }
 return Object.freeze({prepare,SQL,
  readiness:Object.freeze({mode:'SYNTHETIC_SQL_QA_ONLY',
   externalWrites:false,hostedReady:false,realMetaSendEnabled:false,
   automaticRetryEnabled:false,orderWritesEnabled:false,
   verifiedWebhookWired:false,backedByHostedPostgres:false})});
}
module.exports={SQL,createAtomicClaimPlanCandidate};
