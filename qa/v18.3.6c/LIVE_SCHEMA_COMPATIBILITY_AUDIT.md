# V18.3.6C — Live Schema Compatibility Audit

## 1. Supabase staging baseline

Read-only inspection of project `ifxlvrhyjhbzbrkdsida`:

| Check | Observed |
|---|---:|
| PostgreSQL | 17.11 |
| Public tables | 20 |
| Public tables with RLS enabled | 20 |
| Public policies | 31 |
| Public restrictive policies | 0 |
| Canonical `public.stores` / `public.store_memberships` | 0 |
| `store_id` columns across products/orders/order_items/customers/conversations/messages | 0 |
| Active tenant memberships | 3 across 2 QA tenants |
| Applied Supabase migrations | 21 |

Latest migration in the observed history: `v175e2b_private_auth_customer_binding_intake_no_grants` (2026-11-17). No canonical Store schema migration is present.

## 2. Commerce schema

The live Commerce tables remain tenant-scoped:

- `public.products(tenant_id, sku, name, price_vnd, stock_on_hand, ...)`
- `public.orders(tenant_id, customer_id, status, total_vnd, order_source, ...)`
- `public.customers(tenant_id, ...)`
- `public.order_items(tenant_id, order_id, product_id, ...)`
- `public.conversations(tenant_id, channel, ...)`
- `public.messages(tenant_id, conversation_id, ...)`
- `public.tenant_memberships(tenant_id, user_id, role, active, ...)`

There is no canonical Store entity or Store membership relation. A tenant is not interchangeable with a store.

## 3. RLS compatibility — blocking issue

All 20 public tables have RLS enabled, but the 31 observed public policies are permissive; there are zero restrictive policies.

Commerce read-policy behavior:
- Products: any active tenant member can read.
- Orders, order items, customers, conversations and messages: active owner/manager membership can read.
- Tenant membership and tenant visibility are also tenant-level.

PostgreSQL combines permissive policies with OR semantics. Therefore, adding a new permissive Store policy alongside the existing tenant-wide policy would not narrow access to one Store. The migration must explicitly redesign/replace the tenant-wide access path or introduce a carefully tested restrictive Store predicate, with matching `USING` and `WITH CHECK` semantics for writes.

Current Commerce tables do not have direct authenticated INSERT/UPDATE/DELETE policies. The observed authenticated write grants are on QA tester tables only. A separate `SECURITY DEFINER` RPC, `save_merchant_product`, is executable by authenticated users but is hard-scoped in code to two QA tenant UUID/slug pairs and is not Store-aware. It is not a production multi-Store writer.

## 4. Private schema access

The following schemas have no USAGE grant to `anon` or `authenticated`, and their tables have no direct SELECT/INSERT grants to those roles:

- `app_private`
- `factory_private`
- `tien404_dialogue_private`
- `tien404_r1_qa`
- `tien404_v175_qa`

Supabase Security Advisor reports 23 RLS-enabled/no-policy INFO findings in these private schemas. The current lack of schema USAGE/table grants means these findings are not equivalent to public Data API exposure. Preserve the no-grant boundary; review any future function or service-role access separately.

## 5. Security Advisor findings

Observed at audit time:

| Finding | Count / level | Assessment |
|---|---:|---|
| RLS enabled, no policy | 23 / INFO | Private schemas; no anon/auth schema usage or table grants observed |
| Public SECURITY DEFINER executable by anon | 1 / WARN | `qa_shop_b_zalo_claim`; custom Vault-backed header gate, hard-coded synthetic Shop B path; requires independent review |
| Public SECURITY DEFINER executable by authenticated | 2 / WARN | `qa_owner_pairing` and `save_merchant_product`; currently bounded to QA flows/tenants, but remain privileged RPCs |
| Leaked-password protection disabled | 1 / WARN | Auth hardening backlog; do not change without auth-flow review |

The reviewed SECURITY DEFINER functions set an empty search_path except the service-role-only tester audit trigger, which pins `pg_catalog, public, auth`. The function bodies use schema-qualified objects. This is positive hardening, not a substitute for reviewing grants, authorization predicates and rate limits.

No function was invoked and no grant was changed.

## 6. Performance Advisor

- 19 foreign keys reported without covering indexes; includes Commerce `orders(tenant_id, customer_id)` and `order_items(tenant_id, product_id)`, plus QA/private tables.
- 9 unused indexes reported. Several affected QA tables are empty or low-volume; do not drop them based only on current usage statistics.

These are INFO/performance backlog items, not a reason to mutate the schema during this audit. Index planning should follow the final canonical composite-key design and realistic volume estimates.

## 7. Storage / media

Supabase Storage currently reports zero buckets and zero objects. There is no existing Storage asset inventory to map to a Store. Media intake/consent remains a separate gate; do not infer media ownership from file path or tenant alone.
