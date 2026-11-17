'use strict';
/**
 * G0.12 read-only, PII-free preview model for internal TIEN404 operators.
 * All rows are ONLY synthetic case aliases from source fixtures here.
 * This is not an authenticated dashboard, production API or review approval.
 * No customer PSID, MID, content, provider tokens, Page ID or source document.
 */
const CONTRACT='T404_G12_OPERATOR_QUEUE_PREVIEW_V1';
const STATES=Object.freeze({
 OPEN:{text:'Cần nhân sự kiểm tra',sort:1},
 IN_REVIEW:{text:'Đang kiểm tra',sort:2},
 WAITING_COSIGN:{text:'Chờ xác minh độc lập',sort:3},
 RESOLVED:{text:'Đã ghi nhận đối soát',sort:4}
});
const REASONS=Object.freeze({
 LEASE_TIMEOUT_NO_SEND:'Xử lý bị gián đoạn',
 SEND_UNCERTAIN:'Chưa xác định tin đã gửi hay chưa'
});
const valid=(s)=>typeof s==='string'&&/^(QA-G12-[0-9]{3})$/.test(s);
function previewQueue(rows=[]){
 if(!Array.isArray(rows)||rows.length>100)
  throw Error('G12_PRIVATE_PREVIEW_SCHEMA_INVALID');
 const out=[],seen=new Set(),counts={needsReview:0,inProgress:0,
  needsIndependentReview:0,reviewed:0,sendUncertain:0};
 for(const item of rows){
  const k=['alias','state','reason'];
  if(!item||typeof item!=='object'||Array.isArray(item)||
     Object.keys(item).length!==3||k.some(x=>!Object.hasOwn(item,x))||
     !valid(item.alias)||!Object.hasOwn(STATES,item.state)||
     !Object.hasOwn(REASONS,item.reason)||seen.has(item.alias))
   throw Error('G12_PRIVATE_PREVIEW_SCHEMA_INVALID');
  seen.add(item.alias);
  counts[item.state==='OPEN'?'needsReview':
    item.state==='IN_REVIEW'?'inProgress':
    item.state==='WAITING_COSIGN'?'needsIndependentReview':'reviewed']++;
  if(item.reason==='SEND_UNCERTAIN')counts.sendUncertain++;
  out.push(Object.freeze({
   code:item.alias,
   stateLabel:STATES[item.state].text,
   reasonLabel:REASONS[item.reason],
   highPriority:item.reason==='SEND_UNCERTAIN',
   maySendMessage:false,mayCreateOrder:false,mayResetLedger:false,
   reviewedDoesNotMeanDelivered:true
  }));
 }
 out.sort((a,b)=>Number(b.highPriority)-Number(a.highPriority)||
  a.code.localeCompare(b.code));
 return Object.freeze({contract:CONTRACT,source:'SYNTHETIC_OFFLINE_PREVIEW',
  counts:Object.freeze(counts),cards:Object.freeze(out),
  canReadCustomers:false,canSend:false,canRetryProvider:false,
  canPublish:false,realOperatorProofEstablished:false,
  actualStoreOwnershipVerified:false,
  providerDeliveryStatusCertified:false,
  pilotAdmission:'NO_GO'});
}
module.exports=Object.freeze({CONTRACT,previewQueue});
