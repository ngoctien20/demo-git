'use strict';
/*
 * TIEN404 V15.2-ADV.5 — SERVER-ONLY signed action RECEIPT registry.
 * Node crypto is intentionally NOT exposed to browser scripts.
 * This is NOT a production action executor or a provider postback sender.
 * No keys or user credentials are stored in the repository.
 *
 * Real integration MUST inject: verified JWT/channel identity resolver, server-side
 * authorize-on-issue + authorize-on-consume, and durable atomic claimOnce.
 * Memory-only QA claim storage below MUST NOT be used in a multi-instance backend.
 */
const crypto=require('node:crypto');
const VERSION='T404_ACTION_V1';
const MAX_TTL_MS=5*60*1000;
const MAX_CLOCK_SKEW_MS=10*1000;
const ACTIONS=Object.freeze(['CATALOG','QUOTE','ORDER_REQUEST','ASK_STAFF','POLICY']);
const CHANNELS=Object.freeze(['MESSENGER','ZALO_BOT','ZALO_OA','WEB_WIDGET']);
const CLAIM_KEYS=Object.freeze(['v','kid','jti','iat','exp','tenant_id','store_id','channel',
  'subject_id','recipient_binding','action','resource_ref']);
const exact=(o,fields)=>o&&typeof o==='object'&&!Array.isArray(o)&&
  Object.getPrototypeOf(o)===Object.prototype&&
  Object.keys(o).length===fields.length&&fields.every(x=>Object.hasOwn(o,x));
const safe=(x,max=128)=>typeof x==='string'&&x.length>0&&x.length<=max&&
  /^[A-Za-z0-9:_./-]+$/.test(x);
const fail=reason=>{throw new Error(reason)};
const nowValid=x=>Number.isSafeInteger(x)&&x>=0;
const stableKey=scope=>crypto.createHash('sha256')
  .update([scope.tenant_id,scope.store_id,scope.channel,scope.jti].join('|'))
  .digest('hex');
function createEphemeralQaClaimStore(){
  const seen=new Map();
  return Object.freeze({
    // QA only: synchronous compare-and-set in a single Node process.
    async claimOnce(key,expiresAt){
      if(!safe(key,420)||!nowValid(expiresAt))fail('QA_NONCE_INVALID');
      if(seen.has(key))return false;
      seen.set(key,expiresAt);
      return true;
    },
    size(){return seen.size}
  });
}
function createRegistry({keyRing,activeKid,resolveVerifiedContext,authorize,nonceStore,clock}={}){
  if(!keyRing||typeof keyRing!=='object'||Array.isArray(keyRing)||
     !safe(activeKid,40)||!Object.hasOwn(keyRing,activeKid)||
     typeof resolveVerifiedContext!=='function'||typeof authorize!=='function'||
     !nonceStore||typeof nonceStore.claimOnce!=='function')
    fail('SERVER_SECURITY_DEPENDENCY_MISSING');
  const keys=new Map();
  for(const [kid,secret] of Object.entries(keyRing)){
    if(!safe(kid,40)||!Buffer.isBuffer(secret)||secret.length<32)
      fail('INVALID_SIGNING_KEY_RING');
    keys.set(kid,Buffer.from(secret)); // copy so caller cannot mutate
  }
  const getNow=typeof clock==='function'?clock:()=>Date.now();
  const hmac=(payload,key)=>crypto.createHmac('sha256',key)
    .update('TIEN404:ACTION:v1:').update(payload).digest();
  async function contextFor(request){
    const ctx=await resolveVerifiedContext(request);
    // Verified identity MUST originate in the injected SERVER resolver.
    // An untrusted browser field "verified": true is not accepted here.
    if(!exact(ctx,['tenant_id','store_id','channel','subject_id','recipient_binding','auth_source'])||
       ctx.auth_source!=='SERVER_VERIFIED_JWT_OR_CHANNEL_BINDING'||
       !safe(ctx.tenant_id)||!safe(ctx.store_id)||!CHANNELS.includes(ctx.channel)||
       !safe(ctx.subject_id)||!safe(ctx.recipient_binding))
      fail('VERIFIED_CONTEXT_REQUIRED');
    return ctx;
  }
  async function authorized(phase,ctx,action,resource_ref){
    // Server callback is mandatory on both issue and consume.
    if((await authorize({phase,principal:ctx,action,resource_ref}))!==true)
      fail('ACTION_ROLE_DENIED');
  }
  async function issue({request,action,resource_ref=null,ttlMs=120000}={}){
    if(!ACTIONS.includes(action))fail('ACTION_NOT_ALLOWLISTED');
    if(resource_ref!==null&&!safe(resource_ref,128))fail('RESOURCE_REFERENCE_INVALID');
    if(!Number.isSafeInteger(ttlMs)||ttlMs<1000||ttlMs>MAX_TTL_MS)
      fail('ACTION_TTL_DENIED');
    const ctx=await contextFor(request);
    await authorized('ISSUE',ctx,action,resource_ref);
    const iat=getNow(),exp=iat+ttlMs;
    if(!nowValid(iat)||!Number.isSafeInteger(exp))fail('CLOCK_INVALID');
    const payload={v:VERSION,kid:activeKid,jti:crypto.randomBytes(18).toString('hex'),
      iat,exp,tenant_id:ctx.tenant_id,store_id:ctx.store_id,channel:ctx.channel,
      subject_id:ctx.subject_id,recipient_binding:ctx.recipient_binding,
      action,resource_ref};
    const compact=Buffer.from(JSON.stringify(payload),'utf8').toString('base64url');
    const signature=hmac(compact,keys.get(activeKid)).toString('base64url');
    return Object.freeze({token:'ta1.'+compact+'.'+signature,expiresAt:exp,
      action,scope:{tenant_id:ctx.tenant_id,store_id:ctx.store_id,channel:ctx.channel},
      transport:'SERVER_ONLY',canExecute:false,providerSendAllowed:false});
  }
  async function verifyAndClaim({token,request}={}){
    if(typeof token!=='string'||token.length>2048||
       !/^ta1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token))
      fail('MALFORMED_ACTION_TOKEN');
    const [,compact,mac]=token.split('.');
    let data;
    try{
      const bytes=Buffer.from(compact,'base64url');
      if(bytes.toString('base64url')!==compact)fail('NON_CANONICAL_ACTION_TOKEN');
      data=JSON.parse(bytes.toString('utf8'));
    }catch{fail('INVALID_ACTION_CLAIMS')}
    if(!exact(data,CLAIM_KEYS)||data.v!==VERSION||!safe(data.kid,40)||
       !keys.has(data.kid)||!safe(data.jti,64)||!ACTIONS.includes(data.action)||
       !CHANNELS.includes(data.channel)||!safe(data.tenant_id)||!safe(data.store_id)||
       !safe(data.subject_id)||!safe(data.recipient_binding)||
       (data.resource_ref!==null&&!safe(data.resource_ref,128))||
       !nowValid(data.iat)||!nowValid(data.exp)||
       data.exp-data.iat<1000||data.exp-data.iat>MAX_TTL_MS)
      fail('INVALID_ACTION_CLAIMS');
    let actual;
    try{actual=Buffer.from(mac,'base64url')}catch{fail('BAD_ACTION_SIGNATURE')}
    const expected=hmac(compact,keys.get(data.kid));
    if(actual.length!==expected.length||!crypto.timingSafeEqual(actual,expected))
      fail('BAD_ACTION_SIGNATURE');
    const current=getNow();
    if(!nowValid(current)||data.iat>current+MAX_CLOCK_SKEW_MS||
       data.exp<=current)fail('ACTION_EXPIRED_OR_FUTURE');
    const ctx=await contextFor(request);
    for(const k of ['tenant_id','store_id','channel','subject_id','recipient_binding']){
      if(ctx[k]!==data[k])fail('ACTION_BINDING_MISMATCH');
    }
    await authorized('CONSUME',ctx,data.action,data.resource_ref);
    // Secure production adapter MUST atomically claim nonce in persistent DB/DO.
    // No execute/send happens here, even on success.
    const key=stableKey(data);
    const claimed=await nonceStore.claimOnce(key,data.exp+MAX_TTL_MS);
    if(claimed!==true)fail('ACTION_REPLAY_OR_CLAIM_FAILED');
    return Object.freeze({
      status:'VERIFIED_CLAIMED_NO_EXECUTION',contract:VERSION,
      action:data.action,resource_ref:data.resource_ref,tenant_id:data.tenant_id,
      store_id:data.store_id,channel:data.channel,subject_id:data.subject_id,
      nonceClaimed:true,actionExecuted:false,orderCreated:false,
      providerSends:0,hostedWrites:0,sendAuthorized:false
    });
  }
  return Object.freeze({issue,verifyAndClaim,
    execute(){fail('BUSINESS_EXECUTION_DISABLED')},
    send(){fail('PROVIDER_SEND_DISABLED')}});
}
module.exports=Object.freeze({VERSION,ACTIONS,CHANNELS,MAX_TTL_MS,
  createRegistry,createEphemeralQaClaimStore});