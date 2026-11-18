# TIEN404 AI — V17.2C.31 Real Commerce Orders Authorization Contract Audit × Synthetic-to-Actual RLS Gap

Date: 2026-11-18 JST. Source: live metadata-only SELECT queries against Supabase `tien404-staging` (project `ifxlvrhyjhbzbrkdsida`). NO real Orders rows, PII, Auth token, session or customer data queried; NO DDL/DML applied.
User selected **Option A**: no Pro upgrade, no paid branch and no data writes.

## Verified actual public Commerce contract
- `public.orders` columns: id(uuid), tenant_id(uuid), customer_id(uuid nullable), status(text), total_vnd(bigint), order_source(text), created_at, updated_at. **No store_id/store_key**.
- `public.order_items`: id, tenant_id, order_id, product_id, quantity, unit_price_vnd, line_total_vnd. **No store_id/store_key**.
- `public.products`: id, tenant_id, sku, name, price_vnd, stock_on_hand, is_active, created_at, updated_at. **No store_id/store_key**.
- `public.tenant_memberships`: tenant_id, user_id, role, active, created_at. **No Store membership**.
- `public.customers`: tenant_id, id, display_name, phone, email, consent_at, created_at. **No Store scope**.
- `public.orders` and `public.order_items`: RLS enabled and FORCE RLS true, SELECT policy to authenticated based on EXISTS active owner/manager membership matching **tenant_id only**. No store predicate in policy. `customers_manager_read` is similarly tenant-scoped.
- SQL grants verified: anon SELECT=false, authenticated SELECT=true, authenticated INSERT/UPDATE/DELETE=false on both `public.orders` and `public.order_items`. This limits direct client writes but does not make read access Store-scoped.
- Foreign keys `order_items (tenant_id,order_id)` → `orders(tenant_id,id)`, and `(tenant_id,product_id)` → `products(tenant_id,id)`; tenant consistency protected, not Store consistency.
- `public.merchant_paid_orders_daily(p_tenant,p_days)` and `public.merchant_revenue_v3(p_shop,p_start,p_end)` are SECURITY INVOKER (not SECURITY DEFINER), available to authenticated, explicitly authorize tenant membership, read tenant-level orders/revenue. They inherit the same missing Store scope where a tenant has multiple independent Stores.
- Separate QA table `tien404_v175_qa.order_ownership` has tenant/store/actor-specific SELECT policies for synthetic roles, but no direct authenticated table SELECT grant. Its existence is not proof Commerce Orders has that protection.
- QA view `tien404_v175_qa.verified_customer_order_scope` has `security_invoker=true`, `security_barrier=true` and no anon/authenticated SELECT grants. Not a public bypass based on metadata.

## Actual-to-synthetic gap matrix
| Invariant | V17.2C.30 ephemeral fixture | Connected Commerce actual | Decision |
|---|---|---|---|
| tenant_id required | yes | yes | PARTIALLY ALIGNED |
| store_id required per Order | yes | **absent** | P1 MODEL GAP |
| same tenant A/B partition | yes, owner+store check | **tenant owner/manager sees tenant orders** | P1 RLS GAP |
| Store-granular membership | yes | **tenant only** | P1 AUTHORITY GAP |
| item→order Store consistency | synthetic tenant+store identity | FK tenant+order only | MODEL GAP |
| read rights | exact store+tenant | tenant-wide owner/manager | P1 |
| update order status (owner) | column-limited grant + Store RLS | authenticated UPDATE denied | Not comparable; inspect privileged server writers before changes |
| prevent client changes to amount/store | limited UPDATE(status) | authenticated UPDATE denied | SAFE at direct grants layer |
| revoked membership | synthetic denial | active membership predicate present | static policy VERIFIED, real JWT not run |
| actual JWT and n8n end-to-end | not tested | not tested | NO-GO |

## Important interpretation
The real Commerce schema may be intentionally designed for **one Store per Tenant**; then tenant-scoped access could be a legitimate current invariant. There is not yet evidence that this tenant holds two real stores with distinct privileged owners. Do NOT claim confirmed data leak or exploited BOLA. Before introducing same-tenant multi-Store product support, however, this is a **P1 release-blocking design incompatibility**. If tenant=Store is the approved architecture, document/enforce that one-to-one mapping and keep multi-Store-in-one-tenant disabled until a secure model exists.

## Other security advisor notices requiring separate triage
- Supabase advisor WARN `anon_security_definer_function_executable`: `public.qa_shop_b_zalo_claim` is anonymously executable SECURITY DEFINER; review separately before Zalo public promotion. Official remediation https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable
- Advisor WARN authenticated SECURITY DEFINER functions `public.qa_owner_pairing` and `public.save_merchant_product`: assess privilege and caller authorization in existing separate RPC security workstream before changing. https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
- Advisor INFO `rls_enabled_no_policy` for several private schema QA tables: not by itself an exposure, because private roles may be denied and no API grants.
- Advisor WARN leaked-password protection disabled: separate Auth risk/backlog, https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## Proposed remediation, NOT EXECUTED
1. Decide canonical cardinality: (A) one tenant = one Store, with explicit invariant + channel-to-tenant trusted binding; or (B) multiple Stores within one tenant requiring canonical Stores table.
2. If B, map dependencies and read/write paths first, then write a backward-compatible migration on disposable Postgres only: Stores FK, `orders.store_id`, `order_items.store_id`, `products.store_id`, `customers.store_id` where required, and canonical owner/manager Store membership. Do not auto-backfill Store from tenant without provenance.
3. RLS SELECT and any status UPDATE/RPC must check `tenant_id` **and** trusted `store_id` + owner/manager Store membership, including composite FK constraints and report aggregation filters.
4. Audit privileged n8n / server role write paths, Messenger and Zalo Shop resolvers, orders revenue RPCs and cross-channel order lookups. Restrict service_role and prevent client-supplied Store or tenant authority; explicit owner confirmation.
5. Run V17.2C.30 synthetic same-tenant A/B and negative JWT suite in independently approved disposable environment only; no unauthorized upgrade or paid branch.

## Test and release status
- VERIFIED: Actual table/columns, RLS policy expressions, direct SQL grants, FK design, selected revenue RPC definitions, security advisors, and Draft PR source.
- TESTED: V17.2C.30 ephemeral PostgreSQL CI 3/3 PASS. No real JWT or Store A/B request.
- IMPLEMENTED: Read-only audit report on Draft PR #392 only.
- BLOCKED: Actual 2-Store same-tenant live Auth UAT, real Commerce write integration, independent consent.
- PROPOSED: Architecture decision, migration strategy, independent security review.
- Production / hosted real JWT UAT: **NO-GO**.

## Rollback and isolation
No migration, project/branch, payment, workflow publish, role grant, RPC change, schema mutation, customer or order row modification. Revert checkpoint document/close Draft PR if necessary. Any future migration requires backup, test, approval and rollback plan.
