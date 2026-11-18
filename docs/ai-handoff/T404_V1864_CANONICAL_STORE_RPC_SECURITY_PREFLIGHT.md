# TIEN404 AI — V18.6.4 Canonical Store Authority × RPC Security Review × Protected Owner A/B Admission

Date: 2026-11-18 JST. Status: CANDIDATE — STAGING ONLY / NO PRODUCTION. Authoring source for PR review; this document is **not a production release approval**.

## Verified starting checkpoint (read only)

- GitHub PR #420 OPEN DRAFT. V18.6.3 HEAD `092b34437266a1166e290b02372e574eee214600`, isolated PostgreSQL 17 CI run `44279871330` SUCCESS, 28/28; actual Supabase multi-store RLS **not verified**.
- Supabase `ifxlvrhyjhbzbrkdsida`: `public.orders`, `public.products`, `public.conversations` are tenant-scoped, have no `store_id`; tenant RLS enabled + forced, but does **not** establish same-tenant Store A/B access isolation. No verified canonical production `public.stores` or equivalent store membership API. QA schemas `tien404_r1_qa` / `tien404_v175_qa` have separate `store_key` experiments; do not silently replace them or create duplicate Store Authority.
- Aggregated public tenant memberships: `qa-staging-shop-a-20261110` has one active owner; `qa-staging-shop-b-20261110` has two active owners. This verifies only member counts, not unique stores, rights or independent browser sessions.
- Supabase Security Advisor reports three `SECURITY DEFINER` functions with `anon` or `authenticated` EXECUTE. Source/ACLs were inspected using read-only SQL; no secret *values* were read or logged.

## RPC review and proposed dispositions

| RPC | Observed authority guard | Actual grant | Decision | Security note |
| --- | --- | --- | --- | --- |
| `public.qa_shop_b_zalo_claim` | `request.headers` header compared against Vault secret, validates challenge/code/sender/event and calls private QA pairing routine | `anon` only | P1 REVIEW / do not revoke until dependency traced | Caller-supplied header protects access if secret remains private. The header is not itself proof of Meta/Zalo event provenance. Confirm source gateway, quotas, expiration, and purpose; test negative paths in isolated harness |
| `public.qa_owner_pairing` | Requires `auth.uid()`, matching active owner `tenant_memberships`, fixed synthetic QA bot mapping and challenge flow | `authenticated` only | KEEP RESTRICTED / P1 dependency review | Currently tenant-owner gated and fixed QA allowlist; not general store authorization |
| `public.save_merchant_product` | Requires `auth.uid()`, active owner/manager of one of two allowlisted QA tenants; validates product and optimistic timestamp | `authenticated` only | KEEP / REFACTOR with store-level migration | This is a real staging product writer. Do not call it or change grants in this candidate; does not enforce multi-store authority |

`SECURITY DEFINER` functions execute with definer privileges and require a narrow, reviewed authorization predicate. A permissive EXECUTE grant alone does not prove exploitability. The reported `rls_enabled_no_policy` INFO findings for private schemas may be intentional deny-by-default; review intent before changing policies.

Security Advisor references:
- https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable
- https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
- https://supabase.com/docs/guides/database/postgres/row-level-security

## V18.6.4 implementation — SYNTHETIC_QA ONLY

File `qa/store-authority-v1864/readonly-admission.cjs` is a **pure Node.js isolated contract**; no network, database, secret manager, Meta, n8n, Cloudflare or production account access. It receives trusted dependencies (`resolveVerifiedSession`, `readStoreMembership`, `readPageConnection`) injected by the test harness. The harness uses static, synthetic fixture owners and page connections. It does not parse/verify a real Supabase JWT, perform OAuth or prove deployed BFF behavior.

Decision rules:
1. A session must be resolved by an **authoritative backend callback**, not a JSON flag set by the browser; must match configured issuer/audience and be active/unexpired.
2. The user's selected store is **only a selector**. Store authority comes from backend membership for the verified principal, active role owner/manager and active store.
3. Page metadata must be bound to the **same tenant and store** and be connected in SYNTHETIC_QA, otherwise reject. Cross-store Page A/B must fail even inside the same tenant.
4. Only `authority.readonly.check` and `channel.connection.preview` are permitted. No catalog, order read, order writes, provider send, Meta requests or customer data query.
5. Inputs with attempted authority override or extra body data fail closed; responses omit principal, session, tenant and secrets.

Existing PostgreSQL 17 isolated suite remains separate and unchanged (28 tests). The CI workflow is extended, not duplicated, to run the additional Node.js admission tests.

## Protected Real Owner A/B UAT admission (DESIGN ONLY)

**BLOCKED until Canonical Store Authority exists and an authenticated, privately operated owner UAT path is approved.** The authenticated owner should visit TIEN404 staging in two independent browsers and authenticate to Supabase in the browser. The BFF should validate the existing browser session against the official Supabase Auth server (signed claims/issuer/audience/session freshness as appropriate), resolve authoritative membership on the server, and return **only PASS/DENY and non-sensitive diagnostic codes** to the private QA dashboard.

No JWT, refresh token, header secret, Page token, owner email, real IDs, order row, or session value should ever be pasted into chat or GitHub. A/B negative test: A tries store B selector, B tries A, a revoked user retries, a forged tenant/store field is rejected; no data reads from private Orders and no writes/sends.

When this UAT is feasible, exact approved session/admission flow, CI evidence, and rollout/rollback must be separately documented and accepted. Current synthetic tests and membership counts **cannot** satisfy this gate.

## API contract (not deployed)

`POST /internal/qa/v1864/store-admission/read-only` — private authenticated staging operator. BFF accepts only store selection and `authority.readonly.check` / `channel.connection.preview`; must derive session from its existing protected server context, never from request body. Send minimal safe result, not a signed identity or store authority to a public client. Apply Access and per-session throttling, audit coarse deny reason only. Contract is intentionally not wired to Cloudflare Workers or n8n.

## Gate, change scope, rollback

- **VERIFIED**: GitHub PR #420, previous 28/28 PostgreSQL 17 tests; public schema and RPC grant/source metadata; separate QA store_key assets.
- **IMPLEMENTED**: standalone source, 51-case synthetic admission QA, one existing CI workflow extension, this security review.
- **TESTED**: local Node 22 (51/51); CI status will be reported only from the actual workflow run.
- **BLOCKED**: real Supabase session A/B, store-level canonical RLS, privileged RPC remediation, Meta OAuth, production cutover.
- **NO CHANGE**: Supabase DDL/RLS/credentials, n8n, Cloudflare, Meta, customer data, orders, billing, public website.
- **ROLLBACK**: close the new Draft PR and discard only its feature branch. Previous PR #420 and all staging/production infrastructure remain unchanged.

Proposed next gate: V18.6.5 — privileged RPC dependency inventory, server-side owner-store binding design with verified canonical ownership, and private no-PII browser UAT admission. No real Meta/Page provisioning without explicit approval.
