'use strict';
/**
 * TIEN404 V14.5Z LIVE03B — pricing reconciliation for an OFFLINE, NO-SEND QA pilot.
 * Input rates were visually verified against n8n Service pricing (owner screenshot 2026-11-16).
 * The screenshot and the 0.59 USD balance are not signed, live attestations.
 * This module is for quoting/auditing only: NEVER authorizes spending or sending.
 */
const RATE = Object.freeze({
  model_id: 'gpt-5.4-nano',
  currency: 'USD',
  input_usd_per_million: 0.20,
  output_usd_per_million: 1.25,
  source: 'N8N_SERVICE_PRICING_OWNER_SCREENSHOT_2026_11_16',
  status: 'PRICE_ROW_VERIFIED_BY_VISUAL_REVIEW',
});
const ENVELOPE = Object.freeze({
  max_calls: 3, max_replies: 3, max_tokens: 2500, window_ms: 600000,
});
const OBSERVED_BALANCE = Object.freeze({
  amount_usd: 0.59, origin: 'N8N_GATEWAY_CONSOLE_SCREENSHOT',
  updated_at_local: '2026-11-16 02:07 JST',
  is_live_api_verified: false,
  shared_across_instance: true,
});
const USD_SCALE = 1_000_000_000;
function asNanoUsd(inputTokens, outputTokens, rate = RATE) {
  if (![inputTokens, outputTokens].every(Number.isSafeInteger) ||
      inputTokens < 0 || outputTokens < 0 ||
      !Number.isFinite(rate.input_usd_per_million) ||
      !Number.isFinite(rate.output_usd_per_million) ||
      rate.input_usd_per_million <= 0 || rate.output_usd_per_million <= 0)
    throw new TypeError('TOKEN_OR_RATE_INVALID');
  // Integer nanodollars avoid silently rounding a micro-dollar invoice to zero.
  return Math.ceil(inputTokens * rate.input_usd_per_million * 1000
    + outputTokens * rate.output_usd_per_million * 1000);
}
function quote(tokens, model = RATE.model_id) {
  if (model !== RATE.model_id) return {status: 'BLOCKED', reason: 'PRICING_MODEL_ID_MISMATCH', can_send: false};
  if (!tokens || !Number.isSafeInteger(tokens.input_tokens) ||
      !Number.isSafeInteger(tokens.output_tokens) ||
      tokens.input_tokens < 0 || tokens.output_tokens < 0 ||
      tokens.input_tokens + tokens.output_tokens > ENVELOPE.max_tokens)
    return {status: 'BLOCKED', reason: 'INVALID_OR_EXCESS_TOTAL_TOKENS', can_send: false};
  const nanodollars = asNanoUsd(tokens.input_tokens, tokens.output_tokens);
  return {
    status: 'PRICE_ESTIMATE_ONLY',
    model_id: model,
    total_tokens: tokens.input_tokens + tokens.output_tokens,
    model_cost_usd: nanodollars / USD_SCALE,
    price_source: RATE.source,
    real_n8n_invoice_verified: false,
    can_send: false,
  };
}
function assessPilot(inspection = {}) {
  const reasons = [];
  if (inspection.model_id !== RATE.model_id) reasons.push('ACTUAL_MODEL_MISMATCH');
  if (inspection.price_source !== RATE.source) reasons.push('N8N_PRICE_SOURCE_UNMATCHED');
  if (inspection.max_calls !== ENVELOPE.max_calls ||
    inspection.max_replies !== ENVELOPE.max_replies ||
    inspection.max_tokens !== ENVELOPE.max_tokens ||
    inspection.window_ms !== ENVELOPE.window_ms)
    reasons.push('ENVELOPE_NOT_ENFORCED');
  if (inspection.balance_usd !== OBSERVED_BALANCE.amount_usd || inspection.balance_current_attested !== true)
    reasons.push('LIVE_SHARED_BALANCE_NOT_ATTESTED');
  if (inspection.auto_topup_enabled !== false) reasons.push('AUTO_TOPUP_NOT_VERIFIED_DISABLED');
  if (!Number.isFinite(inspection.owner_cap_usd) || inspection.owner_cap_usd <= 0 ||
      inspection.owner_cap_approved !== true)
    reasons.push('OWNER_MONEY_CAP_UNAPPROVED');
  if (inspection.shared_instance_cost_lock !== true ||
      inspection.authoritative_llm_usage_reconciliation !== true ||
      inspection.token_reservation_before_inference !== true)
    reasons.push('HOSTED_MONEY_TOKEN_GUARD_UNVERIFIED');
  if (inspection.real_bot_shop_owner_verified !== true)
    reasons.push('LIVE_IDENTITY_NOT_VERIFIED');
  // Even if all caller-asserted booleans are true, no send capability is exposed.
  return {
    version: 'V14.5Z-LIVE03B',
    status: reasons.length ? 'BLOCKED' : 'SOURCE_CLAIMS_REQUIRE_SIGNED_ATTESTATION',
    reasons,
    configured_model: RATE.model_id,
    maximum_model_only_usd: quote({input_tokens:0,output_tokens:ENVELOPE.max_tokens}).model_cost_usd,
    suggested_two_x_buffer_usd: quote({input_tokens:0,output_tokens:ENVELOPE.max_tokens}).model_cost_usd * 2,
    observed_balance_usd: OBSERVED_BALANCE.amount_usd,
    observed_balance_is_current_guaranteed: false,
    credential_writes: 0, external_calls: 0, can_send: false,
  };
}
module.exports = { RATE, ENVELOPE, OBSERVED_BALANCE, asNanoUsd, quote, assessPilot };
