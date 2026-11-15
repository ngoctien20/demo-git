# TIEN404 AI — V13.4 Product Role Boundary Correction (2026-11-15 JST)

## Owner decision — AUTHORITATIVE

The **shop-facing account portal** is for account/subscription/billing support ONLY. It is NOT the Shop Operations/CRM/AI Bot admin console.

- Shop customer: views own personal profile, purchased plan and expiry when backend-verified, verified billing/payment details, account/security/recovery and support. Edits personal data/billing only after a trusted approved API/payment provider flow exists.
- Staff TIEN404: separately authorized Staff Console manages customer-shop Bot instances, channel configuration, menus/prompts, technical order/customer operations and QA, subject to explicit staff grants and tenant-scoped support assignment.
- Lite uses standard TIEN404 bot; Plus includes customization entitlement **carried out by TIEN404 personnel**, not unrestricted customer bot editor; Enterprise adds OA integration and monthly managed service under verified contract.
- Main bot merchant discovery is DEFERRED.
- Business order capture/handling remains a Sales Core product requirement but not account-page administration. No removal of Order/CRM backend.

## VERIFIED old misalignment

GitHub branch work/v12-5-messenger-clone-qa-tester-ui-20261115 has merchant-portal.html V12.2 showing products, orders, customers, care, bots, reports. assets/merchant-portal-policy.mjs previously allowed owner/manager to open bots; an obsolete test explicitly expected this. screenshot also shows same V12.2 menus on Render. This was a product role confusion. UI role gates are not equivalent to server staff authorization.

## IMPLEMENTED — PR #73 / isolated staging branch

Branch: work/v134-shop-account-only-boundary-staging
Base: work/v12-5-messenger-clone-qa-tester-ui-20261115
Draft PR: https://github.com/ngoctien20/demo-git/pull/73

- merchant-portal.html rewritten to account-only tabs: Overview, Personal information, Current plan, Billing information, Support.
- New assets/merchant-account-only.js: reuses Supabase getUser, active tenant_memberships + RLS-scoped tenant label; renders only this user's identity and allowed shop. Subscription and payment sources not connected, show unknown instead of fake; profile edits, renew and payment method edits are disabled pending verified backend provider workflow.
- Existing merchant Bot panel UI access policy explicitly denies bots to ALL merchant membership roles. This is defense-in-depth for legacy code only, not a staff authorization proof.
- scripts/build-auth-preview.mjs allowlists new controller, no new secret/public data exports.
- Existing assets/merchant-portal.js, CRM modules, tests, account.html and Supabase DB schema preserved so an unsafe loss of V12.2 working functionality does not occur. The legacy account.html page still includes QA/business views; it is a **follow-up migration and access review gate**. Do not claim that all account paths are now account-only until that alternate path is addressed without breaking authenticated QA flows.
- New static/role tests and Chromium mocked-auth browser test at 360/390/430/768/1280.
- .github/workflows/v134-account-boundary-qa.yml.

No Render deployment, Cloudflare/Access policy, DB migration, RLS, payment, credentials, Zalo or Orders changes.

## TODO / approval gates

1. Audit currently deployed Render branch/build and alternate account.html; ensure after implementation that all customer-facing account entries use correct boundary while tester QA remains in authorized tester area.
2. Dedicated Staff Console: server-verified TIEN404 staff identity, explicit staff role/grant, tenant support assignment, least privilege, authenticated API; not based on shop owner/manager role or frontend hidden buttons.
3. Backend subscription and payment: trusted source and payment provider-managed update/billing portal; never capture card number/CVV into TIEN404 UI.
4. User profile change: verified endpoint and audit; do not bypass Supabase account verification.
5. Hosted signed-session Shop A/B and revoked membership negative tests. Existing simulated browser QA does not prove hosted security.
6. Approved controlled Render staging release only after source/browser/regression QA and owner approval for risky policy changes.

## Rollback

Close/revert PR #73; preserve V12.5 original branch and existing Render deployment, all CRM/Order/Bot source and data. No database rollback required because no mutations were made.

Status: IMPLEMENTED as isolated source, TESTED only under CI evidence. NOT RELEASED; live Render screenshot can still show old portal.


## QA evidence (verified)

- Tested code HEAD: `870dd11d59ea2d321b48c998f7a32dd949aa05cd`.
- GitHub Actions PR run `43680554295`: `account-source` SUCCESS and `account-browser` SUCCESS.
  - Node source/legacy/account contract: 28/28 PASS; independent preview/build contracts: 13/13 PASS.
  - Chromium simulated Auth at 360/390/430/768/1280 px: 5/5 PASS; zero unexpected writes in tested flows.
  - Screenshot artifact: https://github.com/ngoctien20/demo-git/actions/runs/43680554295/artifacts/14148565870.
- Existing nav QA run `43680554271` SUCCESS.
- Private tester regression run `43680554266` SUCCESS after restoring five-minute visibility-based RLS membership recheck and preserving same-session open tab; revoked session is locked.
- Initial Chromium test failed only due case-sensitive support text assertion, corrected and rerun. Initial private tester regression detected missing 5-minute membership refresh in the new controller; fixed and retested successfully.
- All hosted Render/real Supabase current login permissions, secure payment update, dedicated staff bot authorization remain NOT VERIFIED. Browser QA used mocked Auth to avoid live customer data.

Release state remains DRAFT / EXPERIMENTAL. The user's current Render merchant-portal URL is not updated by this PR.
