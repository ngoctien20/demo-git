# TIEN404 V15.2-ADV.6C-RPC.8
## Owner→Store Private Evidence × M1 Expand-Only PostgreSQL Rehearsal × Recovery Scope Carry-Forward

**Lifecycle:** EXPERIMENTAL / DRAFT PR / NO-SEND / NO HOSTED WRITES  
**Parent checkpoint:** RPC.7 PR #198, HEAD `cc25695d8c4f2ec355abd95014b6527e6eccc5df`  
**Project:** Supabase staging `ifxlvrhyjhbzbrkdsida`

## 1. VERIFIED — source audit before development

Read-only Supabase queries rechecked:
- 2 Tenants; 2 Tenants each contain 1 Product + 1 Order and >=1 active Tenant Owner.
- `public.stores` and `public.store_memberships` **absent**; `store_id` absent on Products/Orders/Customers.
- `products_tenant_id_sku_key UNIQUE(tenant_id,sku)` remains. Orders Customer FK only `(tenant_id,customer_id)`.
- All three Business read policies `products_member_read`, `orders_manager_read`, `customers_manager_read` are **PERMISSIVE** and Tenant-scoped.
- `public.qa_shop_b_zalo_claim(uuid,text,text,text)` still allows `anon EXECUTE`; no replacement production writer or fully certified caller inventory.
- Supabase Auth and Storage data/bytes are NOT certified as backed up or independently restored.

**Prior H11R receipt retained without repeating work:**
`H11R_PARTIAL_APPLICATION_ARCHIVE_LOCAL_QA_OWNER_ACCEPTED_WITH_LIMITATIONS`:
- Local operator self-report: SHA and bytes matched previous receipt, 5/5 application TABLE DATA TOC, Auth 0/3, Storage 0/2.
- User reported pgAdmin export configuration did not include the component they called “Application Auth”; user will address later. **Not independent root-cause verification for Storage omission.**
- That partial archive is owner-accepted as a **local application archive inspection milestone only**, NOT current full hosted recovery or independent restore. M0 remains BLOCKED and M1 migration NO-GO.

## 2. IMPLEMENTED — executable but HARD-GUARDED **disposable PostgreSQL 17 only**

Files:
- `qa/v152-rpc8/pg17-synthetic-legacy-fixture.sql`: ephemeral `qa_rpc8` schema with the **observed hosted shape**, fake two Tenants, two Products, two Orders, no Customers, tenant-only RLS, old SKU uniqueness and synthetic Auth actor GUC. No real UUID/customer data.
- `qa/v152-rpc8/pg17-m1-expand-disposable-only.sql`: executable SQL **only inside `t404_rpc8_ci`, as `postgres`, with `tien404.rpc8_ephemeral=RPC8_DISPOSABLE` and PostgreSQL major 17**. Creates only QA schema `stores`, `store_memberships` and nullable Store IDs on the three fake Commerce tables. Enforces Tenant/Store and Tenant/User composite FKs, FORCE RLS on new tables, self-read-only policies. No INSERT/UPDATE grants to the QA client role.
- `qa/v152-rpc8/ci-pg17-m1-expand-rehearsal.sh`: CI-only tests preflight, executes M1 inside a transaction then ROLLBACK, checks the original schema was restored, applies in a **disposable** transaction, checks counts/constraints/grants, exercises same-tenant Owner A versus Staff B and cross-tenant Owner C access to the new Store registry using fake actor IDs. Tests revoked membership denial and leaves no fake Store assignments.
- No migration file for Supabase public schema, no `apply_migration` call, no n8n Published edits.

These scripts are **not a hosted migration** and must not be copied to a real database: the hard-coded database guard and synthetic actor GUC are not legitimate security controls for production.

## 3. Migration semantics / remaining risks

**M1 = SCHEMA EXPAND ONLY:**
- Preserve Products/Orders/Customers and their original Tenant-only RLS policies.
- Preserve `UNIQUE(tenant_id,sku)`, so same SKU in the same Tenant across Stores remains blocked until separately approved M3.
- Add `store_id NULL` only; no automatic backfill and no mapping inferred from 2 Tenant Owners.
- New Stores and Store Memberships default-deny until an independently authenticated Owner is explicitly assigned by an approved future step.
- Do not use a synthetic current_setting(actor) as real Supabase JWT; real Owner claims and session revocation need separate hosted verification.

**P0 PRE-M2/M4 GATE:** Tenant-scoped PERMISSIVE policies are still present after M1. If M2 starts populating multiple Stores within one Tenant while old policies remain accessible, a Tenant member may see other Store data. Future M2 backfill and M4 policy replacement must be coordinated atomically or under an independently approved *read-access block / maintenance window* before any same-tenant Store rows are exposed; do not allow a dual-policy overlap. This is **PROPOSED**, not performed.

**P0 RECOVERY GATE:** Old H11R partial application archive is **accepted with limitations**, but cannot be treated as a current, independently restored full hosted source. Before M1 itself: independently approved recovery for the selected application-only or full-service scope, Auth/Storage dependency handling and rollback evidence, plus distinct M1 Controller/Reviewer/DB Operator authorization are still required. In particular, no permission was given to change hosted schema or export a new archive.

## 4. Four-row ownership evidence: next private operator task, not a GitHub upload

The four real legacy rows are still **2 Products + 2 Orders in TWO separate Tenants**. Do NOT invent that these rows are two Stores within one Tenant.

An authorized private operator must:
1. Reconfirm row counts and matching source snapshot at the time of review; work only in a private isolated evidence location.
2. For **each** Product/Order, correlate exact row UUID and Tenant UUID against real Merchant Store ownership source, without exposing those values to this PR or CI.
3. Prepare the existing V14.4.3 `PRIVATE_OPERATOR_REVIEW_ONLY` four-row ledger, with Source+Merchant statement+Independent Reviewer evidence classes; ensure Merchant actor != Reviewer actor and Store ID is not reused across unrelated Tenants.
4. Run `node qa/v152-rpc7/private-fourrow-ledger-cli.cjs` by piping the private ledger via STDIN on the approved operator computer, **not** on GitHub Actions. It only validates shape and prints generic issues, not provenance or real signatures.
5. Independent security reviewer checks original sources and real Store binding separately. The validator's `READY_FOR_MANUAL_PRIVATE_EVIDENCE_INSPECTION` does NOT itself authorize Store creation, row backfill, backup/export or M1.
6. Do not request a new Auth/Storage backup now; retain the owner's stated deferral until a separately approved recovery action is planned.

## 5. QA, evidence, acceptance, rollback

CI must show separately:
- Inherited RPC.7 owner-accepted application archive classifier + M0/M1 NO-GO regression.
- Disposable PostgreSQL 17 fixture / M1 transaction rollback / re-apply / privileges and Store access RLS checks.
- Deliberately RED hosted M1 authorization denial (policy, not source-QA regression).

**Actual status at writing:** source files prepared; mark TESTED only after exact HEAD GitHub CI logs are inspected.

**VERIFIED:** Supabase read-only snapshot and historical H11R self-reported partial-archive acceptance.
**IMPLEMENTED:** disposable M1 rehearsal source and private operator checklist.
**BLOCKED:** actual four-row Store owner attribution; full-service Auth/Storage backup; independent hosted recovery and signed M1 migration permission.
**NO-GO:** real hosted DDL/RLS, M2 backfill, n8n Published edit, provider send, RPC revoke, credentials, payment.

Rollback of Draft: close the child PR. No hosted rollback required because the branch changes only source and disposable CI.


## 6. VERIFIED CI acceptance and P0 red-team finding — 16/11/2026 JST

**Exact tested source HEAD (before this documentation receipt):** `b3b5cbacd3a0d958a380a6b049b61d4db31b25a1`  
**GitHub Actions:** https://github.com/ngoctien20/demo-git/actions/runs/43885009042

**TESTED**
- Inherited RPC.7/RPC.6/V14.4.3/ADV.6C/RPC.5: **126/126 Node tests PASS** and static disposable-only guard PASS.
- Actual PostgreSQL 17 throwaway CI: synthetic legacy fixture created, M1 expand executed transactionally and rolled back, null Store IDs/tables restored to original state, then expand applied to QA schema; **database QA job SUCCESS**.
- Preserved two Products/two Orders/zero Customers, three existing Tenant-level PERMISSIVE policies and original `UNIQUE(tenant_id,sku)`. No real Store assignment/backfill; both new tables FORCE RLS; QA client has no INSERT/UPDATE on Store tables.
- QA same-Tenant Owner A / Staff B / other Tenant C and unassigned actor read only their respective synthetic Store registrations. Revoked synthetic member denied instantly.
- **P0 red-team confirmed on actual disposable PG17:** when an additional *synthetic* Shop B Product is inserted into the same Tenant before M4 policy replacement, Owner A sees it under existing Tenant-only permissive Product policy. Removing the synthetic row restores original query results. This **is evidence of a real PostgreSQL policy design vulnerability for future M2 sequencing**, not evidence of an actual hosted data breach. No hosted Store rows exist today.

**Required follow-up before any real M2:** do not perform an exposed Store backfill while legacy broad Tenant policies remain effective. Plan independently approved controlled reader restriction and atomic read-policy migration or transactional Store attribution + policy replacement, with exact rollback and host JWT/role tests. The current PR does **not** implement M2/M4.

**Expected red eligibility job:** `RPC8_HOSTED_M1_NO_GO_REAL_BACKUP_RESTORE_OWNER_PROOF_AND_APPROVAL_MISSING`, deliberate exit code 3. `M0_EVIDENCE_BLOCKED`, `M1_MIGRATION_NO_GO`, `canApplyM1=false`, `canBackfill=false`, `canChangeRls=false`. Overall GitHub run FAILURE reflects policy-denied hosted release while offline QA jobs are green.

**Status:** `RPC8_M1_DISPOSABLE_REHEARSAL_TESTED`; real M0 backup recovery and M1 migration remain **BLOCKED/NO-GO**. User's H11R application archive acceptance remains limited, with Auth/Storage deferral unchanged. **Rollback** of this PR is closing Draft; no hosted database mutation or live traffic occurred.
