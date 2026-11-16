/**
 * TIEN404 V16.4D: strict offline operator evidence attestation with Ed25519.
 * This package is PUBLIC source only. Do not store proofs, project IDs, keys,
 * customer messages, organization accounts, operator names or signatures here.
 * Caller-supplied trust roots are NOT independent proof of account ownership.
 */
import {createHash,createPublicKey,verify as cryptoVerify} from 'node:crypto';
import {MODEL_CATALOG} from '../v164-private-ab/model-catalog-readiness.mjs';
export const CONTRACT='T404_V164D_PRIVATE_OPERATOR_EVIDENCE_V1';
export const KINDS=Object.freeze([
 'PRIVATE_8_CASE_CONSENT','PRIVATE_GOLD_APPROVAL','PROVIDER_MODEL_VISIBILITY',
 'PROVIDER_RATE_LIMITS','PROVIDER_BILLING_CAP','PROVIDER_DATA_TERMS',
 'INDEPENDENT_REVIEWER_AUTHORITY','ATOMIC_BUDGET_STOP_TEST',
 'FROZEN_TOOL_MOCKS','HOSTED_STORE_SECURITY_READINESS'
]);
const exact=(obj,fields)=>!!obj&&typeof obj==='object'&&!Array.isArray(obj)
 && Object.keys(obj).length===fields.length&&fields.every(k=>Object.hasOwn(obj,k));
const assert=(cond,message)=>{if(!cond)throw Error(message)};
const HEX=/^[0-9a-f]{64}$/;
const QA=/^QA_[A-Z0-9_]{2,40}$/;
const FIELDS=['contract','kind','evidence_id','provider','model_id','route','subject_case',
 'source_sha256','issued_at_utc','expires_at_utc','operator_id','reviewer_id',
 'trust_key_fingerprint_sha256','signature_base64'];
function validUtc(x){return typeof x==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(x)
  &&!Number.isNaN(Date.parse(x))&&new Date(x).toISOString().replace('.000Z','Z')===x}
function candidate(provider,id){
 return MODEL_CATALOG.find(x=>x.provider===provider&&x.model_id===id);
}
export function normalizeEvidence(item,{now_ms=Date.parse('2026-11-16T13:00:00Z')}={}){
 assert(exact(item,FIELDS),'STRICT_EVIDENCE_SCHEMA_REQUIRED');
 assert(item.contract===CONTRACT,'EVIDENCE_CONTRACT_DRIFT');
 assert(KINDS.includes(item.kind),'UNKNOWN_EVIDENCE_KIND');
 assert(typeof item.evidence_id==='string'&&/^QA_EVIDENCE_[A-Z0-9_]{2,48}$/.test(item.evidence_id),'QA_EVIDENCE_ID_REQUIRED');
 assert(['openai','google','none'].includes(item.provider),'PROVIDER_REQUIRED');
 assert(item.provider==='none'?item.model_id===null:!!candidate(item.provider,item.model_id),'PROVIDER_MODEL_MISMATCH');
 assert(['DIRECT_PROVIDER','N8N_GATEWAY','INTERNAL_PRIVATE'].includes(item.route),'EXPLICIT_ROUTE_REQUIRED');
 assert(item.provider==='none'?item.route==='INTERNAL_PRIVATE':item.route!=='INTERNAL_PRIVATE','ROUTE_MODEL_SCOPE_MISMATCH');
 assert(item.subject_case===null||/^SINGLE:QA\d{2}$|^MULTI:QA\d{2}$/.test(item.subject_case),
   'QA_CASE_ONLY');
 assert(typeof item.source_sha256==='string'&&HEX.test(item.source_sha256),'SOURCE_SHA256_REQUIRED');
 assert(validUtc(item.issued_at_utc)&&validUtc(item.expires_at_utc),'TIMESTAMP_REQUIRED');
 const start=Date.parse(item.issued_at_utc),end=Date.parse(item.expires_at_utc);
 assert(Number.isFinite(now_ms)&&start<=now_ms&&end>now_ms&&end-start<=7*86400000,
  'STALE_FUTURE_OR_OVERLONG_EVIDENCE');
 assert(QA.test(item.operator_id)&&QA.test(item.reviewer_id)
  &&item.operator_id!==item.reviewer_id,'INDEPENDENT_ROLE_MARKERS_REQUIRED');
 assert(HEX.test(item.trust_key_fingerprint_sha256),'TRUST_KEY_FINGERPRINT_REQUIRED');
 assert(typeof item.signature_base64==='string'&&/^[A-Za-z0-9+/]{86}==$/.test(item.signature_base64),
  'ED25519_SIGNATURE_FORMAT_REQUIRED');
 return Object.freeze({...item});
}
export function canonicalPayload(item){
 const copy=Object.fromEntries(FIELDS.filter(k=>k!=='signature_base64').map(k=>[k,item[k]]));
 return JSON.stringify(copy);
}
export function verifySignedIndex(item,{trusted_public_key_pem=null,now_ms}={}){
 const normalized=normalizeEvidence(item,{now_ms});
 if(trusted_public_key_pem===null)return Object.freeze({
   status:'BLOCKED_NO_PINNED_PRIVATE_TRUST_ROOT',
   cryptographically_verified:false,human_authority_verified:false,
   account_entitlement_verified:false,provider_call_allowed:false});
 let key;
 try{key=createPublicKey(trusted_public_key_pem)}catch{
  throw Error('INVALID_PUBLIC_KEY_INPUT');
 }
 assert(key.asymmetricKeyType==='ed25519','ED25519_KEY_REQUIRED');
 const keyDer=key.export({type:'spki',format:'der'});
 const fingerprint=createHash('sha256').update(keyDer).digest('hex');
 assert(fingerprint===normalized.trust_key_fingerprint_sha256,'TRUST_KEY_FINGERPRINT_MISMATCH');
 const verified=cryptoVerify(null,Buffer.from(canonicalPayload(normalized)),
  key,Buffer.from(normalized.signature_base64,'base64'));
 return Object.freeze({status:verified?'CRYPTOGRAPHIC_SIGNATURE_VALID_ROOT_NOT_EXTERNALLY_ATTESTED':
  'INVALID_EVIDENCE_SIGNATURE',
  cryptographically_verified:verified,
  human_authority_verified:false,source_snapshot_verified:false,
  real_account_screen_verified:false,account_entitlement_verified:false,
  provider_call_allowed:false,signature_does_not_mean_billing_approved:true});
}
export function indexEvidenceBundle(records,{now_ms=Date.parse('2026-11-16T13:00:00Z')}={}){
 assert(Array.isArray(records)&&records.length<=50,'EVIDENCE_BUNDLE_BOUND');
 const ids=new Set(),rows=[];
 for(const rec of records){
  const n=normalizeEvidence(rec,{now_ms});
  assert(!ids.has(n.evidence_id),'DUPLICATE_EVIDENCE_ID');
  ids.add(n.evidence_id);
  rows.push(Object.freeze({id:n.evidence_id,kind:n.kind,provider:n.provider,
   route:n.route,subject_case:n.subject_case,
   index_unverified:true,source_sha256:n.source_sha256}));
 }
 return Object.freeze({contract:CONTRACT,indexed:rows.length,
  evidence_kind_count:new Set(rows.map(x=>x.kind)).size,
  metadata_only_rows:Object.freeze(rows),
  source_text_or_private_keys_included:false,
  real_operator_identity_verified:false,
  account_or_consent_certified:false,
  provider_api_allowed:false});
}
export const readProviderCredentials=()=>{throw Error('V164D_NO_CREDENTIAL_READ')};
export const impersonateReviewer=()=>{throw Error('V164D_NO_SELF_CERTIFIED_ATTESTATION')};
