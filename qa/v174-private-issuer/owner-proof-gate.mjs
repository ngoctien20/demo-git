/**
 * TIEN404 V17.4 — independent Store/Website installation owner evidence contract.
 * Cryptographic attestation integrity != independent domain/merchant ownership.
 * This module never authorizes a real customer or hosted Commerce Store.
 */
import {createHmac,timingSafeEqual} from 'node:crypto';
export const OWNER_CONTRACT='T404_V174_OWNER_PROOF_GATE_V1';
const text=x=>typeof x==='string';
const id=x=>text(x)&&/^[A-Za-z0-9_-]{6,100}$/.test(x);
const eq=(a,b)=>text(a)&&text(b)&&Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
const canonical=p=>JSON.stringify([p.version,p.installation_ref,p.store_ref,p.tenant_ref,
 p.bot_ref,p.domain,p.owner_ref,p.domain_challenge_ref,p.issued_at,p.expires_at,p.state]);
export function signOperatorAttestationForOfflineQa({proof,fixtureKey}={}){
 if(!text(fixtureKey)||Buffer.byteLength(fixtureKey)<32)throw Error('FIXTURE_KEY_MISSING');
 return createHmac('sha256',fixtureKey).update(canonical(proof)).digest('hex');
}
export function evaluateInstallationOwner({binding,attestation,verificationKey,now=Date.now(),rejectedProofs=new Set()}={}){
 const block=(reason)=>Object.freeze({contract:OWNER_CONTRACT,status:'BLOCKED',reason,
  attestation_integrity_verified:false,merchant_owner_independently_verified:false,
  domain_control_independently_verified:false,hosted_store_rls_verified:false,
  allow_real_website_session:false});
 if(!Number.isSafeInteger(now)||!binding||!id(binding.installation_ref)||!id(binding.store_ref)||
 !id(binding.tenant_ref)||!id(binding.bot_ref))return block('INVALID_INSTALLATION');
 if(binding.approval_scope==='SYNTHETIC_ONLY'&&binding.owner_authority_verified===false)
  return Object.freeze({...block('SYNTHETIC_QA_ONLY'),status:'QA_FIXTURE_ONLY'});
 if(binding.approval_scope!=='OWNER_APPROVED'||binding.owner_authority_verified!==true||
 binding.status!=='OWNER_APPROVED'||binding.read_only!==true)return block('OWNER_APPROVAL_MISSING');
 if(!attestation||attestation.version!==1||attestation.state!=='OWNER_APPROVED'||
 !id(attestation.owner_ref)||!id(attestation.domain_challenge_ref)||
 !text(attestation.signature)||!text(verificationKey)||Buffer.byteLength(verificationKey)<32||
 !Number.isSafeInteger(attestation.issued_at)||!Number.isSafeInteger(attestation.expires_at)||
 attestation.expires_at-attestation.issued_at>86400||
 attestation.expires_at<=Math.floor(now/1000)||attestation.issued_at>Math.floor(now/1000)+30)
 return block('PRIVATE_ATTESTATION_MISSING_EXPIRED');
 const fields=['installation_ref','store_ref','tenant_ref','bot_ref'];
 if(fields.some(k=>attestation[k]!==binding[k])||attestation.domain!==binding.origin)
 return block('OWNER_ATTESTATION_SCOPE_MISMATCH');
 if(rejectedProofs?.has(attestation.domain_challenge_ref))return block('ATTESTATION_REVOKED');
 const expected=createHmac('sha256',verificationKey).update(canonical(attestation)).digest('hex');
 if(!eq(attestation.signature,expected))return block('ATTESTATION_SIGNATURE_INVALID');
 return Object.freeze({contract:OWNER_CONTRACT,status:'ATTESTATION_INTEGRITY_VALID_BUT_OWNER_UNVERIFIED',
  reason:'DOMAIN_CONTROL_AND_MERCHANT_OWNER_REQUIRE_INDEPENDENT_CONTROL_PLANE_EVIDENCE',
  attestation_integrity_verified:true,merchant_owner_independently_verified:false,
  domain_control_independently_verified:false,hosted_store_rls_verified:false,
  allow_real_website_session:false});
}
