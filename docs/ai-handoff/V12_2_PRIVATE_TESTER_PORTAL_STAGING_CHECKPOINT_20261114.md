# TIEN404 AI — V12.2 Private Tester Portal / STAGING CHECKPOINT
**Date:** 2026-11-14 JST  
**Scope:** Separate Tester Track of V12.2; NOT Merchant Portal V12.2, NOT Zalo Sales V12 R1.  
**Base:** `work/supabase-auth-staging-v1` (currently hosting V12.2 Merchant Portal on Render Auth staging).  
**Feature:** `work/v12-2-private-tester-portal`.  
**Status:** IMPLEMENTED source + QA schema; TESTED simulated RLS + CI; no production publication or real tester bootstrap.

## AUDIT / REUSE
- Existing Render Static Auth staging: `tien404-auth-staging.onrender.com`, service `srv-dbpj4irm8hqs73e2h2rg`. `autoDeploy=no`; build `node scripts/build-auth-preview.mjs`, publish `auth-preview-dist`. Previous live deployment before this feature: `dep-dbs2k4e1egvs73cls9og`, commit `b2c5d39add9988f35f8733967975d97c0613b952`.
- Reused: `assets/auth-client.js` Supabase Auth PKCE and project `ifxlvrhyjhbzbrkdsida`; did NOT implement separate authentication. Existing `merchant-portal.html` left intact.
- Separate Super Admin prototype exists on a different Git branch, not present in currently deployed Auth site. The Tester Admin page is a **scoped staging QA administrator view**, not the full platform Super Admin.
- n8n DEMO, Messenger Live, Telegram V4.5 and Zalo TEST08/09 are **unchanged**. The Tester Portal does not call any n8n webhook and cannot enable messaging.

## IMPLEMENTED — DATABASE
Seven isolated tables created in existing Supabase **staging** public schema, all with RLS and restrictive grants:
1. `tien404_tester_staff` — separately bootstrapped `super_admin|qa_manager` roles, nobody automatically promoted.
2. `tien404_tester_access` — approved/revoked and expiry (max 30 days via RLS policy), approval actor.
3. `tien404_tester_modules` — module readiness/guide labels; Messenger, Telegram, Zalo, Sheets, AI SALES and Commerce.
4. `tien404_tester_assignments` — per-user per-module assignments.
5. `tien404_tester_cases` — guided steps, expected behavior, fixture prompts.
6. `tien404_tester_runs` — INSERT-only tester self-reports, never verified PASS by default.
7. `tien404_tester_audit` — grant, revoke, assignment event metadata via trigger.

**SQL source/reference:** `qa/tester_portal/supabase_tester_portal_v1_candidate.sql` (executed manually on staging, not registered as automated migration). No existing Commerce tables or RLS policies changed. No real accounts invited, no tester assignments/staff bootstrapped, no reporting records committed.

RLS:
- Unauthenticated/unauthorized cannot view test modules or insert results.
- Approved & unexpired tester can read only assigned modules and cases marked READY and insert their own self-reports.
- Revoked user or expired permission fails closed.
- `super_admin` can approve, revoke, assign; `qa_manager` can read QA results only.
- Even Merchant Shop Owner has no Tester admin rights unless separately assigned to `tien404_tester_staff`.
- No public role can insert into `tien404_tester_staff`; role bootstrap requires explicit user approval and a validated Supabase Auth user ID.

## IMPLEMENTED — FRONTEND
- `tester.html` + `assets/tester-portal.js` and CSS: mobile-first tester home, module and cases, guidance, safe synthetic example data, self-reported PASS/FAIL/BLOCKED, progress and troubleshooting. Data and private views hidden until `auth.getUser()`, backend tester_access and RLS succeed.
- `tester-admin.html` + `assets/tester-admin.js`: dedicated QA admin gate, view tester access/report/audit, approve existing Auth User ID (no email invite), revoke, assign module. Backend RLS is authoritative.
- Existing `account.html` links to Tester Portal only after Auth.
- Render's strict Auth preview allowlist updated for only required tester HTML/JS/CSS. `qa/`, `docs/`, SQL migration and secrets are excluded.
- No live Messenger, Telegram, Zalo, Sheets production links until individually verified. Sender APIs are absent.
- Email invitations and screenshot uploads are explicitly disabled; storage policies/SMTP not yet approved.

## TESTED — EVIDENCE
- Supabase manual SQL, **transaction rolled back**:
  - Approved QA user with assignment sees only assigned Messenger module and two cases, cannot view staff, can insert only assigned self-result. Cross-module write rejected.
  - Revoked user with assignment sees no modules/cases and cannot insert result.
  - Privileged QA Super Admin inside temporary SQL transaction can approve tester, assign module, revoke; audit grows 1 + 1 + 1; all rolled back.
  - Cleanup readback after each transaction: **staff=0, tester_access=0, tester_runs=0, audit=0**.
- All seven new tables RLS on; no new table missing RLS; `anon` cannot INSERT runs; `authenticated` cannot INSERT staff or UPDATE self results.
- **GitHub Actions run 43583233131 SUCCESS:** 15/15 tests (source policy/Auth) + 12/12 (preview artifact) + Chromium isolated check on 390/768/1440 px and QA admin locked. Tests intentionally block all external traffic; they are NOT signed-in browser E2E.

## KNOWN GAPS / RELEASE GATES
1. **No real Tester accounts approved.** Need owner to identify the intended admin Auth account using a verified in-product procedure; do not guess identity or print sensitive identifiers.
2. **Email invitation is not enabled.** Requires approved SMTP/Auth admin invitation flow, recovery URLs and anti-abuse checks.
3. **No screenshot evidence upload.** Requires private bucket, per-tester RLS, PII redaction and signed access.
4. **No live Telegram/Zalo notifications.** Zalo Kill Switch must stay `false`; no new approval to send messages.
5. Messenger page link must be verified with test Page permissions. Telegram role is notifications, not a chatbot. Zalo Bot Platform is not equivalent to OA.
6. Module catalog contains a small **safe synthetic starter set**, not the uploaded 96/36 case suite; import only after validating source mapping and approval.
7. No signed-in real browser tester E2E or Super Admin grant E2E yet. SQL auth GUC simulations do not verify cryptographic JWT validity.
8. Screenshot uploads, QA verification separate from self-reported results, QA Manager classification, per-industry datasets and PDF/Excel reports are pending.
9. Admin grant currently uses existing Supabase Auth **user UUID**; it cannot send email invites or look up emails until approved Auth Admin server-side integration.

## ROLLBACK
- UI code remains on feature branch until vetted staging merge/deploy. Can revert the merge commit on Auth staging and redeploy manually; Render autoDeploy is OFF.
- New QA tables must not be dropped without explicit user approval and dependency audit. Safe state while unused: no admin bootstrap, no Tester access, no reports, RLS enabled.
- Preserve current Merchant Portal, Super Admin prototype, Commerce and Messenger/Zalo workflows unchanged.

## NEXT
- Browser authentication + RLS tests with a specifically approved QA Super Admin and tester account; confirm 200/403, granted, revoked, expired and wrong module.
- Integrate real invitation via trusted backend without exposing service-role key to frontend.
- Add signed/verified test channel link registry and safe QA fixture imports (including CSV) under tenant-aware permissions.
- Add evidence upload and bug triage only after separate Storage RLS review.
