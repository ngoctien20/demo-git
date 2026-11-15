/**
 * TIEN404 V14.5Z-LIVE03 — READ-ONLY identity + budget certification gate.
 * No network, D1 writes, model calls, Zalo dispatch, or production activation.
 * Accepted evidence MUST be signed by pinned, independent trust roots configured
 * OUTSIDE an untrusted request. No trusted roots are configured in this repository.
 */
'use strict';
const { createPublicKey, verify } = require('node:crypto');
const ROLES = Object.freeze(['provider', 'registry', 'owner', 'gateway', 'hosted']);
const ISSUER = Object.freeze({
  provider: 'ZALO_BOT_PROVIDER_ATTESTOR',
  registry: 'TIEN404_SERVER_SHOP_RESOLVER',
  owner: 'TIEN404_OWNER_QA_CONFIRMATION',
  gateway: 'N8N_GATEWAY_BILLING_ATTESTOR',
  hosted: 'TIEN404_HOSTED_INGRESS_ATTESTOR',
});
const sha256 = x => typeof x === 'string' && /^[0-9a-f]{64}$/.test(x);
const finitePositive = x => typeof x === 'number' && Number.isFinite(x) && x > 0;
const safeStr = x => typeof x === 'string' && x.length > 0 && x.length <= 150;
const roundUpToMicroUsd = n => Math.ceil((n - 1e-12) * 1e6) / 1e6;
function verifyProof(role, input, roots, nowMs) {
  if (!input || typeof input !== 'object' || typeof input.payload !== 'string'
      || typeof input.signature !== 'string' || input.payload.length > 5000
      || !/^[A-Za-z0-9_-]{80,180}$/.test(input.signature)) return null;
  const trustedKey = roots?.[ISSUER[role]];
  if (!trustedKey) return null; // Never import a public key sent alongside the proof.
  try {
    const data = Buffer.from(input.payload, 'utf8');
    const sig = Buffer.from(input.signature, 'base64url');
    const key = createPublicKey(trustedKey);
    if (key.asymmetricKeyType !== 'ec' || key.asymmetricKeyDetails?.namedCurve !== 'prime256v1'
        || !verify('sha256', data, { key, dsaEncoding: 'ieee-p1363' }, sig)) return null;
    const p = JSON.parse(input.payload);
    if (!p || Array.isArray(p) || p.issuer !== ISSUER[role]
        || p.purpose !== 'TIEN404_V145Z_LIVE03_CERTIFICATION_ONLY'
        || !safeStr(p.evidence_id)
        || !Number.isSafeInteger(p.issued_ms) || !Number.isSafeInteger(p.expires_ms)
        || p.expires_ms - p.issued_ms > 600000 || p.expires_ms <= p.issued_ms
        || p.issued_ms > nowMs + 30000 || p.expires_ms <= nowMs
        || !p.claims || typeof p.claims !== 'object' || Array.isArray(p.claims)) return null;
    return p.claims;
  } catch { return null; }
}
function assess(input = {}, pinnedTrustedPublicKeys = {}, nowMs = Date.now()) {
  const evidence = input?.evidence && typeof input.evidence === 'object' ? input.evidence : {};
  const claims = {};
  const failures = [];
  for (const role of ROLES) {
    claims[role] = verifyProof(role, evidence[role], pinnedTrustedPublicKeys, nowMs);
    if (!claims[role]) failures.push('MISSING_TRUSTED_' + role.toUpperCase() + '_ATTESTATION');
  }
  const p = claims.provider, r = claims.registry, o = claims.owner, g = claims.gateway, h = claims.hosted;
  const common = [p?.bot_digest, r?.bot_digest, o?.bot_digest, h?.bot_digest];
  if (!common.every(sha256) || new Set(common).size !== 1 || p?.provider !== 'zalo_bot_creator'
      || p?.getme_verified !== true || p?.bot_id_observed !== true)
    failures.push('REAL_PROVIDER_BOT_ID_UNVERIFIED_OR_MISMATCH');
  if (!sha256(r?.tenant_digest) || !sha256(r?.store_digest)
      || !sha256(r?.owner_digest) || r?.registry_mode !== 'limited_qa'
      || r?.identity_status !== 'verified_provider_id' || r?.synthetic_fixture !== false)
    failures.push('TRUSTED_LIVE_SHOP_RESOLVER_NOT_CERTIFIED');
  if (!sha256(o?.owner_digest) || o?.owner_digest !== r?.owner_digest
      || h?.owner_digest !== r?.owner_digest || h?.store_digest !== r?.store_digest
      || o?.bot_digest !== r?.bot_digest || o?.qa_consent !== true)
    failures.push('ONE_VERIFIED_OWNER_QA_BINDING_MISSING');
  if (h?.provider_webhook_signature_verified !== true || h?.trusted_ingress !== true
      || h?.atomic_replay_cas_quota !== true || h?.max_replies !== 3
      || h?.window_ms !== 600000 || h?.max_tokens !== 2500
      || h?.real_orders_disabled !== true || h?.no_send_until_approval !== true)
    failures.push('REAL_HOSTED_SECURITY_GATE_NOT_CERTIFIED');
  // n8n Gateway is prepaid across the INSTANCE, not an isolated workflow wallet.
  // Only n8n's ACTUAL per-model rate and console balance can satisfy this check.
  let worstCaseUsd = null, recommendedGuardUsd = null;
  if (!finitePositive(g?.rate_input_usd_per_m) || !finitePositive(g?.rate_output_usd_per_m)
      || !finitePositive(g?.balance_usd) || !finitePositive(g?.owner_hard_cap_usd)
      || g?.rate_source !== 'N8N_CLOUD_GATEWAY_SERVICE_PRICING'
      || g?.balance_source !== 'N8N_CLOUD_CONSOLE'
      || g?.auto_topup_enabled !== false || g?.credits_shared_instance !== true
      || g?.max_model_calls !== 3 || g?.aggregate_token_cap !== 2500
      || g?.strict_pre_inference_reservation !== true || g?.shared_credit_concurrency_guard !== true
      || !safeStr(g?.model_id) || g?.model_approved_for_pilot !== true
      || !Number.isSafeInteger(g?.balance_checked_ms) || Math.abs(g.balance_checked_ms - nowMs) > 120000)
    failures.push('ACCOUNT_GATEWAY_BALANCE_RATES_AND_HARD_CAP_UNCERTIFIED');
  else {
    worstCaseUsd = roundUpToMicroUsd(2500 * Math.max(g.rate_input_usd_per_m, g.rate_output_usd_per_m) / 1000000);
    recommendedGuardUsd = roundUpToMicroUsd(worstCaseUsd * 2); // illustrative safety margin, not invoice.
    if (g.owner_hard_cap_usd < worstCaseUsd || g.balance_usd < g.owner_hard_cap_usd)
      failures.push('GATEWAY_BALANCE_OR_MONEY_CAP_TOO_LOW');
    if (h?.model_id !== g.model_id)
      failures.push('COST_MODEL_MISMATCH');
  }
  return Object.freeze({
    status: failures.length ? 'BLOCKED' : 'ELIGIBLE_FOR_FINAL_HUMAN_REVIEW_ONLY',
    version: 'V14.5Z-LIVE03',
    blocked_reasons: [...new Set(failures)],
    signed_proofs_verified: ROLES.filter(role => !!claims[role]).length,
    model_cost_reference_usd: worstCaseUsd,
    suggested_monetary_guard_usd: recommendedGuardUsd,
    provider_sends: 0,
    can_send: false,              // Hard invariant; this module NEVER grants dispatch.
    provider_request: null,
    final_owner_send_authorization: false,
  });
}
module.exports = { assess, verifyProof, ISSUER, ROLES };
