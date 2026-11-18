// TIEN404 V19.0-B5 — D1 binding contract, SYNTHETIC LOCAL QA ONLY.
// No network, no real event bodies, no customer identities, no Store grants,
// no provider send, no n8n connector, no order writer, no webhook registration.
// This is an inbox receipt/lease state machine, NOT a production processor.

const KEY=/^[a-f0-9]{64}$/;
const FIXTURE=/^QA_FIXTURE_[A-Z0-9_]{1,40}$/;
const CODE=/^QA_[A-Z0-9_]{1,32}$/;
const VALID_STATES=new Set([
  "QA_READY_NO_SEND","QA_LEASED_NO_SEND","QA_RETRY_NO_SEND",
  "QA_DONE_NO_SEND","QA_DLQ_NO_SEND"
]);
const deny=(reason)=>Object.freeze({
  decision:"DENY",reason,providerVerified:false,storeAuthorized:false,
  customerAuthorized:false,commerceRead:false,commerceWrite:false,
  providerSend:false,webhookEnabled:false
});
const result=(decision,extra={})=>Object.freeze({
  decision,...extra,providerVerified:false,storeAuthorized:false,
  customerAuthorized:false,commerceRead:false,commerceWrite:false,
  providerSend:false,webhookEnabled:false
});
const isDb=db=>typeof db?.prepare==="function";
const okay=(db,scopeKey,eventKey,nowMs)=>
  isDb(db)&&KEY.test(scopeKey||"")&&KEY.test(eventKey||"")&&
  Number.isSafeInteger(nowMs)&&nowMs>0;

export const SQL=Object.freeze({
  admit:[
    "INSERT INTO v19_b5_qa_inbox",
    "(scope_key,event_key,payload_hash,fixture_ref,status,created_ms,updated_ms)",
    "VALUES (?1,?2,?3,?4,'QA_READY_NO_SEND',?5,?5)",
    "ON CONFLICT(scope_key,event_key) DO UPDATE SET",
    "delivery_observations=v19_b5_qa_inbox.delivery_observations+1,",
    "updated_ms=excluded.updated_ms",
    "WHERE v19_b5_qa_inbox.payload_hash=excluded.payload_hash",
    "AND v19_b5_qa_inbox.fixture_ref=excluded.fixture_ref",
    "RETURNING status,delivery_observations"
  ].join(" "),
  claim:[
    "UPDATE v19_b5_qa_inbox SET",
    "status='QA_LEASED_NO_SEND',attempts=attempts+1,",
    "lease_token=?4,lease_until_ms=?5,updated_ms=?3",
    "WHERE scope_key=?1 AND event_key=?2",
    "AND attempts<max_attempts",
    "AND ((status IN ('QA_READY_NO_SEND','QA_RETRY_NO_SEND') AND next_attempt_ms<=?3)",
    "OR (status='QA_LEASED_NO_SEND' AND lease_until_ms<=?3))",
    "RETURNING status,attempts,lease_token"
  ].join(" "),
  ack:[
    "UPDATE v19_b5_qa_inbox SET",
    "status='QA_DONE_NO_SEND',lease_token=NULL,lease_until_ms=NULL,",
    "updated_ms=?4",
    "WHERE scope_key=?1 AND event_key=?2 AND lease_token=?3",
    "AND status='QA_LEASED_NO_SEND' AND lease_until_ms>?4",
    "RETURNING status,attempts"
  ].join(" "),
  fail:[
    "UPDATE v19_b5_qa_inbox SET",
    "status=CASE WHEN attempts>=max_attempts",
    "THEN 'QA_DLQ_NO_SEND' ELSE 'QA_RETRY_NO_SEND' END,",
    "next_attempt_ms=?5,last_error_code=?6,",
    "lease_token=NULL,lease_until_ms=NULL,updated_ms=?4",
    "WHERE scope_key=?1 AND event_key=?2 AND lease_token=?3",
    "AND status='QA_LEASED_NO_SEND' AND lease_until_ms>?4",
    "RETURNING status,attempts"
  ].join(" "),
  sweepExhausted:[
    "UPDATE v19_b5_qa_inbox SET",
    "status='QA_DLQ_NO_SEND',lease_token=NULL,lease_until_ms=NULL,updated_ms=?3",
    "WHERE scope_key=?1 AND event_key=?2 AND",
    "status='QA_LEASED_NO_SEND' AND lease_until_ms<=?3",
    "AND attempts>=max_attempts",
    "RETURNING status,attempts"
  ].join(" "),
  read:[
    "SELECT status,attempts,delivery_observations,lease_until_ms,next_attempt_ms",
    "FROM v19_b5_qa_inbox WHERE scope_key=?1 AND event_key=?2"
  ].join(" ")
});

async function first(db,sql,bindings){
  try{return {ok:true,row:await db.prepare(sql).bind(...bindings).first()};}
  catch{return {ok:false,row:null};}
}
export async function admitSynthetic(db,{
  scopeKey,eventKey,payloadHash,fixtureRef,nowMs
}={}){
  if(!okay(db,scopeKey,eventKey,nowMs)||!KEY.test(payloadHash||"")||
    !FIXTURE.test(fixtureRef||""))return deny("INVALID_SYNTHETIC_INPUT");
  const call=await first(db,SQL.admit,[scopeKey,eventKey,payloadHash,fixtureRef,nowMs]);
  if(!call.ok)return deny("DB_ADMISSION_ERROR");
  if(call.row===null)return deny("CONFLICTING_EVENT_ID_OR_PAYLOAD");
  if(!VALID_STATES.has(call.row.status) ||
    !Number.isInteger(call.row.delivery_observations) ||
    call.row.delivery_observations<1)return deny("DB_UNEXPECTED_RESULT");
  return result("QA_RECEIPT_PERSISTED_NO_SEND",{
    status:call.row.status,deliveryObservations:call.row.delivery_observations
  });
}
export async function claimSynthetic(db,{scopeKey,eventKey,nowMs,leaseMs=2000}={}){
  if(!okay(db,scopeKey,eventKey,nowMs)||!Number.isInteger(leaseMs)||
    leaseMs<100||leaseMs>10000||nowMs+leaseMs>Number.MAX_SAFE_INTEGER)return deny("INVALID_SYNTHETIC_INPUT");
  const token=crypto.randomUUID();
  const call=await first(db,SQL.claim,[scopeKey,eventKey,nowMs,token,nowMs+leaseMs]);
  if(!call.ok)return deny("DB_CLAIM_ERROR");
  if(call.row===null)return deny("NOT_DUE_OR_ALREADY_CLAIMED");
  if(call.row.status!=="QA_LEASED_NO_SEND" ||
    call.row.lease_token!==token || !Number.isInteger(call.row.attempts)||
    call.row.attempts<1||call.row.attempts>5)return deny("DB_UNEXPECTED_RESULT");
  return result("QA_LEASE_GRANTED_NO_SEND",{
    status:call.row.status,attempts:call.row.attempts,
    // Test-only one-use opaque lease. Never log it or expose via public HTTP.
    leaseToken:token
  });
}
export async function finishSynthetic(db,{scopeKey,eventKey,leaseToken,nowMs}={}){
  if(!okay(db,scopeKey,eventKey,nowMs)||typeof leaseToken!=="string"||
    !/^[0-9a-f-]{36}$/.test(leaseToken))return deny("INVALID_SYNTHETIC_INPUT");
  const call=await first(db,SQL.ack,[scopeKey,eventKey,leaseToken,nowMs]);
  if(!call.ok)return deny("DB_ACK_ERROR");
  if(call.row===null)return deny("STALE_LEASE_OR_NOT_CLAIMED");
  if(call.row.status!=="QA_DONE_NO_SEND")return deny("DB_UNEXPECTED_RESULT");
  return result("QA_DONE_NO_SEND",{attempts:call.row.attempts});
}
export async function retrySynthetic(db,{
  scopeKey,eventKey,leaseToken,nowMs,retryAfterMs=2000,errorCode="QA_SYNTHETIC_FAILURE"
}={}){
  if(!okay(db,scopeKey,eventKey,nowMs)||typeof leaseToken!=="string"||
    !/^[0-9a-f-]{36}$/.test(leaseToken)||
    !Number.isInteger(retryAfterMs)||retryAfterMs<100||retryAfterMs>60000||
    !CODE.test(errorCode||""))return deny("INVALID_SYNTHETIC_INPUT");
  const call=await first(db,SQL.fail,[
    scopeKey,eventKey,leaseToken,nowMs,nowMs+retryAfterMs,errorCode
  ]);
  if(!call.ok)return deny("DB_RETRY_ERROR");
  if(call.row===null)return deny("STALE_LEASE_OR_NOT_CLAIMED");
  if(!["QA_RETRY_NO_SEND","QA_DLQ_NO_SEND"].includes(call.row.status))return deny("DB_UNEXPECTED_RESULT");
  return result(call.row.status,{attempts:call.row.attempts});
}
export async function sweepSyntheticExpiredLease(db,{scopeKey,eventKey,nowMs}={}){
  if(!okay(db,scopeKey,eventKey,nowMs))return deny("INVALID_SYNTHETIC_INPUT");
  const call=await first(db,SQL.sweepExhausted,[scopeKey,eventKey,nowMs]);
  if(!call.ok)return deny("DB_SWEEP_ERROR");
  if(call.row===null)return deny("NOT_EXHAUSTED_OR_NO_EXPIRED_LEASE");
  if(call.row.status!=="QA_DLQ_NO_SEND")return deny("DB_UNEXPECTED_RESULT");
  return result("QA_DLQ_NO_SEND",{attempts:call.row.attempts});
}
export async function readSyntheticReceipt(db,{scopeKey,eventKey,nowMs}={}){
  if(!okay(db,scopeKey,eventKey,nowMs))return deny("INVALID_SYNTHETIC_INPUT");
  const call=await first(db,SQL.read,[scopeKey,eventKey]);
  if(!call.ok)return deny("DB_READ_ERROR");
  if(!call.row)return deny("NOT_FOUND");
  if(!VALID_STATES.has(call.row.status))return deny("DB_UNEXPECTED_RESULT");
  return result("QA_STATE_READ_ONLY",{
    status:call.row.status,attempts:call.row.attempts,
    deliveryObservations:call.row.delivery_observations
  });
}
export default {fetch(){return new Response(null,{status:423});}};
