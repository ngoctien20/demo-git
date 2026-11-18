'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createSupabaseAuthSessionVerifier}=require('./v172c23-supabase-real-auth-session-adapter.cjs');
const project='abcdefghijklmnopqrst';
const uid='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',sid='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const encode=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
function fixture(o={}){
 const now=Math.floor(Date.now()/1000);
 const claims={sub:uid,session_id:sid,iss:'https://'+project+'.supabase.co/auth/v1',role:'authenticated',
  aud:'authenticated',iat:now-10,exp:now+120,...o.claims};
 const token=encode({alg:'HS256',typ:'JWT'})+'.'+encode(claims)+'.'+('a'.repeat(48));
 const calls=[];
 const config={projectRef:project,publishableKey:'synthetic-only-key',evidenceHmacKey:'x'.repeat(48),
  fetchImpl:async(url,opt)=>{calls.push(['auth',url,opt]);return {status:200,json:async()=>({id:uid,is_anonymous:false})};},
  checkActiveSession:async(x)=>{calls.push(['session',x]);return {active:true,subjectRef:uid,sessionId:sid,revoked:false};},
  ...o.adapters};
 return {verify:createSupabaseAuthSessionVerifier(config),token,calls};
}
test('live-shaped mock /user + server active-session adapter returns only redacted evidence',async()=>{
 const {verify,token,calls}=fixture();const out=await verify(token);
 assert.equal(out.verified,true);assert.equal(out.sessionIdVerified,true);
 assert.equal(calls.length,2);
 assert.equal(calls[0][1],'https://'+project+'.supabase.co/auth/v1/user');
 assert.equal(calls[0][2].redirect,'manual');
 assert.equal(calls[1][1].sessionId,sid);
 assert.ok(!JSON.stringify(out).includes(sid));
 assert.ok(!JSON.stringify(out).includes(token));
});
for(const [name,options] of [
 ['expired',{claims:{exp:1}}],
 ['issuer mismatch',{claims:{iss:'https://evil.example/auth/v1'}}],
 ['anon role',{claims:{role:'anon'}}],
 ['missing session',{claims:{session_id:undefined}}],
 ['invalid subject',{claims:{sub:'not-uuid'}}],
 ['expired chain age',{claims:{iat:1}}],
 ['future issued',{claims:{iat:Math.floor(Date.now()/1000)+100}}],
 ['untrusted audience',{claims:{aud:'service_role'}}],
 ['wrong project',{adapters:{projectRef:'zzzzzzzzzzzzzzzzzzzz'}}]
])test('DENY '+name+' before/at Auth verification',async()=>{
 const f=fixture(options); assert.equal((await f.verify(f.token)).verified,false);
});
for(const [name,adapters] of [
 ['Auth 401',{fetchImpl:async()=>({status:401})}],
 ['HTTP redirect',{fetchImpl:async()=>({status:302})}],
 ['Auth mismatch',{fetchImpl:async()=>({status:200,json:async()=>({id:sid})})}],
 ['anonymous user',{fetchImpl:async()=>({status:200,json:async()=>({id:uid,is_anonymous:true})})}],
 ['unknown anonymous status',{fetchImpl:async()=>({status:200,json:async()=>({id:uid})})}],
 ['Auth service offline',{fetchImpl:async()=>{throw Error('offline');}}],
 ['missing active session',{checkActiveSession:async()=>({active:false})}],
 ['revoked session',{checkActiveSession:async()=>({active:true,subjectRef:uid,sessionId:sid,revoked:true})}],
 ['session subject mismatch',{checkActiveSession:async()=>({active:true,subjectRef:sid,sessionId:sid})}],
 ['session id mismatch',{checkActiveSession:async()=>({active:true,subjectRef:uid,sessionId:uid})}]
])test('DENY '+name,async()=>{
 const f=fixture({adapters});assert.equal((await f.verify(f.token)).verified,false);
});
test('reject malformed and oversized bearer before network',async()=>{
 const f=fixture();for(const raw of ['hello','a.b.c', 'x'.repeat(9000)])
  assert.equal((await f.verify(raw)).verified,false);
 assert.equal(f.calls.length,0);
});
test('do not accept missing private active session adapter',()=>{
 assert.throws(()=>createSupabaseAuthSessionVerifier({projectRef:project,publishableKey:'synthetic-only-key',fetchImpl:async()=>{}}));
});
