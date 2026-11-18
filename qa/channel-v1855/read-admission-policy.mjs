/**
 * V18.5.5 private Canary admission policy.
 * Source-only candidate; NOT connected to any deployed Worker or production webhook.
 * Fixed Sandbox installation scope; 20 approved read requests per rolling 60s.
 * Server-issued request IDs are deduplicated. No customer identifiers are stored.
 */
export const READ_WINDOW_MS = 60_000;
export const READ_MAX_PER_WINDOW = 20;
const INSTALLATIONS = new Set(['v1855-materials-sandbox','v1855-grocery-sandbox']);
const OPERATIONS = new Set(['catalog.search','cart.preview']);

function deny(code, status) {
  return { allowed: false, code, status };
}

export function evaluateReadAdmission(previous, request, nowMs = Date.now()) {
  if (!Number.isSafeInteger(nowMs) || nowMs <= 0) {
    return { ...deny('CLOCK_UNTRUSTED', 503), nextState: null };
  }
  if (!request || typeof request !== 'object' ||
      !INSTALLATIONS.has(request.installationId) ||
      !OPERATIONS.has(request.operation) ||
      typeof request.requestId !== 'string' ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(request.requestId) ||
      !Number.isSafeInteger(request.issuedAt) ||
      Math.abs(nowMs - request.issuedAt) > READ_WINDOW_MS) {
    return { ...deny('ADMISSION_INVALID_OR_EXPIRED', 403), nextState: null };
  }
  if (previous != null &&
      (typeof previous !== 'object' || Array.isArray(previous) ||
       !Array.isArray(previous.accepted))) {
    return { ...deny('ADMISSION_STATE_INVALID', 503), nextState: null };
  }

  const cutoff = nowMs - READ_WINDOW_MS;
  const accepted = (previous?.accepted || []).filter(entry =>
    entry && typeof entry === 'object' &&
    Number.isSafeInteger(entry.at) && entry.at > cutoff && entry.at <= nowMs &&
    typeof entry.id === 'string' && entry.id.length === 36
  );
  if (accepted.some(entry => entry.id === request.requestId)) {
    return { ...deny('ADMISSION_REPLAY', 409), nextState: null };
  }
  if (accepted.length >= READ_MAX_PER_WINDOW) {
    return { ...deny('ADMISSION_RATE_LIMIT', 429), nextState: null };
  }

  accepted.push({ id: request.requestId, at: nowMs });
  return {
    allowed: true,
    code: 'ADMITTED_READ_ONLY',
    status: 200,
    remaining: READ_MAX_PER_WINDOW - accepted.length,
    nextState: { accepted }
  };
}
