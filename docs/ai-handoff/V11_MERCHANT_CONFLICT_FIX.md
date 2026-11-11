# V11 — merchant product optimistic-lock HTTP 409 hotfix

**Status**: isolated branch based on Work V11 commerce PR #22. Do not merge/redeploy without QA.
**Failure**: Isolated Commerce PostgreSQL QA run 43113215829 failed. HTTP PostgREST test succeeded for initial create/edit then spent 20s on a stale edit; PostgreSQL logs were flooded with `product_changed_or_missing` errors. Source SQL used `ERRCODE='40001'` (serialization_failure), which can be automatically retried by PostgREST. The old CI log grew to tens of MB. Never infer CI PASS from the successful unit tests.

**Change**: Emit SQLSTATE `PT409` with the same safe user-facing message for optimistic version conflicts, yielding one HTTP **409 Conflict**. Keep actor check, UUID+slug QA allowlist, UPDATE row/version predicate, audit, no direct authenticated product write grants unchanged. Fix both the staging allowlisted candidate and the legacy candidate to prevent drift. Update the transaction-level SQL exception check and the signed HTTP test to require exactly 409/PT409, and run CI on this isolated branch. Add a source-contract test verifying the hotfix function body is byte-matched to the reviewed allowlist function.

**Staging database**: Source migration `merchant_product_qa_conflict_pt409_v11.sql` uses CREATE OR REPLACE; **applied and verified** on the existing staging project on 12/11/2026 JST (details below). Review the current live function definition before applying. This SQL only affects the existing two QA tenant allowlist and requires a conscious staging permission review; it is not a general merchant CRUD API.

**Evidence**:
- Failed CI: https://github.com/ngoctien20/demo-git/actions/runs/43113215829
- Supported behavior: https://docs.postgrest.org/en/v12/references/errors.html and https://supabase.com/kb/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions-77326b
- Run the Isolated Commerce PostgreSQL QA on this branch to validate the actual HTTP conflict; use a disposable Postgres+PostgREST instance and synthetic JWTs. This is not a real customer Auth session.

**Release gates**: Real Supabase Auth user A/B signed E2E and production trials still NOT_RUN. No Messenger Publish, paid order, DNS, commercial production or gh-pages changes.


## Verified staging outcome — 2026-11-12 JST

- Disposed CI Postgres + PostgREST signed-JWT A/B suite **SUCCESS** [Commerce run 43114961344](https://github.com/ngoctien20/demo-git/actions/runs/43114961344). Log contains two terminal `POST rpc/save_merchant_product 409 PT409`, no 20s retry storm. Data Platform QA [43114961157](https://github.com/ngoctien20/demo-git/actions/runs/43114961157) SUCCESS.
- **Applied** Supabase project `ifxlvrhyjhbzbrkdsida` migration `20261111225128 v11_qa_merchant_product_stale_conflict_pt409`, and verified active function definition contains PT409 (not the retryable branch).
- **Direct real staging PostgreSQL test** inside BEGIN/ROLLBACK with an owner on QA Shop A: create, update, reject stale edit with SQLSTATE PT409, deny foreign QA Shop B with 42501; owner/manager-only allowlist preserved. Source data after ROLLBACK: 2 products, 2 orders, 2 tenants and zero retained QA rows/audits.
- `anon` cannot EXECUTE the function; `authenticated` still cannot UPDATE the underlying products table directly. Supabase Advisor still flags the intentional SECURITY DEFINER function for separate security review.
- **No Render redeploy**, no Product Editor activation, no live customer operation, no domain/DNS and no production merge. Work parent PR #22 still shows old failed runs; integrate this stacked fix before relying on its CI.
