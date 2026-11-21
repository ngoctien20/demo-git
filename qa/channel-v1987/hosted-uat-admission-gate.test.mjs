import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {evaluateHostedOwnerPreflight} from './hosted-uat-admission-gate.mjs';
const evidencePath = new URL('./READONLY_PREFLIGHT_EVIDENCE_20261119.json',import.meta.url);
const baseline = JSON.parse(readFileSync(evidencePath,'utf8'));
const deepCopy=x=>JSON.parse(JSON.stringify(x));
const audit=evaluateHostedOwnerPreflight(baseline);
assert.equal(audit.status,'BLOCKED','true audited baseline must BLOCK');
assert.equal(audit.decision,'NO_GO');
for(const reason of [
 'NO_APPROVED_DISPOSABLE_HOSTED_TARGET',
 'REAL_OWNER_A_B_SIGNED_API_SESSIONS_NOT_TESTED',
 'CANONICAL_STORE_AUTHORITY_MISSING',
 'NO_SAME_TENANT_STORE_A_B',
 'COMMERCE_STORE_COLUMNS_INCOMPLETE',
 'HOSTED_STORE_RLS_NOT_VERIFIED',
 'REAL_BOT_INSTALLATION_OWNER_AUTHORITY_UNVERIFIED',
 'SECURITY_ADVISOR_WARNINGS_NOT_REVIEWED'
])assert.ok(audit.reasons.includes(reason),'required actual blocker '+reason);
assert.ok(audit.reasons.length>=12,'audited hosted UAT is not silently admitted');
function base() {
 const e=deepCopy(baseline);
 e.project.status='ACTIVE_HEALTHY';
 e.project.isolatedDisposableSameTenantStoreProjectAvailable=true;
 e.ownerMetadata.qaTenantA.activeOwnerMemberships=1;
 e.ownerMetadata.qaTenantA.ownerAuthAccountsPresent=1;
 e.ownerMetadata.qaTenantB.activeOwnerMemberships=2;
 e.ownerMetadata.qaTenantB.ownerAuthAccountsPresent=2;
 e.ownerMetadata.sharedActiveOwnerAccountsAcrossQaTenants=0;
 e.ownerMetadata.realOwnerAPIBearerSessionTested=true;
 e.ownerMetadata.realOwnerBAPIBearerSessionTested=true;
 e.storeAuthority.canonicalStoresTablePresent=true;
 e.storeAuthority.canonicalStoreMembershipsTablePresent=true;
 e.storeAuthority.sameTenantTwoStoreFixturePresent=true;
 e.storeAuthority.protectedCommerceTablesInspected=6;
 e.storeAuthority.protectedCommerceTablesWithStoreId=6;
 e.storeAuthority.storeScopedRlsHostedVerified=true;
 e.storeAuthority.ownerApprovedBackfill=true;
 e.botAndCatalog.actualBotBoundToCanonicalStore=true;
 e.botAndCatalog.realOwnerConsentVerified=true;
 e.botAndCatalog.registryContainsOnlySyntheticQaBots=false;
 e.botAndCatalog.existingPublishedCommerceCatalogIsTenantScoped=false;
 e.botAndCatalog.hostedProtectedCatalogReaderVerified=true;
 e.botAndCatalog.providerSendEnabledForThisPath=false;
 e.securityPreflight.warningsReviewedAndAccepted=true;
 e.isolationAndApprovals.backupRestoreVerified=true;
 e.isolationAndApprovals.disposableHostedTargetApproved=true;
 e.isolationAndApprovals.ownerApprovedMigration=true;
 e.isolationAndApprovals.realJWTTestPlanAuthorized=true;
 e.isolationAndApprovals.storeWriterCompatibilityAudited=true;
 e.isolationAndApprovals.productionTouchAuthorized=false;
 return e;
}
const cases=[
 ['invalid null',()=>null,'EVIDENCE_NOT_SAFE_OR_NOT_METADATA'],
 ['wrong evidence source',x=>{x.evidenceType='CUSTOMER_CHAT'},'EVIDENCE_NOT_SAFE_OR_NOT_METADATA'],
 ['PII present',x=>{x.containsPII=true},'EVIDENCE_NOT_SAFE_OR_NOT_METADATA'],
 ['secret present',x=>{x.containsSecrets=true},'EVIDENCE_NOT_SAFE_OR_NOT_METADATA'],
 ['fake live jwt verification marker',x=>{x.liveUserJwtVerified=true},'EVIDENCE_NOT_SAFE_OR_NOT_METADATA'],
 ['missing group',x=>{delete x.storeAuthority},'MISSING_EVIDENCE_GROUP'],
 ['unhealthy project',x=>{x.project.status='RESTORING'},'SUPABASE_PROJECT_NOT_HEALTHY'],
 ['no disposable hosted project',x=>{x.project.isolatedDisposableSameTenantStoreProjectAvailable=false},'NO_APPROVED_DISPOSABLE_HOSTED_TARGET'],
 ['Owner A absent',x=>{x.ownerMetadata.qaTenantA.activeOwnerMemberships=0},'QA_OWNER_A_ACCOUNT_NOT_VERIFIED'],
 ['Owner B absent',x=>{x.ownerMetadata.qaTenantB.ownerAuthAccountsPresent=0},'QA_OWNER_B_ACCOUNT_NOT_VERIFIED'],
 ['Owner A API test missing',x=>{x.ownerMetadata.realOwnerAPIBearerSessionTested=false},'REAL_OWNER_A_B_SIGNED_API_SESSIONS_NOT_TESTED'],
 ['Owner B API test missing',x=>{x.ownerMetadata.realOwnerBAPIBearerSessionTested=false},'REAL_OWNER_A_B_SIGNED_API_SESSIONS_NOT_TESTED'],
 ['shared owners not separated',x=>{x.ownerMetadata.sharedActiveOwnerAccountsAcrossQaTenants=1},'OWNER_SESSION_SEPARATION_UNKNOWN'],
 ['canonical stores missing',x=>{x.storeAuthority.canonicalStoresTablePresent=false},'CANONICAL_STORE_AUTHORITY_MISSING'],
 ['Store membership missing',x=>{x.storeAuthority.canonicalStoreMembershipsTablePresent=false},'CANONICAL_STORE_AUTHORITY_MISSING'],
 ['no two stores same tenant',x=>{x.storeAuthority.sameTenantTwoStoreFixturePresent=false},'NO_SAME_TENANT_STORE_A_B'],
 ['only some Commerce tables scoped',x=>{x.storeAuthority.protectedCommerceTablesWithStoreId=5},'COMMERCE_STORE_COLUMNS_INCOMPLETE'],
 ['hosted store RLS absent',x=>{x.storeAuthority.storeScopedRlsHostedVerified=false},'HOSTED_STORE_RLS_NOT_VERIFIED'],
 ['backfill proof missing',x=>{x.storeAuthority.ownerApprovedBackfill=false},'OWNER_APPROVED_BACKFILL_MISSING'],
 ['bot binding missing',x=>{x.botAndCatalog.actualBotBoundToCanonicalStore=false},'REAL_BOT_INSTALLATION_OWNER_AUTHORITY_UNVERIFIED'],
 ['owner consent missing',x=>{x.botAndCatalog.realOwnerConsentVerified=false},'REAL_BOT_INSTALLATION_OWNER_AUTHORITY_UNVERIFIED'],
 ['synthetic registry only',x=>{x.botAndCatalog.registryContainsOnlySyntheticQaBots=true},'BOT_REGISTRY_STILL_SYNTHETIC_ONLY'],
 ['tenant wide catalog fallback',x=>{x.botAndCatalog.existingPublishedCommerceCatalogIsTenantScoped=true},'TENANT_WIDE_CATALOG_FALLBACK_UNSAFE'],
 ['hosted protected reader unverified',x=>{x.botAndCatalog.hostedProtectedCatalogReaderVerified=false},'HOSTED_PROTECTED_CATALOG_READER_UNVERIFIED'],
 ['provider send enabled',x=>{x.botAndCatalog.providerSendEnabledForThisPath=true},'UNAPPROVED_PROVIDER_SEND_ENABLED'],
 ['security warnings not triaged',x=>{x.securityPreflight.warningsReviewedAndAccepted=false},'SECURITY_ADVISOR_WARNINGS_NOT_REVIEWED'],
 ['backup not proven',x=>{x.isolationAndApprovals.backupRestoreVerified=false},'BACKUP_RESTORE_EVIDENCE_MISSING'],
 ['disposable target unapproved',x=>{x.isolationAndApprovals.disposableHostedTargetApproved=false},'ISOLATED_HOSTED_TEST_TARGET_NOT_APPROVED'],
 ['schema change unapproved',x=>{x.isolationAndApprovals.ownerApprovedMigration=false},'SCHEMA_CHANGE_NOT_APPROVED'],
 ['JWT UAT unapproved',x=>{x.isolationAndApprovals.realJWTTestPlanAuthorized=false},'JWT_UAT_PLAN_NOT_APPROVED'],
 ['legacy writers unknown',x=>{x.isolationAndApprovals.storeWriterCompatibilityAudited=false},'LEGACY_WRITER_COMPATIBILITY_UNKNOWN'],
 ['unauthorized production change',x=>{x.isolationAndApprovals.productionTouchAuthorized=true},'PRODUCTION_CHANGE_UNAUTHORIZED_OR_REQUESTED']
];
let passed=1;
for(const [name,mutate,reason] of cases) {
 const x=name==='invalid null'?null:base();
 if(x)mutate(x);
 const output=evaluateHostedOwnerPreflight(x);
 assert.equal(output.decision,'NO_GO',name+' decision');
 assert.ok(output.reasons.includes(reason),name+' expected blocker');
 assert.equal(output.hostedUatAuthorized,false,name+' hosted never authorized');
 assert.equal(output.canReadHosted,false,name+' read never authorized');
 assert.equal(output.canSend,false,name+' send never authorized');
 assert.equal(output.canWrite,false,name+' write never authorized');
 assert.equal(output.realOwnerJwtVerified,false,name+' never assert jwt');
 assert.equal(output.providerSends,0,name+' no sends');
 assert.equal(output.orderWrites,0,name+' no orders');
 assert.equal(output.migrationsApplied,0,name+' no migrations');
 passed++;
}
const hypothetical=evaluateHostedOwnerPreflight(base());
assert.equal(hypothetical.status,'MANUAL_SECURITY_REVIEW_REQUIRED');
assert.equal(hypothetical.decision,'NO_GO');
assert.equal(hypothetical.hostedUatAuthorized,false);
assert.equal(hypothetical.realOwnerJwtVerified,false);
passed++;
console.log('TIEN404_V1987_READONLY_HOSTED_OWNER_PREFLIGHT_PASS='+passed);
console.log('TIEN404_V1987_CURRENT_HOSTED_ADMISSION='+audit.decision);
console.log('TIEN404_V1987_CURRENT_BLOCKER_COUNT='+audit.reasons.length);
