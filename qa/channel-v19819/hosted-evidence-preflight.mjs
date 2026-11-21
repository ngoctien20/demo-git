// TIEN404 V19.8.19 — pure, OFFLINE evidence-format preflight only.
// This deliberately NEVER authorizes hosted reads, migrations, sends or writes.
// No input is trusted as actual signature or owner proof without external review.
export const requiredGates=Object.freeze([
 'n8nPublishedCallerClosure',
 'cloudflareDeployedCallerClosure',
 'renderPublishedCallerClosure',
 'supabaseRpcEdgeClosure',
 'backupArtifactDigest',
 'isolatedRestoreProof',
 'realOwnerAHostedAuth',
 'realOwnerBHostedAuth',
 'sameTenantDistinctStoreAuthority',
 'providerInstallationRealAttestation',
 'signedRegistryConsentHosted',
 'independentSecurityReview'
]);
const digest=/^sha256:[a-f0-9]{64}$/;
const scope='hosted_staging_readonly_qa_evidence';
function validRecord(v) {
 return !!v && typeof v==='object' && !Array.isArray(v)
 && v.status==='INDEPENDENTLY_VERIFIED'
 && v.scope===scope
 && v.evidence_source==='TRUSTED_OPERATOR_SYSTEM'
 && typeof v.evidence_digest==='string' && digest.test(v.evidence_digest)
 && typeof v.recorded_at==='string' && Number.isFinite(Date.parse(v.recorded_at))
 && typeof v.reference==='string' && /^QA_REF_[A-Z0-9_]{3,64}$/.test(v.reference);
}
function bindingOk(b) {
 if(!b||typeof b!=='object'||Array.isArray(b))return false;
 const fields=['tenant_digest','store_a_digest','store_b_digest','owner_a_digest','owner_b_digest'];
 if(fields.some(f=>typeof b[f]!=='string'||!digest.test(b[f])))return false;
 return b.store_a_digest!==b.store_b_digest
 && b.owner_a_digest!==b.owner_b_digest
 && b.tenant_digest!==b.store_a_digest
 && b.tenant_digest!==b.store_b_digest;
}
export function assessAdmissionEvidence(input){
 const base={canApplyHostedMigration:false,canReadRealCatalog:false,canSendProviderMessage:false,canWriteRealOrders:false};
 if(!input||typeof input!=='object'||Array.isArray(input))
  return Object.freeze({...base,decision:'NO_GO',missing:['evidence_manifest']});
 const missing=[];
 if(input.target_environment!=='isolated_staging')missing.push('approved_isolated_staging_target');
 if(input.intent!=='read_only_owner_admission_preflight')missing.push('read_only_intent');
 if(input.caller_supplied_secrets!==false)missing.push('no_secrets_in_manifest');
 for(const g of requiredGates){
  if(!validRecord(input.gates?.[g]))missing.push(g);
 }
 if(!bindingOk(input.owner_binding))missing.push('distinct_owner_store_binding');
 return Object.freeze({...base,decision:missing.length?'NO_GO':'EVIDENCE_FORMAT_COMPLETE_HUMAN_REVIEW_REQUIRED',missing});
}
