# TIEN404 AI — SALES LITE V1.3 / V13.3 STAGING CHECKPOINT

**Date:** 2026-11-15 JST. **Status:** EXPERIMENTAL, not CANDIDATE/APPROVED/RELEASED.
**Repository:** https://github.com/ngoctien20/demo-git
**V13.3 branch:** work/v133-sales-lite-secure-integration-staging
**Draft PR:** https://github.com/ngoctien20/demo-git/pull/69
**Parent PR:** #68, base work/v132-sales-lite-ui-staging, checkpoint fda208ae0623410b25b7b029821c03dc4463d1f8.
**Tested V13.3 source HEAD:** ae7a6bc0c448c6f4bebd78b77f8fc3a8e736c922.
PR #41 (Owner), #52 (Customer), #67 (Menu V1.1), #68 (Studio V1.2) remain OPEN DRAFT. No merges.

## 1. Verified state BEFORE

- GitHub PR #68 source unchanged at V13.2 checkpoint; run 43669313659 2 jobs SUCCESS.
- Supabase staging ifxlvrhyjhbzbrkdsida ACTIVE_HEALTHY. Public tenants, tenant_memberships, orders RLS enabled with membership and owner/manager SELECT policies.
- n8n ingress yIJk8LvJoLF40Z62 active; Customer Router sIPs6egzIwOY1GNv active; Owner Shadow OgDZNSAvKEvhnAvn active. No modifications to published workflows.
- Cloudflare Pages tien404-ai-git-staging production branch gh-pages, canonical production deployment success. V13.2/V13.3 branch preview deployments observed queued/idle; direct public URLs NOT confirmed serving pages. No real working secure preview URL.
- Cloudflare Access app read returned HTTP 403, so access policies were neither inspected completely nor updated.
- Render workspace-specific tool required explicit workspace selection, so no Render service modification or current authenticated endpoint verification performed.
- Official Zalo Bot sendMessage source confirms {start,len,st:[...]} syntax for text_styles with UTF-16 code units. V13.2 browser draft had a legacy {type:'bold'} shape not matching provider syntax; V13.3 offline preview corrected.

## 2. IMPLEMENTED (new V13.3 branch only)

- qa/sales-lite/v133/merchant-readonly.cjs: server-port authenticated session, current active membership (OWNER/MANAGER), server-selected shop, readback scope verification, minimal 200 response/no-store, 401/403/409/503 fail closed. No actual Auth/Billing/DB connector is wired.
- qa/sales-lite/v133/account/index.html + app.js: default /api/sales-lite/me GET using same-origin cookies, no browser credential storage, explicit QA fixture toggle, no fallback to mock on failed live request. Expiry banner from API state/read date, no auto renewal or outbound notifications.
- qa/sales-lite/v133/staff-guard.cjs: prepared signed Cloudflare Access JWT + current staff grant guard, no Access deployment or permission change.
- qa/sales-lite/v133/menu-core-bridge.cjs: injected server-only MenuEngine read ports for Customer catalog/Owner inbox/report and business contract Customer Core preview port. No PR #41/#52 runtime import or mutation, no Zalo sends.
- qa/sales-lite/v133/menu-drafts.cjs: in-memory version/diff/validation/review gate, no publish.
- qa/sales-lite/v133/studio/index.html + app.js: menu draft timeline, version comparison, manual REVIEW gate and corrected Rich Text UI.
- qa/sales-lite/v133/rich-text.cjs: verified whitelist of Bot sendMessage st codes, UTF-16 surrogate pair boundary checks, parse_mode/text_styles conflict checks.
- qa/sales-lite/v133/subscription-expiry.cjs: in-portal 7/3/0-day proposed milestone logic, no notification dispatch.
- qa/sales-lite/v133/support-contract.cjs: ticket draft only and owner-scoped read-only lookup, no ticket writes.
- qa/sales-lite/v133/v133-contracts.test.cjs and v133-ui-and-security.test.cjs, v133-browser-qa.cjs.
- .github/workflows/v133-sales-lite-secure-qa.yml: isolated Node 22 security/source/regression and Playwright Chromium UI tests.
- qa/sales-lite/v133/README.md plus V13.3 audit / Zalo / commercial docs.

## 3. TESTED — actual evidence

GitHub Actions run: https://github.com/ngoctien20/demo-git/actions/runs/43671556347 at tested code HEAD ae7a6bc0c448c6f4bebd78b77f8fc3a8e736c922.
- v133-contracts SUCCESS: **52/52** V13.3 cases PASS; **19/19** V13.2 source regression PASS; **116/116** V13.1 Node regression PASS; total 187 independent source/contract case executions, 0 failed.
- v133-browser SUCCESS: 10 UI/viewport runs, V13.3 Studio + Merchant at **360, 390, 430, 768 and 1280 px** PASS. Browser tests simulated same-origin API responses 200 and 401, draft review, rich style codes, disabled billing/QR, no unexpected network writes or horizontal overflow.
- Screenshot artifact 14144163929: https://github.com/ngoctien20/demo-git/actions/runs/43671556347/artifacts/14144163929.
- Independent V13.1 n8n execution 3809 Menu Smoke and 3810 Reply Guard were checked in V13.2; not rerun for V13.3 because no live n8n integration change. Their previous success is NOT V13.3 end-to-end proof.

**NOT TESTED / BLOCKED:** physical mobile device, actual Staff Access identity, Cloudflare preview access and asset bypass, authenticated hosted Supabase Shop A/B RLS, session revocation, real subscription/Owner Bot data, provider-native buttons, live Zalo sends, paid LLM calls or production billing.

## 4. Cloudflare and authentication hard stop

Cloudflare preview paths /sales-lite/studio and /sales-lite/account NOT deployed/verified. Current source preview paths exist in repository but are NOT secure public URLs.
GET /accounts/{account_id}/access/apps returned 403. Do NOT publish Studio publicly on any Cloudflare preview or rely on JS roles/noindex. To continue, an authorized Access admin must review and approve staff-only policy and grant suitable connector access. Protect all aliases/assets and API paths.
Backend GET /api/sales-lite/me is a **PROPOSED interface** with an independent server resolver, not a deployed API. No actual Supabase/Render session connection or hosted signed-shop QA performed.

## 5. Supabase security finding

Security Advisor detected public SECURITY DEFINER function qa_shop_b_zalo_claim exposed to anon EXECUTE. Verified grants via PostgreSQL metadata. Read-only function definition inspection found an authorization gate comparing a custom header secret to a Vault-derived secret using a digest, explicit empty search_path and hard-coded Shop B QA scope. Missing secret expected to reject calls; **no confirmed exploit**. A P0 REVIEW/release blocker remains due privileged public function and any possible secret leakage. Other definer funcs qa_owner_pairing and save_merchant_product executable for authenticated need separate review. Leaked-password protection disabled according to Advisor.
No SQL grant changes, credential rotation, migration or revoke applied; first audit all current callers and obtain approval.
See docs/ai-handoff/V13_3_SUPABASE_AUTH_RLS_READONLY_AUDIT.md.

## 6. Zalo provider research

Zalo Bot sendMessage text and text_styles schema **OFFICIALLY_DOCUMENTED**. V13.3 validator and browser preview **MOCK_TESTED**, no provider send. Bot native buttons/quick reply/persistent menu/callback/carousel **UNKNOWN** due no validated API schema. Rename after creation **UNKNOWN** (creation sets name with 'Bot' prefix, Creator offers general profile management but not verified API/side effects). Commercial rights, quotas and zBusiness Basic entitlements **UNKNOWN**. No tokens used.
See docs/ai-handoff/V13_3_ZALO_BOT_CAPABILITY_RESEARCH.md and official docs https://docs.zaloplatforms.com/docs/BOT/apis/sendMessage.

## 7. Business review

Lite 199,000 VND and Plus 349,000 VND per shop/month remain hypothetical prices. The commercial document models Low/Standard/High Usage with explicitly labeled assumptions for traffic, model calls, support and infrastructure allocation. Provider messaging fees and legal/CAC/onboarding remain unknown; illustrative pre-provider surplus is NOT real gross or net profit. No Billing setup.
See docs/ai-handoff/V13_3_SALES_LITE_UNIT_ECONOMICS.md.

## 8. Release gates / acceptance

- [x] Audit real PR #68, GitHub Actions, Supabase schemas/RLS predicates, published n8n workflow metadata, Cloudflare Pages status.
- [x] New Draft PR #69; isolated additions only; rollback checkpoint.
- [x] Read-only Merchant server resolver contract and safe UI state handling.
- [x] Offline Menu Core bridge no-send/no-order QA adapter contract.
- [x] Menu Draft versioning and official Rich Text schema validation in code/UI.
- [x] Support read-only ticket contract and expiry alerts (no sends).
- [x] Zalo research and hypothetical commercial cost model.
- [x] Source 52 + 19 + 116 tests PASS and Chromium 10 viewport runs PASS.
- [ ] Two accessible staging URLs and staff-only Studio policy PROVEN.
- [ ] Authenticated real Merchant API returning verified Shop A/B data.
- [ ] Hosted signed-session RLS cross-store/revocation negative tests PASS.
- [ ] Real bot pairing/subscription backend readback verified.
- [ ] Real n8n Customer/Owner Core no-send adapter wired with signed resolver.
- [ ] Zalo native button/rename/commercial policy confirmation.
- [ ] Critical definer RPC grant review/remediation and backup approved.
- [ ] Owner accepts Candidate release gates. NOT YET CANDIDATE.

## 9. Changes/operations/rollback

Only new GitHub branch and Draft PR #69 + source/tests/docs changes. No production, Cloudflare Access policy, credential, DB schema, n8n workflow or live customer record was changed. Cloudflare Pages auto-preview entries were generated from GitHub integration but still queued/idle, not treated as a working deployment. No new paid service intentionally provisioned; actual account billing not inspected.
Rollback: close/revert PR #69 and preserve #68/#67/#52/#41; no DB restore or real webhook rollback required from V13.3.

## 10. Approvals and suggested V1.4

Owner approval before changing Access policy/permissions, Supabase RLS/migration/RPC grant, live sender/Orders, billing, production, new paid resources, merging PRs or provider operations.

V1.4 priority:
- P0: Verify Cloudflare preview pipeline + enforce authorized staff-only access.
- P0: Connect existing Auth/merchant read-only data port and run real Shop A/B hosted RLS.
- P0: Integrate signed Zalo ingress→Menu→Core read-only in isolated n8n QA.
- P1: Provider-confirm Bot native menu/rename/commercial quotas; controlled pilot only after approval.
- P1: Support ticket persistence and plan quota controls after cost evidence.

**Final V13.3 status: IMPLEMENTED + TESTED for isolated code/UI; BLOCKED for live staging integration and public protected preview; RELEASE = EXPERIMENTAL.**
