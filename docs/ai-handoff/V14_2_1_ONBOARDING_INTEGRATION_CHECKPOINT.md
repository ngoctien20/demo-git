# TIEN404 AI V14.2.1 — Store-scoped guided onboarding integration

Date: 15 November 2026 JST
Status: EXPERIMENTAL / QA OFFLINE / NOT PRODUCTION
Stacked Draft PR: #86 (parent PR #85). No merge or deployment approved.

## 1. Backup decision and safety gate

Operator's Windows screenshots verify: pgAdmin pg_dump finished with success; local backup TIEN404_V142_PRE_RLS.backup exists on drive E: (Explorer size 212 KB); pg_restore --list exit code 0 enumerates the expected application schemas, main public tables' TABLE DATA entries, and public RLS policy entries. A SHA-256 checksum was calculated in PowerShell.

User expressly chose to DEFER the isolated restore test to keep development moving. This does NOT waive the migration safety gate. No one has verified the backup by an actual restore, and it is a selected-app-schema archive, not a full Supabase Auth/Storage recovery image.

Decision: Continue SAFE/OFFLINE engineering. Keep actual Store/Knowledge SQL migrations, RLS changes, 2 Products + 2 Orders backfill, real provider sends, and live Knowledge release BLOCKED.

## 2. Direct staging audit

- Supabase tien404-staging ref ifxlvrhyjhbzbrkdsida: ACTIVE_HEALTHY; PostgreSQL 17.11.
- public.stores, public.store_memberships and app_private.shop_knowledge_releases absent. Existing Products=2, Orders=2.
- n8n Zalo ingress yIJk8LvJoLF40Z62 ACTIVE version 8ca4a6f6-ab3f-42f1-8637-d4f5db790a3e.
- n8n customer router sIPs6egzIwOY1GNv ACTIVE version 8d91d23c-cd87-462f-a112-9cca2340bec8.
- n8n V14.1 synthetic QA S6IZJ5q0QFU6pHx5 INACTIVE version 1d8c3529-9d71-4601-88b4-f781a18fa9aa.
- n8n V14.2 synthetic QA FIE7nl2vgLXQI7mT INACTIVE version b24c7a86-66bf-45a2-b48b-a81c54e375bb.

## 3. What was IMPLEMENTED

New QA-only module: qa/shop-onboarding-v142/onboarding-scope-service.cjs.
- Orchestrates pre-existing verified Store authorization boundary and immutable guided 11-step merchant draft core; no rebuild of prior modules.
- Reauthenticates EVERY open/submit/review/export/discard call using injected OFFLINE_TEST verification and authoritative synthetic store assignments, not client-supplied role/tenant/user claims.
- Actor, tenant and store are bound to a process-memory session. Separate Shop A/B sessions under one synthetic tenant, Shop C another; actor legitimately in both stores cannot reuse cross-store drafts.
- Random session ID, default 20min TTL, bounded 40 concurrent memory drafts, no access token retention.
- Mandatory field sequence, content format checks, replay-idempotency and unknown fields retained as unknown.
- Only emits STAFF_ONLY, UNVERIFIED, DRAFT review artifact. No persistence, no API, no model, no published Knowledge, no order, no provider send.
- Explicit hard guard: mode must be OFFLINE_TEST, never HOSTED_READ_ONLY or production. This is simulated server auth, NOT real Supabase JWT proof.
- Process restart loses drafts. Real hosted implementation needs separate private durable storage and schema approval.

New test module: qa/shop-onboarding-v142/onboarding-scope-service.test.cjs, 27 new unit/integration security tests.
Updated existing CI workflow to run this test suite in addition to previous regressions.

## 4. QA evidence

GitHub Actions run 43718599637 SUCCESS, both contract and browser jobs completed.
- 340 / 340 Node.js tests PASS, 0 failed. Test group sizes:
  37, 12, 21, 10, 5, 58, 27, 87, 39, 44.
- Chromium responsive QA PASS for viewports 320, 360, 390, 430, 768, 1280 px, zero overflow.
- UI full 11-turn interview, invalid phone, unknown founding year and switch of Shop B/C passed.
- No changes to existing published n8n workflows, Supabase RLS, customer data, credential, billing, Render or Cloudflare production.

## 5. P0 blockers and next work

1. Deferred restore-drill: conduct on a genuinely isolated PostgreSQL instance before RLS migration; compare data row counts, schema and policy lists. TOC-only inspection is NOT enough.
2. Separately approve canonical Stores/Memberships schema and full store-scoped RLS transaction before execution.
3. Attribution/ownership verification for 2 existing Products and 2 Orders; no automatic per-tenant backfill.
4. Hosted JWT A/B test of TWO shops in ONE tenant, plus cross-tenant tests. Existing A/B are in DIFFERENT tenants, which alone does not prove same-tenant separation.
5. Audit tenant-only SECURITY DEFINER write RPCs (notably save_merchant_product) before enabling writes.
6. Implement durable private merchant draft store and independent staff/merchant signed approval before real Knowledge publication.
7. P1 candidate: offline staff review queue, owner consent simulation, and synthetic read-only Knowledge preview without RLS/DB writes.

## 6. Rollback and current release status

Source rollback: revert new offline service, new tests and CI addition from Draft PR #86. No DB or workflow rollback needed, because no existing hosted component was modified.

Statuses:
- BACKUP_FILE_CREATED_AND_TOC_READ = VERIFIED_BY_OPERATOR_SCREENSHOTS
- ISOLATED_RESTORE = DEFERRED_UNTESTED
- V14_2_1_INTEGRATION_CONTRACT = IMPLEMENTED
- V14_2_1_CI = TESTED_PASS_340_OF_340
- HOSTED_STORE_RLS = BLOCKED
- PRODUCTION_RELEASE = NOT_AUTHORIZED
