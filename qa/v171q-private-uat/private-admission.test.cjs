'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createPrivateAdmissionGate,nativeJwtVerify}=require('./private-admission.cjs');
const NOW=Date.parse('2026-11-17T08:30:00Z'),TS=Math.floor(NOW/1000);
const ISS='https://example-supabase-qa.supabase.co/auth/v1';
const SA='11111111-1111-4111-8111-111111111111',SB='22222222-2222-4222-8222-222222222222';
const XA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',XB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const rsa=crypto.generateKeyPairSync('rsa',{modulusLength:2048});
const ec=crypto.generateKeyPairSync('ec',{namedCurve:'prime256v1'});
const jwks={keys:[{...rsa.publicKey.export({format:'jwk'}),kid:'QA_RSA',alg:'RS256'},
 {...ec.publicKey.export({format:'jwk'}),kid:'QA_EC',alg:'ES256'}]};
function token(overrides={},h={}) {
 const head={alg:'RS256',typ:'JWT',kid:'QA_RSA',...h};
 const body={iss:ISS,aud:'authenticated',role:'authenticated',sub:SA,session_id:XA,
   iat:TS-20,nbf:TS-20,exp:TS+300,...overrides};
 const p1=Buffer.from(JSON.stringify(head)).toString('base64url');
 const p2=Buffer.from(JSON.stringify(body)).toString('base64url');
 const sig=crypto.sign('sha256',Buffer.from(p1+'.'+p2),rsa.privateKey).toString('base64url');
 return p1+'.'+p2+'.'+sig;
}
function tokenEc(){
 const h=Buffer.from(JSON.stringify({alg:'ES256',typ:'JWT',kid:'QA_EC'})).toString('base64url');
 const p=Buffer.from(JSON.stringify({iss:ISS,aud:'authenticated',role:'authenticated',
  sub:SA,session_id:XA,iat:TS-20,exp:TS+300})).toString('base64url');
 const sig=crypto.sign('sha256',Buffer.from(h+'.'+p),{key:ec.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url');
 return h+'.'+p+'.'+sig;
}
function meta(page='QA_PAGE_A',sender='QA_SENDER_A',id='QA_MSG_A',timestamp=NOW,echo=false){
 return Buffer.from(JSON.stringify({object:'page',entry:[{id:page,messaging:[{
   sender:{id:sender},recipient:{id:page},timestamp,
   message:{mid:id,text:'CATALOG',...(echo?{is_echo:true}:{})}
 }]}]}));
}
function zalo(oa='QA_OA_A',sender='QA_SENDER_A',id='QA_MSG_ZA',timestamp=NOW,appId='QA_APP'){
 return Buffer.from(JSON.stringify({app_id:appId,recipient:{id:oa},sender:{id:sender},
  event_name:'user_send_text',message:{msg_id:id,text:'CATALOG'},timestamp:String(timestamp)}));
}
const SECRET_META='TEST_ONLY_META_SECRET_NONPRODUCTION_ONLY_123';
const SECRET_ZALO='TEST_ONLY_ZALO_SECRET_NONPRODUCTION_ONLY_123';
const metaSig=(raw,secret=SECRET_META)=>'sha256='+crypto.createHmac('sha256',secret).update(raw).digest('hex');
const zaloSig=(raw,secret=SECRET_ZALO)=>{
 const p=JSON.parse(raw.toString());return 'mac='+crypto.createHash('sha256')
  .update(p.app_id+raw.toString()+p.timestamp+secret).digest('hex');
};
function ctx(changes={}){
 const used=new Set();
 const owner={
  [SA]:{ownerUserId:SA,tenantId:'QA_SAME_TENANT',storeId:'STORE_A',active:true,role:'owner',ownerProof:'PRIVATE_OWNER_VERIFIED'},
  [SB]:{ownerUserId:SB,tenantId:'QA_SAME_TENANT',storeId:'STORE_B',active:true,role:'owner',ownerProof:'PRIVATE_OWNER_VERIFIED'}};
 const sessions={
  [SA]:{subject:SA,sessionId:XA,active:true},[SB]:{subject:SB,sessionId:XB,active:true}};
 const installs={
  'MESSENGER:QA_PAGE_A':{installationId:'META_A',channel:'MESSENGER',tenantId:'QA_SAME_TENANT',storeId:'STORE_A',destinationId:'QA_PAGE_A',active:true,ownerProof:'PRIVATE_OWNER_VERIFIED'},
  'MESSENGER:QA_PAGE_B':{installationId:'META_B',channel:'MESSENGER',tenantId:'QA_SAME_TENANT',storeId:'STORE_B',destinationId:'QA_PAGE_B',active:true,ownerProof:'PRIVATE_OWNER_VERIFIED'},
  'ZALO:QA_OA_A':{installationId:'ZALO_A',channel:'ZALO',tenantId:'QA_SAME_TENANT',storeId:'STORE_A',destinationId:'QA_OA_A',appId:'QA_APP',active:true,ownerProof:'PRIVATE_OWNER_VERIFIED'},
  'ZALO:QA_OA_B':{installationId:'ZALO_B',channel:'ZALO',tenantId:'QA_SAME_TENANT',storeId:'STORE_B',destinationId:'QA_OA_B',appId:'QA_APP',active:true,ownerProof:'PRIVATE_OWNER_VERIFIED'}};
 const grants={
  'STORE_A:ORDER_A':{valid:true,tenantId:'QA_SAME_TENANT',storeId:'STORE_A',senderId:'QA_SENDER_A',orderId:'ORDER_A',channel:'MESSENGER',challengeStatus:'INDEPENDENT_HUMAN_VERIFIED'}};
 const config={jwks,issuer:ISS,clock:()=>NOW,
  lookupSession:async({subject,sessionId})=>sessions[subject]?.sessionId===sessionId?sessions[subject]:null,
  lookupOwnerStore:async({subject})=>owner[subject]||null,
  lookupInstallation:async({channel,destinationId})=>installs[channel+':'+destinationId]||null,
  getProviderSecret:async({channel})=>channel==='MESSENGER'?SECRET_META:SECRET_ZALO,
  reserveReplayOnce:async({key})=>{if(used.has(key))return false;used.add(key);return true;},
  lookupCustomerOrderGrant:async({storeId,orderId})=>grants[storeId+':'+orderId]||null,
  ...changes};
 return {gate:createPrivateAdmissionGate(config),sessions,owner,installs,grants};
}
const auth=(c=ctx(),t=token(),store='STORE_A')=>c.gate.admitOwnerJwt({token:t,targetStoreId:store});
const admitMeta=(c=ctx(),b=meta(),sig=metaSig(b))=>c.gate.admitProviderEvent({channel:'MESSENGER',rawBody:b,signature:sig});
const admitZalo=(c=ctx(),b=zalo(),sig=zaloSig(b))=>c.gate.admitProviderEvent({channel:'ZALO',rawBody:b,signature:sig});
async function denied(p,reason){const v=await p;assert.equal(v.ok,false);if(reason)assert.equal(v.reason,reason);}
test('01 source authenticates cryptographically signed synthetic RSA JWT',()=>assert.equal(nativeJwtVerify(token(),jwks,ISS,'authenticated',TS).ok,true));
test('02 source authenticates cryptographically signed synthetic ES256 JWT',()=>assert.equal(nativeJwtVerify(tokenEc(),jwks,ISS,'authenticated',TS).ok,true));
test('03 owner A and owner B synthetic valid JWTs have same fake Tenant and distinct Stores',async()=>{
 const c=ctx(),a=await auth(c),b=await auth(c,token({sub:SB,session_id:XB}),'STORE_B');
 assert.equal(a.ok,true);assert.equal(b.ok,true);
 assert.equal(a.receipt.tenantId,b.receipt.tenantId);assert.notEqual(a.receipt.storeId,b.receipt.storeId);
});
test('04 user_metadata spoofed Store cannot change backend owner binding',async()=>{
 const r=await auth(ctx(),token({raw_user_meta_data:{storeId:'STORE_B'}}));
 assert.equal(r.ok,true);assert.equal(r.receipt.storeId,'STORE_A');
});
test('05 owner A JWT cannot claim Store B',async()=>{await denied(auth(ctx(),token(),'STORE_B'),'OWNER_STORE_DENIED');});
test('06 owner B JWT cannot claim Store A',async()=>{await denied(auth(ctx(),token({sub:SB,session_id:XB}),'STORE_A'),'OWNER_STORE_DENIED');});
test('07 revoked session blocks otherwise valid signed JWT',async()=>{
 const c=ctx();c.sessions[SA].active=false;await denied(auth(c),'JWT_SESSION_NOT_ACTIVE');
});
test('08 inactive owner binding blocks otherwise valid signed JWT',async()=>{
 const c=ctx();c.owner[SA].active=false;await denied(auth(c),'OWNER_STORE_DENIED');
});
test('09 owner proof cannot be client self-attested',async()=>{
 const c=ctx();c.owner[SA].ownerProof='SELF_DECLARED';await denied(auth(c),'OWNER_STORE_DENIED');
});
test('10 unauthenticated manager cannot claim owner admission',async()=>{
 const c=ctx();c.owner[SA].role='manager';await denied(auth(c),'OWNER_STORE_DENIED');
});
for(const [label,claims,reason] of [
 ['wrong issuer',{iss:'https://evil.example'},'JWT_SUBJECT'],
 ['wrong audience',{aud:'anon'},'JWT_SUBJECT'],
 ['service role',{role:'service_role'},'JWT_SUBJECT'],
 ['missing subject',{sub:''},'JWT_SUBJECT'],
 ['missing session',{session_id:''},'JWT_SUBJECT'],
 ['expired',{exp:TS-80},'JWT_TIME'],
 ['future not before',{nbf:TS+300},'JWT_TIME'],
 ['future issued',{iat:TS+300,exp:TS+500},'JWT_TIME'],
 ['long life',{exp:TS+4000},'JWT_TIME']
])test('JWT denial: '+label,async()=>{await denied(auth(ctx(),token(claims)),reason);});
for(const [label,header,reason] of [
 ['alg none',{alg:'none'},'JWT_HEADER'],
 ['jku remote',{jku:'https://attacker.example/jwks'},'JWT_HEADER'],
 ['unknown kid',{kid:'UNKNOWN'},'JWT_KEY'],
 ['critical b64',{crit:['b64']},'JWT_HEADER']
])test('JWT header denial: '+label,async()=>{await denied(auth(ctx(),token({},header)),reason);});
test('20 forged JWT payload does not reuse original signature',async()=>{
 const p=token().split('.');p[1]=Buffer.from('{"sub":"attacker"}').toString('base64url');
 await denied(auth(ctx(),p.join('.')),'JWT_SIGNATURE');
});
test('21 bad JWT signature is denied',async()=>{
 const p=token().split('.');p[2]=(p[2][0]==='A'?'B':'A')+p[2].slice(1);
 await denied(auth(ctx(),p.join('.')),'JWT_SIGNATURE');
});
test('22 actual fake Meta webhook HMAC over raw bytes passes',async()=>{
 const r=await admitMeta();assert.equal(r.ok,true);assert.equal(r.receipt.storeId,'STORE_A');
});
test('23 actual fake Zalo webhook SHA256 over raw bytes passes',async()=>{
 const r=await admitZalo();assert.equal(r.ok,true);assert.equal(r.receipt.storeId,'STORE_A');
});
test('24 owner-approved Meta Page B maps trusted Store B',async()=>{
 const b=meta('QA_PAGE_B','QA_SENDER_B','MSG_B'),r=await admitMeta(ctx(),b);
 assert.equal(r.ok,true);assert.equal(r.receipt.storeId,'STORE_B');
});
test('25 owner-approved Zalo OA B maps trusted Store B',async()=>{
 const b=zalo('QA_OA_B','QA_SENDER_B','MSG_B'),r=await admitZalo(ctx(),b);
 assert.equal(r.ok,true);assert.equal(r.receipt.storeId,'STORE_B');
});
test('26 tampered Meta payload invalidates raw HMAC',async()=>{
 const b=meta(),sig=metaSig(b);
 await denied(admitMeta(ctx(),Buffer.from(b.toString().replace('CATALOG','ORDER')),sig),'PROVIDER_SIGNATURE');
});
test('27 tampered Zalo payload invalidates raw SHA256',async()=>{
 const b=zalo(),sig=zaloSig(b);
 await denied(admitZalo(ctx(),Buffer.from(b.toString().replace('CATALOG','ORDER')),sig),'PROVIDER_SIGNATURE');
});
test('28 Meta wrong secret fails constant-time digest check',async()=>{
 const b=meta();await denied(admitMeta(ctx(),b,metaSig(b,'ATTACKER_WRONG_META_SECRET_123456')),'PROVIDER_SIGNATURE');
});
test('29 Zalo wrong secret fails constant-time digest check',async()=>{
 const b=zalo();await denied(admitZalo(ctx(),b,zaloSig(b,'ATTACKER_WRONG_ZALO_SECRET_123456')),'PROVIDER_SIGNATURE');
});
test('30 Meta cannot be authenticated by Zalo header',async()=>{
 const b=meta();await denied(admitMeta(ctx(),b,'mac='+metaSig(b).slice(7)),'PROVIDER_SIGNATURE');
});
test('31 Zalo cannot be authenticated by Meta header',async()=>{
 const b=zalo();await denied(admitZalo(ctx(),b,'sha256='+zaloSig(b).slice(4)),'PROVIDER_SIGNATURE');
});
test('32 Meta reserialize changes signed original body',async()=>{
 const b=meta(),sig=metaSig(b),r=Buffer.from(JSON.stringify(JSON.parse(b.toString()),null,2));
 await denied(admitMeta(ctx(),r,sig),'PROVIDER_SIGNATURE');
});
test('33 Zalo reserialize changes signed original body',async()=>{
 const b=zalo(),sig=zaloSig(b),r=Buffer.from(JSON.stringify(JSON.parse(b.toString()),null,2));
 await denied(admitZalo(ctx(),r,sig),'PROVIDER_SIGNATURE');
});
test('34 foreign Meta Page has no owner registry',async()=>{
 const b=meta('FOREIGN_PAGE');await denied(admitMeta(ctx(),b,metaSig(b)),'INSTALLATION_OWNER_NOT_VERIFIED');
});
test('35 foreign Zalo OA has no owner registry',async()=>{
 const b=zalo('FOREIGN_OA');await denied(admitZalo(ctx(),b,zaloSig(b)),'INSTALLATION_OWNER_NOT_VERIFIED');
});
test('36 echoed Meta message cannot pass customer ingress',async()=>{
 const b=meta('QA_PAGE_A','QA_SENDER_A','QA_MSG_A',NOW,true);
 await denied(admitMeta(ctx(),b,metaSig(b)),'META_ENVELOPE');
});
test('37 Meta signed event is blocked after 5-minute TTL',async()=>{
 const b=meta('QA_PAGE_A','QA_SENDER_A','QA_MSG_A',NOW-300001);
 await denied(admitMeta(ctx(),b,metaSig(b)),'EVENT_TIME_OR_ID');
});
test('38 Zalo signed event is blocked after 5-minute TTL',async()=>{
 const b=zalo('QA_OA_A','QA_SENDER_A','QA_MSG_ZA',NOW+300001);
 await denied(admitZalo(ctx(),b,zaloSig(b)),'EVENT_TIME_OR_ID');
});
test('39 duplicate Meta event blocked by atomic replay callback',async()=>{
 const c=ctx();assert.equal((await admitMeta(c)).ok,true);
 await denied(admitMeta(c),'REPLAY_OR_RATE_GATE');
});
test('40 duplicate Zalo event blocked by atomic replay callback',async()=>{
 const c=ctx();assert.equal((await admitZalo(c)).ok,true);
 await denied(admitZalo(c),'REPLAY_OR_RATE_GATE');
});
test('41 unavailable atomic replay callback denies event',async()=>{
 await denied(admitMeta(ctx({reserveReplayOnce:async()=>{throw Error('DOWN');}})),'REPLAY_SERVICE_UNAVAILABLE');
});
test('42 replay callback truthy string must not admit',async()=>{
 await denied(admitZalo(ctx({reserveReplayOnce:async()=> 'true'})),'REPLAY_OR_RATE_GATE');
});
test('43 managed secret missing denies',async()=>{
 await denied(admitMeta(ctx({getProviderSecret:async()=>null})),'PROVIDER_SECRET_UNAVAILABLE');
});
test('44 weak managed secret denies',async()=>{
 await denied(admitMeta(ctx({getProviderSecret:async()=> 'weak'})),'PROVIDER_SECRET_UNAVAILABLE');
});
test('45 provider installation awaiting owner proof denies',async()=>{
 const c=ctx();c.installs['MESSENGER:QA_PAGE_A'].ownerProof='PENDING';
 await denied(admitMeta(c),'INSTALLATION_OWNER_NOT_VERIFIED');
});
test('46 disabled OA installation denies even signed payload',async()=>{
 const c=ctx();c.installs['ZALO:QA_OA_A'].active=false;
 await denied(admitZalo(c),'INSTALLATION_OWNER_NOT_VERIFIED');
});
test('47 invalid raw JSON object instead of raw Buffer denied',async()=>{
 const b=meta();await denied(admitMeta(ctx(),JSON.parse(b.toString()),metaSig(b)),'BODY');
});
test('48 provider receipt cannot be forged by raw object',()=>{
 const c=ctx();assert.equal(c.gate.planCatalogRead({receipt:{kind:'SIGNED_PROVIDER_EVENT',storeId:'STORE_A'},sku:'SKU_A'}).ok,false);
});
test('49 provider receipt cannot be reused in another gate instance',async()=>{
 const a=ctx(),b=ctx(),r=await admitMeta(a);
 assert.equal(b.gate.planCatalogRead({receipt:r.receipt,sku:'SKU_A'}).ok,false);
});
test('50 valid provider receipt only plans read, cannot call DB or Send',async()=>{
 const c=ctx(),r=await admitMeta(c);
 const p=c.gate.planCatalogRead({receipt:r.receipt,sku:'SKU_A'});
 assert.equal(p.ok,true);assert.equal(p.plan.dbExecuted,false);assert.equal(p.plan.sendEnabled,false);
});
test('51 URL masquerading as SKU is blocked',async()=>{
 const c=ctx(),r=await admitMeta(c);
 assert.equal(c.gate.planCatalogRead({receipt:r.receipt,sku:'http://169.254.169.254'}).ok,false);
});
test('52 valid same customer order grant creates NO-SEND plan only',async()=>{
 const c=ctx(),r=await admitMeta(c);
 const p=await c.gate.planOwnOrderRead({receipt:r.receipt,orderId:'ORDER_A'});
 assert.equal(p.ok,true);assert.equal(p.plan.dbExecuted,false);
});
test('53 Store A cannot read Store B order',async()=>{
 const c=ctx(),r=await admitMeta(c);
 await denied(c.gate.planOwnOrderRead({receipt:r.receipt,orderId:'ORDER_B'}),'ORDER_GRANT_DENIED');
});
test('54 an owner JWT cannot be used as an order customer grant',async()=>{
 const c=ctx(),r=await auth(c);
 await denied(c.gate.planOwnOrderRead({receipt:r.receipt,orderId:'ORDER_A'}),'NO_NATIVE_SIGNED_RECEIPT');
});
test('55 unverified human order challenge denies',async()=>{
 const c=ctx();c.grants['STORE_A:ORDER_A'].challengeStatus='PENDING';
 const r=await admitMeta(c);await denied(c.gate.planOwnOrderRead({receipt:r.receipt,orderId:'ORDER_A'}),'ORDER_GRANT_DENIED');
});
test('56 owner A and signed Page A produce only an opaque NO-SEND canary plan',async()=>{
 const c=ctx(),o=await auth(c),p=await admitMeta(c);
 const r=c.gate.planPrivateCanaryBinding({ownerReceipt:o.receipt,providerReceipt:p.receipt});
 assert.equal(r.ok,true);assert.equal(r.plan.mutationsEnabled,false);
 assert.equal(r.plan.providerSendEnabled,false);
});
test('57 owner A cannot bind signed Page B even with two valid signatures',async()=>{
 const c=ctx(),o=await auth(c),b=meta('QA_PAGE_B','QA_SENDER_B','QA_MSG_B'),p=await admitMeta(c,b);
 await denied(Promise.resolve(c.gate.planPrivateCanaryBinding({ownerReceipt:o.receipt,providerReceipt:p.receipt})),'OWNER_PROVIDER_DIFFERENT_STORE');
});
test('58 owner A cannot bind signed OA B',async()=>{
 const c=ctx(),o=await auth(c),b=zalo('QA_OA_B','QA_SENDER_B','QA_MSG_B'),p=await admitZalo(c,b);
 await denied(Promise.resolve(c.gate.planPrivateCanaryBinding({ownerReceipt:o.receipt,providerReceipt:p.receipt})),'OWNER_PROVIDER_DIFFERENT_STORE');
});
test('59 forged owner receipt cannot bind even signed provider event',async()=>{
 const c=ctx(),p=await admitMeta(c);
 await denied(Promise.resolve(c.gate.planPrivateCanaryBinding({ownerReceipt:{tenantId:'QA_SAME_TENANT',storeId:'STORE_A'},providerReceipt:p.receipt})),'UNVERIFIED_PRIVATE_CANARY_RECEIPT');
});
test('60 forged provider receipt cannot bind valid owner JWT',async()=>{
 const c=ctx(),o=await auth(c);
 await denied(Promise.resolve(c.gate.planPrivateCanaryBinding({ownerReceipt:o.receipt,providerReceipt:{tenantId:'QA_SAME_TENANT',storeId:'STORE_A'}})),'UNVERIFIED_PRIVATE_CANARY_RECEIPT');
});
test('61 receipts have no subject/session/customer ID or raw event ID',async()=>{
 const c=ctx(),o=await auth(c),p=await admitMeta(c),s=JSON.stringify({owner:o.receipt,provider:p.receipt});
 for(const secret of [SA,XA,'QA_SENDER_A','QA_MSG_A',SECRET_META])assert.equal(s.includes(secret),false);
});
test('62 production provisioned secrets are not part of source adapter',()=>{
 assert.match(ISS,/example-supabase-qa/);
 assert.equal(typeof process.env.T404_REAL_META_APP_SECRET,'undefined');
});
