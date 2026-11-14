'use strict';
// This controller has no network transport or credential. Only verified provider-side reservations
// plus reconciliation could safely enable paid inference in a future release.
const tokenPolicy = Object.freeze({model:'gpt-5.4-nano', maxCalls:10, capMicroUsd:100000,
  maxInputTokens:512, maxOutputTokens:96, retries:0, providerCapVerified:false});

function createModelCallController() {
  let blocked = 0;
  return Object.freeze({
    policy:tokenPolicy,
    ledger:() => Object.freeze({mode:'PROCESS_QA_ONLY',blocked, attemptedPaidCalls:0,
      reservedMicroUsd:0, incurredMicroUsd:0, gatewayBalanceMicroUsd:null}),
    async classify() {
      blocked++;
      throw Object.assign(Error('MODEL_COST_GATE_UNVERIFIED'), {code:'MODEL_COST_GATE_UNVERIFIED'});
    }
  });
}
module.exports = {createModelCallController, tokenPolicy};
