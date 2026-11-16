# V16.10 Disposable PostgreSQL 17 Security/Recovery QA

**Not a hosted Supabase migration, not a genuine Supabase Auth JWT test, and not a real merchant backup.**

This folder runs only from GitHub Actions in repo `ngoctien20/demo-git` against the `postgres:17` service listening through local loopback. It refuses any other `PGHOST`, requires an explicit synthetic QA flag and aborts rather than reusing or dropping pre-existing databases.

The `qa_auth.uid()` function is a local fake `request.jwt.claim.sub` claim reader, not a cryptographic verifier. The checks use `SET LOCAL ROLE t404_authenticated` with `NOBYPASSRLS` to exercise actual PostgreSQL RLS behavior. Two same-Tenant stores share SKU `SAME01` with different prices; cross-Store product/order/customer reads and writes must be denied.

The synthetic backup drill uses `pg_dump -Fc` and `pg_restore`, SHA-256 and post-restore RLS assertions. Its dump is **not encrypted**, contains only fake Shop IDs, stays on the disposable runner, and is not evidence that a Supabase hosted backup or independent operator recovery has succeeded.

Do not run manually against another database. No migration SQL in this folder may be copied to hosted Supabase; it is fixture-only and intentionally lacks real auth, real schema migration and real Page/OA authority checks.

The private operator evidence manifest lives under `docs/ai-handoff/V16_10_PRIVATE_OPERATOR_AUTHORITY_EVIDENCE_MANIFEST.json`; all real proof flags are `MISSING` and pilot release remains `NO_GO`.
