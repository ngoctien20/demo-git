'use strict';
/**
 * TIEN404 V15.0-03H.6: OFFLINE, SYNTHETIC backup coverage review only.
 * Never backs up a database, verifies a signer, uses credentials, or
 * authorizes a hosted action. Private human review is NOT implemented.
 */
const CONTRACT='TIEN404_V15_03H6_COVERAGE_REVIEW_V1';
const PROJECT='ifxlvrhyjhbzbrkdsida';
const REF=/^[A-Z][A-Z0-9_-]{11,79}$/;
const SAFE_KEYS=new Set([
 'contract','projectRef','environment','mode','operation','requestRef',
 'operatorRef','controllerRef','reviewerRef','retentionDays','maxAdditionalCostUsd',
 'usesDefaultSchemaOnlyDump','credentialsCollected','hostedExportExecuted',
 'restoreAuthorized','hostedMigrationAuthorized','providerSendAuthorized',
 'operatorPrivilegeStatus','privateVaultStatus','replayLedgerStatus','coverage'
]);
const COMPONENTS=Object.freeze({
 public_schema:'EXPLICIT_SCHEMA_EXPORT_PLAN_PENDING_REVIEW',
 business_rows:'EXPLICIT_DATA_EXPORT_PLAN_PENDING_REVIEW',
 private_schema_and_rows:'PRIVATE_SCHEMA_DATA_SCOPE_REVIEW_PENDING',
 auth_identities:'SEPARATE_AUTH_RECOVERY_METHOD_PENDING',
 roles_grants:'EXPLICIT_ROLE_GRANT_RECOVERY_PLAN_PENDING',
 rls_and_rpc:'INDEPENDENT_POLICY_RPC_RESTORE_TEST_PENDING',
 migration_history:'MIGRATION_RECONCILIATION_PENDING',
 storage_metadata:'SEPARATE_STORAGE_METADATA_REVIEW_PENDING',
 storage_object_bytes:'STORAGE_OBJECT_INVENTORY_RECHECK_PENDING',
 external_dependencies:'SEPARATE_N8N_CLOUDFLARE_PROVIDER_RECOVERY_PENDING',
 data_integrity:'INDEPENDENT_ROW_FK_CHECKSUM_DIFF_PENDING',
 restore_rehearsal:'SEPARATE_ISOLATED_RESTORE_APPROVAL_PENDING'
});
const EVIDENCE_KEYS=Object.freeze(['mechanism','receiptRef','status']);
const SENSITIVE=/(^|[_-])(token|password|secret|private.?key|credential|raw.?jwt|phone|email|recipient|psid|connection.?string|db.?url|pairing.?code|address)($|[_-])/i;
const DENY=(reason,missing=[])=>Object.freeze({
 status:'BLOCKED',reason,missing:Object.freeze([...missing]),
 sourceScope:'SYNTHETIC_OFFLINE_REVIEW_ONLY',
 verifiedOwner:false,verifiedOperator:false,verifiedVault:false,
 verifiedCoverage:false,verifiedBackup:false,verifiedRestore:false,
 allowedToExport:false,allowedToRestore:false,allowedToMigrate:false,
 allowedToSend:false,noProductionRelease:true
});
function plain(x){return x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;}
function sensitiveOrInvalid(x,seen=new WeakSet()){
 if(x===null||typeof x==='string'||typeof x==='boolean'||typeof x==='number')return false;
 if(!plain(x)&&!Array.isArray(x))return true;
 if(seen.has(x))return true;seen.add(x);
 if(Array.isArray(x))return x.some(v=>sensitiveOrInvalid(v,seen));
 return Object.entries(x).some(([k,v])=>SENSITIVE.test(k)||sensitiveOrInvalid(v,seen));
}
function assessCoveragePlan(plan){
 if(!plain(plan)||sensitiveOrInvalid(plan))return DENY('UNSAFE_OR_NON_PLAIN_REQUEST');
 if(Object.keys(plan).some(k=>!SAFE_KEYS.has(k))||Object.keys(plan).length!==SAFE_KEYS.size||
    [...SAFE_KEYS].some(k=>!Object.hasOwn(plan,k)))return DENY('REQUEST_SCHEMA_MISMATCH');
 if(plan.contract!==CONTRACT||plan.projectRef!==PROJECT||plan.environment!=='staging'||
    plan.mode!=='SYNTHETIC_OFFLINE_REVIEW_ONLY'||plan.operation!=='REVIEW_BACKUP_COVERAGE_NO_EXPORT'||
    !REF.test(plan.requestRef)||!REF.test(plan.operatorRef)||
    !REF.test(plan.controllerRef)||!REF.test(plan.reviewerRef))
   return DENY('WRONG_PROJECT_SCOPE_OR_INVALID_REFERENCES');
 if(new Set([plan.operatorRef,plan.controllerRef,plan.reviewerRef]).size!==3)
   return DENY('INDEPENDENT_OPERATOR_AND_TWO_APPROVERS_REQUIRED');
 if(!Number.isInteger(plan.retentionDays)||plan.retentionDays<1||plan.retentionDays>30||
    plan.maxAdditionalCostUsd!==0||plan.usesDefaultSchemaOnlyDump!==false||
    plan.credentialsCollected!==false||plan.hostedExportExecuted!==false||
    plan.restoreAuthorized!==false||plan.hostedMigrationAuthorized!==false||
    plan.providerSendAuthorized!==false)
   return DENY('UNSAFE_COST_CREDENTIALS_OR_HOSTED_ACTION');
 if(plan.operatorPrivilegeStatus!=='PRIVATE_AUTHORITY_VERIFICATION_PENDING'||
    plan.privateVaultStatus!=='ENCRYPTED_CUSTODY_INDEPENDENT_REVIEW_PENDING'||
    plan.replayLedgerStatus!=='TRUSTED_PERSISTENT_ONE_USE_LEDGER_NOT_PROVISIONED')
   return DENY('FORGED_AUTHORITY_VAULT_OR_REPLAY_CONTROL');
 if(!plain(plan.coverage)||sensitiveOrInvalid(plan.coverage))
   return DENY('INVALID_COVERAGE_RECORD');
 const keys=Object.keys(COMPONENTS),missing=keys.filter(k=>!Object.hasOwn(plan.coverage,k));
 if(missing.length)return DENY('MISSING_RECOVERY_COVERAGE_CLASSES',missing);
 if(Object.keys(plan.coverage).some(k=>!Object.hasOwn(COMPONENTS,k)))
   return DENY('UNRECOGNIZED_COVERAGE_CLASS');
 const usedReceipts=new Set();
 for(const k of keys){
   const e=plan.coverage[k];
   if(!plain(e)||Object.keys(e).length!==EVIDENCE_KEYS.length||
      EVIDENCE_KEYS.some(f=>!Object.hasOwn(e,f))||
      e.mechanism!==COMPONENTS[k]||!REF.test(e.receiptRef)||
      usedReceipts.has(e.receiptRef)||e.status!=='PLANNED_NOT_VERIFIED')
       return DENY('INVALID_DUPLICATED_OR_PREMATURE_RECOVERY_PROOF',[k]);
   usedReceipts.add(e.receiptRef);
 }
 return Object.freeze({
   status:'COMPLETE_SOURCE_PLAN_REQUIRES_INDEPENDENT_PRIVATE_REVIEW',
   sourceScope:'SYNTHETIC_OFFLINE_REVIEW_ONLY',classesReviewed:keys.length,
   defaultSchemaOnlyDumpRejected:true,verifiedOwner:false,verifiedOperator:false,
   verifiedVault:false,verifiedCoverage:false,verifiedBackup:false,
   verifiedRestore:false,allowedToExport:false,allowedToRestore:false,
   allowedToMigrate:false,allowedToSend:false,noProductionRelease:true,
   nextGate:'PRIVATE_CONTROLLER_SECURITY_OPERATOR_VAULT_AND_REPLAY_LEDGER_PROOFS'
 });
}
module.exports={CONTRACT,PROJECT,COMPONENTS,assessCoveragePlan};
