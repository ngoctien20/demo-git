# TIEN404 AI — V18.6.11B Hosted Render HTTP Read-Only Acceptance

**Date:** 2026-11-19 JST. **Parent:** V18.6.11A / GitHub Issue #450; Draft PR #447. **Environment:** two current Render staging services; no login, no secrets, no customer data.

## Deployment evidence already verified, independently of HTTP

- Render data web service `tien404-data-staging`, deployment `dep-dbqj9plg1s2s73egr30g` LIVE, commit `ab940a95dae8afdff426bc6ac71693833d5348ce`. Start: `cd ops/data-platform && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-10000}`. Exact source's default exported `app = create_app()` does not provide a `commerce_connect` and therefore does not register the four Commerce merchant write routes. OpenAPI and docs disabled in the exact deployed source (`openapi_url=None`, `docs_url=None`).
- Render Auth static site `tien404-auth-staging`, deployment `dep-dbubajafngtc73c8thdg` LIVE, commit `e993a23e3cb6b3abbea89ee13878162cfaf4e716`. Build: `node scripts/build-auth-preview.mjs` and output `auth-preview-dist`; the allowlist contains `login.html`, `account.html`, `merchant-portal.html` and the two direct RPC caller source modules for product and QA owner pairing.
- Both have `autoDeploy=no`, neither suspended. None of these metadata observations guarantees HTTP availability or real Owner authentication.

## Exact anonymous HTTP GET test plan

The scripts `qa/store-authority-v18611/hosted-http-gate.cjs` and `.test.cjs` restrict destinations to **exactly**:

1. `GET https://tien404-data-staging.onrender.com/health` ⇒ 200; JSON says `database_connected=false` and status `UNKNOWN` or `CONFIGURED_NOT_VERIFIED` (health **not** DB connection proof).
2. `GET /api/v1/tenants` ⇒ 401 (anonymous rejected).
3. `GET /api/v1/tenants/<inert-fixture-uuid>/products` ⇒ 401.
4. `GET /api/v1/tenants/<inert-fixture-uuid>/orders` ⇒ 401.
5. `GET /api/v1/tenants/<inert-fixture-uuid>/orders/<inert-fixture-uuid>/confirm` ⇒ **404**; a registered POST-only endpoint would normally yield 405, so this is a *safe route-existence check*, **not** a write endpoint invocation.
6. `GET /api/v1/tenants/<inert-fixture-uuid>/orders/<inert-fixture-uuid>/cancel` ⇒ 404.
7. `GET /api/v1/tenants/<inert-fixture-uuid>/orders/<inert-fixture-uuid>/quantity` ⇒ 404.
8. `GET /openapi.json` ⇒ 404, matching the exact FastAPI startup configuration (disables OpenAPI exposure).
9. `GET https://tien404-auth-staging.onrender.com/login.html` ⇒ 200.
10. `GET https://tien404-auth-staging.onrender.com/account.html` ⇒ 200 (public static HTML shell **only**, no private account information).
11. `GET https://tien404-auth-staging.onrender.com/merchant-portal.html` ⇒ 200 (public static HTML shell **only**, no protected data).

The test prints only check IDs and expected/observed HTTP statuses. **No POST/PUT/PATCH/DELETE/OPTIONS requests**, no Authorization/Cookie headers, no redirects, no Supabase Auth sessions, no n8n webhook, no RPC, no customer data, no secret responses. A single bounded retry for temporary 502/503/504 is allowed after the first GET (Render free-tier cold start). Failures remain failures, never silently marked PASS.

## Evidence interpretation and blockers

- Source-only unit tests validate GET-only allowlist, response validation, fail-closed status behavior. **These synthetic tests do not prove hosted HTTP.**
- GitHub Actions runs the actual requests in an independent job, after local/synthetic tests. One first successful complete run is the minimum evidence for anonymous HTTP status behavior at that moment, but is **not proof** of persistent availability, actual provider access or Store RLS.
- The distinction between **404** and **405** is useful for the known exact FastAPI route topology, but may be affected by reverse proxies, framework changes or a future deployment; this is why test results must be tied to the exact Render deployment SHA before interpreting.
- `/health` intentionally returns `database_connected=false` in the verified code, and must **not** be reported as evidence that Supabase is connected.
- Staging still lacks canonical public `stores`/`store_memberships`, `store_id` in six Commerce tables, and Store restrictive RLS; real same-Tenant Store A/B UAT remains blocked.
- Supabase backup entitlement, backup artifact existence and isolated restore are **NOT VERIFIED**. Owner decisions on SKU D-02 and separate `store_owner` remain pending. There is no approval for a real migration, RPC grant change or production deployment.

## Rollback / no change guarantee

All changes are scripts/docs under Draft PR #447 and a GitHub Actions workflow. Stop the HTTP probe by reverting the commit or disabling the QA job **in source only**. No runtime changes need to be rolled back. Keep the existing n8n DEMO messenger writers and Zalo claim RPC untouched. Any new proposed production write route demands a separate human-reviewed approval process, real backups, and Store authority admission.

**Checkpoint:** `V18.6.11B | HTTP_READONLY_GATE_CREATED | REAL_HTTP_RESULT_PENDING | STORE_RLS_ABSENT | BACKUP_UNVERIFIED | NO_SEND | NO_WRITE | PRODUCTION_NO_GO`.
