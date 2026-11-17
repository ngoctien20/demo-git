# TIEN404 AI — V17.7C Simplified Product Workspace × Reversible QA Cleanup × Full-Service Recovery Explainer

**Date:** 2026-11-17 JST. **Scope:** Connected Google Drive + n8n manual QA; **production change:** NONE.

## Owner-facing decision

Only two visible working resources are intentionally retained:
1. **Main QA Product workbook:** [TIEN404 - 01 SAN PHAM TEST (CHUA BAN THAT)](https://docs.google.com/spreadsheets/d/1xVCzUPVhyUJ0v0pYNpJQKwOKzlr-gNoOCEMkS7AEmKc/edit), native tabs `Products`, `HUONG_DAN`, 30 synthetic/demo rows; **NOT merchant production**.
2. **Legacy AI_SALES_DEMO workbook:** [AI_SALES_DEMO](https://docs.google.com/spreadsheets/d/1flbUFHb6ybJVLnnXTf3FQD70YNtd6MneL_xVpPYsscE/edit), the separate published Messenger demo and old tools require it; it is NOT Commerce.

**For real paid SaaS:** Merchant Dashboard is the owner-facing Product editor; Store-level Supabase/Postgres is the transaction/authorization source of truth. A **fresh clean** merchant import CSV/Sheet may be offered, but none of the QA/legacy Sheets should become live commercial Orders/Products storage.

## Drive audit and cleanup — IMPLEMENTED (NOT PERMANENT DELETION)

All six Sheets from project inventory had at least one n8n reference, so **no file was safe for irreversible deletion**. The user's request to eliminate clutter was addressed via a **reversible archive**:
- New [Archive QA folder](https://drive.google.com/drive/folders/1XhK3ZuTyDmg0mr5g-xtpgMthJ0Emu6Ql) under the same original parent `0ANHAo2_j3NJoUk9PVA`.
- Moved `1rdo1xreEbEytrLUtEz3hIQX7OkCzzBpi8VEOpdRyK44` from root to archive and renamed `ARCHIVE TECH - V17_2 COMMERCE 31 TABS QA` (source old name `TIEN404_COMMERCE_V17_2_MASTER_SCHEMA_AND_SYNTHETIC_PRODUCTS_QA`).
- Moved `17rjkZV_u9ye17BLimCePYC7EyZML2GlXSHfX8dFVTgM` to archive and renamed `ARCHIVE QA - V12_4 PERSONAL ORDERS TEST` (old `TIEN404_QA_TESTER_PILOT_01_V12_4_PERSONAL_PRODUCTS_ORDERS`).
- Moved `1br6KbSwpddPBhLt7AyPW2vTedanXJpgOHG6cR_axETg` to archive and renamed `ARCHIVE QA - V12_4 MODEL SANDBOX` (old `TIEN404_QA_MODEL_SANDBOX_V12_4_PRODUCTS_ORDERS`).
- Renamed but **did not move** separate reporting workbook `1Wlzv3xIOYq2bUpDOtXZLauz_qhtUIbJPlbZK1NBqQQQ` to `ARCHIVE TECH - AI SALES V4_3 REPORTING STAGING` (old `TIEN404_AI_SALES_V4_3_REPORTING_STAGING_SCHEMA`); it retains original parent `1elXSlQRIq5sbDb3hkgu328NwnscFo-nL` to avoid changing inherited access.
- Legacy DEMO untouched and remains named `AI_SALES_DEMO`.
- Backup copy of QA workbook made **before** any edit: [Backup of pre-simplification Products](https://docs.google.com/spreadsheets/d/1pNrh-woRqn8eqTZ_gCGEm6_kwdgf5UVDvsrqar8yoVA/edit) in Archive folder; title `BACKUP_V17_4_BEFORE_SIMPLIFY_20261117_DO_NOT_USE_AS_LIVE`.

## Simple QA sheet — IMPLEMENTED

Native main Sheet ID **unchanged** `1xVCzUPVhyUJ0v0pYNpJQKwOKzlr-gNoOCEMkS7AEmKc`; Product tab `sheetId=1759621798`, Guidance `sheetId=174000001`.

- Renamed file to `TIEN404 - 01 SAN PHAM TEST (CHUA BAN THAT)`.
- Kept **all original 14 product column headers exactly** to preserve n8n filters and QA assumptions.
- Made **six most useful columns A:F** visible (`sku,name,price,stock,price_clean,store_id`); **hid, did NOT delete, G:N** (category, variant, unit, wholesale, status, image, source, demo flag).
- Added concise Vietnamese notes to A1:F1, and simplified `HUONG_DAN` to 11 numbered usage/security lines.
- Corrected one erroneous QA-only `Products!F2`: `A002`, `source=AI_SALES_DEMO`, had been accidentally classified `S_QA_A`; restored its QA grouping to `DEMO_LEGACY`. **Original AI_SALES_DEMO workbook unchanged**.
- Verified 30 rows now **21 DEMO_LEGACY, 3 S_QA_A, 3 S_QA_B, 3 S_QA_C**, zero legacy source-to-Store misclassifications. No Product price, stock, name or SKU modified.
- The Product Sheet is still **synthetic QA**, never a verified Store authority. `store_id` sheet filter is not JWT/RLS or a merchant ownership proof.

## Real n8n QA **AFTER** moving/renaming/hiding

- Main simple Product QA workflow `ZKTkS5eeo2cMiXWD`, execution **4352 SUCCESS**, `15/15 PASS`: total 30, legacy 21, Shop A/B/C 3 each, unique SKU and price/stock validity, Shop A filter returns only `QA-F-001/002/003`, no cross-Shop/legacy; model=0, sends=0, order writes=0, hosted RLS untested.
- Archived 31-tab Commerce reference workflow `qmqR3H66QCRXE4Vb`, execution **4353 SUCCESS `24/24 PASS`** after file move.
- Archived personal QA workbook health workflow `cflgNO9ezFVgMIWF`, execution **4354 SUCCESS** `healthy=true`, 21/21 unique products.
- Archived model QA workbook health workflow `zqrmX4rpztRXfPtw`, execution **4355 SUCCESS** `healthy=true`, 21/21 unique products.
- Reporting staging schema QA workflow `1rkrW7TjZOY3jQLu`, execution **4356 SUCCESS** `rows_read=9`, `staging_schema_connected=true`, reporting `report_ready=false` remains unrelated release limitation.
- Verified published Messenger `Z7FdV7uDvApfbURQ` **active**, Published version `d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92` unchanged; QA Bot `8HtaQAJuZWKyNhXu` remains inactive/unpublished. No sends, paid LLM, order writes, Auth changes or hosted Supabase migrations executed.

## FULL_SERVICE: plain-language definition, choice NOT approved yet

`FULL_SERVICE` here is a **scope of disaster recovery**, NOT a Supabase product tier, AI model, feature bundle or one-button switch. In a failure or risky Store migration, an independently recoverable point needs at minimum:

- Consistent Postgres application data and schema: tenants, canonical stores and member roles once available, products, prices, stock, orders, customers, inventory, RLS/policies, Postgres functions/constraints and migrations.
- **Auth** identity and ability for currently authorized shop owners/managers to sign in again; project-specific Auth configuration, callback/SMTP/OTP/SSO dependencies and login behavior must be tested, not inferred from `auth.users` count.
- **Storage** metadata and **object bytes**, including product images if/when added; Supabase DB-only backups do not contain Storage object bytes. Today QA metadata reports 0 Storage buckets and objects, but that alone is not a proof of full recovery.
- External app integrations relevant to business continuity: n8n workflow definitions, encrypted credential custody and reauthorization plans, Messenger/Zalo installation IDs/secrets under private operator control, Cloudflare/Render env variables and DNS/callback configuration. These need separate DR inventory/checkpoint; a Supabase restore by itself does not restore third-party platforms.
- Independently witnessed restore on a **separate authorized test destination**. Validate data count, owner access, old vs new roles, webhook routing in no-send mode, snapshots, RPO/RTO, and rollback to old staging if QA fails. Never restore into current hosted target without separately bounded approval.

**H11R historical manual backup remains owner-accepted WITH LIMITATIONS**, 5/5 app table data, Auth/Storage not independently covered. Current source-consistent recovery scope is still `UNDECIDED`: recommended future goal FULL_SERVICE, but **NO backup/export/restore/paid upgrade has been approved or performed now**.

Supabase organization currently Free. [Supabase official backups docs](https://supabase.com/docs/guides/platform/backups): paid projects get automatic daily DB backups; Free users are advised to export and maintain offsite backups; DB backups do not include Storage bytes. FULL_SERVICE can be built through separately verified manual backups/recovery runbooks without automatically upgrading, but may incur storage/service/operator costs depending on scope.

**Alternative:** `APPLICATION_WITH_EXTERNAL_AUTH_STORAGE_PLAN` can be chosen for early staging if the application backup is verified **and** Auth/Storage recovery is separately proven; it is not permission to skip either.

## Status / blockers / rollback

**VERIFIED + TESTED:** all Sheets retained with exact IDs, 3 technical Sheets archived, 1 Reporting renamed, one QA main simplified, n8n #4352 15/15, #4353 24/24, #4354/4355/4356 success.  
**IMPLEMENTED:** user-facing uncluttered Google Sheet, archive folder, verified backup copy, corrected a QA Store label.  
**BLOCKED:** actual current M0 full restore, four original Store ownership attestations, same-Tenant Store JWT RLS, production order/stock release.  
**AUTHORIZATION:** no irreversible file deletions because every candidate has a live connector reference; no Commerce or production writes.  
**ROLLBACK:** restore main Sheet from the verified pre-simplification backup if required (with isolated diff, avoid overwriting user edits), or unhide G:N and restore previous guide from backup; move archived files back to verified original parent `0ANHAo2_j3NJoUk9PVA` and names above, or rename Reporting back in original folder. Don't delete evidence or old Sheet versions before no-reference acceptance.
