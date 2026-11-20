# TIEN404 V19.8.16 — Canonical Store migration **PREVIEW / DO NOT APPLY**

**Read-only hosted snapshot:** 2026-11-20, staging project `ifxlvrhyjhbzbrkdsida`. All six Commerce tables have `tenant_id` but no `store_id`. `public.tenant_memberships` has no Store membership. This is NOT a deployable migration: deliberately no executable .sql, no DDL in GitHub Actions. Prior branches RPC17.5–17.8 and V18.6 must be reconciled to avoid duplicate schemas.

## Phased migration proposal

**Gate M0 (mandatory)**: Independently verified backup origin/timestamp, digest and retention; restore/readback on isolated Postgres; approve explicit rollback plan; full writers/readers across published n8n, Render, Cloudflare and Supabase Edge callers; confirm legacy Google Sheets remains separate. STOP on missing inventory.

**Phase A — additive, no existing Commerce row rewrite:** create `public.stores(id uuid PK,tenant_id uuid NOT NULL REFERENCES public.tenants(id), store_key text NOT NULL, active boolean, created_at timestamptz, UNIQUE(tenant_id,id), UNIQUE(tenant_id,store_key))`; create `public.store_memberships(tenant_id,store_id,user_id,role,active)` with composite FK to stores and user FK to `auth.users`, owner/manager/staff role, uniqueness `(tenant_id,store_id,user_id)`, RLS ENABLE + FORCE and least-privilege policies. Ownership must be reviewed against independent real Owner A/B evidence; **do not derive Store from current tenant membership**. Public grants should be deny-by-default until policy review.

**Phase B — staged lineage:** add nullable `store_id uuid` to `products, customers, orders, order_items, conversations, messages`. Add `(tenant_id,store_id)` FKs to stores `NOT VALID` only after vetted Store mappings; create unique composite parent indexes for `(tenant_id,store_id,id)` in products/customers/orders/conversations and optionally child tables. Careful: PG UNIQUE with nullable store_id does not protect unbackfilled legacy rows. Gate reads on scope rather than assuming every row assigned.

**Phase C — prohibit cross-Store references:** dual-scope FK proposals (composite keys require corresponding UNIQUE indexes): `orders(tenant_id,store_id,customer_id) -> customers(tenant_id,store_id,id)`; `order_items(tenant_id,store_id,order_id) -> orders(tenant_id,store_id,id)`; `order_items(tenant_id,store_id,product_id) -> products(tenant_id,store_id,id)`; `messages(tenant_id,store_id,conversation_id) -> conversations(tenant_id,store_id,id)`. If nullable FKs are used during rollout, PostgreSQL MATCH SIMPLE permits NULL bypass — require explicit fail-closed application access and eventually NOT NULL after validated backfill. Consider `MATCH FULL` only after approved handling of legitimately optional customers; a nullable customer reference may be valid, but tenant/store identity cannot be optional in new commerce.

**Phase D — collision resolution before any backfill:** `products` currently has `UNIQUE(tenant_id,sku)`. Multi-Store identical SKU needs `UNIQUE(tenant_id,store_id,sku)` after data confirmation, while removing the existing unique constraint is a behavior change and must not occur until all writers are Store-aware and rollback is prepared. Legacy existing rows cannot be assigned a Store by slug/phone/sender text. Unmapped legacy rows remain quarantined and unavailable to Store-scoped reads. No automatic copy/overwrite.

**Phase E — policies and API migration:** separate existing tenant-only legacy DEMO lane; exact authenticated `auth.uid()` and active Store membership check for every protected read/write. RLS, relevant GRANTs, SECURITY DEFINER audit and current-JWT revocation tests. Privileged writer must resolve Store from trusted installation or authenticated owner; never accept client-supplied store_id alone. Stage dual-read comparisons on synthetic data, not production records. Cutover requires explicit signed approval.

**Gate M1/M2 before hosted:** all old/new writers and RPC clients inventoried; shadow application and SQL versions pinned; local PG17+GoTrue JWT A/B positive and negative acceptance; FK/inventory tests; migration dry run on restored isolated staging snapshot if lawfully permitted; production backup and restore proof; independent security reviewer. **No approval has been granted.**

## Verified current FK incompatibilities
- `orders(tenant_id,customer_id) -> customers(tenant_id,id)`
- `order_items(tenant_id,order_id) -> orders(tenant_id,id)`
- `order_items(tenant_id,product_id) -> products(tenant_id,id)`
- `messages(tenant_id,conversation_id) -> conversations(tenant_id,id)`

Existing constraints are tenant-scoped only. `products(tenant_id,sku)` unique is a multi-Store collision gate.

## Rollback proposal, NEVER auto-execute
Before cutover: abandon additive candidate with no user-facing change, after compatibility review; preserve old schema. After any live Store-aware write begins, **do not blindly drop store_id or reverse FK**; require reversible data migration/reconciliation, freeze writers, verified snapshot and owner approval. Restore from real backup only under approved recovery procedure. Staging and production must be treated separately.

**Status: PROPOSED / NOT EXECUTED / HOSTED NO-GO.**
