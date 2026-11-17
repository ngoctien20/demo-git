// TIEN404 AI — V17.7D Store Authority × Channel Admission (OFFLINE ONLY).
// This module does not fetch provider events, call Supabase/n8n, run SQL, parse JWT,
// send messages, create Orders, modify inventory, or deploy a Worker.
// No input can authorize hosted operations; the output is diagnostic ONLY.

const CHANNELS=Object.freeze({
  ZALO_BOT:Object.freeze({workflowId:'yIJk8LvJoLF40Z62',
    publishedVersion:'2d912cb0-007f-452f-9536-b92ba12a03e6',
    requiredProof:'ZALO_BOT_PLATFORM_NATIVE_HEADER_AND_BOT_BINDING'}),
  MESSENGER:Object.freeze({workflowId:'Z7FdV7uDvApfbURQ',
    publishedVersion:'1064b1b3-d3f1-4a6b-a367-2414ba691522',
    requiredProof:'META_RAW_BODY_HMAC_AND_PAGE_OWNERSHIP'}),
  WEBSITE:Object.freeze({workflowId:'wgkkmT7q4lm4HyuA',
    publishedVersion:'c81929d4-ab55-4c24-8659-795842739e24',
    requiredProof:'REAL_SIGNED_WEBSITE_SESSION_AND_STORE_OWNERSHIP'})
});
const CORE=Object.freeze({
  TENANT_RESOLVER:Object.freeze({id:'5Eeh8hbpsoNhuiVo',publishedVersion:'a99c7350-7aea-446d-bdc5-4b10f52c3ad1'}),
  CATALOG:Object.freeze({id:'oOOXicKXGkBskKqh',publishedVersion:'e0f1e345-8e6c-40cb-8e6a-d7ad2eb92696'}),
  CART:Object.freeze({id:'igPOsSbEgd4NgtRA',publishedVersion:'eff32e20-a6d0-4975-88b8-107eae752b4b'}),
  V3_BUSINESS:Object.freeze({id:'Y0WLykMtNAldbgL0',publishedVersion:'3d8b7f89-2058-4a2a-8919-e5ff92c3c484'})
});
const COMMERCE_TABLES=Object.freeze(['products','orders','order_items','customers','conversations','messages']);
const N8N_TABLES=Object.freeze(['TIEN404_COMMERCE_CHANNELS','TIEN404_COMMERCE_PRODUCTS',
  'TIEN404_COMMERCE_ORDERS','TIEN404_COMMERCE_TENANTS','TIEN404_COMMERCE_V3_STORE_RULES_SANDBOX']);
const RPCS=Object.freeze(['qa_owner_pairing','qa_shop_b_zalo_claim','save_merchant_product']);
const safeResult=(reason,extra={})=>Object.freeze({
  status:'HOSTED_RELEASE_NO_GO',reason,
  sourceOnly:true,realOwnerVerified:false,realProviderVerified:false,
  realSupabaseJwtRlsTested:false,realChannelUatCompleted:false,
  canReadCommerce:false,canWriteOrders:false,canWriteStock:false,
  canSendProvider:false,canChangeDatabase:false,canDeploy:false,
  canPublish:false,...extra
});
const stringRef=s=>typeof s==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{7,127}$/.test(s);

/** Compare read-only n8n metadata to exact verified published version pins.
 * Older Github notes are not authoritative once a workflow version changes.
 */
export function inspectPinnedPublishedCallers(workflows){
  if(!Array.isArray(workflows)||workflows.length!==7)
    return safeResult('EXPECTED_SEVEN_WORKFLOWS_REQUIRED');
  const expected=[
    ...Object.entries(CORE).map(([name,x])=>({name,id:x.id,publishedVersion:x.publishedVersion})),
    ...Object.entries(CHANNELS).map(([name,x])=>({name,id:x.workflowId,publishedVersion:x.publishedVersion}))
  ];
  const seen=new Set();
  for(const e of expected){
    const rows=workflows.filter(w=>w?.id===e.id);
    if(rows.length!==1)return safeResult('WORKFLOW_MISSING_DUPLICATE_OR_ALIASED');
    const w=rows[0];seen.add(w.id);
    if(w.publishedVersion!==e.publishedVersion||
       w.draftVersion!==e.publishedVersion||w.active!==true)
      return safeResult('PUBLISHED_WORKFLOW_VERSION_DRIFT',{blockedWorkflow:e.name});
    if(w.hasTrustedStoreScope!==false)
      return safeResult('UNVERIFIED_STORE_SCOPE_IN_PUBLISHED_WORKFLOW',{blockedWorkflow:e.name});
  }
  if(seen.size!==workflows.length)return safeResult('UNEXPECTED_WORKFLOW_IN_MANIFEST');
  return safeResult('PINNED_WORKFLOWS_MATCH_BUT_STILL_TENANT_SCOPED',{
    manifestShapeMatched:true,storeAuthorityProved:false,
    requiresLegacyCallerCompatibilityReview:true
  });
}

/** Database table and n8n Data Table schema inventory, never sample rows.
 * A "storeId" field alone is insufficient: the canonical Server-Trusted
 * mapping and Store-level RLS are independently required.
 */
export function inspectStoreSurfaceInventory({postgres,n8nTables,rpcs}={}){
  if(!Array.isArray(postgres)||postgres.length!==COMMERCE_TABLES.length||
     !Array.isArray(n8nTables)||n8nTables.length!==N8N_TABLES.length||
     !Array.isArray(rpcs)||rpcs.length!==RPCS.length)
    return safeResult('EXACT_HOSTED_METADATA_INVENTORY_REQUIRED');
  if(new Set(postgres.map(t=>t?.name)).size!==COMMERCE_TABLES.length||
    !COMMERCE_TABLES.every(n=>postgres.some(t=>t?.name===n))||
    new Set(n8nTables.map(t=>t?.name)).size!==N8N_TABLES.length||
    !N8N_TABLES.every(n=>n8nTables.some(t=>t?.name===n))||
    new Set(rpcs.map(f=>f?.name)).size!==RPCS.length||
    !RPCS.every(n=>rpcs.some(f=>f?.name===n)))
    return safeResult('INVENTORY_OBJECT_IDENTITY_MISMATCH');
  if(postgres.some(t=>t.rls!==true||t.forceRls!==true||t.tenantId!==true))
    return safeResult('TENANT_RLS_BASELINE_MISSING');
  if(postgres.some(t=>t.storeId!==false||t.storeScopedSelect!==false||
    t.selectPolicyCount!==1||t.selectPolicyPermissive!==true))
    return safeResult('HOSTED_DB_BASELINE_CHANGED_REVIEW_REQUIRED');
  if(n8nTables.some(t=>t.hasTenantId!==true||t.hasStoreId!==false))
    return safeResult('N8N_DATA_TABLE_BASELINE_CHANGED_REVIEW_REQUIRED');
  if(rpcs.some(f=>f.securityDefiner!==true))
    return safeResult('PRIVILEGED_RPC_BASELINE_CHANGED_REVIEW_REQUIRED');
  const openAnon=rpcs.filter(f=>f.anonExecute===true).map(f=>f.name).sort();
  if(openAnon.length!==1||openAnon[0]!=='qa_shop_b_zalo_claim')
    return safeResult('ANON_RPC_GRANTS_DRIFT_REVIEW_REQUIRED');
  return safeResult('TENANT_ONLY_BASELINE_CONFIRMED_NOT_STORE_AUTHORITY',{
    databaseSurfaceCount:COMMERCE_TABLES.length,
    n8nTableCount:N8N_TABLES.length,
    privilegedRpcCount:RPCS.length,
    storeQualifiedPostgresSurfaces:0,
    storeQualifiedN8nTables:0,
    anonCallableDefinerReviewRequired:true,
    p0StoreCutoverBlocked:true
  });
}

/** Collision-aware dependency graph: these are gates, not autorisations.
 * The actual Store migration owner is RPC.10 #247; RLS/RPC security is
 * #246; archive/recovery is #251; native channel UAT source is #326.
 */
export function inspectRemediationDependencies(snapshot){
  if(!snapshot||snapshot.mode!=='SOURCE_ONLY_READONLY'||
    !snapshot.canonicalMigrationOwner||!snapshot.securityReviewer||
    !snapshot.recoveryOwner||!snapshot.channelOwner)
    return safeResult('INDEPENDENT_WORKSTREAM_OWNERS_REQUIRED');
  const expected={canonicalMigrationOwner:247,securityReviewer:246,
    recoveryOwner:251,channelOwner:326};
  if(Object.entries(expected).some(([k,n])=>snapshot[k]!==n))
    return safeResult('STORE_MIGRATION_WORKSTREAM_COLLISION');
  const required=Object.freeze([
    'G0_PRIVATE_FOUR_ORIGINAL_STORE_RECORDS_WITH_INDEPENDENT_OWNER_PROOF',
    'M0_INDEPENDENT_RECOVERY_SCOPE_AND_RESTORE_EVIDENCE',
    'RPC10_G1_DISPOSABLE_POSTGRES17_SUITE_REFERENCE_REVIEW',
    'M1_EXPAND_ONLY_STORE_SCHEMA_AND_LEGACY_CALLER_COMPATIBILITY',
    'M3_COMPOSITE_STORE_FOREIGN_KEYS_AND_PRICE_STOCK_WRITER_SCOPE',
    'M2_M4_ATOMIC_LEGACY_TENANT_POLICY_CUTOVER_WITH_ROLLBACK',
    'G3_REAL_TWO_STORE_SAME_TENANT_AUTH_JWT_RLS_DENIAL',
    'PRIVILEGED_RPC_LEAST_PRIVILEGE_AND_BYPASS_REVIEW',
    'SIGNED_CHANNEL_OWNER_NO_SEND_INDEPENDENT_PROVIDER_UAT',
    'PUBLISHED_N8N_CALLER_REVIEW_AND_DEMO_DATA_ISOLATION'
  ]);
  return safeResult('SOURCE_ONLY_MIGRATION_DEPENDENCIES_PINNED',{
    dependencyShapeMatched:true,required
  });
}

/** Direct request to existing published Messenger has outbound SEND.
 * Existing active Zalo Bot upserts QA markers. Website is DEMO only.
 * A real canary therefore needs a separate operator-controlled no-send
 * implementation; direct production webhook execution is NEVER admitted.
 */
export function inspectChannelCanaryAdmission(channel,plan){
  if(!Object.hasOwn(CHANNELS,channel))
    return safeResult(channel==='ZALO_OA'?
      'OA_REQUIRES_OWNER_OAUTH_FIRST':'UNSUPPORTED_CHANNEL');
  if(!plan||plan.mode!=='OFFLINE_QA_NO_SEND'||
    plan.workflowId!==CHANNELS[channel].workflowId||
    plan.publishedVersion!==CHANNELS[channel].publishedVersion)
    return safeResult('CHANNEL_VERSION_OR_NO_SEND_PLAN_NOT_PINNED');
  const blockers=[];
  if(plan.directPublishedWorkflow===true)
    blockers.push(channel==='MESSENGER'?
      'ACTIVE_MESSENGER_CONTAINS_HTTP_SEND':
      channel==='ZALO_BOT'?'ACTIVE_ZALO_BOT_UPSERTS_QA_MARKERS':
      'WEBSITE_ACTIVE_WORKFLOW_IS_DEMO_ONLY');
  if(plan.isolatedShadowWorkerVerified!==true)
    blockers.push('DEDICATED_ISOLATED_NO_SEND_SHADOW_NOT_VERIFIED');
  if(plan.realOwnerConsentVerified!==true)
    blockers.push('REAL_CHANNEL_OWNER_CONSENT_NOT_VERIFIED');
  if(plan.nativeProviderSignatureVerified!==true)
    blockers.push('REAL_PROVIDER_SIGNATURE_OR_WEBSITE_SESSION_NOT_VERIFIED');
  if(plan.storeOwnershipVerified!==true)
    blockers.push('TRUSTED_PROVIDER_TO_STORE_OWNERSHIP_NOT_VERIFIED');
  if(plan.independentOperatorVerified!==true)
    blockers.push('INDEPENDENT_OPERATOR_NOT_VERIFIED');
  if(plan.signedNoSendLockVerified!==true)
    blockers.push('NO_SEND_LOCK_NOT_ATTESTED');
  if(plan.realSameTenantStoreABVerified!==true)
    blockers.push('REAL_JWT_SAME_TENANT_STORE_AB_NOT_PROVED');
  // Caller-provided booleans and a successful-looking fixture never prove
  // any of the above. There is deliberately no real admission function here.
  return safeResult('CHANNEL_HOSTED_CANARY_REQUIRES_INDEPENDENT_EVIDENCE',{
    channel,requiredProof:CHANNELS[channel].requiredProof,
    blockers:Object.freeze(blockers),syntheticCheckOnly:true
  });
}

/** Never use a self-reported all-green packet to approve production. */
export function preventSelfAuthorizingRelease(_reportedProof){
  return safeResult('INDEPENDENT_HOSTED_OWNER_AND_OPERATOR_ACCEPTANCE_NOT_YET_PROVED',{
    required:['REAL_OA_OR_BOT_OR_PAGE_OWNERSHIP',
      'REAL_SUPABASE_AUTH_OWNER_AND_MANAGER',
      'HOSTED_SAME_TENANT_STORE_AB_RLS',
      'M0_RESTORE_EVIDENCE_AND_G0_FOUR_ROW_PROVENANCE',
      'SIGNED_NATIVE_PROVIDER_CANARY_ZERO_SEND_ZERO_WRITE',
      'INDEPENDENT_OPERATOR_APPROVAL_AND_ROLLBACK']
  });
}
