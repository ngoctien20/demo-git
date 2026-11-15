# TIEN404 AI — V14.4.2 Hosted Store RLS Acceptance Harness & Controlled Migration Preflight

**Checkpoint:** 2026-11-16 JST (GitHub Actions 2026-11-15 15:28 UTC)
**Lifecycle:** EXPERIMENTAL → CANDIDATE FOR SECURITY REVIEW ONLY; NO HOSTED MIGRATION / NO SEND
**Project:** tien404-staging (Supabase ref ifxlvrhyjhbzbrkdsida)
**Repo:** https://github.com/ngoctien20/demo-git
**New Draft PR:** https://github.com/ngoctien20/demo-git/pull/104
**Branch:** work/v1442-hosted-rls-acceptance-preflight-20261116
**Base:** V14.4.1 Draft PR #101, HEAD at branch creation dcce08af54cf7dad472bc029277d9a3a6302d094
**Transitive dependency:** PR #97 → PR #94. PR #86 (Store/Knowledge) and PR #95 (Messenger replay) are NOT yet merged into this PR.

## 1. VERIFIED live audit

Directly inspected Supabase staging with read-only SELECT, including the EXACT committed source:
\`qa/hosted-readiness-v1442/PREFLIGHT_READ_ONLY_CATALOG.sql\` (ran successfully; returned 1 JSON inventory row with no user or order contents):
- PostgreSQL **17.11**.
- Rows: Products **2**, Orders **2**, Customers **0**, Order Items **0**, Conversations **0**, Messages **0**.
- All **six** Commerce tables have \`RLS ENABLED\` and \`FORCE RLS\`, but **no store_id**.
- Exactly one old PERMISSIVE SELECT policy per table:
  \`products_member_read\`; \`customers_manager_read\`; \`orders_manager_read\`; \`order_items_manager_read\`; \`conversations_manager_read\`; \`messages_manager_read\`.
- \`public.stores\`, \`public.store_memberships\`, \`app_private.shop_knowledge_releases\` **absent**.
- \`products_tenant_id_sku_key\` still enforces \`UNIQUE(tenant_id,sku)\`, not \`UNIQUE(tenant_id,store_id,sku)\`. Orders/Order Items composite foreign keys still tenant-only.
- Three SECURITY DEFINER functions lack \`store_id\` references: \`save_merchant_product\`, \`qa_owner_pairing\`, \`qa_shop_b_zalo_claim\`. The last is anon-executable; the first two are authenticated-executable. This is a *review requirement*, not evidence of an exploit.
- No SQL mutation, migration, RLS change or customer-record edit executed.

Current backup status (from prior owner-provided screenshots): local pgAdmin file \`TIEN404_V142_PRE_RLS.backup\` 212 KB, \`pg_dump\` success, \`pg_restore --list\` exit code 0, operator SHA-256 calculated. **Real isolated restore rehearsal still deferred and NOT VERIFIED**. Not proof of recovery readiness; cannot authorize DDL.

## 2. IMPLEMENTED — V14.4.2 source-only

1. \`qa/hosted-readiness-v1442/hosted-jwt-acceptance.cjs\`
   - **Operator-triggered only**, hardcoded exact Supabase staging project ref, server-confirmed \`GET /auth/v1/user\`; only HTTPS GET with publishable API key + individual real user JWTs.
   - Requires **four different Supabase Auth QA users**: Shop A and B from ONE tenant with separate Store UUIDs, Shop C from a different tenant, valid-auth unassigned/revoked staff R. Three approved synthetic non-customer Products and three Orders fixture IDs must exist; no tools create them automatically.
   - Queries membership limited to *all three target Stores* and requires own active membership and no cross-membership for A/B/C. Revoked staff must have none.
   - **24 GET-only positive/negative checks** over Products/Orders: 6 own-store positive, 12 other-store negative, 6 revoked staff negative. A 403, invalid JSON or empty positive fixture is FAIL, never mistaken for RLS success.
   - Strictly no write API, RPC, change of credential, Supabase service_role, personal order contents, Meta/Zalo sends or tokens in logs. Result reports only counts, boolean flags and fixed error codes.
   - Hard gates: explicit operator authorization, named isolated-restore+migration signoff and stage project ref. **These strings are still claims, not an independently signed approval. Do not run until approval/evidence genuinely verified by QA.**
   - Extra hardening: private WeakSet of factory-issued validated configs; immutable snapshotted environment variables prevent replacing JWT or API key after validation; raw GET helper is **not exported**. Cannot call with an arbitrary forged \`{ready:true}\` object.
   - CLI is NOT run in GitHub Actions or by assistant with real tokens. Mock transport only in CI.
   - Extends but does not duplicate/edit the original V14.2 PR #86 \`hosted-jwt-read-qa.cjs\`, which remains on a divergent branch.

2. \`qa/hosted-readiness-v1442/hosted-jwt-acceptance.test.cjs\`
   - **26** mock tests covering mandatory gates, identity validity, same/cross tenant, no-vacuous-positive, wrong store, active/revoked staff, permission response 403, API method, immutable credentials and forged config.

3. \`qa/hosted-readiness-v1442/migration-preflight.cjs\` and tests
   - **22** tests. Six explicit phases M0_RECOVERY, M1_EXPAND, M2_OWNER_BACKFILL, M3_CONSTRAINTS, M4_ATOMIC_RLS, M5_ACCEPTANCE.
   - Reviews 2 Products + 2 Orders **private** owner-attribution ledger format; refuses to infer Store solely from tenant; requires owner and independent reviewer per row.
   - Inventory and fake evidence may be marked complete only for document review; ALL mutation booleans remain false, including \`canExecuteSql\`, \`canApplyDDL\`, \`canBackfill\`, \`canAlterRLS\`.
   - No client, DB or file network connections and no real credential access.

4. \`qa/hosted-readiness-v1442/PREFLIGHT_READ_ONLY_CATALOG.sql\`
   - SELECT-only aggregated catalog/report; it was run successfully on actual Supabase staging. No customer PII or raw records returned.

5. \`docs/ai-handoff/V14_4_2_CONTROLLED_MIGRATION_RUNBOOK.md\`
   - Six-phase owner/QA signoff, exact hosted JWT prerequisites, proper separate rollback for post-commit DDL, no-service-role testing, private backup/ledger protection.

6. \`.github/workflows/v1442-hosted-rls-acceptance-qa.yml\`
   - Mock-only new tests, inherited V14.4.1/V14.4/Messenger regression, disposable PostgreSQL 17 RLS (still synthetic actor).
   - No GitHub Secrets accessed, no Supabase HTTP request, no live Meta/Zalo sends.

## 3. TESTED — real CI evidence

**Final source CI run:** https://github.com/ngoctien20/demo-git/actions/runs/43730008800 — **all three jobs COMPLETED SUCCESS** at code commit \`587e5fcff58f9e7e5e2ae0459d5fb9bbcd5c9d31\`.
- **48/48 NEW Node tests PASS** (26 JWT mock security tests + 22 migration/ledger/preflight tests), 0 failures.
- **343/343 inherited Node tests PASS** (26 V14.4.1 + 37 V14.4 + 36 V14.3 + 244 Messenger), 0 failures.
- **Total 391/391** Node tests PASS (new + inherited; not double-counting).
- **Disposable actual PostgreSQL 17 CI**: 22 direct PASS checks + final suite PASS (23 PASS log lines) on same-tenant Store A/B, cross-tenant C, UNIQUE tenant/store/SKU, composite order-item FK, denied wrong-store INSERT/UPDATE, revoked membership, and deliberate old PERMISSIVE tenant policy bypass demonstration+removal. This is *not* hosted Supabase RLS JWT proof, nor a backup restore rehearsal.
- First CI run \`43729655979\` had 46/46 Node PASS but one incorrect **static test assertion** on escaped SQL newline; fixed; rerun \`43729785791\` 3/3 SUCCESS. Later source hardening added 2 more tests and final \`43730008800\` 3/3 SUCCESS. Preserve first failing run in audit; no concealment.

## 4. HOSTED GATES — STILL BLOCKED

| Gate | Needed real evidence | Status |
|---|---|---|
| M0 RECOVERY | Actual local backup restored and checked in isolated PG17 + rollback owner accepted | BLOCKED / user earlier deferred |
| M1 EXPAND | Canonical Store and Knowledge schema, normalized grants, phased migration approved | BLOCKED |
| M2 BACKFILL | Four private, independently owner-verified legacy Product/Order mappings | BLOCKED |
| M3 CONSTRAINTS | Same-store composite FKs, SKU unique migration and all active writers regression | BLOCKED |
| M4 ATOMIC RLS | All six old tenant SELECT policies removed/replaced, three RPCs scoped and post-commit rollback tested | BLOCKED |
| M5 HOSTED ACCEPTANCE | Four authorized live Auth JWTs + 3 fixture Products/Orders, real positive/negative reads + separate write-path QA | BLOCKED |
| Multichannel | Hosted Messenger Page permissions, real replay/Widget domain verification | BLOCKED |

The existing 2 Products + 2 Orders must **not** be repurposed as test fixtures without verified ownership. There are currently no real canonical Stores or Store assignments to test. A complete mock or README never unlocks hosted release.

## 5. ROLLBACK, ownership and next recommended work

**Source rollback:** Close/revert Draft PR #104 only; code is separate and no published n8n workflow/SQL/customer data/credentials or production changed. Disposable GitHub CI PostgreSQL container auto-discards after the run.

**Responsibility:** Integration/Security owns canonical tenant/store and JWT; QA independently signs recovery, RLS and negative tests; Website Team continues hosted Widget only after gateway grants; n8n Team keeps existing Published bot unchanged; Messenger Lab handles Page binding/replay and Meta permissions.

**Immediate next safe development:** Create a redacted **per-record owner evidence ledger template** and read-only **SECURITY DEFINER RPC reviewer pack**, without changing function grants; prepare a standalone local restore drill checklist for when operator is ready. Only after M0+accepted rollback and separate explicit hosted schema approval may controlled migration start.

**Release verdict:** IMPLEMENTED/TESTED as source and disposable CI; live hosted GET-only QA **NOT RUN**; RLS/backfill/production **NOT AUTHORIZED**.
