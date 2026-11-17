# TIEN404 AI — V17.7 Private M0 Recovery Scope × Four-Row Store Ownership × Independent Restore

**Checkpoint:** 2026-11-17 JST  
**Project:** `ifxlvrhyjhbzbrkdsida` (Supabase staging)  
**Verdict:** `M0_OWNER_PROVENANCE=BLOCKED` · `CURRENT_RESTORE_ACCEPTANCE=BLOCKED` · `STORE_JWT_RLS=BLOCKED` · `M1_DDL=NO_GO`  
**Changes authorized and executed here:** public metadata/count SELECT; source-only branch documentation/SQL. **No hosted writes.**

## 1. Commercial Product system-of-record decision — read before any GO

**NO existing Google Sheet from V17.2/V17.4/legacy DEMO is eligible as production Commerce system of record.**

| Existing file | Grounded contents | Permitted use |
| --- | --- | --- |
| [V17.4 SIMPLE Products](https://docs.google.com/spreadsheets/d/1xVCzUPVhyUJ0v0pYNpJQKwOKzlr-gNoOCEMkS7AEmKc/edit) | 2 native tabs `Products`, `HUONG_DAN`; 30 synthetic/legacy copied rows (21 DEMO + 9 QA), 5 legacy headers plus 9 QA attributes | **QA only.** Reuse *layout* to create a clean private per-merchant import template later; never reuse its mixed data or trusted identity labels for customers |
| [V17.2 MASTER](https://docs.google.com/spreadsheets/d/1rdo1xreEbEytrLUtEz3hIQX7OkCzzBpi8VEOpdRyK44/edit) | 31 technical schema/QA/evidence tabs | Architecture/reference only; no merchant UI and no order authority |
| [AI_SALES_DEMO](https://docs.google.com/spreadsheets/d/1flbUFHb6ybJVLnnXTf3FQD70YNtd6MneL_xVpPYsscE/edit) | Original demo Products/Orders/Customers | **Legacy bot DEMO only**, separate credentials, must not be crossed into paid Commerce |

**Proposed final commercial architecture** (NOT deployed):

```text
Merchant phone Dashboard (Products | Price | Inventory | Orders)
       ├── Product import: new CLEAN merchant Sheet / CSV (optional, scoped)
       └── Authorized server API: verified JWT + Store owner/member role
                    │
              Trusted Store Resolver
                    │
       Supabase/Postgres authoritative tenant_id + store_id
         ├── Products + Variants + Store-specific prices
         ├── Inventory + Reservations + Audits
         ├── Orders + Items + Customers (Store-scoped RLS / FKs)
         └── Verified Channel Bot mappings + Outbox

  Messenger/Zalo/Website signed inbound -> Store-bound core
  -> verified fresh catalog/price/stock -> quote -> confirmation
  -> transactionally authorized idempotent order (after separate GO).
```

**Security boundary:** A value such as `S_QA_A` in Google Sheets is neither a canonical Store UUID nor a permission. Never use raw incoming `tenant_id`, `store_id`, LLM text or a Sheet filter as database authority. The production importer must resolve Store from the authenticated server-side owner/session and record provenance; only publish products after server Store ownership and an approved price/stock contract. Keep all customer PII and order/payment state out of shared sheets by default.

**MVP merchant experience:** one easy `Products` table in the Dashboard with key fields `SKU, name, retail_price_vnd, stock, unit, variant, status`, optional wholesale rule and image, all backed by Store-scoped Supabase. Google Sheets import/sync is optional, not a prerequisite for operation. **Do not provision a real merchant Sheet until tenant/store permissions are verified.**

## 2. Current real M0 preliminary evidence — VERIFIED only as aggregates

New direct read-only SQL successfully ran on `ifxlvrhyjhbzbrkdsida` 2026-11-17 JST. Permanent repeatable query: [v177-m0-recovery-owner-metadata-readonly.sql](../../qa/v175-products-store-rls/v177-m0-recovery-owner-metadata-readonly.sql).

| Observable | Current real staging | Proof it does NOT supply |
| --- | --- | --- |
| Tenant / Product / Order / Customer counts | 2 / 2 / 2 / 0 | No original 4-row Store lineage |
| Active Tenant Owner membership rows | 3 across both Tenants | Not authoritative Store owner evidence |
| Tenants with 1 Product, 1 Order, >=1 active Owner | 2 | Does not identify which Store owns which source record |
| Auth users | 3 | Doesn't prove backup/restore of users/sessions |
| Storage bucket / object metadata | 0 / 0 | Not full Storage/service recovery proof |
| Canonical `public.stores` / `store_memberships` | Both absent | P0 Store authority not implemented |
| `store_id` columns on 6 Commerce surfaces | 0 | P0 Store record isolation not possible in existing schema |
| Store-qualified public policies | 0 | JWT same-Tenant Store A/B RLS untested |
| Anon-executable public SECURITY DEFINER routines | 1 | Privileged routine review remains open; not an alleged exploit |

**No original row UUID/updated_at/digest/contact/owner ID selected.** The 4 required original records are exactly 2 Products and 2 Orders across 2 Tenants. An Operator with independently authorized limited access must privately capture original Store provenance and obtain separate real Merchant + Security Reviewer attestations. Synthetic 9 Products / V17.4's `store_id` values cannot be reused as ownership evidence.

## 3. H11R recovery evidence — Accepted milestone preserved, current GO still blocked

Prior user-accepted H11R archive is `H11R_PARTIAL_APPLICATION_ARCHIVE_LOCAL_QA_OWNER_ACCEPTED_WITH_LIMITATIONS`: hash and bytes checked locally; 5/5 application TABLE DATA; 0/3 Auth and 0/2 Storage entries in **historical archive**. Do not re-run or invalidate that acceptance. Operator report that pgAdmin Auth export was missed is not independent full-service restore verification.

Current Supabase org `pjdoiuhtwrhzkzlhelvr` is `plan=free, tier=tier_free` as independently read from account. Supabase [official Database Backups guide](https://supabase.com/docs/guides/platform/backups) states automated daily backups for paid tiers, and recommends manual offsite backups for Free. Database backup itself does not capture Storage object bytes. **No new current source-consistent backup/export, backup file bytes, isolated restore log, or independent Auth recovery was accessed in this milestone.**

### Proposed M0 recovery choice — NOT owner-confirmed

**Recommended for future commercial multi-store launch:** `FULL_SERVICE` (new current source-consistent application + Auth + relevant Storage/service recovery, independently restored on isolated authorized target).

Alternative `APPLICATION_WITH_EXTERNAL_AUTH_STORAGE_PLAN` is possible if business explicitly chooses it and **all** external Auth/Storage recovery dependencies independently pass. It is not a bypass around current recoverability.

Canonical selected scope remains `UNDECIDED` until Owner explicitly chooses. No migration authorization can be inferred from this checkpoint or existing generic project approval. A paid Supabase upgrade, PITR, new backup target, exports or restore require their own cost/impact consent.

## 4. Reuse RPC.12 private Operator tool — DO NOT build duplicate

Existing [RPC.12 Draft PR #244](https://github.com/ngoctien20/demo-git/pull/244), specifically:
- `docs/ai-handoff/V15_2_ADV6C_RPC12_PRIVATE_OPERATOR_RECOVERY_SCOPE_M1_RUNBOOK.md`
- `qa/v152-rpc12/private-operator-intake.cjs`
- `qa/v152-rpc12/current-recovery-scope-decision.cjs`
- Parent `RPC.11` original-four-row private ledger reconciliation and M1 phase verifier

**Run data never goes to ChatGPT, GitHub, Google Sheets, CI, or a public bot.** Operator machine stores `recovery.json, snapshot.json, owner-ledger.json` outside the repository with access restrictions. The local tool emits only scrubbed statuses; self-reported JSON does not verify signer authority or authorize M1. Existing RPC.12 job source QA is healthy; the two observed overall GitHub Actions `failure` conclusions are specifically **intentional** fail-closed hosted/primary-source NO-GO jobs:
- Run `43911429849`: local-only QA job `133454054309` **SUCCESS**; hosted owner/current restore/M1 job `133454140152` **FAIL as intended** with absent real evidence.
- Run `43911430053`: Ed25519/source QA job `133454055065` **SUCCESS**; hosted certification job `133454152012` **FAIL as intended**, not a source regression.
Do not rerun failing gates to force green or treat CI's red combined status as application malfunction.

## 5. Independent M0 recovery acceptance — STOP conditions

Recovery review is **not yet performed**. Required independently witnessed steps, each separately approved:

1. Private Merchant + Reviewer validate exactly 4 original Product/Order rows against contemporaneous sources; source version/digest and Store owner mapping held only by private Operator. Any ambiguity means `BLOCKED`, no guessed Store backfill.
2. Owner explicitly selects recovery scope. Verify current safe backup method and target, encryption and key custody, completeness of Application+Auth and relevant Storage/service dependencies; no uncovered or unapproved costs.
3. On an isolated, independently approved restore destination: restore source-consistent current snapshot; validate 2 Tenants/2 Products/2 Orders and 3 current Auth users, schema and relevant Storage/service configuration. Include no customer export into public logs and no production credentials in QA.
4. Independent Reviewer checks backed-up source identity, checksum/consistency, restore completion, exact scope and rollback/connection controls. Only then can `M0_CURRENT_RECOVERY_ACCEPTED` be considered.
5. Separately approve **M1 expand-only**, then actual same-Tenant Shop A/B JWT-RLS positive+negative tests, M3 composite FKs, transactional order write QA, and eventually channel send. Never claim `M0` by inherited H11R local scope.

If any signature, independently restorable backup, access authorization, Auth/Storage scope or private original row proof is missing, **DO NOT** run DDL, RLS, `GRANT/REVOKE`, Store backfill or Commerce order writes.

## 6. Milestone outcome

- **VERIFIED:** current org Free plan, 2/2/2/0 hosted Commerce row counts, 3 Owner membership rows, 3 Auth users, 0 Storage metadata records, missing canonical Store authority, still scoped at Tenant level.
- **IMPLEMENTED:** source-only reproducible V17.7 SQL and this decision/acceptance runbook; V17.4 two-tab layout retained as QA sample; no new private evidence or duplicate backup tool.
- **TESTED:** direct current hosted read-only SQL, independent source/CI job diagnostics for RPC.12; no actual restore, signing verification, real JWT or Commerce write run.
- **PROPOSED:** prefer `FULL_SERVICE` current recovery before real launch; clean merchant Product importer backed by Store-scoped Supabase after approved M1/M3/JWT acceptance.
- **BLOCKED:** four original Store ownership attestations; actual current isolated restore; Owner-selected recovery scope; M1/M2/M3; real same-Tenant JWT Store isolation.
- **CHECKPOINT:** source-only in [Draft PR #251](https://github.com/ngoctien20/demo-git/pull/251), no merge/publish/send/model calls/hosted mutations. Rollback = close Draft PR; retain previously approved H11R and V17.4 QA artifact.

**Next approval:** User chooses `FULL_SERVICE` or `APPLICATION_WITH_EXTERNAL_AUTH_STORAGE_PLAN` and authorizes only a **priced/scoped safe current recovery preparation** once operator, isolated destination, exact budget and rollback are identified. This is *not* approval to restore/overwrite an existing project or alter Auth/Store/production.
