/**
 * CBOT-UAT-07: bounded real-observation reconciliation and private adjudication
 * decision table. Does not inspect raw recovery files, tokens, Page IDs, Order
 * records or human identities; never issues an authorization.
 *
 * INPUT for authority_decisions: status ONLY, no raw evidence in GitHub/CI.
 * All "accepted" inputs are externally unverified until a distinct competent
 * human signs & witnesses the actual private material. Not a signing service.
 */
import {auditPrivateOperatorPacket} from '../cbot-uat06/private-m0-owner-native-gates.mjs';
export const CONTRACT='T404_CBOT_UAT07_REAL_SOURCE_ADJUDICATION_V1';
const deny=code=>{const e=new Error(code);e.code=code;throw e;};
const exact=(x,ks)=>x&&typeof x==='object'&&!Array.isArray(x)&&
 Object.getPrototypeOf(x)===Object.prototype&&Object.keys(x).length===ks.length&&ks.every(k=>Object.hasOwn(x,k));
const froz=x=>Object.freeze(x);
export const REQUIRED_GATES=froz([
 'M0_ENCRYPTED_REAL_OFFHOST_AUTH_STORAGE_ROLES_RESTORE',
 'M1_LEGACY_PRODUCT_ORDER_REAL_STORE_OWNERSHIP',
 'M2_REAL_TWO_STORE_SAME_TENANT_SIGNED_JWT_RLS',
 'META_NATIVE_PAGE_APP_MESSAGING_AND_CONSENT',
 'ZALO_NATIVE_OA_OAUTH_APP_AND_CONSENT',
 'RPC_SIX_DOMAIN_REAL_CALLER_CUTOVER',
 'CUSTOMER_VERIFIED_CROSS_CHANNEL_LINK',
 'HOSTED_COMMERCE_SCOPE_READ_RECEIPT'
]);
const statuses=new Set(['MISSING','PRIVATE_REVIEW_PENDING','CONTESTED','REJECTED','SELF_REPORTED_APPROVED_NOT_VERIFIED']);
const k=['gate','status','opaque_receipt_exists','independent_reviewer_checked','private_primary_source_read'];
export function evaluateUat07({observation,privatePacket=null,decisions=[]}={}){
 if(!observation||observation.contract!=='T404_CBOT_UAT07_NATIVE_WEBHOOK_PARITY_OBSERVED_V1'||
 observation.scope!=='CONNECTED_META_DEVELOPERS_READ_ONLY_UI_AND_N8N_PUBLISHED_ACTIVE_GRAPH')
  deny('SIGNED_OR_CONNECTED_OBSERVATION_REQUIRED');
 const meta=observation.meta||{},n=observation.n8n||{};
 const webhookMatched=meta.configured_callback_path==='tien404-messenger-qa'&&
 n.registered_webhook_path===meta.configured_callback_path&&
 n.messenger_published_workflow==='Z7FdV7uDvApfbURQ'&&n.messenger_active===true&&
 n.messenger_published_version==='d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92';
 const nativeAppEvents=meta.app_webhook_messages_subscribed===true&&
 meta.app_webhook_messaging_postbacks_subscribed===true&&
 meta.app_webhook_messages_version==='v27.0'&&
 meta.app_webhook_messaging_postbacks_version==='v27.0';
 let p=null;
 if(privatePacket!==null){
  // Strict UAT06 packet screens format/shape, not real legal authority.
  const res=auditPrivateOperatorPacket(privatePacket);
  p={shape_accepted:res.status==='PRIVATE_METADATA_SCREENED_NOT_AUTHORIZED',
    actual_private_material_authenticated:false,actual_recovery_witnessed:false,
    actual_owner_claims_certified:false};
 }
 if(!Array.isArray(decisions)||decisions.length>REQUIRED_GATES.length)deny('PRIVATE_DECISION_LIST_INVALID');
 const seen=new Set(),conflicts=[];
 for(const x of decisions){
  if(!exact(x,k)||!REQUIRED_GATES.includes(x.gate)||!statuses.has(x.status)||
   typeof x.opaque_receipt_exists!=='boolean'||typeof x.independent_reviewer_checked!=='boolean'||
   typeof x.private_primary_source_read!=='boolean'||seen.has(x.gate))
   deny('REDACTED_DECISION_SCHEMA_OR_DUPLICATE');
  seen.add(x.gate);
  if(x.status==='CONTESTED'||x.status==='REJECTED')conflicts.push(x.gate);
 }
 const unreviewed=REQUIRED_GATES.filter(g=>!seen.has(g));
 const faults=[];
 if(!webhookMatched)faults.push('META_N8N_WEBHOOK_PATH_OR_PUBLISHED_VERSION_MISMATCH');
 if(!nativeAppEvents)faults.push('META_APP_WEBHOOK_MESSAGES_OR_POSTBACKS_UNCONFIRMED');
 if(meta.native_page_subscribed_apps_verified!==true||
 meta.native_meta_business_page_full_control_verified!==true||
 meta.pages_messaging_permission_granted_verified!==true)
   faults.push('META_PAGE_LEVEL_OWNER_PERMISSION_NOT_VERIFIED');
 if(meta.exact_test_recipient_owner_consent_verified!==true)faults.push('META_ONE_RECIPIENT_PRIVATE_CONSENT_MISSING');
 faults.push('REAL_PRIVATE_OFFHOST_M0_RESTORE_WITNESS_NOT_PRESENT');
 faults.push('FOUR_REAL_BUSINESS_ROWS_STORE_OWNER_ADJUDICATION_NOT_PRESENT');
 faults.push('REAL_AUTHENTICATED_JWT_STORE_RLS_NOT_PROVEN');
 faults.push('ZALO_NATIVE_OA_APP_OWNER_NOT_PROVEN');
 faults.push('RPC_EXTERNAL_CALLERS_NOT_CLOSED');
 faults.push('HOSTED_CUSTOMER_SCOPED_COMMERCE_LOOKUP_NOT_AUTHORIZED');
 return froz({
   contract:CONTRACT,mode:'SOURCE_RECONCILIATION_NOT_AUTHORITY',
   meta_native_app_webhook_parity_observed:webhookMatched,
   meta_messages_postbacks_app_subscribed_observed:nativeAppEvents,
   meta_page_native_owner_proved:false,
   private_packet_shape_screened:p?.shape_accepted===true,
   actual_private_witness_accepted:false,
   actual_m0_recovery_accepted:false,
   merchant_four_row_owner_proved:false,
   actionable_gap_count:REQUIRED_GATES.length,
   private_decision_categories_received:seen.size,
   unreviewed_categories:froz(unreviewed),
   disputed_or_rejected_categories:froz(conflicts),
   blockers:froz(faults),
   can_prepare_private_operator_review:true,
   can_change_meta_webhook:false,
   can_send_messenger_canary:false,
   can_revoke_rpc:false,
   can_migrate_store:false,
   can_query_hosted_store_orders:false,
   can_export_hosted_auth:false,
   can_merge_production:false
 });
}
export function declarePrivateM0Accepted(){deny('ACTUAL_INDEPENDENT_OFFHOST_RESTORE_MISSING');}
export function adjudicateStoreRowAsVerified(){deny('REAL_MERCHANT_OWNER_ROW_PROOF_MISSING');}
export function approveNativePageCommerce(){deny('PAGE_LEVEL_APP_PERMISSIONS_AND_MERCHANT_CONSENT_UNVERIFIED');}
