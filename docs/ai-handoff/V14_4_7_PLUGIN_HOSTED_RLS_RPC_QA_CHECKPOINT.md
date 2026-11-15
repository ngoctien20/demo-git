# TIEN404 AI V14.4.7 — Plugin Hosted RLS/RPC Audit × Offline Store Isolation Gate

**Date:** 2026-11-16 JST
**Project:** Supabase staging ifxlvrhyjhbzbrkdsida
**GitHub base:** work/v1446-atomic-order-ledger-pg17-qa-20261116 (Draft PR #108)
**Release:** EXPERIMENTAL / SOURCE-ONLY DRAFT — NOT DEPLOYED / NOT APPROVED

## 1. Direct plugin read-only evidence

Supabase plugin executed the exact checked-in [HOSTED_POSTURE_SELECT_ONLY.sql](../../qa/store-rls-v1447/HOSTED_POSTURE_SELECT_ONLY.sql) against staging successfully. The query reads catalog, ACL metadata and aggregate row counts only; no individual customer data, credentials or function invocation.

- PostgreSQL 17.11.
- public.products: **2** existing rows; public.orders: **2**.
- public.stores, public.store_memberships: **absent**.
- Six public Commerce tables (products, orders, order_items, customers,
  conversations, messages) each has ENABLE RLS + FORCE RLS, **no store_id**.
- Each has **one permissive tenant-wide SELECT policy**.
  Adding an additional permissive Store policy WITHOUT removing the legacy
  tenant-only policy in the same separately approved transaction is UNSAFE.
- save_merchant_product: postgres-owned SECURITY DEFINER, authenticated
  EXECUTE only, tenant+SKU writer without Store scope.
- qa_owner_pairing: postgres-owned SECURITY DEFINER, authenticated EXECUTE,
  synthetic owner QA flow only.
- qa_shop_b_zalo_claim: postgres-owned SECURITY DEFINER, anon EXECUTE,
  Vault-backed header gate for synthetic QA; not a live release approval.
- Hosted save_merchant_product_v2: absent.
- Supabase Security Advisor: 18 private tables with RLS/no policy
  (deny-by-default for ordinary users, review privileged paths);
  1 anon-definer WARN, 2 authenticated-definer WARN;
  leaked-password protection disabled (WARN).
- Historical hosted migrations list contained 14 entries. No migrations applied.

Security Advisor reference:
https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable

## 2. Operator backup evidence reconciliation

Operator Windows supplied actual evidence, NEW since V14.4.6 checkpoint:
- Local Supabase PG17.11 accepts original archive TOC.
- Full-data restore within a single transaction FAILED on
  public.tenant_memberships.user_id -> auth.users missing (Auth data not
  contained in the five-schema application archive). Rollback verified:
  application tables 0, auth.users 0.
- **SCHEMA-ONLY restore PASS** exit code 0, 38 tables, 38 RLS-enabled, 12 FORCE.
- 31 public RLS policies; 18 private tables had no policies and no direct
  SELECT/INSERT/UPDATE/DELETE grants to anon/authenticated in local restore.
- Local save_merchant_product negative call without JWT returned access
  denied; transaction ROLLBACK. This is NOT cross-Store acceptance.
- **Full recovery with Auth and independently accepted rollback BLOCKED.**
  Local restore used --no-owner --no-privileges. Local RPC EXECUTE grants
  MUST NOT be confused with hosted effective grants.

## 3. New source-only implementation

- qa/store-rls-v1447/store-isolation-gate.cjs: fail-closed pure JS synthetic
  actor/Store access demonstration and independent release checklist.
  No network adapter, SQL execution, hosted migration authorization or
  provider capability. canRunHostedMigration is always false.
- qa/store-rls-v1447/store-isolation-gate.test.cjs: 11 Node test cases,
  including **72** actor x Store x table synthetic allow/deny assertions,
  two Stores under ONE tenant sharing SKU but different prices,
  different-tenant Store C, revoked member R, inactive subscription,
  role checks, forged synthetic identity negative tests and release gates.
  NOT signed JWT or hosted RLS testing.
- qa/store-rls-v1447/HOSTED_POSTURE_SELECT_ONLY.sql: live read-only metadata
  audit. **Executed successfully via Supabase plugin.**
- docs/migration-drafts/V14_4_7_STORE_RLS_DESIGN_DO_NOT_APPLY.sql:
  OUTSIDE Supabase migrations; first SQL statement raises exception.
  All schema/ACL/RLS/repointing design text is comments; no DDL/DML executable.
  Covers M0 backup, M1 stores/membership, M2 signed four-row attribution,
  M3 scoped FK/uniqueness, M4 atomic tenant-policy replacement,
  M5 product-writer compatibility, M6 real signed-JWT acceptance.
- .github/workflows/v1447-offline-store-isolation-qa.yml: no Secrets,
  no hosted DB/network calls in tests, least-privilege contents:read;
  Node test and migration no-apply static check on draft PR only.
- No existing source files, n8n published versions, production branch,
  customer rows, credentials, grants or hosted policies altered.

## 4. Reused existing work

- PR #86: canonical Store/Knowledge design; separate unmerged lineage.
- PR #104: real signed-JWT hosted acceptance runner disabled without gates.
- PR #105: SECURITY DEFINER and four-row owner evidence intake.
- PR #106: Store Product V2 synthetic/offline contract.
- PR #107: legacy writer and stock/order safety audit.
- PR #108: disposable PG17 atomic order/ledger CI only.

Do not run PR #104 hosted JWT runner: Store schema/membership missing,
no independent same-tenant Store users, full backup unverified, and separate
migration approval withheld.

## 5. Gate status and QA labels

| Gate | Status |
|---|---|
| Supabase hosted read-only metadata inventory | VERIFIED / TESTED |
| Operator backup schema-only restore | VERIFIED from operator PowerShell |
| Full archive/data/Auth restore + independent rollback | BLOCKED |
| Four-row owner/store attestation | BLOCKED |
| Six Store IDs and Store-aware RLS on hosted | BLOCKED |
| Old six permissive tenant-wide policy replacement | BLOCKED |
| Product V2 / legacy writer rollout | PROPOSED / NOT APPLIED |
| Four real distinct signed JWT same/different tenant | BLOCKED |
| 11 offline QA test cases | IMPLEMENTED, check CI run separately |
| Migration draft | IMPLEMENTED, non-applicable |
| Hosted schema/GRANT/credential/data/n8n modification | NONE |

## 6. Rollback, approvals and next

Source-only rollback: close/revert the V14.4.7 Draft PR or delete the isolated
branch after review. This does not affect hosted staging; no live DB rollback
needed because V14.4.7 made ZERO hosted writes.

**Separate explicit owner approval** is required for any hosted Store migration,
GRANT/REVOKE, existing-row ownership/backfill, signed-JWT QA accounts and
data-writing tests; no real Meta/Zalo/Messenger sends are authorized.

Next: accept limited SCHEMA-ONLY restore as checkpoint only (NOT full restore);
determine approved backup covering auth.users plus dependent application data
before any hosted Store RLS migration.


## 7. CI acceptance evidence (post-PR verification)

- Open Draft PR: https://github.com/ngoctien20/demo-git/pull/109
- GitHub Actions: https://github.com/ngoctien20/demo-git/actions/runs/43743597909
- GitHub connector verified run status COMPLETED, conclusion SUCCESS.
- Job synthetic-only (job id 132901912042): COMPLETED SUCCESS.
- Direct job log: **11 tests / 11 PASS / 0 FAIL**; the matrix
  case asserts 72 synthetic actor × Store × table combinations.
- Migration guard verification: **PASS**, no executable schema DDL/DML.
- This is NODE OFFLINE MOCK QA, not real hosted JWT, not real DB RLS,
  not Auth archive recovery and not hosted writing.

FINAL V14.4.7 VERDICT: SOURCE-ONLY QA TESTED PASS; HOSTED STORE-RLS
MIGRATION AND REAL MULTI-STORE ACCEPTANCE STILL BLOCKED.
