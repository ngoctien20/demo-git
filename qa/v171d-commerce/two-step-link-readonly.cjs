'use strict';
/**
 * V17.1D: TWO-PHASE source-approved cross-channel link, READ-ONLY only.
 * Replaces V17.1C's immediate destination binding in a future integration.
 * Actual provider signature verification, encryption and PG persistence are
 * INJECTED; this class NEVER attests Meta/Zalo or touches hosted resources.
 * A stolen unexpired code + target provider account is NOT sufficient:
 * originating channel holder must approve that target explicitly.
 */
const crypto=require('node:crypto');
const VERSION='T404_V171D_TWO_STEP_IDENTITY_ORDER_UAT_V1';
const CHANNELS=new Set(['MESSENGER','ZALO_OA','ZALO_BOT']);
const ID=/^[A-Za-z0-9_-]{2,90}$/,SHA=/^[a-f0-9]{64}$/;
const fail=e=>{throw Error(e);};
const obj=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const equals=(a,b)=>Buffer.from(a).equals(Buffer.from(b));
function checked(e,requireCustomer=false){
 return obj(e)&&e.source==='SERVER_VERIFIED_PROVIDER_AND_STORE'&&
  e.verified===true&&e.consent===true&&CHANNELS.has(e.channel)&&
  [e.accountId,e.tenantId,e.storeId].every(x=>typeof x==='string'&&ID.test(x))&&
  SHA.test(e.subjectHash||'')&&
  (!requireCustomer||typeof e.canonicalCustomerId==='string'&&ID.test(e.canonicalCustomerId));
}
function makeLinkService({verifySource,verifyTarget,privateStore,
 lookupOrder,pepper,randomBytes=crypto.randomBytes,clock=()=>Date.now()}={}){
 if(![verifySource,verifyTarget,lookupOrder,clock,randomBytes].every(x=>typeof x==='function')||
  !privateStore||!['issue','present','approve','getLink'].every(x=>typeof privateStore[x]==='function')||
  !Buffer.isBuffer(pepper)||pepper.length<32)
  fail('TWO_STEP_INDEPENDENT_PROOF_AND_STORAGE_REQUIRED');
 const now=()=>{const t=clock();if(!Number.isSafeInteger(t)||t<=0)fail('QA_CLOCK_INVALID');return t;};
 const hash=token=>crypto.createHmac('sha256',pepper).update('T404:V171D:TWO_STEP:').update(token).digest('hex');
 const result=(status,fields={})=>Object.freeze({version:VERSION,status,mode:'QA_SOURCE_ONLY',
  ...fields,canCreateOrder:false,canPublish:false,providerSends:0,hostedWrites:0,
  actualMetaZaloProofVerifiedHere:false,hostedStoreRlsCertified:false});
 async function issue({sourceEvent,targetChannel}={}){
  const s=await verifySource(sourceEvent),time=now();
  if(!checked(s,true)||!CHANNELS.has(targetChannel)||targetChannel===s.channel)
   fail('SOURCE_CHANNEL_PROOF_REQUIRED');
  const rand=randomBytes(32);
  if(!Buffer.isBuffer(rand)||rand.length!==32)fail('CSPRNG_REQUIRED');
  const token=rand.toString('base64url'),tokenHash=hash(token);
  const p={tokenHash,tenantId:s.tenantId,storeId:s.storeId,
   canonicalCustomerId:s.canonicalCustomerId,
   sourceChannel:s.channel,sourceAccountId:s.accountId,
   sourceSubjectHash:s.subjectHash,targetChannel,
   createdAtMs:time,expiresAtMs:time+300000};
  if(await privateStore.issue(p)!==true)fail('CHALLENGE_ISSUE_DENIED');
  return result('CHALLENGE_ISSUED_ON_SOURCE_QA',{
   token,tokenHashForAudit:null,expiresAtMs:p.expiresAtMs,
   nextStep:'PRESENT_ON_VERIFIED_TARGET'});
 }
 async function present({token,targetEvent}={}){
  if(typeof token!=='string'||!/^[a-zA-Z0-9_-]{43}$/.test(token))
   fail('INVALID_LINK_TOKEN');
  const d=await verifyTarget(targetEvent);
  if(!checked(d,false))fail('TARGET_PROVIDER_PROOF_REQUIRED');
  const x=await privateStore.present({tokenHash:hash(token),time:now(),
   target:{tenantId:d.tenantId,storeId:d.storeId,channel:d.channel,
    accountId:d.accountId,subjectHash:d.subjectHash}});
  if(!obj(x)||!['PENDING','DENIED'].includes(x.status))
   fail('PRIVATE_PRESENT_RESULT_INVALID');
  return result(x.status==='PENDING'?'AWAIT_SOURCE_APPROVAL':'LINK_CHALLENGE_DENIED',{
   requiresSourceConfirmation:true,canReadOrder:false});
 }
 async function approve({token,sourceEvent}={}){
  if(typeof token!=='string'||!/^[a-zA-Z0-9_-]{43}$/.test(token))
   fail('INVALID_LINK_TOKEN');
  const s=await verifySource(sourceEvent);
  if(!checked(s,true))fail('SOURCE_CONFIRMATION_PROOF_REQUIRED');
  const x=await privateStore.approve({tokenHash:hash(token),time:now(),
   source:{tenantId:s.tenantId,storeId:s.storeId,channel:s.channel,
    accountId:s.accountId,subjectHash:s.subjectHash,
    canonicalCustomerId:s.canonicalCustomerId}});
  if(!obj(x)||!['ACTIVE','DENIED'].includes(x.status))
    fail('PRIVATE_APPROVAL_RESULT_INVALID');
  return result(x.status==='ACTIVE'?'LINK_ACTIVE_QA_RECHECK_EACH_READ':'LINK_APPROVAL_DENIED',{
    requiresFreshOrderAuthorization:true,canReadOrder:false});
 }
 async function readOrder({targetEvent,orderRef}={}){
  const d=await verifyTarget(targetEvent);
  if(!checked(d,false))fail('ORDER_TARGET_PROVIDER_PROOF_REQUIRED');
  if(typeof orderRef!=='string'||!/^T404-[A-Z0-9-]{4,40}$/.test(orderRef))
   return result('ORDER_REFERENCE_INVALID');
  const link=await privateStore.getLink({tenantId:d.tenantId,storeId:d.storeId,
    targetChannel:d.channel,targetAccountId:d.accountId,
    targetSubjectHash:d.subjectHash,time:now()});
  if(!obj(link)||link.status!=='ACTIVE'||link.tenantId!==d.tenantId||
    link.storeId!==d.storeId||!ID.test(link.canonicalCustomerId||''))
   return result('ORDER_ACCESS_DENIED');
  // A verified channel link alone is not an OrderAccessGrant:
  // the trusted backend must independently authorize exact Store+customer+order.
  const p=await lookupOrder({tenantId:d.tenantId,storeId:d.storeId,
   canonicalCustomerId:link.canonicalCustomerId,orderRef,scope:'STATUS_ONLY'});
  if(!obj(p)||p.source!=='AUTHORIZED_ORDER_STATUS_READBACK'||
   p.verified!==true||p.tenantId!==d.tenantId||p.storeId!==d.storeId||
   p.canonicalCustomerId!==link.canonicalCustomerId||p.orderRef!==orderRef||
   !['pending','confirmed','paid','cancelled','refunded','shipped','delivered'].includes(p.status))
   return result('ORDER_ACCESS_DENIED');
  return result('ORDER_STATUS_READ_ONLY_QA',{orderRef,statusCode:p.status,
   customerAddressReturned:false,customerPhoneReturned:false});
 }
 return Object.freeze({VERSION,issue,present,approve,readOrder});
}
/** ONLY for deterministic QA. Real adapters need atomic PG commit and auth. */
function createMemoryStoreQa(){
 const challenges=new Map(),links=new Map();
 const linkKey=t=>[t.tenantId,t.storeId,t.channel,t.accountId,t.subjectHash].join('|');
 return Object.freeze({
  async issue(x){
   if(challenges.has(x.tokenHash))return false;
   challenges.set(x.tokenHash,{...x,status:'ISSUED',target:null});return true;
  },
  async present({tokenHash,target,time}){
   const c=challenges.get(tokenHash);
   if(!c||c.status!=='ISSUED'||time>=c.expiresAtMs||time<c.createdAtMs||
    c.tenantId!==target.tenantId||c.storeId!==target.storeId||
    c.targetChannel!==target.channel||
    (c.sourceSubjectHash===target.subjectHash&&c.sourceAccountId===target.accountId))
    return {status:'DENIED'};
   const old=links.get(linkKey(target));
   if(old&&old.canonicalCustomerId!==c.canonicalCustomerId)return {status:'DENIED'};
   c.status='PENDING';c.target={...target};
   return {status:'PENDING'};
  },
  async approve({tokenHash,source,time}){
   const c=challenges.get(tokenHash);
   if(!c||c.status!=='PENDING'||time>=c.expiresAtMs||
    c.tenantId!==source.tenantId||c.storeId!==source.storeId||
    c.sourceChannel!==source.channel||c.sourceAccountId!==source.accountId||
    c.sourceSubjectHash!==source.subjectHash||
    c.canonicalCustomerId!==source.canonicalCustomerId)
    return {status:'DENIED'};
   const key=linkKey(c.target),old=links.get(key);
   if(old&&old.canonicalCustomerId!==c.canonicalCustomerId)return {status:'DENIED'};
   links.set(key,{canonicalCustomerId:c.canonicalCustomerId,
    tenantId:c.tenantId,storeId:c.storeId,createdAtMs:time,revoked:false});
   c.status='CONSUMED';
   return {status:'ACTIVE'};
  },
  async getLink({tenantId,storeId,targetChannel,targetAccountId,targetSubjectHash}){
   const x=links.get(linkKey({tenantId,storeId,channel:targetChannel,
    accountId:targetAccountId,subjectHash:targetSubjectHash}));
   if(!x||x.revoked)return {status:'DENIED'};
   return {status:'ACTIVE',...x};
  },
  revoke(target){
   const v=links.get(linkKey(target));if(v)v.revoked=true;
  },
  stats(){return Object.freeze({pending:[...challenges.values()].filter(x=>x.status==='PENDING').length,
   activeLinks:[...links.values()].filter(x=>!x.revoked).length,
   durable:false,realProviderProof:false});}
 });
}
module.exports=Object.freeze({VERSION,makeLinkService,createMemoryStoreQa});
