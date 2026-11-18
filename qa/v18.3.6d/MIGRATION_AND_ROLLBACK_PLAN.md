# V18.3.6D — Migration Admission and Rollback Plan

**Status: PLAN ONLY — no migration file generated, no DDL executed.**

## Phase 0 — Admission and backup

Required before any staging write:
- fresh read-only schema, constraint, policy, grants and migration-history snapshot;
- Supabase backup/PITR status and verified restore path;
- exact current migration head and Git commit SHA;
- independent reviewer and change window;
- separate approval for staging DDL;
- disposable PostgreSQL 17 replay updated from the approved design.

If backup/PITR evidence or restore test is unavailable, stop.

## Phase 1 — Canonical registry

After approval, create:
- `public.stores`;
- `public.store_memberships`;
- private append-only authority audit;
- private minimal membership helper functions;
- Store registry and membership RLS/grants.

Do not seed real Store A/B. Use disposable synthetic fixtures first. Keep existing `tenant_memberships` unchanged.

## Phase 2 — Additive Commerce schema

Add nullable `store_id` to the six Commerce tables. Add:
- `UNIQUE (tenant_id, store_id, id)` keys on referenced parents;
- composite Tenant+Store FKs listed in `CANONICAL_STORE_AUTHORITY_DESIGN.md`;
- targeted indexes for Store membership lookup and each composite FK's referencing columns;
- composite FK constraints as `NOT VALID` initially where the live legacy rows require a staged validation;
- `CHECK (store_id IS NOT NULL) NOT VALID` on operational tables.

PostgreSQL validates a NOT VALID CHECK/FK against new or updated rows while deferring the scan of existing rows. The NULL Store rows remain legacy; a composite FK using MATCH SIMPLE does not prove ownership for a row with a NULL key. The Store RLS boundary denies those rows.

Do not set `store_id NOT NULL` while unmapped legacy rows remain in the operational table. Validate the CHECK and set NOT NULL only after every row has been mapped or moved by a separately approved archive/quarantine process.

## Phase 3 — Authority and channel adapter

- Register each Store with an explicit Tenant Owner approval.
- Add explicit Store memberships for each real actor.
- Verify channel provider ownership and install records privately.
- Build the trusted resolver so it returns Tenant + Store from verified identity/installation.
- Keep n8n DataTables as sandbox configuration only; do not promote them to authority.
- Do not reconnect Messenger's legacy Google Sheets writers in this phase.

## Phase 4 — Legacy mapping

- Prepare private manifest rows.
- Require exact Store owner approval and independent review.
- Re-read and hash each source row at apply time.
- Backfill only exact reviewed records with `store_id IS NULL`.
- Quarantine ambiguous/conflicting rows.
- Validate composite FKs and compare aggregate counts/hashes.
- Never infer a Store from Tenant, channel, SKU, customer details or workflow routing.

## Phase 5 — RLS cutover

1. Create the restrictive Store boundary on all six Commerce tables.
2. Verify it applies to the intended roles and commands.
3. Preserve a valid permissive policy for each operation that should be allowed.
4. Add role-specific INSERT/UPDATE policies only where required.
5. Keep physical DELETE denied.
6. Add immutable Tenant/Store scope enforcement.
7. Run the complete pgTAP suite and negative same-Tenant A/B tests.
8. Review grants, function ACLs, Data API schema exposure, view security and service-role paths.
9. Only then admit read-only UAT.

Do not add a permissive Store policy and assume it narrows the existing Tenant policy. Do not remove the old policy until the restrictive boundary and tests are active. Do not enable a production writer as part of this phase.

## Phase 6 — Writer cutover (separate approval)

Messenger, Zalo and Website must call one trusted Store-aware adapter. Every operation validates:
- canonical Tenant + Store;
- actor type and Store membership or verified installation;
- capability for the requested operation;
- immutable scope;
- order/inventory invariants;
- idempotency/replay;
- audit/outbox atomicity.

A service-role key bypasses RLS. Keep it server-side and do not expose general table access to n8n customer-facing workflows. Prefer narrow operations with explicit authorization and no caller-selected Store.

## Rollback

### Before RLS cutover
- Stop new writes to the candidate Store path.
- Leave additive schema inert; do not drop tables/columns automatically.
- Revert the app adapter to the last verified version.
- Preserve audit and mapping manifest.

### After RLS cutover
- Fail closed: disable Store writes and keep the restrictive Store boundary.
- Roll back to a prior known-good Store-aware policy version only after review.
- Never remove the Store restrictive policy and restore broad Tenant-wide reads as a normal availability rollback; that can expose Store A rows to Store B.
- Use maintenance mode if a safe Store-aware policy rollback is unavailable.

### Backfill rollback
- Reverse only exact rows applied by the batch and still matching the post-apply hash.
- Respect parent/child dependencies.
- Do not erase owner approvals or audit evidence.
- If a row changed after mapping, quarantine rather than reverse automatically.

## Release gates

| Gate | Evidence required |
|---|---|
| Backup | PITR/backup evidence + restore rehearsal |
| Schema | PG17 disposable replay and live diff |
| Authority | two distinct Store Owners under one Tenant, independently verified |
| RLS | full pgTAP truth table including injected extra permissive policy |
| Constraints | validated composite FKs, no cross-Store child references |
| Legacy | owner-approved manifest, hash compare, zero unapproved backfill |
| Channels | verified installation, signed webhook, replay and wrong-Store negatives |
| n8n | no unscoped legacy writer, Store context immutable |
| UAT | real Auth A/B read-only only after separate approval |
| Production | separate explicit release approval |

No gate in this document is marked passed by the design artifact itself.
