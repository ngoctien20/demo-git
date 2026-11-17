# V17.2C.14 — Fail-Closed Disposable Rollback Safety Gate

Date: 2026-11-18 JST.
Parent: Draft PR #392, previous V17.2C.13 HEAD `7a9a0b2e636f1d169a5090b139504a60476c3e8f`.

## Verified
- GitHub source-only CI [run 44166812120](https://github.com/ngoctien20/demo-git/actions/runs/44166812120) concluded SUCCESS for V17.2C.13.
- Supabase `ifxlvrhyjhbzbrkdsida` returned zero disposable development branches. Previous staging verification had no candidate QA schema, two existing products, two existing orders.
- No independent private consent receipts for both Owner A and Owner B were supplied; a Tenant membership and historical session rows are **not** consent or a current JWT signature.

## Concrete safety defect and remediation
Before this checkpoint, the rollback candidate checked only table inventory and external relation dependencies. It would run `DROP TABLE` on nonempty QA tables, destroying synthetic fixture data and audit evidence if executed without a data disposal review. This is too permissive for a safe routine rollback.

**Fixed on Draft source only:** `qa/v172c-rpc-closure/v172c10_disposable_rollback_candidate_NOT_EXECUTED.sql` now fails BEFORE any DROP when any of the four isolated QA tables has rows: `qa_catalog`, `qa_store_memberships`, `qa_stores`, `qa_tenants`. This forces a separately approved private backup/data disposal procedure, which is **not** part of this rollback SQL. Existing checks for exactly four tables, external dependencies, `DROP SCHEMA RESTRICT` and no CASCADE remain.
- Updated `qa/v172c-rpc-closure/v172c10-schema-rollback-source.test.cjs` to require the four nonempty-guard checks and explicit failure message.
- New exact-head CI outcome must be verified before claiming PASS. Source assertions are not a real database restore drill.

## Next actual authority gate
Instead of promoting source tests as real UAT:
1. Privately authenticate QA actor A and QA actor B independently, both consenting to synthetic Store A/B test scope. Never paste JWT, emails, passwords or private receipts into chat or GitHub.
2. Independently authorize an isolated disposable Supabase project/branch with cost, retention, disaster recovery proof and restore/drill plan.
3. Run the candidate schema and inspect actual Postgres RLS/role metadata; seed synthetic A/B only after separate explicit approval.
4. Run actual read-only PostgREST JWT A/B allow/deny and negative revocation tests. Only then consider a GO for Store security.

## Release and rollback
- VERIFIED: preceding source CI.
- IMPLEMENTED: rollback fail-closed source patch and source-only test.
- TESTED: pending CI for this HEAD; **not** database execution.
- BLOCKED: private independently consented sessions, disposable Supabase and real JWT.
- No runtime change: no DDL, no Supabase Auth update, no Zalo/Messenger send, no credential edits, no data loss.
- Code rollback: revert these two file patches or close Draft PR #392. Deployment/hosted UAT remains **NO-GO**.
