'use strict';
// TIEN404 RPC10-G3T — Real read-only operator eligibility, published caller
// ABI and M0 recovery DECISION AID. This cannot verify a signed JWT, backup,
// source-row Merchant attestation or permit a hosted SQL/n8n/provider action.
// Actual private JSON evidence is handled locally ONLY by existing RPC12
// operator intake (PR #244), never by this public GitHub/CI module.
const {inspect:inspectG3S}=require('./g3s-store-ownership-published-caller-gate.cjs');
const CONTRACT='TIEN404_RPC10_G3T_PRIVATE_FOUR_ROW_CALLER_RECOVERY_ADMISSION_V1';
const EXPECTED_ALIASES=Object.freeze([
 'T1_PRODUCT_1','T1_ORDER_1','T2_PRODUCT_1','T2_ORDER_1'
]);
const EXPECTED_VERSION=Object.freeze({
 '5Eeh8hbpsoNhuiVo':'a99c7350-7aea-446d-bdc5-4b10f52c3ad1',
 'oOOXicKXGkBskKqh':'e0f1e345-8e6c-40cb-8e6a-d7ad2eb92696',
 'igPOsSbEgd4NgtRA':'eff32e20-a6d0-4975-88b8-107eae752b4b',
 'Y0WLykMtNAldbgL0':'3d8b7f89-2058-4a2a-8919-e5ff92c3c484',
 'Z7FdV7uDvApfbURQ':'1064b1b3-d3f1-4a6b-a367-2414ba691522',
 'yIJk8LvJoLF40Z62':'2d912cb0-007f-452f-9536-b92ba12a03e6',
 'sIPs6egzIwOY1GNv':'8d91d23c-cd87-462f-a112-9cca2340bec8'
});
const PERMISSIONS=Object.freeze({
 realMerchantPrimarySourceAuthenticated:false,
 independentReviewerAuthenticated:false,
 realFourRowStoreAssignmentVerified:false,
 realOwnerJwtSessionPairAuthenticated:false,
 realSameTenantStoreABGranted:false,
 realCurrentBackupRestored:false,
 realFullServiceAuthRecoveryVerified:false,
 realStoreAwarePublishedCallerDeployed:false,
 canUseCurrentTenantWriterForStore:false,
 canAssignRealRowStore:false,
 canApplyHostedStoreMigration:false,
 canChangeSqlRlsOrRpc:false,
 canModifyActiveN8n:false,
 canReadRealCustomerOrders:false,
 canRepointProviderWebhook:false,
 canSendProviderMessages:false,
 canPublish:false,
 sourceOnly:true
});
function plain(v){return v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;}
function exact(v,keys){return plain(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));}
const safeCount=v=>Number.isSafeInteger(v)&&v>=0&&v<=100000;
const BASE=['contract','auditDateJst','projectRef','source','canonicalStoreMigrationPr',
 'developmentParentPr','privateOwnerIntakePr','windowsRecoveryToolkitPr',
 'existingRealAuthAdmissionPr','sqlPath','sqlSourceSha',
 'auth','fourRows','published','writer','recovery','action','status'];
const authKeys=['activeTenantMemberships','activeTenantOwnerMemberships',
 'eligibleConfirmedMembers','eligibleMembersWithSessionRecord',
 'tenantsWithTwoEligibleOwnerIds','tenantsWithTwoEligibleOwnerSessionRows',
 'authUsersTotal','independentlyVerifiedRealJwtOwnerPair',
 'twoActualStoreMembershipsSameTenant'];
const rowKeys=['products','orders','customers','customerLinkedOrders',
 'ownerAttestedRowCount','sourceVersionRowDigestPrivatelyAttested',
 'independentOwnerPrimarySourceVerified','independentReviewerAccepted',
 'canonicalStoresAuthenticated','rowAliases','privateOperatorIntakeAlreadyExists',
 'privateOperatorIntakeExecutedThisPhase'];
const publishedKeys=['inheritedG3sPr','currentPublishedVersionsSnapshotted',
 'publishedWorkflowsInspected','storeAwareCommerceWorkflowCount',
 'tenantOnlyCoreCommerceWorkflowCount','commerceDataTableCount',
 'commerceDataTablesWithStoreId','messengerPublishedCanSend',
 'zaloPublishedWritesMarkers','realHostedStoreReaderEnabled',
 'realNativeSignedStoreInstallationVerified'];
const writerKeys=['routine','pgIdentityArgs','currentHasStoreArgument',
 'actualHostedWriterStoreAuthorizationVerified','preflightContractOnly',
 'runtimeUpdated'];
const recoveryKeys=['accountPlanFromHistoricalOwnerScreenshot',
 'historicalLimitedApplicationArchiveOwnerAccepted',
 'historicalArchiveApplicationTables','historicalArchiveAuthUsersCovered',
 'currentAuthUsers','storageBuckets','storageObjects',
 'currentFullServiceRecoveryProven',
 'currentApplicationBackupAndIsolatedRestoreProven',
 'externalAuthRecoveryPlanVerified','ownerScopeDecision',
 'currentRecoveryAcceptedByReviewer','toolkitOnlyNoDockerWindows',
 'backupToolkitExecutedThisPhase','hostedBackupRestoreExecutedThisPhase',
 'sourceOnlyAndDisposableBackupProofDeferred',
 'hostedRlsChangesBlockedUntilRecoveryDecision'];
const actionKeys=['actualCustomerOrOrderRowsRead','credentialOrTokenValuesRead',
 'providerEventsSent','hostedSqlWrites','n8nWorkflowExecuted','n8nWorkflowUpdated',
 'cloudflareDeployed','hostedMigrationApplied',
 'privatelySignedFourRowOwnersAdmitted','operatorAuthenticatedThisPhase',
 'separateHostedM1ApprovalObtained'];
const fail=(reason,blockers=[])=>Object.freeze({
 status:'STAGING_M1_AND_STORE_CUTOVER_NO_GO',
 reason,sourceEvidenceClass:'CURRENT_CONNECTED_AGGREGATE_ONLY',
 reviewOnly:true,...PERMISSIONS,
 blockers:Object.freeze([...new Set(blockers)].sort()),
 originalEvidenceRowCountAccepted:0,
 currentRealJwtPairsAccepted:0,
 verifiedBackupRestoreCount:0,
 realPublishedStoreAwareCallerCount:0
});

function assess(packet,prevG3S){
 if(!exact(packet,BASE)||packet.contract!==CONTRACT ||
   packet.auditDateJst!=='2026-11-18'||
   packet.projectRef!=='ifxlvrhyjhbzbrkdsida'||
   packet.source!=='CONNECTED_SUPABASE_EXACT_COMMITTED_READONLY_SQL_AND_G3S_N8N_METADATA'||
   packet.canonicalStoreMigrationPr!==247||
   packet.developmentParentPr!==391||
   packet.privateOwnerIntakePr!==244||
   packet.windowsRecoveryToolkitPr!==382||
   packet.existingRealAuthAdmissionPr!==385||
   packet.sqlPath!=='qa/v152-rpc10/g3t-current-owner-m0-metadata-only.sql'||
   packet.sqlSourceSha!=='a0436743c2efc811614c0116dc213fdad41de994'||
   packet.status!=='NO_GO_PRIVATE_OWNER_REVIEW_CURRENT_RECOVERY_AND_STORE_WRITER_MISSING')
   return fail('G3T_SOURCE_OR_LINEAGE_NOT_TRUSTED',['INVALID_SOURCE']);
 const a=packet.auth,r=packet.fourRows,p=packet.published,w=packet.writer,
   m=packet.recovery,op=packet.action;
 if(!exact(a,authKeys)||!exact(r,rowKeys)||!exact(p,publishedKeys)||
    !exact(w,writerKeys)||!exact(m,recoveryKeys)||!exact(op,actionKeys))
   return fail('G3T_METADATA_STRUCTURE_NOT_TRUSTED',['UNEXPECTED_SENSITIVE_FIELDS']);
 const countGroups=[
  [a,['activeTenantMemberships','activeTenantOwnerMemberships','eligibleConfirmedMembers',
      'eligibleMembersWithSessionRecord','tenantsWithTwoEligibleOwnerIds',
      'tenantsWithTwoEligibleOwnerSessionRows','authUsersTotal']],
  [r,['products','orders','customers','customerLinkedOrders','ownerAttestedRowCount']],
  [p,['publishedWorkflowsInspected','storeAwareCommerceWorkflowCount',
      'tenantOnlyCoreCommerceWorkflowCount','commerceDataTableCount','commerceDataTablesWithStoreId']],
  [m,['historicalArchiveApplicationTables','historicalArchiveAuthUsersCovered',
      'currentAuthUsers','storageBuckets','storageObjects']],
  [op,['actualCustomerOrOrderRowsRead','credentialOrTokenValuesRead',
    'providerEventsSent','hostedSqlWrites','n8nWorkflowExecuted','n8nWorkflowUpdated',
    'cloudflareDeployed','hostedMigrationApplied']]
 ];
 for(const [obj,keys] of countGroups)if(keys.some(k=>!safeCount(obj[k])))
   return fail('G3T_UNTRUSTED_AGGREGATE',['INVALID_COUNT']);
 if(!Array.isArray(r.rowAliases)||r.rowAliases.length!==4 ||
    r.rowAliases.some((x,i)=>x!==EXPECTED_ALIASES[i]))
   return fail('G3T_PRIVATE_ROW_ALIAS_MISMATCH',['ROW_PROVENANCE_SOURCE_DRIFT']);
 if(w.routine!=='save_merchant_product'||
    w.pgIdentityArgs!=='p_tenant uuid, p_sku text, p_name text, p_price bigint, p_active boolean, p_initial_stock integer, p_expected_updated_at timestamp with time zone' ||
    m.accountPlanFromHistoricalOwnerScreenshot!=='FREE_NO_AUTOMATED_PLATFORM_BACKUP_IN_PRIOR_EVIDENCE'||
    m.ownerScopeDecision!=='UNDECIDED')
   return fail('G3T_WRITER_OR_M0_CONTRACT_DRIFT',['PREVIOUS_ABI_OR_RECOVERY_SCOPE_NOT_MATCHED']);
 const prior=inspectG3S(prevG3S);
 if(prior.reason!=='G3S_CALLER_AND_ORIGINAL_OWNER_RECONCILED_NO_GO'||
    prior.status!=='STAGING_MIGRATION_NO_GO'||
    prior.blockers?.includes('PUBLISHED_VERSION_DRIFT_STOP_REAUDIT'))
   return fail('G3T_PARENT_CALLER_INVENTORY_NOT_RECONCILED',['PARENT_INVENTORY_DRIFT']);
 if(!Array.isArray(prevG3S?.n8n?.publishedWorkflowObservations)||
    prevG3S.n8n.publishedWorkflowObservations.length!==7||
    prevG3S.n8n.publishedWorkflowObservations.some(
     o=>EXPECTED_VERSION[o.workflowId]!==o.publishedVersion||o.published!==true))
   return fail('G3T_REAL_PUBLISHED_VERSION_DRIFT',['RECHECK_LIVE_PUBLISHED_GRAPH']);
 const blocker=[];
 if(r.products!==2||r.orders!==2||r.ownerAttestedRowCount!==4 ||
    !r.sourceVersionRowDigestPrivatelyAttested||
    !r.independentOwnerPrimarySourceVerified||!r.independentReviewerAccepted||
    !r.canonicalStoresAuthenticated)
   blocker.push('FOUR_ROW_PRIVATE_MERCHANT_PRIMARY_SOURCE_OWNER_PROOF_REQUIRED');
 if(a.tenantsWithTwoEligibleOwnerSessionRows===0||
    !a.independentlyVerifiedRealJwtOwnerPair||!a.twoActualStoreMembershipsSameTenant)
   blocker.push('REAL_AUTH_TWO_OWNER_SESSION_AND_SAME_TENANT_STORE_AB_UNVERIFIED');
 if(!w.currentHasStoreArgument||
    !w.actualHostedWriterStoreAuthorizationVerified||w.runtimeUpdated!==true)
   blocker.push('TENANT_ONLY_PRIVILEGED_PRODUCT_WRITER_MUST_BE_VERSIONED_AND_SCOPED');
 if(p.storeAwareCommerceWorkflowCount<4 ||
    p.commerceDataTablesWithStoreId<14||
    p.tenantOnlyCoreCommerceWorkflowCount>0||
    !p.realHostedStoreReaderEnabled ||
    !p.realNativeSignedStoreInstallationVerified)
   blocker.push('PUBLISHED_COMMERCE_N8N_CALLER_AND_DATASTORE_STORE_AUTHORITY_MISSING');
 if(!m.currentFullServiceRecoveryProven||
    !m.currentApplicationBackupAndIsolatedRestoreProven||
    !m.externalAuthRecoveryPlanVerified||
    !m.currentRecoveryAcceptedByReviewer)
   blocker.push('M0_CURRENT_RESTORABLE_SCOPE_NOT_INDEPENDENTLY_ACCEPTED');
 if(m.ownerScopeDecision==='UNDECIDED')
   blocker.push('FOUNDER_M0_RECOVERY_SCOPE_NOT_CHOSEN');
 if(m.storageBuckets===0&&m.storageObjects===0&&m.currentAuthUsers===3)
   blocker.push('ZERO_STORAGE_OBJECTS_DOES_NOT_PROVE_AUTH_SETTINGS_RECOVERABLE');
 if(op.actualCustomerOrOrderRowsRead!==0||op.credentialOrTokenValuesRead!==0||
    op.providerEventsSent!==0||op.hostedSqlWrites!==0||
    op.n8nWorkflowExecuted!==0||op.n8nWorkflowUpdated!==0||
    op.cloudflareDeployed!==0||op.hostedMigrationApplied!==0)
   blocker.push('SOURCE_ONLY_BOUNDARY_VIOLATED');
 if(op.privatelySignedFourRowOwnersAdmitted||
    op.operatorAuthenticatedThisPhase||op.separateHostedM1ApprovalObtained)
   blocker.push('UNVERIFIED_SELF_REPORTED_OPERATOR_APPROVAL');
 // An audit of opaque self-reported booleans is NEVER authority for live
 // cutover. Independent proof authenticators and backups are out of scope.
 return fail('G3T_REAL_PRIVATE_OWNER_WRITER_AND_RECOVERY_NO_GO',blocker);
}
function buildTargetContract(){
 return Object.freeze({
  scope:'DESIGN_ONLY_NOT_DEPLOYED',
  resolverInput: Object.freeze([
   'provider_signed_event_verified_on_trusted_server',
   'provider_installation_id_looked_up_server_side',
   'tenant_id_from_installation_registry_not_customer_payload',
   'store_id_from_canonical_owner_membership_not_customer_payload',
   'principal_auth_uid_from_verified_active_session',
   'trusted_issuer_and_audience_checked'
  ]),
  denyConditions:Object.freeze([
   'client_supplied_tenant_id_or_store_id',
   'unknown_bot_page_or_installation',
   'inactive_or_revoked_store_membership',
   'shop_or_tenant_mismatch',
   'missing_store_column_or_legacy_tenant_only_query',
   'legacy_permissive_tenant_select_policy_unreplaced',
   'save_merchant_product_v1_without_store_scope',
   'missing_source_order_owner_and_customer_consent'
  ]),
  stageOrder:Object.freeze([
   'G0_PRIVATE_ROW_OWNER_PROOF',
   'M0_CURRENT_SCOPED_RECOVERY_AND_TESTED_ISOLATED_RESTORE',
   'M1_CANONICAL_STORES_AND_MEMBERSHIPS_SCHEMA_ONLY',
   'M3_PUBLISHED_CALLER_AND_VERSIONED_WRITER_COMPAT_NO_SEND',
   'M2M4_ATOMIC_LEGACY_PERMISSIVE_RLS_REPLACEMENT',
   'G3_SIGNED_REAL_JWT_STORE_A_B_NEGATIVE_QA',
   'CROSSCHANNEL_SEPARATE_NATIVE_PROVIDER_CUSTOMER_CONSENT'
  ]),
  legacyWriterAbiPinned:'save_merchant_product(p_tenant,p_sku,p_name,p_price,p_active,p_initial_stock,p_expected_updated_at)',
  newWriterRequiresDbVerifiedStoreMembership:true,
  sourceOnly:true,canDeploy:false,canReadOrder:false,canSend:false
 });
}
module.exports=Object.freeze({CONTRACT,EXPECTED_ALIASES,EXPECTED_VERSION,assess,buildTargetContract});
