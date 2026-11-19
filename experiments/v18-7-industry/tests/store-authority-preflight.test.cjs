"use strict";
const test=require("node:test"),a=require("node:assert/strict");
const {assess,TABLES,FKS,PROOFS}=require("../src/store-authority-preflight.cjs");
const evidence=require("../evidence/staging-store-metadata-20261119.json");
const clone=x=>JSON.parse(JSON.stringify(x));
const mutate=fn=>{const x=clone(evidence);fn(x);return assess(x);};
const must=(r,c)=>a.ok(r.blockers.includes(c),"missing blocker "+c);
test("evidence contains only schema metadata, no row records",()=>{
 a.equal(evidence.schema_version,"V18.7.6A");
 a.equal(evidence.observed_date,"2026-11-19");
 a.match(evidence.scope,/read-only/);
});
test("current Supabase preflight is NO_GO",()=>{
 const r=assess(evidence);a.equal(r.status,"NO_GO");
 must(r,"P0_NO_CANONICAL_STORES");must(r,"P0_NO_STORE_MEMBERSHIPS");
 a.equal(r.canReadRealData,false);a.equal(r.productionReady,false);
});
test("canonical store tables remain absent",()=>{
 a.equal(evidence.canonical_stores,false);
 a.equal(evidence.canonical_store_memberships,false);
});
for(const name of TABLES){
 test(name+" observed tenant RLS exists but store scope absent",()=>{
  const t=evidence.tables[name];a.equal(t.tenant,true);a.equal(t.store,false);
  a.equal(t.rls,true);a.equal(t.force_rls,true);
  must(assess(evidence),"P0_STORE_KEY_"+name);
 });
 test(name+" lack of metadata fails closed",()=>{
  must(mutate(x=>{delete x.tables[name]}),"P0_MISSING_TABLE_"+name);
 });
 test(name+" missing tenant scope fails closed",()=>{
  must(mutate(x=>{x.tables[name].tenant=false}),"P0_TENANT_KEY_"+name);
 });
 test(name+" disabled FORCE RLS fails closed",()=>{
  must(mutate(x=>{x.tables[name].force_rls=false}),"P0_RLS_"+name);
 });
}
for(const [name,expected] of Object.entries(FKS)){
 test(name+" legacy key is tenant-only",()=>{
  a.notEqual(evidence.legacy[name],expected);must(assess(evidence),"P0_COMPOSITE_FK_"+name);
 });
 test(name+" spoofed wrong FK remains blocked",()=>{
  must(mutate(x=>{x.legacy[name]="tenant_id,other_id"}),"P0_COMPOSITE_FK_"+name);
 });
}
test("per-tenant unique SKU prevents same-SKU sibling stores",()=>{
 a.equal(evidence.legacy.product_sku_key,"tenant_id,sku");
 must(assess(evidence),"P0_SKU_SCOPE_DECISION");
});
test("do not add store_id to tenant_memberships blindly",()=>{
 a.equal(evidence.legacy.tenant_memberships_key,"tenant_id,user_id");
 a.equal(evidence.canonical_store_memberships,false);
});
test("tenant-channel Agent Config requires compatibility mapping",()=>must(assess(evidence),"P1_STORE_BOT_CONFIG_ADAPTER"));
test("RLS not proven for real Store membership",()=>must(assess(evidence),"P0_REAL_STORE_RLS_NOT_VERIFIED"));
test("RPC review needed but no automatic permission change",()=>must(assess(evidence),"P1_RPC_REVIEW_PENDING"));
test("anon SECURITY DEFINER grant review required",()=>must(assess(evidence),"P1_ANON_RPC_GRANT_REVIEW"));
test("authenticated SECURITY DEFINER grant review required",()=>must(assess(evidence),"P1_AUTH_RPC_GRANT_REVIEW"));
for(const proof of PROOFS)test("live admission proof is absent: "+proof,()=>must(assess(evidence),"P0_PROOF_MISSING_"+proof));
test("bad snapshot fails closed",()=>a.equal(assess(null).status,"NO_GO"));
test("wrong schema version fails closed",()=>a.equal(mutate(x=>{x.schema_version="v2"}).status,"NO_GO"));
test("missing table metadata fails closed",()=>a.equal(mutate(x=>{delete x.tables}).status,"NO_GO"));
test("missing constraint metadata fails closed",()=>a.equal(mutate(x=>{delete x.legacy}).status,"NO_GO"));
test("missing security metadata fails closed",()=>a.equal(mutate(x=>{delete x.security}).status,"NO_GO"));
test("missing Auth evidence fails closed",()=>a.equal(mutate(x=>{delete x.evidence}).status,"NO_GO"));
test("unexpected parent PR drift blocks",()=>must(mutate(x=>{x.dependency_prs=[420,443]}),"P1_PR_DEPENDENCY_DRIFT"));
test("self-asserted fully green snapshot never authorizes real access",()=>{
 const x=clone(evidence);x.canonical_stores=true;x.canonical_store_memberships=true;
 for(const name of TABLES)x.tables[name]={tenant:true,store:true,rls:true,force_rls:true};
 x.legacy.product_sku_key="tenant_id,store_id,sku";
 x.legacy.agent_config_key="tenant_id,store_id,channel";
 for(const [name,value] of Object.entries(FKS))x.legacy[name]=value;
 x.security.store_rls_verified=true;
 x.security.definer_rpc_review_pending=false;x.security.anon_executable_definers=0;x.security.authenticated_executable_definers=0;
 for(const k of PROOFS)x.evidence[k]=true;
 const r=assess(x);a.equal(r.status,"REVIEW_ONLY_NOT_AUTHORIZED");
 a.equal(r.canReadRealData,false);a.equal(r.canSend,false);a.equal(r.canWrite,false);
 a.equal(r.realAuthVerified,false);a.equal(r.rlsVerified,false);a.equal(r.productionReady,false);
});
