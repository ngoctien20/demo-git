# TIEN404 AI — V18.0-P0K Real Supabase Auth Log Lineage × Session Evidence Boundary × Store Owner Admission

**2026-11-18 JST | VERIFIED READ-ONLY | SOURCE DOCUMENTATION ONLY | REAL JWT A/B NO-GO.**
Canonical checkpoint: Issue #368. Continued existing OPEN DRAFT PR #385, child of #362. No live source deployment.

## New evidence from Supabase Logs read-only connection

All the following were returned **as grouped aggregate counts**, not raw event messages, identity strings, emails, actor IDs, user IDs, addresses or JWTs. Supabase unified log query uses default trailing 24-hour window; this is a bounded window, NOT a complete login history.

| Source/metric | Verified aggregate |
|---|---:|
| Unified log source `auth_logs` events | 37 |
| Unified log source `auth_audit_logs` events | 4 |
| Auth audit `login` events (last 24h) | 2 |
| Auth audit login events with a nonempty actor identifier | 2 |
| **Distinct nonempty audit login actor identifiers** | **1** |
| Auth audit `token_revoked` events | 1 |
| Auth audit `token_refreshed` events | 1 |
| Auth HTTP status 200 events | 11 |
| Auth HTTP status 400 events | 2 |

Events are not proof of active sessions: a repeated login can be the same identity; revoked/refreshed events cannot be attributed to either owner without private correlation. Do not infer which person caused the 400s or why. A missing audit event within the window is not proof that an account never logged in. No raw log messages (which might contain PII) were retrieved or exported.

## Independent staging Auth schema/status read-back

On project `ifxlvrhyjhbzbrkdsida`, a single tenant has **two eligible, confirmed active owner accounts** and two email identities with configured password logins. The cohort still has **only one `auth.sessions` row-owning owner** and one owner with `last_sign_in_at` recent within 48h. Another tenant has one active owner with a session record. Neither count establishes that currently logged-in browser profiles A/B resolve to the intended same tenant. This discrepancy remains unexplained, and founder-confirmed **two different accounts** must be accepted without repeated identity questioning.

Connected Render service `tien404-auth-staging` is configured as a **static site**, autoDeploy OFF, served from `work/supabase-auth-staging-v1` commit `b14501a0ebf04d991302cb32b5d548a68d6b39bd`. Source `/assets/auth-client.js` initializes Supabase browser client from public publishable config; `account.html` calls `auth.getUser()` and RLS `tenant_memberships` but does not implement P0J local `getClaims()` probe. Direct HTTP browser page test was unavailable through the current ChatGPT browser connector because the originating browser extension context was absent. No Render deploy or browser login has been performed by assistant.

## Security conclusion: what the facts do and do NOT prove

**USER_CONFIRMED:** Two different accounts seen by founder, previously reported pass.
**VERIFIED:** Staging tenant owner account metadata, one matching Auth session-record owner, two login events by one distinct nonempty actor in the 24h audit window.
**NOT VERIFIED:** That two separately authenticated browser profiles have two valid, distinct currently active JWT sessions bound to the two owner accounts of that same tenant.
**NOT VERIFIED:** Independent consent from both owners in protected registry, canonical Store A/B UUID registry and membership, native Meta/Zalo signed binding, cross-Store Order ownership.
**HOSTED GATE:** No `public.stores` or `public.store_memberships`; none of the seven core Commerce tables currently has `store_id`, so no live Store A/B authorization can be accepted.

## No-send next action — do not bypass the evidence gap

1. Use *existing* two separately authorized browser profiles only. No new accounts, reset, refresh-token disclosure or session impersonation.
2. Existing P0J source-only browser probe `qa/v180-p0j/private-browser-auth-owner-probe.js` can do a **local** `auth.getUser()` / `auth.getClaims()` / owner membership RLS check with a one-time nonce, without posting identifiers. However, copying console scripts into browsers should be done only by an operator who reviewed the script and understands the risk; never use an unreviewed third-party snippet or bypass a browser self-XSS protection warning.
3. If browser extension context for connected ChatGPT is unavailable, **do not claim that the assistant executed the private session check**. The operator can report only four Boolean flags (A checked, B checked, different actors, common owner tenant); no nonce, fingerprint, screenshot with PII, user/session ID, JWT or Auth token is required.
4. A locally computed HMAC is not an authenticated server receipt. A separate protected server-side verifier, approved after scope review, must validate the real Auth session/revocation, distinct owner IDs and exact `(tenant UUID, Store A UUID, Store B UUID)` relationships before any hosted AB UAT.
5. Before any hosted schema/RLS/grant/Store membership change, obtain founder's explicit scoped change approval and independently tested M0 backup/restore. Waiver applies only to read-only/source/disposable QA.

## Completed / unchanged

- **Completed in P0K:** Actual Supabase unified Auth log **read-only aggregates**, independent comparison to `auth.users`/`auth.sessions` grouped counts, source-lineage review, and checkpoint document.
- **No new simulated tests added:** P0J already has 15/15 offline source tests; repeatedly running them is not a substitute for actual Auth session verification.
- **Not changed:** Supabase Auth sessions/users/policies/schema, Render, n8n, provider webhooks, customer data, credentials, production or GitHub PR merge.
- **Rollback:** None for runtime. Documentation lives in existing Draft PR #385 and can be revised/reverted without affecting hosted systems.

**Decision:** `P0K_AUTH_LOG_EVIDENCE_VERIFIED / USER_CONFIRMED_TWO_ACCOUNTS / INDEPENDENT_JWT_PAIR_NOT_VERIFIED / CANONICAL_STORE_OWNER_AUTH_BLOCKED / M0_DEFERRED_SOURCE_ONLY / PRODUCTION_NO_GO`.