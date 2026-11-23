/**
 * V21.11 — Credential-free, OFFLINE evidence checklist.
 * This is NOT an authorization system. Even an apparently complete evidence packet
 * cannot apply SQL, issue a Meta Page proof, enable reaction or publish policies.
 * An evidence digest or a user-provided "VERIFIED" flag is not an attestation.
 */
export const V2111_EVIDENCE_FORMAT='t404.reaction.v2111.evidence-review.v1';
const REQUIRED=[
 'meta_test_app_authority',
 'meta_page_oauth_graph_get',
 'owner_a_b_signed_auth_uat',
 'fresh_staging_encrypted_backup',
 'same_artifact_disposable_restore',
 'reaction_schema_security_review',
 'explicit_staging_migration_approval',
];
const STATES=new Set(['BLOCKED','PROPOSED','TESTED','VERIFIED']);
const SHA=/^[0-9a-f]{64}$/;
const REF=/^(?:t404-evidence:\/\/[a-z0-9][a-z0-9._\/-]{8,120}|https:\/\/github\.com\/ngoctien20\/demo-git\/actions\/runs\/[0-9]{8,})$/;
const FIELDS=['status','evidence_ref','sha256','captured_at','reviewed_by_role'];
const cleanRecord=(r)=>{
  if(!r||typeof r!=='object'||Array.isArray(r))return false;
  if(Object.keys(r).some(k=>!FIELDS.includes(k)))return false;
  if(!STATES.has(r.status))return false;
  if(r.status==='VERIFIED'){
    return typeof r.evidence_ref==='string'&&REF.test(r.evidence_ref) &&
      SHA.test(r.sha256||'') &&
      typeof r.captured_at==='string' &&
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(r.captured_at) &&
      r.reviewed_by_role==='independent_security_reviewer';
  }
  return (r.evidence_ref===null||r.evidence_ref===undefined) &&
    (r.sha256===null||r.sha256===undefined) &&
    (r.captured_at===null||r.captured_at===undefined) &&
    (r.reviewed_by_role===null||r.reviewed_by_role===undefined);
};
export function reviewV2111EvidencePacket(packet,now=new Date()){
  const blockers=[];
  const block=(gate,reason)=>blockers.push(Object.freeze({gate,reason}));
  const validNow=now instanceof Date&&!Number.isNaN(now.getTime());
  if(!validNow)block('clock','invalid_clock');
  if(!packet||typeof packet!=='object'||Array.isArray(packet)||
     packet.format!==V2111_EVIDENCE_FORMAT ||
     Object.keys(packet).some(k=>!['format','project','gates'].includes(k)) ||
     packet.project!=='tien404-staging' ||
     !packet.gates||typeof packet.gates!=='object'||Array.isArray(packet.gates) ||
     Object.keys(packet.gates).some(k=>!REQUIRED.includes(k))){
    block('manifest','untrusted_or_invalid_packet');
  }
  for(const gate of REQUIRED){
    const record=packet?.gates?.[gate];
    if(!cleanRecord(record)){
      block(gate,'invalid_or_missing_proof_record');
      continue;
    }
    if(record.status!=='VERIFIED'){
      block(gate,'independent_verified_evidence_missing');
      continue;
    }
    // A snapshot can be forged; these metadata checks are freshness/shape only.
    const ms=Date.parse(record.captured_at);
    if(!validNow||!Number.isFinite(ms)||ms>now.getTime()||
       now.getTime()-ms>24*60*60*1000)
      block(gate,'evidence_too_old_or_future');
  }
  return Object.freeze({
    status:blockers.length?'NO_GO':'INDEPENDENT_REVIEW_REQUIRED',
    blockerCount:blockers.length,
    blockers:Object.freeze(blockers),
    // These stay FALSE even if all static checks look good.
    evidenceOnly:true,
    liveMetaProofConfirmed:false,
    realOwnerJwtConfirmed:false,
    sameArtifactRestoreConfirmed:false,
    canApplyStagingMigration:false,
    canIssueMetaInstallationProof:false,
    canEnableReaction:false,
    canSendMetaReaction:false,
    requiresTrustedSourceVerification:true,
    requiresSeparateOwnerApproval:true,
  });
}
