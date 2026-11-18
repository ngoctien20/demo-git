# TIEN404 V17.25R — Checkpoint (CI Pending)

**Date:** 18 Nov 2026 JST  
**Status:** `IMPLEMENTED_SOURCE_ONLY / PG17_CI_PENDING / HOSTED_NO_GO / M0_NO_GO / PRODUCTION_NO_GO`

## 1. Lineage
- Draft PR: #416 — V17.25R.
- Base: Draft PR #413 — V17.25Q branch `work/v1725q-store-aware-contract-nohost-20261118`.
- Q base workflow commit that makes the disposable PG17 workflow available to this stacked PR: `cd2b2aba12178c8dcd7c819685a551447d318841`.
- P0D fixture exact blob: `07ab80bd5f3fc7cdea9a8f17a13c4b0ae29a068c`.
- V17.25N extension exact blob: `04ba4e7f0ea2a010dff3542b6cc7a4ce18522d77`.
- Both inherited fixtures are unmodified.

## 2. V17.25R implementation
- Disposable-only SQL extension `store-schema-rls-replacement.sql`.
- CI workflow `.github/workflows/v1725r-store-rls-disposable.yml`, PostgreSQL `17.11`, fixed DB `t404_v180_p0d_ci`.
- Non-executable migration preview, RLS truth table, README and release gates.
- Synthetic Tenant Membership mirror; least-privilege Tenant × Store role intersection.
- Active/paused/archived Store behavior.
- RLS policy states: no policy default deny, legacy tenant-wide, permissive OR leak, restrictive AND fence, final Store-only replacement.
- Orders SELECT/INSERT/UPDATE/DELETE policy behavior; test-only DML grants are revoked before final grant inventory.
- Composite FK negative cases across Orders, Customers, Order Items, Products, Conversations and Messages.
- R-specific changes execute inside a transaction and end in ROLLBACK.

## 3. Current hosted baseline
Supabase staging PostgreSQL 17.11 read-only check:
- `public.stores` absent.
- `public.store_memberships` absent.
- 0 public `store_id` columns.
- Existing Commerce RLS remains Tenant-scoped.
No hosted schema, data, grants, policies, Auth, credentials or project settings were changed.

## 4. CI evidence
**PENDING.** Do not label V17.25R TESTED until the GitHub Actions run and PostgreSQL notices have been read back.

## 5. Release gates
- Disposable PG17 schema: candidate, CI pending.
- Composite FK and RLS replacement truth table: candidate, CI pending.
- M0 recovery: NO-GO.
- Real Owner A/B JWT UAT: 0/31 NOT RUN.
- Hosted Store migration/RLS cutover: NOT APPROVED.
- Production: NO-GO.

**Rollback:** close/revert Draft PR #416. CI PostgreSQL service is ephemeral; no runtime rollback required.
