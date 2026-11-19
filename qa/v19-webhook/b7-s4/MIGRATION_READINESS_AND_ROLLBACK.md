# TIEN404 V19.0-B7-S4 — Store Authority Migration Admission & Rollback

**Date:** 2026-11-19 JST
**Stage:** PROPOSED PLAN / LIVE METADATA VERIFIED / DISPOSABLE QA TESTED / NO SUPABASE MIGRATION.
**Source of truth:** V18.3.6D Draft PR #417. This report does not introduce competing Store authority.

## 1. Live non-PII baseline — VERIFIED READ ONLY

Supabase staging PostgreSQL 17, project ref ifxlvrhyjhbzbrkdsida.

| public Commerce table | Rows (aggregate) | tenant_id | store_id | FORCE RLS | restrictive policies |
|---|---:|---|---|---|---:|
| products | 2 | yes | NO | yes | 0 |
| orders | 2 | yes | NO | yes | 0 |
| customers | 0 | yes | NO | yes | 0 |
| order_items | 0 | yes | NO | yes | 0 |
| conversations | 0 | yes | NO | yes | 0 |
| messages | 0 | yes | NO | yes | 0 |

All six have one existing PERMISSIVE Tenant-scoped SELECT policy. The canonical \`public.stores\`, \`public.store_memberships\` and \`app_private.store_channel_installations\` tables are absent. \`public.conversations\` also lacks \`channel_installation_id\`.

The existing \`public.save_merchant_product\` is tenant/SKU-only, postgres-owned SECURITY DEFINER, authenticated callable, not Store-aware. \`UNIQUE(tenant_id,sku)\` remains active. There is no approved D-02 decision.

**Important:** \`products=2\` and \`orders=2\` are counts only. These records cannot be attributed to Store A, Store B or any particular owner from this snapshot. Never infer ownership based on tenant, source, SKU, channel, phone or the first Store created.

Snapshot copy: \`staging-readonly-snapshot.json\` contains only metadata, boolean guards and aggregate counts, no customer records, IDs, Auth user data or tokens.

## 2. Dependency order — do not reorder

### Phase 0 — Admission
- Verify exact current live migration head, source commit, PRIVILEGES, RLS, V1 RPC callers and runtime version.
- Obtain signed, bounded owner approval for staging DDL, audit operator and independent security reviewer.
- Confirm actual backup/PITR policy and **tested restore** for this exact project. No such evidence was available in S4.
- Resolve the Render workspace only after explicit user selection; complete service caller inventory and per-service read-only API/RPC paths.
- Set approved time window, stop/rollback conditions and cost ceiling.

### Phase 1 — Canonical authority (separate staging approval)
- Reconcile PR #417 schema and review V18.3.6D role semantics (Tenant Owner does not implicitly own Store data).
- Create Stores, Store memberships, private authority history and protected installation registry only after approved migration.
- Enforce active Store requires at least one active Store Owner in transaction; prevent last-owner revocation.
- Keep public credentials hidden and n8n DataTables sandbox-only.

### Phase 2 — Writer-compatible additive columns (separate staging approval)
- Do not apply \`CHECK(store_id IS NOT NULL) NOT VALID\` until all existing writer routes, including V1 RPC, can provide a verified Store scope or are safely disabled. Even NOT VALID constraints block future nonconforming INSERT/UPDATE.
- Add nullable \`store_id\` to all six tables, \`channel_installation_id\` to conversations, Store-qualified uniqueness and composite Tenant+Store foreign keys with appropriate indexes and validated migration strategy.
- Preserve \`UNIQUE(tenant_id,sku)\` pending approved D-02 SKU semantics.
- Add immutable Tenant+Store ownership guard and approved private backfill mechanism. Normal API updates cannot reassign Store.
- Use \`NOT VALID\`/subsequent \`VALIDATE CONSTRAINT\` only within the reviewed transaction/locking plan. PostgreSQL 17 semantics must be tested against real current schema, not only synthetic fixture.

### Phase 3 — Trusted Owner A/B + restrictive Store RLS
- After real Stores/memberships exist, verify **two distinct real signed Auth sessions** for two Stores under the **same Tenant**. Current R1 Shop A/B QA scopes are from two separate Auth Tenants; cannot substitute.
- Test Owner A self Store and Owner B self Store, cross-denials both directions, revoked/expired and Staff, NULL legacy quarantine and provider wrong-installation. No service-role bypass.
- Existing permissive Tenant policy remains bounded by new restrictive Store policy for each intended role/command; inspect \`USING\`, \`WITH CHECK\`, grants, views, SECURITY DEFINER, \`auth.uid()\` and membership helper privileges. Do not just add a permissive Store policy.
- Live authenticated evidence requires independent operator approval and redacted proof receipts.

### Phase 4 — Legacy mapping and validation
- Keep 2 Products + 2 Orders **unmapped** until exact source hashes, approved per-row or tightly scoped batch manifest, owner sign-off, independent review and dependency-order plan exist.
- Re-read source, check exact Tenant and Store, CAS update only if unchanged, quarantine unknown/conflicting entries.
- Only after all outstanding rows mapped or archived under separate approval may the constraint be validated and \`store_id NOT NULL\` considered.
- Do not alter historic row IDs or overwrite owners to make validation pass.

### Phase 5 — Read-only pilot, then separately authorized writer
- After independent security review, optionally allow bounded read-only Catalog pilot with explicit install→Store trust.
- Versioned V2 RPC must use **real Supabase Auth/session verification**, not B7-S2 forgeable GUC; review its definer owner, grants, Store membership, CAS, stock/price invariants and idempotency.
- Full caller inventory + D-02 decision + compatibility shadow test + rollback proof required before disabling old V1.
- Real Zalo webhook, provider send, order writes, billing, n8n production publish, customer data and payments remain separate gates.

## 3. Offline QA evidence

- B7-S4 Node.js readiness suite: verifies exact read-only baseline and refuses deployment even if an untrusted record fabricates all approval flags.
- B7-S4 disposable PostgreSQL17 validation test: attempts to \`VALIDATE CONSTRAINT\` with legacy NULL product/order rows, expects refusal, then probes attempted normal reassignment to Store A and expects immutable-scope denial.
- B7-S1/S2/S3 regressions: six-table composite FK/RLS, synthetic Store-aware versioned product RPC, adversarial forgeable test GUC, rollback transaction.
- All QA runs in GitHub Actions PG17 disposable container and never calls Supabase DDL.

## 4. Specific approvals still required

| Gate | Evidence required | S4 |
|---|---|---|
| Render workspace | Explicit user confirmation of My Workspace | BLOCKED |
| Full V1 caller closure | Render/private/external and runtime traffic reconciled | BLOCKED |
| D-02 SKU uniqueness | Owner business decision, migration compatibility | BLOCKED |
| Backup/PITR | Restore test receipt | BLOCKED |
| Staging DDL | Exact target/script/rollback review and owner approval | BLOCKED |
| Same-Tenant A/B real Auth | Signed sessions with no token exposure, two Stores | BLOCKED |
| Store Authority schema/RLS | Approved PR417 compatible migration and independent UAT | BLOCKED |
| Real webhook/order writer | Separate provider/order safety release gate | NO-GO |

## 5. Stop and rollback

No hosted changes occurred in S4. Code rollback is close/revert this Draft PR.

If future schema changes are separately approved, stopping must **fail closed**: disable new Store writes and read pilot, retain restrictive Store policy and audit, do not automatically drop Store columns or turn off RLS. Roll back a tested, Store-safe application version while preserving evidence; physical backfill reversal is exact-batch, CAS-based and separately approved. Never unilaterally revert to a Tenant-wide read policy to restore a broken UI.

References: PR #417, PostgreSQL 17 ALTER TABLE (https://www.postgresql.org/docs/17/sql-altertable.html), Supabase RLS (https://supabase.com/docs/guides/database/postgres/row-level-security).

**Decision:** \`B7_S4_MIGRATION_DESIGN_READY_FOR_HUMAN_REVIEW\` only; \`LIVE_STAGING_MIGRATION_NOT_APPROVED\` / \`PRODUCTION_NO_GO\`.
