# V17.25R — Store Schema and RLS Migration Preview (NOT EXECUTABLE)

**No SQL is applied to Supabase. This document is a design review artifact, not a migration.**

## 1. Current verified Supabase staging state

PostgreSQL 17.11, project `ifxlvrhyjhbzbrkdsida`:
- `public.stores` absent.
- `public.store_memberships` absent.
- Zero public `store_id` columns.
- Existing `public.tenant_memberships` already stores Tenant `tenant_id`, `user_id`, `role`, `active`.
- Products, Orders, Order Items, Customers, Conversations and Messages have tenant-only keys and tenant-only RLS policies.
- No migration or live policy changes are included in V17.25R.

## 2. Target schema

### Stores
Target `public.stores`:
- `tenant_id uuid NOT NULL`
- `id uuid NOT NULL`
- `slug text NOT NULL`
- `name text NOT NULL`
- `status text NOT NULL CHECK (status IN ('active','paused','archived'))`
- timestamps
- `PRIMARY KEY (tenant_id,id)`
- `UNIQUE (tenant_id,slug)`

Tenant is part of the key. A Store ID must never be accepted as a globally authoritative client-supplied selector.

### Store Memberships
Target `public.store_memberships`:
- `tenant_id uuid NOT NULL`
- `store_id uuid NOT NULL`
- `user_id uuid NOT NULL`
- `role text NOT NULL CHECK (role IN ('owner','manager','staff'))`
- `active boolean NOT NULL DEFAULT true`
- `PRIMARY KEY (tenant_id,store_id,user_id)`
- Composite FK `(tenant_id,store_id) REFERENCES stores(tenant_id,id)`
- Composite FK `(tenant_id,user_id) REFERENCES tenant_memberships(tenant_id,user_id)`
- Index `(user_id,tenant_id,store_id) WHERE active`

Do not create a second public Tenant Membership table. The disposable R fixture uses `shop_qa.tenant_memberships` only to simulate the existing table's role intersection.

### Store ID on commerce tables
Add `store_id uuid NOT NULL` to:
- `products`
- `customers`
- `orders`
- `order_items`
- `conversations`
- `messages`

Every table needs a composite unique key `(tenant_id,store_id,id)` where referenced by child tables. Required composite foreign keys:
- `orders(tenant_id,store_id,customer_id) → customers(tenant_id,store_id,id)`
- `order_items(tenant_id,store_id,order_id) → orders(tenant_id,store_id,id)`
- `order_items(tenant_id,store_id,product_id) → products(tenant_id,store_id,id)`
- `messages(tenant_id,store_id,conversation_id) → conversations(tenant_id,store_id,id)`
- `store_memberships(tenant_id,store_id) → stores(tenant_id,id)`

SKU uniqueness becomes `UNIQUE(tenant_id,store_id,sku)`, allowing the same SKU in different Stores.

Channel installation/identity mapping must be server-owned and Store-scoped. Provider secrets and idempotency data stay in a private schema, not browser-exposed public tables.

## 3. Role intersection

Effective role is the least privileged of active Tenant and Store roles:
`staff < manager < owner`.

No implicit Store inheritance for a Tenant Owner. Both memberships must be active. User-editable JWT `user_metadata`, request headers, query strings and body fields are never authorization sources.

## 4. RLS replacement sequence

PostgreSQL combines permissive policies with OR and restrictive policies with AND. Adding a Store-scoped permissive policy beside an old Tenant-wide permissive policy is unsafe: the old policy still authorizes rows.

Future migration must run in one reviewed transaction:
1. Create Stores and Store Memberships with composite keys/FKs.
2. Add Store columns and constraints as NOT VALID where appropriate; build indexes using a reviewed low-lock plan.
3. Produce an aggregate mapping report: total, verified mappable, ambiguous, unmapped, orphaned, duplicate.
4. Obtain authoritative Store mapping evidence and independent owner confirmation.
5. Backfill only verified rows; do not infer the default Store.
6. Validate composite constraints.
7. Replace old Tenant-only permissive policies with Store-scoped policies for each command in the same transaction.
8. Set grants to least privilege; enable and FORCE RLS on exposed tables.
9. Verify policy inventory and Data API exposure separately from RLS.
10. Run disposable PG17 suite, then protected staging read-only Auth A/B suite after M0 approval.

Never leave the old Tenant-wide policy as a permissive policy alongside the new Store policy. A restrictive Store fence can be used as a temporary transition control only if its coverage and all bypass paths are verified.

## 5. Intended grants and command policy

| Table | Authenticated SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| Stores | Own active membership, active/paused | No | No | No |
| Store Memberships | Own active membership | No | No | No |
| Products | All active Store roles | Owner/Manager | Owner/Manager | No |
| Customers | Owner/Manager | Server-only contract | Server-only contract | No |
| Orders | Owner/Manager | Server-side order contract only | Owner/Manager via approved contract | No; use status transition |
| Order Items | Owner/Manager | Atomic server transaction only | Atomic server transaction only | No |
| Conversations | Owner/Manager | Server/provider adapter only | Server/provider adapter only | No |
| Messages | Owner/Manager | Server/provider adapter only | No | No |

The R suite temporarily grants Orders INSERT/UPDATE/DELETE in the disposable database solely to test row policies, then revokes all three before the final grant inventory. This does not approve direct client Orders DML.

If a backend uses a service credential with BYPASSRLS, the API must resolve and validate canonical Store authority server-side before every operation. This test does not prove service-role isolation.

## 6. Store lifecycle

- `active`: reads and permitted writes.
- `paused`: existing Owner/Manager reads only; block product/order writes, inbound order acceptance and provider sends.
- `archived`: hidden from normal Store APIs. Any archival export requires a separately audited operation.

## 7. Rollback and unmapped rows

Do not assign legacy records to the first/only Store, a currently selected Store, or a Store inferred from channel IDs or message text. Ambiguous/unmapped rows remain inaccessible to Store APIs until verified.

Before any hosted migration, M0 requires an owner-approved current backup, independent isolated restore/readback, checksums and a documented rollback point. If cutover fails, restore the exact pre-cutover schema/policy/grant snapshot; do not guess Store IDs to reconstruct data.

## 8. Explicit no-go

- No migration file created or applied.
- No DDL/DML, grants, RLS or Data API setting changed on Supabase.
- No real JWT, real Owner A/B session, customer data or provider send used.
- M0 remains NO-GO; real Owner A/B UAT remains 0/31 NOT RUN.
- Production remains NO-GO.
