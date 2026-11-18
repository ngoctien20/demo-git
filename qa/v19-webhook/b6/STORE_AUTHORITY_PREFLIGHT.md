# TIEN404 V19.0-B6 — Verified Store Authority Preflight

**Audit date:** 2026-11-18 JST.
**Supabase project:** tien404-staging (ref ifxlvrhyjhbzbrkdsida, PostgreSQL 17).
**Method:** SELECT against information_schema and pg_catalog; no real tenant IDs, user IDs, JWTs or customer data queried.

## Verified public Commerce table shape

| Table | tenant_id | store_id | RLS enabled | FORCE RLS | anon SELECT grant | authenticated SELECT grant | Policies | RESTRICTIVE |
|---|---|---|---|---|---|---|---|---|
| conversations | YES | NO | YES | YES | NO | YES | 1 | 0 |
| customers | YES | NO | YES | YES | NO | YES | 1 | 0 |
| orders | YES | NO | YES | YES | NO | YES | 1 | 0 |
| products | YES | NO | YES | YES | NO | YES | 1 | 0 |

**Meaning:** Existing tenant/RLS protections must be preserved, but current schema cannot demonstrate row isolation by STORE. One RLS policy exists per table; this inspection does NOT claim it authorizes or leaks any particular row. No live JWT A/B queries were performed. An authenticated role SELECT grant by itself is not proof of unrestricted access, because RLS still applies.

## Absolute no-go conditions

- Missing canonical store_id on Commerce entities.
- No verified canonical tenant_id+store_id compound FK and merchant membership policy.
- No independently verified Owner A and Owner B sessions, Store RLS positive + cross-store negative test.
- No real provider installation -> trusted Store identity mapping and merchant consent.
- No successful independent authenticated gateway admission + private data policy.
- No proved subscription, role, tenant alias conflict and revocation behavior.
- No approved single source of truth for Shop/Store authority.

## Related design work

Existing V18.3.6D Store Authority design Draft PR #417 already covers canonical Stores, Store Memberships and restrictive RLS. B6 must link and inherit this design; do NOT duplicate a new authority model or apply a fresh migration without reconciling this existing candidate.

B6 source file store-authority-preflight.mjs is a read-only evaluator of observed table flags and audit evidence. It can never grant real read/write, even if its caller passes fabricated VERIFIED signals: an independent signed security approval and actual database policy tests are required.

## Remediation as future independent reviewed work

1. Reconcile V18.3.6D schema and legacy data mapping to real Commerce staging table contracts.
2. Prepare a disposable PostgreSQL 17 migration rehearsal with precise FK and RLS truth table, rollback and backup, no production customer data change.
3. Obtain merchant-approved real Owner A/B sessions; run direct authenticated Store A positive and Store B negative access, then reverse.
4. Verify provider installation ownership and server-side binding to canonical Store. Ignore client-provided Store and tenant IDs.
5. Wire only explicitly approved read-only Catalog/Cart scopes first; private Orders and write tools remain locked.
6. A separate change/release gate is required for any real Commerce write.

## Release truth

VERIFIED: schema/policy metadata and RLS flags only.
TESTED: B6 synthetic fail-closed preflight evaluator.
BLOCKED: real Store Authority, Owner A/B JWT, provider installation identity and hosted Commerce UAT.
PRODUCTION: NO-GO.
