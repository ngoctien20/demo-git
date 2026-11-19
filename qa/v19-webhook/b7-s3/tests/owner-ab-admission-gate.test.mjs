import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import candidate,{
 evaluateWriterInventory,assessRealOwnerABAdmission,
 assessRpcV2CandidateSource,expectedRealCases
} from "../owner-ab-admission-gate.mjs";

const inventory=JSON.parse(readFileSync(
 new URL("../caller-inventory.json",import.meta.url),"utf8"
));
const source=readFileSync(
 new URL("../../b7-s2/tests/pg17_versioned_store_writer_qa.sql",import.meta.url),
 "utf8"
);
const tables=["products","orders","customers","conversations","order_items","messages"];
const pretendPerfectSchema=tables.map(table_name=>({
 table_name,has_tenant_id:true,has_store_id:true
}));
const pretendPerfectRls=tables.map(tablename=>({
 tablename,cmd:"SELECT",permissive:"RESTRICTIVE",store_scope_verified:true
}));
const pretendEvidence=expectedRealCases.map(case_id=>({case_id,outcome:"PASS"}));
test("default candidate Worker remains 423 LOCKED",async()=>{
 assert.equal((await candidate.fetch()).status,423);
});
test("a scoped GitHub+workflow scan never proves complete API caller inventory",()=>{
 assert.equal(inventory.release_inventory_complete,false);
 const gh=inventory.observed_surfaces.find(x=>x.surface==="github_gh_pages");
 assert.equal(gh.checked_source_files,37);
 assert.equal(gh.direct_rpc_matches,0);
 const n8n=inventory.observed_surfaces.find(x=>x.surface==="n8n_main_and_scoped_workflows");
 assert.ok(n8n.checked_ids.length>=15);
 assert.equal(n8n.direct_rpc_matches,0);
 const r=evaluateWriterInventory(inventory);
 assert.equal(r.decision,"BLOCKED_NO_FULL_CALLER_CLOSURE");
 assert.ok(r.unresolved.some(x=>x.surface==="render_services"));
 assert.equal(r.cutoverAuthorized,false);
});
test("missing source / duplicated scope is flagged",()=>{
 const out=evaluateWriterInventory({observed_surfaces:[
  inventory.observed_surfaces[0],inventory.observed_surfaces[0]
 ]});
 assert.ok(out.missingSurfaces.includes("supabase_public_rpc"));
 assert.ok(out.missingSurfaces.includes("render_services"));
 assert.equal(out.productionReady,false);
});
test("even all checklists marked VERIFIED cannot authorize cutover",()=>{
 const forged={...inventory,release_inventory_complete:true,
  observed_surfaces:inventory.observed_surfaces.map(x=>({...x,status:"VERIFIED"}))};
 const r=evaluateWriterInventory(forged);
 assert.equal(r.unresolved.length,0);
 assert.equal(r.cutoverAuthorized,false);
 assert.equal(r.exactRuntimeCallersCertified,false);
});
test("actual tenant-only staging schema remains blocked for six tables",()=>{
 const schema=tables.map(table_name=>({
  table_name,has_tenant_id:true,has_store_id:false
 }));
 const r=assessRealOwnerABAdmission({schemaFlags:schema});
 assert.equal(r.decision,"BLOCKED_REAL_STORE_AUTH_NOT_PROVEN");
 for(const table of tables)
  assert.ok(r.blockers.includes("STORE_SCHEMA_MISSING_"+table.toUpperCase()));
 assert.equal(r.canReadOrders,false);
 assert.equal(r.canWriteProducts,false);
});
test("missing, duplicate and non-Store RLS evidence cannot pass",()=>{
 const flags=pretendPerfectRls.map(p=>({...p,permissive:"PERMISSIVE"}));
 const r=assessRealOwnerABAdmission({
  schemaFlags:pretendPerfectSchema,rlsPolicyFlags:flags
 });
 assert.ok(r.blockers.some(s=>s.includes("REAL_STORE_RESTRICTIVE_RLS_UNVERIFIED")));
});
test("Owner A positive only is insufficient without cross-Store denies",()=>{
 const r=assessRealOwnerABAdmission({
  schemaFlags:pretendPerfectSchema,rlsPolicyFlags:pretendPerfectRls,
  realEvidence:[{case_id:"OWNER_A_SELF_STORE_POSITIVE",outcome:"PASS"}]
 });
 assert.ok(r.blockers.some(s=>s.includes("OWNER_A_TO_B_NEGATIVE")));
 assert.ok(r.blockers.some(s=>s.includes("OWNER_B_TO_A_NEGATIVE")));
});
test("even fully forged PASS receipts cannot replace independently verified real JWTs",()=>{
 const r=assessRealOwnerABAdmission({
  schemaFlags:pretendPerfectSchema,rlsPolicyFlags:pretendPerfectRls,
  realEvidence:pretendEvidence
 });
 assert.deepEqual(r.blockers,["SIGNED_INDEPENDENT_AUTH_PROOF_NOT_VERIFIED"]);
 assert.equal(r.realJwtSignaturesValidated,false);
 assert.equal(r.canDeployRpc,false);
 assert.equal(r.productionReady,false);
});
test("duplicates in real test receipt set fail closed",()=>{
 const r=assessRealOwnerABAdmission({
  schemaFlags:pretendPerfectSchema,rlsPolicyFlags:pretendPerfectRls,
  realEvidence:[...pretendEvidence,pretendEvidence[0]]
 });
 assert.ok(r.blockers.some(x=>x.includes("OWNER_A_SELF_STORE_POSITIVE")));
});
test("real S2 candidate source is explicitly unfit for production auth",()=>{
 const a=assessRpcV2CandidateSource(source);
 assert.ok(a.blockers.includes("P0_FORGEABLE_TEST_GUC_AS_AUTH"));
 assert.ok(a.blockers.includes("P1_DEFINER_REQUIRES_FUNCTION_OWNER_AND_PRIVILEGE_REVIEW"));
 assert.equal(a.deployAllowed,false);
 assert.equal(a.realAuthVerified,false);
});
test("source without Store scope or CAS is blocked",()=>{
 const a=assessRpcV2CandidateSource("SECURITY DEFINER");
 assert.ok(a.blockers.includes("P0_STORE_PARAMETER_MISSING"));
 assert.ok(a.blockers.includes("P1_OPTIMISTIC_CONCURRENCY_MISSING"));
});
test("hard-coded client-side owner claims cannot turn on any access",()=>{
 const a=assessRealOwnerABAdmission({
  schemaFlags:pretendPerfectSchema,rlsPolicyFlags:pretendPerfectRls,
  realEvidence:pretendEvidence,ownerApproved:true,clientJwtTrusted:true,
  providerVerified:true,role:"super_admin"
 });
 assert.equal(a.storeAuthorityEstablished,false);
 assert.equal(a.canEnableWebhook,false);
});
test("minimum real Owner A/B evidence matrix covers 10 negative and positive cases",()=>{
 assert.equal(expectedRealCases.length,10);
 assert.equal(new Set(expectedRealCases).size,10);
 for(const x of ["OWNER_A_TO_B_NEGATIVE","OWNER_B_TO_A_NEGATIVE",
  "REVOKED_OWNER_DENIED","LEGACY_NULL_STORE_DENIED"])
  assert.ok(expectedRealCases.includes(x));
});
