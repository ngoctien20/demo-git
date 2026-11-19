// TIEN404 V19.0-B7-S3 — read-only evidence assessor; NO AUTHORIZATION.
// No JWT decoding, DB writes, provider actions or hosted Worker admission.
// Client-supplied "VERIFIED" claims are not cryptographic/session evidence.
import { readFileSync } from "node:fs";

const RLS_TABLES=Object.freeze([
 "products","orders","customers","conversations","order_items","messages"
]);
const MANDATORY_COVERAGE=Object.freeze([
 "supabase_public_rpc","github_gh_pages","n8n_main_and_scoped_workflows",
 "supabase_edge_functions","render_services","other_github_branches",
 "external_apps_or_manual_sql","supabase_rpc_runtime_call_logs"
]);
const requiredRealTests=Object.freeze([
 "OWNER_A_SELF_STORE_POSITIVE","OWNER_A_TO_B_NEGATIVE",
 "OWNER_B_SELF_STORE_POSITIVE","OWNER_B_TO_A_NEGATIVE",
 "SAME_TENANT_TWO_STORES","REVOKED_OWNER_DENIED",
 "EXPIRED_OWNER_DENIED","STAFF_PRICING_WRITE_DENIED",
 "LEGACY_NULL_STORE_DENIED","PROVIDER_INSTALLATION_MISMATCH_DENIED"
]);

export function evaluateWriterInventory(inventory){
 const surfaces=Array.isArray(inventory?.observed_surfaces)?
  inventory.observed_surfaces:[];
 const missing=MANDATORY_COVERAGE.filter(name=>surfaces.filter(s=>s.surface===name).length!==1);
 const unresolved=surfaces.filter(s=>s.status!=="VERIFIED")
  .map(s=>({surface:s.surface,condition:s.status}));
 const result={
  decision:"BLOCKED_NO_FULL_CALLER_CLOSURE",
  missingSurfaces:missing,
  unresolved,
  exactRuntimeCallersCertified:false,
  cutoverAuthorized:false,
  productionReady:false
 };
 return Object.freeze(result);
}
export function assessRealOwnerABAdmission({
  schemaFlags=[],rlsPolicyFlags=[],realEvidence=[]
}={}){
 const blockers=[];
 for(const table of RLS_TABLES){
  const a=schemaFlags.filter(r=>r?.table_name===table);
  if(a.length!==1||a[0].has_tenant_id!==true||
    a[0].has_store_id!==true)blockers.push("STORE_SCHEMA_MISSING_"+table.toUpperCase());
  const b=rlsPolicyFlags.filter(r=>r?.tablename===table&&
   r?.cmd==="SELECT"&&r?.permissive==="RESTRICTIVE"&&
   r?.store_scope_verified===true);
  if(b.length!==1)blockers.push("REAL_STORE_RESTRICTIVE_RLS_UNVERIFIED_"+table.toUpperCase());
 }
 // A receipt object isn't a verified JWT, its owner signature, a test session,
 // or an independent security review. Check completeness for planning ONLY.
 for(const name of requiredRealTests){
  const count=Array.isArray(realEvidence)?
   realEvidence.filter(e=>e?.case_id===name&&e?.outcome==="PASS").length:0;
  if(count!==1)blockers.push("NO_INDEPENDENT_REAL_EVIDENCE_"+name);
 }
 if(blockers.length===0)blockers.push("SIGNED_INDEPENDENT_AUTH_PROOF_NOT_VERIFIED");
 return Object.freeze({
  decision:"BLOCKED_REAL_STORE_AUTH_NOT_PROVEN",
  blockers,
  realJwtSignaturesValidated:false,
  storeAuthorityEstablished:false,
  canReadOrders:false,
  canWriteProducts:false,
  canEnableWebhook:false,
  canDeployRpc:false,
  productionReady:false
 });
}
export function assessRpcV2CandidateSource(code){
 const src=typeof code==="string"?code:"";
 const findings=[];
 if(/current_setting\s*\(\s*'request\.jwt\.claim\.sub'/i.test(src))
  findings.push("P0_FORGEABLE_TEST_GUC_AS_AUTH");
 if(/SECURITY\s+DEFINER/i.test(src))
  findings.push("P1_DEFINER_REQUIRES_FUNCTION_OWNER_AND_PRIVILEGE_REVIEW");
 if(!/p_store\b/i.test(src))
  findings.push("P0_STORE_PARAMETER_MISSING");
 if(!/p_expected_updated_at/i.test(src))
  findings.push("P1_OPTIMISTIC_CONCURRENCY_MISSING");
 if(!/UNIQUE\s*\(\s*tenant_id\s*,\s*sku\s*\)/i.test(src))
  findings.push("D02_LEGACY_SKU_UNIQUENESS_NOT_EVIDENCED");
 return Object.freeze({
  classification:"EXPERIMENTAL_QA_ONLY",
  blockers:findings,
  deployAllowed:false,realAuthVerified:false,storeOwnershipVerified:false
 });
}
export const expectedRealCases=requiredRealTests;
export default {fetch(){return new Response(null,{status:423});}};
