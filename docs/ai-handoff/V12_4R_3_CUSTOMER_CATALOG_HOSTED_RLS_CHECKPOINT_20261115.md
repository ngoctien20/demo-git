# TIEN404 AI V12.4R.3 — Hosted Customer Catalog / RLS QA Checkpoint

**Date:** 2026-11-15 JST (~07:23 JST). **Stage:** EXPERIMENTAL + CANDIDATE SOURCE QA, hosted Customer backend **BLOCKED**.
**Source branch:** work/v124r3-hosted-catalog-readiness-20261115, commit c5bb8156aab0a592fda41c72e08ccc9ab22b231c.
**PR:** Draft #64 https://github.com/ngoctien20/demo-git/pull/64 (targets Customer retention PR #62 branch; PR #52 and Owner PR #41 NOT merged).
**Before-change rollback:** checkpoint/v124r3-before-hosted-catalog-rls-20261115.

## Scope / responsibility lock
- Owner Shop B identity, Owner sessions and associated RLS remain solely under PR #41.
- Customer Core catalog and conversation work remains under PR #52 and successor source-only draft PRs #62/#64.
- The V12.5 Tester Portal and Messenger Clone were not edited.
- No n8n workflow changes, model calls, customer data writes, notifications, payments or production changes.

## VERIFIED — Supabase staging read-only
- Project: tien404-staging / ifxlvrhyjhbzbrkdsida.
- public.products has tenant_id (UUID) but NO store_id. Cannot satisfy full tenant/store/bot/SKU Core contract by itself.
- public.products RLS enabled + forced, authenticated SELECT restricted by active public.tenant_memberships and auth.uid(); anon has no table SELECT. Policy inventory and grants were read, not changed.
- Auth-role SQL simulations within BEGIN READ ONLY / ROLLBACK for one current member of each distinct tenant: both saw 1 own product, 0 other-tenant product. Unknown synthetic UID saw 0. Forged request.jwt.claim.tenant_id for another tenant saw 0, own row 1. **This is SQL role/claim simulation, NOT full JWT/browser Customer E2E.**
- Internal tien404_r1_qa.catalog has 2 synthetic F01 records with (tenant,store,bot) scopes: Shop A 159000 VND/stock 3; Shop B 199000 VND/stock 5. Both bindings dry_run and synthetic_qa. These are fixture values, not merchant operational catalog.
- Internal QA catalog and shop_bots tables have RLS enabled with no Customer SELECT policies; anon, authenticated and service_role cannot SELECT internal QA catalog. Their schema privileges remain closed to browser roles.
- Post-change final readback: 0 newly-created tien404_customer_*_ro roles, 0 policies on internal catalog/shop_bots, anon/authenticated USAGE false, authenticated catalog SELECT false, 2 synthetic QA products. No hosted database DDL, GRANT, credential, policy changes.
- Supabase security advisor was read; the existing informational no-policy notices include intentionally private QA tables. No new advisor claim or public privilege increase.

## IMPLEMENTED on PR #64 (source-only)
- qa/commerce/v124-core/hosted-catalog-guard.cjs: optional, not exported from core index and not wired to live backend. Checks verified WeakSet Customer context + transaction-owned client; exact server-selected expected PostgreSQL role; rejects postgres/service_role and unsafe names; validates actual current_user, rolsuper=false, rolbypassrls=false, row_security_active on both internal QA catalog and bot mapping, zero secret-column SELECT and no catalog INSERT/UPDATE/DELETE privileges; checks scope and SKU before returning a product. Source never requests service_role or exposes keys.
- qa/commerce/v124-core/hosted-catalog-guard.test.cjs: invalid Customer context, missing client, role mismatch, superuser, bypass RLS, RLS off, credential_ref privilege, catalog write privilege, wrong tenant/store/bot, invalid role mapping.
- qa/commerce/v124-core/hosted-rls-readonly-audit.sql + hosted-rls-audit.test.cjs: reproducible hosted SQL audit for two distinct tenant memberships, denied unauthorized UID and anon, with no DDL/DML.
- Existing QA PostgreSQL 17 fixture now models credential_ref and catalog_source_ref columns, but grants only column-level SELECT required by the Core; no permission on credential_ref.
- New actual PostgreSQL 17 regression verifies two shop roles use the same SKU without leaks, rejects mismatched role and asserts no privilege to select bot credentials.
- README and version QA suite bumped to 12.4R.3-hosted-rls-gate; lifecycle remains EXPERIMENTAL.
- docs/ai-handoff/V12_4R_3_CUSTOMER_HOSTED_RLS_APPROVAL_PROPOSAL.md: review-only future two-shop NOLOGIN role and RLS policy SQL, backup prerequisites and rollback steps. **Proposal SQL was NOT APPLIED.**

## TESTED — evidence
- GitHub Actions https://github.com/ngoctien20/demo-git/actions/runs/43647766981: safety-tests SUCCESS.
- 129 / 129 source + security tests PASS; 21 / 21 disposable PostgreSQL 17 tests PASS.
- First CI attempts found two fixture/test inaccuracies: earlier repository already denies mismatched bot keys with CATALOG_SCOPE_DENIED; disposable PG bot table lacked credential_ref unlike hosted schema. Corrected both and reran full suites with 0 failures. These were NOT hosted security failures.
- GitHub Actions hosted-catalog-read job SKIPPED on this draft branch by existing branch+secret guard. The live SQL role simulations were executed separately through Supabase read-only connector, NOT via this Actions job.
- No actual deployed Customer/backend JWT E2E or freshly changed hosted role test; mark hosted Customer integration BLOCKED.
- Model calls: 0; Gateway spending: 0 USD by this work; no paid model or write tool invoked.

## Security / release gates
1. P0 BLOCKED: real backend-only Customer database identity and dedicated per-shop RLS role/policy provisioning. Owner must explicitly approve scope, credential, backup/rollback, and after-apply tests before any staged grant.
2. P0 BLOCKED: public.products lacks store_id; must not silently treat existing merchant-membership SELECT as full Customer tenant/store isolation.
3. P0 BLOCKED: provider-authenticated ingress and Trusted Tenant Resolver for real Customer channel not connected to this Core. Internal HMAC QA envelope is not provider HMAC evidence.
4. P1 BLOCKED: AI paid model budget hard cap not verified for 10 calls / $0.10 trial, so no inference used.
5. P1 BLOCKED: no production/hosted retention job; Customer-only PG17 retention code remains ephemeral and gated; no Supabase deletion.
6. P1 BLOCKED: automated SaaS-scale tenant role approach and actual server deployment/cross-session tests still needed.

## Rollback and continuation
- No hosted DB deployment to roll back. Discard draft PR #64 to return source to checkpoint/v124r3-before-hosted-catalog-rls-20261115 (do not hard-reset work others are editing).
- SQL role proposal intentionally review-only. Never run SQL with GRANT/CREATE POLICY on hosted DB without owner approval.
- After approval, provision dedicated customer backend role on **staging only**, verify exact RLS/current_user and no credential access using two server-only identities, catalog freshness and concurrent sessions, then rerun regression; only then consider Core CANDIDATE approval. Maintain production/Zalo/Messenger/Website disconnected.
