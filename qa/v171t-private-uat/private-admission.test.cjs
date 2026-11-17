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


// V17.1R - receipt lifetime, atomic one-use, JWKS key uniqueness hardening
test('V17.1R 01 duplicate JWKS kid rejects otherwise valid signed JWT',()=>{
 const ambiguous={keys:[...jwks.keys,jwks.keys[0]]};
 const r=nativeJwtVerify(token(),ambiguous,ISS,'authenticated',TS);
 assert.equal(r.ok,false);assert.equal(r.reason,'JWT_KEY_AMBIGUOUS');
});
test('V17.1R 02 verified JWT result never exposes raw claims or user metadata',()=>{
 const r=nativeJwtVerify(token({raw_user_meta_data:{phone:'PRIVATE_QA'}}),jwks,ISS,'authenticated',TS);
 assert.equal(r.ok,true);assert.equal(r.claims,undefined);
 assert.equal(JSON.stringify(r).includes('PRIVATE_QA'),false);
});
test('V17.1R 03 native signed provider receipt used once for catalog',async()=>{
 const c=ctx(),e=await admitMeta(c);
 assert.equal(c.gate.planCatalogRead({receipt:e.receipt,sku:'SKU_A'}).ok,true);
 const second=c.gate.planCatalogRead({receipt:e.receipt,sku:'SKU_A'});
 assert.equal(second.ok,false);assert.equal(second.reason,'RECEIPT_REUSED');
});
test('V17.1R 04 catalog receipt cannot be reused for customer order status',async()=>{
 const c=ctx(),e=await admitMeta(c);
 assert.equal(c.gate.planCatalogRead({receipt:e.receipt,sku:'SKU_A'}).ok,true);
 await denied(c.gate.planOwnOrderRead({receipt:e.receipt,orderId:'ORDER_A'}),'RECEIPT_REUSED');
});
test('V17.1R 05 owner/provider pair can produce only one canary plan',async()=>{
 const c=ctx(),a=await auth(c),p=await admitMeta(c);
 assert.equal(c.gate.planPrivateCanaryBinding({ownerReceipt:a.receipt,providerReceipt:p.receipt}).ok,true);
 const again=c.gate.planPrivateCanaryBinding({ownerReceipt:a.receipt,providerReceipt:p.receipt});
 assert.equal(again.ok,false);assert.equal(again.reason,'RECEIPT_REUSED');
});
test('V17.1R 06 owner JWT receipt expires after 60 seconds',async()=>{
 let clockMs=NOW;const c=ctx({clock:()=>clockMs});
 const a=await auth(c),p=await admitMeta(c);
 clockMs+=61000;
 const v=c.gate.planPrivateCanaryBinding({ownerReceipt:a.receipt,providerReceipt:p.receipt});
 assert.equal(v.ok,false);assert.equal(v.reason,'RECEIPT_EXPIRED');
});
test('V17.1R 07 signed provider receipt expires after 60 seconds',async()=>{
 let clockMs=NOW;const c=ctx({clock:()=>clockMs});
 const p=await admitMeta(c);clockMs+=61000;
 const r=c.gate.planCatalogRead({receipt:p.receipt,sku:'SKU_A'});
 assert.equal(r.ok,false);assert.equal(r.reason,'RECEIPT_EXPIRED');
});
test('V17.1R 08 expired Zalo provider receipt cannot bind owner',async()=>{
 let clockMs=NOW;const c=ctx({clock:()=>clockMs});
 const a=await auth(c),p=await admitZalo(c);clockMs+=61000;
 const r=c.gate.planPrivateCanaryBinding({ownerReceipt:a.receipt,providerReceipt:p.receipt});
 assert.equal(r.ok,false);assert.equal(r.reason,'RECEIPT_EXPIRED');
});
test('V17.1R 09 rejected malformed SKU does not consume receipt',async()=>{
 const c=ctx(),p=await admitMeta(c);
 assert.equal(c.gate.planCatalogRead({receipt:p.receipt,sku:'https://bad.example'}).ok,false);
 assert.equal(c.gate.planCatalogRead({receipt:p.receipt,sku:'SKU_A'}).ok,true);
});
test('V17.1R 10 rejected invalid order identifier does not consume receipt',async()=>{
 const c=ctx(),p=await admitMeta(c);
 await denied(c.gate.planOwnOrderRead({receipt:p.receipt,orderId:'../ORDER_A'}),'ORDER_ID');
 assert.equal((await c.gate.planOwnOrderRead({receipt:p.receipt,orderId:'ORDER_A'})).ok,true);
});
test('V17.1R 11 a denied order challenge still consumes source event',async()=>{
 const c=ctx(),p=await admitMeta(c);c.grants['STORE_A:ORDER_A'].valid=false;
 await denied(c.gate.planOwnOrderRead({receipt:p.receipt,orderId:'ORDER_A'}),'ORDER_GRANT_DENIED');
 c.grants['STORE_A:ORDER_A'].valid=true;
 await denied(c.gate.planOwnOrderRead({receipt:p.receipt,orderId:'ORDER_A'}),'RECEIPT_REUSED');
});
test('V17.1R 12 concurrent own-order plans cannot consume same receipt twice',async()=>{
 const c=ctx({lookupCustomerOrderGrant:async({storeId,orderId})=>{
  await Promise.resolve();
  return {valid:true,tenantId:'QA_SAME_TENANT',storeId,senderId:'QA_SENDER_A',
   orderId,channel:'MESSENGER',challengeStatus:'INDEPENDENT_HUMAN_VERIFIED'};
 }});
 const p=await admitMeta(c);
 const a=await Promise.all([
  c.gate.planOwnOrderRead({receipt:p.receipt,orderId:'ORDER_A'}),
  c.gate.planOwnOrderRead({receipt:p.receipt,orderId:'ORDER_A'})
 ]);
 assert.equal(a.filter(x=>x.ok).length,1);
 assert.equal(a.filter(x=>x.reason==='RECEIPT_REUSED').length,1);
});
test('V17.1R 13 failed cross-Store canary consumes both receipts',async()=>{
 const c=ctx(),a=await auth(c),p=await admitMeta(c,meta('QA_PAGE_B','QA_SENDER_B','OTHER_ID'));
 const first=c.gate.planPrivateCanaryBinding({ownerReceipt:a.receipt,providerReceipt:p.receipt});
 assert.equal(first.reason,'OWNER_PROVIDER_DIFFERENT_STORE');
 const second=c.gate.planPrivateCanaryBinding({ownerReceipt:a.receipt,providerReceipt:p.receipt});
 assert.equal(second.reason,'RECEIPT_REUSED');
});
test('V17.1R 14 two distinct native signed event receipts cannot create two reads for the same event',async()=>{
 const c=ctx(),first=await admitMeta(c);
 assert.equal(first.ok,true);
 await denied(admitMeta(c),'REPLAY_OR_RATE_GATE');
 assert.equal(c.gate.planCatalogRead({receipt:first.receipt,sku:'SKU_A'}).ok,true);
});
test('V17.1R 15 provider event receipt cannot be used after successful canary bind',async()=>{
 const c=ctx(),a=await auth(c),p=await admitMeta(c);
 assert.equal(c.gate.planPrivateCanaryBinding({ownerReceipt:a.receipt,providerReceipt:p.receipt}).ok,true);
 const cat=c.gate.planCatalogRead({receipt:p.receipt,sku:'SKU_A'});
 assert.equal(cat.reason,'RECEIPT_REUSED');
});
test('V17.1R 16 absent JWK set and no private owner authority still fail closed',async()=>{
 const r=nativeJwtVerify(token(),{keys:[]},ISS,'authenticated',TS);
 assert.equal(r.ok,false);
 const c=ctx();c.owner[SA].active=false;
 await denied(auth(c),'OWNER_STORE_DENIED');
});


// V17.1S — real UAT readiness protocol, still exclusively fake private QA keys.
async function fullPairedReceipts(c){
 const oa=await auth(c),ob=await auth(c,token({sub:SB,session_id:XB}),'STORE_B');
 const ma=await admitMeta(c,meta('QA_PAGE_A','QA_SENDER_A','EVENT_META_A'));
 const za=await admitZalo(c,zalo('QA_OA_A','QA_SENDER_A','EVENT_ZALO_A'));
 const mb=await admitMeta(c,meta('QA_PAGE_B','QA_SENDER_B','EVENT_META_B'));
 const zb=await admitZalo(c,zalo('QA_OA_B','QA_SENDER_B','EVENT_ZALO_B'));
 for(const r of [oa,ob,ma,za,mb,zb])assert.equal(r.ok,true);
 return {owners:[oa.receipt,ob.receipt],events:[ma.receipt,za.receipt,mb.receipt,zb.receipt]};
}
test('V17.1S 01 two distinct crypto-verified fake owners and 4 native signed events form NO-SEND plan',async()=>{
 const c=ctx(),x=await fullPairedReceipts(c),r=await c.gate.planDualStoreNativeNoSendUat(x);
 assert.equal(r.ok,true);
 assert.equal(r.plan.kind,'DUAL_STORE_META_ZALO_PRIVATE_NO_SEND_UAT_SOURCE_PLAN');
 assert.equal(r.plan.privateAuthorityFreshlyRechecked,true);
 assert.deepEqual([...r.plan.stores],['STORE_A','STORE_B']);
 assert.equal(r.plan.providerMessagesSent,0);
 assert.equal(r.plan.productionReleaseApproved,false);
 assert.equal(r.plan.hostedJwtAttested,false);
 assert.equal(r.plan.nativeProviderOwnerCanaryIndependentlyAttested,false);
});
test('V17.1S 02 revoked owner A session after signed JWT issuance is denied at commit',async()=>{
 const c=ctx(),x=await fullPairedReceipts(c);c.sessions[SA].active=false;
 await denied(c.gate.planDualStoreNativeNoSendUat(x),'UAT_SESSION_REVOKED_AT_COMMIT');
});
test('V17.1S 03 revoked owner B session after signed JWT issuance is denied at commit',async()=>{
 const c=ctx(),x=await fullPairedReceipts(c);c.sessions[SB].active=false;
 await denied(c.gate.planDualStoreNativeNoSendUat(x),'UAT_SESSION_REVOKED_AT_COMMIT');
});
test('V17.1S 04 owner A demoted after signed JWT issuance is denied',async()=>{
 const c=ctx(),x=await fullPairedReceipts(c);c.owner[SA].role='viewer';
 await denied(c.gate.planDualStoreNativeNoSendUat(x),'UAT_OWNER_REVOKED_AT_COMMIT');
});
test('V17.1S 05 owner B Store reassigned after issuance is denied',async()=>{
 const c=ctx(),x=await fullPairedReceipts(c);c.owner[SB].storeId='STORE_A';
 await denied(c.gate.planDualStoreNativeNoSendUat(x),'UAT_OWNER_REVOKED_AT_COMMIT');
});
test('V17.1S 06 owner B moved to another Tenant after issuance is denied',async()=>{
 const c=ctx(),x=await fullPairedReceipts(c);c.owner[SB].tenantId='FOREIGN_TENANT';
 await denied(c.gate.planDualStoreNativeNoSendUat(x),'UAT_OWNER_REVOKED_AT_COMMIT');
});
test('V17.1S 07 Zalo OA B revoked after native signature is denied',async()=>{
 const c=ctx(),x=await fullPairedReceipts(c);c.installs['ZALO:QA_OA_B'].active=false;
 await denied(c.gate.planDualStoreNativeNoSendUat(x),'UAT_PROVIDER_INSTALLATION_REVOKED_AT_COMMIT');
});
test('V17.1S 08 Meta Page A owner proof revoked after signature is denied',async()=>{
 const c=ctx(),x=await fullPairedReceipts(c);c.installs['MESSENGER:QA_PAGE_A'].ownerProof='REVOKED';
 await denied(c.gate.planDualStoreNativeNoSendUat(x),'UAT_PROVIDER_INSTALLATION_REVOKED_AT_COMMIT');
});
test('V17.1S 09 Meta Page B Tenant swapped after signature is denied',async()=>{
 const c=ctx(),x=await fullPairedReceipts(c);c.installs['MESSENGER:QA_PAGE_B'].tenantId='FOREIGN_TENANT';
 await denied(c.gate.planDualStoreNativeNoSendUat(x),'UAT_PROVIDER_INSTALLATION_REVOKED_AT_COMMIT');
});
test('V17.1S 10 duplicate provider capability is not independent signature evidence',async()=>{
 const c=ctx(),x=await fullPairedReceipts(c);x.events[3]=x.events[2];
 await denied(c.gate.planDualStoreNativeNoSendUat(x),'UAT_EVIDENCE_DUPLICATE');
});
test('V17.1S 11 duplicate owner capability cannot represent two logins',async()=>{
 const c=ctx(),x=await fullPairedReceipts(c);x.owners[1]=x.owners[0];
 await denied(c.gate.planDualStoreNativeNoSendUat(x),'UAT_EVIDENCE_DUPLICATE');
});
test('V17.1S 12 fabricated native event receipt cannot be admitted',async()=>{
 const c=ctx(),x=await fullPairedReceipts(c);
 x.events[0]={kind:'SIGNED_PROVIDER_EVENT',tenantId:'QA_SAME_TENANT',storeId:'STORE_A',channel:'MESSENGER'};
 await denied(c.gate.planDualStoreNativeNoSendUat(x),'UAT_NATIVE_EVENT_RECEIPT_MISSING');
});
test('V17.1S 13 fabricated owner JWT receipt cannot be admitted',async()=>{
 const c=ctx(),x=await fullPairedReceipts(c);
 x.owners[1]={kind:'PRIVATE_OWNER_AUTH',tenantId:'QA_SAME_TENANT',storeId:'STORE_B'};
 await denied(c.gate.planDualStoreNativeNoSendUat(x),'UAT_OWNER_JWT_RECEIPT_MISSING');
});
test('V17.1S 14 one missing native provider signature cannot form a dual-channel proof',async()=>{
 const c=ctx(),x=await fullPairedReceipts(c);x.events.pop();
 await denied(c.gate.planDualStoreNativeNoSendUat(x),'UAT_EVIDENCE_SHAPE');
});
test('V17.1S 15 two valid signed owner JWTs for SAME Store cannot qualify',async()=>{
 const c=ctx(),x=await fullPairedReceipts(c),copy=await auth(c);
 assert.equal(copy.ok,true);x.owners[1]=copy.receipt;
 await denied(c.gate.planDualStoreNativeNoSendUat(x),'UAT_TWO_DISTINCT_OWNERS_SAME_TENANT_REQUIRED');
});
test('V17.1S 16 four Meta signatures cannot substitute mandatory Zalo OA signatures',async()=>{
 const c=ctx(),x=await fullPairedReceipts(c);
 const extra=await admitMeta(c,meta('QA_PAGE_B','QA_SENDER_B','EXTRA_META_B'));
 assert.equal(extra.ok,true);x.events[3]=extra.receipt;
 await denied(c.gate.planDualStoreNativeNoSendUat(x),'UAT_BOTH_NATIVE_CHANNELS_PER_STORE_REQUIRED');
});
test('V17.1S 17 reused owner or provider receipt denies second canary UAT',async()=>{
 const c=ctx(),x=await fullPairedReceipts(c);
 const first=await c.gate.planDualStoreNativeNoSendUat(x);assert.equal(first.ok,true);
 await denied(c.gate.planDualStoreNativeNoSendUat(x),'RECEIPT_REUSED');
});
test('V17.1S 18 concurrent dual-Store UAT cannot reuse private capabilities',async()=>{
 const c=ctx(),x=await fullPairedReceipts(c);
 const answers=await Promise.all([
  c.gate.planDualStoreNativeNoSendUat(x),c.gate.planDualStoreNativeNoSendUat(x)
 ]);
 assert.equal(answers.filter(v=>v.ok).length,1);
 assert.equal(answers.filter(v=>v.reason==='RECEIPT_REUSED').length,1);
});
test('V17.1S 19 owner and event evidence expires before UAT admission',async()=>{
 let ms=NOW;const c=ctx({clock:()=>ms}),x=await fullPairedReceipts(c);
 ms+=61_000;await denied(c.gate.planDualStoreNativeNoSendUat(x),'RECEIPT_EXPIRED');
});
test('V17.1S 20 async private identity revalidation expiring receipts blocks UAT',async()=>{
 let ms=NOW;let callbackSeen=false;
 let c; c=ctx({clock:()=>ms,lookupSession:async({subject,sessionId})=>{
  if(!callbackSeen){callbackSeen=true;ms+=61_000;}
  return c.sessions[subject]?.sessionId===sessionId?c.sessions[subject]:null;
 }});
 // Clock jump must occur at the UAT COMMIT, not at JWT issuance.
 callbackSeen=true;
 const x=await fullPairedReceipts(c);callbackSeen=false;
 await denied(c.gate.planDualStoreNativeNoSendUat(x),'UAT_RECEIPT_EXPIRED_DURING_REVALIDATION');
});
test('V17.1S 21 independent owner service outage fails closed',async()=>{
 let fail=false,c;
 c=ctx({lookupOwnerStore:async({subject})=>{
  if(fail)throw new Error('OWNER_DB_DOWN');return c.owner[subject]||null;
 }});
 const x=await fullPairedReceipts(c);fail=true;
 await denied(c.gate.planDualStoreNativeNoSendUat(x),'UAT_PRIVATE_AUTHORITY_BACKEND_UNAVAILABLE');
});
test('V17.1S 22 private installation registry outage fails closed',async()=>{
 let fail=false,c;
 c=ctx({lookupInstallation:async({channel,destinationId})=>{
  if(fail)throw new Error('OA_REGISTRY_DOWN');
  return c.installs[channel+':'+destinationId]||null;
 }});
 const x=await fullPairedReceipts(c);fail=true;
 await denied(c.gate.planDualStoreNativeNoSendUat(x),'UAT_PRIVATE_AUTHORITY_BACKEND_UNAVAILABLE');
});
test('V17.1S 23 rejected dual UAT cannot resubmit same six receipts after revocation',async()=>{
 const c=ctx(),x=await fullPairedReceipts(c);c.sessions[SA].active=false;
 await denied(c.gate.planDualStoreNativeNoSendUat(x),'UAT_SESSION_REVOKED_AT_COMMIT');
 c.sessions[SA].active=true;
 await denied(c.gate.planDualStoreNativeNoSendUat(x),'RECEIPT_REUSED');
});
test('V17.1S 24 no UAT plan leaks private subject/session/provider sender/message ID',async()=>{
 const c=ctx(),x=await fullPairedReceipts(c);
 const result=await c.gate.planDualStoreNativeNoSendUat(x);
 const raw=JSON.stringify(result);
 for(const value of [SA,SB,XA,XB,'QA_SENDER_A','EVENT_META_A','EVENT_ZALO_B'])
 assert.equal(raw.includes(value),false);
 assert.equal(result.plan.providerMessagesSent,0);
});
test('V17.1S 25 real hosted Auth and Page/OA claims NEVER appear in source-only plan',async()=>{
 const c=ctx(),x=await fullPairedReceipts(c),r=await c.gate.planDualStoreNativeNoSendUat(x);
 assert.equal(r.ok,true);assert.equal(r.plan.hostedJwtAttested,false);
 assert.equal(r.plan.nativeProviderOwnerCanaryIndependentlyAttested,false);
 assert.equal(r.plan.realCommerceQueriesExecuted,false);
});


// V17.1T -- private FOUR-PARTY cryptographic operator authorization.
// All signer keys and both Auth JWT keys below are ephemeral TEST-ONLY.
// This does NOT represent approval from actual shop owners or operators.
const T_ROLES=['OPERATOR','SECURITY_REVIEWER','OWNER_STORE_A','OWNER_STORE_B'];
function operatorEnv(configOverrides={}){
 const keysets={};const signers={};const consumed=new Set();
 for(const [i,role] of T_ROLES.entries()){
  const pair=crypto.generateKeyPairSync('ed25519');
  const kid='QA_SIGNER_'+role, signerRef='QA_REF_'+String(i);
  const entry={kid,role,signerRef,active:true,
   ownerProof:'PRIVATELY_ENROLLED_SIGNER',
   publicJwk:pair.publicKey.export({format:'jwk'})};
  if(role==='OWNER_STORE_A'||role==='OWNER_STORE_B'){
   entry.ownerUserId=role==='OWNER_STORE_A'?SA:SB;
   entry.storeId=role==='OWNER_STORE_A'?'STORE_A':'STORE_B';
   entry.tenantId='QA_SAME_TENANT';
  }
  keysets[role]=pair;signers[role]=entry;
 }
 let c;
 const config={
  lookupPrivateApproverKey:async({role,kid})=>signers[role]?.kid===kid?signers[role]:null,
  reservePrivateApprovalNonceOnce:async({nonce,digest})=>{
   const k=nonce+'|'+digest;
   if(consumed.has(k))return false;
   consumed.add(k);return true;
  },...configOverrides};
 c=ctx(config);
 const intent={
  schema:'TIEN404_V171T_OPERATOR_AUTH_V1',
  scope:'PRIVATE_TWO_STORE_NO_SEND_AUTH_ADMISSION',
  projectRef:'ifxlvrhyjhbzbrkdsida',
  tenantId:'QA_SAME_TENANT',stores:['STORE_A','STORE_B'],
  commitSha:'a'.repeat(40),
  nonce:'QA_VALID_OPERATOR_NONCE_012345',
  issuedAtMs:NOW,expiresAtMs:NOW+120000,
  noSend:true,noWrite:true,noBilling:true,noCredentialChange:true
 };
 function signAll(target=intent){
  return T_ROLES.map(role=>{
   const kid=signers[role].kid;
   const msg=Buffer.from('TIEN404_V171T_PRIVATE_OPERATOR_SIGNED_APPROVAL_V1\0'+
    JSON.stringify({intent:target,role,kid}));
   const signature=crypto.sign(null,msg,keysets[role].privateKey).toString('base64url');
   return {role,kid,signature};
  });
 }
 async function pair(){
  const a=await auth(c),b=await auth(c,token({sub:SB,session_id:XB}),'STORE_B');
  assert.equal(a.ok,true);assert.equal(b.ok,true);
  return [a.receipt,b.receipt];
 }
 return {c,signers,keysets,intent,signAll,pair,consumed};
}
async function approve(env,props={}){
 const owners=props.owners||await env.pair();
 return env.c.gate.planOperatorAuthorizedTwoStoreAuth({
  owners,intent:props.intent||env.intent,approvals:props.approvals||env.signAll()
 });
}
test('T01 independent four-party Ed25519 signed no-send operator plan',async()=>{
 const e=operatorEnv(),r=await approve(e);
 assert.equal(r.ok,true);
 assert.equal(r.plan.kind,'PRIVATE_OPERATOR_TWO_OWNER_AUTH_SETUP_ONLY');
 assert.deepEqual([...r.plan.stores],['STORE_A','STORE_B']);
 assert.equal(r.plan.approvalCount,4);
 assert.equal(r.plan.allowAuthWrites,false);
 assert.equal(r.plan.allowRoleChanges,false);
 assert.equal(r.plan.allowCredentialChanges,false);
 assert.equal(r.plan.allowProviderSends,false);
 assert.equal(r.plan.allowCommerceReads,false);
 assert.equal(r.plan.allowBilling,false);
 assert.equal(r.plan.release,'HOSTED_NO_GO');
});
test('T02 source plan cannot assert actual independent hosted owner approval',async()=>{
 const e=operatorEnv(),r=await approve(e);
 assert.equal(r.ok,true);
 assert.equal(r.plan.independentHostedOwnerUatAttested,false);
 assert.equal(r.plan.nativeMetaAndZaloAttested,false);
 assert.equal(r.plan.productionReleaseApproved,false);
});
test('T03 plan never exposes JWT, token, signer key, owner sub or session id',async()=>{
 const e=operatorEnv(),r=await approve(e);const raw=JSON.stringify(r);
 assert.equal(r.ok,true);
 for(const v of [SA,SB,XA,XB,'QA_SIGNER_OPERATOR','QA_REF_0',
  e.intent.nonce,SECRET_META,SECRET_ZALO])assert.equal(raw.includes(v),false);
});
test('T04 four signed roles cannot be replaced by approved=true',async()=>{
 const e=operatorEnv(),owners=await e.pair();
 await denied(e.c.gate.planOperatorAuthorizedTwoStoreAuth({
  owners,intent:e.intent,approvals:[{approved:true},{approved:true}]
 }),'OPERATOR_APPROVAL_SHAPE');
});
test('T05 no private approver registry/config is explicitly blocked',async()=>{
 const c=ctx(),a=await auth(c),b=await auth(c,token({sub:SB,session_id:XB}),'STORE_B'),e=operatorEnv();
 await denied(c.gate.planOperatorAuthorizedTwoStoreAuth({
  owners:[a.receipt,b.receipt],intent:e.intent,approvals:e.signAll()
 }),'OPERATOR_APPROVAL_SERVICE_NOT_CONFIGURED');
});
test('T06 signed scope is limited to approved projectRef',async()=>{
 const e=operatorEnv();e.intent.projectRef='ATTACKER_PROJECT';
 await denied(approve(e),'OPERATOR_APPROVAL_SCOPE');
});
test('T07 role change cannot be authorized by a signed private setup intent',async()=>{
 const e=operatorEnv();e.intent.noWrite=false;
 await denied(approve(e),'OPERATOR_APPROVAL_SCOPE');
});
test('T08 customer send cannot be authorized by a signed setup intent',async()=>{
 const e=operatorEnv();e.intent.noSend=false;
 await denied(approve(e),'OPERATOR_APPROVAL_SCOPE');
});
test('T09 billing charge cannot be authorized by a signed setup intent',async()=>{
 const e=operatorEnv();e.intent.noBilling=false;
 await denied(approve(e),'OPERATOR_APPROVAL_SCOPE');
});
test('T10 credential mutation cannot be authorized by a signed setup intent',async()=>{
 const e=operatorEnv();e.intent.noCredentialChange=false;
 await denied(approve(e),'OPERATOR_APPROVAL_SCOPE');
});
test('T11 user supplied runtime admin or service_role cannot extend scope',async()=>{
 const e=operatorEnv();e.intent.service_role='service_role';
 await denied(approve(e),'OPERATOR_APPROVAL_SCOPE');
});
test('T12 missing security reviewer signature refuses admission',async()=>{
 const e=operatorEnv(),approvals=e.signAll().filter(x=>x.role!=='SECURITY_REVIEWER');
 await denied(approve(e,{approvals}),'OPERATOR_APPROVAL_SHAPE');
});
test('T13 replacing an Ed25519 signature with plain value fails',async()=>{
 const e=operatorEnv(),approvals=e.signAll();approvals[0].signature='true';
 await denied(approve(e,{approvals}),'OPERATOR_APPROVAL_SIGNATURE_INVALID');
});
test('T14 tampering signed scope after signatures fails',async()=>{
 const e=operatorEnv(),approvals=e.signAll();
 e.intent.nonce='QA_DIFFERENT_OPERATOR_NONCE_12345';
 await denied(approve(e,{approvals}),'OPERATOR_APPROVAL_SIGNATURE_INVALID');
});
test('T15 signature from different private key with expected role fails',async()=>{
 const e=operatorEnv(),approvals=e.signAll();
 const foreign=crypto.generateKeyPairSync('ed25519');
 const a=approvals[1],msg=Buffer.from('TIEN404_V171T_PRIVATE_OPERATOR_SIGNED_APPROVAL_V1\0'+
  JSON.stringify({intent:e.intent,role:a.role,kid:a.kid}));
 a.signature=crypto.sign(null,msg,foreign.privateKey).toString('base64url');
 await denied(approve(e,{approvals}),'OPERATOR_APPROVAL_SIGNATURE_INVALID');
});
test('T16 duplicate signer kid cannot satisfy independent four-party approvals',async()=>{
 const e=operatorEnv(),approvals=e.signAll();approvals[1].kid=approvals[0].kid;
 await denied(approve(e,{approvals}),'OPERATOR_APPROVAL_DUPLICATE_KEY');
});
test('T17 a supplied untrusted public key cannot replace enrolled key',async()=>{
 const e=operatorEnv(),approvals=e.signAll();
 approvals[0].publicJwk=e.keysets.SECURITY_REVIEWER.publicKey.export({format:'jwk'});
 await denied(approve(e,{approvals}),'OPERATOR_APPROVAL_DUPLICATE_KEY');
});
test('T18 operator and reviewer same registered person cannot satisfy separation',async()=>{
 const e=operatorEnv();
 e.signers.SECURITY_REVIEWER.signerRef=e.signers.OPERATOR.signerRef;
 await denied(approve(e),'OPERATOR_APPROVER_NOT_ENROLLED');
});
test('T19 owner store A signed consent must match JWT cryptographic subject',async()=>{
 const e=operatorEnv();e.signers.OWNER_STORE_A.ownerUserId=SB;
 await denied(approve(e),'OPERATOR_OWNER_CONSENT_IDENTITY_MISMATCH');
});
test('T20 owner store B signer cannot approve store A scope',async()=>{
 const e=operatorEnv();e.signers.OWNER_STORE_B.storeId='STORE_A';
 await denied(approve(e),'OPERATOR_OWNER_CONSENT_IDENTITY_MISMATCH');
});
test('T21 revoked independent security reviewer cannot sign',async()=>{
 const e=operatorEnv();e.signers.SECURITY_REVIEWER.active=false;
 await denied(approve(e),'OPERATOR_APPROVER_NOT_ENROLLED');
});
test('T22 private enrolled owner must have signer role matched to signed role',async()=>{
 const e=operatorEnv();e.signers.OWNER_STORE_A.role='SUPER_ADMIN';
 await denied(approve(e),'OPERATOR_APPROVER_NOT_ENROLLED');
});
test('T23 private signing registry missing refuses (no client supplied key)',async()=>{
 const e=operatorEnv({lookupPrivateApproverKey:async()=>null});
 await denied(approve(e),'OPERATOR_APPROVER_NOT_ENROLLED');
});
test('T24 signers public keys must not include private key d',async()=>{
 const e=operatorEnv();e.signers.OPERATOR.publicJwk={
  ...e.keysets.OPERATOR.privateKey.export({format:'jwk'})};
 await denied(approve(e),'OPERATOR_PUBLIC_KEY_UNTRUSTED');
});
test('T25 no duplicate nonce across fresh valid JWT receipts and same grant',async()=>{
 const e=operatorEnv(),r=await approve(e);assert.equal(r.ok,true);
 const other=await e.pair();
 await denied(e.c.gate.planOperatorAuthorizedTwoStoreAuth({
  owners:other,intent:e.intent,approvals:e.signAll()
 }),'OPERATOR_APPROVAL_REPLAY_OR_NON_ATOMIC');
});
test('T26 operator nonce reserve returning string true cannot authorize',async()=>{
 const e=operatorEnv({reservePrivateApprovalNonceOnce:async()=> 'true'});
 await denied(approve(e),'OPERATOR_APPROVAL_REPLAY_OR_NON_ATOMIC');
});
test('T27 nonce service outage denies, never promotes offline grant',async()=>{
 const e=operatorEnv({reservePrivateApprovalNonceOnce:async()=>{throw Error('OFFLINE')}});
 await denied(approve(e),'OPERATOR_NONCE_SERVICE_UNAVAILABLE');
});
test('T28 after successful admission owner receipts are single use',async()=>{
 const e=operatorEnv(),owners=await e.pair();
 const r=await approve(e,{owners});assert.equal(r.ok,true);
 await denied(approve(e,{owners}),'RECEIPT_REUSED');
});
test('T29 simultaneous duplicate admission cannot use both JWT receipts twice',async()=>{
 const e=operatorEnv(),owners=await e.pair();
 const results=await Promise.all([approve(e,{owners}),approve(e,{owners})]);
 assert.equal(results.filter(x=>x.ok).length,1);
 assert.equal(results.filter(x=>x.reason==='RECEIPT_REUSED').length,1);
});
test('T30 expired signed operator approval is refused',async()=>{
 const e=operatorEnv();e.intent.issuedAtMs=NOW-200000;e.intent.expiresAtMs=NOW-100;
 await denied(approve(e),'OPERATOR_APPROVAL_EXPIRED');
});
test('T31 approval life over 10 minutes is denied despite valid Ed signature',async()=>{
 const e=operatorEnv();e.intent.expiresAtMs=NOW+700000;
 await denied(approve(e),'OPERATOR_APPROVAL_SCOPE');
});
test('T32 JWT receipts from same user cannot count as owner A and B',async()=>{
 const e=operatorEnv(),a=await auth(e.c),b=await auth(e.c);
 assert.equal(a.ok,true);assert.equal(b.ok,true);
 await denied(approve(e,{owners:[a.receipt,b.receipt]}),'OPERATOR_TWO_STORE_IDENTITY_MISMATCH');
});
test('T33 owner B wrong Store JWT receipt cannot satisfy signed Store B approval',async()=>{
 const e=operatorEnv(),a=await auth(e.c),b=await auth(e.c);
 await denied(approve(e,{owners:[a.receipt,b.receipt]}),'OPERATOR_TWO_STORE_IDENTITY_MISMATCH');
});
test('T34 user metadata store B does not grant signed owner A Store B admission',async()=>{
 const e=operatorEnv(),a=await auth(e.c,token({raw_user_meta_data:{role:'admin',storeId:'STORE_B'}})),
 b=await auth(e.c,token({sub:SB,session_id:XB}),'STORE_B');
 assert.equal(a.ok,true);assert.equal(b.ok,true);
 assert.equal((await approve(e,{owners:[a.receipt,b.receipt]})).ok,true);
});
test('T35 owner A session revoked between JWT receipt and operator admission',async()=>{
 const e=operatorEnv(),owners=await e.pair();e.c.sessions[SA].active=false;
 await denied(approve(e,{owners}),'OPERATOR_AUTH_SESSION_REVOKED');
});
test('T36 owner B role downgraded between JWT receipt and final signature check',async()=>{
 const e=operatorEnv(),owners=await e.pair();e.c.owner[SB].role='viewer';
 await denied(approve(e,{owners}),'OPERATOR_STORE_OWNERSHIP_REVOKED');
});
test('T37 private enrolled key revoked during the second authority recheck',async()=>{
 let calls=0;
 const e=operatorEnv({lookupPrivateApproverKey:async({role})=>{
  calls++;
  if(calls>4&&role==='OPERATOR')return {...e.signers[role],active:false};
  return e.signers[role];
 }});
 await denied(approve(e),'OPERATOR_APPROVER_REVOKED');
});
test('T38 independent reviewer key rotates between signature check and commit',async()=>{
 let calls=0;
 const rotated=crypto.generateKeyPairSync('ed25519').publicKey.export({format:'jwk'});
 const e=operatorEnv({lookupPrivateApproverKey:async({role})=>{
  calls++;
  if(calls>4&&role==='SECURITY_REVIEWER')
   return {...e.signers[role],publicJwk:rotated};
  return e.signers[role];
 }});
 await denied(approve(e),'OPERATOR_APPROVER_REVOKED');
});
test('T39 authorized public key not available fails closed',async()=>{
 const e=operatorEnv({lookupPrivateApproverKey:async()=>{throw Error('DOWN')}});
 await denied(approve(e),'OPERATOR_KEY_REGISTRY_UNAVAILABLE');
});
test('T40 future operator scope issuance is denied',async()=>{
 const e=operatorEnv();e.intent.issuedAtMs=NOW+40000;e.intent.expiresAtMs=NOW+100000;
 await denied(approve(e),'OPERATOR_APPROVAL_EXPIRED');
});
