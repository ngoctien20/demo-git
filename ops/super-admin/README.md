# TIEN404 Super Admin V4 — secure staging core

**Status: implemented and tested LOCALLY as an isolated backend prototype. NOT integrated into the existing ChatGPT Sites Control Hub; NOT production-ready.**

This directory lives on the **stacked staging branch** and does not replace the existing TIEN404 website or Control Hub. Production databases, existing AI SALES DEMO workflows, Google Sheets, Messenger or tenant tokens are not accessed. No production credentials are stored. The test HMAC payment endpoint is **not** a real payment gateway.

## Currently executable

- Password + TOTP MFA login (Argon2id hash, encrypted MFA secret, TOTP replay prevention), server-side sessions (hashed bearer cookie, HttpOnly, Secure, SameSite=Strict), CSRF and same-origin restrictions, logout / session revocation, failed-login throttling, admin recent-MFA check.
- Role checks for SUPER_ADMIN, SUPPORT_ADMIN, TECH_ADMIN, STORE_OWNER, STORE_STAFF, tenant membership enforcement and cross-tenant tests.
- SQLite staging schema: tenants, plans, subscriptions, channel metadata (opaque `vault://` refs only), approved knowledge versions and append-only hash-chained audit records. **Not a production database migration.**
- Fail-closed tenant entitlement and service pause/enable flags. **No n8n workflow activation, deactivation or configuration changes.**
- Trial expiry, paid grace windows, lifecycle reconciliation; note that automated reminders and billing calendar-month handling need production adapters.
- Signed/idempotent **sandbox-only** payment fixture (disabled by default) that refuses unsigned, stale, wrong-amount, wrong-tenant or duplicate activation. No user-visible card or transfer UI.
- Staging-only service-to-service signed entitlement check that derives tenant ID from an already-verified channel account mapping. Never trusts a tenant ID from inbound chat text. Integration remains **disabled** absent a server-side gateway secret; real platform verification and bot enforcement are not connected.
- Draft and approved knowledge records: nothing is exposed as public product/pricing knowledge until approved. **No RAG or model connection yet.**

## Run tests (no production resources)

```bash
cd ops/super-admin
python -m pip install -r requirements-test.txt
python -m pytest -q tests
```

## Local-only manual smoke test (no deployment)

Generate a unique Fernet key **in your protected staging terminal** and inject it through your secret manager. Set `TIEN404_STAGING_ONLY=I_UNDERSTAND_NOT_PRODUCTION`, `TIEN404_DB_PATH` inside this directory, `TIEN404_ENCRYPTION_KEY` to that key and `TIEN404_ADMIN_ORIGIN=https://admin-staging.example.invalid` only when you have a staging HTTPS reverse proxy. Then run `python scripts/bootstrap_user.py` interactively. A new TOTP secret is shown once on the local console for enrollment. Do not pipe it into logs.

The module intentionally does not define a runnable `app` when the explicit staging flag is absent; it must never be reachable at a public production hostname. Even with the flag, it requires separate TLS, secure session cookies, a correctly scoped staging domain and independent security approval.

## Release gate

Do not deploy this Python/SQLite reference directly to the existing Sites deployment: first inspect its actual runtime, auth, D1 schema and source, then port isolated policy logic to its supported server-side framework with D1 transaction and credential adapters. No pricing policy, OAuth app, payment processor, or production permissions were authorized in this session. The exact remaining gates are in `docs/SECURITY_REVIEW.md` and `docs/NEXT_ACTIONS.md`.