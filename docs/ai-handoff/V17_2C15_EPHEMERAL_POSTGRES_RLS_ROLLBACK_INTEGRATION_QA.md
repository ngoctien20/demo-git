# V17.2C.15 — Verified Ephemeral PostgreSQL A/B RLS Isolation × Rollback Drill

Date: 2026-11-18 JST.
Parent: Draft PR #392, prior V17.2C.14 HEAD `869b5b72fa3fb8003faf2575f17e46d07d685b7e`.
Source code tested at commit `273aedcb8af3b49a537735ec11aa4ece3ef55cf1`.
**This test does not connect to or alter Supabase, actual Auth or real customer data.**

## Actual independent CI evidence

- Source-only contract run [44169438635](https://github.com/ngoctien20/demo-git/actions/runs/44169438635) = **completed SUCCESS**.
- Ephemeral PostgreSQL 17 integration run [44169439003](https://github.com/ngoctien20/demo-git/actions/runs/44169439003) = **completed SUCCESS**, job `disposable-postgresql-qa`. All steps reported success: initialize postgres:17 container, install PostgreSQL client, restrict target to 127.0.0.1, execute isolated SQL/rollback drill, stop container.
- CI workflow: `.github/workflows/v172c15-ephemeral-postgres-qa.yml` (triggered on Draft PR source changes). DB host is literally `127.0.0.1`, database `postgres`, with an ephemeral CI-only test password. Script refuses nonlocal host and non-test DB.
- Supporting private-free source files:
  - `qa/v172c-rpc-closure/v172c15-ci-ephemeral-postgres-bootstrap.sql`;
  - `qa/v172c-rpc-closure/v172c15-ci-synthetic-store-ab-fixture.sql`;
  - `qa/v172c-rpc-closure/v172c15-ephemeral-postgres-drill.sh`.
- Existing candidate schema and rollback SQL remained explicitly NOT EXECUTED against Supabase and were executed **only** in disposable GitHub CI PostgreSQL.

## What was truly tested

1. Create the isolated four-table QA schema under PostgreSQL 17.
2. PostgreSQL metadata admission audit returns `METADATA_REVIEW_REQUIRED_NOT_JWT_GO`.
3. Add synthetic user IDs, one synthetic Tenant, two synthetic Stores, one catalog row each and distinct memberships.
4. Using PostgreSQL `SET LOCAL ROLE authenticated` plus the synthetic CI-only `request.jwt.claim.sub` setting:
   - A reads QA-A only; B reads QA-B only.
   - A cannot read Store B's row; B cannot read Store A's row.
   - An unaffiliated identity sees zero rows.
   - Setting actor A's Store membership inactive causes A to see zero rows.
   - `anon` role SELECT is denied.
5. Attempt guarded rollback with populated QA tables: **expected failure**; schema remains.
6. Clear ONLY those synthetic ephemeral fixtures and run guarded rollback: **succeeds**; QA schema no longer exists.

## IMPORTANT limits

- This was PostgreSQL **real RLS enforcement**, but NOT a real Supabase JWT signature, real auth session or real HTTP PostgREST acceptance test. The claim was deliberately simulated locally; do NOT report 'real JWT passed'.
- No independently authenticated consenting Actor A/B receipts exist yet. Owner memberships in active staging are not evidence of their independent consent.
- Current Supabase staging has no disposable branch, zero canonical Store tables, and contains existing Commerce rows. Never run candidate migration/rollback there on the basis of this CI pass.
- CI synthetic test password is solely for the GitHub service container, not any app credential; no production secrets were accessed.
- No provider ingress, n8n, Zalo, RPC grant or customer data was modified.

## Admission and rollback

| Gate | Result |
|---|---|
| Source-only CI | VERIFIED SUCCESS |
| Ephemeral PostgreSQL 17 schema creation | TESTED PASS |
| Real PostgreSQL RLS A/B local claim emulation | TESTED PASS |
| Nonempty guarded rollback rejection | TESTED PASS |
| Empty disposable QA rollback | TESTED PASS |
| Private independent Supabase Auth A/B consent | BLOCKED |
| Authorized disposable Supabase project | BLOCKED |
| Real signed JWT/PostgREST A/B negative UAT | NOT RUN; NO-GO |
| Production Store-level security admission | NO-GO |

Release remains blocked until independent owner consent, isolated Supabase project/branch and backup/restore proof, real short-lived JWT UAT, and reviewer acceptance. No production changes occurred. Code rollback: revert PR commits or close Draft PR #392.

**Next:** V17.2C.16 — Independent Private A/B Consent Intake Operationalization × Disposable Supabase Project Authorization × Real JWT UAT Preflight.
