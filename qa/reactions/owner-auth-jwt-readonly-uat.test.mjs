import test from 'node:test';
import assert from 'node:assert/strict';
import {checkRealOwnerJwtReadOnly} from './owner-auth-jwt-readonly-uat.mjs';

const storeA='a0000000-0000-4000-8000-000000000001';
const storeB='b0000000-0000-4000-8000-000000000002';
const uidA='a0000000-0000-4000-8000-000000000011';
const uidB='b0000000-0000-4000-8000-000000000012';

function fixtures(overrides={}){
 const calls=[];
 const fetchImpl=async(url,request)=>{
   const u=new URL(url);
   const auth=request.headers.Authorization||'';
   calls.push({path:u.pathname,method:request.method,auth,
     select:u.searchParams.get('select'),store:u.searchParams.get('store_id')});
   if(request.method!=='GET')throw Error('side_effect_method');
   let result=[],status=200;
   if(u.pathname==='/auth/v1/user'){
     if(auth==='Bearer synthetic-OWNER-A')result={id:uidA};
     else if(auth==='Bearer synthetic-OWNER-B')result={id:overrides.sameIdentity?uidA:uidB};
     else status=401;
     if(overrides.invalidAuth && auth==='Bearer synthetic-OWNER-B')status=401;
   }else if(u.pathname==='/rest/v1/store_memberships'){
     if(u.searchParams.get('user_id')==='eq.'+uidA && auth==='Bearer synthetic-OWNER-A' &&
        u.searchParams.get('store_id')==='eq.'+storeA)result=[{role:'owner',active:true}];
     if(u.searchParams.get('user_id')==='eq.'+uidB && auth==='Bearer synthetic-OWNER-B' &&
        u.searchParams.get('store_id')==='eq.'+storeB)result=[{role:'owner',active:true}];
     if(overrides.overlap && auth==='Bearer synthetic-OWNER-B' &&
        u.searchParams.get('store_id')==='eq.'+storeA)result=[{role:'owner',active:true}];
   }else if(u.pathname==='/rest/v1/channel_connections'){
     if(!auth){
       status=overrides.anon200?200:403;
       result=overrides.anon200?[{id:'fake-connection'}]:{};
     }else if(auth==='Bearer synthetic-OWNER-A' &&
              u.searchParams.get('store_id')==='eq.'+storeA)
       result=[{id:'qa-a'}];
     else if(overrides.crossLeak && auth==='Bearer synthetic-OWNER-B' &&
       u.searchParams.get('store_id')==='eq.'+storeA)result=[{id:'LEAK'}];
   }else throw Error('unexpected_endpoint');
   return {ok:status>=200&&status<300,status,json:async()=>result};
 };
 return {calls,fetchImpl};
}
const args=({fetchImpl})=>({fetchImpl,publishableKey:'sb_publishable_qa_only',
 ownerAJwt:'synthetic-OWNER-A',ownerBJwt:'synthetic-OWNER-B',
 storeA,storeB,expectedAPageCount:1});

test('separate real-session-shaped owner A/B GET contract stays read-only, redacted',async()=>{
 const mock=fixtures();
 const r=await checkRealOwnerJwtReadOnly(args(mock));
 assert.equal(r.status,'read_only_uat_pass');
 assert.equal(r.ownerAPageCount,1);
 assert.equal(r.ownerBPageCount,0);
 assert.equal(r.anonBlocked,true);
 assert.equal(r.crossStoreHidden,true);
 assert.equal(r.hostedWrite,false);
 assert.equal(r.metaSend,false);
 assert.equal(r.jwtContentsExposed,false);
 assert.equal(mock.calls.length,r.requestCount);
 assert.ok(mock.calls.every(c=>c.method==='GET'));
 assert.equal(JSON.stringify(r).includes('synthetic-OWNER-'),false);
 assert.ok(mock.calls.every(c=>['/auth/v1/user','/rest/v1/store_memberships','/rest/v1/channel_connections'].includes(c.path)));
});
test('invalid B Auth session is an error and never fallback to admin',async()=>{
 const mock=fixtures({invalidAuth:true});
 await assert.rejects(checkRealOwnerJwtReadOnly(args(mock)),/real_auth_session_not_verified/);
});
test('same owner identity on both JWTs is NOT valid Owner A/B testing',async()=>{
 const mock=fixtures({sameIdentity:true});
 await assert.rejects(checkRealOwnerJwtReadOnly(args(mock)),/same_authenticated_owner/);
});
test('cross-tenant Page exposure fails loudly',async()=>{
 const mock=fixtures({crossLeak:true});
 await assert.rejects(checkRealOwnerJwtReadOnly(args(mock)),/cross_tenant_isolation_not_proven/);
});
test('owner B cannot also own A for strict negative UAT evidence',async()=>{
 const mock=fixtures({overlap:true});
 await assert.rejects(checkRealOwnerJwtReadOnly(args(mock)),/overlapping_owner_stores_invalid_test/);
});
test('anon SELECT is never accepted even if returned zero rows',async()=>{
 const mock=fixtures({anon200:true});
 await assert.rejects(checkRealOwnerJwtReadOnly(args(mock)),/anonymous_connection_exposure/);
});
test('reject privilege-bearing and duplicate credentials in configuration',async()=>{
 const mock=fixtures();
 for(const patch of [
   {publishableKey:'sb_secret_fake'},
   {ownerBJwt:'synthetic-OWNER-A'},
   {storeB:storeA},
   {expectedAPageCount:0},
   {storeA:'not-a-uuid'},
 ]){
   await assert.rejects(checkRealOwnerJwtReadOnly({...args(mock),...patch}),/invalid_uat_configuration/);
 }
});
