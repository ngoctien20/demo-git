# TIEN404 AI — WORK V12.2 MERCHANT PORTAL STAGING CHECKPOINT
**Ngày:** 14/11/2026 JST  
**Status:** IMPLEMENTED source / TESTED CI static + isolated Chromium / NOT DEPLOYED / NOT RELEASED  
**Branch:** `work/v12-2-merchant-portal`  
**Draft PR:** https://github.com/ngoctien20/demo-git/pull/35  
**PR base:** `work/supabase-auth-staging-v1` (existing Render Auth source), **not** `gh-pages` or `main`.  
**Other workstream:** V12 R1 Shop-Owned Bot draft PR #34 is unchanged.  
**Production:** no website publish, no n8n send/workflow changes, no Supabase migrations, no customer/account data written, no paid service deployed.

## AUDIT — Reuse, no parallel Auth
- GitHub Pages `gh-pages` contains demo-only `register.html`, `login.html`, `dashboard.html` etc. These are NOT production Auth.
- Render Auth already has `login.html`, `account.html`, Supabase Auth PKCE client with pinned SDK, recovery routines in `assets/auth-login.js`, per-tenant RLS listing in `assets/merchant-lists.mjs`, revenue V3 `assets/merchant-revenue-v3.mjs`, Owner Pairing UI and product QA. Work used `work/supabase-auth-staging-v1`, which was 5 commits ahead of `work/v11-auth-release`.
- Supabase staging project `ifxlvrhyjhbzbrkdsida` has RLS-enabled public tenants, tenant_memberships, products, orders, customers, conversations, messages, order_items and tenant_agent_configs. Existing read policies: Owner/Manager may read customers, orders, conversations and messages; Staff only permitted catalog read. No RLS/SQL modification this phase.
- The Render Auth preview builder `scripts/build-auth-preview.mjs` has an explicit public file allowlist and disables forgot-password email action on Render until exact recovery redirect allowlist is verified. This safety gate remains.

## IMPLEMENTED — staged code in PR #35
1. `merchant-portal.html`: protected-by-default merchant UI; sidebar desktop, horizontal mobile nav, per-shop select, 10 modules: Overview, Products, Orders, Customer purchase history, Care, AI Bot, Reports, Subscriptions, TIEN404 Help and Settings.
2. `assets/merchant-portal.css`: dark premium responsive merchant theme, keyboard focus, accessible labels, 390/768/1440 viewport QA.
3. `assets/merchant-portal.js`: reuses **existing** `getAuthClient`, `approvedMemberships`, `scopedTenantDisplay`, `addMerchantList`, `mountRevenuePanel`. Reads only scoped data with `tenant_id` from checked membership. Cross-Shop view switch invalidates old request generations; lack of valid Auth hides everything; no demo-user bypass or client write methods.
4. `assets/merchant-portal-policy.mjs`: pure UI role/selected-shop policy. Database RLS remains authoritative.
5. `account.html` adds authenticated link to `merchant-portal.html` without removing Owner Pairing or revenue features.
6. `register-staging.html` and `assets/register-staging.js`: source-ready real Supabase `signUp()` flow and UX. **`MERCHANT_SELF_SIGNUP_ENABLED=false` by default**. No account is created and no email is sent while locked. When eventually enabled, it never automatically grants tenant/Owner membership or creates Orders.
7. `login.html` links to the gated signup status page. Existing secure login and recovery JS is reused, not rewritten.
8. Preview build allowlist updated for only V12.2 pages/assets and noindex; no docs/private SQL/QA data in public bundle. No Render deployment triggered.

## TESTED — CI evidence
- First two runs exposed **incorrect test expectations** (capitalization and Vietnamese page title), fixed test assertions; no production issue.
- PASS: **GitHub Actions run 43578016223**, URL https://github.com/ngoctien20/demo-git/actions/runs/43578016223.
- `25/25` tests: Auth helper, tenant policies, merchant UI/security and gated registration.
- `15/15` tests after staging preview build: allowlist, private file exclusion and portal.
- Chromium isolated tests: anonymous/rejected/login-fixture/refresh/tenant switch/session expiry/logout/dark-mode Auth baseline PASS; new UI 390, 768, 1440 px PASS; protected view hidden without real Auth, signup disabled, no horizontal overflow.
- No sensitive user JWT, credential, phone, token or customer data was used by CI. Browser test blocks all external network.
- Navigation regression run 43578020267 also passed.

## SECURITY & KNOWN BLOCKERS
- **No signed-in Owner A/B positive browser E2E yet.** UI anonymous-only browser smoke is not tenant/JWT proof.
- **Email recovery remains disabled in Render Auth preview builder** until redirect and SMTP/recovery callback have been verified.
- **Self-service registration gated OFF:** needs abuse/rate limiting, email-confirmation/redirect-allowlist test, onboarding identity flow, no automatic shop membership. Do not claim “sign-up works” until real QA.
- **CRM/Order/Care modules are read-only.** Data is sourced from RLS tables, but mutations, customer notes, tickets, Human Handoff and order status update APIs require an approved backend contract. Help sends users to existing public contact page, no ticket persisted.
- **Subscription/Billing not integrated.** UI explicitly labels it BLOCKED, no fake plan, revenue or invoices. Do not enable payments.
- No real Zalo/Messenger auto-send or Owner notification involved. Existing Bot Kill Switch remains a separate V12.1/V12 R1 release gate.
- Beware: Branch `work/v12-2-merchant-portal` stacks atop **Auth staging**; PR #34 stacks separately and must be integrated only after careful diff/API contract review. Do not merge either into production automatically.
- No screenshots or signed-JWT staging browser evidence of actual private data are yet attached. No customer PII is to be captured in screenshots.

## QA CHECKLIST
- [x] Preserve existing Auth SDK, PKCE, account RLS, Owner Pairing and revenue V3.
- [x] Implement mobile-first Merchant UI on feature branch; no public deployment.
- [x] Product/Order/Customer/Care/Bot/Revenue read-only views reuse existing modules.
- [x] Staff UI restricted; SQL RLS left unchanged.
- [x] Source-ready signup form cannot submit or create users while flag OFF.
- [x] Preview strict allowlist, legacy recovery gate retained.
- [x] GitHub CI regression 25/25 + 15/15 and isolated Chromium PASS.
- [ ] Authenticated Owner A/B live JWT browser E2E on Render preview.
- [ ] End-to-end email recovery with allowlisted Render URL and safe email delivery.
- [ ] Owner self-registration/onboarding authorized server path.
- [ ] Backend-verified Customer Care tickets and order state actions.
- [ ] Subscription API and billing source verified.
- [ ] Approved manual Render staging deployment, followed by authenticated QA.
- [ ] Security approval before merge or public launch.

## ROLLBACK
- No deployed change, no DB migration, no n8n change. Leave PR #35 Draft or close/revert staging branch if not accepted.
- Render Auth currently in service remains on prior commit; manual deploy is required after approval and QA.
- Live Messenger and Zalo channels remain independent and must not be changed by this PR.
- PR #34 untouched.
## NEXT
1. Validate staging preview through authorized browser session with Owner A/B (real signed JWT), check positive own-shop views, 403 cross-shop and Staff restrictions. Do not paste tokens/passwords into ChatGPT.
2. Verify Supabase Auth URL/email settings; only after separate approval enable self-registration and recovery in staging.
3. Design backend permission contract for write operations (Customer Care tickets, customer notes, product management, order processing) reusing Commerce V3 and Notification V4.5, then E2E QA with synthetic shop fixtures.
