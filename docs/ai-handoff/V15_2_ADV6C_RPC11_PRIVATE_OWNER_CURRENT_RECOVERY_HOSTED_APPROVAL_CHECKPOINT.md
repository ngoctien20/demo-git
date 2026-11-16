# TIEN404 AI — V15.2-ADV.6C-RPC.11
## Private Four-Row Owner Authority × Current Recovery Evidence × Phase-Specific Hosted Migration Approval

**Checkpoint:** 2026-11-17 JST  
**Lifecycle:** SOURCE-ONLY DRAFT / PRIVATE OPERATOR INTAKE PREPARED / HOSTED NO-GO  
**Parent:** RPC.10 [Draft PR #237](https://github.com/ngoctien20/demo-git/pull/237), base `8cebbf72aabb943242c4dcbecb83238292c258d6`  
**Supabase staging:** `ifxlvrhyjhbzbrkdsida`.

### 1. VERIFIED — fresh read-only hosted inspection, without row IDs or PII

| Evidence | Verified current observation |
|---|---|
| Tenant and Commerce footprint | **2 Tenants**, each has 1 Product + 1 Order and an active Tenant Owner; 2 Products, 2 Orders, 0 Customers |
| `stores` / `store_memberships` | **absent** |
| `store_id` on Commerce | **absent** |
| Current PostgreSQL | **17.11** |
| Commerce SELECT RLS | **three Tenant-scoped PERMISSIVE policies** |
| `products_tenant_id_sku_key` | Tenant-wide `UNIQUE(tenant_id,sku)` remains |
| Legacy `qa_shop_b_zalo_claim` | `anon EXECUTE=true` |
| `auth.users` | **3 rows** (aggregate count only; no identities inspected) |
| `storage.buckets` | **0 rows** |
| `storage.objects` | **0 rows** |

No Store ID may be invented from Tenant owner membership, SKU, names or model outputs. There are **two distinct Tenants**, not a verified same-Tenant Shop A/B ownership arrangement.

**Caution:** these counts are live metadata **at the time of this read-only check**, not a guaranteed current recovery point, signed snapshot, hosted JWT proof or independent restore. They may change later.

### 2. Owner-accepted H11R checkpoint retained — no redundant export

Canonical prior status remains **`H11R_PARTIAL_APPLICATION_ARCHIVE_LOCAL_QA_OWNER_ACCEPTED_WITH_LIMITATIONS`**.

- The operator ran `Inspect-TIEN404-RPC7-M0.ps1` locally and reported historical H11R SHA/size match, 5/5 Application TOC entries, Auth 0/3 and Storage 0/2. This is an owner-accepted *partial application archive inspection*, not full service recovery.
- The owner explained pgAdmin originally did not select/configure the component called “Application Auth” and will configure missing components later. This is **owner-reported cause**, not independent technical proof of omitted Storage metadata/object bytes.
- **Current Auth has 3 user rows.** The historical local archive lacking Auth data therefore cannot be claimed to restore all current Auth users. Current Storage DB has 0 buckets/objects, which does not make Auth or future Storage recovery irrelevant.
- Supabase official documentation: database backups include metadata, **not Storage object file bytes**, and a new-project database clone does not fully clone Auth settings, Storage files/settings, Edge Functions etc. References:
  - https://supabase.com/docs/guides/platform/backups
  - https://supabase.com/docs/guides/platform/clone-project
- Do not repeat the already completed local SHA/TOC checks, overwrite H11R, or export a new live archive under this Draft.

**Two separately scoped recovery choices:**
1. **Full service** — independently approved and verified recovery of current database + Auth + relevant Storage object bytes/settings and other deployed dependencies.
2. **Application with external Auth/Storage plan** — the H11R partial application archive may remain accepted *as historical structural evidence*, but real migration M0 still requires a fresh source-consistent recovery point, approved independent restore and an **independently tested, separately authorized external plan for actual Auth (3 users currently) and Storage dependencies**.

Selecting a recovery option in a JSON file or CLI is **not permission** for backup/export, restore, customer writes or hosted schema changes. The present evidence does not establish either scope as an approved *current* hosted recovery.

### 3. IMPLEMENTED — private current row ↔ existing Owner ledger reconciliation

**New files:**
- `qa/v152-rpc11/private-fourrow-current-snapshot-reconcile.cjs`
- `qa/v152-rpc11/private-fourrow-current-snapshot-cli.cjs`
- `qa/v152-rpc11/private-fourrow-current-snapshot-reconcile.test.cjs` (20 synthetic tests).

This REUSES the approved V14.4.3 ledger via RPC.6 rather than inventing new identity/signature standards. It checks an operator-supplied **current private metadata snapshot** against the pre-existing private Owner ledger:
- Precisely **2 Products and 2 Orders** in **two distinct Tenants**, one Product + one Order per Tenant.
- Exact table/row ID/tenant ID matching, unique source row IDs, recent snapshot timestamp (at most ten minutes old for this format review).
- Exact source `updated_at` and evidence `snapshotSha256` string match per row.
- Existing three evidence types per record; Merchant actor different from Independent Reviewer; no cross-Tenant Store ID reuse — through the inherited V14.4.3 linter.

**Untrusted inputs warning:** a user can forge both matching JSON files. Passing these tests is **only structural evidence intake**. The module does not fetch Supabase, authenticate snapshot origin, validate Ed25519 signatures, inspect merchant source documents or establish actual Store ownership. It permanently outputs `actualOwnerToCanonicalStoreProven=false`, `canBackfill=false` and `canMigrate=false`. It prints no row UUIDs, tenant UUIDs, candidate Store IDs, source digests, customer data, JWT or secrets.

### 4. Private operator procedure — not run in this PR

No private original 4-row ledger or live row contents were accessed in ChatGPT.

**Approval prerequisite:** Appoint an authorized Merchant/Controller and a **different** Independent Security Reviewer, authorize a narrowly scoped operator read, agree retention, source snapshot and exact staging project. Do not use a generic GitHub Draft approval as permission to read confidential primary records.

1. A properly authorized operator, on an isolated device, may use `docs/ai-handoff/V15_2_ADV6C_RPC11_PRIVATE_OPERATOR_READ_ONLY_ROW_METADATA.sql` to read **only** Product/Order UUID, Tenant UUID and `updated_at` from Supabase staging; the SQL was *not executed by this PR*. No `SELECT *`, Customer PII, order totals or `service_role` bypass is necessary for the metadata shape review. The query result remains private.
2. Separately obtain **real merchant-origin Store** source for every row, and an independently verifiable row-version digest of the genuine primary source. A self-generated random hash is insufficient for authority.
3. Prepare an approved private JSON file (outside the repo and CI) with top-level `{ "snapshot": { "contract": "T404_RPC11_CURRENT_ROW_METADATA_SNAPSHOT_V1", "projectRef": "ifxlvrhyjhbzbrkdsida", "capturedAtUtc": "...", "rows": [ ... exactly 4 private metadata records ... ] }, "ownerLedger": { ...existing V14.4.3 private ledger... } }`. Metadata row fields are `table,rowId,tenantId,sourceUpdatedAt,sourceSha256`; do not paste real UUIDs into GitHub or this chat.
4. On the authorized Windows operator machine where the branch is checked out, execute **locally only**:

   ```powershell
   Get-Content -LiteralPath 'PATH_TO_APPROVED_PRIVATE_SNAPSHOT_AND_LEDGER.json' -Raw |
     node .\qa\v152-rpc11\private-fourrow-current-snapshot-cli.cjs
   ```

5. Treat `STRUCTURAL_ROW_JOIN_READY_FOR_EXTERNAL_PRIMARY_SOURCE_REVIEW` as **FORMAT/PACKET READY** only. The independent reviewer must still compare original merchant source documents, exact DB row snapshot, relevant Auth/Store authority and credential provenance off-band. If any row is ambiguous: **STOP**, do not assign Store.
6. The local script output has only class, counts and generic blocker codes. **Do not upload raw ledger or complete private source receipt to GitHub/CI/ChatGPT**; the non-identifying status may be recorded in the project checkpoint.

### 5. IMPLEMENTED — separate STAGING phase authorization packets

**New files:**
- `qa/v152-rpc11/scoped-hosted-approval-packet.cjs`
- `qa/v152-rpc11/scoped-hosted-approval-packet-cli.cjs`
- `qa/v152-rpc11/scoped-hosted-approval-packet.test.cjs` (22 negative/positive synthetic format cases).

The source-only packet verifier requires **distinct exact receipt types and a separate, scoped acknowledgement for each phase**:

| Phase | Key evidence required | Never implied |
|---|---|---|
| `M1_SCHEMA_ONLY` | fresh 4-row source, private Owner review, approved current recovery scope + independent restore, exact M1 schema, callers, rollback | backfill, RLS cutover, M3, RPC revoke |
| `M2_M4_ATOMIC` | hosted M1 acceptance, independent Owner→Store evidence, independent restore, atomic cutover QA, real same-Tenant and cross-Tenant JWT, controlled reader/writer blackout, rollback | zero downtime, M3, RPC revoke |
| `M3_COMPOSITE_FK` | real M2/M4 acceptance, current recovery, M3 FK/SKU QA, same-Store Customer, signed JWT and privileged writer checks, lock/rollback budgets, client contracts | M1 permission reuse, RPC revoke, publish |

For a single phase it requires exact staging project, commit SHA, unique one-time nonce digest, a maximum 30-minute approval packet interval, **distinct** Controller / Independent Security Reviewer / DB Operator actors and an immutable SHA-256 scope commitment tying each approval claim to the phase and receipt digests.

**No cryptographic signature verification or authoritative signer roster is present.** The commitment proves only internal agreement of the *submitted claims*. It **does not** prove that a real Controller/Reviewer/DB Operator endorsed anything. Even a complete packet is only `STRUCTURAL_PACKET_READY_FOR_PRIVATE_ORIGINAL_EVIDENCE_REVIEW`; **`approvalGranted=false` and all hosted operations remain disabled**. This code does not mint signatures, assign a trusted operator, execute SQL or consume a one-time nonce on any database.

Local format check, if privately approved:

```powershell
Get-Content -LiteralPath 'PATH_TO_PRIVATE_PHASE_PACKET.json' -Raw |
  node .\qa\v152-rpc11\scoped-hosted-approval-packet-cli.cjs
```

Any real migration requires *another* operation-specific user authorization after independent review of the original records, real Auth/Storage recovery dependencies, writer inventory, recovery logs and migration rollback. RPC revocation and Published n8n cutover are separate future decisions.

### 6. QA and audit acceptance

Run:
- 20 new private row/source join negative tests;
- 22 new phase-specific approval contract tests;
- 155 existing RPC.10, RPC.9, RPC.7 H11R archive, RPC.6, V14.4.3 Owner, ADV6C backup and RPC.5 security tests;
- static scan proving no hosted SQL/network/export or live action method;
- **intentional RED hosted NO-GO** gate.

**Expected total: 197 Node tests.** Mark `TESTED` only when exact HEAD GitHub Actions completes. The RPC.10 PostgreSQL 17 M3 code was unchanged in RPC.11; no duplicate expensive disposable database run needed for this source-only milestone. Its own previous independent QA remains recorded under PR #237.

### 7. Decisions, risks, rollback and next actual dependency

**VERIFIED:** two real Tenants with a Product+Order each, no Store schema, three Tenant PERMISSIVE Commerce policies, current 3 Auth users and zero Storage bucket/object rows, legacy anonymous RPC access.
**IMPLEMENTED:** private snapshot-to-Owner-ledger comparator, private STDIN CLI, strict phase-specific envelope/checker, private read-only SQL SOP, tests/CI.
**TESTED:** only after CI log inspection.
**BLOCKED:** actual four-row independent Store ownership proof, actual source snapshot and source digest, current authorized recovery point with independent restore and Auth plan, real Owner A/B JWT, published caller inventory and per-operation verified signatures/approval.
**NO-GO:** Supabase hosted M0/M1/M2M4/M3, Auth/Storage export, privileged RPC removal, Published n8n edits or provider sends.

**Next real action:** an independently authorized private Operator+Merchant+Reviewer inspection of the **four original rows**. Do not guess ownership. Parallel decision: obtain an approved current recovery method; do not re-export the H11R archive automatically. The user-accepted partial H11R local QA remains respected, without bypassing the hosted recovery prerequisite.

**Rollback:** close the unmerged child Draft PR. No Supabase hosted schema, real records, credentials, Storage, Auth, n8n workflow or Cloudflare deployment was changed by this milestone.

**Checkpoint status:** `RPC11_PRIVATE_EVIDENCE_INTAKE_READY_HOSTED_MIGRATION_NO_GO`.
