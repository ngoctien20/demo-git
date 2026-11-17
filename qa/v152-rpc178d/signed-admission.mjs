/**
 * RPC17.8D -- OFFLINE signed evidence packet checker.
 * Cryptographically verifies 3 Ed25519 attestations bound to exact staging scope,
 * SQL digest and baseline digest. PINNED public keys must be supplied by a
 * SEPARATE trusted registry, not by the evidence submitter.
 *
 * THIS NEVER AUTHORISES MIGRATION, RESTORE, CREDENTIAL ACCESS OR REAL UAT.
 */
import { createPublicKey, verify } from 'node:crypto';

const roles=Object.freeze(['owner','recovery','security']);
const req=Object.freeze([
  'aud','baseline_sha256','candidate_sha256','evidence_sha256','exp','iat',
  'issuer_ref','nonce','project','role','schema','scope','store_a','store_b','tenant_id'
]);
const digest=x=>typeof x==='string'&&/^[0-9a-f]{64}$/i.test(x);
const guid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
const DENIED=(reason,missing=[])=>Object.freeze({
  status:'NO_GO',reason,missing:Object.freeze([...missing]),
  signed_packet_valid:false,
  can_apply_ddl:false,can_create_store:false,can_change_rls:false,
  can_restore_staging:false,can_use_real_jwt:false,can_send:false,can_open_access:false
});
function verifyOne(envelope,pin,role,ctx,now){
 try{
  if(!pin||!envelope||envelope.kid!==pin.kid||
     typeof envelope.payload!=='string'||typeof envelope.signature!=='string')return null;
  const key=createPublicKey(pin.publicKeyPem);
  if(key.asymmetricKeyType!=='ed25519')return null;
  const raw=Buffer.from(envelope.payload,'base64url');
  const sig=Buffer.from(envelope.signature,'base64url');
  if(raw.length<100||raw.length>2500||sig.length!==64||
      raw.toString('base64url')!==envelope.payload||sig.toString('base64url')!==envelope.signature||
      !verify(null,raw,key,sig))return null;
  const payload=JSON.parse(raw.toString('utf8'));
  if(!payload||typeof payload!=='object'||Array.isArray(payload)||
     Object.keys(payload).sort().join('|')!==req.slice().sort().join('|'))return null;
  if(payload.role!==role||payload.aud!=='tien404-rpc178d-private-review'||
     payload.scope!=='rpc178_qa:review_no_send')return null;
  if(payload.project!==ctx.project||payload.schema!==ctx.schema||
     payload.baseline_sha256!==ctx.baseline_sha256||
     payload.candidate_sha256!==ctx.candidate_sha256||
     payload.tenant_id!==ctx.tenant_id||
     payload.store_a!==ctx.store_a||payload.store_b!==ctx.store_b)return null;
  if(!digest(payload.evidence_sha256)||
     typeof payload.issuer_ref!=='string'||!/^operator-[A-Za-z0-9_-]{4,50}$/.test(payload.issuer_ref)||
     typeof payload.nonce!=='string'||!/^nonce-[A-Za-z0-9_-]{8,80}$/.test(payload.nonce))return null;
  if(!Number.isSafeInteger(payload.iat)||!Number.isSafeInteger(payload.exp)||
     !Number.isSafeInteger(now)||payload.iat>now||payload.exp<=now||
     now-payload.iat>300||payload.exp-payload.iat>600)return null;
  return payload;
 }catch{return null;}
}
export function reviewSignedGoNoGoPacket(input={}){
 try{
  const {context,attestations,trustedPins,now}=input||{};
  if(!context||context.project!=='ifxlvrhyjhbzbrkdsida'||
     context.schema!=='rpc178_qa'||!digest(context.baseline_sha256)||
     !digest(context.candidate_sha256)||!guid(context.tenant_id)||
     !guid(context.store_a)||!guid(context.store_b)||context.store_a===context.store_b)
     return DENIED('CANONICAL_SCOPE_NOT_ESTABLISHED');
  if(!attestations||!trustedPins||!Number.isSafeInteger(now))
     return DENIED('INDEPENDENT_EVIDENCE_MISSING',roles);
  const result=roles.map(r=>verifyOne(attestations[r],trustedPins[r],r,context,now));
  const missing=roles.filter((r,i)=>!result[i]).map(x=>x+'_SIGNED_PROOF_INVALID');
  if(missing.length)return DENIED('INDEPENDENT_SIGNATURE_CHECK_FAILED',missing);
  if(new Set(result.map(x=>x.issuer_ref)).size!==3||
     new Set(result.map(x=>x.nonce)).size!==3||
     new Set(roles.map(r=>trustedPins[r]?.publicKeyPem)).size!==3||
     new Set(roles.map(r=>trustedPins[r]?.kid)).size!==3)
    return DENIED('SIGNER_INDEPENDENCE_FAILED');
  // Even a valid packet may be entirely synthetic or self-signed if the external
  // trust registry is not attested. No mutation may be inferred from this check.
  return Object.freeze({
    ...DENIED('EXTERNAL_TRUST_REGISTRY_AND_RESTORE_REQUIRED'),
    status:'SIGNED_PACKET_REVIEW_READY_NOT_GO',
    signed_packet_valid:true,
  });
 }catch{return DENIED('FAIL_CLOSED');}
}
export const actualMigrationDecision=()=>DENIED('REAL_STAGING_RESTORE_AND_AUTHORITY_NOT_ACCEPTED');
