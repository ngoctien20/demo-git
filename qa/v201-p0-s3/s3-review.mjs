/** TIEN404 V20.1-P0-S3: synthetic evidence review only. No host/runtime I/O. */
const unavailable = (reason, issues = []) => Object.freeze({ state: 'BLOCKED', reason, issues });
const isText = (x) => typeof x === 'string' && x.trim().length > 0;
const safeEvidenceRef = (s) => isText(s) && s.length <= 512 && !/(bearer|token=|apikey|secret|password=|access_key|refresh_token)/i.test(s);
const dateValid = (d) => isText(d) && Number.isFinite(Date.parse(d));

/** A complete manifest is a review candidate, not an authenticated owner decision. */
export function reviewRender(input = {}) {
  const issues = [];
  if (input.ownerConfirmedWorkspace !== true || !isText(input.workspaceId)) issues.push('owner_workspace_confirmation_missing');
  if (!Array.isArray(input.services) || input.services.length === 0) issues.push('real_service_inventory_missing');
  else {
    for (const entry of input.services) {
      if (!entry || !isText(entry.serviceId) || !isText(entry.deployedRevision) ||
          !safeEvidenceRef(entry.sourceEvidence) || !['DIRECT_CALL','NO_LITERAL_MATCH','UNRESOLVED'].includes(entry.callerClassification)) {
        issues.push('incomplete_service_attestation'); break;
      }
    }
  }
  if (input.dynamicCallerReview !== 'VERIFIED') issues.push('dynamic_caller_review_missing');
  if (input.pageClientCallersReviewed !== true) issues.push('browser_page_clients_unreviewed');
  if (issues.length) return unavailable('render_caller_closure_incomplete', issues);
  return Object.freeze({ state:'HUMAN_REVIEW_REQUIRED', reason:'render_evidence_structurally_complete_only', issues:[] });
}

/** A digest is not proof the restore succeeds. This is evidence inventory, not backup/restore execution. */
export function reviewBackup(input = {}) {
  const issues=[];
  if (input.plan !== 'free') issues.push('plan_unverified_or_changed');
  if (input.projectRef !== 'ifxlvrhyjhbzbrkdsida') issues.push('wrong_project_reference');
  if (input.realHostedArchive !== true) issues.push('real_hosted_export_missing');
  if (typeof input.sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(input.sha256)) issues.push('archive_integrity_hash_missing');
  if (!safeEvidenceRef(input.privateArchiveReceipt)) issues.push('private_archive_receipt_missing');
  if (!dateValid(input.exportedAt)) issues.push('archive_timestamp_missing');
  if (input.independentRestore !== true) issues.push('isolated_restore_missing');
  if (input.restoredFromSameArchive !== true) issues.push('restore_archive_mismatch_or_missing');
  if (input.schemaRlsCompared !== true) issues.push('schema_rls_comparison_missing');
  if (input.authRoleCoverage !== true) issues.push('auth_roles_coverage_missing');
  if (input.storageObjectsCovered !== true) issues.push('storage_objects_unbacked');
  if (input.vaultAndSecretsRecoveryPlanned !== true) issues.push('vault_secret_recovery_missing');
  if (input.negativeStoreTests !== true) issues.push('cross_store_negative_qa_missing');
  if (issues.length) return unavailable('hosted_b00_backup_restore_incomplete',issues);
  return Object.freeze({ state:'HUMAN_REVIEW_REQUIRED', reason:'backup_evidence_claims_unverified_by_this_module', issues:[] });
}

/** Distinguishes Zalo products. Never generates real bot URLs or QR payloads. */
export function reviewMerchantBotLink(input = {}) {
  if (input.product === 'ZALO_OA_CHATBOT' && input.kind === 'SCENARIO_SHARE_LINK')
    return unavailable('oa_scenario_link_not_bot_api', ['wrong_provider_product']);
  if (input.product === 'ZALO_BOT_CREATOR' && input.kind === 'CREATOR_MINIAPP_QR')
    return unavailable('bot_creator_qr_not_customer_bot_chat', ['wrong_link_purpose']);
  if (input.product !== 'ZALO_BOT_API' || input.kind !== 'BOT_SPECIFIC_CUSTOMER_CHAT_LINK')
    return unavailable('provider_bot_customer_deeplink_unverified',['official_bot_chat_link_missing']);
  const issues=[];
  if (input.providerOperatorAttested !== true) issues.push('provider_operator_attestation_missing');
  if (!safeEvidenceRef(input.redactedUiReceipt)) issues.push('redacted_provider_ui_receipt_missing');
  if (!safeEvidenceRef(input.providerLinkReceipt)) issues.push('provider_link_receipt_missing');
  if (input.ownerConsentVerified !== true) issues.push('merchant_owner_consent_missing');
  if (input.botIdBoundToInstallation !== true) issues.push('bot_installation_binding_missing');
  if (input.deviceAOpenedCorrectBot !== true || input.deviceBOpenedCorrectBot !== true) issues.push('two_device_qa_missing');
  if (input.inboundVerifiedNoSend !== true) issues.push('inbound_no_send_receipt_missing');
  if (input.crossStoreDenied !== true) issues.push('cross_store_denial_missing');
  if (issues.length) return unavailable('provider_link_uat_incomplete',issues);
  return Object.freeze({state:'HUMAN_REVIEW_REQUIRED',reason:'real_provider_review_still_required',issues:[]});
}

export function reviewS3(input = {}) {
  const render=reviewRender(input.render);
  const backup=reviewBackup(input.backup);
  const zalo=reviewMerchantBotLink(input.zalo);
  return Object.freeze({
    state:[render,backup,zalo].every(x=>x.state==='HUMAN_REVIEW_REQUIRED')?'HUMAN_REVIEW_REQUIRED':'BLOCKED',
    render,backup,zalo,
    productionReady:false,allowRpcRevoke:false,allowHostedMigration:false,
    issueCustomerQr:false,allowProviderSend:false,allowOrderWrite:false,
  });
}
