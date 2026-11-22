/**
 * TIEN404 V21.8 — Evidence REVIEW worksheet, NOT an authorization service.
 * Zero I/O: no Meta requests, Supabase writes, JWTs, SQL, secrets or deployments.
 * Its input may be client-supplied: even a fully green report can ONLY request
 * human security review. No function may use this report as permission to deploy.
 */
const HEX64=/^[a-f0-9]{64}$/;
const HEX32=/^[a-f0-9]{32}$/;
const checked=(x)=>x===true;
const validEpoch=(x)=>Number.isSafeInteger(x)&&x>0;
const ageWithin=(now,at,hours)=>validEpoch(at)&&at<=now&&now-at<=hours*3600*1000;

export function reviewV218ReactionStagingAdmission(evidence={},nowMs=Date.now()){
  const blocks=[];
  const block=(id,reason)=>blocks.push(Object.freeze({id,reason}));
  const db=evidence.db||{};
  if(!validEpoch(nowMs))block('clock','invalid_attestation_clock');
  if(db.projectRef!=='ifxlvrhyjhbzbrkdsida' ||
     db.pgMajor!==17 || !checked(db.configCoreExists) ||
     !checked(db.channelsForcedRls) || !checked(db.anonCannotRead) ||
     !checked(db.authCannotDirectWrite) ||
     !Number.isInteger(db.activeMessengerDemoConnections) ||
     db.activeMessengerDemoConnections<1 ||
     !HEX32.test(db.catalogShapeMd5||'')){
    block('database','staging_registry_or_rls_unverified');
  }
  // Config Core schema exists but tracked migrations were found missing in V21.7.
  // Do not assume DDL is safely replayable; first reconcile provenance/checksums.
  if(!checked(evidence.migrations?.configCoreBaselineReconciled) ||
     !checked(evidence.migrations?.reactionCandidateReviewed) ||
     !checked(evidence.migrations?.grantsAndRlsAudited))
    block('migrations','config_core_migration_drift_unreconciled');

  const meta=evidence.meta||{};
  if(!checked(meta.realOauthAppAttested) || !checked(meta.pageMessagingTaskAttested) ||
     !checked(meta.pageSubscriptionAttested) ||
     !checked(meta.appTokenScopeAttested) ||
     !checked(meta.ownerStorePageBindingAttested) ||
     !checked(meta.challengeClaimedAtomically) ||
     !checked(meta.trustedIssuerReviewed) ||
     !ageWithin(nowMs,meta.verifiedAtMs,24))
    block('meta','real_meta_page_installation_evidence_missing');

  const auth=evidence.auth||{};
  if(!checked(auth.realOwnerAJwt) || !checked(auth.realOwnerBJwt) ||
     !checked(auth.distinctOwnerSessions) ||
     !checked(auth.ownerBIsolatedFromStoreA) ||
     !checked(auth.ownerAIsolatedFromStoreB) ||
     !checked(auth.anonDenied) ||
     !checked(auth.readOnly) ||
     !ageWithin(nowMs,auth.testedAtMs,24))
    block('jwt','real_two_owner_jwt_negative_uat_missing');

  const backup=evidence.backup||{};
  if(!HEX64.test(backup.artifactSha256||'') ||
     !HEX64.test(backup.restoredArtifactSha256||'') ||
     backup.artifactSha256!==backup.restoredArtifactSha256 ||
     !checked(backup.encryptedAndDecryptVerified) ||
     !checked(backup.restoreIntoDisposablePassed) ||
     !checked(backup.readbackValidated) ||
     !HEX32.test(backup.sourceCatalogShapeMd5||'') ||
     backup.sourceCatalogShapeMd5!==db.catalogShapeMd5 ||
     !ageWithin(nowMs,backup.createdAtMs,24) ||
     !ageWithin(nowMs,backup.restoredAtMs,24) ||
     !validEpoch(backup.createdAtMs) ||
     backup.restoredAtMs<backup.createdAtMs)
    block('backup','same_baseline_backup_and_disposable_restore_unproven');

  const authority=evidence.approval||{};
  if(!checked(authority.explicitStagingMigrationApproval) ||
     !checked(authority.securityOwnerReviewed) ||
     !checked(authority.restoreRollbackOwnerReviewed))
    block('approval','explicit_staging_migration_owner_approval_missing');

  return Object.freeze({
    status:blocks.length?'NO_GO':'REVIEW_REQUIRED',
    blockers:Object.freeze(blocks),
    evidenceOnly:true,
    canApplyHostedMigration:false,
    canIssueMetaPageProof:false,
    canPublishReaction:false,
    canSendMetaReaction:false,
    requiresIndependentHumanAuthorization:true,
  });
}
