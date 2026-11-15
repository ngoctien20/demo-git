# TIEN404 AI — V13.2 SALES LITE V1.2 STAGING CHECKPOINT

Date: 2026-11-15 JST. Status: EXPERIMENTAL. No production merge, no Zalo send, no real order or payment.
Base branch: work/v131-sales-lite-menu-staging (PR #67; 8e9c416df64e0ae6204391baaeddb195f04f74aa).
New branch: work/v132-sales-lite-ui-staging.
New Draft PR: https://github.com/ngoctien20/demo-git/pull/68 (base V1.1; not gh-pages).
Validated code HEAD: b1a3621db098f74f0aeb7443da5a5ae09ee77bdb.
Separate PR #41 and #52 remained unmodified.

## 1. VERIFIED — Before changes

- Read actual V1.1 menu-registry.json, menu-engine.cjs, business-contracts.cjs, both original mock HTML pages and four handoff/QA docs.
- V1.1 Registry version 1.1.0 with 17 stable actions: Customer 6 / Owner 7 / Support 4. send_enabled=false, order_write_enabled=false, subscription_write_enabled=false.
- PR #67 OPEN DRAFT; #41 and #52 OPEN DRAFT.
- Existing n8n synthetic executions: Menu Smoke 3809 SUCCESS and Reply Guard 3810 SUCCESS (metadata rechecked). Baseline full pass counts belong to earlier V13.1 evidence, not provider testing.
- Supabase staging ifxlvrhyjhbzbrkdsida ACTIVE_HEALTHY. public tenants, tenant_memberships, orders have RLS enabled; read policies exist. This does NOT establish real hosted identity isolation for the Merchant UI.
- Public schema has tenant_memberships. Observed relevant private QA tables include tien404_r1_qa.owner_pairing_challenges, owner_pairing_claims_v3, shop_bots. No verified authorized merchant subscription+bot response endpoint, so no live UI adapter.
- Cloudflare Pages existing project tien404-ai-git-staging has production branch gh-pages. V1.2 branch preview deployment records were created automatically but observed stage=queued, status=idle; no reachable preview URL verified. No Cloudflare production config edited.

## 2. IMPLEMENTED — GitHub source changes

- qa/sales-lite/v132/design-system.css — shared design tokens, desktop sidebar and mobile bottom nav, responsive card/grid/input/phone preview.
- qa/sales-lite/v132/studio/index.html and studio/app.js — five independent UI views: Overview, Menu Designer, Chat Preview, Rich Text, QA Center.
- Uses canonical ../v131/menu-registry.json relative path from V1.2 Studio: ../../v131/menu-registry.json. No new authoritative registry.
- Studio supports in-memory label/description/fallback editing with contract validation, stable read-only Action ID, experiment action drafts, JSON export, 6/7/4 role previews, no network writes, no provider sends or real order commits. UTF-16 offset calculations are browser-native; draft formatting schema still requires provider verification.
- qa/sales-lite/v132/account/index.html and account/app.js — Merchant Portal five independent tabs: Overview / Account / Subscription / Bot / Support; fixture DEMO, EMPTY, EXPIRED, ERROR. Real login, payment, QR and support submission disabled.
- qa/sales-lite/v132/API_READONLY_CONTRACT.md — PROPOSED server-derived identity/membership/shop/subscription/bot response contract. Not connected.
- qa/sales-lite/v132/v132-ui.test.cjs and v132-browser-qa.cjs — source and Chromium browser test cases.
- .github/workflows/v132-sales-lite-ui-qa.yml — Node source regression plus Chromium/Playwright browser job and image artifact.
- qa/sales-lite/v132/README.md — runbook, gates and rollback.
- Original v131 source and live n8n / Supabase data unchanged.

## 3. TESTED — Actual test evidence

GitHub Actions run https://github.com/ngoctien20/demo-git/actions/runs/43669124445 at code HEAD b1a3621db098f74f0aeb7443da5a5ae09ee77bdb:
- Job sales-lite-no-send-ui SUCCESS: V1.2 19/19 source tests PASS; V13.1 regression 116/116 PASS, zero failures.
- Job v132-browser-mobile SUCCESS: Chromium browser executed Studio and Portal at 360, 390, 430, 768, 1280 px, 10 page/viewport runs PASS. Checked no overflow, menu role switching, local draft edit, mock chat, UTF-16 text_styles, QA local validation, subscription fixture transitions, disabled payment/QR, JS page errors and outbound writes.
- Evidence artifact v132-browser-evidence ID 14143294031, ZIP 266161 bytes, SHA256 18f1b8b172f08a90f344beac9ccbd37e4455f4450ec1aca087e12b28b649b680.
- Artifact link: https://github.com/ngoctien20/demo-git/actions/runs/43669124445/artifacts/14143294031
- Contains 390px Studio and Merchant Portal screenshots.
- Initial browser CI runs failed because Playwright 1.56.1 could not install Chromium on ubuntu26.04. CI was repaired with pinned Playwright 1.65.1 (officially supports Ubuntu 26.04), then passed.
- No hosted auth/RLS, real Zalo provider, mobile physical device or live payment E2E was executed. Browser QA was CI Chromium emulation, not a physical mobile-device test.

## 4. BLOCKED / not integrated

- Preview URL still NOT VERIFIED, as Cloudflare preview record is queued/idle. Logical target routes /sales-lite/studio and /sales-lite/account NOT deployed. Files are accessible as GitHub source under qa/sales-lite/v132/.
- Merchant Portal remains fixture-only. No authenticated read-only API, no actual subscription or verified pairing shown. Must inspect existing Auth and ownership contract PR #41 before adding.
- Studio must remain staff-protected if a public staging host serves it. noindex is NOT authorization, and mock switcher is not server permission.
- No security approval for a service-role key or new RLS policy. No credential or SQL mutation.
- Zalo Bot native buttons/callback still UNKNOWN; text numbered is mock-tested; no provider send.
- No billing, actual order save, outbox notification, customer data mutation, or external AI inference.
- Cloudflare project cost/billing usage not independently audited; no new paid service intentionally provisioned.

## 5. Rollback / release gates

1. Close/revert PR #68 and delete branch only after separate confirmation; V13.1 PR #67, PR #41, PR #52 and gh-pages remain unchanged.
2. No Supabase migration, n8n workflow update, credential rotation or domain config changes were done, so no database restore needed for V13.2.
3. For candidate promotion: verified staff-only preview routing + accessible mobile URLs, authenticated merchant read-only API, current membership RLS hosted negative tests Shop A/B, session revocation, CSP, anti-XSS, strict bot pairing, independent QA evidence and approval.
4. Separate approvals required before any real send, order write, billing changes, credential changes, RLS/permission changes or production merge.

## 6. Proposed V1.3

- Authenticated read-only Merchant Portal (single server resolver, no frontend service key).
- Staff-only Studio access with protected staging preview and visual screenshot regression.
- Provider-text_styles schema conformance and bot-specific template validation with no send.
- Real subscription expiry UX only after billing data contract verified.
- Helpdesk ticket read-only tracking after backend contract readiness.

This checkpoint reports IMPLEMENTED/TESTED UI only; do not call this a released commercial MVP.
