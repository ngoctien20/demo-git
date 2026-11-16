# TIEN404 AI — V15.2-ADV.6C-RPC.5
## Real Private Operator Evidence Review × Hosted Store Isolation Remediation Plan × Canary Approval Preflight

**Date:** 2026-11-16 JST
**Branch status:** DRAFT / SOURCE ONLY / NO SEND / NO HOSTED DDL / NO LIVE JWT / NO BACKUP EXPORT
**Parent:** RPC.4 PR #187, HEAD `ad48f13e0394e527202a27c0a145a9368942c844`.
**Project:** Supabase staging `ifxlvrhyjhbzbrkdsida`.

## 1. VERIFIED — direct read-only current state

### Database
Table | Rows | Store scope | RLS | Important constraint
---|---:|---|---|---
tenants | 2 | n/a | FORCE | tenant key
tenant_memberships | 3 | tenant only | FORCE | tenant/user PK
products | 2 | `tenant_id` only | FORCE | UNIQUE (tenant_id,sku)
orders | 2 | `tenant_id` only | FORCE | FK (tenant_id,customer_id)
customers | 0 | `tenant_id` only | FORCE | UNIQUE (tenant_id,id)
stores | absent | n/a | n/a | n/a
store_memberships | absent | n/a | n/a | n/a
auth.users | 3 | not mapped to two independent Store owners | separate Auth | account count is not proof

Current products policy `products_member_read` checks only tenant membership. `orders_manager_read` / `customers_manager_read` also check tenant, not Store. `anon` has no SELECT on the Commerce tables; `authenticated` has SELECT but no direct INSERT/UPDATE in the checked tables. **Enabling a new Store policy WITHOUT removing the older permissive Tenant policy makes both policies OR together and can permit Shop A reading Shop B**. This was already demonstrated on disposable PostgreSQL in V14.4.1.

Other material constraint: `UNIQUE(tenant_id,sku)` blocks Shop A and Shop B sharing the same SKU; an exact switch to `UNIQUE(tenant_id,store_id,sku)` must be staged after caller compatibility and data backfill. The existing Order FK `(tenant_id,customer_id)` does not stop same-tenant cross-Store customer references.

### Caller / RPC
- `public.qa_shop_b_zalo_claim(uuid,text,text,text)` remains SECURITY DEFINER callable by `anon`. Existing shared Vault secret guard is not proof of end-to-end provider identity. This is an attack surface warning, not proven exploitation.
- n8n Published `yIJk8LvJoLF40Z62` V1 and `OgDZNSAvKEvhnAvn` V2 Shadow still form an Active chain to the enabled HTTP POST RPC node `Submit pending claim for Shop B`; unchanged.
- RPC.2 inspected 114/114 accessible n8n Draft/Published, 23 accessible Worker script representations and one Edge function. Exact direct n8n caller found, but historic/other accounts/dynamic/external clients NOT certified.
- `track_functions=none`; zero tracked calls cannot certify that there are no actual requests. The exact previous 24h window yielded 3 PostgreSQL literal marker logs and zero named PostgREST matches; markers NOT reliable provider-call count.

## 2. INDEPENDENT OPERATOR EVIDENCE REVIEW — still BLOCKED

Evidence available here is direct read-only **metadata** and public source, not operator-controlled primary evidence. No actual private log files, independent signing trust enrollment, real Owner JWTs, encrypted backup receipt or out-of-band reviewer account were supplied/accessible. No private evidence was invented.

`qa/v152-rpc5/hosted-schema-readonly-baseline.json` contains **only redacted aggregate/schema metadata**. `qa/v152-rpc5/hosted-store-remediation-preflight.cjs` checks all 8 primary evidence domains through opaque references and digests, but even an all-green self-reported packet stays **CLAIMED_REFERENCES_NEED_PRIMARY_SOURCE_REVIEW** rather than VERIFIED.

Required real primary evidence classes (privately reviewed, not pasted into chat/repo):
1. Actual n8n Published and Draft workflow call graph / archived versions, credential **type** only, approved current trace.
2. Real Cloudflare Worker versions, bindings, routes and relevant dynamic request audit across all owned accounts.
3. Supabase PostgREST request logs in a concrete time window, actual route attribution and source context; not PostgreSQL function-name substring alone.
4. Manual operator scripts, deployment hooks and old external integrations.
5. Third-party REST consumers / legacy clients and intended decommission status.
6. Four-row owner mapping for hosted **2 Products + 2 Orders**, reviewed independently; private row keys must not appear in GitHub. Customers currently 0, but recheck before backfill.
7. Approved encrypted backup/export receipt + independent isolated restore evidence, explicitly separate from migration approval.
8. Actual Auth Owner A/B JWT GET-only positive/negative and revoked staff proof; official provider signed webhook and replay evidence.

Security Reviewer must independently inspect original evidence and verify provenance, freshness, owner/store binding and signer trust — a SHA-256 or Ed25519 signature on a JSON claim alone is NOT sufficient.

## 3. IMPLEMENTED — Targeted Store isolation remediation **design** (DO NOT APPLY)

File `docs/ai-handoff/V15_2_ADV6C_RPC5_STORE_ISOLATION_MIGRATION_DO_NOT_APPLY.sql` has a non-executable, entirely commented migration plan with exact source references, not a live migration.

- **M0** Authorized encrypted backup + isolated restore + independent Store-to-row mapping; leave ambiguous mappings **BLOCKED**.
- **M1** Add `stores`, `store_memberships` with composite Tenant/Store/Owner constraints, FORCE RLS and self-readable assigned memberships; add nullable `store_id` to Products/Orders/Customers; no public write privileges.
- **M2** Private operator-only verified assignment of exactly two Products and two Orders to canonical Stores; **never infer Shop from SKU, LLM, or order_source**. Recheck Customer count before changing schema.
- **M3** Composite FK for Products/Orders/Customers to Stores; **Order (tenant_id,store_id,customer_id)** references **Customer (tenant_id,store_id,id)**; staged unique (tenant_id,store_id,sku) and removal of tenant-only SKU constraint only AFTER validated writer cutover. NULL Store must fail closed; enforce NOT NULL after validation and backfill.
- **M4** Single transactional removal of three permissive tenant-only SELECT policies and creation of Store-level SELECT policies; ensure no RLS-recursive policy or hidden SECURITY DEFINER bypass. Preserve no client UPDATE/INSERT grants. Use store role for Orders/Customers.
- **M5/M6** Authoritative server Store/Owner identity, four distinct hosted GET-only JWT sessions, positive/negative Shop A/B same-tenant and Shop C cross-tenant reads, revoked membership; private provider gateway and atomic two-step pairing; shadow with no dual-write, then separately approved single-writer canary and rollback.
- **M7** Only after canary and independent operation-specific approval, consider revoking PUBLIC/anon EXECUTE on exact legacy RPC. No automatic regrant during rollback.

## 4. IMPLEMENTED — Real disposable database QA; reuse V14.4.1

Existing `qa/hosted-readiness-v1441/EPHEMERAL_PG17_CI_ONLY.sql` and `ci-pg17-rls.sh` are **reused**, not rebuilt. They already test:
- same-Tenant Shop A/B separate price/stock with identical SKU;
- cross-Tenant Shop C / revoked staff;
- wrong Store insert/update denied;
- a deliberate temporary tenant-wide permissive policy leaks Store B; removing it restores RLS.

New `qa/v152-rpc5/ci-pg17-customer-store-fk.sh` extends this **same disposable PG17** fixture:
- synthetic Store A and B customers share a Tenant but have distinct Store IDs;
- legacy tenant-only Order→Customer FK permits a wrong-Store reference **inside a rolled-back test transaction**;
- composite Tenant+Store+Customer FK blocks that same wrong-Store reference;
- RLS role A/B/C sees only its own Customer; unassigned sees none; customer joins stay Store-specific; client INSERT grant absent.

This is real PostgreSQL constraint evaluation in an isolated disposable service — **NOT real Supabase Auth JWT or hosted migration verification**.

## 5. Canary preflight (PROPOSED, NOT APPROVED)

`qa/v152-rpc5/hosted-store-remediation-preflight.cjs` evaluates actual schema baseline, 8 evidence domains, exact 4-row private backfill ledger shape, shadow parity and 14 explicit preconditions. It always returns `canaryAuthorized=false` and `rpcRevokeAuthorized=false`.

**Approval chain and stop conditions:**
- No real canary until verified Controller, independent Security Reviewer, named DB Operator, exact staging environment and publication owner approve the specific change window and rollback.
- Stop immediately at Store/JWT mismatch, unauthorized Owner confirmation, replay duplicate, unexpectedly mutated orders/stock or violated Store FK; no tolerated cross-Store data exposure.
- Only **one authoritative pairing writer** for each event; shadow may compare decisions but never issue a second write.
- Preserve exact old Published workflow snapshots; cutover and rollback operations must be independently authorized, separately from backup/export and RPC REVOKE.
- Rate limits, cost ceilings, monitoring thresholds and rollout percentages require explicit approved values; none were guessed from unmeasured traffic.
- Real time measurements and zero-downtime certificate remain **BLOCKED** until actual approved hosted acceptance.

## 6. QA, approvals, checkpoint

- New source unit tests, inherited V14.4.2 migration and JWT opt-in unit tests, and inherited RPC.2-4 gates run on GitHub Actions. Mark PASS only after exact commit logs are checked.
- New disposable PG17 Store FK script runs after inherited V14.4.1 real PostgreSQL RLS tests; no production connection.
- Job for hosted canary intentionally FAILS `NO_GO` as a release-denial policy.
- **No actual signed independent Operator evidence reviewed**, no real-hosted JWT, no backup, no GRANT/RLS/migration, no n8n Published change, no Cloudflare deployment, no Meta/Zalo sends, and no merge.
- Rollback: Close child Draft PR; because only source and disposable CI change, no hosted restoration required.
- Checkpoint `V15.2-ADV.6C-RPC.5-STORE-PLAN-DRAFT`.
- Next operation requires independent private evidence and operation-specific approval. Do not advance a real canary based on a synthetic GREEN result.
