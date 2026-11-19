"use strict";
/**
 * TIEN404 V18.7.6C-M, OFFLINE INSPECTION LIBRARY ONLY.
 * This function NEVER sends messages, invokes AI, reads orders, persists data,
 * connects to n8n or resolves Store from customer/page supplied fields.
 * Valid Meta HMAC over raw HTTP bytes is necessary, NOT sufficient for tenant/store authority.
 */
const {createHmac,timingSafeEqual}=require("node:crypto");
const MAX_BYTES=64*1024,MAX_EVENTS=60;
const SUPPORTED=Object.freeze([
 "messages","messaging_postbacks","message_echoes","message_deliveries","message_reads",
 "messaging_referrals","messaging_handovers","standby","messaging_optins",
 "messaging_policy_enforcement","message_reactions","message_edits"
]);
const ACTION="QUARANTINE_NO_SEND";
const reject=(reason)=>Object.freeze({
 ok:false,reason,origin:"SYNTHETIC_QA",events:Object.freeze([]),
 liveMetaVerified:false,storeVerified:false,canSend:false,canWrite:false,canReadPrivateOrders:false,
 status:"REJECTED"
});
const isObj=v=>v!==null&&typeof v==="object"&&!Array.isArray(v);
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
function kind(e,standby){
 if(!isObj(e))return "unknown_event";
 if(standby)return "standby"; // Standby never enters main message AI pipeline.
 if(isObj(e.delivery))return "message_deliveries";
 if(isObj(e.read))return "message_reads";
 if(isObj(e.postback))return "messaging_postbacks";
 if(own(e,"pass_thread_control")||own(e,"take_thread_control")||own(e,"request_thread_control"))return "messaging_handovers";
 if(isObj(e.policy_enforcement))return "messaging_policy_enforcement";
 if(isObj(e.optin))return "messaging_optins";
 if(isObj(e.referral))return "messaging_referrals";
 if(isObj(e.reaction))return "message_reactions";
 if(isObj(e.message)){
   if(e.message.is_echo===true)return "message_echoes";
   if(e.message.is_edit===true||e.message.edit===true)return "message_edits";
   return "messages";
 }
 return "unknown_event";
}
function summarize(entry){
 if(!isObj(entry))return null;
 // Do not output sender, recipient, PSID, Page ID, message ID, text, raw attachments or tokens.
 const result=[];
 for(const [key,standby] of [["messaging",false],["standby",true]]){
   if(!own(entry,key))continue;
   const group=entry[key];
   if(!Array.isArray(group)||group.length>MAX_EVENTS)return null;
   for(const e of group){
     const type=kind(e,standby);
     result.push(Object.freeze({
       type,classification:SUPPORTED.includes(type)?"KNOWN_NO_SEND":"UNRECOGNIZED_QUARANTINED",
       intendedAction:ACTION,
       pageScope:"UNRESOLVED",storeScope:"UNRESOLVED",
       requiresVerifiedInstallation:true,allowsAgent:false,
       canSend:false,canWrite:false,canReadPrivateOrders:false
     }));
   }
 }
 return result;
}
function inspectSignedMetaWebhook(input){
 if(!isObj(input)||!Object.keys(input).every(k=>["rawBody","signature256","appSecret"].includes(k)))
   return reject("INPUT_SHAPE_INVALID");
 const {rawBody,signature256,appSecret}=input;
 // Caller supplies the raw byte buffer *from the HTTP ingress*, not JSON.stringify(body).
 if(!Buffer.isBuffer(rawBody)||rawBody.length===0||rawBody.length>MAX_BYTES)return reject("RAW_BODY_INVALID");
 if(typeof signature256!=="string"||!/^sha256=[a-fA-F0-9]{64}$/.test(signature256))return reject("SIGNATURE_FORMAT_INVALID");
 if(!Buffer.isBuffer(appSecret)||appSecret.length<16)return reject("APP_SECRET_INVALID");
 const calc=createHmac("sha256",appSecret).update(rawBody).digest();
 const given=Buffer.from(signature256.slice(7),"hex");
 if(given.length!==calc.length||!timingSafeEqual(calc,given))return reject("SIGNATURE_INVALID");
 let body;try{body=JSON.parse(rawBody.toString("utf8"));}catch{return reject("INVALID_JSON");}
 if(!isObj(body)||body.object!=="page"||!Array.isArray(body.entry)||body.entry.length<1||body.entry.length>10)return reject("PAGE_ENVELOPE_INVALID");
 const out=[];
 for(const entry of body.entry){
   const summary=summarize(entry);
   if(summary===null)return reject("EVENT_BATCH_INVALID");
   out.push(...summary);
   if(out.length>MAX_EVENTS)return reject("EVENT_LIMIT_EXCEEDED");
 }
 if(out.length===0)return reject("NO_RECOGNIZED_MESSAGE_CONTAINER");
 const totals={};
 for(const e of out)totals[e.type]=(totals[e.type]||0)+1;
 return Object.freeze({
   ok:true,status:"SIGNED_PAYLOAD_CLASSIFIED_NO_SEND",origin:"SYNTHETIC_QA",
   signatureValidForSuppliedBytes:true,liveMetaVerified:false,
   storeVerified:false,installationVerified:false,pageLevelSubscriptionVerified:false,
   events:Object.freeze(out),counts:Object.freeze(totals),
   canSend:false,canWrite:false,canReadPrivateOrders:false,
   requiresRealStoreAuthority:true
 });
}
module.exports={inspectSignedMetaWebhook,kind,SUPPORTED,MAX_BYTES,MAX_EVENTS};
