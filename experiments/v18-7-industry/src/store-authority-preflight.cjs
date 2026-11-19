"use strict";
// Metadata preflight QA ONLY. Never an access-control or authorization service.
const TABLES=Object.freeze(["products","orders","order_items","customers","conversations","messages"]);
const FKS=Object.freeze({
 order_customer_fk:"tenant_id,store_id,customer_id",
 item_order_fk:"tenant_id,store_id,order_id",
 item_product_fk:"tenant_id,store_id,product_id",
 message_conversation_fk:"tenant_id,store_id,conversation_id"
});
const PROOFS=Object.freeze(["real_owner_a_jwt","real_owner_b_jwt","same_tenant_store_ac_rls","cross_tenant_store_b_rls","migration_approved","rollback_tested","page_authority_verified","commerce_core_contract_reconciled"]);
const isRecord=o=>o!==null&&typeof o==="object"&&!Array.isArray(o);
function assess(snapshot){
 const blocks=new Set(),add=x=>blocks.add(x);
 if(!isRecord(snapshot)||snapshot.schema_version!=="V18.7.6A")return result(["INVALID_SNAPSHOT"]);
 if(snapshot.canonical_stores!==true)add("P0_NO_CANONICAL_STORES");
 if(snapshot.canonical_store_memberships!==true)add("P0_NO_STORE_MEMBERSHIPS");
 if(!isRecord(snapshot.tables))return result(["TABLE_METADATA_MISSING"]);
 for(const name of TABLES){
  const t=snapshot.tables[name];
  if(!isRecord(t)){add("P0_MISSING_TABLE_"+name);continue;}
  if(t.tenant!==true)add("P0_TENANT_KEY_"+name);
  if(t.store!==true)add("P0_STORE_KEY_"+name);
  if(t.rls!==true||t.force_rls!==true)add("P0_RLS_"+name);
 }
 if(!isRecord(snapshot.legacy))return result(["LEGACY_METADATA_MISSING"]);
 if(snapshot.legacy.product_sku_key!=="tenant_id,store_id,sku")add("P0_SKU_SCOPE_DECISION");
 for(const [name,expected] of Object.entries(FKS)){
  if(snapshot.legacy[name]!==expected)add("P0_COMPOSITE_FK_"+name);
 }
 if(snapshot.legacy.agent_config_key!=="tenant_id,store_id,channel")add("P1_STORE_BOT_CONFIG_ADAPTER");
 if(snapshot.legacy.tenant_memberships_key!=="tenant_id,user_id")add("P1_EXISTING_TENANT_MEMBERSHIP_COMPAT");
 if(!isRecord(snapshot.security))return result(["SECURITY_METADATA_MISSING"]);
 if(snapshot.security.store_rls_verified!==true)add("P0_REAL_STORE_RLS_NOT_VERIFIED");
 if(snapshot.security.definer_rpc_review_pending!==false)add("P1_RPC_REVIEW_PENDING");
 if(snapshot.security.anon_executable_definers!==0)add("P1_ANON_RPC_GRANT_REVIEW");
 if(snapshot.security.authenticated_executable_definers!==0)add("P1_AUTH_RPC_GRANT_REVIEW");
 if(!isRecord(snapshot.evidence))return result(["AUTH_EVIDENCE_MISSING"]);
 for(const proof of PROOFS)if(snapshot.evidence[proof]!==true)add("P0_PROOF_MISSING_"+proof);
 if(!Array.isArray(snapshot.dependency_prs)||snapshot.dependency_prs.join(",")!=="420,422,443")add("P1_PR_DEPENDENCY_DRIFT");
 return result([...blocks]);
}
function result(blockers){
 const b=Object.freeze(blockers.sort());
 return Object.freeze({kind:"OFFLINE_METADATA_ONLY",status:b.length?"NO_GO":"REVIEW_ONLY_NOT_AUTHORIZED",blockers:b,
  // A caller-supplied snapshot can NEVER prove real signed Auth/RLS.
  canReadRealData:false,realAuthVerified:false,rlsVerified:false,
  canWrite:false,canSend:false,productionReady:false});
}
module.exports={assess,TABLES,FKS,PROOFS};
