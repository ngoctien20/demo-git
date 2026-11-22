'use strict';
/**
 * V21 P1 — proposed per-part Messenger attempt/outbox ledger (SOURCE ONLY).
 *
 * This is a SQL transaction contract + injected SYNTHETIC driver, not a
 * hosted schema, authorized sender, or provider transport. It deliberately
 * has no network/client/credential access and cannot ever send Messenger.
 *
 * A part is reserved BEFORE any hypothetical external side effect:
 * PLANNED -> MAY_HAVE_SENT_HOLD -> API_ACCEPTED_MOCK | UNCERTAIN_HOLD.
 * MAY_HAVE_SENT_HOLD is intentionally NOT reclaimable and never auto-retried.
 * API_ACCEPTED_MOCK is NOT delivery, read, or actual provider confirmation.
 *
 * Child parts duplicate the three authority scope columns and MUST have a
 * composite FK (plan_id,tenant_id,store_id,page_id) to its parent plan.
 * This lets FORCE RLS check a child INSERT in the same data-modifying CTE
 * without depending on visibility of the just-inserted parent row.
 *
 * Do not promote without a real trusted ingress, owner-approved restricted DB
 * roles, hosted schema/RLS, audited per-part reconciliation, and explicit release.
 */
const {randomUUID,createHmac}=require('node:crypto');
const {deriveIdentity}=require('./private-event-store.cjs');
const HASH=/^[a-f0-9]{64}$/;
const MAX_PARTS=3;
const fail=code=>{const e=new Error(code);e.code=code;throw e;};
const SQL=Object.freeze({
 plan:[
  'WITH p AS (INSERT INTO app_private.messenger_send_plans',
  '(id,tenant_id,store_id,page_id,sender_hash,binding_version,event_hash,plan_digest,expected_count,status)',
  "VALUES ($1::uuid,$2::uuid,$3::uuid,$4,$5,$6,$7,$8,$9,'PREPARED')",
  'ON CONFLICT (tenant_id,store_id,page_id,sender_hash,binding_version,event_hash) DO NOTHING',
  'RETURNING id,expected_count),',
  'parts AS (INSERT INTO app_private.messenger_send_parts',
  '(plan_id,tenant_id,store_id,page_id,part_no,body_digest,status)',
  "SELECT p.id,$2::uuid,$3::uuid,$4,g.n,($10::text[])[g.n],'PLANNED'",
  'FROM p CROSS JOIN generate_series(1,$9::int) AS g(n) RETURNING plan_id)',
  'SELECT p.id::text AS plan_id,p.expected_count::int AS expected_count FROM p',
  'WHERE (SELECT count(*) FROM parts)=p.expected_count'
 ].join(' '),
 reserve:[
  'UPDATE app_private.messenger_send_parts',
  "SET status='MAY_HAVE_SENT_HOLD',attempt_id=$3::uuid,attempted_at=$4::timestamptz",
  "WHERE plan_id=$1::uuid AND part_no=$2::int AND status='PLANNED'",
  'AND EXISTS (SELECT 1 FROM app_private.messenger_send_plans p',
  "WHERE p.id=$1::uuid AND p.status='PREPARED')",
  'RETURNING attempt_id::text AS attempt_id,status'
 ].join(' '),
 accept:[
  'UPDATE app_private.messenger_send_parts',
  "SET status='API_ACCEPTED_MOCK',provider_mid_digest=$4,confirmed_at=$5::timestamptz",
  "WHERE plan_id=$1::uuid AND part_no=$2::int AND attempt_id=$3::uuid",
  "AND status='MAY_HAVE_SENT_HOLD'",
  'RETURNING attempt_id::text AS attempt_id,status'
 ].join(' '),
 uncertain:[
  'UPDATE app_private.messenger_send_parts',
  "SET status='UNCERTAIN_HOLD',held_at=$4::timestamptz",
  'WHERE plan_id=$1::uuid AND part_no=$2::int AND attempt_id=$3::uuid',
  "AND status='MAY_HAVE_SENT_HOLD'",
  'RETURNING attempt_id::text AS attempt_id,status'
 ].join(' '),
 close:[
  'UPDATE app_private.messenger_send_plans p',
  "SET status='MOCK_PARTS_ACCEPTED',completed_at=$2::timestamptz",
  "WHERE p.id=$1::uuid AND p.status='PREPARED'",
  'AND (SELECT count(*) FROM app_private.messenger_send_parts sp',
  "WHERE sp.plan_id=p.id AND sp.status='API_ACCEPTED_MOCK')=p.expected_count",
  'AND (SELECT count(*) FROM app_private.messenger_send_parts sp',
  'WHERE sp.plan_id=p.id)=p.expected_count',
  'RETURNING p.id::text AS plan_id,p.status'
 ].join(' ')
});
function driverOk(d){
 if(!d || d.synthetic!==true || d.externalWrites!==false ||
    d.profile!=='SYNTHETIC_MESSENGER_OUTBOX_TRANSACTION_MODEL'||
    typeof d.transaction!=='function')fail('LEDGER_DRIVER_NOT_APPROVED');
}
function rows(result){
 if(!result||!Array.isArray(result.rows)||result.rows.length>1)
  fail('LEDGER_SQL_RESPONSE_INVALID');
 return result.rows;
}
function plannedBodies(input){
 if(!Array.isArray(input)||input.length<1||input.length>MAX_PARTS||
    !input.every(x=>typeof x==='string'&&HASH.test(x)))
    fail('LEDGER_BODY_DIGESTS_INVALID');
 return input;
}
function proofOfClaim(ticket){
 if(!ticket || ticket.mode!=='CLAIM_RESERVED_DRY_RUN'||
    ticket.sendAllowed!==false||ticket.retryAllowed!==false||
    ticket.orderWriteAllowed!==false)
  fail('LEDGER_CLAIM_QA_TICKET_REQUIRED');
 // This is a QA compatibility check, not authenticatable production authority.
}
function createMessageAttemptLedgerCandidate({
 mode='BLOCKED',driver,secret,now=Date.now
}={}){
 if(mode!=='SYNTHETIC_SQL_QA_ONLY')fail('LEDGER_HOSTED_NOT_APPROVED');
 driverOk(driver);
 if(typeof secret!=='string'||Buffer.byteLength(secret)<32)
  fail('LEDGER_HMAC_SECRET_REQUIRED');
 if(typeof now!=='function')fail('LEDGER_CLOCK_REQUIRED');
 const plans=new WeakMap(), attempts=new WeakMap();
 async function query(sql,params){
  return rows(await driver.transaction(async tx=>{
   if(!tx||typeof tx.query!=='function')fail('LEDGER_TRANSACTION_REQUIRED');
   return tx.query(sql,params);
  }));
 }
 function clock(){
  const n=now();if(!Number.isSafeInteger(n)||n<1)fail('LEDGER_CLOCK_INVALID');
  return new Date(n).toISOString();
 }
 async function prepare({claimTicket,trusted,replayKey,partDigests}={}){
  proofOfClaim(claimTicket);
  const i=deriveIdentity({trusted,replayKey,secret});
  const bodies=plannedBodies(partDigests);
  const digest=createHmac('sha256',secret)
   .update('tien404/messenger/reply-plan/v1\0'+bodies.join('|')).digest('hex');
  const uuid=randomUUID();
  const result=await query(SQL.plan,[uuid,i.tenantId,i.storeId,i.pageId,
    i.senderHash,i.bindingVersion,i.eventHash,digest,bodies.length,bodies]);
  if(!result.length)return Object.freeze({status:'DUPLICATE_PLAN_HOLD',
   sendAllowed:false,retryAllowed:false,orderWriteAllowed:false});
  if(result[0].plan_id!==uuid||Number(result[0].expected_count)!==bodies.length)
   fail('LEDGER_PLAN_RESPONSE_INVALID');
  const ticket=Object.freeze({status:'PLAN_PREPARED_DRY_RUN',partCount:bodies.length,
   sendAllowed:false,retryAllowed:false,orderWriteAllowed:false});
  plans.set(ticket,{id:uuid,count:bodies.length,psid:trusted.recipientPsid,phase:'PREPARED'});
  return ticket;
 }
 async function reserveMockPart(planTicket,partNo){
  const plan=planTicket&&plans.get(planTicket);
  if(!plan||plan.phase!=='PREPARED')fail('LEDGER_PLAN_TICKET_INVALID');
  if(!Number.isSafeInteger(partNo)||partNo<1||partNo>plan.count)
   fail('LEDGER_PART_INDEX_INVALID');
  const attemptId=randomUUID();
  const result=await query(SQL.reserve,[plan.id,partNo,attemptId,clock()]);
  if(result.length===0)return Object.freeze({status:'ALREADY_RESERVED_HOLD',
    sendAllowed:false,retryAllowed:false,orderWriteAllowed:false});
  if(result[0].attempt_id!==attemptId||
     result[0].status!=='MAY_HAVE_SENT_HOLD')
   fail('LEDGER_RESERVE_RESPONSE_INVALID');
  const attempt=Object.freeze({status:'MAY_HAVE_SENT_HOLD',partNo,
    sendAllowed:false,retryAllowed:false,orderWriteAllowed:false});
  attempts.set(attempt,{planId:plan.id,partNo,attemptId,
    recipient:plan.psid,state:'RESERVED'});
  return attempt;
 }
 async function inspectSyntheticReceipt(attemptTicket,{outcome,receipt}={}){
  const a=attemptTicket&&attempts.get(attemptTicket);
  if(!a||a.state!=='RESERVED')fail('LEDGER_ATTEMPT_NOT_RESERVED');
  // Seal BEFORE awaiting I/O. On crash, MAY_HAVE_SENT_HOLD remains in DB.
  a.state='REVIEWING';
  let status='UNCERTAIN_HOLD';
  let midDigest;
  if(outcome==='SYNTHETIC_API_ACCEPTED' &&
     receipt && typeof receipt.message_id==='string' &&
     receipt.message_id.trim().length>0 &&
     receipt.message_id.length<=250 &&
     typeof receipt.recipient_id==='string' &&
     receipt.recipient_id===a.recipient){
    midDigest=createHmac('sha256',secret)
     .update('tien404/messenger/provider-mid/v1\0'+receipt.message_id).digest('hex');
    status='API_ACCEPTED_MOCK';
  }
  const sql=status==='API_ACCEPTED_MOCK'?SQL.accept:SQL.uncertain;
  const args=status==='API_ACCEPTED_MOCK'?
   [a.planId,a.partNo,a.attemptId,midDigest,clock()]:
   [a.planId,a.partNo,a.attemptId,clock()];
  try{
   const result=await query(sql,args);
   if(result.length!==1||result[0].attempt_id!==a.attemptId||
      result[0].status!==status)
     fail('LEDGER_RECONCILIATION_REQUIRED');
   a.state=status;
   return Object.freeze({status,sendAllowed:false,retryAllowed:false,
    needsReconciliation:status==='UNCERTAIN_HOLD',
    providerAccepted:false,delivered:false,read:false});
  }catch(error){
   a.state='UNCERTAIN_HOLD';
   // External effects are potentially unknown. Never silently reissue.
   throw error;
  }
 }
 async function closeMockPlan(planTicket){
  const p=planTicket&&plans.get(planTicket);
  if(!p||p.phase!=='PREPARED')fail('LEDGER_PLAN_CLOSURE_NOT_ALLOWED');
  p.phase='CLOSING';
  try{
   const result=await query(SQL.close,[p.id,clock()]);
   if(result.length!==1||result[0].plan_id!==p.id||
      result[0].status!=='MOCK_PARTS_ACCEPTED')
    fail('LEDGER_PARTIAL_OR_UNCERTAIN_HOLD');
   p.phase='MOCK_PARTS_ACCEPTED';
   return Object.freeze({status:'MOCK_PARTS_ACCEPTED',partCount:p.count,
    sendAllowed:false,retryAllowed:false,providerAccepted:false,delivered:false});
  }catch(e){
   p.phase='UNCERTAIN_HOLD';
   throw e;
  }
 }
 return Object.freeze({prepare,reserveMockPart,inspectSyntheticReceipt,closeMockPlan,
  readiness:Object.freeze({mode:'SYNTHETIC_SQL_QA_ONLY',hostedReady:false,
   outboxDeployed:false,providerSendEnabled:false,autoRetryEnabled:false,
   orderWritesEnabled:false,notProviderDeliveryProof:true})});
}
module.exports={SQL,createMessageAttemptLedgerCandidate};
