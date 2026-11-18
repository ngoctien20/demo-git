# V18.3.6D — Canonical Store Authority Design

## 1. Design goal

A Tenant may own multiple independent Stores. Every Commerce row belongs to exactly one Tenant and, once admitted into the Store model, exactly one Store. A Store is not inferred from a channel, bot, user-supplied ID, SKU, phone number, address, or workflow route.

The database must enforce `tenant_id + store_id + record_id` as the ownership path for every Store-scoped business record.

## 2. Authority layers

1. **Supabase Auth actor** — `auth.uid()` from a verified signed-in session. Never use `raw_user_meta_data` / JWT `user_metadata` as an authorization source.
2. **Tenant membership** — existing `public.tenant_memberships`; controls organization administration only.
3. **Store registry** — proposed `public.stores`; defines a Store under exactly one Tenant.
4. **Store membership** — proposed `public.store_memberships`; explicit per-Store actor role and lifecycle.
5. **Channel installation authority** — private provider installation registry; binds verified provider account to one Tenant + Store.
6. **Commerce ownership** — `store_id` added to products, customers, orders, order_items, conversations and messages.
7. **Database enforcement** — composite foreign keys, restrictive Store RLS boundary, role-specific permissive grants, immutable ownership keys and grants.

## 3. Canonical table contracts

### 3.1 `public.stores`

| Column | Contract |
|---|---|
| `id` | UUID primary key |
| `tenant_id` | NOT NULL FK to `public.tenants(id)` |
| `slug` | Stable Tenant-local identifier |
| `display_name` | Human-readable Store name |
| `status` | `provisioning`, `active`, `suspended`, `archived` |
| `timezone` | IANA timezone; no silent default to server timezone |
| `created_by` | Auth actor that created the Store |
| `created_at`, `updated_at` | UTC timestamps |
| `archived_at` | Nullable lifecycle timestamp |

Required constraints:
- PK `(id)`.
- UNIQUE `(tenant_id, id)` so children can use a composite Tenant+Store FK.
- UNIQUE `(tenant_id, slug)`.
- FK `tenant_id → tenants(id)`, deletion restricted.
- Store IDs and Tenant IDs are immutable after creation.
- An active Store must have at least one active `store_owner`. Enforce this through a locked, transactional Store activation / owner-revocation operation with a deferred final-state check; do not rely on a cross-row CHECK constraint.

### 3.2 `public.store_memberships`

| Column | Contract |
|---|---|
| `tenant_id`, `store_id`, `user_id` | Composite membership identity |
| `role` | `store_owner`, `manager`, `staff` |
| `status` | `invited`, `active`, `suspended`, `revoked`, `expired` |
| `invited_by`, `invited_at` | Invitation provenance |
| `accepted_at` | Actor acceptance |
| `approved_by`, `approved_at` | Authority approval |
| `expires_at`, `revoked_at` | Time-bounded membership lifecycle |
| `created_at`, `updated_at` | UTC timestamps |

Required constraints:
- PK or UNIQUE `(tenant_id, store_id, user_id)`; one current membership row per actor per Store.
- Composite FK `(tenant_id, store_id) → stores(tenant_id, id)`.
- FK `user_id → auth.users(id)`, deletion restricted; revoke/transfer Store ownership before deleting an Auth user.
- Role and status CHECK constraints.
- Immutable `tenant_id`, `store_id`, `user_id` after creation. Membership changes are status/role changes, not key reassignment.
- Membership history is append-only in a private audit table; do not physically delete membership rows.
- A Store may have multiple active co-owners. At least one active Store Owner must remain while Store status is active.

A membership is effective only when:
- `status = 'active'`;
- `revoked_at IS NULL`;
- `expires_at IS NULL OR expires_at > now()`;
- the parent Store is `active`;
- the actor is the verified `auth.uid()`.

### 3.3 Tenant role versus Store role

Keep the existing `tenant_memberships.role` values and semantics for Tenant administration. Do not silently translate `owner`, `manager` or `staff` into Store memberships.

- Tenant Owner: create/suspend/archive Stores, manage Tenant configuration/billing and appoint Store Owners. Commerce data access still requires explicit Store membership.
- Store Owner: full operational authority for the assigned Store; may manage Manager/Staff membership in that Store. Cannot create another Store or promote another Store Owner unless separately authorized by Tenant Owner.
- Manager: Store operations; no Tenant billing, Store lifecycle, Store Owner promotion or secret credential disclosure.
- Staff: limited day-to-day sales operations; no Store membership administration, pricing/catalog administration or direct destructive writes.

### 3.4 Private channel installation authority

Proposed private table: `app_private.store_channel_installations` (or a dedicated non-exposed schema confirmed against the live Data API allowlist).

Required attributes:
- `id`, `tenant_id`, `store_id`;
- `provider` (`messenger`, `zalo_oa`, `website`, future providers);
- `external_account_id`, `installation_ref`;
- `status` (`pending`, `verified`, `suspended`, `revoked`);
- `verified_at`, `revoked_at`, provider scope metadata;
- `credential_ref` only — never the bearer token or secret itself;
- immutable audit timestamps and actor/reviewer provenance.

Rules:
- A provider installation maps to one canonical Tenant + Store.
- Require UNIQUE `(tenant_id, store_id, id)` for composite references and a partial unique index on `(provider, external_account_id)` for verified/active installations, so one provider account cannot be attached to two Stores at once.
- A conversation's provider-originated records retain the exact `channel_installation_id`; a channel label or external reference alone is not authority.
- Webhook signature / provider proof is verified before resolution.
- The server resolves the installation by verified provider + external account + installation state. It does not accept `store_id` from the webhook body, browser, customer message or n8n input as authority.
- Channel identity is not a human Store membership.
- Store Owner may connect/revoke their Store's channel; Manager may see connection status but not secret references or secret material.
- The current n8n Commerce DataTables remain sandbox configuration, not canonical provider authority.

## 4. Trusted request context

After successful identity verification, the gateway creates an immutable internal context:

| Field | Purpose |
|---|---|
| `authority_version` | Resolver contract version |
| `tenant_id`, `store_id` | Canonical scope resolved server-side |
| `actor_type` | `human` or `verified_channel_installation` |
| `actor_id` | Auth user or installation reference |
| `channel`, `installation_id` | Verified provider source |
| `capabilities` | Explicit allowed operations |
| `event_id`, `request_hash` | Replay/idempotency evidence |
| `verified_at`, `expires_at` | Short-lived authority window |

The context is not customer-editable and must not be reconstructed from `chatInput`, query parameters or payload fields. The resolver rejects missing, ambiguous, duplicate, inactive, expired, revoked or mismatched authority.

For human sessions, verify the signed Auth identity and the active Store membership. For sensitive owner/permission changes, the server must also apply the project's approved session-revocation/session-age check. Never place JWTs, refresh tokens, cookies or session IDs in GitHub or workflow logs.

## 5. Commerce row ownership

Add nullable `store_id` to:
- `public.products`
- `public.customers`
- `public.orders`
- `public.order_items`
- `public.conversations`
- `public.messages`

Every new operational row must have both `tenant_id` and `store_id`. Do not change existing primary keys or public IDs in this phase.

Required composite parent keys and foreign keys:

| Child | Required relationship |
|---|---|
| products | `(tenant_id, store_id) → stores(tenant_id, id)` |
| customers | same Store FK |
| orders | same Store FK |
| orders.customer_id | `(tenant_id, store_id, customer_id) → customers(tenant_id, store_id, id)` |
| order_items | same Store FK |
| order_items.order_id | `(tenant_id, store_id, order_id) → orders(tenant_id, store_id, id)` |
| order_items.product_id | `(tenant_id, store_id, product_id) → products(tenant_id, store_id, id)` |
| conversations | same Store FK; add nullable `channel_installation_id` referencing the exact Store installation |
| conversations.external_reference | Partial UNIQUE `(tenant_id, store_id, channel_installation_id, external_reference)` where both external_reference and channel_installation_id IS NOT NULL |
| messages | same Store FK |
| messages.conversation_id | `(tenant_id, store_id, conversation_id) → conversations(tenant_id, store_id, id)` |

Add UNIQUE keys `(tenant_id, store_id, id)` on products, customers, orders and conversations as required by the composite references. Add a composite FK from conversations `(tenant_id, store_id, channel_installation_id)` to the private installation registry `(tenant_id, store_id, id)`; this column remains NULL only for legacy or explicitly internal/manual conversations. New provider-originated conversations must carry the verified installation ID. The current live conversations table has only `id`, `tenant_id`, `channel`, `external_reference` and `created_at`; its existing channel CHECK allows `web`, `messenger`, `zalo` and `line`, and it does not yet retain a provider installation ID. Keep the existing Tenant-only foreign keys during additive rollout; remove redundant constraints only after the new constraints are validated and query plans are reviewed.

Use `ON DELETE RESTRICT` for Store/ownership links. Business records are cancelled/archived, not physically cascade-deleted across a Store boundary.

### Legacy NULL semantics

- `store_id IS NULL` means legacy/unmapped, never "default Store".
- Composite FKs using PostgreSQL's default `MATCH SIMPLE` do not validate a row if any referencing key column is NULL. This is intentional only for historical unmapped rows.
- Add a `CHECK (store_id IS NOT NULL) NOT VALID` guard to each operational table after adding the column. It skips validation of existing rows but rejects new or updated rows that remain NULL. Backfill from an approved manifest can change NULL to a valid Store ID.
- Keep the guard unvalidated while legacy NULL rows remain. Validate it and set `NOT NULL` only if every remaining row has been mapped or moved through a separately approved archive/quarantine process.
- Store RLS denies reads and writes for NULL Store rows.
- Add `CHECK (channel_installation_id IS NOT NULL) NOT VALID` to conversations. Existing legacy rows may remain NULL and hidden; new or updated provider conversations must reference a verified installation.

## 6. Product SKU namespace — explicit compatibility decision

Live schema currently has `UNIQUE (tenant_id, sku)`. This prevents two Stores in one Tenant from having the same SKU.

Recommended target for independent Store catalogs:
- Replace with `UNIQUE NULLS NOT DISTINCT (tenant_id, store_id, sku)` on PostgreSQL 15+.
- This permits the same SKU in Store A and Store B while retaining uniqueness for legacy rows where `store_id IS NULL`.
- Before changing the constraint, detect collisions within each proposed Store and update catalog lookup/update code to filter by both Tenant and Store.
- If the business chooses Tenant-global SKU uniqueness, keep the existing constraint and record that cross-Store duplicate SKUs are intentionally unsupported.

No uniqueness constraint is changed by this design PR. See `OPEN_DESIGN_DECISIONS.md`.

## 7. Store-scoped identity, idempotency and notifications

- Customer identity is Store-scoped by default. Do not merge the same phone/account across Stores automatically.
- Order identifiers remain globally unique, but all reads, updates, child links and audit events must also constrain `tenant_id + store_id`.
- Idempotency keys for channel events/outbox include installation scope, provider and provider event ID; the same event cannot be replayed within one installation.
- Notification outbox rows carry canonical Tenant + Store + order + installation scope.
- A Store's media namespace and Storage policies must be designed separately before Storage is enabled; the live project currently has zero buckets and objects.

## 8. Non-goals

This design does not approve:
- live Auth A/B admission;
- migration/backfill of real rows;
- production Messenger/Zalo/Website writers;
- provider sends or credential changes;
- cross-Store customer deduplication;
- shared catalog or consolidated reporting;
- Store billing/subscription policy changes.
