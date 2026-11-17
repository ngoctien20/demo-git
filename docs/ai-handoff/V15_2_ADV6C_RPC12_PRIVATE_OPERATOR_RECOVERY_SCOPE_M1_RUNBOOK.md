# TIEN404 AI — RPC.12 Private Operator Intake Playbook

**Version:** V15.2-ADV.6C-RPC.12 · **2026-11-17 JST**  
**Purpose:** Receive and classify *private* four-row Store ownership metadata, decide current recovery scope, prepare **M1-only** independent authorization request. **NOT an execution approval.**

## Preconditions / do not repeat successful work

Carry forward `H11R_PARTIAL_APPLICATION_ARCHIVE_LOCAL_QA_OWNER_ACCEPTED_WITH_LIMITATIONS`. The earlier H11R archive SHA/size and 5/5 Application TABLE DATA were checked locally and owner-accepted; **Auth 0/3, Storage 0/2 remain absent in that archive**. No further hash check is required to preserve that milestone. The owner stated original pgAdmin export did not select/configure “Application Auth”; they intend to correct it later. Treat that as an **owner-reported explanation**, not independently proven full root cause.

Read-only Supabase baseline rechecked for this scope on 2026-11-17 JST: two real Tenants, two Products and two Orders (one Product/Order per Tenant), zero Customers, two Tenant Owner groups; `auth.users=3`, `storage.buckets=0`, `storage.objects=0`. `stores`/`store_memberships` missing, three Commerce SELECT policies still Tenant-wide PERMISSIVE, and `qa_shop_b_zalo_claim` permits `anon EXECUTE`. **No real Store ownership certified.**

### 1. Select scope — owner decision still pending

- `UNDECIDED` — **current canonical value; no migration scope approved**. Preserves H11R limited QA but blocks M0/M1.
- `APPLICATION_WITH_EXTERNAL_AUTH_STORAGE_PLAN` — **conditional option** aligned with the owner's desire to defer Auth/Storage backup. It is **not a shortcut**: a *current* application recoverable snapshot and **independently tested external Auth recovery for 3 current users and Storage dependencies** are needed before real M1. H11R historical archive alone is insufficient. No real export authorized.
- `FULL_SERVICE` — requires a new, source-consistent and independently restorable recovery point covering current Auth and the relevant DB/storage/service dependencies. The historical H11R archive does not satisfy this. Project cloning/physical backup availability and any costs must be checked per actual account, not assumed.

Official Supabase docs: https://supabase.com/docs/guides/platform/backups (DB backup does not contain Storage object file bytes); https://supabase.com/docs/guides/platform/clone-project (clone includes Auth DB users, but Auth settings and Storage objects/settings need separate consideration). **Zero current Storage metadata records does not prove that all future configuration/bytes are recoverable.**

### 2. Restricted source evidence — exactly 4 real rows

**Only an explicitly assigned real Operator** with authorized and sufficiently narrow read credentials may inspect original row IDs/versions locally; do not make ChatGPT, a CI job or `service_role` the source of approval. The permitted read-only SQL template already exists in parent RPC.11:
`docs/ai-handoff/V15_2_ADV6C_RPC11_PRIVATE_OPERATOR_READ_ONLY_ROW_METADATA.sql`.

Require *two Product and two Order* records, distributed in *two distinct Tenants*, with one Product and one Order in each. **No real Store exists in hosted** and no Store ID can be derived from Tenant Owner, SKU, bot account or synthetic fixtures.

For each row, separately inspect original merchant-origin Store evidence, document authoritative primary source and independently verified snapshot digest, then obtain a real Merchant attestation and *different* Independent Security Reviewer attestation. Keep actual row UUIDs, tenant UUIDs, Store IDs, hashes, any JWT, contacts and source documents **on a controlled private machine**, never GitHub or ChatGPT.

Reuse the V14.4.3 private evidence ledger (three distinct evidence classes per row). Format check:
`qa/v152-rpc11/private-fourrow-current-snapshot-reconcile.cjs`.
The format checker cannot validate signatures, DB snapshots or merchant legitimacy. If any original row's authority is ambiguous: **STOP; no guessed Store assignments**.

### 3. Private input JSON files on Operator's computer (outside git repo)

Keep these paths **outside** the checkout and synchronize no such files to cloud drives/CI. All paths are local absolute paths:

- `recovery.json` (no private row identifiers): object with `scope` (`UNDECIDED` until owner decision), `currentSnapshot`, `h11rReceipt`, and `claimedEvidence`. `currentSnapshot` exact fields: `projectRef, capturedDateJst, tenants, products, orders, customers, authUsers, storageBuckets, storageObjects`. H11R record exact fields: `status, localArchiveShaMatch, localArchiveBytesMatch, applicationEntries, authEntries, storageEntries, operatorReported`. All `claimedEvidence` keys listed in `qa/v152-rpc12/current-recovery-scope-decision.cjs` must be independently substantiated by original records; **do not set them true without proof**.
- `snapshot.json` **PRIVATE**: contract `T404_RPC11_CURRENT_ROW_METADATA_SNAPSHOT_V1`, projectRef, capturedAtUtc and 4 metadata rows: `table,rowId,tenantId,sourceUpdatedAt,sourceSha256`. Must be recent and match actual source; no public customer fields.
- `owner-ledger.json` **PRIVATE**: the existing V14.4.3 `PRIVATE_OPERATOR_REVIEW_ONLY` ledger with exactly 4 matching row IDs and 3 distinct source/merchant/reviewer evidence items per row.
- `m1-approval.json` **PRIVATE, optional**: RPC.11 `T404_RPC11_STAGING_PHASE_PRIVATE_APPROVAL_PACKET_V1` with `phase=M1_SCHEMA_ONLY`, exact commit SHA/TTL/nonce/evidence class references and separate Controller/Independent Reviewer/DB Operator claims. **No valid signatures are proved by JSON alone.**

### 4. One local command — Windows PowerShell (do NOT upload the inputs)

After obtaining the Draft branch checkout and creating the private files under a protected local directory, run this example. Adjust paths on the Operator machine; don't expose private filenames or actual UUIDs in public logs.

```powershell
$repo = "$env:USERPROFILE\Downloads\TIEN404_RPC12_PRIVATE"
$private = Join-Path $env:LOCALAPPDATA 'TIEN404\private-evidence\rpc12'
node "$repo\qa\v152-rpc12\private-operator-intake.cjs" --recovery "$private\recovery.json" --snapshot "$private\snapshot.json" --ledger "$private\owner-ledger.json" --phase "$private\m1-approval.json"
```

If Owner/Reviewer have **not yet prepared** the four-row or M1 evidence, run only with `--recovery` to receive a **clear BLOCKED** status without inventing the missing files.

The CLI emits *only* generic blockers, structural matching counts, selected recovery scope and **hard `canApplyM1=false`**. It must never print row UUIDs, actor IDs, private digests, filenames, password or backup bytes. A malformed file fails closed with a generic message and nonzero exit code. No external network or direct SQL connection is used. The tool has no privileged execution capability.

### 5. Independent approval gates — order matters

1. **REAL_OWNER_4_ROW:** Independent reviewer inspects the four original row-level sources *outside the program* and signs scoped evidence; zero guessed Store IDs.
2. **CURRENT_M0_RECOVERY:** Owner chooses actual recovery scope and authorizes only the necessary current backup/isolated restore as a separately approved operation. Verify recoverability of the three current Auth users and relevant Storage/service dependencies; **do not conflate old H11R acceptance with this current gate**.
3. **M1_SCHEMA_ONLY:** Distinct staged authorization by Controller, Security Reviewer and DB Operator for exact project/commit/current schema/snapshot/maintenance window, after checking all callers and rollback. No automatic migration just because packet format passed.
4. **M2_M4_ATOMIC:** Separate original Owner data proof, real JWT positive/negative checks, reader/writer cutover approval, transaction and rollback; avoid the known PERMISSIVE tenant-read cross-Store window. No zero-downtime certification.
5. **M3_COMPOSITE_FK:** Separate FK/SKU/Order→Customer/current client-compatibility approval and real data integrity acceptance. Public RPC REVOKE is **yet another independent action**.

**Always blocked in this milestone:** actual hosted M0/M1/M2/M4/M3 SQL, backup/export, restore, Auth modifications, token/credential access, n8n Published cutover, Zalo/Messenger send, RPC REVOKE, tenant migration, billable resources. Owner authorization to prepare the Draft is **not** permission for those actions.

### 6. Checkpoint classifications and rollback

- **VERIFIED:** read-only hosted aggregates, current 3 Auth rows/0 Storage metadata rows, no Store schema, legacy RLS and public RPC grants.
- **IMPLEMENTED:** local operator intake + current recovery scope assessment + privacy-safe CLI, reuse RPC.11 four-row and phase format checkers.
- **TESTED:** after exact SHA CI regression is inspected.
- **BLOCKED:** original four row Store authorities, current independent restore, Auth recovery, approved current scope, M1 independently signed real approval.
- **PROPOSED:** optional current recovery method and genuine private operator assignment; no export or restore.
- **ROLLBACK:** close child Draft PR (source-only). No live DB changes to revert.

### 7. Operator evidence handoff policy

Only the following sanitized fields may be shared with project checkpoint:
`ownerLedgerStatus`, `ownerStructuralMatches`, `recoverySelectionStatus`,
`recoveryScope`, `m1PrivatePacketStatus`, `status`, `blockers`.
**Never** share original snapshots, ledger, raw TOC, Auth users, JWT, credentials, signed documents, file paths or private hashes. A structural PASS **never certifies real signer identity or recovery restore**.
