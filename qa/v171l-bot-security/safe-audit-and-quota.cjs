'use strict';
/**
 * TIEN404 V17.1L — PII-free security audit envelope and bounded
 * model/tool quota proposals. This records no raw messages, phones,
 * images, addresses, headers, URLs, tokens, prompts, or model responses.
 * Source-only; real atomic billing/rate/quota enforcement is NOT here.
 */
const VERSION='T404_V171L_SAFE_AUDIT_AND_QUOTA_PROPOSAL_V1';
const ID=/^[A-Za-z0-9_-]{2,90}$/;
const id=x=>typeof x==='string'&&ID.test(x);
const obj=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const integer=x=>Number.isSafeInteger(x);
const deny=x=>{throw Error(x)};
const DECISIONS=new Set(['INGRESS_DENIED','RATE_DENIED','TOOL_DENIED',
 'READ_PLAN_ONLY','HUMAN_REVIEW_REQUIRED','QUARANTINE_REQUIRED']);
const REASONS=new Set(['SIGNATURE','INSTALLATION','REPLAY','RATE','SCOPE',
 'ORDER_GRANT','TOOL_PERMISSION','MEDIA_QUARANTINE','QUOTA','REVIEW','UNKNOWN']);
function auditSecurityDecision({session,decision,reason,traceId,nowMs,untrustedPayload}={}){
 if(!obj(session)||session.mode!=='OFFLINE_SERVER_ADAPTER_CONTRACT_ONLY'||
    !id(session.tenantId)||!id(session.storeId)||!id(session.botVersion)||
    !['MESSENGER','ZALO','WEBSITE'].includes(session.channel)||
    !DECISIONS.has(decision)||!REASONS.has(reason)||
    !id(traceId)||!integer(nowMs)||nowMs<=0)
    deny('SECURITY_AUDIT_SHAPE_DENIED');
 // Do not process or serialize arbitrary source payloads.
 if(untrustedPayload!==undefined)
    deny('SECURITY_AUDIT_UNTRUSTED_CONTENT_FIELD_DENIED');
 return Object.freeze({
   version:VERSION,mode:'STRUCTURED_METADATA_ONLY',
   traceId,tenantId:session.tenantId,storeId:session.storeId,
   botVersion:session.botVersion,channel:session.channel,
   decision,reason,recordedAtMs:nowMs,
   providerMessageIdLogged:false,phoneLogged:false,
   credentialLogged:false,promptLogged:false,customerMessageLogged:false,
   customerAddressLogged:false,rawImageLogged:false,
   actualHostedAuditWrites:0
 });
}
function quoteBotResourceLimits({tenantId,storeId,maxModelCalls,maxToolCalls,
 maxInputTokens,maxOutputTokens,maxEstimatedMicroUsd,maxReplyBytes,
 maxConversationTurns}={}){
 if(!id(tenantId)||!id(storeId)||
    !integer(maxModelCalls)||maxModelCalls<0||maxModelCalls>1||
    !integer(maxToolCalls)||maxToolCalls<0||maxToolCalls>3||
    !integer(maxInputTokens)||maxInputTokens<1||maxInputTokens>8192||
    !integer(maxOutputTokens)||maxOutputTokens<1||maxOutputTokens>1024||
    !integer(maxEstimatedMicroUsd)||maxEstimatedMicroUsd<1||
    maxEstimatedMicroUsd>50000||
    !integer(maxReplyBytes)||maxReplyBytes<1||maxReplyBytes>2048||
    !integer(maxConversationTurns)||maxConversationTurns<1||
    maxConversationTurns>20)
    deny('BOT_RESOURCE_CAP_OUT_OF_BOUNDS');
 return Object.freeze({version:VERSION,
   mode:'QUOTA_PROPOSAL_NOT_ATOMIC_ENFORCEMENT',
   tenantId,storeId,maxModelCalls,maxToolCalls,
   maxInputTokens,maxOutputTokens,maxEstimatedMicroUsd,
   maxReplyBytes,maxConversationTurns,
   actualProviderCalls:0,actualHostedWrites:0,
   actualMoneyBilledUsd:null,serverAtomicQuotaVerified:false,
   modelProviderPriceVerified:false,
   canExecuteLiveInference:false});
}
module.exports=Object.freeze({VERSION,auditSecurityDecision,quoteBotResourceLimits});