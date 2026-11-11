# V11 — merchant product optimistic-lock HTTP 409 hotfix

**Status**: isolated branch based on Work V11 commerce PR #22. Do not merge/redeploy without QA.
**Failure**: Isolated Commerce PostgreSQL QA run 43113215829 failed. HTTP PostgREST test succeeded for initial create/edit then spent 20s on a stale edit; PostgreSQL logs were flooded with `product_changed_or_missing` errors. Source SQL used `ERRCODE='40001'` (serialization_failure), which can be automatically retried by PostgREST. The old CI log grew to tens of MB. Never infer CI PASS from the successful unit tests.

**Change**: Emit SQLSTATE `PT409` with the same safe user-facing message for optimistic version conflicts, yielding one HTTP **409 Conflict**. Keep actor check, UUID+slug QA allowlist, UPDATE row/version predicate, audit, no direct authenticated product write grants unchanged. Fix both the staging allowlisted candidate and the legacy candidate to prevent drift. Update the transaction-level SQL exception check and the signed HTTP test to require exactly 409/PT409, and run CI on this isolated branch. Add a source-contract test verifying the hotfix function body is byte-matched to the reviewed allowlist function.

**Staging database**: Source migration `merchant_product_qa_conflict_pt409_v11.sql` uses CREATE OR REPLACE. **Not yet applied** unless live migration history and post-test results say so. Review the current live function definition before applying. This SQL only affects the existing two QA tenant allowlist and requires a conscious staging permission review; it is not a general merchant CRUD API.

**Evidence**:
- Failed CI: https://github.com/ngoctien20/demo-git/actions/runs/43113215829
- Supported behavior: https://docs.postgrest.org/en/v12/references/errors.html and https://supabase.com/kb/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions-77326b
- Run the Isolated Commerce PostgreSQL QA on this branch to validate the actual HTTP conflict; use a disposable Postgres+PostgREST instance and synthetic JWTs. This is not a real customer Auth session.

**Release gates**: Real Supabase Auth user A/B signed E2E and production trials still NOT_RUN. No Messenger Publish, paid order, DNS, commercial production or gh-pages changes.
