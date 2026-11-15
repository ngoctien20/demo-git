'use strict';
/**
 * TIEN404 AI V14.5 — signed Messenger webhook boundary for OFFLINE TESTING.
 * No HTTP listener, Meta requests, Supabase, n8n, secrets/PII persistence, or sends.
 * Configured Page registry and appSecret are synthetic; NEVER use a real token.
 * Replay Map is process-local; NOT atomic across processes or durable.
 */
const {createHmac, timingSafeEqual} = require('node:crypto');

const PAGE_ID=/^[0-9]{8,25}$/;
const PSID=/^[0-9]{8,30}$/;
const MID=/^[A-Za-z0-9_:.-]{8,220}$/;
const MAX_BODY=512_000;
const MAX_ENTRY=20;
const MAX_EVENTS=50;
const MAX_EVENT_AGE_MS=36*60*60*1000;
function denied(code){const e=new Error(code);e.code=code;throw e;}
function assert(v,code){if(!v)denied(code);}
function fixedHex(value){
 if(typeof value!=='string'||!/^sha256=[0-9a-f]{64}$/i.test(value))
  denied('WEBHOOK_SIGNATURE_MISSING_OR_MALFORMED');
 return Buffer.from(value.slice(7),'hex');
}
function createTrustedQaGate({mode,appSecret,pageRegistry,now=Date.now,
  maxReplayKeys=2500,ttlMs=36*60*60*1000}={}){
 if(mode!=='OFFLINE_SIGNED_FIXTURE_ONLY'||!Buffer.isBuffer(appSecret)||
    appSecret.length<24||!Array.isArray(pageRegistry)||!pageRegistry.length||
    pageRegistry.length>20||typeof now!=='function'||
    !Number.isInteger(maxReplayKeys)||maxReplayKeys<2||maxReplayKeys>20000||
    !Number.isSafeInteger(ttlMs)||ttlMs<60000||ttlMs>48*60*60*1000)
    denied('QA_GATE_CONFIG_INVALID');
 const pages=new Map();
 for(const binding of pageRegistry){
  if(!binding||!PAGE_ID.test(binding.pageId)||typeof binding.tenantId!=='string'||
     !/^TENANT_QA_[A-Z0-9_]{1,30}$/.test(binding.tenantId)||
     !/^STORE_QA_[A-Z0-9_]{1,30}$/.test(binding.storeId||'')||
     typeof binding.active!=='boolean'||pages.has(binding.pageId))
    denied('QA_PAGE_REGISTRY_INVALID');
  pages.set(binding.pageId,Object.freeze({...binding}));
 }
 const replay=new Map();
 let accepted=0,duplicates=0,rejected=0;
 function ingress({rawBody,signature}={}){
  try{
   // Work on EXACT byte buffer before JSON parsing; never JSON.stringify for HMAC.
   assert(Buffer.isBuffer(rawBody)&&rawBody.length>0&&rawBody.length<=MAX_BODY,
      'WEBHOOK_RAW_BYTES_REQUIRED');
   const supplied=fixedHex(signature);
   const computed=createHmac('sha256',appSecret).update(rawBody).digest();
   assert(supplied.length===computed.length&&timingSafeEqual(supplied,computed),
      'WEBHOOK_SIGNATURE_INVALID');
   let data;
   try {data=JSON.parse(rawBody.toString('utf8'));}
   catch {denied('WEBHOOK_JSON_INVALID');}
   assert(data&&data.object==='page'&&Array.isArray(data.entry)&&
     data.entry.length>=1&&data.entry.length<=MAX_ENTRY,'WEBHOOK_PAGE_BATCH_INVALID');
   const fresh=[];
   const withinBatch=new Set();
   let droppedEcho=0,alreadySeen=0;
   for(const entry of data.entry){
    assert(entry&&typeof entry==='object'&&PAGE_ID.test(entry.id),
      'WEBHOOK_PAGE_ID_INVALID');
    const binding=pages.get(entry.id);
    assert(binding&&binding.active===true,'PAGE_BINDING_NOT_FOUND_OR_INACTIVE');
    assert(Array.isArray(entry.messaging)&&entry.messaging.length>0&&
      entry.messaging.length<=MAX_EVENTS,'WEBHOOK_EVENTS_INVALID');
    for(const event of entry.messaging){
     assert(event&&typeof event==='object'&&event.sender&&event.recipient&&
       PSID.test(event.sender.id)&&event.recipient.id===entry.id&&
       Number.isSafeInteger(event.timestamp)&&
       event.timestamp<=now()+2*60*1000&&
       event.timestamp>=now()-MAX_EVENT_AGE_MS,
       'WEBHOOK_EVENT_SCOPE_OR_TIME_INVALID');
     // Echo notifications must not be replied to or interpreted as orders.
     if(event.message?.is_echo===true){droppedEcho++;continue;}
     assert(event.message&&typeof event.message.mid==='string'&&
       MID.test(event.message.mid)&&
       typeof event.message.text==='string'&&
       event.message.text.length>=1&&event.message.text.length<=2000,
       'WEBHOOK_TEXT_EVENT_UNSUPPORTED');
     // Never accept synthetic tenant/store claims injected into payload.
     if(Object.hasOwn(event,'tenantId')||Object.hasOwn(event,'storeId')||
        Object.hasOwn(event.message,'storeId')||Object.hasOwn(event.message,'tenantId'))
      denied('WEBHOOK_CLIENT_SCOPE_OVERRIDE');
     const idKey=entry.id+'|'+event.message.mid;
     const payloadDigest=createHmac('sha256',appSecret)
       .update(entry.id).update('\0').update(event.sender.id).update('\0')
       .update(event.message.mid).update('\0').update(event.message.text).digest('hex');
     if(withinBatch.has(idKey))denied('WEBHOOK_BATCH_DUPLICATE_MID');
     withinBatch.add(idKey);
     const old=replay.get(idKey);
     if(old&&old.expiresAt>now()){
       if(old.digest!==payloadDigest)denied('WEBHOOK_MID_PAYLOAD_CONFLICT');
       alreadySeen++;continue;
     }
     fresh.push({key:idKey,digest:payloadDigest,
       // Sender/token/text are deliberately NOT included in returned output.
       eventIdHash:createHmac('sha256',appSecret).update(idKey).digest('hex'),
       senderScopeHash:createHmac('sha256',appSecret)
          .update(entry.id+'|'+event.sender.id).digest('hex'),
       tenantId:binding.tenantId,storeId:binding.storeId,
       pageRef:binding.pageId,kind:'TEXT_MESSAGE'});
    }
   }
   // Prevalidate entire batch and capacity before writing ANY replay keys.
   const ms=now();
   for(const [key,rec] of replay)if(rec.expiresAt<=ms)replay.delete(key);
   if(replay.size+fresh.length>maxReplayKeys)denied('WEBHOOK_REPLAY_CAPACITY_EXHAUSTED');
   for(const item of fresh)replay.set(item.key,{digest:item.digest,expiresAt:ms+ttlMs});
   accepted+=fresh.length;duplicates+=alreadySeen;
   return Object.freeze({status:'SIGNED_FIXTURE_ACCEPTED_NO_SEND',
     signaturesVerified:true,storeBindingsFromPrivateRegistry:true,
     acceptedEvents:fresh.length,duplicateEvents:alreadySeen,ignoredEchoEvents:droppedEcho,
     events:Object.freeze(fresh.map(x=>Object.freeze({eventIdHash:x.eventIdHash,
       senderScopeHash:x.senderScopeHash,tenantId:x.tenantId,storeId:x.storeId,
       pageRef:x.pageRef,kind:x.kind}))),
     noAiCalls:true,noHostedWrites:true,noProviderSends:true,
     durableReplayAcrossProcesses:false,realPageRightsVerified:false});
  }catch(e){rejected++;throw e;}
 }
 function readiness(evidence={}){
  const required=['metaAppIdConfirmed','qaPageIdConfirmed','testerRoleVerified',
    'pagesMessagingGranted','pageMessageTaskVerified','pageSubscriptionVerified',
    'verifiedPageBinding','rawHmacProved','realTokenValidityChecked',
    'messageWindowEligible','ownerApprovedSendBudget'];
  const pending=required.filter(x=>evidence[x]!==true);
  return Object.freeze({status:'LIVE_SEND_NOT_AUTHORIZED',
     pending:Object.freeze(pending),permitSend:false,permitTokenRotation:false,
     permitWebhookPublish:false,permitOrderWrite:false,
     note:'These booleans are not attested Meta API evidence; separate owner consent and hosted gates still required.'});
 }
 return Object.freeze({ingress,readiness,inspect:()=>Object.freeze({
   mode:'OFFLINE_SIGNED_FIXTURE_ONLY',boundSyntheticPages:pages.size,
   replayKeyCount:replay.size,acceptedEvents:accepted,duplicateEvents:duplicates,
   rejectedBatches:rejected,hasActualMetaPageToken:false,
   realPagePermissionsChecked:false,hasActualJWTBinding:false,
   realMessengerMessagesSent:0,hostedWrites:0,canPublish:false})});
}
module.exports={createTrustedQaGate};
