# TIEN404 AI — V8 continuation checkpoint (2026-11-11)

## Scope and provenance
Continued prior Work V7.1/V8 on existing Supabase Auth staging branch; did not restart project or touch production. This checkpoint records only verified GitHub changes, not a claim of completed hosted E2E.

## Auth recovery hardening
- Commit `5ce55c5a7cc4a1d264ad34041a5b9d307cce07e0`: Require both a recovery callback indicator and a Supabase `PASSWORD_RECOVERY` event before enabling the password-update action; clear verification state after successful recovery.
- Commit `0f3be952e8cfdbb2855e6ab02dff24d74baf6290`: Add `tests/auth-recovery-guard.test.mjs` with three source regression assertions.
- Commit `6ee761c3fca6041b0ea18a72220b92d6f99e0328`: Wire this test into Auth staging CI push path filter and Node test runner.
- Read-back verification confirmed source contains event guard, verified state requirement, state reset, and regression test file.
- **No current successful CI result for this commit has been observed at checkpoint creation**; do not mark QA PASS until an actual run completes. The guard is not a substitute for browser E2E with a real recovery email.

## Remaining P0
1. Wait for GitHub Actions CI on `6ee761c`; investigate if no run appears.
2. Validate PKCE recovery event behavior with a disposable authorized staging account, approved callback URLs, and no password disclosure.
3. Test actual Supabase login/refresh/logout on Render Auth staging; last known deployed build predates recovery guard.
4. Test two separate authorized staging identities for Shop A and Shop B, RLS deny checks for SELECT and write paths.
5. Review session timeout and SDK import fallback behavior on Android dark mode.
6. Do not deploy Auth staging until CI and preview artifact QA pass.

## Related previously verified snapshot (must recheck before reuse)
- PR #7 Auth staging; `gh-pages` production separate.
- Render Auth Static Site `srv-dbpj4irm8hqs73e2h2rg`, last previously confirmed LIVE deploy `dep-dbpo69u1egvs7390iv80` at `404b63b`.
- Four Control Hub tasks: only Published inventory of seven n8n workflows was verified; tenant isolation, inventory transaction/idempotency and website/backend E2E remain open.
- Work V8's Dashboard, Bot Registry and Commerce objectives remain unverified until implemented and tested.

## Change safety
- GitHub feature branch changed: YES.
- Render deployment triggered this continuation: NO.
- Supabase database/Auth mutations: NO.
- n8n published workflow changes: NO.
- Production `gh-pages` changed: NO.
- Pilot readiness: NOT READY.

## 2026-11-11 follow-up verification
- GitHub Actions run [42913004312](https://github.com/ngoctien20/demo-git/actions/runs/42913004312): **PASS**, including Node regression tests and isolated Chromium smoke. This is not real hosted sign-in.
- Navigation CI run 42913004094: PASS.
- Render Auth service verified static site, branch `work/supabase-auth-staging-v1`, autoDeploy OFF. At inspection, latest LIVE deploy was `dep-dbppc3ek1f9s73ci4al0` on commit `4c13ea5877682d1c1cc5715f95ab8effa6ff0440` (merchant read-only filters); this does **not** prove latest Auth recovery guard is deployed. Other work has updated this branch concurrently; avoid blind redeploy until HEAD/QA reconciliation.
- Supabase read-only schema inventory: every listed `public` table (conversations, customers, messages, order_items, orders, products, tenant_memberships, tenants) has RLS enabled and one policy; this alone does not prove correct tenant isolation. Private tables audit_events, channel_secrets, order_idempotency have RLS enabled and no policies, which may be intentional deny-by-default.
- Supabase security advisor: leaked-password protection disabled (WARN); review Auth security configuration before pilot. Reference: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- No Supabase mutations, n8n changes, or production deployment were made in this verification. E2E with two independent users remains BLOCKED/NOT VERIFIED.

## V8.1 intake audit — 2026-11-11
- Live connector inventory found 31 n8n workflows. DEMO workflows and TIEN404 Commerce are distinct; user preference mandates keeping DEMO Orders/Products/credentials isolated from product Commerce. No workflow was modified or published.
- n8n prior manual QA execution metadata reverified: Catalog/Cart 1473 SUCCESS; Business Core 1474 SUCCESS; Extension 1479 SUCCESS. These are historical sandbox runs, **not** fresh E2E production tests.
- Supabase read-only policy audit: all eight public tables have RLS enabled with SELECT-only authenticated policies. Products and tenants are visible only to active members; orders/customers/conversations/messages/order_items are limited to active owner/manager memberships; memberships are self-read. No INSERT/UPDATE/DELETE policy found in public tables. This is an intentionally read-only browser surface and must not be described as a completed merchant write API.
- Latest observed Render Auth staging deployment remains `dep-dbppc3ek1f9s73ci4al0` at `4c13ea5`; later branch changes require careful reconciliation before deploying.
- Priority gate: provision two authorized isolated staging users and perform real JWT-context RLS negative tests before marking tenant isolation VERIFIED_DONE. Do not manufacture test results or promote to production.
- Remaining V8.1: Auth real E2E, staging deploy reconciliation, merchant write API design, Bot Registry/Training Lab, Super Admin and pilot readiness NOT VERIFIED.
