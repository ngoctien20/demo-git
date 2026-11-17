/**
 * V17.4P-HOSTED.4B.3 — dedicated PRIVATE broker operator JWT admission.
 * Pure Node verifier, NO network, NO Cloudflare request or permissions.
 *
 * Broker is NOT provisioned: its RS256 signing key, operator principal and
 * MFA assertions MUST come from an independent private authenticated system.
 * This is deliberately NOT assumed compatible with a bare Cloudflare Access
 * JWT; do not synthesize MFA/scope claims for real Cloudflare tokens.
 */
import {createHash,createPublicKey,verify as verifyRSA} from 'node:crypto';
import {preparePrivatePermitForManualReview} from './hosted4b2-atomic-permit-and-postflight.mjs';

export const CONTRACT='T404_V174P_HOSTED4B3_PRIVATE_OPERATOR_ADMISSION_V1';
const isObj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const goodEmail=x=>typeof x==='string'&&x.length<=180&&
 /^[a-z0-9][a-z0-9.+_-]*@[a-z0-9.-]+\.[a-z]{2,}$/.test(x)&&!x.includes('..');
const canonical=x=>Array.isArray(x)?'['+x.map(canonical).join(',')+']':
 isObj(x)?'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}':
 JSON.stringify(x);
export const hashPermit=p=>createHash('sha256').update(canonical(p),'utf8').digest('hex');
const failed=(reason)=>Object.freeze({
 contract:CONTRACT,state:'BLOCKED_OPERATOR_IDENTITY',
 reason,identity_admitted_for_private_review:false,real_identity_independently_proven:false,
 can_upload:false,can_modify_cloudflare:false,can_run_external_qa:false
});
function decode(s){
 if(typeof s!=='string'||s.length<2||s.length>6000||!/^[A-Za-z0-9_-]+$/.test(s))
  throw Error('bad-base64url');
 const b=Buffer.from(s,'base64url');
 if(b.toString('base64url')!==s)throw Error('noncanonical-base64');
 return b;
}
function jsonPiece(s){
 const x=JSON.parse(decode(s).toString('utf8'));
 if(!isObj(x))throw Error('object-required');
 return x;
}
/**
 * Expected issuer/audience and pinned RSA trust anchor must be read from a
 * private authenticated registry, NOT a JWT header or the GitHub PR.
 *
 * A successful result confirms only cryptographic consistency of PROVIDED
 * evidence; no external human identity or Cloudflare ownership is proven.
 */
export function verifyPrivateOperatorAdmission({
 jwt,trustConfig,permit,now=Date.now()
}={}){
 if(typeof jwt!=='string'||jwt.length>8000||jwt.length<120)return failed('JWT_MISSING_OR_OVERSIZED');
 const segments=jwt.split('.');
 if(segments.length!==3)return failed('JWT_FORMAT');
 let header,claims,sig;
 try{header=jsonPiece(segments[0]);claims=jsonPiece(segments[1]);sig=decode(segments[2]);}
 catch{return failed('JWT_PARSE_OR_CANONICALIZATION');}
 const t=isObj(trustConfig)?trustConfig:{};
 if(header.alg!=='RS256'||typeof header.kid!=='string'||header.kid.length>128||
    Object.hasOwn(header,'crit')||Object.hasOwn(header,'jwk')||
    Object.hasOwn(header,'jku')||Object.hasOwn(header,'x5u')||Object.hasOwn(header,'x5c'))
  return failed('JWT_ALGORITHM_OR_KEY_INJECTION');
 if(t.source!=='PRIVATE_IDENTITY_BROKER_OUT_OF_BAND'||t.kid!==header.kid||
    typeof t.spki_pem!=='string'||!t.independent_operator_registry_verified)
  return failed('NO_INDEPENDENT_BROKER_TRUST');
 try{
  const k=createPublicKey(t.spki_pem);
  if(k.asymmetricKeyType!=='rsa'||(k.asymmetricKeyDetails?.modulusLength||0)<2048||
    !verifyRSA('RSA-SHA256',Buffer.from(segments[0]+'.'+segments[1]),k,sig))
   return failed('JWT_SIGNATURE_INVALID');
 }catch{return failed('JWT_SIGNATURE_INVALID');}
 if(typeof t.issuer!=='string'||!/^https:\/\/[a-z0-9.-]+$/.test(t.issuer)||
    claims.iss!==t.issuer||claims.aud!==t.audience)
  return failed('JWT_ISSUER_OR_AUDIENCE');
 const current=Math.floor(now/1000);
 if(!Number.isSafeInteger(claims.iat)||!Number.isSafeInteger(claims.nbf)||
    !Number.isSafeInteger(claims.exp)||!Number.isSafeInteger(claims.auth_time)||
    claims.iat>current+30||claims.nbf>current||
    claims.exp<=current||claims.exp>current+300||
    claims.iat<current-300||claims.auth_time>current||
    current-claims.auth_time>300||claims.exp-claims.iat>300)
  return failed('JWT_EXPIRED_STALE_OR_FUTURE');
 if(typeof claims.sub!=='string'||claims.sub!==t.authorized_operator_subject||
    !goodEmail(claims.email)||claims.email!==t.authorized_operator_email||
    claims.email_verified!==true||!Array.isArray(claims.amr)||
    !claims.amr.includes('mfa')||
    claims.role!=='qa_deployment_operator'||claims.scope!=='t404:qa:inactive-first-upload')
  return failed('OPERATOR_SUBJECT_ROLE_MFA_OR_SCOPE');
 if(!isObj(permit)||!goodEmail(permit.deployment_operator_email)||
    permit.deployment_operator_email!==claims.email||
    claims.permit_sha256!==hashPermit(permit))
  return failed('OPERATOR_NOT_BOUND_TO_SIGNED_PERMIT');
 // One valid signed broker JWT does NOT independently establish a real human.
 return Object.freeze({
  contract:CONTRACT,state:'OPERATOR_BROKER_SIGNATURE_CONSISTENT_PRIVATE_REVIEW_ONLY',
  reason:null,identity_admitted_for_private_review:true,
  real_identity_independently_proven:false,operator_subject_hash:
    createHash('sha256').update('T404_V174P_OPERATOR:'+claims.sub).digest('hex'),
  can_upload:false,can_modify_cloudflare:false,can_run_external_qa:false
 });
}
/**
 * Requires operator to pass the private broker BEFORE any attempt to consume
 * the signed permit. This orchestration remains review-only, never deploys.
 */
export async function reviewPrivateOperatorAndReservePermit({
 operatorJwt,trustConfig,evidence,privateLedger,getFreshInventory,now=Date.now()
}={}){
 const admission=verifyPrivateOperatorAdmission({
  jwt:operatorJwt,trustConfig,permit:evidence?.permit,now
 });
 if(!admission.identity_admitted_for_private_review)
  return Object.freeze({...admission,permit_ledger_attempted:false});
 // Narrow the ledger call to the *verified* operator principal and canonical
 // signed permit digest. Never accept identity hashes supplied by the caller.
 const admittedLedger=privateLedger&&typeof privateLedger.claimOnce==='function'
   ? {claimOnce:(claim)=>privateLedger.claimOnce({
       ...claim,permit_hash:hashPermit(evidence.permit),
       operator_subject_hash:admission.operator_subject_hash
     })}
   : null;
 const reservation=await preparePrivatePermitForManualReview({
  evidence,privateLedger:admittedLedger,getFreshInventory,now
 });
 return Object.freeze({
  ...reservation,operator_admission_state:admission.state,
  operator_subject_hash:admission.operator_subject_hash,
  real_identity_independently_proven:false,
  can_upload:false,can_deploy:false,can_modify_cloudflare:false
 });
}
