/**
 * TIEN404 CBOT-UAT-04 — read-only hosted metadata → operator intake report.
 * This does not certify a backup or synthesize an Owner/JWT/reviewer approval.
 * H11R.11 PR #205 is the ONLY private evidence-intake authority; even its
 * synthetic signed metadata remains pending external human verification.
 */
export const REPORT_CONTRACT='T404_CBOT_UAT04_HOSTED_PREFLIGHT_V1';
const immutable=x=>Object.freeze(x);
const yes=x=>x===true;
const no=x=>x===false;
const int=x=>Number.isSafeInteger(x)&&x>=0?x:null;
const mandatoryFields=[
 'tenant_count','product_count','order_count','customer_count',
 'stores_present','store_memberships_present','orders_store_id_present',
 'products_store_id_present','legacy_rpc_exists','legacy_rpc_definer',
 'legacy_rpc_anon_execute','orders_rls_policy_count'
];
export function evaluateHostedReadOnlyPreflight({projectRef,metadata,receipts}={}){
 const x=metadata&&typeof metadata==='object'&&!Array.isArray(metadata)?metadata:{};
 const clean={
  tenant_count:int(x.tenant_count),product_count:int(x.product_count),
  order_count:int(x.order_count),customer_count:int(x.customer_count),
  stores_present:typeof x.stores_present==='boolean'?x.stores_present:null,
  store_memberships_present:typeof x.store_memberships_present==='boolean'?x.store_memberships_present:null,
  orders_store_id_present:typeof x.orders_store_id_present==='boolean'?x.orders_store_id_present:null,
  products_store_id_present:typeof x.products_store_id_present==='boolean'?x.products_store_id_present:null,
  legacy_rpc_exists:typeof x.legacy_rpc_exists==='boolean'?x.legacy_rpc_exists:null,
  legacy_rpc_definer:typeof x.legacy_rpc_definer==='boolean'?x.legacy_rpc_definer:null,
  legacy_rpc_anon_execute:typeof x.legacy_rpc_anon_execute==='boolean'?x.legacy_rpc_anon_execute:null,
  orders_rls_policy_count:int(x.orders_rls_policy_count)
 };
 const reasons=[];
 if(projectRef!=='ifxlvrhyjhbzbrkdsida')reasons.push('PROJECT_NOT_VERIFIED');
 if(mandatoryFields.some(k=>clean[k]===null))reasons.push('METADATA_INCOMPLETE_OR_UNKNOWN');
 if(!yes(clean.stores_present)||!yes(clean.store_memberships_present)||
    !yes(clean.orders_store_id_present)||!yes(clean.products_store_id_present))
    reasons.push('STORE_OWNERSHIP_SCHEMA_NOT_READY');
 if(yes(clean.legacy_rpc_exists)&&yes(clean.legacy_rpc_definer)&&yes(clean.legacy_rpc_anon_execute))
    reasons.push('LEGACY_PRIVILEGED_RPC_ANON_EXPOSURE');
 if(clean.legacy_rpc_anon_execute===null)
    reasons.push('RPC_ACL_NOT_OBSERVED');
 // Signed metadata says nothing about true human legal authority or a real
 // offsite Auth/Storage/ACL recovery; never set GO from a caller's flags.
 const r=receipts&&typeof receipts==='object'&&!Array.isArray(receipts)?receipts:{};
 const reviewTypes=['RECOVERY','CALLER','STORE_OWNER'];
 const acceptedShape=reviewTypes.filter(k=>r[k]?.contract==='T404_H11R11_V1'&&
   r[k]?.cryptographicMetadataChecked===true).length;
 reasons.push('REAL_INDEPENDENT_RECOVERY_AND_AUTH_STORAGE_RESTORE_NOT_ATTESTED');
 reasons.push('REAL_PAGE_OA_AND_TWO_STORE_OWNER_JWT_PROOF_NOT_ATTESTED');
 reasons.push('LEGACY_RPC_SIX_DOMAIN_CALLER_CUTOVER_NOT_ATTESTED');
 return immutable({
  contract:REPORT_CONTRACT,observation_level:'HOSTED_READ_ONLY_METADATA_AND_SOURCE_CI',
  project:projectRef==='ifxlvrhyjhbzbrkdsida'?'TIEN404_STAGING':'UNKNOWN',
  metadata:immutable(clean),
  h11r11_metadata_receipt_shapes:acceptedShape,
  external_operator_receipt_verified:false,
  private_full_recovery_accepted:false,
  real_page_oa_proven:false,
  actual_hosted_store_rls_proven:false,
  can_run_metadata_only_preflight:true,
  can_run_hosted_order_lookup:false,
  can_export_private_hosted_backup:false,
  can_apply_store_migration:false,
  can_change_rpc_acl:false,
  can_publish_messenger:false,
  can_send_zalo:false,
  blockers:immutable([...new Set(reasons)])
 });
}
export function safeOperationalSequence(){
 return immutable([
  'READ_ONLY_HOS­TED_CATALOG_AND_RPC_ACL_BASELINE'.replace('\u00ad',''),
  'EXISTING_ARCHIVE_LOCAL_INTEGRITY_AND_COVERAGE_CHECK',
  'INDEPENDENT_REAL_ENCRYPTED_AUTH_STORAGE_ACL_RESTORE_RECEIPT',
  'H11R11_PRIVATE_REAL_CALLER_AND_FOUR_ROW_STORE_OWNER_EVIDENCE',
  'H11R10_PG17_MIGRATION_COMPATIBILITY_AND_APPROVED_HOSTED_BACKUP',
  'AUTHORIZE_EXACT_EXPAND_ONLY_STORE_MIGRATION_AND_ROLLBACK',
  'INDEPENDENT_SAME_TENANT_TWO_STORE_OWNER_JWT_RLS_NEGATIVES',
  'PRIVATE_RPC_GATEWAY_REAL_PROVIDER_SIGNATURE_AND_REPLAY_LEDGER',
  'SIX_DOMAIN_CALLER_SHADOW_CUTOVER_WITH_ZERO_LEGACY_TRAFFIC',
  'SEPARATE_APPROVAL_FOR_EXACT_PRIVILEGE_CHANGE_AND_ROLLBACK',
  'HOSTED_ORDER_LOOKUP_READ_ONLY_WITH_LINKED_CUSTOMER_PROOF',
  'HUMAN_MESSENGER_ZALO_LIVE_ORDER_READ_UAT'
 ]);
}
export function authorizeActualBackup(){throw Error('PRIVATE_BACKUP_OPERATOR_APPROVAL_MISSING')}
export function authorizeHostPilot(){throw Error('HOSTED_STORE_READ_ONLY_JWT_PROOF_MISSING')}
export function authorizeLegacyRpcRevoke(){throw Error('LEGACY_CALLER_CUTOVER_NOT_CERTIFIED')}
