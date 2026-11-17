# TIEN404 AI — V18.0-P0 Canonical Store Authority × PostgreSQL 17 Synthetic JWT A/B Negative QA

**Checkpoint: 2026-11-18 JST · SOURCE-ONLY · DISPOSABLE PG17 · NO HOSTED MIGRATION · REAL JWT NO-GO.**

## Prior validated state and ownership

- Child of [RPC17.8B Draft PR #362](https://github.com/ngoctien20/demo-git/pull/362), tested baseline HEAD `1c49fcde4b8aece2ddf0f0a3722c342e146e9787`. Preserve parent private `rpc178_qa` schema, no policies, no grants, no Supabase migration.
- Staging project `ifxlvrhyjhbzbrkdsida` directly rechecked read-only on 2026-11-18 JST: PostgreSQL **17.11**; `public.stores`, `public.store_memberships` and private `rpc178_qa` all **ABSENT**; `store_id` **0/4** on `public.products`, `public.orders`, `public.customers`, `public.order_items`.
- Prior [V17.23J PR #354](https://github.com/ngoctien20/demo-git/pull/354) preserves private four-row owner/provenance review and real JWT NO-GO. [V17.22D PR #356](https://github.com/ngoctien20/demo-git/pull/356) separately owns PG17 cross-channel consumed-OTP proof. This child does NOT modify either.
- Publisher n8n Messenger/Zalo paths remain untouched; currently Messenger demo tools still point at AI_SALES_DEMO, Zalo Core Shadow is no-send deliberate deny.

## Files and exact scope

- `qa/v180-p0-store-ab/pg17-jwt-simulated-fixture.DO_NOT_APPLY.sql` — **standalone ephemeral schema `rpc178c_ci`**, never the inherited `rpc178_qa`, public schema, auth schema or production Commerce. Five tables (tenants, stores, store_memberships, products, orders) with compound Tenant×Store foreign keys, 5/5 RLS+FORCE RLS, seven narrowly scoped PostgreSQL policies, active membership version check, role-limited read/write access. Temporary role grants only in isolated CI DB. Built-in `mock_jwt_sub()` is SECURITY INVOKER, never SECURITY DEFINER. Synthetic fixed UUID rows; no customer/PII.
- `qa/v180-p0-store-ab/pg17-store-ab-negative-tests.DO_NOT_APPLY.sql` — **12 negative/positive scenario groups** in actual disposable PostgreSQL 17. Same-Tenant Store A/B isolation, different-tenant, anonymous/unknown role rights, owner+manager authorized writes, staff read-only, unauthorized order insert/update/delete and Store-move denial, Store-scoped product FK mismatch, client forged Store/Tenant claims, missing/malformed JWT subject fail-close, disabled membership, stale authority version, inherited private candidate zero-grant integrity and test transaction rollback.
- `.github/workflows/v180-p0-store-ab-pg17-nohost.yml` — GitHub Actions service `postgres:17`, synthetic local roles only, inherited RPC17.8A candidate and ACL checks, then separate CI fixture, assertions, inherited RPC17.8A/B NO-GO release gate, no Cloudflare/Supabase/provider secrets or external sends.
- **No staging or hosted DDL. No migration created. No code intended for public Data API.**

## Critical evidence boundary — synthetic JWT is NOT actual signed JWT

The PostgreSQL session uses `SET LOCAL ROLE authenticated` and `set_config('request.jwt.claim.sub', synthetic_user_uuid, true)` to model the **effect** of a verified Supabase JWT on RLS policy evaluation. In direct PostgreSQL the claim is user-settable; this test **does not verify cryptographic JWT signatures, OAuth login, authenticated headers, recovery proofs or real Store Owner authority**. Never use `mock_jwt_sub()` or grant test roles access to `rpc178_qa` on a hosted database. All RLS policies here are evaluation candidates, not an authorized Commerce migration.

The strongest acceptance provided is that **PG17 SQL execution** correctly denies **two independently mocked authenticated identities under the same Tenant with disjoint Store memberships** plus cross-tenant escape attempts, and fails closed for revoked/stale membership and invalid claims.

## Remaining hosted admission gates (NO-GO)

1. **M0** independent staging snapshot and real restore proof; reconciliation of original Product/Order ownership, exact source provenance for Store A/B, migration hash/version and rollback.
2. **M1** canonical Store + Store Membership migration, composite FK integrity and Store ID data migration reviewed in isolated staging-compatible recovery environment, **not** just SQL fixture.
3. **M2–M4** real Supabase Auth session validation, two independently authorized owner/manager JWTs with immutable Store membership authority; no untrusted JWT store_id or user_metadata authority; full SELECT/INSERT/UPDATE/DELETE negative tests.
4. **M3–M5** privileged RPC caller reconciliation (including anon-executable `qa_shop_b_zalo_claim`), bot-to-store ownership binding, signed Meta/Zalo identity, revoke/expiry, approved safe release.
5. Do not merge/promote open Draft PRs, create paid resources, change existing production workflows, allow cross-shop reads or send provider messages on the basis of synthetic CI.

## Rollback and side effects

All new SQL is guarded with **DO_NOT_APPLY** filenames and runs solely inside a disposable GitHub Actions PostgreSQL service. Rollback of source change = close/revert this Draft PR; **no Supabase, Cloudflare, n8n or customer data rollback required**. If a future independently approved hosted migration occurs, establish its own tested inverse procedure and real staging restore proof; neither is granted here.

## Verified independent CI evidence (as of branch checkpoint 7bf70ff)

- [GitHub Push run #44172122119](https://github.com/ngoctien20/demo-git/actions/runs/44172122119): SUCCESS, disposable PostgreSQL **17.12**, all 10 substantive SQL acceptance notices including final fail-closed acceptance, inherited Node security **67/67 PASS**, zero failures.
- [GitHub Pull Request run #44172132462](https://github.com/ngoctien20/demo-git/actions/runs/44172132462): SUCCESS, same independent actual PostgreSQL acceptance and **67/67 Node PASS**.
- This provides **real disposable PostgreSQL execution**, **not** a real Supabase Auth JWT/hosted RLS test. Both CI jobs run on ephemeral GitHub services; SQL fixtures do not leave the runner.
- **Inherited CI workflow anomaly:** `.github/workflows/v152-rpc10-six-surface-nohost.yml` has a pre-existing malformed heredoc in the parent branch, creating FAIL runs with **zero jobs** (GitHub [P1 Issue #397](https://github.com/ngoctien20/demo-git/issues/397)). It has been **restored byte-for-byte** to parent blob `825ce7daeb388f9132831a3ae4dec16d3bbbd73d` in this child branch; no RPC10 ownership or behavior change is part of this PR. Do not claim that the full inherited workflow check suite is green.

**Release decision: [IMPLEMENTED SOURCE-ONLY] · [DISPOSABLE PG17 TESTED PASS] · [REAL SUPABASE JWT UAT NOT TESTED] · [P1 INHERITED RPC10 CI OPEN] · [PRODUCTION NO-GO].**
