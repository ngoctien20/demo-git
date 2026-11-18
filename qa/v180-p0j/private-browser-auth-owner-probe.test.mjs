import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
import {TextEncoder} from 'node:util';
import {runInNewContext} from 'node:vm';

const original=readFileSync(new URL('./private-browser-auth-owner-probe.js',import.meta.url),'utf8');
const importLine="await import('/assets/auth-client.js')";
if(!original.includes(importLine))throw Error('EXPECTED_DEPLOYED_AUTH_CLIENT_IMPORT_MISSING');
const testOnlyScript=original.replace(importLine,'await Promise.resolve({getAuthClient:async()=>client})');
const A='10000000-0000-4000-8000-000000000001';
const B='10000000-0000-4000-8000-000000000002';
const SID='22222222-2222-4222-8222-222222222222';
const T='11111111-1111-4111-8111-111111111111';
const OTHER='33333333-3333-4333-8333-333333333333';
const NONCE='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ISS='https://ifxlvrhyjhbzbrkdsida.supabase.co/auth/v1';

function setup({user=A,tenant=T,role='owner',consent=true,origin='https://tien404-auth-staging.onrender.com',
 pathname='/account.html',nonce=NONCE,userError=null,claimPatch={},memberError=null}={}){
 const calls=[],logs=[];
 const claims={iss:ISS,aud:'authenticated',role:'authenticated',sub:user,
 session_id:SID,exp:Math.floor(Date.now()/1000)+900,
 iat:Math.floor(Date.now()/1000)-5,...claimPatch};
 const membership={tenant_id:tenant,role,active:true};
 const q={
  select:()=>{calls.push('select');return q;},
  eq:()=>q,
  limit:async()=>{calls.push('rlsRead');return {data:[membership],error:memberError};}
 };
 const client={
  auth:{
   getUser:async()=>{calls.push('getUser');return userError?
    {data:null,error:{message:'never print this token'}}:
    {data:{user:{id:user,email:'qa-private@example.invalid',is_anonymous:false}}}},
   getClaims:async()=>{calls.push('getClaims');return {data:{claims},error:null}}
  },
  from:(table)=>{calls.push('from:'+table);if(table!=='tenant_memberships')throw Error('UNAUTHORIZED_TABLE');return q;}
 };
 return {logs,calls,client,context:{location:{origin,pathname},
   confirm:()=>consent,prompt:()=>nonce,crypto:webcrypto,TextEncoder,
   console:{info:(...args)=>logs.push(args)},client}};
}
async function execute(options){
 const env=setup(options);
 await runInNewContext(testOnlyScript,env.context,{timeout:5000});
 return {report:env.logs.at(-1)?.[1],calls:env.calls,logs:env.logs};
}
const denied=r=>{
 assert.equal(r.report.status,'BLOCKED');
 assert.equal(r.report.canMigrate,false);
 assert.equal(r.report.canSend,false);
};
test('actual source syntax parses without executing any real Auth call',()=>{
 assert.match(original,/getUser\(\)/);
 assert.match(original,/getClaims\(\)/);
 assert.match(original,/tenant_memberships/);
 assert.match(original,/location\.origin !== ORIGIN/);
 assert.doesNotMatch(original,/sb\.auth\.(signInWithPassword|signUp|updateUser|signOut)\s*\(/);
 assert.doesNotMatch(original,/\.from\(['"](?:orders|products|customers)['"]\)/);
});
test('private Actor A owner reports only short-lived opaque fingerprints',async()=>{
 const x=await execute();
 assert.equal(x.report.status,'LOCAL_AUTH_AND_TENANT_OWNER_READ_OK');
 assert.equal(x.report.tenantOwnerFingerprints.length,1);
 assert.match(x.report.actorFingerprint,/^[a-f0-9]{40}$/);
 assert.equal(x.report.oneTimeNonce,NONCE);
 assert.deepEqual(x.calls,['getUser','getClaims','from:tenant_memberships','select','rlsRead']);
 const output=JSON.stringify(x.report);
 for(const privateValue of [A,T,SID,'qa-private@example.invalid'])
  assert.equal(output.includes(privateValue),false);
 assert.equal(x.report.canMigrate,false);
 assert.equal(x.report.canPublish,false);
 assert.equal(x.report.canSend,false);
 assert.equal(x.report.canonicalStoreMembershipVerified,false);
 assert.equal(x.report.serverSessionRevocationVerified,false);
});
test('two different authorized actors under same tenant produce equal tenant, different actor fingerprints',async()=>{
 const a=(await execute({user:A})).report;
 const b=(await execute({user:B})).report;
 assert.notEqual(a.actorFingerprint,b.actorFingerprint);
 assert.equal(a.tenantOwnerFingerprints[0],b.tenantOwnerFingerprints[0]);
});
test('different tenants do not produce matching owner tenant fingerprints',async()=>{
 const a=(await execute({tenant:T})).report;
 const b=(await execute({tenant:OTHER})).report;
 assert.notEqual(a.tenantOwnerFingerprints[0],b.tenantOwnerFingerprints[0]);
});
test('different nonce cannot be mistakenly compared as the same proof',async()=>{
 const a=(await execute({nonce:NONCE})).report;
 const b=(await execute({nonce:OTHER})).report;
 assert.notEqual(a.actorFingerprint,b.actorFingerprint);
});
test('no explicit QA consent does not call Auth API',async()=>{
 const r=await execute({consent:false});denied(r);assert.equal(r.calls.length,0);
});
test('unknown website origin does not call Auth API',async()=>{
 const r=await execute({origin:'https://evil.example'});denied(r);assert.equal(r.calls.length,0);
});
test('login URL is not an account verification page',async()=>{
 const r=await execute({pathname:'/login.html'});denied(r);assert.equal(r.calls.length,0);
});
test('invalid manual nonce blocked before Auth access',async()=>{
 const r=await execute({nonce:'bad-salt'});denied(r);assert.equal(r.calls.length,0);
});
test('empty nonce locally generated by secure browser crypto',async()=>{
 const r=await execute({nonce:''});
 assert.equal(r.report.status,'LOCAL_AUTH_AND_TENANT_OWNER_READ_OK');
 assert.match(r.report.oneTimeNonce,/^[0-9a-f-]{36}$/i);
});
test('getUser cannot verify user: fail closed without secrets',async()=>{
 const r=await execute({userError:true});denied(r);
 assert.equal(JSON.stringify(r.report).includes('never print this token'),false);
 assert.deepEqual(r.calls,['getUser']);
});
test('invalid issuer or JWT role blocked',async()=>{
 for(const claimPatch of [{iss:'https://evil.example'}, {role:'service_role'}]){
  const r=await execute({claimPatch});denied(r);
  assert.equal(r.calls.includes('from:tenant_memberships'),false);
 }
});
test('invalid subject, session, or expired JWT are denied before RLS',async()=>{
 for(const claimPatch of [{sub:B},{session_id:null},{exp:1}]){
  const r=await execute({claimPatch});denied(r);
  assert.equal(r.calls.includes('rlsRead'),false);
 }
});
test('staff membership is not an owner',async()=>{
 const r=await execute({role:'staff'});denied(r);
});
test('RLS error fail closed without printing error details',async()=>{
 const r=await execute({memberError:{message:'secret response hidden'}});denied(r);
 assert.equal(JSON.stringify(r.report).includes('secret response'),false);
});
