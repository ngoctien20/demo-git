# TIEN404 AI — Supabase Auth V2 checkpoint

Date: 2026-11-10. Status: DRAFT PR #7, not published.

## Verified Supabase staging
- Project tien404-staging is active.
- One Supabase Auth user exists and has confirmed email.
- One valid, active owner membership exists for TIEN404 QA Shop A; tenant B remains isolated.
- Screenshot shows Site URL https://ngoctien20.github.io/demo-git/ and exact redirect URLs /login.html and /account.html.
- Database row security and tenant memberships are present; there has not yet been an authenticated end-to-end browser session test.

## Work completed in branch
- Fixed V1 login success bug: an attempted assignment to a const variable could prevent redirect after successful sign-in.
- Added sign-in UX with visible status, existing-session continuation, forgot-password request and update-password form. Password recovery returns generic responses to avoid disclosing account existence and uses the allowlisted login.html redirect. Actual recovery email flow is not yet tested.
- Updated account page to fail closed: private content remains hidden until Supabase getUser, membership and tenant lookups are verified. On any failure, hide tenant cards. New manual refresh action and logout.
- Added independently testable authorization-display helper logic. Unit tests check denial of wrong user, inactive roles, duplicate memberships and extraneous tenant rows.
- Added mobile/dark mode styles, hidden form CSS override and cache-busting.
- CI: https://github.com/ngoctien20/demo-git/actions/runs/42838594352 completed SUCCESS including syntax, static security and helper tests.

## Remaining release gates
1. No hosted staging preview exists. Browser E2E login, invalid password, session expiry, multi-tab, email recovery callback, Android dark-mode and logout are UNVERIFIED.
2. Add separate approved test user for Shop B and run real two-tenant RLS isolation tests; do not query production orders.
3. Supabase Auth security advisor warns "Leaked Password Protection Disabled." Consider enabling in Auth password settings. Details: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
4. Three informational RLS lint records concern intentionally private app_private tables; do not add public policies without authorization.
5. Confirm Render workspace before deploying a preview. No Render resources modified.
6. Align merchant login with Super Admin PR #2 and Tenant Platform PR #5; do not assume custom SQLite admin and Supabase Auth UUIDs are already integrated.
7. Do not merge to gh-pages until owner approval after E2E and security checks. The current public login remains demo.

Rollback: close the draft PR or revert feature-branch commits. No customer data, live n8n workflow or actual Supabase Auth user was mutated here.
