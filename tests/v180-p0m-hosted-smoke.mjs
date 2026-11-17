// TIEN404 V18.0-P0M — real HTTPS PUBLIC STATIC route smoke.
// NO login, NO bearer tokens, NO cookies, NO Supabase writes, NO provider sends.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const origin='https://tien404-auth-staging.onrender.com';
const routes=[
 {url:'/auth-evidence.html', local:'auth-evidence.html', fragments:['id="consent"','id="check"','noindex,nofollow','private-auth-evidence-ui.mjs']},
 {url:'/assets/private-auth-evidence-core.mjs',local:'assets/private-auth-evidence-core.mjs',fragments:['getClaims()','tenant_memberships','canGrantRoles:false']},
 {url:'/assets/private-auth-evidence-ui.mjs',local:'assets/private-auth-evidence-ui.mjs',fragments:['getAuthClient','/auth-evidence.html']},
 {url:'/assets/auth-account.js',local:'assets/auth-account.js',fragments:['tenant_memberships','getUser()']},
 {url:'/assets/auth-client.js',local:'assets/auth-client.js',fragments:['getAuthClient','supabase-js@2.119.0']},
 {url:'/assets/auth-login.js',local:'assets/auth-login.js',fragments:['signInWithPassword']},
 {url:'/login.html',fragments:['auth-forgot-password','auth-login.js']},
 {url:'/account.html',fragments:['account-status','account-protected']},
 {url:'/merchant-portal.html',fragments:['merchant-portal']}
];
for(const route of routes){
 let response;
 try{
   response=await fetch(origin+route.url,{
     redirect:'error',signal:AbortSignal.timeout(20000),
     headers:{'accept':'text/html,application/javascript,text/javascript,*/*'}
   });
 }catch(e){throw Error('STAGING_ROUTE_UNREACHABLE '+route.url+' '+e.name);}
 assert.equal(response.status,200,'Expected HTTP 200 for '+route.url);
 const body=await response.text();
 assert.ok(body.length>80 && body.length<250_000,'Unexpected body size '+route.url);
 for(const fragment of route.fragments){
   assert.ok(body.includes(fragment),'Missing expected source marker '+route.url+' '+fragment);
 }
 if(route.local){
  const local=readFileSync(route.local,'utf8');
  assert.equal(body.trim(),local.trim(),'Deployed bytes do not match exact expected source '+route.url);
 }
 console.log('PASS_STAGING_HTTPS',route.url,'HTTP',response.status,'bytes',body.length);
}
const forbidden=['/.env','/.git/config','/private/credentials.json'];
for(const route of forbidden){
 const r=await fetch(origin+route,{redirect:'manual',signal:AbortSignal.timeout(20000)});
 assert.equal(r.status,404,'Unexpected public private-file status '+route);
 console.log('PASS_STAGING_DENY_PRIVATE_PATH',route,r.status);
}
console.log('P0M_HOSTED_STATIC_READONLY_SMOKE_OK; NO_USER_LOGIN; NO_STORE_AUTH_PROOF');
