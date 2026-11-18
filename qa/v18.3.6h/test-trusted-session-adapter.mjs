import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,randomBytes} from 'node:crypto';
import {createTrustedSessionAdapter,TrustedSessionDenied} from './trusted-session-adapter.mjs';
import {CONTRACT,createPrivateIssuer,createPrivateVerifier} from '../v18.3.6g/signed-authority.mjs';

const now=1_800_000_000;
const TENANT='tenant-qa',A='store-A',B='store-B';
function fixture(){
 const state={
   now,records:new Map(),claims:new Map(),users:new Map(),activeSessions:new Map(),members:new Map(),
 };
 const member=(userId,storeId)=>({
   source:'private_canonical_store_authority',rowCount:1,userId,tenantId:TENANT,storeId,
   status:'active',storeStatus:'active',tenantMembershipActive:true,
   revokedAt:null,expiresAt:null,revision:'revision-1',capabilities:['CATALOG_READ','ORDER_READ'],
 });
 for(const [suffix,userId,storeId] of [['A','owner-A',A],['B','owner-B',B]]){
   const token='OFFLINE-NOT-JWT-'+suffix,handle='opaque-'+suffix;
   state.records.set(handle,{source:'trusted_server_session_store',accessToken:token});
   state.claims.set(token,{sub:userId,session_id:'session-'+suffix,iss:CONTRACT.supabaseIssuer,
     aud:'authenticated',role:'authenticated',iat:now-20,exp:now+600,is_anonymous:false});
   state.users.set(token,{source:'trusted_supabase_auth_server',id:userId,verified:true,
     deleted:false,disabled:false,isAnonymous:false});
   state.activeSessions.set('session-'+suffix,{source:'private_active_session_registry',
     userId,sessionId:'session-'+suffix,active:true,revokedAt:null,checkedAt:now,
     expiresAt:now+600});
   state.members.set(userId+'/'+storeId,member(userId,storeId));
 }
 const config={
   expectedIssuer:CONTRACT.supabaseIssuer,expectedAudience:'authenticated',clock:()=>state.now*1000,
   maxSessionCheckAgeSeconds:5,
   resolveOpaqueSessionHandle:async handle=>state.records.get(handle),
   verifyJwt:async token=>({cryptographicallyVerified:true,trustedIssuerAndKey:true,claims:state.claims.get(token)}),
   fetchUser:async token=>state.users.get(token),
   lookupActiveSession:async({sessionId})=>state.activeSessions.get(sessionId),
   readCanonicalStoreMembership:async({userId,storeId})=>state.members.get(userId+'/'+storeId),
 };
 return {state,config,adapter:createTrustedSessionAdapter(config)};
}
async function denied(f,code){
 await assert.rejects(f,e=>e instanceof TrustedSessionDenied && e.code===code,code);
}
test('A01 verified session A comes from full layered server-side checks',async()=>{
 const {adapter}=fixture(),p=await adapter.verifySession('opaque-A');
 assert.equal(p.source,'trusted_supabase_server_adapter');assert.equal(p.sub,'owner-A');
 assert.equal(p.sessionId,'session-A');assert.equal(p.active,true);
});
test('A02 independently validated B session distinct from A',async()=>{
 const {adapter}=fixture();assert.equal((await adapter.verifySession('opaque-B')).sub,'owner-B');
});
test('A03 canonical Store A membership returned with revision',async()=>{
 const {adapter}=fixture();const m=await adapter.resolveMembership({userId:'owner-A',tenantId:TENANT,storeId:A});
 assert.equal(m.storeId,A);assert.equal(m.revision,'revision-1');
});
test('A04 same-Tenant wrong Store membership denied',async()=>{
 const {adapter}=fixture();await denied(()=>adapter.resolveMembership({userId:'owner-A',tenantId:TENANT,storeId:B}),'MEMBERSHIP_INVALID');
});
test('A05 no opaque handle denied',async()=>{
 const {adapter}=fixture();await denied(()=>adapter.verifySession(''),'SESSION_HANDLE');
});
test('A06 unknown handle cannot become server session',async()=>{
 const {adapter}=fixture();await denied(()=>adapter.verifySession('guess'),'OPAQUE_SESSION_NOT_FOUND');
});
test('A07 unverified JWT rejected even with plausible user',async()=>{
 const f=fixture();f.config.verifyJwt=async token=>({cryptographicallyVerified:false,trustedIssuerAndKey:true,
  claims:f.state.claims.get(token)});
 const a=createTrustedSessionAdapter(f.config);
 await denied(()=>a.verifySession('opaque-A'),'JWT_NOT_VERIFIED');
});
test('A08 wrong verified JWT issuer rejected',async()=>{
 const f=fixture();f.state.claims.get('OFFLINE-NOT-JWT-A').iss='https://attacker.invalid/auth/v1';
 await denied(()=>f.adapter.verifySession('opaque-A'),'JWT_CLAIMS_INVALID');
});
test('A09 wrong verified JWT audience rejected',async()=>{
 const f=fixture();f.state.claims.get('OFFLINE-NOT-JWT-A').aud='anon';
 await denied(()=>f.adapter.verifySession('opaque-A'),'JWT_CLAIMS_INVALID');
});
test('A10 expired JWT rejected before session lookup',async()=>{
 const f=fixture();f.state.claims.get('OFFLINE-NOT-JWT-A').exp=now-1;
 await denied(()=>f.adapter.verifySession('opaque-A'),'JWT_CLAIMS_INVALID');
});
test('A11 future issued-at JWT rejected',async()=>{
 const f=fixture();f.state.claims.get('OFFLINE-NOT-JWT-A').iat=now+30;
 await denied(()=>f.adapter.verifySession('opaque-A'),'JWT_CLAIMS_INVALID');
});
test('A12 anonymous Auth identity cannot use human Store authority',async()=>{
 const f=fixture();f.state.claims.get('OFFLINE-NOT-JWT-A').is_anonymous=true;
 await denied(()=>f.adapter.verifySession('opaque-A'),'JWT_CLAIMS_INVALID');
});
test('A13 getUser mismatch denies stale or substituted JWT subject',async()=>{
 const f=fixture();f.state.users.get('OFFLINE-NOT-JWT-A').id='owner-B';
 await denied(()=>f.adapter.verifySession('opaque-A'),'USER_MISMATCH_OR_DISABLED');
});
test('A14 disabled user denied',async()=>{
 const f=fixture();f.state.users.get('OFFLINE-NOT-JWT-A').disabled=true;
 await denied(()=>f.adapter.verifySession('opaque-A'),'USER_MISMATCH_OR_DISABLED');
});
test('A15 revoked session denies even when JWT signature valid',async()=>{
 const f=fixture();f.state.activeSessions.get('session-A').active=false;
 await denied(()=>f.adapter.verifySession('opaque-A'),'SESSION_REVOKED_UNVERIFIED_OR_STALE');
});
test('A16 session ID mismatch denies',async()=>{
 const f=fixture();f.state.activeSessions.get('session-A').sessionId='session-B';
 await denied(()=>f.adapter.verifySession('opaque-A'),'SESSION_REVOKED_UNVERIFIED_OR_STALE');
});
test('A17 stale session cache is denied',async()=>{
 const f=fixture();f.state.activeSessions.get('session-A').checkedAt=now-6;
 await denied(()=>f.adapter.verifySession('opaque-A'),'SESSION_REVOKED_UNVERIFIED_OR_STALE');
});
test('A18 missing privileged session lookup fails closed',async()=>{
 const f=fixture();f.config.lookupActiveSession=async()=>{throw Error('db-offline')};
 await denied(()=>createTrustedSessionAdapter(f.config).verifySession('opaque-A'),'DEPENDENCY_UNAVAILABLE');
});
test('A19 revoked Store membership denied',async()=>{
 const f=fixture();f.state.members.get('owner-A/'+A).status='revoked';
 await denied(()=>f.adapter.resolveMembership({userId:'owner-A',tenantId:TENANT,storeId:A}),'MEMBERSHIP_INVALID');
});
test('A20 inactive Store denied',async()=>{
 const f=fixture();f.state.members.get('owner-A/'+A).storeStatus='suspended';
 await denied(()=>f.adapter.resolveMembership({userId:'owner-A',tenantId:TENANT,storeId:A}),'MEMBERSHIP_INVALID');
});
test('A21 missing canonical Store authority fails closed',async()=>{
 const f=fixture();f.config.readCanonicalStoreMembership=async()=>{throw Error('schema missing')};
 await denied(()=>createTrustedSessionAdapter(f.config).resolveMembership({userId:'owner-A',tenantId:TENANT,storeId:A}),'DEPENDENCY_UNAVAILABLE');
});
test('A22 duplicate/ambiguous memberships denied',async()=>{
 const f=fixture();f.state.members.get('owner-A/'+A).rowCount=2;
 await denied(()=>f.adapter.resolveMembership({userId:'owner-A',tenantId:TENANT,storeId:A}),'MEMBERSHIP_INVALID');
});
test('A23 disabled Tenant membership denied',async()=>{
 const f=fixture();f.state.members.get('owner-A/'+A).tenantMembershipActive=false;
 await denied(()=>f.adapter.resolveMembership({userId:'owner-A',tenantId:TENANT,storeId:A}),'MEMBERSHIP_INVALID');
});
test('A24 injected arbitrary capability denied',async()=>{
 const f=fixture();f.state.members.get('owner-A/'+A).capabilities=['ORDER_WRITE'];
 await denied(()=>f.adapter.resolveMembership({userId:'owner-A',tenantId:TENANT,storeId:A}),'MEMBERSHIP_INVALID');
});
test('A25 malformed server configuration denied',()=>{
 const f=fixture();assert.throws(()=>createTrustedSessionAdapter({...f.config,maxSessionCheckAgeSeconds:999}),e=>e.code==='CONFIGURATION');
});
test('A26 verified adapter callbacks can satisfy prior G offline read-only issuer/verifier',async()=>{
 const f=fixture(),key=generateKeyPairSync('ed25519'),secret=randomBytes(32),used=new Set();
 const o={...f.adapter,bindingKey:secret,clock:f.config.clock,privateKey:key.privateKey,kid:'h-test-1'};
 const i=createPrivateIssuer(o);
 const token=await i.issue({sessionHandle:'opaque-A',tenantId:TENANT,storeId:A,capability:'CATALOG_READ'});
 const v=createPrivateVerifier({...f.adapter,bindingKey:secret,clock:f.config.clock,
  trustedKeys:new Map([['h-test-1',key.publicKey]]),
  consumeNonce:async({jti})=>{if(used.has(jti))return false;used.add(jti);return true;}});
 const proof=await v.redeem({token,sessionHandle:'opaque-A',tenantId:TENANT,storeId:A,capability:'CATALOG_READ'});
 assert.equal(proof.allowed,true);
});
test('A27 revoking mock active session after issuance denies G redemption',async()=>{
 const f=fixture(),key=generateKeyPairSync('ed25519'),secret=randomBytes(32);
 const i=createPrivateIssuer({...f.adapter,bindingKey:secret,clock:f.config.clock,privateKey:key.privateKey,kid:'h-test-1'});
 const token=await i.issue({sessionHandle:'opaque-A',tenantId:TENANT,storeId:A,capability:'ORDER_READ'});
 f.state.activeSessions.get('session-A').active=false;
 const v=createPrivateVerifier({...f.adapter,bindingKey:secret,clock:f.config.clock,
 trustedKeys:new Map([['h-test-1',key.publicKey]]),consumeNonce:async()=>true});
 await assert.rejects(()=>v.redeem({token,sessionHandle:'opaque-A',tenantId:TENANT,storeId:A,capability:'ORDER_READ'}));
});
