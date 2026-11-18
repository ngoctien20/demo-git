# TIEN404 AI — V17.2C.30 Commerce Orders A/B × Ephemeral PostgreSQL RLS Regression

Date: 2026-11-18 JST.
Base checkpoint: V17.2C.29 commit `2b2d4f312c8f8fea39211b19379e62deb9854f1f`.
PR: #392 (Draft). User selected Option A — continue isolated QA without Supabase subscription upgrade, added branch charges, or changes to real customer data.

## Scope and provenance
VERIFIED starting point: PR #392 OPEN DRAFT; V17.2C.29 prior three CI workflows SUCCESS; Supabase `tien404-staging` had zero development branches.
Read prior QA script `v172c15-ephemeral-postgres-drill.sh`, existing reusable roles `anon/authenticated`, private `auth.uid()` signed-claim emulation, catalog RLS candidate and fixtures.
**Gap found:** prior ephemeral PostgreSQL suite tested catalog A/B access and atomic private consent, but did not independently exercise order read/status UPDATE RLS across same-tenant and cross-tenant stores.

## Implemented and QA tested
- `qa/v172c-rpc-closure/v172c30-ephemeral-orders-rls-fixture.sql`: CI-only Postgres 17 schema with synthetic orders `SYN-ORDER-A`, `SYN-ORDER-B` in the same tenant and `SYN-ORDER-C` in another tenant. Active owner A/B/C membership; viewer V for Store B. Enforced RLS on orders and memberships, exact tenant/store/actor matching, only own active membership read, owner-only status UPDATE WITH CHECK, restricted UPDATE(status) grant. No real commerce schema/data.
- `qa/v172c-rpc-closure/v172c30-ephemeral-orders-rls-drill.sh`: refuses any non-`127.0.0.1`/non-`postgres` database, exercises actor synthetic claim under `SET LOCAL ROLE authenticated` with each mutation wrapped in `BEGIN...ROLLBACK`; checks A/B self-read and own status update, same-tenant cross-Store denial, cross-tenant C denial, viewer read but no write, unknown actor denial, forbidden total_vnd / store_id mutation, anonymous denial, membership revocation immediate denial and DB still has exactly three pending rows after test updates.
- `.github/workflows/v172c15-ephemeral-postgres-qa.yml` includes new job step after existing catalog/consent tests.

## VERIFIED CI at source SHA `581b52ac464af0057564628fea16e61f60b7be7d`
- PostgreSQL 17 ephemeral integration `44233707215`: SUCCESS, including **Orders A/B same-tenant and cross-tenant read/write RLS rollback QA (ephemeral only)** step.
- Protected Consent / Store-read contract `44233707185`: SUCCESS.
- Source Privilege Negative Contract `44233707188`: SUCCESS.
- All tests are isolated CI; PostgreSQL service is discarded. No branch paid services or hosted JWT.

## Critical limitations
- The RLS schema and orders are **synthetic contract candidates** rather than the real Commerce Core Orders table/policies; passing does not prove production Store isolation or actual n8n Order flows.
- auth.uid() in CI uses emulated JWT sub GUC; NO actual Supabase token signature, Auth A/B login, consent or session revocation was verified.
- No actual Messenger order placement or Zalo cross-channel retrieval; no real send or customer data touched.
- An owner status update passed inside a transaction that is explicitly rolled back; no lasting order changes.
- Hosted UAT and production remain NO-GO. Reviewer independence and private A/B consent remain unverified. No Pro upgrade or Supabase branch created.

## Status
VERIFIED: all three CI SUCCESS and existing staging unchanged.
IMPLEMENTED: orders RLS synthetic fixture, negative drill and GitHub CI step.
TESTED: same-tenant cross-Store, cross-tenant, write restrictions, rollback all PASS in ephemeral Postgres 17.
BLOCKED: real Supabase Auth A/B, independent human consent, approved hosted HTTPS/disposable environment.
PROPOSED NEXT: audit real Commerce Orders authorization contract read-only to map which tests can transfer to actual schema without touching customer data, then gated private Auth UAT only after explicit approval.

## Rollback
Revert V17.2C.30 SQL, drill and workflow changes on Draft PR #392. No production, connected Supabase, billing, credential, n8n, Messenger, Zalo or customer rows were changed.
