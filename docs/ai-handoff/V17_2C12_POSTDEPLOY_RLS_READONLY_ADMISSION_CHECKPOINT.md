# V17.2C.12 — PostgreSQL RLS Admission Evidence × Source Candidate Integrity

Date: 2026-11-18 JST.
Parent: Draft PR #392, V17.2C.11 prior HEAD `609c83c48ec32c4ed9ef44af3f0f56a5d162eafa`.
Environment: Supabase staging `ifxlvrhyjhbzbrkdsida` — **read-only audit only**.

## Verified
- Previous source-only run 44152338088 completed SUCCESS. This is **not** hosted JWT proof.
- QA migration and rollback files in Draft are marked NOT EXECUTED and only applicable to a separately authorized disposable Supabase project.
- Current staging has 2 products and 2 orders and no candidate schema, canonical Store tables or Store columns.
- Added a deployed PostgreSQL **metadata-only** acceptance SQL at `qa/v172c-rpc-closure/v172c12-postdeploy-rls-readonly-audit.sql` to check:
  - all four disposable QA tables exist;
  - RLS enabled on all four;
  - two SELECT policies explicitly for authenticated;
  - Store membership user-first index;
  - composite tenant_id/store_id FKs in membership and catalog;
  - catalog SELECT denied to anon; SELECT granted to authenticated; no INSERT/UPDATE/DELETE grant.
- Exact GitHub SQL was executed read-only on current staging and returned:
```text
all_qa_tables_present=false
rls_enabled_tables=0
authenticated_select_policies=0
membership_user_indexes=0
composite_store_fk_count=0
anon_catalog_select=false
auth_catalog_select=false
auth_catalog_write_any=false
audit_decision=NO_GO_SCHEMA_OR_GRANT_INVARIANT
```
This is the **correct fail-closed result** when candidate schema is absent. It is not proof that the migration SQL has been successfully applied or PostgreSQL RLS behavior tested.
- Even when metadata invariants pass, acceptance result only `METADATA_REVIEW_REQUIRED_NOT_JWT_GO`; never automatically authorize hosted UAT.

## Consent / migration gates
No two independent A/B private consent receipts or privately verified JWT sessions. No approved disposable Supabase development branch/independent project with recovery proof. No mutation on current staging and no change to existing Zalo V2 RPC privileges.

## Change classification
VERIFIED — prior CI and staging metadata.
IMPLEMENTED — metadata-only PostgreSQL audit SQL on Draft PR.
TESTED — read-only audit run against staging returns fail-closed NO_GO.
BLOCKED — disposable schema deployment, independent owner consent, real JWT A/B UAT and security acceptance.
PROPOSED — after explicit approvals, run isolated schema, restore drill and hosted two-actor JWT RLS negative QA; snapshot negative HTTP status evidence without tokens/PII.
Rollback — revert source-only SQL/checkpoint or close Draft PR. No runtime rollback needed.

Next proposed phase: V17.2C.13 — Independent Actor A/B Private Session Evidence × Disposable Project Restore Drill × Hosted Store RLS Read-Only Admission.
