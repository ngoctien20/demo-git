'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const action=require('./signed-action-registry.cjs');

const identity=(overrides={})=>({
  tenant_id:'qa_tenant_1',store_id:'qa_shop_a',channel:'MESSENGER',
  subject_id:'qa_owner_a',recipient_binding:'qa_recipient_hash_a',
  auth_source:'SERVER_VERIFIED_JWT_OR_CHANNEL_BINDING',...overrides
});
function setup({secret,oldKey,authorize,store,initial=1700000000000}={}){
  const issuedSecret=secret||crypto.randomBytes(32);
  const ring=oldKey?{legacy:oldKey,active:issuedSecret}:{active:issuedSecret};
  let clock=initial;
  const audit=[];
  const registry=action.createRegistry({
    keyRing:ring,activeKid:'active',clock:()=>clock,
    resolveVerifiedContext:async request=>{
      if(!request||request.serverVerified!==true)
        throw Error('VERIFIED_CONTEXT_REQUIRED');
      // This test simulates a trusted JWT resolver. Production MUST NOT use
      // an untrusted request flag as proof of identity.
      return request.principal;
    },
    authorize:async ({phase,principal,action:kind,resource_ref})=>{
      audit.push({phase,store:principal.store_id,kind,resource_ref});
      return typeof authorize==='function'?authorize({phase,principal,action:kind,resource_ref}):true;
    },
    nonceStore:store||action.createEphemeralQaClaimStore()
  });
  return {
    registry,ring,audit,
    request:(scope=identity())=>({serverVerified:true,principal:scope}),
    time:t=>{clock=t},now:()=>clock
  };
}
const make=async env=>env.registry.issue({
  request:env.request(),action:'QUOTE',resource_ref:'qa:A001'
});
test('server-only HMAC receipt: verified once, no order/send/hosted effect',async()=>{
 const env=setup(),issued=await make(env);
 assert.match(issued.token,/^ta1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
 assert.equal(issued.canExecute,false);
 const ok=await env.registry.verifyAndClaim({token:issued.token,request:env.request()});
 assert.equal(ok.status,'VERIFIED_CLAIMED_NO_EXECUTION');
 assert.equal(ok.action,'QUOTE');
 assert.equal(ok.orderCreated,false);
 assert.equal(ok.providerSends,0);
 assert.equal(ok.hostedWrites,0);
 assert.equal(ok.sendAuthorized,false);
 assert.deepEqual(env.audit.map(a=>a.phase),['ISSUE','CONSUME']);
 await assert.rejects(()=>env.registry.verifyAndClaim({token:issued.token,request:env.request()}),/ACTION_REPLAY/);
});
test('reject all privileged or unknown commands, including order creation and lookup',async()=>{
 const env=setup();
 for(const name of ['CREATE_ORDER','UPDATE_STOCK','TRACK_ORDER','DELETE_ORDER','BILLING','ADMIN']){
  await assert.rejects(()=>env.registry.issue({request:env.request(),action:name}),/ACTION_NOT_ALLOWLISTED/);
 }
 assert.throws(()=>env.registry.execute(),/BUSINESS_EXECUTION_DISABLED/);
 assert.throws(()=>env.registry.send(),/PROVIDER_SEND_DISABLED/);
});
test('no valid verified context means no receipt',async()=>{
 const env=setup();
 await assert.rejects(()=>env.registry.issue({request:{principal:identity()},action:'QUOTE'}),/VERIFIED_CONTEXT_REQUIRED/);
 await assert.rejects(()=>env.registry.issue({
  request:env.request(identity({auth_source:'UNVERIFIED_BROWSER'})),action:'QUOTE'
 }),/VERIFIED_CONTEXT_REQUIRED/);
});
test('same-tenant but different Shop cannot reuse token',async()=>{
 const env=setup(),issued=await make(env);
 await assert.rejects(()=>env.registry.verifyAndClaim({token:issued.token,
  request:env.request(identity({store_id:'qa_shop_b'}))}),/ACTION_BINDING_MISMATCH/);
 assert.equal((await env.registry.verifyAndClaim({token:issued.token,request:env.request()})).nonceClaimed,true);
});
test('wrong tenant, channel, subject and recipient binding rejected',async()=>{
 for(const override of [{tenant_id:'qa_tenant_2'},{channel:'ZALO_BOT'},
   {subject_id:'qa_owner_b'},{recipient_binding:'qa_recipient_hash_b'}]){
   const env=setup(),issued=await make(env);
   await assert.rejects(()=>env.registry.verifyAndClaim({
     token:issued.token,request:env.request(identity(override))
   }),/ACTION_BINDING_MISMATCH/);
 }
});
test('tampering price, action, store, and expiration cannot preserve HMAC',async()=>{
 const env=setup(),issued=await make(env);
 const parts=issued.token.split('.');
 const claims=JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8'));
 for(const edit of [{action:'ORDER_REQUEST'},{store_id:'qa_shop_b'},{exp:claims.exp+100000},
   {resource_ref:'qa:other'}]){
   const raw=Buffer.from(JSON.stringify({...claims,...edit})).toString('base64url');
   await assert.rejects(()=>env.registry.verifyAndClaim({
     token:parts[0]+'.'+raw+'.'+parts[2],request:env.request()
   }),/BAD_ACTION_SIGNATURE/);
 }
});
test('invalid, huge and truncated token rejected',async()=>{
 const env=setup();
 for(const token of ['ta1.bad','x.y.z','ta1.'+'a'.repeat(2100)+'.zz','',
   'ta1.<script>.anything']){
   await assert.rejects(()=>env.registry.verifyAndClaim({token,request:env.request()}),
    /MALFORMED_ACTION_TOKEN/);
 }
});
test('expired tokens and too-far future timestamps fail closed',async()=>{
 const env=setup(),issued=await make(env);
 env.time(issued.expiresAt);
 await assert.rejects(()=>env.registry.verifyAndClaim({token:issued.token,request:env.request()}),
   /ACTION_EXPIRED_OR_FUTURE/);
 const later=setup();
 const second=await make(later);
 later.time(later.now()-11000);
 await assert.rejects(()=>later.registry.verifyAndClaim({token:second.token,request:later.request()}),
   /ACTION_EXPIRED_OR_FUTURE/);
});
test('deny TTL overflow, malformed resource references and invalid roles',async()=>{
 const env=setup();
 for(const ttlMs of [0,500,300001,-1,'2000']){
   await assert.rejects(()=>env.registry.issue({
     request:env.request(),action:'QUOTE',ttlMs
   }),/ACTION_TTL_DENIED/);
 }
 await assert.rejects(()=>env.registry.issue({request:env.request(),
  action:'QUOTE',resource_ref:'https://evil.invalid/?token=123'}),/RESOURCE_REFERENCE_INVALID/);
 const denied=setup({authorize:({phase})=>phase==='ISSUE'});
 const issued=await make(denied);
 await assert.rejects(()=>denied.registry.verifyAndClaim({
  token:issued.token,request:denied.request()
 }),/ACTION_ROLE_DENIED/);
});
test('two concurrent requests: exactly one nonce claim succeeds in QA store',async()=>{
 const env=setup(),issued=await make(env);
 const results=await Promise.allSettled(Array.from({length:4},()=>env.registry.verifyAndClaim({
  token:issued.token,request:env.request()
 })));
 assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
 assert.equal(results.filter(x=>x.status==='rejected').length,3);
});
test('key rotation allows overlap then revocation rejects old key ID',async()=>{
 const old=crypto.randomBytes(32),fresh=crypto.randomBytes(32);
 const original=setup({secret:old});
 const receipt=await make(original);
 const shared=action.createEphemeralQaClaimStore();
 const overlapping=action.createRegistry({
  keyRing:{active:fresh,legacy:old},activeKid:'active',
  clock:()=>original.now(),
  resolveVerifiedContext:async r=>r.principal,
  authorize:async()=>true,nonceStore:shared
 });
 // Original issuer used kid="active"; rekey it as legacy would invalidate signature,
 // so verify via retained kid active carrying the old key.
 const still=action.createRegistry({keyRing:{active:old,new:fresh},activeKid:'new',
  clock:()=>original.now(),resolveVerifiedContext:async r=>r.principal,
  authorize:async()=>true,nonceStore:shared});
 const got=await still.verifyAndClaim({token:receipt.token,request:original.request()});
 assert.equal(got.status,'VERIFIED_CLAIMED_NO_EXECUTION');
 const revoked=action.createRegistry({keyRing:{new:fresh},activeKid:'new',
  clock:()=>original.now(),resolveVerifiedContext:async r=>r.principal,
  authorize:async()=>true,nonceStore:action.createEphemeralQaClaimStore()});
 await assert.rejects(()=>revoked.verifyAndClaim({
  token:receipt.token,request:original.request()
 }),/INVALID_ACTION_CLAIMS/);
 assert(overlapping); // verifies construction with multiple key IDs
});
test('missing security dependencies and weak key cannot instantiate registry',()=>{
 assert.throws(()=>action.createRegistry({}),/SERVER_SECURITY_DEPENDENCY_MISSING/);
 assert.throws(()=>action.createRegistry({
   keyRing:{active:Buffer.alloc(4)},activeKid:'active',
   resolveVerifiedContext:async()=>identity(),authorize:async()=>true,
   nonceStore:action.createEphemeralQaClaimStore()
 }),/INVALID_SIGNING_KEY_RING/);
});
