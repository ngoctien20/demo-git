/**
 * TIEN404 RPC16 — INACTIVE security admission Worker.
 * Strictly staged; no Merchant upload, no storage reads/writes, no network calls,
 * no request logging, no admin endpoint, no bot side effects.
 * Bound R2 bucket is intentionally NOT referenced in the handler.
 * Cloudflare account-level route controls MUST disable workers.dev + previews.
 */
const HEADERS = Object.freeze({
  'cache-control': 'no-store, private',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'content-security-policy': "default-src 'none'",
  'cross-origin-resource-policy': 'same-origin',
  'x-robots-tag': 'noindex, nofollow, nosnippet',
});
export const BUILD_MODE = 'INACTIVE_DENY_ALL_NO_SEND';
export default Object.freeze({
  async fetch(_request, _env, _ctx) {
    return new Response(null, { status: 404, headers: HEADERS });
  },
});