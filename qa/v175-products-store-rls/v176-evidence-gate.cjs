'use strict';
/* TIEN404 V17.6. Offline classification only. No DB access, JWTs or approval semantics. */
const PROJECT = 'ifxlvrhyjhbzbrkdsida';
const TABLES = Object.freeze(['conversations','customers','messages','order_items','orders','products']);
const HISTORICAL = 'H11R_PARTIAL_APPLICATION_ARCHIVE_LOCAL_QA_OWNER_ACCEPTED_WITH_LIMITATIONS';
const isCount = x => Number.isSafeInteger(x) && x >= 0;
const unique = xs => [...new Set(xs)].sort();
function classify(snapshot, selfReport = {}) {
  const errors = [];
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot) || snapshot.projectRef !== PROJECT || snapshot.capturedDateJst !== '2026-11-17')
    errors.push('SOURCE_PROJECT_OR_CAPTURE_NOT_GROUNDED');
  const o = snapshot?.owner || {};
  const required = ['tenants','products','orders','customers','allMemberships','activeOwnerMemberships','authUsers','storageBuckets','storageObjects','tenantsWithProductOrderOwner'];
  if (!required.every(k => isCount(o[k]))) errors.push('CURRENT_OWNER_COUNTS_INVALID');
  const structurallyPresent = o.tenants === 2 && o.products === 2 && o.orders === 2 && o.customers === 0 && o.allMemberships === 3 && o.activeOwnerMemberships === 3 && o.authUsers === 3 && o.storageBuckets === 0 && o.storageObjects === 0 && o.tenantsWithProductOrderOwner === 2;
  if (!structurallyPresent) errors.push('CURRENT_TENANT_OWNER_SNAPSHOT_CHANGED_OR_UNVERIFIED');
  const rows = snapshot?.tables;
  if (!Array.isArray(rows) || rows.length !== TABLES.length || rows.some(x => !x || typeof x.name !== 'string') || JSON.stringify(unique(rows.map(x => x.name))) !== JSON.stringify(TABLES))
    errors.push('SIX_SURFACE_INVENTORY_INVALID');
  const six = Array.isArray(rows) && rows.length === TABLES.length && rows.every(x => x && x.rls === true && x.forceRls === true && x.hasStoreId === false && x.policyCount === 1 && x.permissiveCount === 1 && x.storeQualifiedPolicies === 0 && x.anonSelect === false && x.authSelect === true);
  if (!six) errors.push('HOSTED_STORE_RLS_OWNERSHIP_NOT_PRESENT_OR_CHANGED');
  if (snapshot?.canonicalStoresPresent !== false || snapshot?.storeMembershipsPresent !== false)
    errors.push('CANONICAL_STORE_SCHEMA_STATE_CHANGED_OR_NOT_GROUNDED');
  if (snapshot?.historicalH11R !== HISTORICAL || snapshot?.historicalApplicationEntries !== 5 || snapshot?.historicalAuthEntries !== 0 || snapshot?.historicalStorageEntries !== 0)
    errors.push('H11R_LIMITED_RECOVERY_HISTORY_NOT_RECONCILED');
  // This classifier receives no primary signed sources, physical backup, restore logs,
  // authenticated JWT, 4-row merchant proof, or Security Reviewer authority.
  // Do not accept approvals as self-reported data, even if every flag is true.
  const blockers = unique([...errors,
    'FOUR_ORIGINAL_STORE_OWNER_ROWS_NOT_INDEPENDENTLY_ATTESTED',
    'CURRENT_HOSTED_BACKUP_AND_ISOLATED_RESTORE_NOT_CERTIFIED',
    'AUTH_AND_STORAGE_RECOVERY_NOT_CERTIFIED',
    'CANONICAL_STORE_AND_SIX_SURFACE_RLS_NOT_READY',
    'TWO_REAL_SAME_TENANT_STORE_JWTS_NOT_TESTED',
    'M1_CONTROLLER_REVIEWER_OPERATOR_AUTHORITY_NOT_VERIFIED']);
  return Object.freeze({
    contract: 'T404_V176_M0_OWNER_RECOVERY_JWT_READONLY_V1',
    status: 'HOSTED_M0_STORE_JWT_NO_GO',
    snapshotStructurallyMatchesReadOnlyBaseline: errors.length === 0,
    tenantOwnerMembershipObserved: structurallyPresent,
    originalStoreOwnershipVerified: false,
    historicalH11RApplicationOnlyAcceptedWithLimitations: snapshot?.historicalH11R === HISTORICAL,
    historicalH11RProvesCurrentHostedRecovery: false,
    actualCurrentBackupInspected: false,
    isolatedRestoreTested: false,
    authRecoveryCertified: false,
    storageRecoveryCertified: false,
    realJwtStoreIsolationTested: false,
    selfReportCanAuthorize: false,
    sourceRecordsOrTokensEmitted: false,
    canApplyM1: false,
    canBackfill: false,
    canAlterRls: false,
    canCommitOrder: false,
    canRevokeRpc: false,
    canPublish: false,
    blockers
  });
}
module.exports = Object.freeze({PROJECT,TABLES,HISTORICAL,classify});
