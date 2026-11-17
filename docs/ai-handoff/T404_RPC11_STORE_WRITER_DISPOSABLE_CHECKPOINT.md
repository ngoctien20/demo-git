# TIEN404 RPC11 — Store Writer V2 / deterministic PostgreSQL 17 QA

**2026-11-17 JST**. Dependent on existing RPC10 6-surface experiment and RPC9 synthetic cutover. **EXPERIMENTAL, NO SEND, NO HOSTED DB CHANGE**.

## What is added

- `qa/v152-rpc11/pg17-store-writer-v2-disposable-only.sql`: two synthetic `SECURITY DEFINER` functions for Store-scoped product create / price update under a fixed search path. `FOR SHARE OF s,sm,tm` protects authorization decisions from concurrent revocation while the write transaction is in progress.
- Functions check both active Store membership and active Tenant Owner/Manager, and scope every product write by `(tenant_id,store_id)`. Invalid and stale-price requests fail closed.
- Functions grant `EXECUTE` only to synthetic restricted role, never direct table INSERT/UPDATE and never `PUBLIC`. `synthetic_actor` is an intentionally **insecure for production** test GUC; NEVER reuse this auth scheme in any real API, n8n, browser, or production.
- `ci-pg17-store-writer-v2-rehearsal.sh`: reuses RPC8 fixture + RPC9 + RPC10 PG17 six-table cutover. Positive and negative Store A/B/C tests, same-SKU cross-Store, stale-price conflict, cross-tenant, revoked Store membership and disabled Store, reject direct writes.
- GitHub Actions workflow runs isolated disposable `postgres:17`, not a Supabase service. No credentials, customer records or provider messages.

## Security boundary and release requirements

- NOT equivalent to authenticated Supabase JWT/A/B owner UAT. No actual tenant Store authority certified or signed.
- Must not run on hosted DB. Guard requires exact `t404_rpc8_ci`, PG17, `postgres`, CI GUC `RPC8_DISPOSABLE`, `qa_rpc8` schema and 6 Store read policies already installed.
- Current hosted `public.save_merchant_product` is Tenant-scoped and remains unchanged. A real Writer V2 migration requires private authenticated caller, actual `auth.uid()` verification, explicit store ownership, tenant/state checks, a least-privilege DB owner, concurrency/idempotency testing, audit log and rollback approval.
- Existing G0 Store source evidence and G1 independent full restore remain blocked; no promotion beyond CANDIDATE even if disposable CI passes.

**Deployment**: none. **Rollback**: close dependent draft PR or revert synthetic QA files only. No hosted or published workflow action.