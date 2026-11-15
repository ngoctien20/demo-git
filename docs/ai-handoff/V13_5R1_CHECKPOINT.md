# TIEN404 AI — V13.5R.1 CHECKPOINT

**Date:** 2026-11-15 JST.  
**State:** IMPLEMENTED + TESTED source/Chromium mock; **EXP​ERIMENTAL / NOT RELEASED**.  
**Draft PR:** [#81](https://github.com/ngoctien20/demo-git/pull/81) (stacked on Draft [#78](https://github.com/ngoctien20/demo-git/pull/78)).  
**Branch:** `work/v135r1-canonical-account-staff-gates-staging-20261115`.  
**Immutable parent baseline:** `12af6d6d0fe225fbd2becab6187c9dc7b176d80e` (#78).
**QA source SHA (tested, before documentation-only updates):** `43ac1b3b89bd4b443715de7246d3ebd6775f76cc`.

## 1. Verified before edits
- PR #78 and #73 still Draft at first audit, no V13.5 hosted Render deploy.
- Render Auth `tien404-auth-staging` source branch `work/supabase-auth-staging-v1`, live deploy SHA `b14501a0ebf04d991302cb32b5d548a68d6b39bd`, auto-deploy OFF.
- Render Data `tien404-data-staging` source branch `ops/tenant-data-platform-v1-staging-20261110`, auto-deploy OFF.
- Supabase `tien404-staging` healthy, RLS and FORCE RLS for orders/customers/memberships/tenants/products. Anon SELECT denied, authenticated SELECT allowed, authenticated UPDATE denied. Orders schema verified matching V13.5 read-only projection. Shop A has 1 active owner membership, Shop B has 2. These are read-only **metadata**, NOT signed-JWT isolation proof.
- Public `qa_shop_b_zalo_claim` SECURITY DEFINER anon EXECUTE remains P0; no ACL modifications.
- No authoritative commercial Staff Assignment / Platform Role / Subscription table confirmed in inspected public/app_private schemas. Tester Staff tables must stay independent.

## 2. Implemented — Draft branch only

| Change | Why |
|---|---|
| `account.html` now safe same-origin static redirect to `merchant-portal.html`; fallbacks link login and authorized Tester pages | One canonical customer entry; no token/tenant/query forwarding |
| `scripts/build-auth-preview.mjs` removes legacy `assets/auth-account.js` from public Auth build allowlist | Retire technical CRM account JS from deployed customer entry while preserving full source in Git |
| `tests/account-canonical-entry.test.mjs` and browser runner | No-token/no-CRM/no-write, 5 viewport anonymous lock tests |
| `tests/auth-preview-build.test.mjs` adjusted | Build must not publish legacy controller |
| `scripts/check-supabase-auth-staging.mjs` now recognizes canonical vs historical Account | Does not weaken historical security tests; strict canonical Supabase getUser+membership checks |
| `.github/workflows/auth-staging-qa.yml` conditional browser suite | Keep old Auth/CRM smoke on legacy source; run canonical Customer suite on new source |
| `tests/auth-tab-stability-browser.py` conditional route testing | Preserve same-session tab/refresh/revocation regression after account redirect |
| `.github/workflows/v135r1-canonical-account-auth-security-qa.yml` | Independent source/build/browser plus inherited V13.5 negative tests |
| `docs/ai-handoff/V13_5R1_HOSTED_AUTH_RLS_READINESS.md` | Records metadata versus real hosted evidence; RPC review gate |
| `docs/ai-handoff/V13_5R1_STAFF_ASSIGNMENT_READINESS.md` | Proposed independent Staff/Owner authorization and SQL approval gates; **no DDL** |

**Customer Portal** itself stays on the PR #78 source and remains no-write. Existing CRM/order/owner modules, Tester pages and Git history are retained. This change only consolidates account entry and build exposure.

## 3. TESTED — exact evidence

**Tested code SHA** `43ac1b3b89bd4b443715de7246d3ebd6775f76cc`.

- [Run 43690748555](https://github.com/ngoctien20/demo-git/actions/runs/43690748555): canonical source/regression **54/54**, legacy auth/stability **16/16**, strict preview/build **9/9**; total **79/79**, zero fails, **two jobs SUCCESS**. Canonical 5 viewport + inherited signed-in mock Customer 5 viewport **10/10**, no writes.
- [Run 43690748597](https://github.com/ngoctien20/demo-git/actions/runs/43690748597): Supabase Auth static/security **SUCCESS** on canonical branch.
- [Run 43690748590](https://github.com/ngoctien20/demo-git/actions/runs/43690748590): Private Tester QA **SUCCESS** after adapting `auth-tab-stability-browser.py`. Logs explicitly show account and merchant token refresh stable, 5-minute membership recheck and revoked access lock. Anonymous Tester QA 3 viewport, no external traffic, private SQL paths 404.
- [Run 43690748551](https://github.com/ngoctien20/demo-git/actions/runs/43690748551): inherited V13.5 Core/Role and mobile QA **SUCCESS**.
- [Run 43690748585](https://github.com/ngoctien20/demo-git/actions/runs/43690748585): inherited PR #73 Account source/Chromium **SUCCESS**.
- [Run 43690748584](https://github.com/ngoctien20/demo-git/actions/runs/43690748584): navigation **SUCCESS**.

**Important:** Real hosted Shop A/B JWT, expired/revoked users via real HTTPS/RLS, Render deployment and API auth are **NOT TESTED**. Local Chromium used synthetic Auth and local HTTP; successful GitHub Actions is not evidence for production.

## 4. BLOCKED / approvals

1. Hosted signed QA sessions for Shop A and B are not available in attached browser tabs; no credentials/OTP/token requested or stored. Need authorized sessions for real HTTP cross-shop and revocation checks.
2. Render V13.5R.1 is not deployed; auto-deploy remains OFF. A planned staging release must be reviewed with a rollback against current Render deployed commit.
3. Commercial Staff Registry, Store/Branch Registry, Staff Assignments, Subscription source and Platform Owner server authorization remain conceptual; no RLS/ACL/role grants. Owner must approve changes to these controls separately.
4. `qa_shop_b_zalo_claim` EXECUTE exposure requires full caller inventory (including Worker code), rollback and explicit ACL approval; no revoke performed.
5. Payment settlement, order status writes, provider sends and Billing are disabled. AI Studio remains FUTURE/PRESERVED.
6. Historical `tests/auth_browser_smoke.py` with old technical CRM remains for earlier branches, not a test of the new Product. No fake green result was claimed for old flow after route retirement.

## 5. Rollback
Close/revert [Draft PR #81](https://github.com/ngoctien20/demo-git/pull/81); restore prior files from immutable parent SHA if needed. No Render, production, Cloudflare Access, Supabase SQL/data, credential, n8n Published, Zalo sends or financial records modified. No DB restore required.

## 6. Next safe CTO checkpoint
**V13.5R.2 — Authenticated Hosted Shop A/B E2E plus independent Staff schema design.** Obtain two authorized QA sessions (using connected secure browser in Work mode), verify positive and negative data scope, revoked/expired membership; verify canonical redirect after an explicitly approved Render staging deploy. Recheck privileged RPC callers, then seek separate owner approval for any ACL/RLS/bootstrap Staff modification. Product remains **EXPERIMENTAL** until these gates PASS.
