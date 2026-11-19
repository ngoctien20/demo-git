# TIEN404 AI — V19.0-B7-S2 Checkpoint

Date: 2026-11-19 JST.
Phase: RPC Store-Aware V2 Compatibility × Safe Writer Cutover Rehearsal × Rollback QA.
Status: SOURCE-ONLY IMPLEMENTED / PG17 DISPOSABLE TESTED / REAL STORE AUTH BLOCKED / HOSTED WORKER BLOCKED / PRODUCTION NO-GO.

## Baseline and inheritance
- Parent PR #440 OPEN DRAFT, QA baseline commit 42f153dd6f2f76a69ac4cb394aa02a4b8f8378f9; B7 #436 parent, PR #417 remains canonical Store Authority design.
- B7-S1 six-table Store FK/RLS disposable QA PASS on prior head. No production migration.
- Original deployed Cloudflare Worker V17.23U version 1d2666ac-3b4d-4fd2-9cba-0f05b65dd195, public routes workers.dev and previews disabled at last read.
- Original B2 source hash 11affa7658b46ae7c411eed7877d7ccdce61bbad checked by CI.
- Public Supabase Commerce still has zero store_id columns across its six major tables at this checkpoint. Existing SECURITY DEFINER product RPC is Tenant+SKU scoped, not Store scoped.

## New source-only work
1. tests/pg17_versioned_store_writer_qa.sql: disposable b7s2 schema, synthetic Tenant and Store membership fixtures; versioned Store-aware product writer, strict price/stock input checks and expected_updated_at CAS.
2. Synthetic actors cover Owner A/B, Manager A, Staff, revoked/expired owner, Tenant Owner without Store membership and suspended Store.
3. QA role has no direct product/audit table rights; the candidate narrows writes by (tenant,Store,actor) before mutation.
4. tests/pg17_rollback_transaction_qa.sql: transaction rollback of QA-namespaced function only, verifies rollback restores source and synthetic data.
5. CI workflow for PostgreSQL17 candidate + B7-S1 six-table regression and immutable Worker snapshot.
6. RPC_V2_SECURITY_COMPATIBILITY.md documents contract, current V1 behavior, risks, incomplete caller inventory and release gates.

## Initial TESTED evidence
- GitHub Actions run #44501044949 SUCCESS at source commit b5a312457ecb8e8633e26edc17f0d04faba22cfb.
- QA source and disposable PostgreSQL17 checks PASS: 19 labeled writer checks, transactional rollback and B7-S1 composite FKs/RLS.
- No errors in CI logs and three checkpoint labels were present:
  * V19_B7_S2_VERSIONED_STORE_WRITER_PG17_OFFLINE_PASS
  * V19_B7_S2_VERSIONED_RPC_ROLLBACK_REHEARSAL_PASS
  * B7_S1_PG17_DISPOSABLE_COMPAT_REHEARSAL_PASS
- Final PR HEAD CI must be rechecked separately after documentation and PR creation.

## Strong limits
- The local function is in synthetic b7s2, never deployed to public Supabase.
- The helper reading request.jwt.claim.sub is a **FORGEABLE TEST STUB**. It must never be used as production authentication or called proof of real Owner A/B Auth. Real writer must use verified auth.uid() and PR #417 canonical Store authority, reviewed SECURITY DEFINER ownership.
- V1 product writer was NOT modified. No migration of Tenant-wide UNIQUE(tenant_id,sku); decision D-02 remains OPEN.
- Selected n8n workflows (Commerce AI Core, Messenger, DEMO order tool and four inactive Supabase/adapter QA workflows) were inspected read-only. No literal V1 RPC call observed in those selected nodes. NOT an exhaustive n8n or Render caller inventory.
- Render workspace selection is required by its connector before inspecting services; no service workspace was chosen.
- No actual customer records/JWTs, hosted D1 mutations, Zalo sends or Commerce writes.

## P0/P1 unresolved
- Real Store schema/membership and Store A/B authenticated RLS tests.
- V1 caller inventory across Render, website, Supabase/Edge Functions, all n8n tool graph and external clients.
- D-02 product SKU policy, legacy mapping, immutable FK compatibility and migration rollback.
- Versioned RPC production-level security review and safe old/new dual-read/no-write cutover evidence.
- Exact-scope hosted Worker Binding target/identity/budget/rollback approval.
- Durable real provider event payload handling and downstream order idempotency.

## Safety / rollback
- Only GitHub QA branch / Draft PR + temporary GitHub Actions database changed.
- No Supabase migration/DDL/writes, Cloudflare deployment/bindings, credential change, published n8n edits, live webhook registration, provider send, production or pricing/inventory/customer data mutation.
- Closing or reverting the Draft PR rolls back new source; no hosted rollback necessary.
- The local disposable Postgres service is discarded automatically by Actions.

Next phase proposal: B7-S3 — Complete Writer Caller Inventory × Versioned RPC Contract Review × Authenticated Owner A/B Store-RLS Evidence. B7-H hosted remains separate and awaiting explicit target/operator approval.

CHECKPOINT: V19_B7_S2_VERSIONED_RPC_PG17_AND_ROLLBACK_PASS__LIVE_V1_UNCHANGED__REAL_AUTH_BLOCKED__HOSTED_BLOCKED__PRODUCTION_NO_GO.
