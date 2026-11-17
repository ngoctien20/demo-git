'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {makeRealJwtNoSendUat}=require('./real-jwt-no-send-contract.cjs');
const NOW=1794954000; // fixed ephemeral test epoch, NOT current Supabase
const TENANT='11111111-1111-4111-8111-111111111111';
const UA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const UB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const SA='11111111-1111-4111-8111-aaaaaaaaaaaa';
const SB='22222222-2222-4222-8222-bbbbbbbbbbbb';
const A='test_only_jwt_a_NOT_REAL_'+'A'.repeat(24);
const B='test_only_jwt_b_NOT_REAL_'+'B'.repeat(24);
const copy=x=>JSON.parse(JSON.stringify(x));
function fx(overrides={}){
 const claims={
  [A]:{iss:'https://ifxlvrhyjhbzbrkdsida.supabase.co/auth/v1',
   aud:'authenticated',role:'authenticated',is_anonymous:false,sub:UA,
   session_id:SA,iat:NOW-100,exp:NOW+600},
  [B]:{iss:'https://ifxlvrhyjhbzbrkdsida.supabase.co/auth/v1',
   aud:'authenticated',role:'authenticated',is_anonymous:false,sub:UB,
   session_id:SB,iat:NOW-100,exp:NOW+600}
 };
 const active={ [SA]:true,[SB]:true};
 const observed=[];
 const cfg={approvedQaTenantId:TENANT,clock:()=>NOW*1000,
  verifySupabaseClaims:async jwt=>({claims:claims[jwt],verifiedByTrustedSupabaseAuth:true}),
  lookupCurrentAuthSession:async({sessionId,userId})=>({
   active:active[sessionId]===true,userId,sessionId}),
  readCatalogUsingEndUserJwt:async({accessToken,targetStoreKey,viewName,select,method})=>{
   observed.push({token:accessToken?accessToken===A?'A':'B':'ANON',
     store:targetStoreKey,view:viewName,select,method});
   let result=[];
   if(accessToken===A&&targetStoreKey==='QA_STORE_A')
    result=[{tenant_id:TENANT,store_key:'QA_STORE_A',sku:'QA-A-001',name:'QA Product A',price_vnd:1000}];
   if(accessToken===B&&targetStoreKey==='QA_STORE_B')
    result=[{tenant_id:TENANT,store_key:'QA_STORE_B',sku:'QA-B-001',name:'QA Product B',price_vnd:'2000'}];
   return {status:200,rows:result};
  },...overrides};
 const gate=makeRealJwtNoSendUat(cfg);
 return {claims,active,observed,cfg,gate,run:()=>gate.run({jwtA:A,jwtB:B})};
}
async function no(f,expected){const r=await f.run();assert.equal(r.ok,false);assert.equal(r.code,expected);}
test('A01 five private read-only queries verify both own and both cross-store denials plus anon',async()=>{
 const f=fx(),r=await f.run();assert.equal(r.ok,true);
 assert.equal(f.observed.length,5);
 assert.deepEqual(f.observed.map(x=>x.store),
 ['QA_STORE_A','QA_STORE_B','QA_STORE_B','QA_STORE_A','QA_STORE_A']);
 assert.equal(f.observed.every(x=>x.method==='GET'),true);
 assert.equal(r.release,'HOSTED_NO_GO');
});
test('A02 never returns JWT user IDs or session IDs even on successful synthetic QA',async()=>{
 const r=await fx().run();const out=JSON.stringify(r);
 for(const s of [A,B,UA,UB,SA,SB])assert.equal(out.includes(s),false);
});
test('A03 even all green never sends a provider message or approves production',async()=>{
 const r=await fx().run();assert.equal(r.ok,true);
 assert.equal(r.providerMessagesSent,0);assert.equal(r.productionApproved,false);
 assert.equal(r.independentMerchantHumanOwnersVerified,false);
});
test('A04 no real JWT from operator means no hosted progress',async()=>{
 const f=fx();const r=await f.gate.run({jwtA:'',jwtB:B});
 assert.equal(r.code,'MISSING_TWO_DISTINCT_PRIVATE_JWTS');
});
test('A05 duplicated access token is not two independent owner accounts',async()=>{
 const f=fx();const r=await f.gate.run({jwtA:A,jwtB:A});
 assert.equal(r.code,'MISSING_TWO_DISTINCT_PRIVATE_JWTS');
});
test('A06 same authenticated subject with two sessions still not independent owners',async()=>{
 const f=fx();f.claims[B].sub=UA;await no(f,'NOT_TWO_INDEPENDENT_AUTH_IDENTITIES');
});
test('A07 same verified session under different sub is not two sessions',async()=>{
 const f=fx();f.claims[B].session_id=SA;await no(f,'NOT_TWO_INDEPENDENT_AUTH_IDENTITIES');
});
test('A08 invalid auth issuer rejected',async()=>{
 const f=fx();f.claims[A].iss='https://attacker.invalid';await no(f,'JWT_SIGNATURE_ISSUER_AUDIENCE_OR_EXPIRY_INVALID');
});
test('A09 wrong audience rejected',async()=>{
 const f=fx();f.claims[A].aud='anon';await no(f,'JWT_SIGNATURE_ISSUER_AUDIENCE_OR_EXPIRY_INVALID');
});
test('A10 absent verified Auth signature provenance rejected',async()=>{
 const f=fx({verifySupabaseClaims:async()=>({claims:{},verifiedByTrustedSupabaseAuth:false})});
 await no(f,'JWT_SIGNATURE_ISSUER_AUDIENCE_OR_EXPIRY_INVALID');
});
test('A11 role must be authenticated, not service_role',async()=>{
 const f=fx();f.claims[A].role='service_role';await no(f,'JWT_SIGNATURE_ISSUER_AUDIENCE_OR_EXPIRY_INVALID');
});
test('A12 anonymous Supabase Auth user never qualifies owner',async()=>{
 const f=fx();f.claims[A].is_anonymous=true;await no(f,'JWT_SIGNATURE_ISSUER_AUDIENCE_OR_EXPIRY_INVALID');
});
test('A13 expired JWT rejected',async()=>{
 const f=fx();f.claims[B].exp=NOW-5;await no(f,'JWT_SIGNATURE_ISSUER_AUDIENCE_OR_EXPIRY_INVALID');
});
test('A14 JWT expired within 30-second safety window rejected',async()=>{
 const f=fx();f.claims[B].exp=NOW+10;await no(f,'JWT_SIGNATURE_ISSUER_AUDIENCE_OR_EXPIRY_INVALID');
});
test('A15 excessively long-lived token rejected',async()=>{
 const f=fx();f.claims[B].exp=NOW+90000;await no(f,'JWT_SIGNATURE_ISSUER_AUDIENCE_OR_EXPIRY_INVALID');
});
test('A16 no JWT session_id claim rejected',async()=>{
 const f=fx();delete f.claims[B].session_id;await no(f,'JWT_SIGNATURE_ISSUER_AUDIENCE_OR_EXPIRY_INVALID');
});
test('A17 first session already revoked -> no user query',async()=>{
 const f=fx();f.active[SA]=false;await no(f,'OWNER_AUTH_SESSION_REVOKED_OR_UNBOUND');assert.equal(f.observed.length,0);
});
test('A18 second session already revoked -> no user query',async()=>{
 const f=fx();f.active[SB]=false;await no(f,'OWNER_AUTH_SESSION_REVOKED_OR_UNBOUND');assert.equal(f.observed.length,0);
});
test('A19 backend auth.sessions outage fails closed',async()=>{
 const f=fx({lookupCurrentAuthSession:async()=>{throw Error('OFFLINE')}});
 await no(f,'OWNER_SESSION_REGISTRY_UNAVAILABLE');
});
test('A20 fabricated inactive session proof fails closed',async()=>{
 const f=fx({lookupCurrentAuthSession:async({sessionId,userId})=>
 ({active:true,sessionId:'99999999-9999-4999-8999-999999999999',userId})});
 await no(f,'OWNER_AUTH_SESSION_REVOKED_OR_UNBOUND');
});
test('A21 user A sees Store B => cross-store leak blocked',async()=>{
 const f=fx({readCatalogUsingEndUserJwt:async({accessToken,targetStoreKey})=>{
  if(accessToken===A&&targetStoreKey==='QA_STORE_B')
   return {status:200,rows:[{tenant_id:TENANT,store_key:'QA_STORE_B',sku:'QA-B-001',name:'B',price_vnd:2000}]};
  if(accessToken===A&&targetStoreKey==='QA_STORE_A')
   return {status:200,rows:[{tenant_id:TENANT,store_key:'QA_STORE_A',sku:'QA-A-001',name:'A',price_vnd:1000}]};
  return {status:200,rows:[]};
 }});
 await no(f,'CROSS_STORE_ISOLATION_OR_OWNER_READ_FAILED');
});
test('A22 user B sees Store A => denied',async()=>{
 const f=fx();const old=f.cfg.readCatalogUsingEndUserJwt;
 const cb=async x=>{
  if(x.accessToken===B&&x.targetStoreKey==='QA_STORE_A')
   return {status:200,rows:[{tenant_id:TENANT,store_key:'QA_STORE_A',sku:'QA-A-001',name:'A',price_vnd:1000}]};
  return old(x);
 };
 const r=await makeRealJwtNoSendUat({...f.cfg,readCatalogUsingEndUserJwt:cb}).run({jwtA:A,jwtB:B});
 assert.equal(r.code,'CROSS_STORE_ISOLATION_OR_OWNER_READ_FAILED');
});
test('A23 anon GET exposes any synthetic row => DENY',async()=>{
 const f=fx();const old=f.cfg.readCatalogUsingEndUserJwt;
 const cb=async x=>x.accessToken===null?{status:200,rows:[{tenant_id:TENANT,store_key:'QA_STORE_A',sku:'QA-A-001',name:'X',price_vnd:1000}]}:old(x);
 const r=await makeRealJwtNoSendUat({...f.cfg,readCatalogUsingEndUserJwt:cb}).run({jwtA:A,jwtB:B});
 assert.equal(r.code,'ANONYMOUS_READER_DATA_EXPOSURE');
});
test('A24 anon 403 and empty rows is safe',async()=>{
 const f=fx();const old=f.cfg.readCatalogUsingEndUserJwt;
 const cb=async x=>x.accessToken===null?{status:403,rows:[]}:old(x);
 const r=await makeRealJwtNoSendUat({...f.cfg,readCatalogUsingEndUserJwt:cb}).run({jwtA:A,jwtB:B});
 assert.equal(r.ok,true);
});
test('A25 unexpected tenant_id on an owner own row is rejected',async()=>{
 const f=fx();const old=f.cfg.readCatalogUsingEndUserJwt;
 const cb=async x=>{const y=copy(await old(x));if(x.accessToken===A&&x.targetStoreKey==='QA_STORE_A')y.rows[0].tenant_id='99999999-9999-4999-8999-999999999999';return y;};
 const r=await makeRealJwtNoSendUat({...f.cfg,readCatalogUsingEndUserJwt:cb}).run({jwtA:A,jwtB:B});
 assert.equal(r.code,'CROSS_TENANT_STORE_OR_SKU_LEAKAGE');
});
test('A26 spoofed sku from another Store rejected',async()=>{
 const f=fx();const old=f.cfg.readCatalogUsingEndUserJwt;
 const cb=async x=>{const y=copy(await old(x));if(x.accessToken===B&&x.targetStoreKey==='QA_STORE_B')y.rows[0].sku='QA-A-001';return y;};
 const r=await makeRealJwtNoSendUat({...f.cfg,readCatalogUsingEndUserJwt:cb}).run({jwtA:A,jwtB:B});
 assert.equal(r.code,'CROSS_TENANT_STORE_OR_SKU_LEAKAGE');
});
test('A27 own product missing is not false success',async()=>{
 const f=fx({readCatalogUsingEndUserJwt:async()=>({status:200,rows:[]})});
 await no(f,'CROSS_STORE_ISOLATION_OR_OWNER_READ_FAILED');
});
test('A28 reader cannot return service_role/admin debug metadata',async()=>{
 const f=fx({readCatalogUsingEndUserJwt:async()=>({status:200,rows:[],jwt:'leaked'})});
 await no(f,'UNTRUSTED_READER_RESULT');
});
test('A29 reader throws -> no exposure or retries',async()=>{
 const f=fx({readCatalogUsingEndUserJwt:async()=>{throw Error('NO_ACCESS')}});
 await no(f,'USER_SCOPED_READER_UNAVAILABLE_OR_DENIED');
});
test('A30 revoked session after GET checks but before acceptance denied',async()=>{
 const f=fx();let checked=0;const lookup=async({sessionId,userId})=>{
  checked++;return {active:checked<=2,userId,sessionId};
 };
 const r=await makeRealJwtNoSendUat({...f.cfg,lookupCurrentAuthSession:lookup}).run({jwtA:A,jwtB:B});
 assert.equal(r.code,'OWNER_SESSION_REVOKED_DURING_UAT');
});
test('A31 session backend outage at final recheck fails closed',async()=>{
 const f=fx();let checked=0;
 const lookup=async({sessionId,userId})=>{checked++;if(checked>2)throw Error('DOWN');return {active:true,userId,sessionId};};
 const r=await makeRealJwtNoSendUat({...f.cfg,lookupCurrentAuthSession:lookup}).run({jwtA:A,jwtB:B});
 assert.equal(r.code,'OWNER_SESSION_RECHECK_UNAVAILABLE');
});
test('A32 nonexistent trusted verifier callbacks cannot run',()=>{
 assert.throws(()=>makeRealJwtNoSendUat({approvedQaTenantId:TENANT}),/PRIVATE_REAL_AUTH_RUNTIME_NOT_CONFIGURED/);
});
test('A33 JWT provided to client by user cannot override private config scope',async()=>{
 const f=fx();const r=await f.gate.run({jwtA:A,jwtB:B,service_role:true});
 assert.equal(r.code,'MISSING_TWO_DISTINCT_PRIVATE_JWTS');
});
test('A34 fake user_metadata owner flag never grants cross Store',async()=>{
 const f=fx();f.claims[A].user_metadata={store_key:'QA_STORE_B',role:'owner'};
 const r=await f.run();assert.equal(r.ok,true);assert.equal(r.release,'HOSTED_NO_GO');
});
test('A35 invalid price_vnd source value rejected',async()=>{
 const f=fx();const old=f.cfg.readCatalogUsingEndUserJwt;
 const cb=async x=>{const y=copy(await old(x));if(y.rows[0])y.rows[0].price_vnd='0e999';return y;};
 const r=await makeRealJwtNoSendUat({...f.cfg,readCatalogUsingEndUserJwt:cb}).run({jwtA:A,jwtB:B});
 assert.equal(r.code,'UNTRUSTED_READER_RESULT');
});
