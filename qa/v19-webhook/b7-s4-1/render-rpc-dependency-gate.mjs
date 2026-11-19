// TIEN404 V19.0-B7-S4.1 — static-source evidence reconciler only.
// Does not connect to Render, authorize a workspace, validate JWTs, call RPC,
// execute n8n workflows, send provider messages, or migrate Supabase.
// Caller-provided "PASS" values can never authorize a production cutover.

const DENY=Object.freeze({
  renderWorkspaceAuthorized:false,
  liveRenderCallerClosureVerified:false,
  currentRenderDeployVerified:false,
  rpcV1RemovalAllowed:false,
  activeQaClaimRpcRemovalAllowed:false,
  legacyTenantOnlyApiReleaseAllowed:false,
  realStoreAuthorityVerified:false,
  stagingMigrationAllowed:false,
  providerSendAllowed:false,
  productionAllowed:false
});

export function inspectHistoricalRenderSource({
  productModule="",portalEntry="",authBuilder="",dataMain=""
}={}){
  const findings=[];
  const hasProductCall=/\.rpc\s*\(\s*['"]save_merchant_product['"]/.test(productModule);
  const editorFlag=/export\s+const\s+PRODUCT_EDITOR_ENABLED\s*=\s*false\s*;/.test(productModule);
  const productParamStore=/p_store\s*:|store_id\s*:/.test(productModule);
  const portalLoadsWriter=/\b(?:from|import)\s*(?:\(?\s*)?['"][^'"]*merchant-product(?:\.mjs)?['"]/.test(portalEntry) ||
    /import\s*\(\s*['"][^'"]*merchant-product(?:\.mjs)?['"]\s*\)/.test(portalEntry);
  const includedByBuild=/['"]assets\/merchant-product\.mjs['"]/.test(authBuilder);
  const tenantProduct=/@app\.get\(['"]\/api\/v1\/tenants\/\{tenant_id\}\/products['"]\)/.test(dataMain);
  const tenantOrders=/@app\.get\(['"]\/api\/v1\/tenants\/\{tenant_id\}\/orders['"]\)/.test(dataMain);
  const serverHasStoreScope=/\bstore_id\b/.test(dataMain);
  const serverProductRpc=/save_merchant_product/.test(dataMain);
  if(hasProductCall)findings.push("STATIC_RENDER_AUTH_V1_RPC_CALLSITE");
  if(editorFlag&&!portalLoadsWriter)findings.push("DISABLED_DORMANT_EDITOR_IN_PINNED_PORTAL_SOURCE");
  if(includedByBuild)findings.push("STATIC_PRODUCT_MODULE_INCLUDED_IN_AUTH_BUILD");
  if(tenantProduct&&tenantOrders&&!serverHasStoreScope)
    findings.push("RENDER_DATA_V1_PRODUCTS_ORDERS_TENANT_ONLY_NOT_STORE_SCOPED");
  if(serverProductRpc)findings.push("DIRECT_PRODUCT_V1_RPC_STRING_IN_RENDER_DATA");
  if(productParamStore)findings.push("PRODUCT_EDITOR_HAS_EXPLICIT_STORE_SCOPE");
  return Object.freeze({
    classification:"PINNED_HISTORICAL_SOURCE_ONLY",
    findings:Object.freeze(findings),
    hasProductCallSite:hasProductCall,
    productEditorDisabled:editorFlag,
    portalDirectImportObserved:portalLoadsWriter,
    productModuleBuildAllowlisted:includedByBuild,
    productEditorStoreScoped:productParamStore,
    tenantOnlyDataApiObserved:tenantProduct&&tenantOrders&&!serverHasStoreScope,
    renderDataDirectProductRpcObserved:serverProductRpc,
    runtimeInvocationObserved:false,
    currentHostedDeployMatched:false,
    ...DENY
  });
}

export function assessB7S41Closure(evidence){
  const blockers=[];
  if(!evidence || evidence.version!=="TIEN404_V19_B7_S4_1" ||
    !Array.isArray(evidence.render?.sourceSnapshots))
    return Object.freeze({decision:"BLOCKED_INVALID_SOURCE_EVIDENCE",
      blockers:["NO_VALID_PINNED_SOURCE_MANIFEST"],...DENY});
  const render=evidence.render||{};
  if(render.selectedWorkspaceConfirmedByUser!==true)
    blockers.push("RENDER_WORKSPACE_SELECTION_REQUIRED");
  if(render.liveServiceListRead!==true)
    blockers.push("RENDER_CURRENT_SERVICES_UNINSPECTED");
  if(render.latestHostedDeployVersionsVerified!==true)
    blockers.push("RENDER_DEPLOY_SHA_NOT_FRESHLY_VERIFIED");
  if(render.runtimeLogsInspected!==true)
    blockers.push("RENDER_RPC_RUNTIME_TELEMETRY_UNINSPECTED");
  const auth=render.sourceSnapshots.find(x=>x.serviceLabel==="tien404-auth-staging");
  const data=render.sourceSnapshots.find(x=>x.serviceLabel==="tien404-data-staging");
  if(!auth?.files?.some(x=>x.directRpcCall==="save_merchant_product"&&
    x.productEditorEnabled===false))
    blockers.push("HISTORICAL_RENDER_AUTH_PRODUCT_CALLSITE_NOT_CLASSIFIED");
  else blockers.push("DORMANT_RENDER_PRODUCT_RPC_V1_STILL_NEEDS_COMPATIBILITY_DECISION");
  if(!data?.files?.some(x=>x.classification==="LEGACY_TENANT_ONLY_READ_API_NOT_STORE_AWARE"))
    blockers.push("HISTORICAL_RENDER_DATA_V1_ROUTES_UNCLASSIFIED");
  else blockers.push("TENANT_ONLY_RENDER_DATA_V1_ENDPOINTS_REQUIRE_STORE_GATES");
  const n=evidence.n8n||{};
  if(n.previouslyListedWorkflows!==171||n.previousGraphDetailsRead!==171)
    blockers.push("PREVIOUS_N8N_SCANNED_LIST_EVIDENCE_MISMATCH");
  const child=n.freshlyVerifiedPublishedChild||{};
  if(child.active!==true||child.rpcName!=="qa_shop_b_zalo_claim"||
    child.nodeEnabled!==true)blockers.push("ACTIVE_PUBLISHED_ZALO_RPC_DEPENDENCY_UNCONFIRMED");
  else blockers.push("ACTIVE_ZALO_QA_CLAIM_RPC_BREAKAGE_RISK");
  if(evidence.supabase?.currentStoreAuthorityClosed!==true)
    blockers.push("STORE_AUTHORITY_NOT_CLOSED");
  if(evidence.supabase?.verifiedSameTenantOwnerAB!==true)
    blockers.push("SAME_TENANT_OWNER_AB_NOT_VERIFIED");
  if(Array.isArray(evidence.unresolvedDependencies)&&
    evidence.unresolvedDependencies.includes("EXTERNAL_OR_DYNAMIC_RPC_CALLER_CENSUS_INCOMPLETE"))
    blockers.push("EXTERNAL_AND_DYNAMIC_CALLERS_UNRESOLVED");
  if(blockers.length===0)
    blockers.push("INDEPENDENT_SIGNED_RELEASE_AUTHORIZATION_NOT_VERIFIED");

  // A source snapshot/manifest is NEVER authoritative admission; even if all
  // JSON fields are forged into VERIFIED, no deployment or RPC revoke occurs.
  return Object.freeze({
    decision:"BLOCKED_RPC_DEPENDENCY_CLOSURE_INCOMPLETE",
    blockers:Object.freeze([...new Set(blockers)]),
    evidence:"READ_ONLY_HISTORICAL_GITHUB_SOURCES_AND_SELECTED_N8N_PUBLISHED_GRAPH",
    canRequestRenderWorkspaceSelection:true,
    ...DENY
  });
}

export default {fetch(){return new Response(null,{status:423});}};
