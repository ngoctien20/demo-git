# V18.3.6C — Trusted Store Authority Mapping Review

## Finding

**BLOCKED: current evidence does not establish two independent Stores under one Tenant.**

The R1 QA identity map contains two distinct Store/Bot scopes and two distinct `auth_tenant_id` values. Both target existing tenants and both have an active owner membership, but the maximum number of Store/Bot scopes per Auth Tenant is one. This is one QA Store per Tenant, not same-tenant Store A/B.

The two R1 bots are `dry_run` and `synthetic_qa`. The public `qa_owner_pairing` SECURITY DEFINER function hard-codes the two QA tuples and checks active owner membership before allowing the pairing action. That makes the data suitable for QA rehearsal only; it is not a canonical authority registry.

## Evidence that must not be conflated

| Evidence | What it proves | What it does not prove |
|---|---|---|
| R1 `tenant_identity_map` | QA Bot/Store scope maps to an existing Auth Tenant | Same-tenant multiple Stores; production ownership |
| R1 `owner_bindings.status='paired'` | QA pairing workflow reached paired state | Real provider account ownership or signed merchant consent |
| R1 `owner_pairing_claims_v3` | Synthetic challenge claim state | Independent Auth A/B sessions |
| V17.5 private tables | Intended schema for customer/channel/order ownership QA | Any live ownership; all eight tables currently have zero rows |
| Supabase `tenant_memberships` | Tenant-level active membership | Store-level membership or store-specific owner scope |
| n8n Commerce DataTables | Sandbox tenant/channel/product config | Provider-authenticated identity or Store authority |

## Current authority gaps

1. No canonical `public.stores` table.
2. No canonical `public.store_memberships` table.
3. No `store_id` in six public Commerce tables.
4. No `storeId`/`storeKey` in any of the 16 TIEN404 Commerce DataTables.
5. R1 maps one Store to each of two different Auth Tenants.
6. No real owner-approved, time-bounded Store consent receipt was verified in this audit.
7. No independent real Auth A/B session was inspected or validated.
8. No active provider credential reference is populated in the six Commerce channel rows.
9. No Supabase Storage bucket/object exists for Store-level media intake.

## Proposed canonical authority contract (design only)

- `stores`: `id`, `tenant_id`, stable slug, status, timezone, timestamps; enforce unique `(tenant_id, id)` and unique `(tenant_id, slug)`.
- `store_memberships`: `tenant_id`, `store_id`, `user_id`, store role, active/revoked state, approval timestamp and approver; enforce composite FK to the same Tenant's Store and FK to Auth user.
- Keep tenant-level owner/admin authority distinct from Store-level owner/manager/staff. Define whether tenant owner inherits all Store scopes; do not infer inheritance.
- Add nullable `store_id` to Commerce records only after backup and approved migration plan; add composite `(tenant_id, store_id)` foreign keys. NULL means legacy/unmapped, not default Store A.
- Replace/restructure tenant-wide RLS policies. Do not merely add permissive Store policies: permissive policies OR together. Use an explicitly reviewed restrictive predicate or a safe policy cutover with negative A→B and B→A tests. UPDATE requires both SELECT visibility and `USING` + `WITH CHECK`.
- Resolve authority server-side from verified provider installation + signed webhook context + active Auth session + canonical tenant/store membership. Ignore caller-supplied `store_id`, accountId alone, and user-editable user metadata.
- Owner consent receipt must bind exact tenant/store/provider installation/scope, actor, reviewer, timestamp, expiry, revocation status and evidence hash. Never store bearer credentials in the receipt.
- Keep unapproved legacy rows unmapped and invisible to Store-scoped users.

## Required admission sequence

1. Design and review canonical schema and RLS policy truth table.
2. Obtain backup/PITR evidence and migration approval before any staging DDL.
3. Create disposable same-tenant Store A/B fixture with distinct Auth actors and independent Store memberships.
4. Verify two real Auth sessions server-side without exposing tokens; verify issuer, audience, subject, session validity and expiry.
5. Test A→A/B→B positive reads; A→B/B→A, cross-tenant, missing membership, revoked, expired, wrong provider installation, forged Store ID and replay negatives.
6. Obtain each Store owner's explicit mapping approval; backfill only approved records.
7. Run read-only dual-read and compare evidence before considering writer cutover.
8. Approve production writer compatibility and provider permissions separately.

No step above is authorized by this audit. Staging migration, backfill, writer cutover, provider send and release remain NO-GO.
