# TIEN404 RPC.10-G2 — Concurrent Reader RLS Evidence × Cross-System Ownership Bridge

**Checkpoint date:** 2026-11-17 JST  
**Scope:** source-only and PostgreSQL 17 disposable CI; real Supabase/n8n READ ONLY.  
**Parent:** [RPC.10 six-surface Draft PR #247](https://github.com/ngoctien20/demo-git/pull/247). This milestone does NOT publish any service, create tenants/stores, assign real owners, run backup/restore or change hosted RLS.

## 1. G1 / G2 independent disposable PostgreSQL 17 result — VERIFIED

**Tested commit:** \`3de62e2aaa93a129c89cfc6f0b9e871dc0d5676d\`  
**GitHub Actions:** https://github.com/ngoctien20/demo-git/actions/runs/43997749138  
**Results:** 3 of 3 jobs COMPLETED SUCCESS:
- Six-surface Store-scoped PostgreSQL 17 RLS/FK QA: PASS.
- **New, real TWO-session concurrent PG17 black-out test:** PASS. A writer opens exactly one guarded transaction to attribute synthetic rows and replace permissive Tenant policies on all six surfaces, holds \`ACCESS EXCLUSIVE\` locks; an existing synthetic Shop A reader attempts a read **while lock is held**. Catalog \`pg_stat_activity.wait_event_type='Lock'\` proves the reader actually waits. When writer ROLLBACKs, reader sees the original 2 Tenant rows for each of the five populated tables. When writer COMMITs, reader sees exactly 1 Store A row for each of those tables, without the cross-Shop B row. No partial policy/backfill visibility in this bounded fixture.
- 47/47 offline Node Store Gate tests: PASS. Existing hard \`HOSTED_NO_GO\` is intentional and retained.

**Explicit limitations:** No hosted Supabase session, actual owner/JWT, PostgREST, interleaved live writers, latency/load SLO, approved lock/maintenance window, full rollback of real post-cutover writes or actual Meta/Zalo sends. This **does not prove zero downtime**. Synthetic reader's role \`qa_rpc8_user\` is not a Supabase Auth JWT.

## 2. New direct G0 cross-system read-only binding audit

Target Supabase staging \`ifxlvrhyjhbzbrkdsida\` remains PG17 ACTIVE_HEALTHY: 2 separate Tenants, 2 Products, 2 Orders, 0 Customers, and **no canonical hosted public Store table/Store Membership**. Three active Tenant Owner memberships (2 in one Tenant, 1 in the other). No automatic Owner↔Store attribution is lawful from these counts.

Without sharing a single identifier, an in-session exact identifier equality check compared the two real Supabase Tenant UUID values with existing n8n Data Table references:

| n8n source | Total existing rows | Tenant refs populated | Direct exact real Supabase UUID matches | UUID-formatted Tenant references |
|---|---:|---:|---:|---:|
| \`TIEN404_COMMERCE_CHANNELS\` | 6 | 6 | **0** | **0** |
| \`TIEN404_R1_SHOP_BOT_REGISTRY_QA\` | 2 | 2 | **0** | **0** |
| \`TIEN404_V171C_QA_INSTALLATION_BOT_BINDINGS_NO_SEND\` | 3 | 3 | **0** | **0** |

These may be legitimate **aliases/keys** and are **not evidence of malicious or corrupt data**. However, absent a **verified alias→canonical Tenant UUID→canonical Store UUID binding** contract, their staging \`tenantId\`, \`tenant_id\` or \`tenant_ref\` must never be treated as actual hosted Store authorization. **No raw UUID, account/page ID, recipient, credential, customer information, or source documents were exported into this repo.**

Other aggregate channel evidence, carried from RPC.10:
- Six Commerce Channels have account/Tenant binding and no Store attribute; \`credentialRef\` is blank in all six.
- Staging Merchant Channels has 3 nonempty Store refs and 2 true \`owner_verified\` flags; these **self-reported staging flags** do not bind the actual four hosted Commerce rows to independently authenticated Owners.
- V17.1C three QA installation refs are read-only and all three have \`owner_authority_verified=false\`. QA-only.
- Published n8n Commerce Tenant Resolver \`5Eeh8hbpsoNhuiVo\`, version \`a99c7350-7aea-446d-bdc5-4b10f52c3ad1\`, gets Tenant/channel/feature flags from Data Tables. Its Code node uses \`tenantId\` but contains **no exact \`storeId\`/\`store_id\` identifier**.
- Published Catalog \`oOOXicKXGkBskKqh\` version \`e0f1e345-8e6c-40cb-8e6a-d7ad2eb92696\` and Cart \`igPOsSbEgd4NgtRA\` version \`eff32e20-a6d0-4975-88b8-107eae752b4b\` have Code nodes using \`tenantId\` without exact \`storeId\`/\`store_id\` reference. This is a **source-code indicator**, not an adversarial proof of actual data exposure. Do not edit Published without Integration Team / controller approval.
- Zalo private QA router \`sIPs6egzIwOY1GNv\` does reference Store in a read-only QA code path; it does not certify hosted canonical Store Owner.

**Proposed Integration contract (PROPOSED, not deployed):**
1. Provider native signature and verified installation/Page/OA account, event ID, original sender identity → trusted server-side normalized ingress.
2. A private server-side, owner-approved binding registry maps \`provider + installation_ref + valid version\` → canonical \`tenant_id UUID + store_id UUID + bot_profile_version\`. The registry must be store-scoped with immutable evidence source and controller/reviewer approvals; reject mismatches and duplicate assignments.
3. Never trust client-supplied \`tenantId\`, \`storeId\`, merchant flags, proposed prices, product SKU or AI guesses as authority. Each Commerce read/write should re-check authoritative active Store membership and role.
4. Read-only old n8n Data Table schemas, Sheet DEMO and Supabase hosted Commerce are **distinct**. Never map by alias-string coincidence, do not let Messenger DEMO orders become Commerce rows.
5. Require server resolver integration tests for unknown Page/OA, cross-Store replay, mismatched Page/tenant, owner revocation, and stale/forged signed claims before any production migration.

## 3. Explicit specialist branch dependencies: do not duplicate work

| Responsible evidence/branch | Status |
|---|---|
| [#205 H11R.11](https://github.com/ngoctien20/demo-git/pull/205) | Private signed metadata intake design, NOT actual merchant attestation |
| [#237 RPC.10-M3](https://github.com/ngoctien20/demo-git/pull/237) | Disposable Store composite FK rehearsal, source-only |
| [#241 RPC.11](https://github.com/ngoctien20/demo-git/pull/241) | Four-real-row private snapshot-to-ledger reconciliation, source-only |
| [#244 RPC.12](https://github.com/ngoctien20/demo-git/pull/244) | Private Operator intake and current M0 recovery scope selection; **UNDECIDED**, no hosted approval |
| [#246 SECLOAD-02](https://github.com/ngoctien20/demo-git/pull/246) | Real hosted Tenant RLS and 3 privileged definer RPC source audit, no live mutation |
| [#243 V17.1](https://github.com/ngoctien20/demo-git/pull/243) | Native ingress and store/bot candidate bindings in inactive no-send QA |
| [#247 RPC.10 six surfaces](https://github.com/ngoctien20/demo-git/pull/247) | This branch; synthetic six-surface atomic RLS/FK plus **real PG17 concurrency**; source-only |
| [#248 V17 CBOT-UAT](https://github.com/ngoctien20/demo-git/pull/248) | Cross-channel contract candidate, not a verified commerce release |

**Branch note:** #237 and #247 are *siblings* branching off RPC.9 #233; they are not merged, and cannot both be assumed present in one deployment. Resolve overlapping Store migration design and tests before promotion through an independent Integration/Security review. No automatic merge/force update.

## 4. G0/G2/G3 release gate

- **G0 REAL_FOUR_ROW_OWNER:** BLOCKED until original primary sources for each of the 2 Product and 2 Order records are privately authenticated and two distinct real humans (Merchant/independent reviewer) attest the same exact row identity + canonical Store. A direct alias mismatch is evidence to investigate; not authorization to create a Store.
- **G2 CURRENT_M0:** Historical H11R limited local application archive remains owner-accepted with limitations (5/5 Application TOC, Auth 0/3, Storage 0/2). It is not a current independently restorable point. RPC.12 recovery scope remains **UNDECIDED**; do not repeatedly re-export or reinterpret old evidence. Current hosted Auth/Storage *existence* is not equivalent to backup coverage.
- **G2 HOSTED CUTOVER:** No M1, M3, M2/M4, privilege REVOKE or published workflow cutover until current scope-specific recovery + private approvals, authoritative four-row binding, full caller/writer inventory and maintenance/lock budget.
- **G3 REAL JWT UAT:** BLOCKED; test real authenticated Owner A/B same-Tenant/Manager/revoked and deny cross-Store on all six tables, privileged RPC, server-trusted Messenger/Zalo ingress and rollback only after G0/G2. Simulated PostgreSQL actors ≠ real Supabase Auth JWT.

**Change ledger:** GitHub Draft #247 source/CI only, no hosted DB DDL/DML, Store assignment, RPC grants, n8n Published modifications, provider sends, customer data or paid resources. **Rollback:** close Draft PR #247; no real hosted state to revert.

**Final checkpoint:** \`RPC10_G2_PG17_CONCURRENT_ATOMIC_PASS__HOSTED_OWNER_ALIAS_BRIDGE_G0_NO_GO\`.
