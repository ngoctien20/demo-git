# TIEN404 V8.1 — QA evidence

## Auth staging
- Historical Auth CI run 42913004312: success, includes isolated Chromium synthetic transport; does not authenticate with Supabase.
- New negative browser test commit `5e65c5a4bc63ee618de4260f1289921af6496d92`: attempts submitting a manually unhidden password-update form without Supabase PASSWORD_RECOVERY event. Expected status: `Phiên khôi phục không hợp lệ`. Status: IMPLEMENTED_NOT_VERIFIED pending CI.
- Real staging email/password, refresh, logout, recovery and two-tenant E2E: BLOCKED pending approved isolated staging credentials and verified callback allowlist.

## Database
- Read-only inspection: eight public tables have RLS enabled, one SELECT policy each, no browser write policies. No real tenant negative test performed.

## Commerce
- Historical sandbox execution metadata: 1473, 1474, 1479 all SUCCESS; not fresh transaction E2E.

## Release gate
Do not deploy branch until CI is green and HEAD is reconciled with concurrent work. No production promotion.

## RLS role-context regression — 2026-11-11
Method: Supabase execute_sql transaction with `SET LOCAL ROLE authenticated`, `request.jwt.claim.sub` set to the relevant staging user's UID, and `ROLLBACK`. This tests PostgreSQL policy enforcement but **not** a real signed HTTP JWT or browser API.

- Shop A owner UID `9f8a880f-aaf1-4481-8d0d-f46c863964a7`: tenants 1 A / 0 B; products 1 A / 0 B; orders 1 A / 0 B. PASS simulated role-context.
- Shop B owner UID `b0b90c2c-b008-4728-9da4-f29f54c6e554`: tenants 0 A / 1 B; products 0 A / 1 B; orders 0 A / 1 B. PASS simulated role-context.
- Shop B eight public tables: tenants 1, memberships 1, products 1, orders 1, customers 0, conversations 0, messages 0, order_items 0. PASS expected accessible counts, no other tenant rows visible in populated fixtures.
- Authenticated non-member synthetic UID `00000000-0000-4000-8000-000000000000`: all eight public tables return 0. PASS simulated role-context.
- Anonymous `anon` role: SELECT on public.tenants returns permission denied (42501). PASS denied by grants, not by RLS row filter.
- User-provided mobile screenshot confirms successful hosted Shop B login, displays `TIEN404 QA Shop B` and owner membership. PASS browser visual evidence for Shop B Auth/account display; **not** complete cross-tenant HTTP negative test.
- Public policies are SELECT-only. Merchant writes are still BLOCKED/NOT IMPLEMENTED; do not loosen RLS without designed server-side authorization and transaction tests.
- No staging data modifications or production deploy in this QA.

## Merchant overview implementation — 2026-11-11
- Commit `32f5a41c8191ef845d48bf24f8c71642c995cc9c` adds read-only counts for products, orders, customers and conversations to existing account tenant cards.
- All queries explicitly filter `tenant_id` and use authenticated Supabase browser client, with server RLS as actual access boundary. Four queries use `head:true,count:'exact'` and do not return row bodies. UI clears on auth revalidation and handles error/empty counts.
- Status: IMPLEMENTED_NOT_VERIFIED. No matching GitHub workflow run was found for the new commit; do not mark browser QA PASS or deploy this branch to Render without release gate.
- Render staging still previously observed at commit `4c13ea5`; the new overview is NOT LIVE. User's screenshot confirms older live Shop B account display only.
