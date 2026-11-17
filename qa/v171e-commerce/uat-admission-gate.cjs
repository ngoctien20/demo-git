'use strict';
/**
 * Admission checklist only. Never authorizes Meta/Zalo SEND or order write.
 * Supplied evidence is CLAIMED; an external independent authority is required.
 */
const VERSION='T404_V171E_MESSENGER_ZALO_UAT_REVIEW_GATE_V1';
const REQUIREMENTS=Object.freeze([
 'merchant_photo_rights_and_retention',
 'real_model_vendor_receipts_and_billing',
 'independent_real_photo_label_validation',
 'no_cross_store_candidate_leakage',
 'verified_messenger_page_ownership_and_signature',
 'verified_zalo_oa_ownership_and_signature',
 'source_confirmed_durable_cross_channel_link',
 'hosted_jwt_store_rls_and_customer_order_grant',
 'independent_recovery_restore_acceptance',
 'explicit_customer_consent_and_revocation',
 'read_only_shadow_no_send_approved'
]);
const fail=x=>{throw Error(x);};
function assessUat({corpus,benchmark,checks}={}){
 if(!corpus||!benchmark||!checks||typeof checks!=='object'||
   Array.isArray(checks)||corpus.tenantId!==benchmark.tenantId||
   corpus.storeId!==benchmark.storeId||
   corpus.version!=='T404_V171E_MERCHANT_CORPUS_PREPARATION_V1'||
   benchmark.version!=='T404_V171E_VISION_RECEIPT_METRICS_V1')
   fail('UAT_REVIEW_EVIDENCE_SCOPE_INVALID');
 const missing=REQUIREMENTS.filter(k=>checks[k]!=='INDEPENDENTLY_VERIFIED');
 if(!corpus.rightsIndependentlyVerified)
   missing.push('corpus_rights_currently_unverified_by_source_module');
 if(!benchmark.providerReceiptsIndependentlyVerified)
   missing.push('model_receipts_currently_unverified_by_source_module');
 if(!benchmark.labelsIndependentlyVerified)
   missing.push('query_labels_currently_unverified_by_source_module');
 if(!benchmark.proposedMinimumSampleSatisfied)
   missing.push('minimum_real_benchmark_sample_not_met');
 if(benchmark.crossStoreOrUnknownSkuViolations!==0)
   missing.push('catalog_scope_violation');
 return Object.freeze({version:VERSION,status:'HOSTED_NO_GO',
   mode:'REVIEW_ONLY_NO_SEND',missing:Object.freeze([...new Set(missing)]),
   requiresIndependentEvidenceAndExplicitHumanApproval:true,
   authorizedForRealMessengerZaloUat:false,
   authorizedForModelBilling:false,authorizedForLiveSend:false,
   authorizedForOrderWrite:false,authorizedForHostMigration:false,
   customerMustSelectSku:true,customerMustConfirmFinalOrder:true,
   providerSends:0,hostedWrites:0});
}
module.exports=Object.freeze({VERSION,REQUIREMENTS,assessUat});
