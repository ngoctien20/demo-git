# TIEN404 V17.2C.19 — Atomic A/B Pair Consent × Private Auth Admission × Disposable Supabase GO/NO-GO

Date: 2026-11-18 JST.
GitHub Draft PR #392, predecessor V17.2C.18 checkpoint commit `0b23a4f76b7b6c778a068b9d0a4e3f66069deb21`.
Code tested at `26c0f348691b5d433848f4761f0e5ca27f152f72`.
**No actual Supabase migration, customer data change, real Auth session or live JWT UAT.**

## VERIFIED / TESTED — external CI evidence
- Existing source test [run 44175349814](https://github.com/ngoctien20/demo-git/actions/runs/44175349814): completed SUCCESS.
- Ephemeral Postgres 17 [run 44175349901](https://github.com/ngoctien20/demo-git/actions/runs/44175349901): completed SUCCESS. Explicit `Atomic A/B private consent PAIR all-or-nothing PostgreSQL QA (ephemeral only)` job step SUCCESS.
- At start, Supabase connected `tien404-staging` `ifxlvrhyjhbzbrkdsida` returned **zero development branches**. No approved disposable Supabase project/branch is present.
- Previous V17.2C.18 schema and one-receipt atomic consume remained tested and were not modified on Supabase.

## IMPLEMENTED — source-only, CI PostgreSQL tested
- `qa/v172c-rpc-closure/v172c19-private-pair-consume-candidate_NOT_EXECUTED.sql` defines private **SECURITY INVOKER** function `tien404_v172c18_private.consume_pair`, takes two receipt IDs and trusted project, tenant, distinct Store A/B IDs, distinct subject A/B IDs and reviewer; locks receipt rows in consistent ID order with `FOR UPDATE`, checks complete matching `issued`/unexpired pair, and atomically sets **both** to `consumed`. If either fails it raises `PAIR_ADMISSION_DENIED` and transaction rolls back. Revokes function EXECUTE from `PUBLIC`, `anon`, `authenticated`.
- `qa/v172c-rpc-closure/v172c19-pair-consume-ci-drill.sh` uses only synthetic fixtures on ephemeral Postgres. Two connections racing for same pair prove one success and one denial. Verified both committed, replay denied; revoked peer and wrong Store produce **zero partial updates**. `anon/authenticated` cannot execute function.
- CI workflow `.github/workflows/v172c15-ephemeral-postgres-qa.yml` extended with pair test after V17.2C.18 single-receipt suite, all steps successful on pinned commit.
- **Important:** success demonstrates atomic database mechanics, not an actual consent or JWT signature. Private backend must independently authenticate both owners, validate signed receipts, active sessions, Store membership, reviewer authority and approved scope **before invoking** this trusted function.

## Security acceptance boundary
1. Only privileged private backend principal, never public RPC or Supabase service-role client. Static SQL is **not approved** for staging deployment.
2. App must use a private transactional pair-consume operation with trusted expected authority from server config, not untrusted caller arguments. SQL alone does not prove human consent. Implement signed-session verification, private receipts, refresh/revocation handling and audit before hosted release.
3. Disallow previously consumed/expired/revoked, mismatch tenant/Store/subject/scope/reviewer, duplicates; unauthorized actors do not reach consume SQL.
4. Actual Supabase real JWT/PostgREST negative UAT requires two independently consented verified Auth principals and two synthetic Stores on an explicitly approved disposable Supabase project/branch, plus cost, backup/restore and no-send authorization.
5. Existing `tien404-staging` data, production, n8n/Zalo Published and their RPC privileges remain untouched.

## GO/NO-GO table

| Gate | Result |
|---|---|
| Single receipt atomic consume/replay in PostgreSQL CI | TESTED PASS |
| Two-receipt all-or-nothing PostgreSQL CI | TESTED PASS |
| Concurrent pair replay / half-pair / revoked / Store mismatch | TESTED PASS |
| Independent actual Actor A/B signed consent and live server Auth proof | BLOCKED — not collected |
| Isolated disposable Supabase QA project/branch | BLOCKED — none verified |
| Cost and rollback approval for branch/hosted migration | BLOCKED |
| Real signed Auth JWT Store A/B PostgREST UAT | NOT AUTHORIZED / NOT RUN |
| Production Store security release | NO-GO |

Rollback of this stage: revert source-only Draft PR changes or close PR #392. Ephemeral GitHub PostgreSQL container is destroyed with CI; no Supabase rollback needed. No real users, tokens, production data, secrets or payments were touched.

## Next
V17.2C.20 — Private Auth Consent Session Intake Design × Trusted Pair Verifier × Disposable Supabase Cost/Recovery Approval. Only proceed to hosted Auth once distinct owners have independently verified and consented in protected channels and project budget has been authorized.
