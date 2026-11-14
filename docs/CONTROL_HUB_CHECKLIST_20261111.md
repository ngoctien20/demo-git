# TIEN404 — Control Hub checklist & Auth fix QA
**Checked:** 2026-11-11 05:48 JST (read-only verification, except isolated staging login fix). Do not auto-check Control Hub items. Owner will mark items manually.

## A. Render Auth staging incident
**Reported symptom:** Login page can remain in a loading/sign-in state without a useful error message.

**Root cause status:** NOT PROVEN in user's actual browser. Identified plausible code-path defect: `auth-client.js` used a synchronous top-level import from external jsDelivr; `getUser` and `signInWithPassword` waited without UI timeout. Browser network/extension interference or unresponsive Supabase requests could leave a spinner indefinitely.

**Patch delivered** to `work/supabase-auth-staging-v1`:
- Bounded SDK loading (jsDelivr primary, esm.sh fallback; pinned `@supabase/supabase-js@2.119.0`).
- Bounded login, session check, membership query, catalog lookup, password recovery and sign-out; safe error display and retry.
- Classic watchdog shows a useful status even when the module loader never initializes.
- Render preview's file allowlist includes the new helper/guard; no credentials, data or internal files copied into the public static site.
- Rechecked JavaScript syntax, static guards, isolated Node timeout tests and Playwright Chromium mocked login; this is NOT a real password/browser verification.

**QA evidence:**
- GitHub Actions Auth: https://github.com/ngoctien20/demo-git/actions/runs/42898728070 — SUCCESS, including Chromium mock browser.
- GitHub Actions navigation: https://github.com/ngoctien20/demo-git/actions/runs/42898728163 — SUCCESS.
- Render Static Site `srv-dbpj4irm8hqs73e2h2rg`, deploy `dep-dbpo69u1egvs7390iv80`, commit `404b63b10d78b969704e660ff938b4489b7bcf2d` — LIVE.
- New URL: https://tien404-auth-staging.onrender.com/login.html?v=authfix11
- GitHub Pages production `gh-pages`, backend `tien404-data-staging`, n8n and Supabase rows were not changed.

**Open/Owner check:** User should test login without sharing password or token. Confirm that either (a) session login loads account and Shop A or (b) a specific error replaces spinner. A real browser + Supabase session proof is still required before marking **login fully fixed**.

## B. Four existing Control Hub checklist items

| Item from screenshot | Evidence verified 2026-11-11 | Manual check recommendation |
|---|---|---|
| **Xác minh phiên bản Published của 7 workflow** | Inspected seven live n8n workflows: Main Agent `v6PBwcqSapVzACMW`, Create Order `KrSn4DNR9ALX5ng4`, Manage Order `fDB9dvs1qPPVt9Sp`, Update Order `BkAi6TVUKAjCnI7v`, Revenue `U2DJsxzSYPH5hRop`, Messenger `Z7FdV7uDvApfbURQ`, Website AI `wgkkmT7q4lm4HyuA`. All seven active and have `activeVersionId`. **Three drafts match Published; four differ** (Create/Manage/Update/Revenue). | **CHECK if the goal is inventory and verification of Published versions.** Create a separate follow-up to reconcile four draft/published mismatches; do not publish automatically. |
| **Kiểm tra cô lập dữ liệu giữa các cửa hàng** | Supabase has 2 staging tenants but only **1 Auth user and 1 active membership**. Tenant-scoped RLS policies exist; previous synthetic QA and stage tests exist, but a real two-user cross-tenant Auth E2E check is not established in this turn. | **DO NOT CHECK YET.** Requires two independent test Auth users (Shop A and Shop B), browser/API negative tests and audited evidence. |
| **Kiểm tra trừ / hoàn kho và chống đơn trùng** | Commerce mock suites succeeded historically: Catalog/Cart `1473`, Business Core `1474`, Rules Extension `1479`; Revenue staging `1604`. These do not prove live transactional inventory reserve/commit/refund or idempotent real order writes. | **DO NOT CHECK YET.** Need isolated staging transaction tests, simultaneous orders, retries, rollback and invariants; don't invoke legacy Google Sheets mutating production tools. |
| **Đối chiếu demo website với backend** | Checked `gh-pages`: `demo.html` and `assets/app.js` still include simulation and do not bind directly to Supabase/Render data; `login.html` remains demo. Render Auth preview is separate. | **DO NOT CHECK YET.** Compare real login, tenant-authorized dashboard/API data and public site claims; browser E2E with evidence and production release approval. |

## C. Provider snapshots
- n8n: **31 workflows**, **16 active** at live inventory. Active status does not imply production-readiness.
- Supabase `ifxlvrhyjhbzbrkdsida`: **1 Auth user**, **2 tenants**, **1 active membership**, **2 products**, **2 orders**. RLS policies present for `orders`, `products`, `tenants`, `tenant_memberships`. These are staging rows, not customer production data.
- Published-version drift: 4/7 of the named workflow cohort (see table). Do not blindly publish Draft versions because they can write orders, send messages or revenue reports.
- The screenshot's checklist says initial tasks are plans, not verified outcomes. Treat manual checkboxes as owner's final action only.

## D. Next actions
1. Owner manually tests staging login and returns error text/screenshot **without credentials**. If functioning, run authenticated browser session, refresh, logout and Shop A tenant visibility test; otherwise investigate request logs or client network failures.
2. Investigate four draft/Published differences in read-only mode; document risk and test strategy, no publish.
3. Obtain a second authorized staging-only Auth fixture for Shop B; perform cross-tenant access denial E2E tests. Do not create accounts or alter real data without targeted approval.
4. Model transactional order inventory and duplicate prevention in isolated stage; add tests for retry and simultaneous checkouts; no writes to legacy demo Sheets.
5. Audit website demo vs Render/Supabase and revise customer journey in a separate PR after E2E.

**Production changed:** NO. **Staging Auth changed:** YES. **n8n writes/Published changed:** NO. **Data writes:** NO.
