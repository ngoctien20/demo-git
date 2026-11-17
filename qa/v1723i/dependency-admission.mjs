/**
 * V17.23I source-only diagnostics, never identity validation or hosted admission.
 * Authenticated operator observations must originate from a private independent runtime.
 * Even perfect self-reported evidence SHALL NEVER approve a hosted operation here.
 */
export const PHASES = Object.freeze({
  M0: Object.freeze([]),
  M1: Object.freeze(['M0']),
  M2_M4: Object.freeze(['M1']),
  M3: Object.freeze(['M2_M4']),
  M5: Object.freeze(['M3'])
});
export const SURFACES = Object.freeze(['products','orders','customers','order_items','conversations','messages']);
const requiredFlags = Object.freeze({
  M0:['scope_selected_by_owner','source_consistent_archive_verified','auth_restore_independently_verified','storage_and_roles_recovery_verified','operator_and_independent_reviewer_verified'],
  M1:['four_legacy_rows_independently_attributed','m0_recovery_acceptance_independently_signed','legacy_caller_inventory_complete'],
  M2_M4:['store_backfill_audited','atomic_tenant_policy_cutover_approved','all_six_store_rls_negative_uat_passed','no_cross_store_readers'],
  M3:['same_store_composite_fk_verified','sku_uniqueness_compatibility_verified','order_item_and_customer_fks_verified'],
  M5:['two_distinct_issuer_validated_jwt_sessions','same_tenant_distinct_canonical_store_proof','real_authenticated_store_a_b_negative_uat','verified_customer_channel_order_binding','signed_provider_qa_admission']
});
export function checkDependencyGraph(graph=PHASES) {
 const keys=Object.keys(graph),done=new Set(),walking=new Set(),order=[];
 const visit=(k)=>{if(!Object.hasOwn(graph,k))throw Error('UNKNOWN_PHASE');if(walking.has(k))throw Error('DEPENDENCY_CYCLE');if(done.has(k))return;walking.add(k);for(const dep of graph[k])visit(dep);walking.delete(k);done.add(k);order.push(k)};
 for(const key of keys)visit(key);
 return Object.freeze(order);
}
const uniq=(x)=>[...new Set(x)];
export function inspectPreflight(snapshot={}) {
 const blockers=[];
 if(snapshot?.projectRef!=='ifxlvrhyjhbzbrkdsida')blockers.push('WRONG_PROJECT_REF');
 for(const [key,count] of Object.entries({tenants:2,products:2,orders:2,customers:0,authUsers:3}))
  if(snapshot[key]!==count)blockers.push('BASELINE_'+key.toUpperCase()+'_DRIFT');
 if(snapshot?.canonicalStores!==0)blockers.push('STORES_SHAPE_CHANGED_REAUDIT');
 if(snapshot?.storeMemberships!==0)blockers.push('STORE_MEMBERSHIPS_SHAPE_CHANGED_REAUDIT');
 if(snapshot?.publicStoreColumns!==0)blockers.push('STORE_COLUMNS_CHANGED_REAUDIT');
 if(snapshot?.qaSameTenantStoreGroups!==0)blockers.push('QA_IDENTITY_MAP_CHANGED_REAUDIT');
 if(snapshot?.verifiedCustomerBindings!==0)blockers.push('CUSTOMER_BINDING_CHANGED_REAUDIT');
 if(snapshot?.legacyTenantOrderSelectPolicies!==1)blockers.push('RLS_POLICY_CHANGED_REAUDIT');
 const perms=snapshot?.permissiveTenantReads;
 if(!perms || SURFACES.some(t=>perms[t]!==true))blockers.push('SIX_SURFACE_POLICY_INVENTORY_INCOMPLETE');
 return Object.freeze({status:blockers.length?'BASELINE_REAUDIT_REQUIRED':'BASELINE_SHAPE_ONLY',blockers:Object.freeze(uniq(blockers)),realOwnerProof:false,realJwtProof:false});
}
export function reviewMigrationAdmission({snapshot={},claims={},operation='REVIEW_ONLY',secrets={}}={}) {
 const shape=inspectPreflight(snapshot),blockers=[...shape.blockers];
 const gates={};
 for (const phase of checkDependencyGraph()) {
   const missing=requiredFlags[phase].filter(k=>claims?.[k]!==true);
   gates[phase]=Object.freeze({claimedComplete:missing.length===0,independentlyVerified:false,missing:Object.freeze(missing)});
   if(missing.length)blockers.push(phase+'_EXTERNAL_PROOF_MISSING');
 }
 if(operation!=='REVIEW_ONLY')blockers.push('UNAUTHORIZED_OPERATION');
 if(secrets && typeof secrets==='object' && Object.keys(secrets).length)blockers.push('SECRET_INPUT_NOT_ACCEPTED');
 if(claims?.user_metadata||claims?.clientStoreId||claims?.clientTenantId||claims?.rawJwt)blockers.push('UNTRUSTED_CLAIM_OR_STORE_OVERRIDE');
 // Even if all flags true, only an independent authenticated verifier can authorize anything.
 blockers.push('INDEPENDENT_PRIVATE_AUTHENTICATED_VERIFIER_REQUIRED');
 return Object.freeze({status:'HOSTED_NO_GO',operationPermitted:false,canReadRealOrder:false,canBackfill:false,canApplyM1:false,canCutoverRls:false,canRunRealJwt:false,canSend:false,canDeploy:false,phaseOrder:checkDependencyGraph(),gates:Object.freeze(gates),blockers:Object.freeze(uniq(blockers))});
}
