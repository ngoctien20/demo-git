import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import module,{assessS4Readiness,buildS4SafeReleasePlan,STORE_TABLES}
 from "../migration-readiness-audit.mjs";

const snapshot=JSON.parse(readFileSync(
 new URL("../staging-readonly-snapshot.json",import.meta.url),"utf8"
));
const clone=()=>structuredClone(snapshot);
test("S4 default Worker access is locked",async()=>{
 assert.equal((await module.fetch()).status,423);
});
test("snapshot only contains aggregated non-PII table metadata",()=>{
 assert.equal(snapshot.tables.length,6);
 assert.ok(snapshot.tables.every(x=>Number.isSafeInteger(x.row_count)));
 assert.deepEqual(snapshot.tables.filter(x=>x.row_count).map(x=>[x.name,x.row_count]).sort(),
  [["orders",2],["products",2]]);
 assert.equal(snapshot.caller_inventory.render_services_audited,false);
 assert.equal(snapshot.trusted_owner_ab.real_jwt_A_tested,false);
});
test("exact current Store metadata correctly returns NO-GO",()=>{
 const x=assessS4Readiness(snapshot);
 assert.equal(x.decision,"BLOCKED_MIGRATION_NOT_READY");
 assert.equal(x.stagingDDLAllowed,false);
 assert.equal(x.productionAllowed,false);
 assert.equal(x.customerDataBackfillAllowed,false);
 assert.equal(x.mappedLegacyRecords,0);
});
test("all 6 Commerce tables lack real Store ID and restrictive scope",()=>{
 const x=assessS4Readiness(snapshot);
 for(const t of STORE_TABLES){
  assert.ok(x.blockers.includes("STORE_ID_MISSING_"+t.toUpperCase()));
  assert.ok(x.blockers.includes("STORE_RESTRICTIVE_RLS_MISSING_"+t.toUpperCase()));
 }
});
test("current Store registry, Store memberships and installation trust do not exist",()=>{
 const x=assessS4Readiness(snapshot);
 for(const key of ["CANONICAL_STORES_ABSENT","CANONICAL_STORE_MEMBERSHIPS_ABSENT",
   "PRIVATE_INSTALLATION_AUTHORITY_ABSENT"])
  assert.ok(x.blockers.includes(key));
});
test("real A/B signing, same Tenant and cross-Store RLS remain unverified",()=>{
 const x=assessS4Readiness(snapshot);
 for(const key of ["REAL_OWNER_A_SESSION_NOT_VERIFIED",
   "REAL_OWNER_B_SESSION_NOT_VERIFIED","SAME_TENANT_STORE_A_B_NOT_PROVEN",
   "REAL_CROSS_STORE_RLS_NOT_TESTED"])assert.ok(x.blockers.includes(key));
});
test("Render unselected workspace and external callers block writer removal",()=>{
 const x=assessS4Readiness(snapshot);
 assert.ok(x.blockers.includes("RENDER_CALLER_SCOPE_UNRESOLVED"));
 assert.ok(x.blockers.includes("RPC_WRITER_CALLER_INVENTORY_INCOMPLETE"));
});
test("current V1 cannot be silently used after NOT VALID Store check",()=>{
 const x=assessS4Readiness(snapshot);
 assert.ok(x.blockers.includes("EXISTING_TENANT_ONLY_PRODUCT_WRITER_INCOMPATIBLE"));
 assert.ok(x.blockers.includes("D02_SKU_UNIQUENESS_DECISION_OPEN"));
});
test("backup and independent review are mandatory, never inferred from draft PR",()=>{
 const x=assessS4Readiness(snapshot);
 for(const key of ["BACKUP_RESTORE_PROOF_MISSING","STAGING_DDL_APPROVAL_MISSING",
  "INDEPENDENT_SECURITY_REVIEW_MISSING"])assert.ok(x.blockers.includes(key));
});
test("duplicate table rows cannot be used to fabricate Store readiness",()=>{
 const x=clone(); x.tables.push({...x.tables[0],has_store_id:true});
 assert.ok(assessS4Readiness(x).blockers.includes("MISSING_OR_DUPLICATE_TABLE_METADATA_PRODUCTS"));
});
test("injected misleading positive flags do not become database authorization",()=>{
 const x=clone();
 for(const t of x.tables){t.has_store_id=true;t.restrictive_policy_count=1;}
 for(const k of Object.keys(x.registry))x.registry[k]=true;
 for(const k of Object.keys(x.constraints))x.constraints[k]=true;
 for(const k of Object.keys(x.caller_inventory))
  if(typeof x.caller_inventory[k]==="boolean")x.caller_inventory[k]=true;
 for(const k of Object.keys(x.trusted_owner_ab))x.trusted_owner_ab[k]=true;
 for(const k of Object.keys(x.approvals))x.approvals[k]=true;
 x.rpc_v1.store_scoped=true;
 const result=assessS4Readiness(x);
 assert.equal(result.readyForReview,true);
 assert.equal(result.decision,"PENDING_INDEPENDENT_SIGNED_APPROVAL");
 assert.equal(result.stagingDDLAllowed,false);
 assert.equal(result.liveRpcV2Allowed,false);
 assert.equal(result.realOwnerABVerified,false);
 assert.equal(result.providerSendAllowed,false);
});
test("fabricated unknown project snapshot is not accepted",()=>{
 const x=assessS4Readiness({project_ref:"other-project",tables:[]});
 assert.equal(x.decision,"BLOCKED_INVALID_READONLY_SNAPSHOT");
 assert.equal(x.productionAllowed,false);
});
test("missing metadata fails closed even with approved flags",()=>{
 const x=assessS4Readiness({project_ref:snapshot.project_ref,tables:[]});
 assert.ok(x.blockers.includes("MISSING_OR_DUPLICATE_TABLE_METADATA_ORDERS"));
});
test("no phase performs an automatic write",()=>{
 const plan=buildS4SafeReleasePlan();
 assert.equal(plan.length,7);
 assert.deepEqual(plan.map(x=>x.phase),[0,1,2,3,4,5,6]);
 assert.ok(plan.every(x=>x.change==="NONE"||x.change.includes("APPROVAL_REQUIRED")));
 assert.ok(plan.find(x=>x.phase===6).requires.includes("V1 caller closure"));
});
test("legacy mapping and write cutover must be separately approved",()=>{
 const plan=buildS4SafeReleasePlan();
 assert.ok(plan.find(x=>x.phase===4).requires.includes("per-row"));
 assert.equal(plan.find(x=>x.phase===6).change,"SEPARATE_APPROVAL_REQUIRED");
});
