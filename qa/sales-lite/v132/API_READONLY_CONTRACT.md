# TIEN404 SALES LITE V1.2 — Merchant Portal Read-only API Contract (PROPOSED)

**State:** PROPOSED; no implementation/deploy/authentication changes in V13.2.
**Purpose:** authenticated merchant viewing only. Core business actions remain Zalo-side and independently gated.

## Endpoint

GET /api/sales-lite/me (or versioned route agreed by Integration Team).

- Auth: secure session cookie validated by existing Auth backend (or server-validated access token, no implicit public access). Cache-Control: private, no-store. Strict CORS allowlist if cross-origin.
- Server derives user from validated session, tenant and permitted shop IDs from *current* membership/owner-binding tables, checks revoked/expired membership and subscription. Never trust tenant_id or store_id from query/URL/localStorage or unsigned role.
- No service-role or bot tokens shipped to client.
- Response 200 only for a validated user with permitted scope. No cross-shop data even under guessed identifiers.
- No fake default shop if not a member. For multi-shop accounts, server returns only an explicitly authorized list of shops and an active shop server-bound to session.
- Read-only API must not change billing, orders, bot state or tenant membership. Avoid PII beyond minimally necessary account fields.

### Suggested minimal 200 response (schema example, not real account data)

{
  "contract_version": "1.0.0",
  "source": "SERVER_VERIFIED",
  "account": { "display_name": "string", "session_expires_at": "ISO8601" },
  "shop": { "id": "server-derived-opaque-id", "name": "string", "membership_role": "OWNER" },
  "subscription": {
    "state": "ACTIVE|EXPIRING|EXPIRED|SUSPENDED|PAYMENT_PENDING|UNKNOWN",
    "plan_name": "string|null",
    "starts_at": "ISO8601|null",
    "expires_at": "ISO8601|null",
    "limits": null
  },
  "bot": {
    "connection_state": "CONNECTED|DISCONNECTED|VERIFYING|PAUSED|UNAVAILABLE|UNKNOWN",
    "verified_name": "string|null",
    "owner_pairing": "VERIFIED|PENDING|UNKNOWN",
    "verified_link": "https URL|null",
    "verified_qr_url": "https URL|null"
  },
  "generated_at": "ISO8601"
}

Only include link/QR after backend proves the bot belongs to the same resolved tenant/store and is safe for recipient; never accept arbitrary redirect schemes. Do not infer 'CONNECTED' from a locally stored token.

### Failure semantics

- 401: no valid session; account UI may offer real login only when existing auth route is reviewed.
- 403: no live membership or forbidden shop; do not reveal other shop identifiers.
- 404: requested shop context is absent; do not enumerate shops.
- 429: rate limited, with Retry-After if applicable.
- 503 or timeout: show unavailable/unknown state, no fabricated active subscription.
- 200 with source SERVER_VERIFIED is still not proof of permission unless the server has actually executed authoritative checks. Never trust a client-asserted source flag.

## Integration gates (all BLOCKED until validated)

1. Audit present Auth implementation, Supabase RLS and owner/membership model in PR #41; use current authoritative code not duplicate identity tables.
2. Verify Shop A/B leakage negative test through authenticated host for OWNER, MANAGER, revoked and unrelated user.
3. Inspect subscription status data source and billing lifecycle; only read trusted state, never auto-renew.
4. Inspect bot registry and owner pairing source; fail closed if unavailable.
5. Confirm session expires/invalidation; no service key leaks; security headers CSP/HSTS as hosting permits.
6. Run browser QA under valid and invalid sessions and record immutable evidence.
7. Only then replace UI fixtures with a read-only adapter and avoid fallback to mock when live fetch fails.

Current UI is fixture-only with no API call. No RLS, database, credential, commercial price or n8n workflow changed in this candidate.
