/**
 * TIEN404 V18.7.6C-M3-H4 — redacted POST receipt candidate (NOT DEPLOYED).
 * Never ingest/request log headers, URL/query, raw body, Page ID, PSID, tokens,
 * signatures, user agent, IP, customer text, timestamps from user payload, order data.
 * Cloudflare Workers Logs invocation_logs must be FALSE before enabling custom logs:
 * Meta GET verification includes hub.verify_token in query string.
 */
const KNOWN_TYPES=new Set([
 "messages","messaging_postbacks","message_deliveries","message_reads",
 "message_echoes","messaging_handovers","messaging_referrals","messaging_optins",
 "messaging_policy_enforcement","message_reactions","message_edits","standby",
 "unknown","unknown_page_change"
]);
const KNOWN_DECISIONS=new Set([
 "ACCEPTED","GATE_DISABLED","UNKNOWN_PATH","METHOD_DENIED","CONTENT_TYPE_DENIED",
 "RAW_BODY_INVALID","META_SIGNATURE_INVALID","INVALID_JSON","PAGE_EVENT_INVALID"
]);
const ALLOWED_STATUS=new Set([200,400,401,403,404,405,413,415,422,503]);
const frozenFalse={canSend:false,canWrite:false,canReadPrivateOrders:false,storeVerified:false};
function sanitizeCounts(types){
 const out=Object.create(null);
 if(!types||typeof types!=="object"||Array.isArray(types))return out;
 for(const [key,n] of Object.entries(types)){
  if(KNOWN_TYPES.has(key)&&Number.isSafeInteger(n)&&n>=0&&n<=60)out[key]=n;
 }
 return out;
}
function makeRedactedReceipt(input,clock=()=>new Date().toISOString(),makeId=()=>crypto.randomUUID()){
 const types=sanitizeCounts(input?.eventTypes);
 const status=ALLOWED_STATUS.has(input?.httpStatus)?input.httpStatus:500;
 const decision=KNOWN_DECISIONS.has(input?.decision)?input.decision:"UNCLASSIFIED";
 return Object.freeze({
  schema:"tien404.meta.qa.receipt.v1",
  receiptId:makeId(),              // generated locally, never based on sender or Page
  occurredAt:clock(),              // server clock, never event timestamp from payload
  environment:"QA_ONLY",
  requestMethod:"POST",
  httpStatus:status,
  decision,
  hmacVerified:input?.hmacVerified===true,
  eventTypes:Object.freeze(types),
  ...frozenFalse,
  metaDeliveryVerified:false,      // provider-side acceptance requires independent proof
  pageSubscriptionVerified:false
 });
}
function recordQaPostReceipt(env,input,logger=console.info,clock,makeId){
 // Explicit dual gate; currently neither exists on hosted H2 Worker.
 if(env?.QA_TELEMETRY_ENABLED!=="true"||env?.QA_TELEMETRY_CONSENT!=="APPROVED")return false;
 try{
  const record=makeRedactedReceipt(input,clock,makeId);
  logger(JSON.stringify(record)); // only primitive allowlist-built receipt; no catch dump
  return true;
 }catch{return false;}           // telemetry MUST NOT change webhook response status
}
export {KNOWN_TYPES,KNOWN_DECISIONS,makeRedactedReceipt,recordQaPostReceipt};
