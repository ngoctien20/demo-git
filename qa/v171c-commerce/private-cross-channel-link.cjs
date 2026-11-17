'use strict';
/**
 * V17.1C: source-only two-channel proof-of-possession link challenge.
 * Server-injected provider attestation + PRIVATE atomic storage REQUIRED.
 * The demo factory below is MEMORY-ONLY and must NEVER be used for hosted.
 * No Meta/Zalo/OTP/JWT execution, no provider send, no customer data access.
 */
const crypto=require('node:crypto');
const VERSION='T404_V171C_CHANNEL_LINK_QA_V1';
const CHANNELS=new Set(['MESSENGER','ZALO_BOT','ZALO_OA']);
const TTL_MS=5*60*1000;
const hashPattern=/^[a-f0-9]{64}$/;
const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{2,90}$/.test(v);
const obj=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
const deny=code=>{throw new Error(code);};
function scopeEvidence(x,canonical=false){
 return obj(x)&&x.source==='SERVER_VERIFIED_PROVIDER_AND_STORE'&&
  x.verified===true&&x.consent===true&&CHANNELS.has(x.channel)&&
  id(x.tenantId)&&id(x.storeId)&&id(x.accountId)&&
  hashPattern.test(x.subjectHash||'')&&
  (!canonical||id(x.canonicalCustomerId));
}
function digest(pepper,token){
 return crypto.createHmac('sha256',pepper).update('T404:V171C:LINK:').update(token).digest('hex');
}
function createLinkService({attestSource,attestDestination,privateStore,
  pepper,randomBytes=crypto.randomBytes,clock=()=>Date.now()}={}){
 if(typeof attestSource!=='function'||typeof attestDestination!=='function'||
   !obj(privateStore)||typeof privateStore.createChallenge!=='function'||
   typeof privateStore.consumeAndBind!=='function'||
   !Buffer.isBuffer(pepper)||pepper.length<32||
   typeof randomBytes!=='function'||typeof clock!=='function')
  deny('PRIVATE_SERVER_PROOFS_AND_STORAGE_REQUIRED');
 const now=()=>{const n=clock();if(!Number.isSafeInteger(n)||n<=0)deny('CLOCK_INVALID');return n;};
 function verdict(status,rest={}){
  return Object.freeze({version:VERSION,mode:'SYNTHETIC_NO_SEND',
   status,...rest,providerSends:0,orderWrites:0,hostedWrites:0,
   durableHostedLinkCertified:false,realChannelProofVerifiedHere:false,
   canReadOrder:false,canPublish:false});
 }
 async function issue({sourceEvent,targetChannel}={}){
  if(!CHANNELS.has(targetChannel))deny('TARGET_CHANNEL_UNSUPPORTED');
  const src=await attestSource(sourceEvent);
  if(!scopeEvidence(src,true)||src.channel===targetChannel)
   deny('SOURCE_CHANNEL_AND_CUSTOMER_PROOF_REQUIRED');
  // Token is shown only on the verified source channel by a future
  // authorized adapter. Code must never be logged in GitHub/n8n.
  const entropy=randomBytes(32);
  if(!Buffer.isBuffer(entropy)||entropy.length!==32)deny('CSPRNG_REQUIRED');
  const token=entropy.toString('base64url');
  const t=now(),challengeHash=digest(pepper,token);
  const record={
   challengeHash,tenantId:src.tenantId,storeId:src.storeId,
   sourceChannel:src.channel,sourceAccountId:src.accountId,
   sourceSubjectHash:src.subjectHash,canonicalCustomerId:src.canonicalCustomerId,
   targetChannel,createdAtMs:t,expiresAtMs:t+TTL_MS
  };
  const ok=await privateStore.createChallenge(record);
  if(ok!==true)deny('CHALLENGE_ISSUE_DENIED');
  return verdict('CHALLENGE_ISSUED_QA_ONLY',{challengeToken:token,
   expiresAtMs:record.expiresAtMs,
   mustVerifyDestinationChannel:true,requiresSeparateIdentityPermission:true});
 }
 async function redeem({token,destinationEvent}={}){
  if(typeof token!=='string'||!/^[A-Za-z0-9_-]{42,50}$/.test(token))
    deny('CHALLENGE_TOKEN_INVALID');
  const dst=await attestDestination(destinationEvent);
  if(!scopeEvidence(dst,false))deny('DESTINATION_PROVIDER_PROOF_REQUIRED');
  const result=await privateStore.consumeAndBind({
   challengeHash:digest(pepper,token),
   destination:{channel:dst.channel,accountId:dst.accountId,
    subjectHash:dst.subjectHash,tenantId:dst.tenantId,storeId:dst.storeId},
   nowMs:now()
  });
  // NEVER trust a client-provided "linked=true" or channel/user ID.
  if(!obj(result)||!['BOUND','DENIED'].includes(result.status))
   deny('PRIVATE_ATOMIC_BINDING_RESULT_INVALID');
  if(result.status!=='BOUND')return verdict('CHALLENGE_DENIED_OR_EXPIRED');
  if(!id(result.canonicalCustomerId))deny('PRIVATE_BINDING_OUTPUT_INVALID');
  return verdict('IDENTITY_LINK_BOUND_QA_MEMORY_ONLY',{
   canonicalCustomerId:result.canonicalCustomerId,
   scope:'ORDER_READ_ONLY',
   requiresFreshOrderAuthorization:true});
 }
 return Object.freeze({VERSION,issue,redeem});
}
/** QA-only Map simulates the atomic DB adapter contract; NOT durable. */
function createInMemoryPrivateQaStore(){
 const challenges=new Map(),links=new Map();
 return Object.freeze({
  async createChallenge(r){
   if(!obj(r)||challenges.has(r.challengeHash))return false;
   challenges.set(r.challengeHash,{...r,consumed:false});return true;
  },
  async consumeAndBind({challengeHash,destination,nowMs}={}){
   const c=challenges.get(challengeHash);
   if(!c||c.consumed||nowMs>=c.expiresAtMs||
    nowMs<c.createdAtMs||destination.channel!==c.targetChannel||
    destination.tenantId!==c.tenantId||destination.storeId!==c.storeId||
    destination.channel===c.sourceChannel||
    (destination.subjectHash===c.sourceSubjectHash&&
      destination.accountId===c.sourceAccountId))
    return {status:'DENIED'};
   const key=[destination.tenantId,destination.storeId,
     destination.channel,destination.accountId,destination.subjectHash].join('|');
   if(links.has(key)&&links.get(key)!==c.canonicalCustomerId)
     return {status:'DENIED'};
   c.consumed=true;
   links.set(key,c.canonicalCustomerId);
   return {status:'BOUND',canonicalCustomerId:c.canonicalCustomerId};
  },
  snapshot(){return Object.freeze({challenges:challenges.size,links:links.size,
   durable:false,hostedApproved:false});}
 });
}
module.exports=Object.freeze({VERSION,TTL_MS,createLinkService,createInMemoryPrivateQaStore});
