// TIEN404 V19.0-B6 — read-only Store Authority evidence preflight.
// This is NOT a JWT verifier, Store resolver, live provider-account binder,
// RLS migration, Commerce adapter, or authorization. All outputs fail closed.
// Inputs are inspection snapshots, not a trusted browser/provider authority.

const BASE_TABLES=["conversations","customers","orders","products"];
const deny=(reasons)=>Object.freeze({
 stage:"V19_B6_STORE_AUTHORITY_PREFLIGHT",
 decision:"BLOCKED",
 reasons:Object.freeze([...new Set(reasons)]),
 sourceAuthorityProven:false,
 providerInstallationVerified:false,
 authenticatedOwnerABVerified:false,
 customerIdentityProven:false,
 commerceReadAllowed:false,
 commerceWriteAllowed:false,
 webhookReleaseAllowed:false,
 productionAllowed:false
});
export function assessStoreAuthorityPreflight({
 schemaRows=[],
 membershipEvidence="NOT_VERIFIED",
 ownerAOwnerBSessionEvidence="NOT_VERIFIED",
 negativeRlsEvidence="NOT_VERIFIED",
 providerBindingEvidence="NOT_VERIFIED",
 gatewayAdmissionEvidence="NOT_VERIFIED"
}={}){
 const reasons=[];
 if(!Array.isArray(schemaRows)||
  schemaRows.length!==BASE_TABLES.length ||
  !BASE_TABLES.every(t=>schemaRows.filter(r=>r?.table_name===t).length===1)){
   reasons.push("CANONICAL_COMMERCE_SCHEMA_INCOMPLETE");
 }else{
  for(const t of BASE_TABLES){
   const row=schemaRows.find(x=>x.table_name===t);
   if(row.has_store_id!==true)reasons.push("MISSING_STORE_ID_"+t.toUpperCase());
   if(row.has_tenant_id!==true)reasons.push("MISSING_TENANT_ID_"+t.toUpperCase());
  }
 }
 const gates=[
  [membershipEvidence,"MEMBERSHIP_UNVERIFIED"],
  [ownerAOwnerBSessionEvidence,"OWNER_A_B_SESSION_UNVERIFIED"],
  [negativeRlsEvidence,"CROSS_STORE_RLS_UNVERIFIED"],
  [providerBindingEvidence,"PROVIDER_INSTALLATION_BINDING_UNVERIFIED"],
  [gatewayAdmissionEvidence,"PRIVATE_GATEWAY_ADMISSION_UNVERIFIED"]
 ];
 // Only a verified independent review may advance the project. This
 // function NEVER grants read/write or provider sends even if all fields
 // are tagged VERIFIED by a malicious caller.
 for(const [signal,failure] of gates)if(signal!=="VERIFIED")reasons.push(failure);
 if(reasons.length===0)reasons.push("INDEPENDENT_SECURITY_APPROVAL_REQUIRED");
 return deny(reasons);
}
export default {fetch(){return new Response(null,{status:423});}};
