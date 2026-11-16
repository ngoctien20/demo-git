'use strict';
/**
 * TIEN404 V15 Sales Lite P0-H — REAL HOSTED METADATA-ONLY preflight evaluator.
 * This module accepts aggregate read-only *schema observations*, NOT
 * provider identities, customer data, secrets or business authorization.
 *
 * Metadata may be stale or spoofed. Even full structural eligibility cannot
 * prove Page/Bot/OA ownership, actual merchant consent, JWT/RLS isolation,
 * private backup or a trusted channel ingress. NO execution API is exposed.
 */
const EXPECTED='V15_P0H_HOSTED_METADATA_V1';
const FIELDS=Object.freeze([
 'tenant_rows','active_membership_rows','product_rows','order_rows',
 'private_channel_binding_rows','tenant_agent_config_rows','preview_lab_config_rows',
 'qa_bot_rows','qa_synthetic_bot_rows','qa_identity_map_rows',
 'canonical_store_tables','store_membership_tables',
 'products_store_id_columns','orders_store_id_columns',
 'tenant_scoped_product_select_policies','store_scoped_product_select_policies',
 'legacy_tenant_platform_pk','provider_account_unique_constraints',
 'duplicate_provider_account_bindings','orphan_provider_tenant_bindings'
]);
const BOOLS=Object.freeze([
 'private_channel_rls_enabled','private_channel_anon_select',
 'private_channel_authenticated_select'
]);
const TRUST_REQUIRED=Object.freeze([
 'NATIVE_PROVIDER_SIGNED_ACCOUNT_ID_AND_EVENT',
 'PRIVATE_MERCHANT_OWNER_CONSENT_FOR_EXACT_PROVIDER_ACCOUNT',
 'AUTHENTICATED_CANONICAL_TENANT_STORE_MEMBERSHIP',
 'HOSTED_ACTUAL_JWT_RLS_A_B_C_WITH_LEAST_PRIVILEGED_READER',
 'SCOPE_BOUND_CHANNEL_REGISTRY_UNIQUE_AND_NOT_REVOKED',
 'INDEPENDENT_BACKUP_RESTORE_AND_APPROVED_SCHEMA_MIGRATION',
 'NO_SEND_PILOT_OWNER_AND_SECURITY_APPROVAL'
]);
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
 Object.getPrototypeOf(x)===Object.prototype;
const locked=(status,reasons,observations={})=>Object.freeze({
 contract:'TIEN404_V15_P0H_REVIEW_V1',status,
 reasons:Object.freeze([...reasons]),
 observations:Object.freeze({...observations}),
 missing_real_proofs:TRUST_REQUIRED,
 metadata_only:true,real_provider_account_verified:false,
 real_merchant_owner_verified:false,hosted_jwt_rls_verified:false,
 real_commerce_price_verified:false,private_backup_restored:false,
 can_read_hosted_catalog:false,can_send:false,can_create_order:false,
 can_write_orders:false,can_reconfigure_n8n:false,can_apply_migration:false,
 can_access_secrets:false,can_publish:false,provider_sends:0,
 orders_written:0,paid_model_calls:0
});

function evaluateHostedChannelStorePreflight(snapshot){
 if(!plain(snapshot)||snapshot.preflight_contract!==EXPECTED||
  Object.keys(snapshot).length!==FIELDS.length+BOOLS.length+1||
  !Object.keys(snapshot).every(k=>k==='preflight_contract'||FIELDS.includes(k)||BOOLS.includes(k)))
  return locked('NO_GO',['INVALID_OR_UNTRUSTED_METADATA_SCHEMA']);
 for(const k of FIELDS)
  if(!Number.isSafeInteger(snapshot[k])||snapshot[k]<0||snapshot[k]>1000000000)
   return locked('NO_GO',['INVALID_AGGREGATE_VALUE']);
 for(const k of BOOLS)
  if(typeof snapshot[k]!=='boolean')
   return locked('NO_GO',['INVALID_SECURITY_BOOLEAN']);
 const reasons=[];
 const add=(cond,code)=>{if(cond)reasons.push(code);};
 add(snapshot.private_channel_binding_rows===0,'NO_REAL_PRIVATE_PROVIDER_ACCOUNT_BINDINGS');
 add(snapshot.canonical_store_tables!==1,'CANONICAL_STORE_TABLE_ABSENT');
 add(snapshot.store_membership_tables!==1,'CANONICAL_STORE_MEMBERSHIP_TABLE_ABSENT');
 add(snapshot.products_store_id_columns!==1||snapshot.orders_store_id_columns!==1,
   'COMMERCE_CORE_LACKS_STORE_SCOPE');
 add(snapshot.store_scoped_product_select_policies===0,
   'HOSTED_STORE_RLS_PRODUCT_POLICY_MISSING');
 add(snapshot.tenant_scoped_product_select_policies>0&&
    snapshot.store_scoped_product_select_policies===0,
   'TENANT_ONLY_PRODUCT_RLS_CANNOT_PROVE_SAME_TENANT_SHOP_ISOLATION');
 add(snapshot.legacy_tenant_platform_pk>0,
   'TENANT_PLATFORM_PK_LIMITS_MULTI_STORE_MULTI_ACCOUNT_MAPPING');
 add(snapshot.private_channel_binding_rows>0&&snapshot.provider_account_unique_constraints===0,
   'PROVIDER_ACCOUNT_UNIQUENESS_NOT_ENFORCED');
 add(snapshot.duplicate_provider_account_bindings>0,
   'PROVIDER_ACCOUNT_BINDING_AMBIGUOUS');
 add(snapshot.orphan_provider_tenant_bindings>0,'ORPHAN_PROVIDER_TENANT_BINDING');
 add(!snapshot.private_channel_rls_enabled||
     snapshot.private_channel_anon_select||
     snapshot.private_channel_authenticated_select,
   'PRIVATE_CHANNEL_TABLE_CLIENT_EXPOSURE_REVIEW_REQUIRED');
 add(snapshot.qa_bot_rows>0&&
    snapshot.qa_synthetic_bot_rows===snapshot.qa_bot_rows,
   'QA_BOTS_SYNTHETIC_NOT_REAL_PROVIDER_AUTHORITY');
 add(snapshot.qa_synthetic_bot_rows>snapshot.qa_bot_rows,
   'INCONSISTENT_QA_BOT_COUNTS');
 add(snapshot.tenant_agent_config_rows>0&&
   snapshot.tenant_agent_config_rows===snapshot.preview_lab_config_rows,
   'AGENT_CONFIGS_PREVIEW_ONLY');
 add(snapshot.preview_lab_config_rows>snapshot.tenant_agent_config_rows,
   'INCONSISTENT_TENANT_AGENT_CONFIG_COUNTS');
 add(snapshot.qa_identity_map_rows>0&&snapshot.canonical_store_tables===0,
   'QA_IDENTITY_MAP_CANNOT_REPLACE_CANONICAL_STORE');
 if(reasons.length===0)reasons.push('REAL_PRIVATE_PROVIDER_AND_HOSTED_JWT_PROOFS_STILL_REQUIRED');
 return locked('NO_GO',reasons,{
  private_channel_binding_rows:snapshot.private_channel_binding_rows,
  tenant_agent_config_rows:snapshot.tenant_agent_config_rows,
  qa_bot_rows:snapshot.qa_bot_rows,
  qa_synthetic_bot_rows:snapshot.qa_synthetic_bot_rows,
  canonical_store_tables:snapshot.canonical_store_tables,
  store_membership_tables:snapshot.store_membership_tables,
  products_store_id_columns:snapshot.products_store_id_columns,
  orders_store_id_columns:snapshot.orders_store_id_columns,
  store_scoped_product_select_policies:snapshot.store_scoped_product_select_policies,
  private_channel_table_not_directly_client_readable:
    snapshot.private_channel_rls_enabled&&
    !snapshot.private_channel_anon_select&&!snapshot.private_channel_authenticated_select
 });
}
module.exports={FIELDS,BOOLS,TRUST_REQUIRED,evaluateHostedChannelStorePreflight};
