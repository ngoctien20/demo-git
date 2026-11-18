# V18.3.6D — Restrictive RLS Truth Table

## 1. Live policy baseline

The last verified Supabase staging snapshot (PostgreSQL 17.11) shows:

| Table | Existing permissive policy | Existing command |
|---|---|---|
| products | `products_member_read` — active tenant member | SELECT |
| orders | `orders_manager_read` — active tenant owner/manager | SELECT |
| order_items | `order_items_manager_read` — active tenant owner/manager | SELECT |
| customers | `customers_manager_read` — active tenant owner/manager | SELECT |
| conversations | `conversations_manager_read` — active tenant owner/manager | SELECT |
| messages | `messages_manager_read` — active tenant owner/manager | SELECT |
| tenants | `tenants_member_read` | SELECT |
| tenant_memberships | `memberships_self_read` | SELECT |

These policies are all PERMISSIVE. The live public schema has 31 permissive policies in total and zero restrictive policies. The six Commerce tables currently have no authenticated INSERT/UPDATE/DELETE policy in the inspected snapshot.

## 2. PostgreSQL policy algebra

For one command and role:

`ALLOW = (P1 OR P2 OR ... OR Pn) AND (R1 AND R2 AND ... AND Rm)`

- PERMISSIVE policies combine with OR.
- RESTRICTIVE policies combine with AND.
- At least one applicable permissive policy must pass; restrictive policies only narrow an existing grant.
- Adding a new permissive Store policy is not a safe replacement for the old Tenant-wide policy.
- A restrictive Store boundary can narrow the existing Tenant read policies without deleting them immediately, but every relevant role/command and policy target must be verified.
- A restrictive policy by itself does not grant INSERT/UPDATE/DELETE.

References: PostgreSQL 17 CREATE POLICY and Row Security Policies; Supabase RLS guide.

## 3. Store boundary predicate

Design helper (not implemented):

`app_private.has_active_store_membership(p_tenant_id, p_store_id)`

Returns true only if:
- `auth.uid() IS NOT NULL`;
- exact Tenant + Store + actor membership exists;
- membership status is active, not revoked and not expired;
- parent Store is active.

The helper must derive the actor from `auth.uid()`; do not accept a user ID or role supplied by the caller. It must not read user-editable `user_metadata`.

Proposed restrictive boundary on each of the six Commerce tables:

```sql
-- DESIGN EXAMPLE ONLY — NOT EXECUTED; names/signatures require migration review.
CREATE POLICY orders_store_boundary
ON public.orders
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (
  store_id IS NOT NULL
  AND (SELECT app_private.has_active_store_membership(tenant_id, store_id))
)
WITH CHECK (
  store_id IS NOT NULL
  AND (SELECT app_private.has_active_store_membership(tenant_id, store_id))
);
```

Apply the equivalent boundary to products, customers, order_items, conversations and messages. The function/schema grants and Data API exposure must be reviewed before use. If the helper is in a private schema that is not exposed by PostgREST, grant only the minimum schema USAGE and EXECUTE required for policy evaluation; do not grant direct table access. Verify the schema is absent from the live Data API exposed-schema allowlist.

The `FOR ALL` boundary narrows SELECT/UPDATE/DELETE through `USING` and INSERT/UPDATE through `WITH CHECK`. It does not grant any operation. Existing legacy rows with NULL Store IDs fail closed.

## 4. Command-specific grants

A Store boundary alone is insufficient. Add only the permissive operation policies that the role contract requires.

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| products | Owner/Manager/Staff | Owner/Manager | Owner/Manager | None |
| customers | Owner/Manager | Atomic order/customer command | Owner/Manager | None |
| orders | Owner/Manager/Staff | Atomic order command for authorized Store roles | Owner/Manager; Staff only through limited transition command | None |
| order_items | Owner/Manager/Staff | Atomic order command only | None | None |
| conversations | Owner/Manager/Staff | Trusted channel runtime only | Owner/Manager | None |
| messages | Owner/Manager/Staff | Trusted channel runtime only | None | None |

Column-sensitive actions (e.g. staff cannot change order total or product price) cannot be safely expressed by a row-only policy. Use column grants or narrow, audited transactional operations; do not grant broad table UPDATE and assume role checks protect individual columns.

No physical DELETE policy is proposed for operational business rows. Use audited state transitions/cancellation/archive.

## 5. UPDATE scope immutability

RLS `USING` checks the old row; `WITH CHECK` checks the new row. A user who belongs to both Store A and Store B could otherwise satisfy a new-row membership check while moving a row from A to B.

Required additional guard:
- immutable `tenant_id` and `store_id` on normal updates;
- a database trigger rejects scope reassignment;
- only a separately authorized migration/backfill operation may change legacy NULL `store_id` to a Store ID;
- no application writer may move an existing row between Stores.

An UPDATE also needs a corresponding SELECT policy. A denied UPDATE filtered by `USING` may return zero rows without an error; tests must assert both empty RETURNING output and unchanged target row.

## 6. Actor/Store truth table

`A` = Store A; `B` = Store B; both are in the same synthetic Tenant. A and B owners are distinct Auth users.

| Actor | Store A row | Store B row | Legacy NULL row | Store registry |
|---|---|---|---|---|
| anon | DENY | DENY | DENY | DENY |
| authenticated non-member | DENY | DENY | DENY | DENY |
| Tenant Owner, no Store membership | DENY | DENY | DENY | Tenant registry/admin only |
| Store A Owner | ALLOW by role matrix | DENY | DENY | A only |
| Store A Manager | ALLOW by role matrix | DENY | DENY | A metadata only |
| Store A Staff | ALLOW by role matrix | DENY | DENY | Minimal A metadata |
| Store B Owner | DENY | ALLOW by role matrix | DENY | B only |
| Store A membership revoked/expired | DENY | DENY | DENY | No operational access |
| Cross-Tenant actor | DENY | DENY | DENY | Own Tenant only |
| Tenant Owner with explicit A+B memberships | ALLOW in A | ALLOW in B | DENY | Both Stores |
| service_role / BYPASSRLS | RLS does not protect | RLS does not protect | RLS does not protect | Separate gateway/RPC controls required |

A Tenant Owner who is not explicitly a member of a Store may administer Store metadata and memberships but cannot query Commerce rows. A user explicitly assigned to both Stores may read both; this is an intentional multi-membership, not a bypass.

## 7. Role and command matrix

Legend: `R` = read; `W` = write through approved operation; `L` = limited command only; `—` = denied.

| Resource | Store Owner | Manager | Staff |
|---|---|---|---|
| Products | R/W | R/W | R |
| Customers | R/W | R/W | — (minimal order snapshot only) |
| Orders | R/W | R/W | R/L |
| Order items | R/W transactional | R/W transactional | R/L transactional |
| Conversations | R/W | R/W | R/L |
| Messages | R/W via channel command | R/W via channel command | R/L via channel command |
| Store membership | Manage Manager/Staff | — | Own row only |
| Provider status | Manage | Read | — |
| Provider secret | Never raw | Never raw | Never raw |
| Physical delete | — | — | — |

## 8. Membership table policies

Treat `stores` and `store_memberships` separately from Commerce rows:
- Tenant Owner may manage Store registry and membership administration for their Tenant.
- Store Owner may manage Manager/Staff membership for their Store, not another Store.
- Manager cannot promote Store Owners.
- Staff may read only their own membership row.
- Membership key columns are immutable; no physical delete; changes are audited.
- The last active Store Owner cannot be revoked/demoted while the Store remains active.

Use a non-exposed private authorization helper to avoid recursive RLS on membership lookups. If a SECURITY DEFINER helper is necessary, it must be minimal, pinned to `search_path = ''`, schema-qualified, check `auth.uid()`, have a non-exposed schema and tightly restricted EXECUTE grants. Review the owner/BYPASSRLS behavior explicitly.

## 9. service_role and channel runtime

Supabase `service_role` and other BYPASSRLS roles bypass RLS; table owners also normally bypass RLS unless FORCE ROW LEVEL SECURITY applies (superusers/BYPASSRLS remain exempt). Do not claim Store isolation is proven by an authenticated-role RLS test alone.

Required separate controls:
- never expose a secret/service key to browser or Messenger/Zalo customer;
- n8n must not accept tenant/store IDs from customer messages as authority;
- verify provider signature at ingress;
- resolve exact active installation server-side;
- pass a short-lived immutable internal context;
- expose only narrow Store-scoped commands, not unrestricted table access;
- validate capability and idempotency at every privileged operation;
- test forged Store ID, wrong installation, revoked installation, replay and cross-Store command negatives.

## 10. Minimum pgTAP test suite

Use a disposable PostgreSQL 17 fixture with one Tenant, Stores A and B, distinct Auth actors, manager/staff actors, one cross-Tenant actor, and one legacy NULL row.

Required cases:
1. A→A and B→B positive SELECT.
2. A→B and B→A negative SELECT.
3. Tenant Owner without Store membership cannot read Commerce.
4. Tenant Owner with explicit A+B membership can read both.
5. Non-member, revoked, expired, suspended Store and cross-Tenant actor denied.
6. Legacy NULL row invisible and cannot be updated.
7. Insert with NULL Store ID fails the NOT VALID check.
8. Store A order cannot reference Store B customer/product.
9. Store A order item cannot reference Store B order/product.
10. Store A message cannot reference Store B conversation.
11. Attempted Tenant/Store reassignment rejected even if actor belongs to both Stores.
12. Extra permissive policy is injected; restrictive boundary must still deny cross-Store.
13. Staff cannot update product price/stock or rewrite order total.
14. Physical delete denied for all operational roles.
15. Service-role/gateway tests are separate; do not label them RLS tests.

Supabase's current guide recommends per-operation RLS tests, explicit SELECT tests, `set local role` / `request.jwt.claim.sub`, and assertions that distinguish missing grants, WITH CHECK errors and USING filters. Never use `lives_ok` alone to prove a write; assert RETURNING rows and verify the persisted result.
