'use strict';
/**
 * V15.0-10D — APPROVED FINANCIAL CEILING, NOT A MODEL EXECUTION PERMIT.
 *
 * The $1 user intent is pinned. This gate cannot verify real n8n Gateway
 * balances, shared-credit fees or in-flight overruns by itself, so MUST NEVER
 * grant a paid call from JSON, claims, or local mock receipts.
 *
 * Actual attestation requires an independent PRIVATE billing-control service
 * with per-request enforced quotas and an atomic debit/reservation facility.
 */
const CONTRACT='TIEN404_V15_0_10D';
const APPROVED_CAP_USD=1;
const MAX_CASES=132;
const MAX_CUSTOMER_TURNS=167;
const EXPECTED_DATASETS=Object.freeze({
 single:'f266447e4be2a9a22733cfa81fb80ace8862d286752b15d2d6d1ffc77c9ba257',
 multi:'8cfccde67964207e199dc20e911a9e6d4ebcbb8b1e2410526f3b40f5b8a2a1c4'
});
const REQUIRED_GATE_NAMES=Object.freeze([
  'PRIVATE_GATEWAY_BALANCE_VERIFIED',
  'GATEWAY_PRICE_PER_MODEL_VERIFIED',
  'EXCLUSIVE_ATOMIC_ONE_USD_HARD_STOP_CERTIFIED',
  'IN_FLIGHT_CREDIT_OVERDRAW_CAPPED',
  'ALL_GATEWAY_AUTO_TOPUPS_DISABLED_OR_EXPLICITLY_EXCLUDED',
  'NO_OTHER_WORKFLOWS_CAN_CONSUME_RESERVED_BENCHMARK_CREDIT',
  'PRIVATE_CREDENTIALS_AND_MODEL_ACCESS_VERIFIED',
  'ISOLATED_STATEFUL_36_CASE_QA_TOOLS_VERIFIED',
  'INDEPENDENT_REDACTED_TOOL_TRACING_VERIFIED',
  'PROVIDER_NO_SEND_AND_NO_HOSTED_WRITES_VERIFIED'
]);
function assessment(evidence){
 const meta=Object.freeze({
  contract:CONTRACT,approved_budget_usd:APPROVED_CAP_USD,
  allowed_provider_spend_usd:0,real_model_calls_performed_by_gate:0,
  target_cases:MAX_CASES,target_customer_turns:MAX_CUSTOMER_TURNS,
  no_send:true,hosted_writes_allowed:false,production_allowed:false,
  can_call_model:false,can_execute_benchmark:false,
  real_hard_limit_certified:false
 });
 if(!evidence||typeof evidence!=='object'||Array.isArray(evidence))
   return Object.freeze({...meta,status:'BLOCKED',reason:'PRIVATE_GATEWAY_CAP_PROOF_MISSING',
    missing_gates:REQUIRED_GATE_NAMES});
 if(evidence.contract!==CONTRACT||evidence.financialApprovalUsd!==APPROVED_CAP_USD||
    evidence.targetCases!==MAX_CASES||evidence.targetTurns!==MAX_CUSTOMER_TURNS||
    evidence.datasetSingleSha!==EXPECTED_DATASETS.single||
    evidence.datasetMultiSha!==EXPECTED_DATASETS.multi||
    evidence.environment!=='QA_NO_SEND'||evidence.publishedWorkflowMutation===true)
   return Object.freeze({...meta,status:'BLOCKED',reason:'FINANCIAL_OR_DATASET_SCOPE_MISMATCH',
    missing_gates:REQUIRED_GATE_NAMES});
 const receipts=evidence.gates;
 if(!receipts||typeof receipts!=='object'||Array.isArray(receipts))
   return Object.freeze({...meta,status:'BLOCKED',reason:'PRIVATE_VERIFIER_EVIDENCE_MISSING',
    missing_gates:REQUIRED_GATE_NAMES});
 const missing=REQUIRED_GATE_NAMES.filter(k=>receipts[k]!==true);
 const untrustedClaimCount=REQUIRED_GATE_NAMES.length-missing.length;
 // Critical: even ALL self-reported gates true are not independent private
 // provider API / signed verifier evidence. Fail closed and never publish.
 return Object.freeze({...meta,status:'BLOCKED',
  reason:missing.length?'GATEWAY_HARD_CAP_NOT_CERTIFIED':'SELF_REPORTED_GATEWAY_RECEIPTS_NOT_AUTHORITY',
  gates_with_untrusted_boolean_assertions:untrustedClaimCount,
  missing_gates:missing,
  external_signed_verified_operator_receipt:false,
  private_gateway_credit_source_verified:false});
}
module.exports={assessment,APPROVED_CAP_USD,EXPECTED_DATASETS,REQUIRED_GATE_NAMES};
