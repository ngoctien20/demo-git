# TIEN404 V17.6-B.3 — Private Store Authority × Disposable PG17 Store RLS × Real JWT No-Send Gate

**Status:** CANDIDATE / SOURCE_QA / DISPOSABLE_ONLY. **PRODUCTION_NO_GO.**

This change is built on the existing B.2 branch and does not modify V17.6-B.2 source, V17.6-B.1 adapter, V17.1L Core policy or any live service.

## Deliverables

- disposable_pg17_store_rls.sql: one-transaction **PostgreSQL 17** role + RLS test with two *different Stores under one synthetic Tenant*, a separate Tenant, revoked staff and unknown user. Tests both Products and Orders, forged user_metadata, no Auth principal, cross-Store and cross-Tenant negative reads, no INSERT/UPDATE/DELETE privileges, attempted write denial, and rollback. Auth uid() is an emulated local PostgreSQL function, NOT real verified Supabase Auth.
- ci-disposable-pg17.sh: fails closed unless running on CI with explicit sentinel, localhost, exact disposable database name, postgres test principal and PG17. No ability to point at the actual Supabase database.
- HOSTED_JWT_READINESS_SNAPSHOT.json and hosted-jwt-admission.test.cjs: aggregate **read-only** staging metadata and 11 test assertions, all maintaining real JWT/hosted release BLOCKED.
- PRIVATE_HOSTED_JWT_ADMISSION.md: confidential Merchant/Staff identity, verified Store A/B authority, privately held JWT/session and independent no-send acceptance requirements. Never put real tokens, customer rows or Merchant proof into GitHub.
- .github/workflows/v176b3-private-store-rls-nosend.yml: three constrained jobs; inherited B.1/B.2 regression, disposable PG17, explicit hosted JWT NO-GO.

## How to interpret results

Postgres CI can prove **RLS design** works on a throwaway synthetic database with fake JWT-claim sub injection and a disposable authenticated role. It cannot prove:
- possession/validity/refresh/revocation of JWT signed by the actual Supabase Auth service;
- production Store membership/ownership/registry, or Store-based RLS on the current public Commerce schema;
- customer-owned Orders/Stock isolation in hosted Commerce;
- provider signed Page/OA binding or real Messenger/Zalo no-send;
- network-level no egress, any model red-team success or production readiness.

The hosted audit found zero current same-Tenant two-Store mappings in QA identity map, and no store_id on legacy public Commerce tables. Existing auth user/session counts are aggregate metadata, not a trusted owner attestation.

## Execute

GitHub Actions automatically runs on B.3 Draft PR. For PostgreSQL testing, do **not** run against any existing database. The approved runner must supply CI sentinel and exact localhost disposable DB; full instructions in shell script.

## Evidence / release gates

- B.1 31 source-policy cases and B.2 95 Query Guard cases must remain PASS.
- 11 B.3 admission metadata checks must remain PASS.
- PG17 must show RLS A-to-A and B-to-B, deny A-to-B/B-to-A, deny cross-Tenant and inactive staff, reject forged metadata, deny writes and roll back all objects.
- All real JWT / private Merchant / live Meta/Zalo / hosted Store isolation gates G01–G09 remain OPEN.
- **Approval required** for any hosted schema/RLS/credential/Owner-data change, live real JWT UAT and production promotion.

## Rollback

Close B.3 Draft PR without merging, no service rollback required. All SQL runs only in GitHub disposable Postgres and within ROLLBACK. No hosted migrations, API changes, production deployment, customer data or billed AI model calls.
