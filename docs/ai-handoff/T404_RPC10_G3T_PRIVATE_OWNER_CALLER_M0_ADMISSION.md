# TIEN404 AI — RPC10-G3T: Private Four-Row Owner Attestation × Store-Aware Published Caller Contract × M0 Recovery Admission

**Checkpoint:** 18 November 2026 JST. **Decision:** `STAGING_M1_AND_STORE_CUTOVER_NO_GO`.
**Mode:** Hosted SELECT-only metadata, source-only interface/QA, isolated disposable PG17 tests in GitHub Actions. NO current Orders/Products/customer row contents, Auth JWT, Bot secrets, hosted DDL/DML, published workflow changes or provider events.

## 1. Canonical lineage and zero duplication

- Direct parent [RPC10-G3S Draft PR #391](https://github.com/ngoctien20/demo-git/pull/391), HEAD `4880f4402e8f9dfcc7d0f6813a9a45550e60d673`, 258/258 Node tests PASS and 3/3 GitHub Actions workflow success. **Do not merge to production.**
- Canonical six-surface Store RLS/migration owner [PR #247](https://github.com/ngoctien20/demo-git/pull/247); CI repair under G3R [#387](https://github.com/ngoctien20/demo-git/pull/387); disposable RPC negative and private Auth design under [#385](https://github.com/ngoctien20/demo-git/pull/385); Messenger↔Zalo No-Send [#383](https://github.com/ngoctien20/demo-git/pull/383).
- **Private original four-row intake ALREADY exists**: [RPC12 PR #244](https://github.com/ngoctien20/demo-git/pull/244) `qa/v152-rpc12/private-operator-intake.cjs` and `qa/v152-rpc11/private-fourrow-current-snapshot-reconcile.cjs`. Reuse exact paths on PR #244's branch, not checked-in private data, GitHub CI or ChatGPT.
- **Windows no-Docker backup tool ALREADY exists**: [PR #382](https://github.com/ngoctien20/demo-git/pull/382) `qa/v152-rpc178e/windows-private-backup.ps1`, plus stream-encrypted-app-backup and verify programs. These tools are available as DRAFT SOURCE, not evidence that a current backup/isolated restore exists.
- Existing bot `TIEN404 AI` and live Messenger/Zalo workflows remain unchanged. Do not run getMe, create another Bot or repoint active webhooks for this Store admission.

## 2. VERIFIED new real Auth cohort, exact committed SQL

Executed `qa/v152-rpc10/g3t-current-owner-m0-metadata-only.sql` directly through connected Supabase staging `ifxlvrhyjhbzbrkdsida`. Aggregate-only result, no user IDs or source rows:

| Check | 2026-11-18 observed |
|---|---:|
| Active tenant memberships / Owner memberships | 3 / 3 |
| Confirmed nonbanned active members | 3 |
| Members with unexpired Auth session *record* | 2 |
| Tenant with 2 distinct eligible Owner IDs | 1 |
| Tenant with 2 distinct eligible Owner **session records** | **0** |
| Auth users | 3 |
| Products / Orders / Customers | 2 / 2 / 0 |
| Orders with customer_id | 0 |
| Storage buckets / objects | 0 / 0 |
| Six canonical Commerce store_id columns | 0 |
| save_merchant_product signatures with p_store | 0 |

**Distinct Owner user IDs ≠ two present verified JWTs ≠ two authenticated Store Owners.** Even an unexpired database session row does not prove possession of a signed access token, and the two existing session records do not pair two eligible owners in the same Tenant. Reuse prior V18-P0G read-only admission [PR #385](https://github.com/ngoctien20/demo-git/pull/385); no login impersonation, token export, session changes or new account provisioning.

## 3. G0: Four legacy rows, PRIVATE OPERATOR-ONLY action

**Observed four original rows are 2 Products + 2 Orders, one Product and Order per Tenant.** `order_source` is a channel/source label, not original Store authority. No current cross-channel/customer binding; the current Store registry is synthetic QA.

| Private alias (NO real UUID in GitHub) | Evidence needed | Current state |
|---|---|---|
| `T1_PRODUCT_1` | Current row version/source SHA, real original Merchant and target Store, trusted current owner membership, independent reviewer | NOT ATTESTED |
| `T1_ORDER_1` | Same fields; source order label alone cannot assign Store | NOT ATTESTED |
| `T2_PRODUCT_1` | Same fields for other original Tenant | NOT ATTESTED |
| `T2_ORDER_1` | Same fields for other original Tenant | NOT ATTESTED |

**Use the existing CLI** on a trusted Windows machine. Its source exists in sibling PR #244, so first check out that Draft branch locally or into a separate `git worktree` outside the active main/gh-pages checkout. Never cherry-pick its private data, stage the JSON or print row IDs in chat.

RPC12 supports: `node <private-checkout>\qa\v152-rpc12\private-operator-intake.cjs --recovery <private-file>\recovery.json --snapshot <private-file>\snapshot.json --ledger <private-file>\owner-ledger.json --phase <private-file>\m1-approval.json`. Private JSON must remain outside repo; the tool prints generic blocker codes, never row IDs, and **even a green structural match does NOT authenticate evidence**.

If no ledger/owner data is ready, run `--recovery` alone: get a truthful NO-GO without inventing source digest or reviewer.

For a solo founder, owner can supply Controller scope but **cannot impersonate independent reviewer**. A separate reviewer/secure authenticated evidence process is required for independent acceptance. Do not assert Store A/B ownership based on two Tenant owner IDs or self-signed JSON.

## 4. Published caller *breaking* compatibility contract (DESIGN ONLY)

Four CURRENT Commerce workflows are Published, exact versions still matched when re-inspected in this phase:
- `5Eeh8hbpsoNhuiVo` Tenant Resolver `a99c7350-7aea-446d-bdc5-4b10f52c3ad1`: 3 n8n DataTable GET; must resolve **provider-native validated installation → tenant_id+store_id** server-side, verify active membership and produce trusted scoped context. Never trust user-supplied tenant/store.
- `oOOXicKXGkBskKqh` Catalog `e0f1e345-8e6c-40cb-8e6a-d7ad2eb92696`: one Tenant Products GET; must use Store-scoped source with **both** tenant_id/store_id; unknown Store -> empty/deny (not full Tenant).
- `igPOsSbEgd4NgtRA` Cart `eff32e20-a6d0-4975-88b8-107eae752b4b`: one Tenant catalog GET; require canonical Store pricing/stock, reject cart items from different Store, recompute totals server-side, no fallback to shared DEMO.
- `Y0WLykMtNAldbgL0` V3 Business `3d8b7f89-2058-4a2a-8919-e5ff92c3c484`: four Tenant-level DataTable GETs for Store Rules/Price Rules/Product/Outbox. Scope each to Store, event/Outbox idempotency must include tenant+store; do not send or write from this admission.

16/16 `TIEN404_COMMERCE_*` n8n Data Tables currently lack `storeId` (14 have `tenantId`; 2 are metadata/profile without a Tenant). **Supabase RLS does not apply to n8n Data Tables**. No migration should pronounce Commerce multi-store safe until the n8n plane either migrates to a Store-secure API/DB or uses independently verified Store-bound access and per-request authorization. A plain `storeId` column without trusted membership is not an authorization mechanism.

Two active channels are NOT acceptable as source-only No-Send canaries: `Z7FdV7uDvApfbURQ` Messenger TEST has one outbound HTTP Reply and five DEMO tools, and `yIJk8LvJoLF40Z62` Zalo LAB has two DataTable marker UPSERTs. Do not execute or edit them.

**Critical SQL writer ABI:** PostgreSQL 17 actual `save_merchant_product(p_tenant uuid,p_sku text,p_name text,p_price bigint,p_active boolean,p_initial_stock integer,p_expected_updated_at timestamptz)` is `SECURITY DEFINER`, authenticated EXECUTE, checks Tenant membership but lacks `p_store` and Store ownership. Do not simply add an optional `p_store` and assume callers are safe; propose a versioned Store-aware entrypoint that verifies `auth.uid()` / current Store membership **on server**, with explicit Store selection if user has multiple Stores. No `service_role` shortcut, no client-side RLS bypass, and old RPC callers must fail closed at cutover. The other `qa_owner_pairing` and `qa_shop_b_zalo_claim` RPCs also have no Store reference; anon caller scope for the latter must be reviewed, not silently revoked.

**Atomic cutover** under canonical PR #247: add approved canonical Store ownership, staged proof/backfill with real Merchant evidence, versioned n8n/RPC callers, replace six old Tenant-permissive SELECT policies (OR composition makes adding permissive Store policy insufficient), update FK/index/unique constraints, then six-surface JWT A/B and rollback tests. NO live action in G3T.

## 5. M0: Current recovery, not repeated historical archive checks

Owner previously accepted historical H11R partial **five application tables only, Auth 0 users**. It is valid limited historical evidence; it is **not** a current backup/restore. Current Supabase shows 3 Auth users, 0 storage bucket/object rows; absence of Storage rows does not prove Auth/settings or full future dependencies recoverable. The prior owner screenshot was Free Plan with no automatic platform backups; do not presume paid branching/backups or spend.

Two possible private owner decisions, **neither is yet approved**:
- `APPLICATION_WITH_EXTERNAL_AUTH_STORAGE_PLAN`: independently restorable current application snapshot plus independently verified external Auth recovery for 3 users and declared Storage/service settings; acceptable only with reviewed risk boundaries and rollback.
- `FULL_SERVICE`: fully covered current database/Auth/service/storage scope, tested isolated restore, source consistency and rollback window.

`UNDECIDED` remains current. For source-only/disposable PG17 QA, old backup proof can remain deferred. **Any hosted M1/M2M4/RPC/RLS change** still needs independently verifiable recovery scope; Windows `windows-private-backup.ps1 -Action Preflight` only checks local tool prerequisites (no network). `-Action SchemaBackup/AppDataBackup` would access hosted data and requires separately scoped approval; decrypted archive checksum is not full isolated restore.

## 6. Gate, ownership, rollout and rollback

Source-only G3T gate: `qa/v152-rpc10/g3t-private-owner-caller-m0-gate.cjs`, `*.test.cjs`, current query and redacted snapshot, [existing G3S](https://github.com/ngoctien20/demo-git/pull/391) metadata; no network/IO. Even all self-reported "approved" fields cannot grant real permission. Current blockers:
1. Four Original Product/Order Merchant source records + distinct independent reviewer, currently no admitted proof.
2. Two current signed JWT sessions **and** two different canonical Store memberships within same Tenant.
3. SQL writer versioned Store-aware + n8n Commerce four callers 16-table Store authorization and snapshot version UAT.
4. M0 chosen, current backup/isolated restore verified including relevant Auth/service dependencies, operator + reviewer approval.
5. Separate hosted M1 exact phase/rollback authorization, then six-surface atomic PG17->hosted Store RLS and JWT A/B acceptance.
6. Signed Messenger/Zalo Store install + customer opt-in for a later real order status read.

**VERIFIED:** read-only real Auth cohort, current 7 Published versions, real Product writer ABI; previously G3S metadata.
**IMPLEMENTED:** source-only precise G0/M0/M3 admission checklist, fail-closed judge + adversarial tests, CI.
**TESTED:** only after exact final GitHub Actions SUCCESS. Inherited PostgreSQL 17 disposable tests are not hosted migration.
**BLOCKED:** independently signed 4-row Merchant evidence, live Auth Owner sessions, Store schema/caller and current recovery.
**CHANGES:** GitHub Draft only; no Supabase DDL/DML, Auth user changes, backup action, Customer/Order content reads, credentials, n8n publish, Cloudflare deployment, Messenger/Zalo events or paid resources.
**ROLLBACK:** close child Draft PR without modifying parent #391, #247 or hosted workflows.

**Checkpoint:** `RPC10_G3T_PRIVATE_FOURROW_OWNER_AND_CURRENT_M0_RECOVERY_NO_GO__STORE_AWARE_ABI_DESIGNED`.
