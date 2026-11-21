/**
 * TIEN404 V19.8.7 — Hosted Owner A/B UAT PREFLIGHT (metadata ONLY).
 *
 * This file can only report missing prerequisites. It NEVER proves owner JWT,
 * authorizes hosted API reads, modifies Supabase, or admits a real Bot.
 * Passing every checklist item means MANUAL_SECURITY_REVIEW_REQUIRED, NOT GO.
 */
const fail = (reason)=>({
 status:'INVALID_PREFLIGHT',decision:'NO_GO',reasons:[reason],
 realOwnerJwtVerified:false,hostedUatAuthorized:false,
 providerSends:0,orderWrites:0,migrationsApplied:0,
 canReadHosted:false,canSend:false,canWrite:false
});
export function evaluateHostedOwnerPreflight(e) {
 if(!e||typeof e!=='object'||Array.isArray(e)||
    e.evidenceType!=='SANITIZED_READONLY_METADATA_SNAPSHOT_NOT_AUTHORIZATION'||
    e.containsPII!==false||e.containsSecrets!==false||
    e.liveUserJwtVerified!==false) return fail('EVIDENCE_NOT_SAFE_OR_NOT_METADATA');
 const p=e.project,o=e.ownerMetadata,s=e.storeAuthority,b=e.botAndCatalog,
       sec=e.securityPreflight,a=e.isolationAndApprovals;
 if(!p||!o||!s||!b||!sec||!a||typeof e.checkpoint!=='string')return fail('MISSING_EVIDENCE_GROUP');
 const reasons=[];
 const requireState=(condition,reason)=>{if(!condition)reasons.push(reason)};
 requireState(p.status==='ACTIVE_HEALTHY','SUPABASE_PROJECT_NOT_HEALTHY');
 requireState(p.isolatedDisposableSameTenantStoreProjectAvailable===true,'NO_APPROVED_DISPOSABLE_HOSTED_TARGET');
 requireState(o.qaTenantA?.activeOwnerMemberships>=1&&o.qaTenantA?.ownerAuthAccountsPresent>=1,'QA_OWNER_A_ACCOUNT_NOT_VERIFIED');
 requireState(o.qaTenantB?.activeOwnerMemberships>=1&&o.qaTenantB?.ownerAuthAccountsPresent>=1,'QA_OWNER_B_ACCOUNT_NOT_VERIFIED');
 // Prior sign-in records and auth.sessions are metadata; they DO NOT fulfill this gate.
 requireState(o.realOwnerAPIBearerSessionTested===true&&o.realOwnerBAPIBearerSessionTested===true,
   'REAL_OWNER_A_B_SIGNED_API_SESSIONS_NOT_TESTED');
 requireState(o.sharedActiveOwnerAccountsAcrossQaTenants===0,'OWNER_SESSION_SEPARATION_UNKNOWN');
 requireState(s.canonicalStoresTablePresent===true&&s.canonicalStoreMembershipsTablePresent===true,
   'CANONICAL_STORE_AUTHORITY_MISSING');
 requireState(s.sameTenantTwoStoreFixturePresent===true,'NO_SAME_TENANT_STORE_A_B');
 requireState(s.protectedCommerceTablesWithStoreId>=s.protectedCommerceTablesInspected
   && s.protectedCommerceTablesInspected>=6,'COMMERCE_STORE_COLUMNS_INCOMPLETE');
 requireState(s.storeScopedRlsHostedVerified===true,'HOSTED_STORE_RLS_NOT_VERIFIED');
 requireState(s.ownerApprovedBackfill===true,'OWNER_APPROVED_BACKFILL_MISSING');
 requireState(b.actualBotBoundToCanonicalStore===true&&b.realOwnerConsentVerified===true,
   'REAL_BOT_INSTALLATION_OWNER_AUTHORITY_UNVERIFIED');
 requireState(b.registryContainsOnlySyntheticQaBots===false,'BOT_REGISTRY_STILL_SYNTHETIC_ONLY');
 requireState(b.existingPublishedCommerceCatalogIsTenantScoped===false,'TENANT_WIDE_CATALOG_FALLBACK_UNSAFE');
 requireState(b.hostedProtectedCatalogReaderVerified===true,'HOSTED_PROTECTED_CATALOG_READER_UNVERIFIED');
 requireState(b.providerSendEnabledForThisPath===false,'UNAPPROVED_PROVIDER_SEND_ENABLED');
 requireState(sec.warningsReviewedAndAccepted===true,'SECURITY_ADVISOR_WARNINGS_NOT_REVIEWED');
 requireState(a.backupRestoreVerified===true,'BACKUP_RESTORE_EVIDENCE_MISSING');
 requireState(a.disposableHostedTargetApproved===true,'ISOLATED_HOSTED_TEST_TARGET_NOT_APPROVED');
 requireState(a.ownerApprovedMigration===true,'SCHEMA_CHANGE_NOT_APPROVED');
 requireState(a.realJWTTestPlanAuthorized===true,'JWT_UAT_PLAN_NOT_APPROVED');
 requireState(a.storeWriterCompatibilityAudited===true,'LEGACY_WRITER_COMPATIBILITY_UNKNOWN');
 requireState(a.productionTouchAuthorized===false,'PRODUCTION_CHANGE_UNAUTHORIZED_OR_REQUESTED');
 const unique=[...new Set(reasons)];
 return {
  status:unique.length?'BLOCKED':'MANUAL_SECURITY_REVIEW_REQUIRED',
  decision:'NO_GO',
  reasons:unique,
  realOwnerJwtVerified:false, // cannot infer from caller-supplied JSON
  hostedUatAuthorized:false, // a human-owned protected approval gate
  providerSends:0,orderWrites:0,migrationsApplied:0,
  canReadHosted:false,canSend:false,canWrite:false,
  disclaimer:'Only a verified human-approved hosted test using REAL signed Owner A/B JWTs can supply independent UAT evidence.'
 };
}
