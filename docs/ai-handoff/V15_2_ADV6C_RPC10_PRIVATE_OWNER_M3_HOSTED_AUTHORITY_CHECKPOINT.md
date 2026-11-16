# TIEN404 AI — V15.2-ADV.6C-RPC.10
## Real Four-Row Ownership Evidence × M3 Composite FK Readiness × Independent Hosted Authorization

**Checkpoint date:** 2026-11-17 JST
**Status:** PROPOSED → SOURCE-ONLY DRAFT / DISPOSABLE QA; **NO HOSTED SQL OR PRIVATE CUSTOMER DATA**
**Parent:** RPC.9 Draft PR #233 at `134e70b17f0c0b8dd515843fad823b991f4c7e9b`
**Project:** staging Supabase `ifxlvrhyjhbzbrkdsida`

### 1. VERIFIED — current hosted database (read-only SQL, aggregates only)
- **2 distinct Tenants**, each has 1 Product + 1 Order and an active Tenant Owner; total 2 Products / 2 Orders / 0 Customers.
- **No** `public.stores` or `public.store_memberships`. Neither the existing Tenant Owners nor a synthetic Store A/B/C test establish individual real Store ownership.
- Old `public.orders(tenant_id, customer_id)` foreign key references `public.customers(tenant_id,id)`: a Customer relationship is valid within Tenant but not constrained to the same Store.
- Old `public.products` unique `(tenant_id,sku)`: cannot yet use identical SKU independently in two Stores under one Tenant.
- All Commerce policies `products_member_read`, `orders_manager_read`, `customers_manager_read` still Tenant-wide PERMISSIVE; legacy privileged RPC `public.qa_shop_b_zalo_claim(uuid,text,text,text)` still permits `anon EXECUTE`.
- **M1/M2/M4 not deployed**, so a real live M3 migration is not eligible.

### 2. H11R acceptance preserved exactly (do not redo)
**`H11R_PARTIAL_APPLICATION_ARCHIVE_LOCAL_QA_OWNER_ACCEPTED_WITH_LIMITATIONS`**
- User-operated private local archive inspection: SHA-256 and byte-size matched earlier reference; 5/5 Application TABLE DATA entries, Auth 0/3, Storage 0/2.
- Owner reports original pgAdmin export did not select/configure what they called “Application Auth” and plans to add later. This is owner-provided, not independently proven as full root cause for Storage omissions. Supabase Storage object **bytes** are not in ordinary PostgreSQL database backups.
- Acceptance is limited to previous partial **application archive local TOC/identity QA**; it does NOT establish actual independent hosted recovery or authorize M0 full-service restoration, M1 hosted DDL or M3.
- No new backup, pgAdmin reconfiguration, or real restore performed in RPC.10.

### 3. IMPLEMENTED — executable only on disposable PostgreSQL 17
Child files inherit the **exact tested** RPC.8 synthetic legacy schema, RPC.8 M1 and RPC.9 atomic M2+M4 test source:
- `qa/v152-rpc10/pg17-m3-composite-fk-disposable-only.sql`: hard-coded PG17 `t404_rpc8_ci` + `RPC8_DISPOSABLE` + role `postgres` guard; only `qa_rpc8` test schema, never `public`. Source row/Owner mapping/policy counts must match expected test fixture, else abort.
- M3 adds **four independently validated composite FKs**: Products→Store, Orders→Store, Customers→Store on `(tenant_id,store_id)`, plus Orders→Customers on `(tenant_id,store_id,customer_id)`. It adds unique `Customers(tenant_id,store_id,id)` to back this last FK.
- M3 makes all three Commerce `store_id` fields **NOT NULL** after exact source preflight and successful constraint validation, preventing a NULL key from bypassing the Store relation.
- M3 adds `UNIQUE(tenant_id,store_id,sku)` and removes the old `UNIQUE(tenant_id,sku)` **only in disposable CI**, after testing that all rows have canonical Store attribution. This enables same SKU across different Stores in the same Tenant, but forbids duplicates within the same Store.
- `qa/v152-rpc10/ci-pg17-m3-composite-fk-rehearsal.sh`: setup via inherited tested source, adds two **fake** Customers A/B in the same Tenant. Reproduces legacy FK allowing wrong Store Customer link inside rolled-back transaction, then M3 entire transaction ROLLBACK, a deliberately bad preflight negative, a disposable M3 COMMIT, cross-Store/wrong-Tenant/NULL Store negative writes, Store SKU collision and RLS Store A/B/C joined reads, revoked Manager.
- All Customer IDs, fake Orders and Store mappings in these files are synthetic, NOT user data.

**Important:** This is a *candidate schema change for review*, not a hosted DDL migration. Real workload DDL could block readers and writers; timing, validation duration and rollback costs are not measured. No PostgREST API contract or real user JWT/privileged writer compatibility is established by synthetic PG17 role checks. The existing tenant-only Customer FK is **preserved** in the rehearsal as an additional restriction; eventual retirement requires independent review.

### 4. Real four-row ownership — private independent acceptance remains BLOCKED
The correct historical layout is **two Products + two Orders belonging to two distinct Tenants**, not two confirmed Stores sharing one Tenant. No public Customer rows are currently present, so the two Customers used in M3 tests are fake only.

There is no authorized independent primary-source evidence for the four exact row IDs available to this ChatGPT session. Do not infer row-to-Store assignments from Tenant ID, SKU, product names, synthetic QA labels, AI outputs, or counts.

**Private operator procedure (no upload to chat or GitHub):**
1. Controller appoints authorized Merchant/Owner and **different independent Reviewer**, plus narrowly scoped Operator. Record consent for each evidence read, its purpose and retention; do not rely on blanket GitHub Draft approval.
2. In a trusted private environment, read-only inspect each of the **2 actual Product + 2 actual Order** records under permitted DB credentials, matching original Tenant and current row version/snapshot with trusted merchant ownership source; keep row identifiers, phone, JWT and any financial/private values outside GitHub/ChatGPT.
3. For each row, correlate actual channel/merchant origin, canonical proposed Store ID, Tenant ID, source hash, authorizing merchant decision and independent reviewer evidence. A legitimate Store ID cannot be derived simply from an owner membership in a Tenant. Reject any mismatch or missing independent proof.
4. Reuse the existing `qa/security-definer-v1443/four-row-owner-evidence.cjs` through `qa/v152-rpc7/private-fourrow-ledger-cli.cjs` **locally** on the private ledger. Its `READY_FOR_MANUAL_PRIVATE_EVIDENCE_INSPECTION` only validates **format**, not authenticity. Reviewer must separately inspect original source and certify real signer authority.
5. If even one row cannot be reliably mapped, **fail closed**: `REAL_FOUR_ROW_STORE_OWNERSHIP=BLOCKED`, `M2_M4=NO_GO`, `M3=NO_GO`. Do not create a Store or backfill on guesswork. Never paste private ledger/TOC/credentials into PR comments.

**What can be accepted now:** only the read-only, aggregate **two Tenant/one Product/one Order each** fact. No four-row Store ownership acceptance.

### 5. Independent hosted authorization: separate staged decisions
**No real authorization exists in this Draft.** A correct approval package must establish:
- Real M0 recovery point, approved backup scope including Auth/Storage dependency handling and independently tested isolated restore, distinct from old H11R limited acceptance.
- Distinct M1 schema rollout approval and actual hosted Store schema verification.
- Real individually verified Owner→Store mapping (four original rows) and the separately approved atomic M2+M4 cutover (with reader blackout and RLS policy replacement) actually accepted.
- A separate M3-only Controller+Security Reviewer+DB Operator decision scoped to exact staging project, SHA, migration window, row counts, FKs, Store SKU unique behavior, lock budget, fail-closed checks and documented rollback; all writers and privileged `SECURITY DEFINER` callers inventoried.
- Real Owner A/B **same Tenant** JWT tests with positive/negative GET-only responses, revoked staff and cross-Tenant isolation. Do not treat a synthetic role GUC as real signed JWT proof.
- No old Tenant-wide PERMISSIVE Commerce policy left when real same-Tenant Store records become visible. No public RPC privilege removal as part of M3.

`qa/v152-rpc10/private-owner-m3-hosted-preflight.cjs` only checks a **self-reported evidence packet** and always returns `canApplyM3=false`. No fake green packet can authorize actual SQL.

### 6. QA, checkpoint, rollback
Run all existing RPC.9 140 Node cases plus 15 new RPC.10 owner/M3/authority tests, static no-hosted checker, and disposable PG17 fixture chained from RPC.8 M1 + RPC.9 M2/M4 + RPC.10 M3. Mark `TESTED` only after exact-commit Actions logs verify results. **Intentional hosted release NO-GO job** is expected to fail.

**VERIFIED:** current hosted aggregate, FK and SKU schema, missing Store tables and legacy anonymous RPC privilege.
**IMPLEMENTED:** disposable M3 FK/SKU candidate, PG17 negative/rollback script, source-only M3 approval gate, 15 synthetic tests, CI.
**BLOCKED:** real four-row Owner-to-Store identity, approved current recovery/isolated restore, hosted M1/M2M4, JWT, live writer compatibility and separate M3 approval.
**ROLLBACK:** close child Draft PR. No Supabase hosted restore needed; no public database, real Customer, credential, n8n Published, provider send, Cloudflare deploy or RPC privilege change was made.

**Checkpoint classification:** `RPC10_M3_DISPOSABLE_CANDIDATE_HOSTED_NO_GO`.
