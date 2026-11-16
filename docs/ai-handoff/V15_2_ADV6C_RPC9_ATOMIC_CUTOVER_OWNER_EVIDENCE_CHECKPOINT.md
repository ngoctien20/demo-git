# TIEN404 AI — V15.2-ADV.6C-RPC.9
## Private Four-Row Store Ownership Resolution × Atomic M2/M4 Cutover Design × Hosted Approval Readiness

**Date:** 2026-11-16 JST  
**Lifecycle:** EXPERIMENTAL → DRAFT CANDIDATE (NO HOSTED EXECUTION)  
**Parent:** RPC.8 Draft PR #231, exact base HEAD `2733104162f43e480c5d8fb844753312fe6acf85`  
**Supabase staging project:** `ifxlvrhyjhbzbrkdsida`.

## 1. VERIFIED — current hosted state (Supabase read-only)

- 2 Tenants, exactly one Product + one Order per Tenant, 2 Products, 2 Orders, 0 Customers; both Tenants have active Tenant Owners.
- `public.stores` and `public.store_memberships` **absent**. No canonical hosted Store mapping is available. **2 real legacy Tenants are NOT two Store A/B in the same Tenant.**
- Existing Products/Orders/Customers SELECT policies are `PERMISSIVE` scoped to Tenant, not Store. They are combined with OR if another permissive policy is added. Documented by PostgreSQL 17 and current Supabase RLS docs.
- Legacy RPC `public.qa_shop_b_zalo_claim(uuid,text,text,text)` still grants `anon EXECUTE`; this proposal does not revoke it or change Published callers.

**H11R carry-forward, do not redo:** The user explicitly accepted **only** the existing local partial-application archive inspection milestone: `H11R_PARTIAL_APPLICATION_ARCHIVE_LOCAL_QA_OWNER_ACCEPTED_WITH_LIMITATIONS`. Locally self-reported SHA/byte match, Application TABLE DATA 5/5, Auth 0/3 and Storage 0/2. Owner attributes missing Auth to original pgAdmin configuration and plans to add it later; root cause and Storage object-byte restoration are unverified. **M0 full restore remains BLOCKED**; no export or new backup is authorized.

## 2. IMPLEMENTED — real disposable PG17 test of atomic M2+M4

Everything below runs **only on a synthetic QA PostgreSQL 17 service** at database `t404_rpc8_ci`, role `postgres`, GUC `tien404.rpc8_ephemeral=RPC8_DISPOSABLE`. No Supabase hosted SQL migration or customer IDs are created.

- `qa/v152-rpc9/pg17-prepare-synthetic-three-store.sql`: Reuses RPC.8 M1 disposable schema, then sets up **three synthetic Stores**: Owner A + Manager B in one Tenant and Owner C in a separate Tenant. Includes **3 synthetic Products/Orders**, not the actual 2/2 hosted rows, specifically to expose an A/B cross-Store read risk.
- `qa/v152-rpc9/pg17-atomic-m2m4-disposable-only.sql`: exact QA database/row/old-policy guard; uses `ACCESS EXCLUSIVE` read lock, short lock/statement timeout, explicit synthetic row mapping, validates 3/3 backfill then **drops all three old Tenant-only PERMISSIVE policies** and creates three Store-scoped SELECT policies **in the same PostgreSQL transaction**. Transaction is caller-controlled `BEGIN ... COMMIT` or `BEGIN ... ROLLBACK`. It deliberately does not alter SKU key, add M3 FK, backfill real data, or grant client writes.
- `qa/v152-rpc9/ci-pg17-atomic-m2m4-rehearsal.sh`: asserts the legacy Tenant policy reveals Shop B Product/Order to Shop A (red-team), runs the full transaction and **ROLLBACK**, checks both data and policy restoration; injects unexpected row-count drift and proves fail-closed; commits in ephemeral CI; checks Store A/B/C isolation, unassigned and revoked user negatives. **No production availability or zero-downtime measurement is implied.**
- `qa/v152-rpc9/private-owner-atomic-cutover-preflight.cjs` and tests: reuse RPC.6 live-count gate; demand actual four-row private ownership linter result and separate M0/M1, reader blackout, real JWT/RLS, webhook and independent operator evidence classes. Even a self-reported all-green packet is NOT permission: `canApplyCutover=false`, `canBackfill=false`, `canReplaceRls=false`, `canRevokeRpc=false`.

**IMPORTANT:** A transactional `ACCESS EXCLUSIVE` lock blocks readers while held; this is a *controlled read blackout* (potential downtime), **not zero-downtime certification**. Do not use it as a production migration until the actual maintenance window, timeouts, real read/write callers and rollback are approved.

## 3. P0 migration sequencing requirements

1. Prior RPC.8/M1 is only a **schema rehearsal**. Real hosted `stores` and Store Memberships do not exist. Actual M1 requires independently approved recovery and separate schema authorization.
2. After real M1, the four legacy rows must be attributed by original Merchant/Store sources **privately**: 2 Products + 2 Orders in **two distinct Tenants**. Do not presume same-Tenant A/B or auto-create Store IDs based on `tenant_id`, SKU or LLM. The existing `qa/v152-rpc7/private-fourrow-ledger-cli.cjs` and V14.4.3 linter can validate only ledger shape, not real signatures, live row ownership or authority.
3. If canonical owner-to-Store evidence is missing for even one row, `M2_M4=NO_GO`; no partial Store mapping or RLS swap.
4. Before the read blackout and single transaction, catalog **every** read/write path, Published n8n flow, dynamic caller, privileged RPC, private gateway, auth roles and session refresh/revocation. A writer using old Tenant-only schema or a SECURITY DEFINER bypass can still violate Store privacy after RLS swap.
5. The first approved source-of-truth mapping must be immutable and auditable privately, and reviewed by an **independent Security Reviewer**; Owner statement is distinct from independent review.
6. M2+M4 must be designed as one guarded transaction, without read visibility between data attribution and restrictive Store policy. Verify fail-closed `NULL store_id`, per-Store memberships and no `PERMISSIVE` legacy policy remaining. Where `ACCESS EXCLUSIVE` lock is used, budget and explicitly accept possible temporary downtime. **A PG17 synthetic test does not prove real hosted performance.**
7. **M3 remains separate:** composite Tenant/Store foreign keys, Order↔Customer same-Store constraints, Store-scoped SKU uniqueness, nullable legacy records, authenticated JWT GET-only acceptance, and writer compatibility. No release until independently verified. No `anon` RPC REVOKE or live canary under this work.
8. A complete **real authorized recovery backup and independent restore** is still an M0 gate for real hosted changes. The owner-accepted H11R partial archive remains useful as prior local QA; it is not a current full service restoration certificate.

## 4. Real private four-row evidence intake (BLOCKED)

Re-use `qa/v152-rpc7/private-fourrow-ledger-cli.cjs` locally, with ledger in an authorized private vault, only if the operator is permitted to examine the true four rows. Do not upload any row UUID, Auth JWT, customer identity, ledger file or private backup to GitHub, CI or ChatGPT.

For each Product/Order, independently inspect primary Store/merchant origin, Tenant linkage, any legacy channel account mapping, candidate canonical Store and live source snapshot digest. One merchant attestation and one independent reviewer inspection must bind to the same original row. The existing linter can return `READY_FOR_MANUAL_PRIVATE_EVIDENCE_INSPECTION` for well-formed claims; **that output remains SELF-REPORTED STRUCTURE ONLY** until the original evidence is checked by an independent authorized person. No real row was examined or assigned by RPC.9.

**Current gates:** `REAL_FOUR_ROW_OWNER_STORE=BLOCKED`, `M0_REAL_INDEPENDENT_RECOVERY=BLOCKED`, `M1_HOSTED_NOT_APPLIED`, `M2_M4_HOSTED_NO_GO`, `RPC_REVOKE_NO_GO`.

## 5. CI acceptance / rollback

- Reuse 126 source-only tests from RPC.7 M0/Owner/Backup and earlier RLS.
- RPC.9 adds **14 source-only cases**: fake approval denial, owner mismatch, lack of real backup, maintenance lock, phase scope, JWT and provider verification, zero-downtime false claims.
- Disposable PG17 CI must show red-team old Tenant-read leak, atomic transaction rollback/reapply, correct A/B/C Store RLS, failed-count rollback, revocation, and no synthetic loss.
- **Hosted approval job intentionally fails NO-GO**, to prevent a green unit suite being interpreted as production permission.
- Mark actual test pass only after checking exact commit GitHub Actions evidence.

Rollback of Draft PR: close it; no hosted restoration required because **no Supabase hosted DDL, GRANT, RLS policy, merchant row mutation, actual backup, webhook send, n8n Published edit, credential access, provider traffic or merge occurred**.
