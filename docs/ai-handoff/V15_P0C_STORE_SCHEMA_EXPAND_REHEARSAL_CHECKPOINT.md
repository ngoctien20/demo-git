# TIEN404 AI — V15 Sales Lite P0-C — Private Ownership Certification × Store Schema Expand Candidate
Date: 2026-11-16 JST  
Parent: Draft PR #133 HEAD `e5faf9fdde1f658d80b55c90b7a856e4c3e87c5e`  
Release: **DRAFT / DISPOSABLE PG17 ONLY / NO HOSTED MIGRATION / NO PROVIDER SEND**

## 1. Scope and objective
Continue from completed P0-B source-only owner evidence gate. The goal is to prove the **mechanics** of a future Store ownership schema expansion and rollback, without claiming genuine merchant ownership or touching real Supabase data.

Product decision: **Sales Lite First** — one simple AI sales bot with exact catalog/quote, customer-confirmed order request, merchant alert, pause and human handoff. **DEFERRED**: Unified Operations Dashboard, Advanced Custom Bot Studio, merchant-selected premium models, complex multi-agent operations.

## 2. Latest VERIFIED hosted read-only baseline
Supabase project `ifxlvrhyjhbzbrkdsida` PostgreSQL **17.11**, ACTIVE_HEALTHY; 3 Auth users, 2 Tenants, 3 active Tenant memberships, 2 Products, 2 Orders. No `public.stores`, no `public.store_memberships`, no `store_id` on 7 public business/config tables. All **7 core business/config tables have FORCE RLS**, but **0 RESTRICTIVE Store policies**. Existing business `SELECT` policies are PERMISSIVE Tenant-scoped via `tenant_memberships`, not Store-level.

Existing Products constraint `UNIQUE(tenant_id,sku)`, Order/Product tenant composite FKs and TenantAgentConfigs `PRIMARY KEY(tenant_id,channel)` make an unreviewed Store migration unsafe. Auth/Store proof must not derive from a customer-supplied Store ID or editable JWT user metadata.

Supabase Security Advisor retains privileged RPC warnings: `qa_shop_b_zalo_claim` executable by `anon` with SECURITY DEFINER (risk finding, not an exploit proof), `qa_owner_pairing` and `save_merchant_product` executable by `authenticated` under SECURITY DEFINER. No hosted changes made. Database branch list returned zero branches; **this is not a backup/restore certification**.

Sources: https://supabase.com/docs/guides/database/postgres/row-level-security and https://supabase.com/docs/guides/platform/backups .

## 3. New implementation — DISPOSABLE ONLY
- `qa/v15-sales-lite-p0c/pg17-expand-rollback-rehearsal.sql` recreates a **synthetic old Tenant-only baseline** in isolated `p0c` schema and verifies that both A and B originally see a tenant-shared legacy row. A single PostgreSQL transaction then rehearses:
  - New Store and StoreMembership tables, explicit (tenant,store,auth-user) membership chain and RLS.
  - Nullable Store IDs and composite Tenant/Store foreign keys for synthetic Products and Orders.
  - Retained legacy Tenant-permissive SELECT RLS intersected with **Store RESTRICTIVE SELECT** RLS, hiding unassigned NULL Store rows.
  - Synthetic new Shop A/B under the **same Tenant**, C under a different Tenant; same SKU can have different prices when unique-by-Store is used in the synthetic cutover.
  - Forged client Store ID rejected, anonymous access rejected, unauthorized direct writes denied, revoked membership denied, paused Store denied.
  - Existing legacy Products and Orders are **not attributed, backfilled, deleted or leaked**.
  - A full **ROLLBACK** followed by assertions: no new Store tables, no store_id column, two original Products and two original Orders preserved, old SKU uniqueness and old RLS restored.
- `.github/workflows/v15-p0c-store-expand-rollback-offline.yml` executes the test only inside ephemeral `postgres:17` on GitHub runner, alongside inherited P0-B no-approval unit tests and P0 Commerce No-Send QA. No Supabase project ref/credential can be used by the SQL.

**CAUTION:** The synthetic transaction combines expand AND later cutover steps (including switching SKU uniqueness) to test their interactions. **Do not copy/paste this rehearsal SQL as a hosted migration.** A real release must separate reviewed stages and coordinate application readers/writers and Business Core changes.

## 4. Explicit phased release gates and dependencies

| Gate | Condition | Status at P0-C |
|---|---|---|
| C0 — Design & isolated QA | Synthetic SQL/RLS/revert verified at exact GitHub HEAD | Subject to CI |
| C1 — Private Owner intake | Nine PRE-EXPAND proof classes, independently reviewed | BLOCKED |
| C2 — Safe backup | Authorized private snapshot/coverage/retention verified | BLOCKED |
| C3 — Independent restore drill | Restore to isolated approved target, verify data/auth/policies, outgoing tasks disabled | BLOCKED |
| C4 — Schema EXPAND approval | Separate owner approval of exact SQL SHA, target, affected objects, operational budget | **NOT APPROVED** |
| C5 — Identity & ownership binding | Canonical Store/StoreMembership rows, independently proven, original legacy rows explicitly attributed or quarantined | BLOCKED |
| C6 — Store RLS cutover | Separate approval; all policies/RPCs/authenticated JWT tests, source reads/writes and memo caches coordinated | **NOT APPROVED** |
| C7 — Commerce integration | Store-scoped price/stock, permissioned Order+Outbox transaction, owner message only after commit | BLOCKED |
| C8 — Merchant pilot | Native Page/Bot binding, consent, no data leak, merchant UAT and capped cost | BLOCKED |

**No one has granted approval to modify hosted Supabase schema, grants, Auth, RLS/RPC, real legacy data, or provider sends.**

## 5. Specific migration concerns requiring independent review
1. Existing 2 Products + 2 Orders have no Store attribution; keep legacy NULL/quarantined. No fabricated default Store, no bulk backfill without provenance/owner sign-off.
2. Existing `UNIQUE(tenant_id,sku)` conflicts with allowing independent identical SKUs in A and B. Keep current constraint until **later coordinated migration**: read paths, write paths, cache, ordering and all dependent tools must be updated before dropping it. Simulated drop in disposable PG17 is not approval.
3. Composite Store keys must propagate to Orders ↔ OrderItems, Products, Customers, Conversation ↔ Messages, BotConfig and all idempotency/outbox/channel registries; and make illegal cross-Store references unrepresentable.
4. `tenant_agent_configs PRIMARY KEY (tenant_id,channel)` needs a separately reviewed Store-aware identity design; cannot ALTER casually.
5. Restrictive Store SELECT must exist **before any Store-specific pilot read**. Creating a Store column alone does not isolate Shop A/B. Null Store legacy records must fail closed even while Tenant-read policies exist.
6. PostgreSQL `service_role`/SECURITY DEFINER may bypass RLS; separately audit every service and exposed RPC. RLS alone does not cover privileged backend callers.
7. Prevent double-write/idempotency collisions across Store+provider event, and ensure Order+Outbox stay atomic; prior P0-A test only verified this **in disposable QA**.
8. For source-controlled migration, use real Supabase CLI/versioned migration generator during authorized development; no fabricated migration version and no direct `apply_migration` while blocked.
9. No independent human verified Auth ownership, merchant Page/Bot consent, backup bytes or restore logs have been furnished; **never promote synthetic UAT to certified proof**.

## 6. Rollback & blast radius
Current P0-C changes: **GitHub source-only** plus ephemeral CI database. To roll back, close this child Draft PR. Zero changes to hosted Supabase, n8n Published, Cloudflare production, Telegram, Messenger, Zalo or real Orders.

A **future** hosted migration needs separate recovery plan: freeze authorized writes, test restore, retain backup snapshot, deploy only coordinated expand and RLS with negative JWT tests, stop at first failure, and define rollback by preserved records/constraints rather than blind DROP/DELETE.

## 7. Proposed next checkpoint
**V15 Sales Lite P0-D — Independent Owner Evidence Intake × Backup/Restore Certification** (until verified), then seek **specific owner approval** for a narrowly scoped canonical Store schema expansion. Do not ask to approve live provider sends/order writes bundled with schema migration. Keep Sales Lite features minimal.

## 8. Required report semantics
VERIFIED: read-only metadata and reviewed PR state. IMPLEMENTED: source and CI definitions. TESTED: disposable PostgreSQL tests only after exact HEAD CI success. BLOCKED: all hosted owner, backup/restore, JWT Store RLS, true Commerce and pilot production. RELEASED: NONE.
