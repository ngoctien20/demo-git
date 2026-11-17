'use strict';
// RPC10-G3S: deterministic inspection of CONNECTED non-PII Supabase + n8n
// metadata. NO DB, HTTP, n8n, provider, credentials, tenant/user IDs or
// customer/order rows. A metadata packet cannot certify a real merchant,
// Auth JWT, backup, published caller cutover, grant/revoke or new migration.
const CONTRACT='T404_RPC10_G3S_HOSTED_ORIGINAL_STORE_CALLER_COMPAT_V1';
const CURRENT=Object.freeze({
  '5Eeh8hbpsoNhuiVo':['COMMERCE_TENANT_RESOLVER','a99c7350-7aea-446d-bdc5-4b10f52c3ad1'],
  'oOOXicKXGkBskKqh':['COMMERCE_CATALOG','e0f1e345-8e6c-40cb-8e6a-d7ad2eb92696'],
  'igPOsSbEgd4NgtRA':['COMMERCE_CART','eff32e20-a6d0-4975-88b8-107eae752b4b'],
  'Y0WLykMtNAldbgL0':['COMMERCE_V3_BUSINESS','3d8b7f89-2058-4a2a-8919-e5ff92c3c484'],
  'Z7FdV7uDvApfbURQ':['LEGACY_MESSENGER_DEMO','1064b1b3-d3f1-4a6b-a367-2414ba691522'],
  'yIJk8LvJoLF40Z62':['ZALO_BOT_STAGING_QA','2d912cb0-007f-452f-9536-b92ba12a03e6'],
  'sIPs6egzIwOY1GNv':['ZALO_PRIVATE_QA_ROUTER','8d91d23c-cd87-462f-a112-9cca2340bec8']
});
const COMMERCE_TABLES=Object.freeze([
 'TIEN404_COMMERCE_AUDIT','TIEN404_COMMERCE_CHANNELS',
 'TIEN404_COMMERCE_FEATURE_FLAGS','TIEN404_COMMERCE_ORDERS',
 'TIEN404_COMMERCE_PRODUCTS','TIEN404_COMMERCE_QUOTES',
 'TIEN404_COMMERCE_SUPPORT_TICKETS','TIEN404_COMMERCE_TENANTS',
 'TIEN404_COMMERCE_V3_CHECKPOINTS','TIEN404_COMMERCE_V3_NOTIFICATION_OUTBOX_SANDBOX',
 'TIEN404_COMMERCE_V3_NOTIFY_POLICIES','TIEN404_COMMERCE_V3_PRICE_RULES_SANDBOX',
 'TIEN404_COMMERCE_V3_PRICEBOOK','TIEN404_COMMERCE_V3_STORE_POLICIES',
 'TIEN404_COMMERCE_V3_STORE_RULES_SANDBOX','TIEN404_COMMERCE_VERTICAL_PROFILES'
]);
const TABLE_KEYS=['name','hasTenantId','hasStoreId','storeColumnCount'];
const WF_KEYS=['workflowId','classification','published','publishedVersion',
 'sameAsDraft','totalNodes','dataTableReadNodes','dataTableWriteNodes',
 'httpRequestNodes','toolWorkflowNodes','codeMentionsStoreId',
 'codeMentionsTenantId','trustedCanonicalStoreAuthorityVerified',
 'storeScopedPublishedReaderVerified','storeScopedPublishedWriterVerified',
 'canBeTreatedAsSafeNoSendCanary','dataSource'];
const SOURCE=Object.freeze({
  status:'STAGING_MIGRATION_NO_GO',sourceOnly:true,
  realOriginalOwnerProofAuthenticated:false,
  canAssignOriginalStore:false,canAttributeCustomer:false,
  verifiedActiveJwtStoreAB:false,canApplyHostedM1:false,
  canApplyHostedM2M4:false,canReplaceRls:false,
  canChangePrivilegedRpc:false,canReadHostedCommerce:false,
  canEnableRealCrossChannel:false,canPublishN8n:false,
  canUseServiceRole:false,canSendProvider:false,canApproveSpending:false
});
const strict=(x,keys)=>x&&typeof x==='object'&&!Array.isArray(x)&&
  Object.getPrototypeOf(x)===Object.prototype&&
  Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
const int=x=>Number.isSafeInteger(x)&&x>=0;
const bool=x=>typeof x==='boolean';
const denied=(reason,gaps=[])=>Object.freeze({
  ...SOURCE,reason,blockers:Object.freeze([...new Set(gaps)]),
  reviewedWorkflowCount:7,reviewedCommerceDataTableCount:16,
  originalRowOwnerReceiptCount:0,actualCustomerRowReads:0,
  hostedWritesOrWorkflowEdits:0
});
function inspect(snapshot){
 const gaps=[];
 if(!strict(snapshot,['contract','auditDateJst','source','parentPr',
    'canonicalMigrationPr','supabase','n8n','decision']) ||
   snapshot.contract!==CONTRACT||snapshot.auditDateJst!=='2026-11-18'||
   snapshot.source!=='CONNECTED_SUPABASE_N8N_READONLY_METADATA'||
   snapshot.parentPr!==387||snapshot.canonicalMigrationPr!==247)
   return denied('INVALID_SOURCE_OR_WRONG_CANONICAL_MIGRATION',['UNTRUSTED_SNAPSHOT']);
 const s=snapshot.supabase,n=snapshot.n8n,d=snapshot.decision;
 const supKeys=['project','commerceSixTables','forceRlsCount','tenantIdTables',
   'storeIdTables','tenantPermissiveSelectPolicies','storeQualifiedSelectPolicies',
   'legacyProductRows','legacyOrderRows','legacyCustomerRows',
   'tenantsWithProductAndOrder','tenantsWithTwoOwnerAuthIds',
   'sameTenantTwoStoreQaCount','canonicalStoresPresent',
   'canonicalStoreMembershipsPresent','fourOriginalRowsOwnerAuthentic',
   'storeOwnerReviewerAuthentic','actualFourRowSourceRead',
   'publicSecurityDefinerRpcCount','publicPrivilegedAnonExecutable',
   'publicPrivilegedAuthenticatedExecutable','saveMerchantProduct',
   'qaShopBClaim','qaOwnerPairing'];
 const nKeys=['commerceDataTables','commerceTableCount',
   'commerceTablesWithTenantId','commerceTablesWithStoreId',
   'publishedWorkflowObservations','publishedWorkflowsObserved',
   'publicCommerceReadersCanSelectStore',
   'legacyDemoDataIsolatedFromCommerceAuthorization',
   'publishedLegacyMessengerHasOutboundSend','publishedZaloQaHasMarkerWrites',
   'liveWorkflowsUpdatedThisPhase','liveWorkflowsExecutedThisPhase',
   'qaTableCustomerRowsRead'];
 const dKeys=['ownerOriginalSource','readerCallerContract','writerCallerContract',
   'existingJwtAB','stagingMigration','crossChannelCommerce',
   'actualProviderEventsThisPhase','dbHostedWritesThisPhase',
   'botSendsThisPhase','secretReadsThisPhase',
   'approvedToEnableRealOrderRead','approvedToPublish',
   'approvedToRunMigration'];
 if(!strict(s,supKeys)||!strict(n,nKeys)||!strict(d,dKeys)||
   s.project!=='ifxlvrhyjhbzbrkdsida')
   return denied('SNAPSHOT_STRUCTURE_NOT_ADMISSIBLE',['SANITIZED_CONTRACT_DRIFT']);
 for(const k of [
   'commerceSixTables','forceRlsCount','tenantIdTables','storeIdTables',
   'tenantPermissiveSelectPolicies','storeQualifiedSelectPolicies',
   'legacyProductRows','legacyOrderRows','legacyCustomerRows',
   'tenantsWithProductAndOrder','tenantsWithTwoOwnerAuthIds',
   'sameTenantTwoStoreQaCount','publicSecurityDefinerRpcCount',
   'publicPrivilegedAnonExecutable','publicPrivilegedAuthenticatedExecutable'])
   if(!int(s[k]))return denied('UNTRUSTED_SUPABASE_COUNT',['INVALID_AGGREGATES']);
 for(const k of ['commerceTableCount','commerceTablesWithTenantId',
    'commerceTablesWithStoreId','publishedWorkflowsObserved',
    'liveWorkflowsUpdatedThisPhase','liveWorkflowsExecutedThisPhase',
    'qaTableCustomerRowsRead'])
   if(!int(n[k]))return denied('UNTRUSTED_N8N_COUNT',['INVALID_AGGREGATES']);
 for(const k of ['actualProviderEventsThisPhase','dbHostedWritesThisPhase',
    'botSendsThisPhase','secretReadsThisPhase'])
   if(!int(d[k]))return denied('UNTRUSTED_OPERATION_COUNT',['INVALID_AGGREGATES']);
 const m=s.saveMerchantProduct,claim=s.qaShopBClaim,pair=s.qaOwnerPairing;
 if(!strict(m,['routine','ownerAuthCheckMentioned',
   'tenantMembershipMentioned','tenantIdMentioned','storeIdMentioned',
   'storeScopedWriterVerified'])||
   !strict(claim,['routine','anonExecutable','storeIdMentioned'])||
   !strict(pair,['routine','authenticatedExecutable','storeIdMentioned'])||
   m.routine!=='save_merchant_product'||claim.routine!=='qa_shop_b_zalo_claim'||
   pair.routine!=='qa_owner_pairing'||
   Object.values(m).slice(1).some(v=>!bool(v))||
   !bool(claim.anonExecutable)||!bool(claim.storeIdMentioned)||
   !bool(pair.authenticatedExecutable)||!bool(pair.storeIdMentioned))
   return denied('PRIVILEGED_RPC_INVENTORY_MALFORMED',['RPC_SCOPE_UNTRUSTED']);
 if(s.commerceSixTables!==6||s.forceRlsCount!==6||
    s.tenantIdTables!==6||s.storeIdTables!==6||
    !s.canonicalStoresPresent||!s.canonicalStoreMembershipsPresent)
   gaps.push('CANONICAL_SIX_SURFACE_STORE_SCHEMA_NOT_HOSTED');
 if(s.tenantPermissiveSelectPolicies>s.storeQualifiedSelectPolicies)
   gaps.push('PERMISSIVE_TENANT_SELECT_OR_LEAK_IF_NEW_POLICY_ADDED');
 if(!s.fourOriginalRowsOwnerAuthentic||
    !s.storeOwnerReviewerAuthentic||!s.actualFourRowSourceRead)
   gaps.push('FOUR_ORIGINAL_ROWS_SOURCE_AND_INDEPENDENT_OWNER_ATTESTATION_MISSING');
 if(s.tenantsWithTwoOwnerAuthIds>0&&s.sameTenantTwoStoreQaCount===0)
   gaps.push('TWO_AUTH_OWNER_IDS_NOT_TWO_STORE_OWNER_BINDINGS');
 if(s.publicSecurityDefinerRpcCount>0 &&
    (s.publicPrivilegedAnonExecutable>0||s.publicPrivilegedAuthenticatedExecutable>0) &&
    (!m.storeIdMentioned||!m.storeScopedWriterVerified||
     !claim.storeIdMentioned||!pair.storeIdMentioned))
   gaps.push('PRIVILEGED_RPC_CALLER_STORE_SCOPE_UNRECONCILED');

 if(!Array.isArray(n.commerceDataTables)||n.commerceDataTables.length!==16||
    !Array.isArray(n.publishedWorkflowObservations)||
    n.publishedWorkflowObservations.length!==7)
   return denied('INCOMPLETE_N8N_CALLER_OR_DATA_TABLE_INVENTORY',
      ['INVENTORY_COVERAGE_NOT_COMPLETE']);
 const names=new Set(),dts=n.commerceDataTables;
 for(const t of dts){
   if(!strict(t,TABLE_KEYS)||names.has(t.name)||
      !COMMERCE_TABLES.includes(t.name)||
      !bool(t.hasTenantId)||!bool(t.hasStoreId)||
      !int(t.storeColumnCount))
    return denied('COMMERCE_DATA_TABLE_SHAPE_INVALID',['UNTRUSTED_STORE_DATA_TABLE']);
   names.add(t.name);
 }
 if(names.size!==16||
    n.commerceTableCount!==16||
    n.commerceTablesWithTenantId!==dts.filter(t=>t.hasTenantId).length||
    n.commerceTablesWithStoreId!==dts.filter(t=>t.hasStoreId).length)
   return denied('COMMERCE_DATA_TABLE_COUNTS_MISMATCH',['INCOMPLETE_TABLE_COUNTS']);
 if(dts.some(t=>!t.hasStoreId||t.storeColumnCount<1))
   gaps.push('N8N_COMMERCE_DATA_TABLES_NOT_STORE_SCOPED');
 const seen=new Set();
 for(const w of n.publishedWorkflowObservations){
  if(!strict(w,WF_KEYS)||!Object.hasOwn(CURRENT,w.workflowId)||seen.has(w.workflowId))
    return denied('PUBLISHED_CALLER_SHAPE_OR_ID_INVALID',['CALLER_VERSION_UNTRUSTED']);
  seen.add(w.workflowId);
  const [kind,version]=CURRENT[w.workflowId];
  if(w.classification!==kind||w.publishedVersion!==version||
     w.published!==true||w.sameAsDraft!==true)
    gaps.push('PUBLISHED_VERSION_DRIFT_STOP_REAUDIT');
  for(const key of ['totalNodes','dataTableReadNodes','dataTableWriteNodes',
    'httpRequestNodes','toolWorkflowNodes'])
    if(!int(w[key]))return denied('CALLER_NODE_AGGREGATES_INVALID',['CALLER_METADATA_UNTRUSTED']);
  for(const key of ['codeMentionsStoreId','codeMentionsTenantId',
    'trustedCanonicalStoreAuthorityVerified','storeScopedPublishedReaderVerified',
    'storeScopedPublishedWriterVerified','canBeTreatedAsSafeNoSendCanary'])
    if(!bool(w[key]))return denied('CALLER_BOOLEAN_METADATA_INVALID',['CALLER_METADATA_UNTRUSTED']);
  if(kind.startsWith('COMMERCE')&&(!w.trustedCanonicalStoreAuthorityVerified||
     !w.storeScopedPublishedReaderVerified||!w.storeScopedPublishedWriterVerified))
    gaps.push('FOUR_PUBLISHED_COMMERCE_CALLERS_TENANT_ONLY');
  if(kind==='LEGACY_MESSENGER_DEMO'&&
     (w.httpRequestNodes>0||w.toolWorkflowNodes>0))
    gaps.push('LEGACY_MESSENGER_CAN_SEND_AND_WRITE_DEMO_NOT_COMMERCE');
  if(kind==='ZALO_BOT_STAGING_QA'&&w.dataTableWriteNodes>0)
    gaps.push('ZALO_STAGING_HAS_REAL_QA_MARKER_WRITES');
 }
 if(seen.size!==7)return denied('REQUIRED_PUBLISHED_CALLER_MISSING',['CALLER_COVERAGE_NOT_COMPLETE']);
 if(n.liveWorkflowsUpdatedThisPhase!==0||n.liveWorkflowsExecutedThisPhase!==0||
    n.qaTableCustomerRowsRead!==0||
    d.actualProviderEventsThisPhase!==0||d.dbHostedWritesThisPhase!==0||
    d.botSendsThisPhase!==0||d.secretReadsThisPhase!==0)
    gaps.push('READ_ONLY_OPERATION_BOUNDARY_VIOLATED');
 if(d.approvedToRunMigration||d.approvedToEnableRealOrderRead||
    d.approvedToPublish||d.stagingMigration!=='NO_GO_NOT_APPROVED')
    gaps.push('SELF_REPORTED_MIGRATION_AUTHORIZATION_INVALID');
 if(d.ownerOriginalSource!=='HOLD_PRIVATE_FOUR_ROW_ATTESTATION_MISSING'||
    d.readerCallerContract!=='NO_GO_TENANT_ONLY'||
    d.writerCallerContract!=='NO_GO_SUPABASE_RPC_AND_N8N_TENANT_ONLY'||
    d.existingJwtAB!=='NO_GO_SAME_TENANT_STORE_A_B_MISSING'||
    d.crossChannelCommerce!=='NO_GO_MESSENGER_ZALO_STORE_AND_CUSTOMER_LINK')
    gaps.push('UNVERIFIED_AUTHORITY_STATUS_PROMOTION');
 // Every result remains NO-GO even if metadata later claims all-green.
 // Human owner evidence, verified recovery, real JWT and independent hosted
 // acceptance are outside this source-only reader contract.
 return denied('G3S_CALLER_AND_ORIGINAL_OWNER_RECONCILED_NO_GO',gaps);
}
module.exports=Object.freeze({CONTRACT,CURRENT,COMMERCE_TABLES,inspect});
