# TIEN404 V17.25Q — Store-Aware API Contract × Legacy Deprecation × Dual-Owner Negative QA

**Classification:** SOURCE-ONLY / SYNTHETIC ASGI QA / NO REAL JWT / NO HOSTED WRITE / M0 NO-GO / PRODUCTION NO-GO.

## 1. Starting checkpoint and exact current state

Stacked on [Draft PR #411 — V17.25P](https://github.com/ngoctien20/demo-git/pull/411), whose base is Draft PR #409. PR #411 received one CI-only workflow extension so this stacked child can run its own synthetic suite; no parent app/runtime code, deployed source, customer record, Supabase object or provider configuration is modified.

Verified read-only state:
- Render service `tien404-data-staging`, LIVE deployment `dep-dbqj9plg1s2s73egr30g`, source commit `ab940a95dae8afdff426bc6ac71693833d5348ce`, Auto Deploy OFF.
- Exact deployed `main.py` blob: `a7a11abeffb378b3f9952005ffdd489c54df1c13`.
- Supabase staging PostgreSQL `17.11`; `public.stores` and `public.store_memberships` absent; 0 `store_id` columns across the current schema.
- Relevant tables `products`, `orders`, `order_items`, `customers`, `conversations`, `messages`, `tenant_memberships` have RLS enabled, but current business policies authorize at Tenant scope only.
- Relevant current tables expose SELECT to `authenticated`; no current authenticated INSERT/UPDATE/DELETE grant was found for these tables.
- Current policies: Products allows any active tenant member; Orders, Order Items, Customers, Conversations and Messages allow active tenant Owner/Manager. No policy checks Store membership.
- Exact deployed FastAPI currently exposes `GET /api/v1/tenants`, `GET /api/v1/tenants/{tenant_id}/products`, and `GET /api/v1/tenants/{tenant_id}/orders` (plus health/internal n8n handshake). The Products and Orders routes both filter by `tenant_id` only.
- Customer/Conversation/Message tables exist but no corresponding customer/conversation/message GET route exists in the inspected deployed `main.py`.
- V17.25O's legacy guard is a synthetic isolated ASGI guard and currently matches Orders only; it is not installed in the live Render app and does not cover Products.

**Important:** the live v1 Products and Orders routes remain deployed and tenant-wide. V17.25P proved Orders behavior; V17.25Q records Products as the same unscoped route class. This is a design and QA finding, not evidence of an exploited incident. Do not use either route for multi-Store customer data.

## 2. Core authority rule

A `tenant_id + store_id` pair in a URL identifies the requested resource; it is not proof of access. Every request must:
1. Verify the bearer session with Supabase Auth on the server.
2. Find exactly one active `tenant_memberships` row for `auth.uid()` and the requested Tenant.
3. Find exactly one Store whose `tenant_id` and `id` match the URL.
4. Find exactly one active `store_memberships` row for the same user, Tenant and Store.
5. Calculate effective role as the **least privileged** of tenant role and store role.
6. Apply Store status rules and resource/action permission.
7. Let Postgres RLS independently enforce the same Store boundary on every query.
8. For child resources, prove parent and child share the exact Tenant + Store (and parent ID) before returning data.

A Tenant Owner is **not** automatically a member of every Store. A Store membership cannot elevate a lower Tenant role. A user who owns Store A and Store B must explicitly select one Store per request. Do not trust Store IDs in headers, query strings, body fields, browser state or JWT user_metadata.

## 3. Store roles and status

Effective role is `min(tenant_role, store_role)` by privilege rank: `staff < manager < owner`.

| Capability | Owner | Manager | Staff |
|---|---:|---:|---:|
| Read Store catalog | Yes | Yes | Yes |
| Create/update catalog and pricing | Yes | Yes | No |
| Read all Store orders | Yes | Yes | No |
| Create order | Yes | Yes | Yes |
| Update/cancel orders | Yes | Yes | No |
| Read customer directory | Yes | Yes | No |
| Read conversations/messages | Yes | Yes | No |
| Store reports | Yes | Yes | No |
| Manage Store members/installation | Yes | No | No |
| Tenant billing/plan administration | Tenant-level permission only; not implied by Store role | No | No |

Staff order read-back requires a future `created_by_user_id`/assignment contract and is deliberately not admitted in this version.

Store status:
- `active`: normal access subject to role.
- `paused`: existing Owner/Manager may read historical records; all business writes, new order acceptance and channel dispatch must be blocked.
- `archived`: ordinary Store API returns 404; archival export needs a separate audited approval.

## 4. Proposed v2 API

See `api-contract.json` for machine-readable route, auth, request, response and error contract.

Canonical paths:
- `GET /api/v2/tenants/{tenant_id}/stores`
- `GET /api/v2/tenants/{tenant_id}/stores/{store_id}/products`
- `GET /api/v2/tenants/{tenant_id}/stores/{store_id}/orders`
- `GET /api/v2/tenants/{tenant_id}/stores/{store_id}/orders/{order_id}`
- `GET /api/v2/tenants/{tenant_id}/stores/{store_id}/orders/{order_id}/items`
- `GET /api/v2/tenants/{tenant_id}/stores/{store_id}/customers`
- `GET /api/v2/tenants/{tenant_id}/stores/{store_id}/conversations`
- `GET /api/v2/tenants/{tenant_id}/stores/{store_id}/conversations/{conversation_id}/messages`

The v2 routes are a **proposed contract represented by a synthetic simulator only**. They do not exist in Render and do not read Supabase.

Order creation is specified but not implemented: the client submits SKU + quantity and optional customer snapshot only. The server derives Tenant, Store, channel, unit price, stock, total and status from verified context and database records. Require a store-scoped idempotency key. Reject client-provided `tenant_id`, `store_id`, price, total, stock, status, creator or order source.

## 5. Legacy endpoint matrix

See `legacy-deprecation-matrix.json`. No automatic single-Store fallback and no tenant-wide compatibility query is permitted.

- Keep `GET /api/v1/tenants` only as a Tenant membership directory; it returns no business data.
- Both current v1 business routes must be blocked for Store-mode tenants before v2 admission; once v2 is released, sunset them with HTTP 410.
- Extend the existing no-host guard to Products as well as Orders in a separate reviewed change. Do not hotfix Render from this PR.
- Customers/Conversations/Messages have database tables but no matching GET route in the inspected live FastAPI source. Do not describe these as existing APIs.

## 6. Database/RLS design — preview only

See `migration-preview.md`. No SQL is executed and no migration is generated/applied.

Recommended target:
- `public.stores` and `public.store_memberships`, both RLS-enabled with explicit grants and Store-bound policies.
- `store_id` on Products, Customers, Orders, Order Items, Conversations and Messages.
- Composite uniqueness and foreign keys on `(tenant_id, store_id, id)` prevent cross-Store parent/child references.
- Private channel installation, secrets, idempotency and audit tables remain in `app_private`, not exposed via Data API.
- Replace legacy tenant-only permissive policies atomically at cutover. Adding a new permissive Store policy while retaining the old tenant policy is unsafe because permissive policies combine with OR.
- Use explicit `TO authenticated`, `(select auth.uid())`, role predicates and both `USING` + `WITH CHECK` for UPDATE.
- Do not use `user_metadata` for authorization. Avoid public `SECURITY DEFINER` functions.

Supabase changelog: as of 30 Oct 2026, new public tables are no longer automatically exposed to the Data API by default. New Store tables need explicit review of API exposure and grants; RLS is separate from object grants.

## 7. Negative QA

`test_store_api_contract.py` is a synthetic FastAPI + HTTPX ASGI contract simulator:
- Two distinct same-Tenant Owners, each assigned to one Store.
- A dual-Store Owner with explicit memberships to both.
- Tenant-only Owner with no Store membership.
- Cross-Tenant actor, inactive tenant membership, inactive Store membership, Manager, Staff and role mismatch cases.
- Cross-Store order, order item, customer, conversation and message object-ID probes.
- Forged Store/Tenant headers, duplicate query scope, forged user header and malformed path.
- Legacy Products/Orders blocked pre-cutover and 410 after sunset.
- Client-controlled price, total, stock, order status and Store scope rejected by the proposed create-order body validator.
- Store-scoped idempotency key namespace.
- Paused and archived Store behavior.

All identities, tokens, Stores, products, orders, customers, conversations and messages are synthetic. Test process blocks real socket connects. No real JWT, Supabase credentials, provider webhook or network call is used. Final CI run #44266922645 passed the parent exact-source replay 28/28 and this Store contract suite 58/58; both JSON contract files parsed successfully.

## 8. Release gates

- `STORE_API_CONTRACT_DESIGN`: implemented as a source-only contract and simulator.
- `DUAL_OWNER_NEGATIVE_QA`: TESTED — 58/58 synthetic tests passed in CI run #44266922645.
- `LEGACY_LIVE_ROUTES`: VERIFIED tenant-only and still active in deployed Render; not patched by this PR.
- `HOSTED_STORE_SCHEMA`: absent; no migration.
- `M0`: NO-GO; owner deferred current backup; no independent current restore receipt.
- `REAL_OWNER_A_B_JWT_UAT`: 0/31 NOT RUN.
- `PROVIDER_ADAPTERS`: design only, disabled.
- `PRODUCTION`: NO-GO.

Rollback is closing/reverting this Draft PR; no runtime rollback is needed because no hosted system is changed.
