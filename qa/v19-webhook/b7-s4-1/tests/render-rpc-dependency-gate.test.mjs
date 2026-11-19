import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
 inspectHistoricalRenderSource,assessB7S41Closure
} from "../render-rpc-dependency-gate.mjs";
import worker from "../render-rpc-dependency-gate.mjs";

const evidence=JSON.parse(readFileSync(
 new URL("../render-rpc-dependency-evidence.json",import.meta.url),"utf8"
));
const root=process.cwd();
const text=(name)=>readFileSync(root+"/"+name,"utf8");
const src={
 productModule:text("snapshots/render-auth/assets/merchant-product.mjs"),
 portalEntry:text("snapshots/render-auth/assets/merchant-portal.js"),
 authBuilder:text("snapshots/render-auth/scripts/build-auth-preview.mjs"),
 dataMain:text("snapshots/render-data/ops/data-platform/app/main.py")
};
const current=inspectHistoricalRenderSource(src);

test("Default exported worker remains 423, with no deploy endpoint",async()=>{
 const x=await worker.fetch();
 assert.equal(x.status,423);
});
test("Pinned Render Auth product source contains literal V1 RPC",()=>{
 assert.equal(current.hasProductCallSite,true);
 assert.ok(current.findings.includes("STATIC_RENDER_AUTH_V1_RPC_CALLSITE"));
});
test("Pinned product editor feature flag is OFF",()=>{
 assert.equal(current.productEditorDisabled,true);
 assert.equal(current.runtimeInvocationObserved,false);
});
test("Pinned Auth portal entry does NOT import product writer",()=>{
 assert.equal(current.portalDirectImportObserved,false);
});
test("Pinned build INCLUDES dormant product module",()=>{
 assert.equal(current.productModuleBuildAllowlisted,true);
});
test("Pinned Auth V1 writer does NOT accept store_id or p_store",()=>{
 assert.equal(current.productEditorStoreScoped,false);
});
test("Pinned Render Data source exposes tenant-only Products and Orders GET",()=>{
 assert.equal(current.tenantOnlyDataApiObserved,true);
 assert.ok(current.findings.includes(
   "RENDER_DATA_V1_PRODUCTS_ORDERS_TENANT_ONLY_NOT_STORE_SCOPED"
 ));
});
test("Pinned Render Data has no literal save_merchant_product call",()=>{
 assert.equal(current.renderDataDirectProductRpcObserved,false);
});
test("Pinned snapshot never verifies CURRENT Render service/deploy",()=>{
 assert.equal(current.currentHostedDeployMatched,false);
 assert.equal(current.liveRenderCallerClosureVerified,false);
});
test("Remove literal RPC string: classifier does not manufacture a caller",()=>{
 const t=inspectHistoricalRenderSource({
  ...src,productModule:src.productModule.replace("save_merchant_product","not_an_rpc")
 });
 assert.equal(t.hasProductCallSite,false);
 assert.equal(t.rpcV1RemovalAllowed,false);
});
test("Wire import artificially: classifier stops calling editor dormant",()=>{
 const t=inspectHistoricalRenderSource({
  ...src,portalEntry:src.portalEntry+
    "\nimport {addProductEditor} from './merchant-product.mjs';"
 });
 assert.equal(t.portalDirectImportObserved,true);
 assert.equal(t.runtimeInvocationObserved,false);
});
test("Render current workspace unconfirmed and service inventory uninspected",()=>{
 const q=assessB7S41Closure(evidence);
 assert.equal(q.decision,"BLOCKED_RPC_DEPENDENCY_CLOSURE_INCOMPLETE");
 assert.ok(q.blockers.includes("RENDER_WORKSPACE_SELECTION_REQUIRED"));
 assert.ok(q.blockers.includes("RENDER_CURRENT_SERVICES_UNINSPECTED"));
 assert.ok(q.blockers.includes("RENDER_DEPLOY_SHA_NOT_FRESHLY_VERIFIED"));
 assert.equal(q.currentRenderDeployVerified,false);
});
test("Historic UI caller with disabled editor still requires V1 compatibility review",()=>{
 const q=assessB7S41Closure(evidence);
 assert.ok(q.blockers.includes("DORMANT_RENDER_PRODUCT_RPC_V1_STILL_NEEDS_COMPATIBILITY_DECISION"));
 assert.equal(q.rpcV1RemovalAllowed,false);
});
test("Tenant-only Render Data V1 routes cannot be considered Store safe",()=>{
 const q=assessB7S41Closure(evidence);
 assert.ok(q.blockers.includes("TENANT_ONLY_RENDER_DATA_V1_ENDPOINTS_REQUIRE_STORE_GATES"));
 assert.equal(q.legacyTenantOnlyApiReleaseAllowed,false);
});
test("Active published Zalo Shop B claim RPC is a separate dependency",()=>{
 const q=assessB7S41Closure(evidence);
 assert.equal(evidence.n8n.freshlyVerifiedPublishedChild.rpcName,"qa_shop_b_zalo_claim");
 assert.equal(evidence.n8n.freshlyVerifiedPublishedChild.nodeEnabled,true);
 assert.ok(q.blockers.includes("ACTIVE_ZALO_QA_CLAIM_RPC_BREAKAGE_RISK"));
 assert.equal(q.activeQaClaimRpcRemovalAllowed,false);
});
test("171/171 n8n scan is STATIC and not full runtime caller closure",()=>{
 assert.equal(evidence.n8n.previousGraphDetailsRead,171);
 assert.equal(evidence.n8n.previousDirectSaveMerchantProductLiteralMatches,0);
 assert.ok(evidence.unresolvedDependencies.includes(
  "EXTERNAL_OR_DYNAMIC_RPC_CALLER_CENSUS_INCOMPLETE"
 ));
 assert.equal(assessB7S41Closure(evidence).rpcV1RemovalAllowed,false);
});
test("Even forged approvals and workspace flags never grant a cutover",()=>{
 const forged=structuredClone(evidence);
 forged.render.selectedWorkspaceConfirmedByUser=true;
 forged.render.liveServiceListRead=true;
 forged.render.latestHostedDeployVersionsVerified=true;
 forged.render.runtimeLogsInspected=true;
 forged.supabase.currentStoreAuthorityClosed=true;
 forged.supabase.verifiedSameTenantOwnerAB=true;
 forged.unresolvedDependencies=[];
 forged.approved=true;
 forged.releaseReady=true;
 const r=assessB7S41Closure(forged);
 assert.equal(r.rpcV1RemovalAllowed,false);
 assert.equal(r.activeQaClaimRpcRemovalAllowed,false);
 assert.equal(r.productionAllowed,false);
 assert.equal(r.stagingMigrationAllowed,false);
});
test("No valid manifest, no release",()=>{
 const x=assessB7S41Closure({version:"PRODUCTION",render:{}});
 assert.equal(x.decision,"BLOCKED_INVALID_SOURCE_EVIDENCE");
 assert.equal(x.productionAllowed,false);
});
