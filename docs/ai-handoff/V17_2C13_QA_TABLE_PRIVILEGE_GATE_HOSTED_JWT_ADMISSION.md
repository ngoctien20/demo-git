# TIEN404 V17.2C.13 — Full QA Table Privilege Gate × Hosted JWT Admission Status

Date: 2026-11-18 JST.
Parent: Draft PR #392. Previous checkpoint HEAD `abcfeb1e6b8b4d63e86481f7db4c651aa887b647`.

## VERIFIED / TESTED
- CI of the V17.2C.12 previous HEAD finished SUCCESS at [44153681728](https://github.com/ngoctien20/demo-git/actions/runs/44153681728). It is SOURCE-ONLY.
- Supabase staging project still has no disposable development branches; has two Commerce orders and two products and no disposable QA schema. Do not write or relabel the existing Commerce rows.
- Real signed Auth A/B JWT possession and independent owner consent have not been verified, so **hosted Store A/B admission remains NO-GO**.

## Specific security improvement
The V17.2C.12 read-only PostgreSQL audit checked catalog permissions, but could have missed anomalous grants on the other QA tables or an unexpected schema USAGE grant. This is a metadata acceptance coverage gap.
- Updated `qa/v172c-rpc-closure/v172c12-postdeploy-rls-readonly-audit.sql` to verify **all QA table** anon access and authenticated table writes, authenticated schema usage/anon schema denial, and that catalog/membership SELECT policies contain Store/identity predicates.
- Added `qa/v172c-rpc-closure/v172c13-postdeploy-audit-guard.test.cjs` to the existing source-only CI set.
- Fetched actual revised SQL from GitHub and executed it SELECT-only against Supabase staging. Output includes `all_qa_tables_present=false`, `anon_accessible_tables=0`, `auth_writable_tables=0`, `audit_decision=NO_GO_SCHEMA_OR_GRANT_INVARIANT` because disposable schema is absent. This is correct fail-closed behavior, **not** real deployment validation.
- Even with all metadata correct, result is `METADATA_REVIEW_REQUIRED_NOT_JWT_GO`, never automated GO.

## Remaining GO gates
1. Two separately authenticated and consenting QA actors, independently reviewed; no PII, JWT, refresh tokens in GitHub or chat.
2. Approved disposable Supabase project/branch with documented cost, backup/restore, retention, and permission boundary. Existing staging does not qualify.
3. Isolated candidate migration SQL and reversible rollback DRILL on disposable database, not present staging.
4. Real signed A/B JWT tests through Supabase Data API/PostgREST with distinct Stores in the same synthetic Tenant, proven A->A/B->B allow and cross-store/revoked/expired/forged deny.
5. Existing Zalo V2 RPC dependency and Header Auth must remain untouched until compatibility and external caller QA is approved.

**Classification:** VERIFIED (previous CI, staging metadata), IMPLEMENTED (read-only SQL and static source test), TESTED (SQL against staging, NO-GO), BLOCKED (hosted Auth/migration/JWT), PROPOSED (isolated UAT). No Supabase writes, no credential access, no messaging and no production changes. Rollback is revert source commits or close Draft PR #392.
