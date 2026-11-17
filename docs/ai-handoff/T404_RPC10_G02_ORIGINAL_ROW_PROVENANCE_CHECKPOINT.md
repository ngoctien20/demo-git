# TIEN404 — RPC.10-G0.2 Original Product/Order Provenance × Hosted Read-Only Evidence Gate

**Date:** 2026-11-17 JST  
**Lifecycle:** CANDIDATE / DRAFT / NO HOSTED CHANGE  
**Owner workflow:** [RPC.12 Draft #244](https://github.com/ngoctien20/demo-git/pull/244). G0.2 is read-only metadata and a gate for *missing* original source proof. It is not a new private owner ledger, migration tool, or authority registry.

## 1. Independently VERIFIED hosted metadata (read-only)

Actual staging project \`ifxlvrhyjhbzbrkdsida\` (PostgreSQL 17.11).
- 2 Tenants; 2 Products; 2 Orders; 0 Customers.
- Anonymous Tenant slot 1 has 1 Product, 1 Order, 1 source-labeled Order, 0 Customer-linked Orders, 2 active Tenant Owners, 0 agent config rows.
- Anonymous Tenant slot 2 has 1 Product, 1 Order, 1 source-labeled Order, 0 Customer-linked Orders, 1 active Tenant Owner, 1 agent config row.
- The actual Products schema includes \`id,tenant_id,sku,name,price_vnd,stock_on_hand,is_active,created_at,updated_at\`. None of \`store_id,created_by,source_ref,origin_ref\` exists on Products.
- The actual Orders schema includes \`id,tenant_id,customer_id,status,total_vnd,order_source,created_at,updated_at\`. None of \`store_id,created_by,source_ref,origin_ref\` exists on Orders.
- Three existing parent/child relational FK types (\`orders→customers\`, \`order_items→orders\`, \`order_items→products\`) use \`(tenant_id, id)\` or \`(tenant_id, referenced_id)\`; none enforces \`store_id\`.
- \`public.stores\`, \`public.store_memberships\` and \`public.audit_events\` do **not** exist. \`public.tien404_tester_audit\` is a QA audit surface and must not be interpreted as original Store ownership.
- \`app_private.order_idempotency\` contains 0 rows, with 0 records joining the actual hosted two Orders on both \`tenant_id\` and \`order_id\`.
- \`factory_private.events\` contains 0 rows; \`factory_private.agent_runs\` contains 0 rows.
- All 6 Commerce \`SELECT\` policies remain \`PERMISSIVE\` and lack any Store predicate; 0/6 tables have a \`store_id\` column.
- Above findings are specific to the inspected hosted sources: **they do not rule out valid origin documents held in merchant onboarding, external provider consoles, local archives or independently controlled private records**. No automatic Store attribution follows from an \`order_source\` label or Tenant Owner membership.

## 2. What was implemented

Files added to Draft [PR #247](https://github.com/ngoctien20/demo-git/pull/247):
1. \`qa/v152-rpc10/g02-provenance-hosted-READ_ONLY.sql\` — read-only transaction returning one sanitized aggregate JSON receipt with anonymous numeric Tenant slots. Explicitly avoids selecting actual row UUIDs, user identities, recipient refs, customer fields, private request keys/hashes, JWT or provider credentials.
2. \`qa/v152-rpc10/g02-hosted-provenance-sanitized.json\` — actual captured aggregate-only values; observation time \`2026-11-17T02:04:04Z\`. This record is a **snapshot**, not an independent attestation of human Owner.
3. \`qa/v152-rpc10/g02-provenance-readiness.cjs\` — pure local source-contract inspector. Rejects missing/extra properties, raw ID/credential fields, stale snapshots, inconsistent Tenant counts and Store schema, missing lineage and Tenant-scoped permissive policies. **All** \`canAssignStore, canBackfill, canMigrate, canRelease, canRevokeRpc\` stay \`false\`, even if a forged aggregate report self-claims complete evidence.
4. \`qa/v152-rpc10/g02-provenance-readiness.test.cjs\` — offline negative/unit tests.
5. Existing \`.github/workflows/v152-rpc10-six-surface-nohost.yml\` extended with Node tests, hard \`HOSTED_NO_GO\`, and SQL read-only/no-sensitive-field static gate.

The exact hosted aggregate SQL was executed through connected Supabase read-only, returning expected numeric/count values. **No original Product/Order row IDs or values were returned.**

## 3. QA evidence and interpretation

- **VERIFIED:** Direct Supabase schema/FK/source candidate presence, 0 idempotency records/linked Orders, 0 Factory events/runs, 2+2 rows, 6 tenant-only permissive read policies.
- **IMPLEMENTED:** read-only SQL source, sanitized receipt, fail-closed gate/test, CI step.
- **TESTED:** only when final exact source SHA CI job has been independently verified; do not claim green before checking.
- **BLOCKED G0:** Original primary source → *exact* four Product/Order records → canonical Store ID → authenticated merchant Owner + distinct independent reviewer. RPC.12 private machine and source inspection are the only authorized process; aliases, AI inference and screenshots cannot replace a human-approved record-level crosscheck.
- **BLOCKED G2:** Current independently restored app/Auth/Storage recovery, signed Controller/Operator/reviewer approval, complete writer/caller compatibility and authorization for each hosted phase. Prior H11R limited local application archive acceptance remains valid only within its old scope.
- **NOT TESTED G3:** real Owner/Manager Shop A/B JWT, service role behavior, SQL source and provider JWT/binding, same-Tenant Store read/write denial, full post-cutover rollback.
- **ROLLBACK:** close unmerged PR #247; no Supabase hosted RLS/DDL/DML or n8n Published changes made.

## 4. Exact follow-up for real private Operator (requires own authorization)

1. Reuse **RPC.12** runbook: \`docs/ai-handoff/V15_2_ADV6C_RPC12_PRIVATE_OPERATOR_RECOVERY_SCOPE_M1_RUNBOOK.md\` (PR #244). Do not create duplicate source intake. The User's old H11R archive scope remains independently insufficient to certify current hosted Auth/Storage restoration.
2. Privately inspect original merchant onboarding, source Purchase/Order event and provider/Store installation authority for each of the four existing source row IDs. A single origin label or Tenant membership proves neither Store ownership nor reviewer independence.
3. Obtain human-attested, independent reviewer-vetted mapping and digest, *outside GitHub/CI/ChatGPT*. If no immutable original source, mark the row **UNRESOLVED**, do not assign a Store.
4. Maintain server-trusted **n8n Tenant alias → canonical Supabase Tenant UUID → Store UUID** versioned registry, owned by Integration Team. n8n Commerce data tables and Supabase hosted use different IDs. Do not mix DEMO Google Sheets or directly use n8n aliases as an authorization claim.
5. Once G0 + current M0 recovery/authorization can be independently evidenced, run phase-scoped hosted schema M1 only with separate Controller/Operator approval; no automatic M2/M4/M3. Real JWT Store-level acceptance is subsequent work.

**Checkpoint:** \`RPC10_G02_HOSTED_ORIGINAL_PROVENANCE_AGGREGATES_VERIFIED__FOUR_ROW_OWNER_UNATTESTED_HOSTED_NO_GO\`.
