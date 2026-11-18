# TIEN404 AI — V19.0-B7-S1 × B7-H0 Checkpoint

**Date:** 2026-11-18 JST.
**Phase:** Safe Store Authority Closure Rehearsal × Private Hosted Canary Approval Readiness.
**Classification:** SOURCE-ONLY IMPLEMENTED / DISPOSABLE PG17 TESTED / HOSTED APPROVAL REVIEW ONLY / REAL STORE AUTH BLOCKED / PRODUCTION NO-GO.

## Prior verified checkpoint
- Parent V19.0-B7 Draft PR #436 OPEN, head f136f053e822222d2ebb678d1dcda640bd964659.
- Older V19 B2-B6 GitHub Drafts remain unchanged.
- V17.23U Worker deployed version 1d2666ac-3b4d-4fd2-9cba-0f05b65dd195 and deployment 8a43101c-39fa-40a0-a022-2528e54b2102. workers.dev and previews disabled.
- Existing B7 258 Node/Python + 15 disposable PostgreSQL assertions passed on PR #436; no hosted Worker Binding proof.
- Canonical Store authority design remains V18.3.6D PR #417 OPEN DRAFT (no actual Store schema migration).
- Supabase public Commerce tables lack store_id, use Tenant-scoped SELECT PERMISSIVE policies.
- Current public.save_merchant_product is SECURITY DEFINER, authenticated callable, tenant+sku writer only and has no store_id; current UNIQUE(tenant_id,sku) remains.

## Implemented (GitHub-only)
1. b7-s1/tests/pg17_six_table_store_compat.sql: independent PG17 ephemeral schema with six Commerce tables, composite Tenant/Store FK, NOT VALID new Store checks, legacy NULL quarantine, immutable scope trigger, restrictive RLS and synthetic Owner A/B/dual/Staff/revoked tests. Includes negative cross-Store FK, SKU uniqueness and legacy RPC-style NULL Store writer probes.
2. b7-s1/hosted-approval-preflight.mjs: form/readiness reviewer always returns deployAllowed=false, public route false, provider send false, production false; never validates an actual operator.
3. b7-s1/tests/hosted-approval-preflight.test.mjs: tests absent, contradictory, excessive and forged approvals.
4. Dedicated CI with disposable PostgreSQL 17 container and Node.js 22 only.
5. Writer compatibility report, B7-H0 approval-ready resource matrix, rollback runbook and this checkpoint.

## TESTED
- Initial B7-S1 run #44316615646 SUCCESS at commit 27063e7e9cb7a4080fd4abf0859dc1582abece5c: 16/16 hosted-approval contract Node tests, no failures.
- SQL produced B7_S1_PG17_DISPOSABLE_COMPAT_REHEARSAL_PASS. Assertions on all 6 tables, cross-Store negative FKs, current SKU constraint, new row Store check, scope trigger and legacy NULL rows succeeded.
- Prior B7 source blob immutability guard preserved.
- Recheck CI at final PR head after documentation changes; report only final observed result.
- Synthetic SET ROLE/current_user is NOT real Supabase JWT/Auth role proof.
- No production SQL or signed real membership evidence.

## VERIFIED live read-only evidence
- Existing source of truth PR #417 and recent Supabase schema/RPC metadata reviewed.
- gh-pages targeted website files app.js, saas.js, v4.js, ai-consultant.js, dashboard.html do not contain the literal save_merchant_product; this is NOT a complete caller inventory.
- Hosted Worker/D1 existing deployment unchanged at last read-only review. No hosted schema or provider changes in B7-S1.

## Outstanding P0/P1
- Full actual caller list and safe versioned cutover for public.save_merchant_product.
- Store local SKU decision D-02 and approved legacy mapping manifest.
- Canonical stores/store_memberships, Store IDs on all six Commerce rows, composite FKs and restrictive RLS in actual staging.
- Verified human Owner A/B Auth sessions and true negative Store cross-access tests.
- Approved merchant/provider installation binding proof.
- Independent approval for exact target NEW private hosted Worker, D1 binding, operator, budget, rollback and test window. H01–H16 hosted UAT NOT RUN.
- Encrypted real-event payload governance, durable downstream processor, provider retry semantics and Commerce write safety.

## Change/rollback
- GitHub branch only, no Supabase DDL, no Cloudflare deployment, D1 hosted write, Access/WAF change, n8n publish, Zalo webhook, customer/order data or credentials changed.
- Rollback = close/revert Draft PR. No cloud rollback needed.
- No automatic promotion to core. EXPERIMENTAL/CANDIDATE only.

**Next:** finish true writer inventory; request exact targeted B7-H approval only after identity/route resource design. Do not start hosted without scope signoff.

CHECKPOINT: V19_B7_S1_PG17_SIX_TABLE_REHEARSAL_PASS__H0_APPROVAL_PREFLIGHT_16_PASS__REAL_STORE_BLOCKED__HOSTED_BLOCKED__PRODUCTION_NO_GO.
