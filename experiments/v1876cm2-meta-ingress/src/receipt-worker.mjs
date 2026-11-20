/**
 * V18.7.6C-M4: OPT-IN redacted, receipt-only wrapper for the isolated Meta QA Worker.
 * No DB/queue/network, provider sends, customer identifiers or raw payload logging.
 * Do NOT enable REDACTED_RECEIPTS_ENABLED on a public Worker until owner approves
 * sanitized logging/retention and a separate deployment. Currently OFF by default.
 */
import ingress from "./worker.mjs";
const ALLOWED = new Set([
  "messages","messaging_postbacks","message_echoes","message_deliveries",
  "message_reads","messaging_referrals","messaging_handovers","standby",
  "messaging_optins","messaging_policy_enforcement","message_reactions",
  "message_edits","unknown","unknown_page_change"
]);
const safeCount = n => Number.isSafeInteger(n) && n>=1 && n<=60;
export function redactReceipt(data, receiptId){
 if(!data||data.status!=="ACK_ONLY_NO_SEND"||
    data.signatureValidForSuppliedBytes!==true||
    data.canSend!==false||data.canWrite!==false||
    data.storeVerified!==false||!safeCount(data.eventCount)||
    typeof receiptId!=="string"||!/^[a-f0-9-]{36}$/.test(receiptId))return null;
 const types=data.eventTypes;
 if(!types || typeof types!=="object"||Array.isArray(types))return null;
 const keys=Object.keys(types).sort();
 if(keys.length<1||keys.length>14||keys.some(k=>!ALLOWED.has(k)||!safeCount(types[k])))return null;
 if(keys.reduce((a,k)=>a+types[k],0)!==data.eventCount)return null;
 return Object.freeze({
  schema:"tien404.meta.qa.redacted-receipt.v1",
  receiptId,verifiedHmac:true,httpStatus:200,
  eventCount:data.eventCount,
  eventTypes:Object.freeze(Object.fromEntries(keys.map(k=>[k,types[k]]))),
  canSend:false,canWrite:false,storeVerified:false,
  payloadPersisted:false
 });
}
export function createReceiptHandler(inner=ingress, writer=console.info){
 return {async fetch(request,env,ctx){
   const response=await inner.fetch(request,env,ctx);
   // Only a verified POST with a 200 response may produce a receipt.
   if(env?.REDACTED_RECEIPTS_ENABLED!=="true"||
      request.method!=="POST"||response.status!==200)return response;
   try{
    const data=await response.clone().json();
    const receipt=redactReceipt(data,crypto.randomUUID());
    if(receipt)writer("TIEN404_QA_REDACTED_RECEIPT "+JSON.stringify(receipt));
   }catch{
    // Telemetry never changes provider reply. No untrusted errors in logs.
   }
   return response;
 }};
}
export default createReceiptHandler();
