'use strict';

/**
 * TIEN404 V18.5.4 — Cloudflare-native private operator admission.
 *
 * Runtime contract: Cloudflare Access must protect the exact Worker hostname
 * before the Worker is reachable. Cloudflare supplies ctx.access only for the
 * directly Access-authenticated Worker invocation. Never infer identity from
 * Origin, cookies, browser JSON, or Cf-Access-Jwt-Assertion copied by a client.
 *
 * This module is platform-neutral JavaScript and uses no Node crypto, network,
 * JWT parser, or secret. The Worker runtime verifies the Access assertion.
 */
const EMAIL_PATTERN=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const AUD_PATTERN=/^[a-f0-9]{64}$/i;

function deny(code,status=403){
  return Object.freeze({ok:false,status,code});
}
function normalizedEmail(value){
  if(typeof value!=='string'||value.length>254)return null;
  const email=value.trim().toLowerCase();
  if(!EMAIL_PATTERN.test(email)||/[\u0000-\u001f\u007f]/.test(email))return null;
  return email;
}
function audienceMatches(actual,expected){
  if(typeof actual==='string')return actual===expected;
  return Array.isArray(actual)&&actual.length===1&&actual[0]===expected;
}

/**
 * Require a Cloudflare-authenticated private QA operator on every request.
 * T404_ACCESS_AUD is the exact AUD tag for the Access app protecting this
 * Worker hostname. T404_QA_OPERATOR_EMAIL is a server-side allowlist value.
 * Do not pass these values from the browser or return the identity to callers.
 */
export async function verifyPrivateAccess(ctx,env){
  const access=ctx&&ctx.access;
  if(!access||typeof access.getIdentity!=='function'){
    return deny('ACCESS_CONTEXT_REQUIRED',403);
  }

  const expectedAud=env&&env.T404_ACCESS_AUD;
  const allowedEmail=normalizedEmail(env&&env.T404_QA_OPERATOR_EMAIL);
  if(typeof expectedAud!=='string'||!AUD_PATTERN.test(expectedAud)||
     !allowedEmail){
    return deny('ACCESS_CONFIGURATION_INVALID',503);
  }

  if(!audienceMatches(access.aud,expectedAud)){
    return deny('ACCESS_AUDIENCE_MISMATCH',403);
  }

  let identity;
  try{
    identity=await access.getIdentity();
  }catch{
    return deny('ACCESS_IDENTITY_UNAVAILABLE',503);
  }

  const email=normalizedEmail(identity&&identity.email);
  if(!email)return deny('ACCESS_IDENTITY_INVALID',403);
  if(email!==allowedEmail)return deny('ACCESS_OPERATOR_NOT_ALLOWLISTED',403);

  // Return only an authorization decision. No email, name, groups, token,
  // Access identity object, Tenant ID, or Store ID leaves this function.
  return Object.freeze({
    ok:true,
    principalType:'CLOUDFLARE_ACCESS_PRIVATE_QA_OPERATOR',
    audienceVerified:true,
    operatorAllowlisted:true
  });
}
