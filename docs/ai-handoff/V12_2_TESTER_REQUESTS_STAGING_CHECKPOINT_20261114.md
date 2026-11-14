# TIEN404 AI V12.2 — Tester Access Request & Approval Checkpoint (2026-11-14)

Scope: **Supabase staging** `tien404-staging` + **Render Auth staging** only. No changes to `main`, `gh-pages`, production messaging, customer orders, notifications, or credentials.

## Why
Existing Tester Portal and Tester Admin supported RLS-based access grants only by existing Supabase Auth UUID; there was no self-service **request-for-permission** queue. This version creates one, without opening public Auth signup.

## Implemented
- `tester-request.html` + `assets/tester-request.js`: Vietnamese mobile-first request form for **existing confirmed Supabase Auth accounts**; request only, no auto-grant; one request per Auth user; current status readback (pending/approved/rejected/expired).
- Existing `tester.html` locked view and `account.html` link to this form.
- `tester-admin.html` + `assets/tester-admin.js`: queue visible to active QA staff; only active `super_admin` can approve/reject; 7-day grant must read back from `tien404_tester_access` before marking request approved; module assignment remains a second manual step and not enabled for pending channels.
- `public.tien404_tester_requests` created by Supabase migration `tien404_v12_2_tester_requests_staging`; strict RLS, column-level INSERT/UPDATE permissions and unique `user_id`. No anonymous privilege or SECURITY DEFINER functions.
- Strict Render preview allowlist explicitly includes request page and JS but excludes private SQL and documentation.
- Existing Super Admin and all current roles kept unchanged. No invited user or email sent.

## Verification
- Supabase DDL dry-run in rollback: one table with RLS and 3 policies.
- Actual Supabase migration: `success: true`; readback RLS=true, policy_count=3, anon SELECT/INSERT=false; authenticated INSERT(status)=false; authenticated UPDATE(user_id)=false.
- Authenticated owner-context RLS transaction (fully rolled back): request self-insert visible=1.
- Full admin transaction (fully rolled back): self-request -> 7-day approved tester access -> approved request readback, 1+1; no data persisted.
- Unauthorized authenticated UID without grant sees 0 requests / 0 staff / 0 access.
- Current persisted staging counts after rollback: staff=1, requests=0, approved tester access=0, runs=0.
- Supabase Security Advisors show no new finding against `tien404_tester_requests`; unrelated legacy warnings remain.
- GitHub Actions on feature commit: `43596585737` Private Tester Portal QA SUCCESS, `43596585770` Supabase staging login security SUCCESS, `43596585812` website navigation regression SUCCESS.
- **Real signed-in end-to-end web UX with a separate friend tester and actual approval/revocation is still PENDING.** Source/local CI and simulated DB RLS are not substitutes.

## Operational notes
- Invite-only by design. Friends without a Supabase Auth account **cannot** yet request online; they need a verified manual invitation through Supabase Auth Dashboard or future trusted server-side invite endpoint.
- User-submitted desired modules can include unavailable channels as interest only; granting access never turns a channel live. Only the separately verified `sheets` module is presently READY with synthetic fixtures.
- The new request form never calls Messenger, Zalo, Telegram or Commerce workflows.
- Rollback source: `checkpoint/render-auth-staging-pre-v12-2-tester-requests-20261114`.
- Database rollback (if separately approved): review dependencies and remove only the additive request table; never drop shared Auth tables or staff privileges.
