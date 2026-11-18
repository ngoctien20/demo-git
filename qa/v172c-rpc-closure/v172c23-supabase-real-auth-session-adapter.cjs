'use strict';
// V17.2C.23 — real Supabase Auth adapter candidate. NOT HOSTED.
// Calls project's HTTPS Auth /user to validate bearer; enforces current
// auth.sessions existence via separately privileged, private read-only adapter.
// Never exposes API keys, bearer, JWT payload, session UUID or user metadata.
const crypto=require('node:crypto');
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const reject=()=>({verified:false,active:false,sessionIdVerified:false});
function createSupabaseAuthSessionVerifier(config){
 const {projectRef,publishableKey,fetchImpl,checkActiveSession,evidenceHmacKey}=config||{};
 if(!/^[a-z0-9]{20}$/.test(projectRef||'') ||
   typeof publishableKey!=='string'||publishableKey.length<10||
   typeof fetchImpl!=='function'||typeof checkActiveSession!=='function' ||
   typeof evidenceHmacKey!=='string'||Buffer.byteLength(evidenceHmacKey)<32)
  throw Error('MISSING_PRIVATE_AUTH_CONFIGURATION');
 const url='https://'+projectRef+'.supabase.co/auth/v1/user';
 return async function verifySession(token){
  if(typeof token!=='string'||token.length<50||token.length>8192||!token.match(/^[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+$/)) return reject();
  try{
   const part=token.split('.')[1];
   if(part.length>6000) return reject();
   const payload=JSON.parse(Buffer.from(part,'base64url').toString('utf8'));
   const now=Math.floor(Date.now()/1000);
   if(!payload||!uuid.test(payload.sub||'')||!uuid.test(payload.session_id||'')||
      payload.iss!=='https://'+projectRef+'.supabase.co/auth/v1' ||
      payload.role!=='authenticated' ||
      !(payload.aud==='authenticated'||Array.isArray(payload.aud)&&payload.aud.includes('authenticated'))||
      !Number.isSafeInteger(payload.exp)||payload.exp<=now||
      !Number.isSafeInteger(payload.iat)||payload.iat>now+30||
      payload.exp-payload.iat>3600) return reject();
   // This payload is UNTRUSTED until /auth/v1/user validates supplied token.
   const response=await fetchImpl(url,{
    method:'GET',redirect:'manual',
    headers:{apikey:publishableKey,Authorization:'Bearer '+token,Accept:'application/json'},
    signal:AbortSignal.timeout(5000)
   });
   if(!response||response.status!==200) return reject();
   const user=await response.json();
   if(!user||user.id!==payload.sub || user.is_anonymous===true) return reject();
   // Trusted privileged lookup must read auth.sessions, match user_id and
   // expiration/revocation state, not simply trust a JWT session_id claim.
   const active=await checkActiveSession({sessionId:payload.session_id,subjectRef:payload.sub});
   if(!active||active.active!==true||active.subjectRef!==payload.sub||
      active.sessionId!==payload.session_id||active.revoked===true) return reject();
   const evidence=crypto.createHmac('sha256',evidenceHmacKey).update(
    projectRef+'|'+payload.session_id+'|'+payload.sub).digest('hex');
   return {verified:true,active:true,sessionIdVerified:true,
    subjectRef:payload.sub,sessionEvidenceRef:evidence,expiresAtMs:payload.exp*1000};
  }catch{return reject();}
 };
}
module.exports={createSupabaseAuthSessionVerifier};
