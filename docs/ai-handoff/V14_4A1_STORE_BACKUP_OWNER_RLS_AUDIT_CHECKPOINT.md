# TIEN404 AI V14.4A.1 — Backup Evidence, 4-Row Store Ownership & SECDEF Audit

**Ngày:** 2026-11-15 JST  
**Lifecycle:** VERIFIED READ-ONLY / IMPLEMENTED SOURCE / TESTED OFFLINE / HOSTED BLOCKED  
**Repository:** ngoctien20/demo-git  
**Working Draft:** PR #98, branch work/v144-store-backup-hosted-gate-20261115, stacked on V14.2 PR #86.  
**Approval scope:** audit, QA, Draft source and local backup-preflight helper only. **NOT authorized:** Supabase DDL/RLS, row backfill, production, credentials, Meta/Zalo sends, payment/customer changes or paid resources.

## 1. Verified facts — Supabase staging (read-only)

Project `tien404-staging` ref `ifxlvrhyjhbzbrkdsida`, PostgreSQL **17.11**.

- `public.stores`: ABSENT; `public.store_memberships`: ABSENT; `public.products.store_id`: ABSENT. Actual same-tenant multi-Store isolation is **not implemented**.
- Counts (read-only): **Products 2**, **Orders 2**, **Customers 0**, **Order Items 0**, **Conversations 0**, **Messages 0**.
- Four QA-aggregate groups, all **synthetic candidate only, NOT store ownership verification**:

| Source tenant alias | Table | Rows | Synthetic candidate | Owner verification |
|---|---|---:|---|---|
| qa-staging-shop-a-20261110 | products | 1 | qa-store-a | PENDING |
| qa-staging-shop-a-20261110 | orders | 1 | qa-store-a | PENDING |
| qa-staging-shop-b-20261110 | products | 1 | qa-store-b | PENDING |
| qa-staging-shop-b-20261110 | orders | 1 | qa-store-b | PENDING |

- Each of six core Commerce tables has an authenticated **PERMISSIVE SELECT** policy, respectively `products_member_read`, `orders_manager_read`, `customers_manager_read`, `order_items_manager_read`, `conversations_manager_read`, `messages_manager_read`. Store-level predicates cannot work without Store schema and must **replace** (not OR alongside) tenant-only policies.
- Security Definer metadata inspection (function bodies deliberately not exported):
  - `qa_shop_b_zalo_claim`: `anon` can EXECUTE, `authenticated` cannot; no `auth.uid()`, `tenant_id`, or `store_id` token found in definition.
  - `qa_owner_pairing`: `authenticated` can EXECUTE; contains `auth.uid()` and `tenant_id`, **no `store_id` token**.
  - `save_merchant_product`: `authenticated` can EXECUTE; contains `auth.uid()` and `tenant_id`, **no `store_id` token**.
  - All three report explicit `search_path` configuration. Keyword presence/absence is **only a review signal**; it does NOT establish that a function is exploitable or correctly authorized. These RPCs must be reviewed by their owners before tenant-to-Store permission expansion. No grants/policies changed.
- Current A and B represent **different tenants**. They cannot prove two stores inside a **single tenant** are isolated.

## 2. Backup Gate 0 — what is and is not verified

User reported completion of `TIEN404_V142_PRE_RLS.backup` on their Windows machine during the V14.2 run. This local file is not available through connected GitHub/Supabase tools. Therefore:

- Backup creation is OWNER REPORTED, but archive readability, SHA256, six-table catalog, independent restore, constraints, row-level integrity and rollback are **NOT VERIFIED**.
- `qa/store-rls-v144/TIEN404_V144_Backup_Evidence.ps1` was already prepared in PR #98 and is inspect-only by default. V14.4A.1 hardened it to **REFUSE** local restore when any of six required Commerce tables are missing from manifest, or the isolated local target database is not PostgreSQL **17.x**.
- Local restoration is optional and **never invoked automatically**; it requires `-RestoreLocal`, a pre-existing **empty localhost** database whose name matches `tien404_restore_v144_<suffix>`, and local PgBinDir. It does not create or drop any database, contact hosted Supabase, alter remote data, or use `--clean/--create`.
- Even if a local restore succeeds, the tool only reports an archive/schema-level result, **not full recovery of managed Supabase Auth, secrets, Storage objects or customer operations**. Read-only integrity, roles/RLS and rollback still need independent review.
- Never upload the real `.backup`, database password, JWT, service-role keys, customer row IDs or decrypted customer data into public GitHub or CI.

**Owner-private inspect-only command** (replace paths; do NOT add `-RestoreLocal`):
```powershell
& ".\TIEN404_V144_Backup_Evidence.ps1" -BackupPath "X:\<YOUR_FOLDER>\TIEN404_V142_PRE_RLS.backup" -PgBinDir "C:\Program Files\PostgreSQL\17\bin"
```

## 3. Gate 1 — how four rows are approved

- The versioned `qa/store-rls-v144/four-row-public-sanitized.snapshot.json` contains only tenant aliases and counts, not IDs/PII. It is **not** an ownership ledger.
- The four real row UUIDs and canonical Store UUIDs must be reviewed **privately** by the owner and an independent reviewer. Record source tenant, table, row id, intended Store UUID, corroborating source, owner decision and reviewer decision.
- Neither `qa-store-a` nor `qa-store-b` can be silently converted into a real Store UUID, and a 1:1 tenant candidate is not proof.
- Check order relationships, product scope, pricing/total invariants, migration/backfill rollback and DB row count drift. Any mismatch => HOLD.
- The new `qa/store-rls-v144/owner-backup-evidence-gate.cjs` always reports `can_backfill:false`, `can_replace_rls:false`, `backup_restorable_verified:false`, even if synthetic evidence is complete.
- The new `READ_ONLY_FOUR_ROW_OWNER_PREFLIGHT.sql` and `READ_ONLY_SECURITY_DEFINER_PREFLIGHT.sql` are SELECT-only; no SQL changes or real row IDs exported.

## 4. Evidence / QA

- GitHub Actions: run **43720844203** on source commit `7a82ce9054dc53bd04e332c9a4a969a586b21e9d`: **112/112 Node cases PASS, 0 FAIL, 0 SKIP** (V14.2 inherited plus V14.4A.1 new).
- Static check of local helper, SELECT-only SQL and guarded local destinations PASSED.
- PowerShell syntax parsed in GitHub Actions on runner PASSED.
- **Not executed:** helper against the owner's actual archive, live owner row mapping or local DB restore. No fake acceptance.
- Latest live read-only RPC metadata and four-row aggregate were inspected through Supabase connector. No privileged function was invoked.

## 5. Approval gates before DDL/RLS (all currently STOP)

- [ ] **Gate 0:** backup archive catalog SHA256 checked on owner's Windows machine, isolated restore and row/RLS integrity independently verified, rollback signed.
- [ ] **Gate 1:** four row-by-row Product/Order ownership decisions owner-signed + independent review, canonical Store IDs approved privately.
- [ ] **Gate 2:** V14.2 migration impact reviewed, tenant-only permissive policies replaced atomically, privileged SECURITY DEFINER RPC paths reviewed.
- [ ] **Gate 3:** approved hosted JWT sessions for Shop A/B in the **same tenant** and cross-tenant; positive/negative Store-level RLS QA (service_role is not acceptable evidence).
- [ ] **Gate 4:** separately approved Page binding, event replay/outbox, Meta permissions and limited send window before any real customer Messenger pilot.

**Checkpoint:** P0 BACKUP=OWNER_REPORTED_NOT_VERIFIED; P0 STORE_MAPPING=4_ROW_PENDING; P0 HOSTED_RLS=BLOCKED; PRODUCT_UAT_OFFLINE=OWNER_ACCEPTED (unchanged); MIGRATION_AUTHORIZED=FALSE.

## 6. Rollback and next step

Close Draft PR #98 or revert this additive audit change. No Supabase/n8n/customer/credential rollback required because none was changed. Keep PR #86 and accepted Sales Lite UAT PR #96 as independent checkpoints.

Next: Owner may run the **inspect-only backup helper** and share sanitized output (no secrets); then perform separate private ownership review. **Do not apply Supabase Store migration until restore proof and explicit authorization exist.**
