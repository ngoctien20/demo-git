# TIEN404 AI — V12.2 Tester Registration & Access Approval: Staging release checkpoint

Checkpoint date: 2026-11-14 (JST)
Project: TIEN404 AI
Release scope: **STAGING ONLY**; no changes to public production site, n8n production, billing, real Orders or notification sends.

## Verified live deployment
- Render workspace: My Workspace; static service: tien404-auth-staging
- Render deploy ID: `dep-dbs5jbmk1f9s738b7oc0`
- Deployed runtime commit: `061863eb65ffc0d88cdf5f5f9a9ab8d401429403`
- Render finished: `2026-11-14T12:53:10.381523Z`; `LIVE`
- Both Render `build_ended` and `deploy_ended` succeeded.
- Publish build: `34` allowlisted assets plus index/404/robots; excludes docs, SQL, private data and credentials.
- Latest source QA-only commit `9ca4029bf0e2f2f51cb100ab7717f82368a30b38` merged after deploy; no runtime change or unnecessary redeploy.

## User-visible features implemented
1. `https://tien404-auth-staging.onrender.com/tester-request.html`: new Vietnamese mobile-first request-for-access page.
2. Existing, *email-confirmed* Supabase Auth user can select desired module, add optional note (max 400 chars), and submit one application.
3. Current status visible after sign-in: pending / approved / rejected / expired. An application never grants account or module access by itself.
4. Tester Portal locked view and authenticated Account portal now link to request page.
5. `https://tien404-auth-staging.onrender.com/tester-admin.html`: active Tester staff see request queue; only an active Tester Super Admin can approve 7 days or reject. Approval checks Auth and staff again, saves existing `tien404_tester_access` and verifies readback before marking request approved.
6. Module assignment remains explicitly separate. Only the Sheets synthetic module is READY; user preference for Messenger, Telegram, Zalo, AI SALES or Commerce does not turn a channel live.

## Database change
- Supabase project `tien404-staging` ref `ifxlvrhyjhbzbrkdsida`.
- Applied additive migration `tien404_v12_2_tester_requests_staging` with `success=true`.
- Table `public.tien404_tester_requests`: RLS ON, 3 policies; unique user_id (1 request/Auth user); SELECT own or staff; user INSERT only self pending; only active super_admin UPDATE review fields; approved request status only if a valid `tien404_tester_access` grant exists.
- Column grants deny authenticated insertion of arbitrary status and updating user_id. `anon` has neither SELECT nor INSERT.
- No SECURITY DEFINER function or privilege bypass created.
- SQL preflight ran in a transaction that was rolled back.

## QA evidence
- CI (source/isolated browser) runs:
  - Tester Portal: `43596585737` SUCCESS
  - Supabase login security: `43596585770` SUCCESS
  - Website navigation regression: `43596585812` SUCCESS
- Live hosted HTTPS QA: `43597073159` SUCCESS
  - **12 routes/assets HTTP 200**, including `tester-request.html`, `assets/tester-request.js`, the updated Admin queue and existing Auth.
  - **4 sensitive private paths HTTP 404**: old Tester SQL, new migration SQL, `.env`, internal checkpoint.
- Anonymous Chromium checks at 390/768/1440 widths passed with request form hidden and no remote calls.
- Staging Postgres RLS smoke (all transactional mutations ROLLED BACK):
  - Authenticated self-request insert visible=1 during transaction.
  - Active Super Admin grant (7 days) -> request status approved visible=1/approved access=1, both rolled back.
  - Unapproved synthetic UID can read 0 requests/0 staff/0 access.
- Persisted staging counts: **1 active Tester Super Admin; 0 application requests; 0 tester grants; 0 saved Tester runs.**
- Supabase Security Advisors: no findings tied to the new request table; existing unrelated SECURITY DEFINER/auth-password warnings remain outstanding for separate review.

## Safety & limitations
- The form is an application **for an existing Supabase Auth account**, NOT public account signup.
- Friends without an invited/Auth account still require an administrator-side **manual invite** (or a future trusted server-side invitation service, with approved email/redirect/rate limits).
- Real browser signed-in request submission, approval, rejection, expiration and friend role regression still need user-in-the-loop acceptance. SQL RLS simulations and anonymous browser QA are not substitutes.
- **No email invitation was sent**, no tester account auto-created, no chat messages or real orders processed.

## Rollback / responsibility
- Source rollback branch: `checkpoint/render-auth-staging-pre-v12-2-tester-requests-20261114`.
- Previous live deploy: `dep-dbs4suon74is738s14og`, commit `49e2a66006048e37c7c9f55131c88c06cf7d85aa`.
- Restore former Render static deploy if necessary. Database migration is additive; removing the table would need an explicit separate approval, backup, and data check.

## Next recommended acceptance
- Owner signs in to Tester Admin and verifies "Đơn đăng ký quyền thử nghiệm".
- Invite one NEW dedicated staging test Auth user through Supabase Dashboard Auth > Users > Invite, or use a previously verified QA account.
- That account opens /tester-request.html, submits a Sheets request; owner reads the queue, grants 7 days, manually assigns Sheets; tester records one self report; owner checks RLS and revokes.
- Do not invite friends to LIVE Messenger/Zalo/Telegram workflows until sandbox boundaries and channel permissions have been fully verified.
