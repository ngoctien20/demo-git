# TIEN404 AI — Actual CTO Work V10.3 → V10.4 checkpoint (2026-11-11 JST)

**Agent:** GPT. **Scope:** staging and GitHub feature branches only, NO domain purchase, NO SaaS production/cutover, NO n8n Meta Messenger modifications.  
**Origin:** GitHub Issue [#9](https://github.com/ngoctien20/demo-git/issues/9), 9 documents in `docs/ai-handoff/`, Cloudflare Pages, Render, Supabase and n8n connectors.  
**Current result:** V10.3 widget code + Cloudflare preview BUILT and 25 browser tests PASS; Auth CSS and Super Admin CSS on separate draft PRs with their own green CI. V10.4 full-stack functions remain staged/blocked, not falsely marked completed.

## 1. Live infrastructure audited

| System | Actual verified status at audit | Notes |
|---|---|---|
| GitHub | `main=2ddf0138e57bf65b458786271e3a39591b26b0d7`, `gh-pages=6bb57e631709cb0be8d3b2b02c299d5915638df8` | Do not use main to overwrite website; gh-pages unchanged |
| Cloudflare Pages | `tien404-ai-git-staging` (GitHub integration) production branch `gh-pages` | baseline deployment `2715c6e2-edc1-4a5d-9ceb-5953311b752d`, status success; production deployment still unchanged |
| Cloudflare V10.3 preview | `https://5727518f.tien404-ai-git-staging.pages.dev` | deployment `5727518f-e644-4e9a-9965-e82b799e5e02`, commit `2a276a8a3ac14ec15614b278b84b0e9fbb2acec1`, success |
| Original Direct Upload project | `tien404-ai-staging` | Untouched; do not try to convert source to Git by API |
| Render Auth staging | `srv-dbpj4irm8hqs73e2h2rg` | static site, autoDeploy OFF, live commit `c728f153906781905ec80f06e7fef9572e9e02c9`, deploy `dep-dbq33krl550s739e1vfg`; **new Auth CSS NOT deployed here** |
| Render Data staging | `srv-dbphtas9v7es73bursrg` | web service, autoDeploy OFF, live `3c29f70eae00edd6572756c91c4a4bfa43e77d2c`, deploy `dep-dbq30a2jnfac73euucsg` |
| Supabase | `tien404-staging` ref `ifxlvrhyjhbzbrkdsida` | ACTIVE_HEALTHY, PostgreSQL 17; 9/9 public tables RLS enabled and ≥1 policy |
| n8n Commerce | `ZVmMlwe2g0bPjVEq`, `tjsVobfjKLnv0o6b`, `QR7aYMpLfKDLVgyH` | most recent execution `2085`, `2090`, `2102` success (metadata-only; do not infer each assertion score without read data) |
| n8n Messenger | `Z7FdV7uDvApfbURQ` | V10.1 live already published from prior owner-approved pilot. **No changes this workstream.** |

### Branch drift / concurrency

Work V10.2 docs branch and product branches differ. GitHub root `main` contains only minimal legacy content; Cloudflare uses `gh-pages`. Auth UI lives in `work/supabase-auth-staging-v1` and Admin prototype in `ops/tenant-data-platform-v1-staging-20261110`. **Never overwrite one with another**. Changes in this workstream were added to distinct feature branches and draft pull requests.

## 2. Actual code implemented

### W10.3-CF1 — Cloudflare widget design and semantics

- Branch: `feature/v10.3-cloudflare-widget-qa-20261111` based on **exact gh-pages SHA** `6bb57e6`.
- **Draft PR [#11](https://github.com/ngoctien20/demo-git/pull/11)** targeting `gh-pages`. Not merged.
- Files changed:
  - `assets/live-chat.css` (+scoped V10.3 design tokens for chat launcher, header, composer, message presentation, focus, mobile sizing, reduced motion; no data changes).
  - `assets/ai-consultant.js` (aria-busy loading indication; accurate composer sending status and Ctrl/Cmd+Enter shortcut; original n8n webhook kept unchanged).
  - `_headers` (Cloudflare Pages `X-Robots-Tag: noindex, nofollow`, nosniff, frame and referrer policy; GitHub Pages ignores this config).
  - `qa/v10-3-cloudflare.spec.cjs` (local HTTP & 390/768/1440 responsive, focus/Escape, mobile panel bounds, read-only Cloudflare-vs-GitHub route parity).
  - `.github/workflows/v10-3-cloudflare-qa.yml` (feature-scoped browser CI; fixed apt mirror issue using `npx playwright install chromium` rather than `--with-deps`).
- Latest code SHA: `2a276a8a3ac14ec15614b278b84b0e9fbb2acec1`.
- Cloudflare preview deployment: `5727518f-e644-4e9a-9965-e82b799e5e02` → **SUCCESS**, preview URL above.
- **CI PASS 25/25:** GitHub Actions [run 43035200229](https://github.com/ngoctien20/demo-git/actions/runs/43035200229), local route smoke on 390/768/1440, widget launch/Escape/focus, mobile bounds and public URL response parity. This CI does **not** test actual AI conversation send; no tests sent messages into n8n.
- Important: These are independent browser tests, not a full security/visual/performance audit; screenshots in CI artifact where configured. `_headers` syntax/source guardrail PASS, but Cloudflare response **X-Robots-Tag header itself not yet captured with a real HTTP HEAD proof**. A code file alone must not be mistaken for validated response headers.
- The primary Cloudflare Pages `tien404-ai-git-staging.pages.dev` remained on baseline `gh-pages` SHA `6bb57e6`. New visuals accessible only on immutable preview URL.

### W10.3-AUTH1 — Login/Account design-only revision

- Feature branch `feature/v10.3-auth-ui-staging-20261111` based on `c728f153`.
- **Draft PR [#10](https://github.com/ngoctien20/demo-git/pull/10)** targeting `work/supabase-auth-staging-v1`; not merged nor deployed to Render.
- File `assets/auth.css`: staged professional branding, inputs/buttons, mobile layout, error/status and Merchant cards. No Supabase Auth JS, tenant-role logic, JWT/RLS, product editor flag, recovery config or backend changed.
- CI installed browser without broken apt mirror; **PASS** [run 43035277528](https://github.com/ngoctien20/demo-git/actions/runs/43035277528) on commit `ffca72dc4bd24e99dd042f8fef6377c4ed3f428d`: node syntax, no-demo/no-secret checks, unit tests, build, isolated Chromium smoke. Does **not** prove real user login, recovery email, JWT A/B or Render deployed UI.
- Auth staging currently has `PRODUCT_EDITOR_ENABLED=false`; leave OFF until real signed HTTP identity tests and owner release approval.

### W10.3-ADMIN1 — Existing protected Super Admin CSS

- Feature branch `feature/v10.3-super-admin-ui-20261111` from ops backend branch.
- **Draft PR [#12](https://github.com/ngoctien20/demo-git/pull/12)** targeting `ops/tenant-data-platform-v1-staging-20261110`; not merged/deployed.
- File `ops/super-admin/app/ui/admin.css` style-only upgrade. Existing protected `/admin` FastAPI/SQLite local prototype preserves password+TOTP, server authorization, CSRF, read-only metrics/tenants/plans/audit.
- **CI PASS 71 security/tenancy tests, 1 warning** [run 43035070898](https://github.com/ngoctien20/demo-git/actions/runs/43035070898), commit `1d84a4fe0fb2f76298971ec61a00df98a6bbfd02`.
- **No hosted Super Admin URL exists that has been independently verified**. A CSS PR alone does not satisfy P1 Super Admin deployment; need identity integration and a secure staging host without enabling paid resource.

## 3. Cloudflare preview safety incident and restoration

- Temporarily configured Cloudflare Pages `preview_deployment_setting=custom`, include only widget branch, to create a V10.3 preview. Despite this exact allowlist, Pages received PR-related preview events for Auth/Admin branches; some recorded as `idle`. To prevent unintended additional previews, **restored `preview_deployment_setting=none`, confirmed read-back**. Original production SHA and deployment unchanged. Existing preview URL of Widget remains usable. No domain/DNS was changed. Before any future preview changes check Cloudflare PR triggers and branch restrictions independently.
- Cloudflare Web's main project remains Git-connected with `gh-pages` and automatic production deployments enabled; any merge/push to gh-pages updates two public demos. **Owner review required**.

## 4. Security audit & unresolved hard gates

- Supabase metadata read-only check: 9 public tables (conversations, customers, messages, order_items, orders, products, tenant_agent_configs, tenant_memberships, tenants) are RLS-enabled, each with at least one policy. **Not proof policies are semantically correct or real HTTP JWT tests pass.**
- Supabase Security Advisor WARN: `authenticated_security_definer_function_executable` for `public.save_merchant_product`, and `auth_leaked_password_protection`. Remediations: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable and https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection . Three INFO: RLS enabled without policy on private tables (expected deny-by-default if permissions absent).
- No authentication secrets, real customer data, product/order writes or admin authorization changes were made.
- **NOT_RUN:** two independent signed A/B JWT HTTP tests (owner/manager/staff/nonmember/anon, cross-tenant read/write), external browser logins with real QA accounts, actual customer-facing n8n chat sends, true X-Robots-Tag HEAD response, external Super Admin hosted admin-only 401/403, production restore drill and live Commerce integration.
- First two widget CI runs failed in browser package setup because Ubuntu apt mirrors failed DNS; they were **not website failures**. Corrected CI run on latest code passed.

## 5. V10.4 pending implementation and recommended milestones

1. **P0** QA auth signed HTTP with two separate tester sessions. Confirm tenant isolation and absence of service-role secrets; no merchant editor until pass.
2. **P0** secure Super Admin staging integration: inspect existing FastAPI/SQLite prototype and domain/session constraints; choose approved backend/identity/MFA, add read-only status views and fail-closed authorization; use existing hosting only after resource/permission review.
3. **P0** close browser QA: actual HTTPS HEAD security headers; accessibility axe, console/network logs and cross-browser/mobile screenshot review; build interface parity with Merchant staging; maintain Cloudflare preview isolation.
4. **P1** Commerce transactional APIs: per-tenant verified channel mapping, strict authorizations, optimistic stock, idempotency, refund/cancel order consistency, status codes and audit. Preserve AI_SALES_DEMO separate Google Sheets and credentials.
5. **P1** Merchant Dashboard: products, orders, customers, conversations, AI configs, settings from Supabase RLS via Auth; avoid sample revenues presented as real.
6. **P1** Messenger Lab QA: current published/draft version audit, exact catalog freshness, support-ticket lifecycle, permissioned rollout. No production publication without approval.
7. **P1** Monitoring: GitHub Actions + Cloudflare preview/Render deploy metadata and Supabase logs first; PostHog/Sentry only after privacy and budget approval.
8. **P3** real-domain cutover at Mắt Bão after owner buys domain and gives explicit production approval; no DNS now.

## 6. Release state and next action

- **CODE_COMMITTED:** Widget V10.3 ✅; Auth UI ✅; Admin isolated UI ✅.
- **PREVIEW_DEPLOYED:** Cloudflare Widget ✅. Render Auth upgraded UI ❌ (only code + tests); hosted Super Admin ❌.
- **QA:** Widget browser 25 passed ✅; Auth isolated CI ✅; Admin 71 passed ✅; production security/real-account E2E ❌.
- **PRODUCTION_DEPLOYED:** NO. Github Pages gh-pages/Cloudflare main Pages unchanged; Render live Auth/Data unchanged; n8n Messenger workflow unchanged.
- **Next:** owner can review exact Cloudflare preview and PR #10/#11/#12; finish signed JWT auth, browser header checks, security host for Super Admin, then separately approve merges/deploys. No domain purchase/cutover until explicit later approval.


## 7. Verified HTTP header and final CI on widget branch

- Follow-up Playwright test appended to `qa/v10-3-cloudflare.spec.cjs`, widget branch commit `37052a9e63960697ce077a420f88803aeb9d25f0`. This source-only QA test does not change widget visuals or the already-successful immutable Cloudflare preview.
- GitHub Actions **[run 43035910218](https://github.com/ngoctien20/demo-git/actions/runs/43035910218)** completed SUCCESS with **26 passed (11.5s)**. Its final test performed real HTTPS GET on immutable preview `https://edf09e40.tien404-ai-git-staging.pages.dev/` and verified `X-Robots-Tag` contains `noindex`, `X-Content-Type-Options=nosniff`, `X-Frame-Options=DENY`. This supersedes the earlier "HTTP HEAD/response header not verified" status for these three header assertions; the test used GET, not HEAD.
- The V10.3 source branch latest SHA is now `37052a9e`. The **last verified completed Cloudflare widget preview deployment still serves prior visual source SHA `2a276a8`**, because preview builds were intentionally disabled after unexpected PR preview events; the subsequent change only added QA code. New full deployed SHA not asserted.
- V10.3 widget score update: 26/26 PASS in isolated/read-only browser suite. Actual model chat send, full commercial checkout and authenticated cross-tenant E2E still NOT_RUN.
