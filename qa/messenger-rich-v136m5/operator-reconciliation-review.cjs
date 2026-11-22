'use strict';
/**
 * TIEN404 V21 P1 — scoped OPERATOR READ + APPEND-ONLY REVIEW JOURNAL.
 *
 * SOURCE-ONLY SYNTHETIC SQL / DISPOSABLE PG17 acceptance.
 * This is NOT a hosted migration, authenticated viewer gateway, or sender.
 * PostgreSQL CURRENT_USER + private current Page/store grants decide access;
 * never trust a browser-supplied user role, shop selector, or JWT claim.
 * Staff can view; Manager can escalate/request provider verification;
 * Owner can additionally acknowledge risk. NONE may send/retry/modify parts.
 * Journal writes append to ONE separate audit table, NOT ledger state.
 */
const {createHmac,randomUUID}=require('node:crypto');
const {SQL:baseSQL,classify:classifySnapshot}=require('./message-reconciliation-inspector.cjs');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PAGE=/^[0-9]{5,30}$/;
const DECISIONS=Object.freeze([
 'REQUEST_PROVIDER_REVIEW','ESCALATE_TO_OWNER','ACKNOWLEDGE_NO_SEND'
]);
const fail=code=>{const e=new Error(code);e.code=code;throw e;};
const where='WHERE p.tenant_id=$1::uuid AND p.store_id=$2::uuid AND p.page_id=$3';
if(!baseSQL.snapshot.includes(where)||typeof classifySnapshot!=='function')
 fail('OPERATOR_INSPECTOR_CONTRACT_DRIFT');
const roleCheck=[
 'AND EXISTS (SELECT 1 FROM app_private.messenger_operator_grants g',
 'WHERE g.db_role=CURRENT_USER::name AND g.tenant_id=p.tenant_id',
 'AND g.store_id=p.store_id AND g.page_id=p.page_id',
 "AND g.access_role IN ('OWNER','MANAGER','STAFF')",
 'AND g.active AND g.valid_until > transaction_timestamp())'
].join(' ');
const VIEW_SQL=baseSQL.snapshot.replace(where,where+' '+roleCheck);
const APPEND_SQL=[
 'INSERT INTO app_private.messenger_review_events',
 '(id,plan_id,tenant_id,store_id,page_id,actor_db_role,access_role,decision_code,request_digest,created_at)',
 'SELECT $5::uuid,p.id,p.tenant_id,p.store_id,p.page_id,CURRENT_USER::name,g.access_role,$6,$7,transaction_timestamp()',
 'FROM app_private.messenger_send_plans p',
 'JOIN app_private.messenger_operator_grants g',
 'ON g.tenant_id=p.tenant_id AND g.store_id=p.store_id AND g.page_id=p.page_id',
 'WHERE p.id=$1::uuid AND p.tenant_id=$2::uuid AND p.store_id=$3::uuid AND p.page_id=$4',
 'AND g.db_role=CURRENT_USER::name AND g.active',
 'AND g.valid_until > transaction_timestamp()',
 "AND ((g.access_role='OWNER' AND $6 IN ('REQUEST_PROVIDER_REVIEW',",
 "'ESCALATE_TO_OWNER','ACKNOWLEDGE_NO_SEND'))",
 "OR (g.access_role='MANAGER' AND $6 IN ('REQUEST_PROVIDER_REVIEW','ESCALATE_TO_OWNER')))",
 'ON CONFLICT (plan_id,request_digest) DO NOTHING',
 'RETURNING id::text AS review_id,decision_code'
].join(' ');
const SQL=Object.freeze({readOnly:baseSQL.readOnly,view:VIEW_SQL,append:APPEND_SQL});
function checkScope(scope){
 if(!scope||scope.source!=='SERVER_VERIFIED_MESSENGER_BINDING'||
    scope.verified!==true||scope.serverDerived!==true||
    !UUID.test(scope.tenantId||'')||!UUID.test(scope.storeId||'')||
    !PAGE.test(scope.pageId||''))
  fail('OPERATOR_TRUSTED_STORE_SCOPE_REQUIRED');
 return scope;
}
function verifyDriver(d){
 if(!d||d.synthetic!==true||d.externalWrites!==false||
    d.rollbackOnThrow!==true||d.journalOnly!==true||
    d.profile!=='SYNTHETIC_OPERATOR_REVIEW_PG_TX'||
    typeof d.transaction!=='function')
  fail('OPERATOR_REVIEW_TEST_DRIVER_REQUIRED');
}
function opaqueReference(secret,scope,planId){
 return createHmac('sha256',secret)
  .update('tien404/messenger/reconcile/ref/v1\0'+
   [scope.tenantId,scope.storeId,scope.pageId,planId].join('|'))
  .digest('hex').slice(0,32);
}
function requestHash(secret,scope,id){
 return createHmac('sha256',secret)
  .update('tien404/messenger/operator-review/request/v1\0'+
   [scope.tenantId,scope.storeId,scope.pageId,id].join('|'))
  .digest('hex');
}
function createOperatorReconciliationReviewCandidate({
 mode='BLOCKED',driver,secret,now=Date.now,staleAfterMs=300000
}={}){
 if(mode!=='SYNTHETIC_SQL_QA_ONLY')fail('OPERATOR_REVIEW_HOSTED_NOT_APPROVED');
 verifyDriver(driver);
 if(typeof secret!=='string'||Buffer.byteLength(secret,'utf8')<32)
  fail('OPERATOR_REVIEW_HMAC_KEY_REQUIRED');
 if(typeof now!=='function'||!Number.isSafeInteger(staleAfterMs)||
    staleAfterMs<60000||staleAfterMs>86400000)
  fail('OPERATOR_REVIEW_CLOCK_INVALID');
 const nowIso=()=>{
  const t=now();
  if(!Number.isSafeInteger(t)||t<staleAfterMs)
   fail('OPERATOR_REVIEW_INVALID_TIME');
  return new Date(t-staleAfterMs).toISOString();
 };
 async function view({scope}={}){
  const s=checkScope(scope),cutoff=nowIso();
  const rows=await driver.transaction(async tx=>{
   if(!tx||typeof tx.query!=='function')fail('OPERATOR_REVIEW_SQL_PORT_REQUIRED');
   const guard=await tx.query(SQL.readOnly,[]);
   if(!guard||!Array.isArray(guard.rows))
    fail('OPERATOR_REVIEW_READ_ONLY_ENFORCEMENT_REQUIRED');
   const result=await tx.query(SQL.view,[s.tenantId,s.storeId,s.pageId,cutoff]);
   if(!result||!Array.isArray(result.rows)||result.rows.length>51)
    fail('OPERATOR_REVIEW_VIEW_RESULT_INVALID');
   return result.rows;
  });
  const reports=rows.slice(0,50).map(row=>Object.freeze({
   reference:opaqueReference(secret,s,row.plan_id),
   ...classifySnapshot(row)
  }));
  if(new Set(reports.map(r=>r.reference)).size!==reports.length)
   fail('OPERATOR_REVIEW_DUPLICATE_REFERENCE');
  return Object.freeze({status:'OPERATOR_VIEW_PREVIEW_ONLY',
   reports:Object.freeze(reports),truncated:rows.length>50,
   complete:rows.length<=50,sendAllowed:false,retryAllowed:false,
   actorAuthorizedInHosted:false,providerDelivered:false});
 }
 async function record({scope,serverPrivatePlanId,decision,requestId}={}){
  const s=checkScope(scope);
  if(!UUID.test(serverPrivatePlanId||''))
   fail('OPERATOR_PRIVATE_PLAN_REFERENCE_REQUIRED');
  if(!DECISIONS.includes(decision))
   fail('OPERATOR_REVIEW_DECISION_NOT_ALLOWLISTED');
  if(!UUID.test(requestId||''))
   fail('OPERATOR_REVIEW_IDEMPOTENCY_UUID_REQUIRED');
  // The caller's role is deliberately absent from the API: DB decides.
  // serverPrivatePlanId and requestId are restricted backend inputs ONLY.
  // An external UI must never send a raw plan UUID or see requestHash.
  const recordId=randomUUID();
  const digest=requestHash(secret,s,requestId);
  const result=await driver.transaction(async tx=>{
   if(!tx||typeof tx.query!=='function')fail('OPERATOR_REVIEW_SQL_PORT_REQUIRED');
   return tx.query(SQL.append,[serverPrivatePlanId,s.tenantId,s.storeId,
    s.pageId,recordId,decision,digest]);
  });
  if(!result||!Array.isArray(result.rows)||result.rows.length>1)
   fail('OPERATOR_REVIEW_WRITE_RESULT_INVALID');
  if(result.rows.length===0)return Object.freeze({
   status:'NOT_AUTHORIZED_NOT_FOUND_OR_DUPLICATE_HOLD',
   sendAllowed:false,retryAllowed:false,ledgerMutated:false,
   providerAccepted:false
  });
  if(result.rows[0].review_id!==recordId||
     result.rows[0].decision_code!==decision)
   fail('OPERATOR_REVIEW_COMMIT_RESPONSE_INVALID');
  return Object.freeze({status:'SYNTHETIC_REVIEW_JOURNALED',
   reference:opaqueReference(secret,s,serverPrivatePlanId),
   sendAllowed:false,retryAllowed:false,ledgerMutated:false,
   providerAccepted:false});
 }
 return Object.freeze({view,record,SQL,
  readiness:Object.freeze({mode:'SYNTHETIC_SQL_QA_ONLY',
   hostedIdentityVerified:false,hostedRlsVerified:false,
   integrationWithRealOwnerApp:false,metaSendEnabled:false,
   providerReconciliationEnabled:false,autoRetryEnabled:false,
   journalWritesOnlyInDisposableTests:true})});
}
module.exports={SQL,DECISIONS,createOperatorReconciliationReviewCandidate};
