# TIEN404 AI — V19.0-B7-S4 Checkpoint

**Date:** 2026-11-19 JST
**Workstream:** Render Caller Closure × Trusted Owner A/B Auth Verification × Store Authority Migration Readiness.
**Truthful decision:** READ-ONLY METADATA VERIFIED / MIGRATION PLAN + OFFLINE QA IMPLEMENTED / DISPOSABLE PG17 TESTED / RENDER CALLER CLOSURE BLOCKED / SAME-TENANT REAL OWNER A/B BLOCKED / SUPABASE MIGRATION NOT APPROVED / PRODUCTION NO-GO.

## 1. Prior checkpoint and source authority
- Parent V19.0-B7-S3 Draft PR #452, start SHA 6f488945ca8f7d41acd3dcef6aab3148b90f8668.
- Canonical Store Authority proposal V18.3.6D PR #417 remains OPEN DRAFT, and its migration plan, restrictive RLS truth table and legacy manifest policy were read; no parallel Store model built.
- B7-S2 candidate RPC still exists ONLY in disposable PostgreSQL \`b7s2\` test fixture, with intentionally forgeable custom GUC Auth shim; NEVER deploy unchanged.
- Existing public V1 RPC and Cloudflare Worker not changed by S4.

## 2. Current VERIFIED connected-state facts (read only)
- Supabase project tien404-staging PostgreSQL17, live public table counts (aggregated, no rows read into this PR): products=2, orders=2, customers=0, order_items=0, conversations=0, messages=0.
- All six Commerce tables have Tenant ID, no Store ID, RLS enabled/FORCED, one PERMISSIVE SELECT policy each and no RESTRICTIVE Store policy.
- public.stores, public.store_memberships and app_private.store_channel_installations absent; conversations.channel_installation_id absent.
- public.save_merchant_product exists and is tenant/SKU only, SECURITY DEFINER, owner postgres; authenticated EXECUTE, anon denied. Tenant-wide product SKU uniqueness remains.
- Supabase \`tien404-r1-owner-preflight\` Edge Function v2 is ACTIVE with verify_jwt=true and auth.getUser() logic but only Tenant-level membership, no Store membership lookup.
- R1 Shop A/B test mapping in PR #417 represents two different Auth Tenants, not two Stores in the same Tenant. This cannot count as real same-Tenant Owner A/B UAT.
- Render \`list_workspaces\`: one workspace named **My Workspace**. \`list_services({})\` refused with \`no workspace selected\` and explicitly directed us to get user workspace confirmation. No workspace was selected, and no Render services were queried, inspected or changed.
- S3 inventory (37 gh-pages source blobs, 17 selected n8n workflows) remains a bounded negative scan, not complete caller closure.

## 3. IMPLEMENTED — new GitHub QA branch only
- staging-readonly-snapshot.json: non-PII metadata and six aggregate counts; explicit unknown admission flags.
- migration-readiness-audit.mjs: pure fail-closed migration plan evaluator, no DDL/deploy capability, always denies real Auth/store authority.
- tests/migration-readiness-audit.test.mjs: 15 negative cases, including forged VERIFIED/approvals, missing Store IDs/RLS, Render caller missing, no backup and D-02.
- tests/pg17_legacy_migration_validation_gate.sql: isolated PostgreSQL17 test demonstrating \`VALIDATE CONSTRAINT\` denies NULL legacy and normal scope reassignment blocked, no backfill performed.
- GitHub Actions workflow: S4 + S3 Node regressions, S1/S2/S3 PG17 composite FK, RPC, GUC spoof and rollback regressions, immutable Worker source guard.
- Render caller closure runbook, two-stage real Owner A/B Auth plan, PR417-governed migration readiness and fail-closed rollback document.

## 4. TESTED
- Successful GitHub Actions #44509783209 on intermediate commit f3b4cfc341dd44c7bc1a975eafa7719b3af029e1:
  * B7-S4 Node.js 15/15 PASS.
  * B7-S3 Node.js 13/13 PASS.
  * B7-S1 PG17 six-table Store FK/RLS PASS.
  * B7-S4 legacy NOT VALID validation and automatic mapping refusal PASS.
  * B7-S2 versioned RPC on synthetic schema PASS.
  * B7-S3 GUC impersonation test shim negative QA PASS.
  * B7-S2 rollback transaction PASS.
  * No failed steps or SQL errors.
- Re-verify a fresh CI run on final PR HEAD before final completion claim.

## 5. P0 blockers / approvals
- Render requires explicit user choice **My Workspace**. Do NOT self-select an ID, even if only one workspace is present.
- Actual Render services, private RPC caller tracing and external client census are still UNKNOWN. No V1 cutover allowed.
- Existing two R1 QA owner contexts are NOT same-Tenant A/B Store proof. No real signed independent same-Tenant Owner A/B sessions, Store registry, Store RLS or provider installation proof.
- Real Store schema migration is not authorized; backup/PITR restore evidence, exact change ticket, D-02 SKU decision, V1 writer closure, per-row mapping manifest and independent reviewer all missing.
- No real customer payload processing, order/inventory writes, hosted Worker Binding UAT, webhook registration or provider sends are permitted.

## 6. Changes and rollback
- Only new GitHub branch/CI and disposable GitHub Actions PostgreSQL17 service.
- No Render service mutation, Supabase DDL/DML, customer records/JWTs, n8n workflow publish, Cloudflare D1/Worker, billing or live Zalo/Messenger webhook changes.
- Code rollback is closing/reverting the Draft PR; no cloud rollback needed.
- For future actual staging changes, pre-authorize backup, rollback, resources, budget, human operator, exact scope and stop criteria.

## 7. Next authorized steps
1. Ask user to confirm **Render My Workspace** for read-only service inventory. Then inspect deployed source, RPC traces and caller chain without exporting secrets.
2. Keep real Owner A/B Auth preflight separate from Store RLS: authenticated subject validation can be designed before migration, but same-Tenant Store A/B test requires actual approved Store registry/memberships and signed QA sessions after migration.
3. Obtain D-02 business decision and approved PR417 staging migration plan with tested backup/restore.
4. Only then request exact-scope authorization for any staging SQL; production remains NO-GO.

**Checkpoint:** \`V19_B7_S4_RENDER_WORKSPACE_CONFIRMATION_REQUIRED__OWNER_AB_REAL_AUTH_NO_GO__MIGRATION_PG17_QA_PASS__PRODUCTION_NO_GO\`.
