'use strict';
/**
 * TIEN404 V21 — READ-ONLY Messenger message-attempt reconciliation snapshot.
 * SOURCE-ONLY / DISPOSABLE QA, NOT A LIVE PROVIDER RECONCILER.
 *
 * Never claims/reserves a part, changes a status, retries, sends Meta messages,
 * reads an order, or updates a hosted database. This is a per-plan diagnostic
 * projection over an immutable SQL read-only transaction. Input scope comes
 * from the synthetic trusted server test boundary, not user-facing controls.
 *
 * Important: API_ACCEPTED_MOCK means synthetic fixture acceptance ONLY;
 * not Meta accepted, delivered, or read. In-flight is NOT safe to resend.
 */
const {createHmac}=require('node:crypto');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PAGE=/^[0-9]{5,30}$/;
const fail=code=>{const e=new Error(code);e.code=code;throw e;};
const READ_ONLY_SQL='SET TRANSACTION READ ONLY';
const SNAPSHOT_SQL=[
 'SELECT p.id::text AS plan_id,p.status AS plan_status,',
 'p.expected_count::int AS expected_count,',
 'COUNT(sp.part_no)::int AS observed_count,',
 "COUNT(*) FILTER (WHERE sp.status='PLANNED')::int AS planned_count,",
 "COUNT(*) FILTER (WHERE sp.status='MAY_HAVE_SENT_HOLD')::int AS inflight_count,",
 "COUNT(*) FILTER (WHERE sp.status='MAY_HAVE_SENT_HOLD'",
 'AND (sp.attempted_at IS NULL OR sp.attempted_at <= $4::timestamptz))::int AS stale_inflight_count,',
 "COUNT(*) FILTER (WHERE sp.status='UNCERTAIN_HOLD')::int AS uncertain_count,",
 "COUNT(*) FILTER (WHERE sp.status='API_ACCEPTED_MOCK')::int AS mock_ack_count,",
 "COUNT(*) FILTER (WHERE sp.status NOT IN ('PLANNED','MAY_HAVE_SENT_HOLD',",
 "'UNCERTAIN_HOLD','API_ACCEPTED_MOCK'))::int AS unknown_count",
 'FROM app_private.messenger_send_plans p',
 'LEFT JOIN app_private.messenger_send_parts sp',
 'ON sp.plan_id=p.id AND sp.tenant_id=p.tenant_id',
 'AND sp.store_id=p.store_id AND sp.page_id=p.page_id',
 'WHERE p.tenant_id=$1::uuid AND p.store_id=$2::uuid AND p.page_id=$3',
 'GROUP BY p.id,p.status,p.expected_count',
 'ORDER BY p.id LIMIT 51'
].join(' ');
const SQL=Object.freeze({readOnly:READ_ONLY_SQL,snapshot:SNAPSHOT_SQL});
function validCount(n){return Number.isInteger(n)&&n>=0&&n<=3;}
function classify(row){
 const expected=Number(row.expected_count),observed=Number(row.observed_count);
 const planned=Number(row.planned_count),flight=Number(row.inflight_count);
 const stale=Number(row.stale_inflight_count),uncertain=Number(row.uncertain_count);
 const ack=Number(row.mock_ack_count),unknown=Number(row.unknown_count);
 if(!UUID.test(row.plan_id||'') ||
    !Number.isInteger(expected)||expected<1||expected>3 ||
    ![observed,planned,flight,stale,uncertain,ack,unknown].every(validCount)||
    stale>flight || observed>expected ||
    planned+flight+uncertain+ack+unknown!==observed ||
    !['PREPARED','MOCK_PARTS_ACCEPTED'].includes(row.plan_status))
  fail('RECONCILIATION_SNAPSHOT_INCONSISTENT');
 const incomplete=observed!==expected;
 let reason='PLANNED_NOT_ATTEMPTED';
 if(incomplete||unknown>0||
    (row.plan_status==='MOCK_PARTS_ACCEPTED'&&ack!==expected))
  reason='DATA_INTEGRITY_REVIEW';
 else if(uncertain>0) reason='UNCERTAIN_OUTCOME_REVIEW';
 else if(flight>0) reason=stale>0?'STALE_MAY_HAVE_SENT_REVIEW':'MAY_HAVE_SENT_REVIEW';
 else if(ack>0&&ack<expected) reason='PARTIAL_MOCK_ACK_REVIEW';
 else if(ack===expected)reason=row.plan_status==='MOCK_PARTS_ACCEPTED'?
   'MOCK_ALL_PARTS_RECORDED':'MOCK_COMPLETE_PLAN_NOT_CLOSED';
 return Object.freeze({reason,expected,observed,planned,inflight:flight,
  staleInflight:stale,uncertain,mockAcknowledged:ack,
  requiresHumanReview:!['PLANNED_NOT_ATTEMPTED','MOCK_ALL_PARTS_RECORDED'].includes(reason),
  sendAllowed:false,retryAllowed:false,
  realMetaAccepted:false,delivered:false,read:false});
}
function createMessageReconciliationInspectorCandidate({
 mode='BLOCKED',driver,secret,now=Date.now,staleAfterMs=300000
}={}){
 if(mode!=='SYNTHETIC_SQL_QA_ONLY')fail('RECONCILIATION_HOSTED_NOT_APPROVED');
 if(!driver||driver.synthetic!==true||driver.externalWrites!==false||
    driver.readOnly!==true||driver.rollbackOnThrow!==true||
    driver.profile!=='SYNTHETIC_RECONCILIATION_READ_ONLY_PG'||
    typeof driver.transaction!=='function')
  fail('RECONCILIATION_READ_ONLY_DRIVER_REQUIRED');
 if(typeof secret!=='string'||Buffer.byteLength(secret,'utf8')<32)
  fail('RECONCILIATION_HMAC_KEY_REQUIRED');
 if(typeof now!=='function'||!Number.isSafeInteger(staleAfterMs)||
    staleAfterMs<60000||staleAfterMs>86400000)
  fail('RECONCILIATION_CLOCK_CONFIG_INVALID');

 async function inspect({scope}={}){
  if(!scope||scope.source!=='SERVER_VERIFIED_MESSENGER_BINDING'||
     scope.serverDerived!==true||scope.verified!==true||
     !UUID.test(scope.tenantId||'')||!UUID.test(scope.storeId||'')||
     !PAGE.test(scope.pageId||''))
   fail('RECONCILIATION_TRUSTED_SCOPE_REQUIRED');
  const t=now();
  if(!Number.isSafeInteger(t)||t<staleAfterMs)
   fail('RECONCILIATION_CLOCK_INVALID');
  const cutoff=new Date(t-staleAfterMs).toISOString();
  const rows=await driver.transaction(async tx=>{
   if(!tx||typeof tx.query!=='function')
    fail('RECONCILIATION_TRANSACTION_REQUIRED');
   const guard=await tx.query(SQL.readOnly,[]);
   if(!guard||!Array.isArray(guard.rows))
    fail('RECONCILIATION_READ_ONLY_GUARD_REJECTED');
   const result=await tx.query(SQL.snapshot,[
    scope.tenantId,scope.storeId,scope.pageId,cutoff
   ]);
   if(!result||!Array.isArray(result.rows)||
      result.rows.length>51)
    fail('RECONCILIATION_RESPONSE_INVALID');
   return result.rows;
  });
  const reports=rows.slice(0,50).map(row=>{
   const c=classify(row);
   const opaqueRef=createHmac('sha256',secret)
    .update('tien404/messenger/reconcile/ref/v1\0'+
      [scope.tenantId,scope.storeId,scope.pageId,row.plan_id].join('|'))
    .digest('hex').slice(0,32);
   return Object.freeze({reference:opaqueRef,...c});
  });
  if(new Set(reports.map(r=>r.reference)).size!==reports.length)
   fail('RECONCILIATION_DUPLICATE_PLAN_REF');
  return Object.freeze({
   status:'SYNTHETIC_READ_ONLY_SNAPSHOT',
   reports:Object.freeze(reports),truncated:rows.length>50,
   complete:rows.length<=50,
   sendAllowed:false,retryAllowed:false,
   providerSendEnabled:false,orderWritesEnabled:false,
   actualProviderDeliveryVerified:false
  });
 }
 return Object.freeze({inspect,SQL,
  readiness:Object.freeze({mode:'SYNTHETIC_SQL_QA_ONLY',
   connectedToHostedPostgres:false,connectedToMeta:false,
   transportActionsEnabled:false,mutationsEnabled:false,
   automaticRetryEnabled:false,realProviderReceiptVerified:false})});
}
module.exports={SQL,createMessageReconciliationInspectorCandidate};
