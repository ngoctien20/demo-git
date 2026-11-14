# TIEN404 AI V12.2 — Auth & Tab Stability (Staging Release Checkpoint)

**Date:** 2026-11-14 JST  
**Release:** Stabilize login, Account, Merchant Portal, Tester session UX under auth token refresh and browser tab switching.  
**Scope:** GitHub branch `work/supabase-auth-staging-v1`, Render `tien404-auth-staging`, Supabase `tien404-staging` READ ONLY. Production **unchanged**.

## Status
- **VERIFIED root cause**: Account and Merchant Portal called destructive revalidation on `visibilitychange` when 30 seconds elapsed, and on `TOKEN_REFRESHED`; Account reset `cards`, Merchant cleared active panel, Tester hid workspace and rebuilt. Supabase `persistSession:true,autoRefreshToken:true` already retained login; this was UI reloading, not a real session expiration.
- **IMPLEMENTED**: Existing token refresh does not trigger a destructive DB reload, 5-minute foreground revalidation interval (instead of 30 sec), and matching UID+RLS scope comparison in Account/Merchant/Tester to keep current selections/forms/scroll unchanged.
- **IMPLEMENTED**: Separate verification sequence from rendered component generation, preserving in-flight widgets and report scope; auth `SIGNED_OUT`/different `SIGNED_IN` still clears privileged UI. Same-tab logout then login again is supported without forced page reload.
- **SECURITY**: The client still calls Supabase `auth.getUser()` and reads RLS-backed memberships/Tester grants; server RLS still gates every tenant request and Tester report. On UID change, denied/expired grant, or failed authorization, protected content is hidden. A refresh-token event alone is not proof of role revocation.
- **NOT CHANGED**: Tester Admin UI/grant controls, Supabase SQL/RLS, credentials, n8n workflows, webhook sends, Orders, customer records, billing, Render production/gh-pages. Tester Admin had no repeating visibility-based destructive refresh listener; its initial auth check still runs on actual page load.

## Build & verification evidence
- Feature PR #48 merged, source/runtime commit: `865b08180c6da307d9f728e78cb2842c548211a9`.
- Staging Render deploy: `dep-dbs6sojbc2fs73ao4sbg`, LIVE, completed `2026-11-14T14:21:29.624595Z`.
- Auth/PKCE/security QA: GitHub Actions `43604276660` SUCCESS, 25 source tests + 15 build tests + Chromium Auth flow (login, account switch, logout, role gate, reports).
- Tester + Account + Merchant QA: `43604276676` SUCCESS, 39 source tests + 18 build tests, Chromium:
  - routine `TOKEN_REFRESHED` and short tab return preserve DOM and unsent tester feedback,
  - same rights after 5 minutes preserve Account/Merchant content,
  - revoked membership/tester grant results in lock,
  - three quick tester scenarios and advanced QA remain operational,
  - anonymous access still fail-closed.
- Post-deploy HTTPS acceptance QA-only PR #49 merged, Actions `43604768097` SUCCESS:
  - 15 public routes/assets return HTTP 200 including deployed Auth Account, Merchant and Tester JS;
  - 4 private paths (SQL, .env, internal docs) not publicly served (HTTP 404);
  - Chromium tab stability and role revocation mock PASS.
- Database read-only verification after deploy: 1 active Tester Super Admin; 1 approved Tester; 1 active Sheets assignment; 15 READY Sheets cases; **1 self-reported Tester run** persisted, last timestamp `2026-11-14 13:58:15.845696+00` (external actual action; not invented, and not verified automated QA PASS).
- QA-only merge after deploy: `05ad4563c18ff9f7e574a02c7b5f94343a438a0c`. Test-only source change, no need to redeploy application runtime.

## Manual acceptance and caveats
1. Open https://tien404-auth-staging.onrender.com/login.html and sign in privately.
2. On https://tien404-auth-staging.onrender.com/account.html or https://tien404-auth-staging.onrender.com/merchant-portal.html select a shop or an open panel; switch to another browser tab and back. Returning within 5 minutes should not rebuild panels.
3. Open https://tien404-auth-staging.onrender.com/tester.html, select a scenario, type unsent feedback, switch tabs/back, verify input remains.
4. Confirm `TOKEN_REFRESHED` in mock CI does not trigger reset; login/logout and changed account still authorize correctly.
5. A full navigation from `login.html` to `account.html` to `tester-admin.html` loads a NEW HTML document as this static site is currently multi-page; initial auth validation once per NEW page remains required. The patch does not convert it into an SPA.
6. Explicit role revocation and expired grant must fail closed on next verification; admin actions re-check required authorization. RLS server is final authority. Do not cache elevated permissions in a browser to avoid validation.
7. Real signed-in multi-browser/tab UX with the project owner should still be manually accepted. Automated tests use local Auth stubs, not the owner's real password or session.

## Rollback
- Source rollback branch `checkpoint/v12-2-before-auth-stability-20261114`.
- Prior Render app commit `10fdf7108ada585dcca8a4f231b230613aa5c6e9`, prior successful deploy `dep-dbs6fck9v7es73bqvb30`.
- Roll back only static Render staging release if critical UX issue occurs; no database migration to undo.
