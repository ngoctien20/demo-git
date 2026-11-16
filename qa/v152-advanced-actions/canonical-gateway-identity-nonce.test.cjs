'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const identityModule=require('./verified-identity-connector.cjs');
const pgStore=require('./pg-nonce-store.cjs');
const gatewayModule=require('./canonical-action-gateway.cjs');

const NOW=Date.UTC(2026,10,16,3,30,0);
const ISSUER='https://ifxlvrhyjhbzbrkdsida.supabase.co/auth/v1';
const pair=crypto.generateKeyPairSync('ed25519');
const webhookKey=crypto.randomBytes(32);
const signPart=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
const mint=(override={})=>{
  const claims={
    iss:ISSUER,aud:'authenticated',role:'authenticated',
    sub:'qa-user-a',session_id:'qa-session-a',exp:Math.floor(NOW/1000)+600,
    is_anonymous:false,...override
  };
  const prefix=signPart({alg:'EdDSA',typ:'JWT',kid:'qa-test-only'})+'.'+signPart(claims);
  return prefix+'.'+crypto.sign(null,Buffer.from(prefix),pair.privateKey).toString('base64url');
};
function verifyQaJwt(token){
 const parts=token.split('.');
 if(parts.length!==3)throw Error('BAD_JWT');
 const head=JSON.parse(Buffer.from(parts[0],'base64url').toString('utf8'));
 if(head.alg!=='EdDSA'||head.kid!=='qa-test-only')throw Error('JWT_ALG_DENIED');
 const valid=crypto.verify(null,Buffer.from(parts[0]+'.'+parts[1]),pair.publicKey,
   Buffer.from(parts[2],'base64url'));
 if(!valid)throw Error('BAD_JWT_SIGNATURE');
 return JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8'));
}
const OWNER_TARGET={tenant_id:'qa_tenant_1',store_id:'qa_shop_a',channel:'MESSENGER'};
const ownerRequest=(token=mint(),target=OWNER_TARGET)=>({mode:'OWNER_JWT',accessToken:token,target});
const makeWebhook=(event={})=>{
 const payload={channel:'ZALO_BOT',account_id:'qa-account-A',sender:'synthetic-customer-a',
   event_id:'evt-1',occurred_at_ms:NOW,...event};
 const rawBody=Buffer.from(JSON.stringify(payload),'utf8');
 return {mode:'CHANNEL_WEBHOOK',channel:payload.channel,rawBody,
   headers:{'x-qa-signature':crypto.createHmac('sha256',webhookKey).update(rawBody).digest('hex')}};
};
function verifyQaWebhook({rawBody,headers,channel}){
 const expected=crypto.createHmac('sha256',webhookKey).update(rawBody).digest('hex');
 const received=headers['x-qa-signature'];
 if(typeof received!=='string'||!/^[a-f0-9]{64}$/.test(received)||
  !crypto.timingSafeEqual(Buffer.from(expected,'hex'),Buffer.from(received,'hex')))
  throw Error('UNTRUSTED_WEBHOOK_SIGNATURE');
 const v=JSON.parse(rawBody.toString('utf8'));
 return {channel,account_id:v.account_id,event_id:v.event_id,
   subject_hash:crypto.createHash('sha256').update('qa-only-pepper:'+v.sender).digest('hex'),
   occurred_at_ms:v.occurred_at_ms};
}
function fixture(){
 let now=NOW,sessionActive=true,membershipActive=true,consentActive=true,channelActive=true;
 const memberships=new Map([
  ['qa-user-a|qa_tenant_1|qa_shop_a',{user_id:'qa-user-a',
    tenant_id:'qa_tenant_1',store_id:'qa_shop_a',role:'owner',status:'active'}],
  ['qa-user-b|qa_tenant_1|qa_shop_b',{user_id:'qa-user-b',
    tenant_id:'qa_tenant_1',store_id:'qa_shop_b',role:'owner',status:'active'}]
 ]);
 const activeMembership=({user_id,tenant_id,store_id})=>{
   const row=memberships.get(user_id+'|'+tenant_id+'|'+store_id);
   return row&&membershipActive?{...row}:null;
 };
 const connector=identityModule.createIdentityConnector({
  verifyJwt:async jwt=>verifyQaJwt(jwt),
  lookupActiveSession:async ({user_id,session_id})=>sessionActive&&
    user_id==='qa-user-a'&&session_id==='qa-session-a',
  lookupStoreMembership:async x=>activeMembership(x),
  verifyWebhook:async x=>verifyQaWebhook(x),
  lookupChannelBinding:async ({channel,account_id})=>
    channel==='ZALO_BOT'&&account_id==='qa-account-A'&&channelActive?
      {channel,account_id,tenant_id:'qa_tenant_1',store_id:'qa_shop_a',
       status:'active',merchant_consent:true}:null,
  lookupConsent:async ({tenant_id,store_id,channel,subject_hash})=>
    consentActive?{tenant_id,store_id,channel,subject_hash,consent:true}:null,
  recheckConsent:async ({tenant_id,store_id,channel,subject_hash})=>
    consentActive&&tenant_id==='qa_tenant_1'&&store_id==='qa_shop_a'&&
      channel==='ZALO_BOT'&&/^[a-f0-9]{64}$/.test(subject_hash),
  expectedIssuer:ISSUER,expectedAudience:'authenticated',clock:()=>now
 });
 return {connector,getNow:()=>now,setNow:t=>{now=t},
   setSession:x=>{sessionActive=x},setMembership:x=>{membershipActive=x},
   setConsent:x=>{consentActive=x},setChannel:x=>{channelActive=x}};
}
function fakePgShared(){
 const used=new Set();let queries=0;
 const query=async (sql,values)=>{
  queries++;
  assert.equal(sql,pgStore.CLAIM_SQL);
  assert.match(sql,/ON CONFLICT \(nonce_key_hash\) DO NOTHING/);
  assert.match(sql,/RETURNING nonce_key_hash/);
  assert.match(sql,/clock_timestamp\(\)/);
  assert.deepEqual(Object.keys(values),['0','1']);
  const key=values[0];
  if(used.has(key))return{rowCount:0,rows:[]};
  used.add(key);
  return{rowCount:1,rows:[{nonce_key_hash:Buffer.from(key,'hex')}]};
 };
 return {query,getCalls:()=>queries,used};
}

test('Owner JWT verified cryptographically and from current active membership',async()=>{
 const f=fixture();
 const principal=await f.connector.resolveVerifiedContext(ownerRequest());
 assert.equal(principal.tenant_id,'qa_tenant_1');
 assert.equal(principal.store_id,'qa_shop_a');
 assert.equal(principal.channel,'MESSENGER');
 assert.equal(principal.subject_id,'owner:qa-user-a');
 assert.match(principal.recipient_binding,/^[a-f0-9]{64}$/);
 assert(!JSON.stringify(principal).includes('qa-session-a'));
 assert.equal(await f.connector.authorize({phase:'ISSUE',principal,
    action:'QUOTE',resource_ref:'qa:A001'}),true);
});
test('JWT payload edit, browser-asserted flags and wrong issuer fail closed',async()=>{
 const f=fixture();
 const signed=mint(),parts=signed.split('.');
 const edited=JSON.parse(Buffer.from(parts[1],'base64url').toString());
 edited.sub='qa-user-b';
 const forged=parts[0]+'.'+signPart(edited)+'.'+parts[2];
 await assert.rejects(()=>f.connector.resolveVerifiedContext(ownerRequest(forged)),/BAD_JWT_SIGNATURE/);
 await assert.rejects(()=>f.connector.resolveVerifiedContext({...ownerRequest(),verified:true}),/OWNER_JWT_REQUEST_INVALID/);
 await assert.rejects(()=>f.connector.resolveVerifiedContext(ownerRequest(mint({iss:'https://evil.invalid'}))),/JWT_CLAIMS_DENIED/);
});
test('Owner cannot access Shop B even within same tenant',async()=>{
 const f=fixture();
 await assert.rejects(()=>f.connector.resolveVerifiedContext(ownerRequest(mint(),{
   ...OWNER_TARGET,store_id:'qa_shop_b'
 })),/STORE_OWNER_MEMBERSHIP_NOT_VERIFIED/);
 await assert.rejects(()=>f.connector.resolveVerifiedContext(ownerRequest(mint(),{
   ...OWNER_TARGET,tenant_id:'qa_tenant_2'
 })),/STORE_OWNER_MEMBERSHIP_NOT_VERIFIED/);
});
test('anonymous, expired, or user_metadata-based owner spoof rejected',async()=>{
 const f=fixture();
 for(const altered of [
   {is_anonymous:true},{role:'service_role'}, {exp:Math.floor(NOW/1000)-1},
   {sub:'qa-user-unknown',user_metadata:{role:'owner'}}
 ]){
  await assert.rejects(()=>f.connector.resolveVerifiedContext(ownerRequest(mint(altered))));
 }
});
test('revoke session or store membership before action blocks',async()=>{
 const f=fixture();
 f.setSession(false);
 await assert.rejects(()=>f.connector.resolveVerifiedContext(ownerRequest()),/SESSION_INACTIVE/);
 f.setSession(true);
 const principal=await f.connector.resolveVerifiedContext(ownerRequest());
 f.setMembership(false);
 assert.equal(await f.connector.authorize({phase:'CONSUME',principal,action:'QUOTE'}),false);
 await assert.rejects(()=>f.connector.resolveVerifiedContext(ownerRequest()),/STORE_OWNER_MEMBERSHIP_NOT_VERIFIED/);
});
test('Channel webhook only works with verified raw bytes and authorized mapping and consent',async()=>{
 const f=fixture();
 const result=await f.connector.resolveVerifiedContext(makeWebhook());
 assert.equal(result.channel,'ZALO_BOT');
 assert.equal(result.store_id,'qa_shop_a');
 assert.match(result.subject_id,/^channel:[a-f0-9]{64}$/);
 assert.equal(await f.connector.authorize({phase:'CONSUME',principal:result,action:'CATALOG'}),true);
});
test('forged provider signature, fake flags and channel ownership failures rejected',async()=>{
 const f=fixture();
 const invalid=makeWebhook();invalid.headers['x-qa-signature']='0'.repeat(64);
 await assert.rejects(()=>f.connector.resolveVerifiedContext(invalid),/UNTRUSTED_WEBHOOK_SIGNATURE/);
 await assert.rejects(()=>f.connector.resolveVerifiedContext({...makeWebhook(),providerVerified:true}),/WEBHOOK_ENVELOPE_INVALID/);
 f.setChannel(false);
 await assert.rejects(()=>f.connector.resolveVerifiedContext(makeWebhook()),/CHANNEL_OWNERSHIP_NOT_VERIFIED/);
});
test('withdrawn channel customer consent blocks issue and consume',async()=>{
 const f=fixture();
 const verified=await f.connector.resolveVerifiedContext(makeWebhook());
 f.setConsent(false);
 assert.equal(await f.connector.authorize({phase:'CONSUME',principal:verified,action:'QUOTE'}),false);
 await assert.rejects(()=>f.connector.resolveVerifiedContext(makeWebhook()),/CUSTOMER_CONSENT_REQUIRED/);
});
test('replayed stale event and wrong account cannot assert provider identity',async()=>{
 const f=fixture();
 await assert.rejects(()=>f.connector.resolveVerifiedContext(makeWebhook({
   occurred_at_ms:NOW-600000
 })),/VERIFIED_PROVIDER_EVENT_REQUIRED/);
 await assert.rejects(()=>f.connector.resolveVerifiedContext(makeWebhook({
   account_id:'qa-other-account'
 })),/CHANNEL_OWNERSHIP_NOT_VERIFIED/);
});
test('Pg nonce adapter requires 64-char SHA256, parameterized query, no fallback',async()=>{
 const f=fakePgShared();
 const store=pgStore.createPgNonceStore({query:f.query,clock:()=>NOW});
 const key='a'.repeat(64);
 assert.equal(await store.claimOnce(key,NOW+300000),true);
 assert.equal(await store.claimOnce(key,NOW+300000),false);
 assert.equal(f.getCalls(),2);
 assert.equal(store.readyForProduction,false);
 await assert.rejects(()=>store.claimOnce('qa_shop_a',NOW+300000),/NONCE_CLAIM_INVALID/);
 await assert.rejects(()=>store.claimOnce('b'.repeat(64),NOW-1),/NONCE_RETENTION_INVALID/);
});
test('Pg DB unavailable or malformed result always fails closed',async()=>{
 const key='c'.repeat(64);
 const offline=pgStore.createPgNonceStore({query:async()=>{throw Error('PG_CONNECTION_LOST')},clock:()=>NOW});
 await assert.rejects(()=>offline.claimOnce(key,NOW+60000),/PG_CONNECTION_LOST/);
 const malformed=pgStore.createPgNonceStore({query:async()=>({rowCount:2,rows:[]}),clock:()=>NOW});
 await assert.rejects(()=>malformed.claimOnce(key,NOW+60000),/NONCE_DB_RESULT_UNTRUSTED/);
});
test('two simulated gateway instances share one mocked nonce and deny duplicate',async()=>{
 const f=fixture(),pg=fakePgShared();
 const store1=pgStore.createPgNonceStore({query:pg.query,clock:()=>NOW});
 const store2=pgStore.createPgNonceStore({query:pg.query,clock:()=>NOW});
 const opts={identity:f.connector,keyRing:{active:crypto.randomBytes(32)},activeKid:'active',
   clock:()=>NOW,mode:'SYNTHETIC_NO_SEND'};
 const first=gatewayModule.createCanonicalGateway({...opts,nonceStore:store1});
 const second=gatewayModule.createCanonicalGateway({...opts,nonceStore:store2});
 const request=ownerRequest();
 const issued=await first.issuePreview({request,action:'QUOTE',resource_ref:'qa:A001'});
 assert.equal(issued.receipt.canExecute,false);
 const result=await Promise.allSettled([
   first.verifyPreview({request,token:issued.receipt.token}),
   second.verifyPreview({request,token:issued.receipt.token})
 ]);
 assert.equal(result.filter(x=>x.status==='fulfilled').length,1);
 assert.equal(result.filter(x=>x.status==='rejected').length,1);
 assert.equal(result.find(x=>x.status==='fulfilled').value.orderCreated,false);
 assert.equal(result.find(x=>x.status==='fulfilled').value.providerSends,0);
});
test('one-time receipt cannot cross Shop, session and provider route',async()=>{
 const f=fixture(),pg=fakePgShared();
 const g=gatewayModule.createCanonicalGateway({
   identity:f.connector,nonceStore:pgStore.createPgNonceStore({query:pg.query,clock:()=>NOW}),
   keyRing:{active:crypto.randomBytes(32)},activeKid:'active',
   mode:'SYNTHETIC_NO_SEND',clock:()=>NOW
 });
 const request=ownerRequest(),issued=await g.issuePreview({request,action:'QUOTE'});
 await assert.rejects(()=>g.verifyPreview({request:ownerRequest(mint(),{
   ...OWNER_TARGET,store_id:'qa_shop_b'
 }),token:issued.receipt.token}),/STORE_OWNER_MEMBERSHIP_NOT_VERIFIED/);
 const result=await g.verifyPreview({request,token:issued.receipt.token});
 assert.equal(result.status,'VERIFIED_CLAIMED_NO_EXECUTION');
 await assert.rejects(()=>g.verifyPreview({request,token:issued.receipt.token}),/ACTION_REPLAY/);
 assert.throws(()=>g.send(),/PROVIDER_SEND_DISABLED/);
 assert.throws(()=>g.execute(),/BUSINESS_EXECUTION_DISABLED/);
 assert.throws(()=>g.publish(),/PUBLISH_APPROVAL_REQUIRED/);
});
test('no real gateway mode, unverified credential or missing dependency can start',()=>{
 assert.throws(()=>gatewayModule.createCanonicalGateway({mode:'PRODUCTION'}),/LIVE_GATEWAY/);
 assert.throws(()=>identityModule.createIdentityConnector({}),/IDENTITY_DEPENDENCIES_MISSING/);
 assert.throws(()=>pgStore.createPgNonceStore({}),/PRIVATE_PG_DB_ADAPTER_REQUIRED/);
});
