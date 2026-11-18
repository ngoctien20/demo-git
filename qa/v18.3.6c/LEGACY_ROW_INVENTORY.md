# V18.3.6C — Legacy Row Inventory (Aggregate Only)

No raw customer names, phone numbers, email addresses, addresses, order bodies, Auth identifiers, session identifiers, tokens or credentials were selected. Counts below were obtained with aggregate-only SQL or DataTable metadata/summary reads.

## 1. Supabase public Commerce

| Table | Rows | Missing Tenant | Orphan / integrity issue |
|---|---:|---:|---:|
| products | 2 | 0 | 0 |
| orders | 2 | 0 | 0 |
| customers | 0 | — | 0 |
| order_items | 0 | — | 0 |
| conversations | 0 | — | 0 |
| messages | 0 | — | 0 |

Both current tenant records are QA staging tenants. Each has one product and one order. Active tenant memberships: 3 total across 2 tenants; one tenant has one active owner membership, the other has two. No row has a Store key because the schema has no Store column.

No product/order/customer/order-item/conversation/message orphan was found in the checked tenant relationships. No automatic Store assignment is justified by these counts.

## 2. R1 private Store/Bot QA schema

| Dataset | Rows / state |
|---|---:|
| shop_bots | 2 |
| distinct Store/Bot scopes | 2 |
| catalog | 2 |
| tenant_identity_map | 2 |
| owner_bindings | 2 paired |
| sandbox_orders | 4 pending_sandbox |
| owner_outbox | 4 HELD |
| owner_pairing_challenges | 19 (9 used, 10 expired-unused) |
| owner_pairing_claims_v3 | 4 (3 CONFIRMED, 1 PENDING_OWNER_CONFIRMATION) |

Integrity checks: both Bot scopes have identity mappings to existing Auth Tenants; no catalog orphan; no sandbox order without its catalog SKU; no order arithmetic mismatch.

Critical interpretation: both bots are explicitly `dry_run` and `synthetic_qa`. The two Store/Bot scopes map to **two distinct Auth Tenants**, with at most one Store scope per Auth Tenant. These rows do not prove a same-tenant multi-Store relationship or production provider ownership.

All four outbox rows are HELD; no sent/delivered/acknowledged row was found in this QA outbox.

## 3. V17.5 private QA

Eight tables exist under `tien404_v175_qa`:
- customer_identity
- channel_identity
- order_ownership
- authorization_audit
- replay_claims
- otp_challenges
- conversation_handoffs
- auth_customer_binding

Aggregate rows across these eight tables: **0**. A separate `verified_customer_order_scope` view exists; it is not evidence of populated ownership records. The schema has no USAGE grant to anon/authenticated.

## 4. Supabase Storage

- Buckets: 0
- Objects: 0

There is no current media object inventory or Store-level media ownership mapping in this staging project.

## 5. n8n Commerce DataTables

Metadata/aggregate inventory:
- 16 tables matching `TIEN404_COMMERCE_*`.
- 14 tables have `tenantId`.
- 0 tables have `storeId` or `storeKey`.
- Tenants: 4 rows (3 sandbox, 1 onboarding).
- Channels: 6 rows (3 sandbox, 3 not_connected); 3 enabled; all 6 lack `credentialRef`.
- Products: 8 active rows across 3 tenants; no missing/unknown tenant reference; no duplicate SKU within tenant.
- Feature flags: 23 rows; no missing/unknown tenant reference; no duplicate tenant+feature key.

Channel distribution: one Messenger sandbox channel; two Website sandbox channels; one Zalo OA and two Website rows are not connected. No credential reference is populated.

The `TIEN404_COMMERCE_ORDERS` DataTable schema contains customer name, phone and address fields. Its row data was intentionally not read. Its schema is tenant-based and has no Store field.

## 6. Mapping disposition

All rows remain in their current tenant/QA scope. No row has been assigned to a canonical Store. Any future backfill must use a private owner-approved mapping manifest with source row key, tenant, proposed Store, approval receipt, reviewer, timestamp and evidence hash. Unapproved or ambiguous rows remain NULL/quarantined and invisible to Store-scoped users.
