# TIEN404 V17.25R — Disposable PostgreSQL 17 Store Schema × Composite FK × RLS Replacement

**Classification:** SOURCE-ONLY / DISPOSABLE PG17 / SYNTHETIC AUTH / NO HOSTED DDL-DML / M0 NO-GO / PRODUCTION NO-GO.

## 1. Lineage — reuse, do not rebuild

This is a stacked Draft candidate based on V17.25Q branch `work/v1725q-store-aware-contract-nohost-20261118`, checkpoint head `203789573c0ee9a61d82282999623edac397124e`.

It reuses these exact, unmodified fixtures:
- V18.0-P0D `qa/v180-p0d/store-scoped-rls-disposable.sql`, blob `07ab80bd5f3fc7cdea9a8f17a13c4b0ae29a068c`.
- V17.25N `qa/v1725n/rls-cutover-disposable.sql`, blob `04ba4e7f0ea2a010dff3542b6cc7a4ce18522d77`.

P0D creates the isolated Store schema with 9 FORCE-RLS tables, composite foreign keys and the existing synthetic Owner A/B, dual-owner, Staff, cross-Tenant, membership-revocation and Store-suspension cases. V17.25N proves the permissive OR leak and restrictive AND fence. V17.25R adds Tenant × Store role intersection, Store lifecycle, policy replacement truth table and command-level authorization.

Neither P0D nor V17.25N source is modified by this PR.

## 2. Actual hosted baseline — read-only

Supabase staging project `ifxlvrhyjhbzbrkdsida`, PostgreSQL 17.11:
- `public.stores`: absent.
- `public.store_memberships`: absent.
- public `store_id` columns: 0.
- Existing `public.tenant_memberships` contains Tenant role and active state.
- Existing Products, Orders, Order Items, Customers, Conversations and Messages are tenant-scoped and have no Store scope.
- Existing relevant RLS is enabled but current policies remain Tenant-scoped.

No hosted schema, data, policy, grant, Auth, credential or project setting is changed.

## 3. V17.25R disposable extension

`store-schema-rls-replacement.sql`:
- Requires exact database `t404_v180_p0d_ci`, `current_user=postgres`, PostgreSQL >=17, the P0D helper functions and the V17.25N restrictive policy.
- Creates a synthetic `shop_qa.tenant_memberships` mirror. It does not create or alter `public.tenant_memberships`.
- Calculates effective role as the least privileged of active Tenant role and active Store role.
- Adds `active / paused / archived` Store status. Paused allows reads but denies writes; archived is hidden from normal Store reads.
- Replaces Tenant-only policies on Products and Orders and replaces the remaining P0D Store-only policies with the effective Tenant × Store policy model.
- Uses SECURITY INVOKER helpers with pinned empty search_path; no SECURITY DEFINER helper and no user_metadata authorization.
- Enforces both USING and WITH CHECK for UPDATE; immutable scope/creator trigger prevents an authorized dual-Store actor from moving an existing row.
- Tests SELECT/INSERT/UPDATE/DELETE semantics. The script grants Orders DML to the synthetic authenticated role only while testing, then revokes INSERT/UPDATE/DELETE before the final grant inventory. Direct browser Order writes are not approved.
- Tests same-Store composite foreign keys and Store-scoped SKU uniqueness.
- Runs all V17.25R DDL and fixture changes inside one transaction and ends with ROLLBACK. P0D and V17.25N are replayed beforehand in the disposable database.

## 4. Policy replacement truth table

For an Owner A query over the same Tenant's A, B, paused D and archived E Orders:

| Policy state | Visible rows | Result |
|---|---:|---|
| No applicable policy | 0 | Default deny |
| Legacy Tenant-only permissive | 4 | Unsafe: A/B/D/E visible |
| Legacy + new Store permissive | 4 | Unsafe: permissive OR keeps legacy access |
| Legacy + restrictive Store fence | 2 | AND fence limits access to A + paused D |
| Old policy removed; Store policy only | 2 | Desired replacement result |

The restrictive policy is demonstrated as a transitional safety fence, not the final design. Final state has one Store-scoped permissive policy for each permitted command and no legacy Tenant-only policy. Replace policies in one controlled transaction in any future migration.

## 5. Effective role matrix

| Tenant role | Store role | Effective role |
|---|---|---|
| owner | owner | owner |
| owner | manager | manager |
| owner | staff | staff |
| manager | owner | manager |
| staff | owner | staff |
| staff | staff | staff |

Tenant Owner does not implicitly inherit a Store without explicit active Store membership.

## 6. Intended authorization and grants

- Products: SELECT for Owner/Manager/Staff; INSERT/UPDATE for Owner/Manager only; no DELETE.
- Orders: SELECT for Owner/Manager; create intent may be submitted by Owner/Manager/Staff through the server contract; UPDATE for Owner/Manager; no DELETE (cancel via status transition).
- Customers, Order Items, Conversations, Messages, Channel Installations: read for Owner/Manager only.
- Stores, Tenant Memberships and Store Memberships: no client-side writes.
- `anon`: no grants.
- Direct Orders INSERT/UPDATE/DELETE grants are absent from final test inventory. A future backend must verify trusted Store authority itself if it uses a bypass-RLS service credential; this suite does not claim service_role isolation.

## 7. Composite FK coverage

The inherited P0D schema and R suite verify:
- Order → Customer uses `(tenant_id, store_id, customer_id)`.
- Order Item → Order uses `(tenant_id, store_id, order_id)`.
- Order Item → Product uses `(tenant_id, store_id, product_id)`.
- Message → Conversation uses `(tenant_id, store_id, conversation_id)`.
- Store Membership → Store uses `(tenant_id, store_id)`.
- Product SKU uniqueness is scoped to `(tenant_id, store_id, sku)`; the same SKU can exist in A and B but not twice in A.

Foreign keys protect referential integrity; they do not replace RLS. PostgreSQL referential-integrity checks can bypass row security, so avoid exposing detailed FK errors as an object-existence oracle.

## 8. CI

Workflow `.github/workflows/v1725r-store-rls-disposable.yml` uses:
- GitHub-hosted `ubuntu-24.04`.
- Disposable `postgres:17.11` service with fixed synthetic database name.
- Pinned checkout action SHA.
- Exact P0D and V17.25N fixture blob hashes.
- P0D → V17.25N → V17.25R execution order.
- No hosted Supabase/Render/n8n credentials, real JWT, customer rows, provider sends or external endpoints.

The inherited P/Q/R workflow is stored in the Q base branch and includes a conditional PostgreSQL job for `work/v1725r-*` branches. CI result is recorded in `V17_25R_CHECKPOINT.md` after the run. Until then the suite is PENDING CI.

## 9. Release gates

- `DISPOSABLE_PG17_SCHEMA`: candidate; CI pending.
- `RLS_POLICY_REPLACEMENT`: candidate; CI pending.
- `COMPOSITE_FK_TRUTH_TABLE`: candidate; CI pending.
- `SUPABASE_HOSTED_SCHEMA`: unchanged / not approved.
- `M0_RECOVERY`: NO-GO.
- `REAL_OWNER_A_B_JWT_UAT`: 0/31 NOT RUN.
- `PRODUCTION`: NO-GO.

**Rollback:** close/revert this source-only Draft PR. CI database is ephemeral. No runtime rollback is required.
