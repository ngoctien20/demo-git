# TIEN404 AI — V12.2 Tester Portal checkpoint after Guided QA, candidate fixtures and Admin reports

**Date:** 2026-11-14 (JST)
**Scope:** Render Auth staging + Supabase staging only; production never changed.
**State:** IMPLEMENTED + DEPLOYED + hosted public HTTP QA PASS. Real tester onboarding / invitation and signed-in E2E remain BLOCKED.
**GitHub source branch:** `work/supabase-auth-staging-v1`.
**Runtime deployed commit:** `49e2a66006048e37c7c9f55131c88c06cf7d85aa`.
**Latest source head includes test-only merge #40:** `cd23b92c2286fecb6e99bc08064b99c652ac58a0` (not redeployed; no runtime changed after last deploy).

## Confirmed deployment
- Render workspace: `My Workspace`.
- Render service: `tien404-auth-staging` / `srv-dbpj4irm8hqs73e2h2rg`.
- Deploy: `dep-dbs4suon74is738s14og`, status LIVE, finished `2026-11-14T12:05:26.791117Z`.
- Build `node scripts/build-auth-preview.mjs` succeeded, 32 allowlisted assets plus generated index/404/robots.
- Render build logs reported no SQL fixtures, .env, production Orders or internal data exports in build.
- Auto-deploy disabled, manual staging deployment only.

## Changes made and verified
1. Reused existing Tester Portal/Supabase Auth, RLS and admin view. No account auto-bootstrap.
2. Added Vietnamese guided step-by-step checklists for Messenger, Telegram, Zalo, Sheets, AI SALES, Commerce.
3. Added upload of **96 single-turn + 36 multi-turn/direct/parallel** QA definitions to `public.tien404_tester_cases` on **Supabase staging only**. All 132 new cases are `pending` and use `SQA01..SQA96` and `MQA01..MQA36`. No actual outputs or historical success grades imported. Existing five seed cases were preserved.
4. Database readback: AI SALES 134 cases (132 pending, two existing READY), Messenger 2 existing cases, Sheets 1 existing READY; 137 cases total. Module readiness: Sheets READY; Messenger, Telegram, AI Sales, Commerce PENDING; Zalo BLOCKED. A case's READY flag does not override its parent module's readiness.
5. Added read-only Tester Admin case readiness tally.
6. Added authenticated staff report export to CSV, max 500 RLS-visible reports. Each export rechecks Supabase Auth user + active `tien404_tester_staff`. CSV neutralizes formula injection and labels reports SELF-REPORTED.
7. DB QA readback: Tester staff=0, approved tester=0, assignments=0, self reports=0. No production data changed.

## QA and evidence
- GitHub Actions `43592538668` SUCCESS: hosted HTTPS of original 9 routes/assets (200) + private SQL/.env/docs (404).
- `43592970592` SUCCESS: source/Auth/RLS contract, local Chromium, new admin CSV formatter tests, hosted HTTPS.
- Website navigation regression `43592970569` SUCCESS.
- `43593212140` SUCCESS: **post-deployment** HTTPS verified 10 hosted routes, including `/tester-admin.html`, `/assets/tester-report-csv.mjs`; 3 private source paths returned 404. Anonymous Chromium desktop/mobile fail-closed passed.
- CI builds and smoke tests cannot substitute for signed-in real-user E2E. Do not mark grant/revoke/expiry or CSV download via real admin account TESTED yet.

## Production and risk gates
- No merge into `main` or `gh-pages`. No n8n workflow / Messenger or Zalo send / Telegram message / payment / real order changes.
- No elevated Tester Admin or QA Manager accounts exist in staging. This is INTENTIONAL: do not infer Super Admin identity from Merchant Owner.
- Next step: **owner must confirm exact email of existing Supabase Auth account for Tester Super Admin** (not password/OTP) before a separately approved bootstrap. There are multiple verified Auth accounts, so an ID cannot safely be guessed.
- Then perform signed-in E2E: unauthorized, approved, assigned, revoked, expired, cross-module and impersonation attempts, and export QA.
- Email invitation remains BLOCKED pending trusted server-side Auth Admin flow and user approval, plus confirmed redirect URLs and SMTP limits. Private screenshot attachment remains BLOCKED pending Storage RLS and privacy review.
- Google Sheets remains a synthetic example only, not linked to a live external source. Zalo OA and Telegram notification permissions are not established for friend testers.
- Supabase Security Advisor contains existing unrelated warnings on PUBLIC SECURITY DEFINER functions and leaked-password protection. No risky changes to those functions have been made.

## Checkpoints / rollback
- Source rollback branch before guided set: `checkpoint/render-auth-staging-pre-guided-tester-v12-2-20261114`.
- Source rollback before admin CSV deployment: `checkpoint/render-auth-staging-pre-v12-2-admin-csv-20261114`.
- Prior successful deployed commit `749886cc1c92ef71796bab46490b6febeb51fd16`, deploy `dep-dbs4h2ei0phs73c3im8g`.
- Restoring previous static deployment requires explicit manual Render rollback; do not delete new case table data or alter existing access policies.
- Every QA case remains pending until isolated, write-safe sandbox, explicit tenant boundary and QA real results are verified.

## Next acceptance
1. Confirm administrator's Supabase Auth email identity; gain explicit approval to grant `tien404_tester_staff.super_admin`.
2. Invite 1 test account via controlled staging mechanism, verify login, grant, expire, revoke, blocked states and cross-tenant isolation.
3. Enable one safe module (synthetic Sheets first) with an assigned tester, write one self-report and verify staff readback.
4. Research/implement controlled invitation service, screenshot evidence bucket and link registry through separate approvals.
5. Validate Messenger/Zalo/Telegram only with verified test destinations; never test production order actions.
