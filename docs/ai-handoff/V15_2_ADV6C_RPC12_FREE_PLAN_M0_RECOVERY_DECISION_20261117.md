# TIEN404 — RPC.12 Free-Plan Current M0 Recovery Decision Pack (READ ONLY)

**Date:** 2026-11-17 JST  
**Scope:** independent plan/metadata read + official Supabase recovery docs; **no export, no restore, no credential, no new infrastructure**.  
**Parent:** [RPC.12 Draft PR #244](https://github.com/ngoctien20/demo-git/pull/244).  
**Decision state:** \`UNDECIDED\` — operator must NOT interpret this packet as user authorization to perform M0/M1.

## 1. Direct evidence (VERIFIED, counts only)

- Actual Supabase organization subscription: **Free**, checked via connected project→organization read-only API.
- Actual staging project \`ifxlvrhyjhbzbrkdsida\` is **ACTIVE_HEALTHY / PostgreSQL 17.11**.
- Project has **0 active development branches** in the connected listing. Do not create one without checking account-specific cost and explicit owner approval.
- Hosted anonymous aggregate SQL, \`BEGIN TRANSACTION READ ONLY\`: **3 Auth users**, **0 Storage buckets**, **0 Storage objects**, **2 Products**, **2 Orders**, **0 canonical Stores/Store Membership**.
- H11R historical local archive remains **OWNER ACCEPTED WITH LIMITATIONS**: previous SHA/size and Application TOC checks were performed, **5/5 app entries**, **0/3 Auth**, **0/2 Storage** in the historical archive. Do not invalidate or redo that old bounded milestone. Do **not** relabel it a *current* independently verified full restore.
- Actual Product/Order source provenance is unproven for four specific hosted source rows; \`app_private.order_idempotency\` has 0 rows joining the two Orders, \`factory_private.events\` and \`factory_private.agent_runs\` have 0 rows. Source labels and Tenant Owners do not assign Store ownership. **Owner evidence remains handled only by RPC.12 private ledger.**

## 2. Official product capabilities at this account's plan

Official Supabase database backup docs:
https://supabase.com/docs/guides/platform/backups

> Automatic daily backups are documented for Pro, Team, and Enterprise projects. Free-plan projects are advised to regularly export their data via the CLI \`supabase db dump\` and keep off-site copies.

Official CLI restore guide:
https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore

- Documentation describes logically exporting **roles, schema, data** into separately retained SQL files, then reconstructing them with **psql** under correct target conditions. A successful dump command or matching checksum is **not** proof of a working restore.
- **Auth users, custom Auth/Storage schema changes, secrets, SMTP/OAuth/provider settings, Storage object bytes, external integration credentials and service dependencies require separate explicit coverage assessment and restore evidence.** A DB metadata backup is not an object-byte backup.
- Project cloning / managed PITR / paid backup availability must not be assumed on Free. Do not create paid resources or switch plan without **account-specific quote + owner approval**.
- If source and target differ in Postgres version, extensions, encryption, roles, migrations or RLS security-owner privileges, independent restore validation must cover them; never use \`session_replication_role\` shortcuts on production based on a public example.

## 3. Two available recovery-scope decisions — NOT YET SELECTED

### Option A — APPLICATION_WITH_EXTERNAL_AUTH_STORAGE_PLAN

Proposed lower-additional-provider-cost approach, contingent on an actual private Operator:
1. Capture a **CURRENT** source-consistent, sealed logical application backup under explicitly approved **read-only export authorization**, separately from the old H11R archive.
2. Independently prove recovery of the **current 3 Auth users and relevant authentication settings/sessions** with a documented external/covered path. Old H11R Auth 0/3 is insufficient.
3. Confirm 0 Storage objects/buckets at exact snapshot time, catalog Storage settings and provide future object-byte backup procedure. “Zero rows” is not itself recovery proof.
4. Offline checksum + contents listing (no actual identifiers in this repo), then **isolated local PostgreSQL/Supabase-compatible restore** with independent reviewer observed verification. Do not reuse a production/staging DB as the restore target.
5. Produce an externally signed acceptance report covering application + Auth + Storage and explicit gaps. **M0 remains BLOCKED until evidence passes.**

### Option B — FULL_SERVICE

Alternative requiring a **source-consistent current full-service** recovery point and successful independent restoration of application, Auth, relevant Storage bytes/configuration and external integrations. It is not available “for free” merely because a logical app dump exists, and it may require paid resources. Obtain a clear provider/account-specific cost quote before authorization.

Both options can involve manual work/operational overhead. Do not claim either as fully tested or cost-free.

## 4. Exact operator approval boundary

The owner must independently and explicitly approve, *separately*:
- **Private evidence role assignment** (named operator and different security reviewer) and actual original-row read scope.
- **Current M0 backup method and any credential use** (only through an operator-controlled channel; never share DB URLs/keys here or in GitHub).
- **Target recovery environment, time window and spend ceiling** with quote where needed.
- **Scoped isolated restore and destructive-test rollback authorization**, never source/hosted writes.
- **Subsequent M1 schema-only migration** only *after* current accepted M0, original four-row Owner proof, caller review and independent signed phase packet. M2/M4 RLS cutover and M3 FK are separate gates.

Until then: \`M0_SCOPE=UNDECIDED\`, \`INDEPENDENT_RESTORE=NOT_TESTED\`, \`HOSTED_M1_M2_M3_M4=NO_GO\`, \`FOUR_REAL_ROW_OWNER=BLOCKED\`, \`REAL_JWT_UAT=NOT_RUN\`. Existing H11R limited acceptance stays intact.

## 5. Safe next actions without additional owner permission

- Verify exact existing RPC.12 private intake/packet formats (do not duplicate them).
- Inspect Supabase plan, current anonymous aggregate counts, migration/read-only function caller inventory.
- Complete synthetic and offline QA in Draft. No private input files or current DB dump may be created on GitHub.
- Ask for the narrow missing private operator/reviewer and current recovery-scope decision only when ready to perform *authorized* action.

**Rollback:** close Draft PR #244 / revert this documentation only; 0 hosted or paid resources affected.

**Checkpoint:** \`RPC12_FREE_PLAN_M0_RESTORE_PATH_RESEARCHED_SCOPE_UNDECIDED__H11R_LIMITED_ACCEPTED_G0_G2_NO_GO\`.
