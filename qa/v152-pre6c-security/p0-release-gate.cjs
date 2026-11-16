'use strict';
/*
 * TIEN404 PRE-ADV.6C — P0 release decision REPORT, source only.
 * It can BLOCK or request independent evidence review; it can NEVER approve,
 * publish, merge, issue credentials, execute SQL, run n8n, or send messages.
 *
 * Metadata and references are untrusted until verified by an independent
 * controller/security reviewer. A forged all-green JSON must not grant rights.
 * This is NOT yet wired to production deployment/branch protection.
 */
const CONTRACT='T404_PRE_ADV6C_P0_RELEASE_GATE_V1';
const PROJECT='ifxlvrhyjhbzbrkdsida';
const GATES=Object.freeze([
  'P0_RPC_DEFINER_EXPOSURE',
  'P0_HOSTED_JWT_RLS_STORE_ISOLATION',
  'P0_COMMERCE_WRITER_AUTH_CONFIRM_IDEMPOTENCY',
  'P0_AI_SQL_AND_SERVICE_ROLE_EXCLUSION',
  'P0_BACKUP_RECOVERY_AND_INDEPENDENT_APPROVAL',
  'P0_RELEASE_PIPELINE_ENFORCEMENT'
]);
const isObject=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
const good=x=>x===true;
const bad=x=>x===false;
const isSafeStatus=x=>x==='NOT_VERIFIED'||x==='VERIFIED';
const cleanRef=x=>typeof x==='string'&&x.length>0&&x.length<=180&&/^[a-zA-Z0-9:_./-]+$/.test(x);
function evaluateRelease(snapshot={}, {referenceDateJst='2026-11-16'}={}){
  const s=isObject(snapshot)?snapshot:{};
  const checks=[];
  function gate(code,conditions){
    const blocked=conditions.filter(([_,valid])=>valid!==true).map(([reason])=>reason);
    checks.push(Object.freeze({
      code,status:blocked.length===0?'CLAIMED_READY_NOT_CERTIFIED':'BLOCKED',
      blockers:Object.freeze(blocked)
    }));
  }
  gate('P0_RPC_DEFINER_EXPOSURE',[
    ['RPC_GRANT_BASELINE_OR_SOURCE_MISSING',s.project_ref===PROJECT&&
      isObject(s.rpc)&&Array.isArray(s.rpc.anon_security_definer_execute)],
    ['ANON_SECURITY_DEFINER_STILL_EXPOSED',isObject(s.rpc)&&
      Array.isArray(s.rpc.anon_security_definer_execute)&&s.rpc.anon_security_definer_execute.length===0],
    ['PROVIDER_RELAY_REPLACEMENT_NOT_VERIFIED',good(s.rpc?.verified_webhook_relay_replacement)],
    ['CALLER_DEPENDENCY_AND_ROLLBACK_NOT_VERIFIED',good(s.rpc?.caller_dependency_test)],
    ['RPC_PRIVILEGE_NEGATIVE_TEST_MISSING',good(s.rpc?.independent_rpc_role_test)]
  ]);
  gate('P0_HOSTED_JWT_RLS_STORE_ISOLATION',[
    ['CANONICAL_STORES_AND_MEMBERSHIPS_MISSING',good(s.schema?.stores_table)&&good(s.schema?.store_memberships_table)],
    ['STORE_KEY_MISSING_IN_COMMERCE_TABLES',good(s.schema?.products_store_id)&&
      good(s.schema?.orders_store_id)&&good(s.schema?.customers_store_id)],
    ['PRODUCTS_ORDERS_CUSTOMERS_RLS_UNVERIFIED',good(s.schema?.products_rls_enabled)&&
      good(s.schema?.orders_rls_enabled)&&good(s.schema?.customers_rls_enabled)],
    ['INDEPENDENT_OWNER_A_B_JWT_POSITIVE_MISSING',good(s.schema?.owner_A_B_independent_hosted_jwt_proof)],
    ['SAME_TENANT_CROSS_STORE_NEGATIVE_MISSING',good(s.schema?.cross_store_negative_hosted_proof)]
  ]);
  gate('P0_COMMERCE_WRITER_AUTH_CONFIRM_IDEMPOTENCY',[
    ['LEGACY_PUBLISHED_TOOL_WRITER_NOT_ISOLATED',bad(s.order_writer?.legacy_tools_still_connected)],
    ['CUSTOMER_ORDER_OWNERSHIP_NOT_VERIFIED',good(s.order_writer?.server_verified_customer_order_identity)],
    ['TRUSTED_STORE_SCOPE_NOT_VERIFIED',good(s.order_writer?.server_verified_store_scope)],
    ['SERVER_CONFIRMATION_GATE_NOT_VERIFIED',good(s.order_writer?.server_confirmation_gate)],
    ['ATOMIC_ORDER_AND_NONCE_TRANSACTION_UNVERIFIED',good(s.order_writer?.commerce_atomic_order_idempotency)],
    ['PUBLISHED_PATH_NO_SEND_REGRESSION_MISSING',good(s.order_writer?.independent_no_send_regression_on_real_published)]
  ]);
  gate('P0_AI_SQL_AND_SERVICE_ROLE_EXCLUSION',[
    ['NO_LIVE_SQL_EXECUTOR_AUDIT_PROOF',good(s.privileged_tools?.no_arbitrary_sql_live_proof)],
    ['NO_COMMON_SERVICE_ROLE_PROOF',good(s.privileged_tools?.no_common_service_role_live_proof)],
    ['LEAST_PRIVILEGE_BACKEND_ROLE_UNVERIFIED',good(s.privileged_tools?.least_privilege_database_role_proof)],
    ['AGENT_TO_WRITER_SCOPE_NOT_VERIFIED',good(s.privileged_tools?.agent_to_writer_scope_proof)]
  ]);
  gate('P0_BACKUP_RECOVERY_AND_INDEPENDENT_APPROVAL',[
    ['OWNER_ATTESTATION_MISSING',good(s.recovery?.independent_owner_attestation)],
    ['AUTHORIZED_REAL_EXPORT_MISSING',good(s.recovery?.approved_export_receipt)],
    ['INDEPENDENT_RESTORE_TEST_MISSING',good(s.recovery?.independent_restore_evidence)],
    ['ROLLBACK_DRILL_NOT_VERIFIED',good(s.recovery?.rollback_tested)]
  ]);
  gate('P0_RELEASE_PIPELINE_ENFORCEMENT',[
    ['INDEPENDENT_RELEASE_APPROVAL_MISSING',good(s.delivery?.independent_release_approval)],
    ['BRANCH_PROTECTION_UNVERIFIED',good(s.delivery?.branch_protection_verified)],
    ['PIPELINE_NOT_ENFORCING_P0_GATE',good(s.delivery?.deployment_pipeline_enforces_gate)],
    ['PRODUCTION_RELEASE_APPROVAL_NOT_GRANTED',good(s.delivery?.live_release_approved)]
  ]);
  const sourceValid=s.contract==='T404_PRE_ADV6C_P0_RELEASE_BASELINE_V1'&&
    s.environment==='SUPABASE_STAGING_AND_N8N_PUBLISHED'&&
    s.evidence_scope==='READ_ONLY_METADATA_AND_WORKFLOW_STRUCTURE'&&
    s.observed_date_jst===referenceDateJst&&s.project_ref===PROJECT;
  const issues=checks.filter(x=>x.status==='BLOCKED');
  const p1=isObject(s.p1)?s.p1:{};
  const p1Open=['durable_per_store_ai_budget_hosted','cloudflare_rate_limit_on_exact_entry_route',
    'provider_replay_hosted','secret_rotation_plan_approved']
    .filter(k=>!isSafeStatus(p1[k])||p1[k]!=='VERIFIED');
  // A complete metadata packet is never a cryptographic attestation or
  // release decision; it can at most be handed to independent reviewers.
  const status=!sourceValid||issues.length?'NO_GO':'PENDING_INDEPENDENT_ATTESTATION';
  const blockers=[
    ...(!sourceValid?['SOURCE_OR_DATE_NOT_AUTHORIZED_FOR_LIVE_PROOF']:[]),
    ...checks.flatMap(x=>x.blockers)
  ];
  return Object.freeze({
    contract:CONTRACT,
    status,
    scope:'P0_STAGING_NO_SEND_REPORT_ONLY',
    sourceValid,
    gates:Object.freeze(checks),
    blockers:Object.freeze(blockers),
    p1Open:Object.freeze(p1Open),
    evidenceReferencesAcceptedAsAuthorization:false,
    signedControllerApprovalVerified:false,
    schemaChangeAuthorized:false,
    credentialChangeAuthorized:false,
    publishAuthorized:false,
    mergeAuthorized:false,
    customerDataWriteAuthorized:false,
    providerSendAuthorized:false,
    releaseAuthorized:false,
    reason:'NOT_A_PRODUCTION_DEPLOYMENT_ENFORCEMENT_MECHANISM'
  });
}
function assertReleaseAllowed(){
  // Always fail until a SEPARATE independently signed, verified operational
  // approval/deployment gate is implemented and explicitly authorized.
  const e=new Error('P0_RELEASE_GATED_NO_GO_EXTERNAL_SIGNED_AUTHORITY_REQUIRED');
  e.code='P0_RELEASE_GATED_NO_GO_EXTERNAL_SIGNED_AUTHORITY_REQUIRED';
  throw e;
}
module.exports=Object.freeze({CONTRACT,GATES,evaluateRelease,assertReleaseAllowed});