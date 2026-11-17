# TIEN404 AI — RPC10-G3S: Original Store Ownership × Published Caller Compatibility × Staging Migration GO/NO-GO

Date: 18 November 2026 JST.
Execution: VERIFIED CONNECTED READ-ONLY SUPABASE + N8N; SOURCE-ONLY G3S SECURE GATE; HOSTED MIGRATION NO-GO.

## 1. Inherit actual work and preserve boundaries

- Direct parent: [RPC10-G3R Draft PR #387](https://github.com/ngoctien20/demo-git/pull/387), pinned SHA 6b32e1f0fe3919af1e911d0df4ee8ae414ceaa58. Its CI repair fully passed both real disposable PG17 isolation + concurrent reader jobs and 230/230 Node tests at exact final HEAD.
- Canonical six-surface SQL/migration owner: [RPC10 Draft PR #247](https://github.com/ngoctien20/demo-git/pull/247), which is STILL DRAFT; PG17 guarded SQL is disposable-only (t404_rpc8_ci), NOT a ready hosted migration.
- Avoid duplicate security work: [PR #385](https://github.com/ngoctien20/demo-git/pull/385) evolves disposable RPC negative, Store A/B, preview and Auth admission. This G3S only reconciles CURRENT hosted caller+Store origin evidence. [PR #383](https://github.com/ngoctien20/demo-git/pull/383) is Messenger/Zalo cross-channel NO-GO, independent of Commerce Store migration. [PR #244](https://github.com/ngoctien20/demo-git/pull/244) owns private four-row operator intake, [PR #382](https://github.com/ngoctien20/demo-git/pull/382) is optional no-Docker application backup source tooling; neither has proved full independently restorable current hosted backup.
- No repeat getMe, no new Bot, no production webhook edit. Keep AI_SALES_DEMO separate from Commerce.

## 2. VERIFIED source coverage of the FOUR currently hosted original rows

Executed the EXACT committed read-only SQL file qa/v152-rpc10/g3s-hosted-original-row-provenance-readonly.sql in actual Supabase staging ifxlvrhyjhbzbrkdsida. Output was aggregate only:

| Indicator | Observed |
|---|---:|
| Tenants | 2 |
| Tenants with a Product AND Order | 2 |
| Product rows | 2 |
| Order rows | 2 |
| Customer-linked Orders | **0** |
| Orders with non-empty order_source LABEL | **2** |
| Tenants with two distinct active Owner Auth user IDs | 1 |
| Canonical Store columns in six tables | **0** |
| public.stores and public.store_memberships | Both absent |
| Public SECURITY DEFINER RPC functions checked | 3 |
| Privileged RPC definitions lacking store_id reference | **3 of 3** |
| Tenant-scoped writer save_merchant_product lacking store_id | **1** |

Read-only coverage of a row/source label is NOT authenticated original Store ownership. No original row IDs, user IDs, phone/address, customer content, JWT, token or secret was exported. Zero original Product/Order rows have **admitted independent Merchant+Reviewer proof within THIS audit**, which is NOT the same as claiming such external evidence never existed. Required private four-row aliases remain:

- T1_PRODUCT_1 → original Merchant owner + canonical Store + source digest + current authenticated Store grant + independent reviewer.
- T1_ORDER_1 → same source-specific proof, NOT inferred from the order_source text.
- T2_PRODUCT_1 → second source-specific proof.
- T2_ORDER_1 → second source-specific proof.

Two Auth owner IDs in one Tenant prove possible identity slots, not independent signed sessions, distinct real Shop A/B ownership or permission to use those accounts. Do not backfill synthetic QA map's Store labels into hosted rows.

## 3. VERIFIED CURRENT Published n8n compatibility

Directly inspected the LIVE published version/draft equality, node TYPES and metadata of seven workflows, no execution or credential values read. Snapshot in qa/v152-rpc10/g3s-connected-published-owner-mapping-evidence.json.

| Published workflow | Version | Actual issue |
|---|---|---|
| Commerce Tenant Resolver 5Eeh8hbpsoNhuiVo | a99c7350-7aea-446d-bdc5-4b10f52c3ad1 | tenantId resolution only, 3 DataTable GETs, no canonical Store verification |
| Commerce Catalog oOOXicKXGkBskKqh | e0f1e345-8e6c-40cb-8e6a-d7ad2eb92696 | Tenant DataTable product read, no verified storeId |
| Commerce Cart igPOsSbEgd4NgtRA | eff32e20-a6d0-4975-88b8-107eae752b4 | Tenant catalog read, no verified storeId |
| Commerce V3 Business Y0WLykMtNAldbgL0 | 3d8b7f89-2058-4a2a-8919-e5ff92c3c484 | 4 Tenant-based DataTable GETs, Store Rules name is NOT a Store ownership grant |
| Messenger TEST Z7FdV7uDvApfbURQ | 1064b1b3-d3f1-4a6b-a367-2414ba691522 | 1 real HTTP reply node + 5 DEMO tool workflow nodes; NOT safe No-Send or multi-tenant Commerce |
| Zalo Bot LAB yIJk8LvJoLF40Z62 | 2d912cb0-007f-452f-9536-b92ba12a03e6 | No reply node in inspected graph, but **2 DataTable UPSERT marker writes**, NOT zero-write |
| Zalo private router sIPs6egzIwOY1GNv | 8d91d23c-cd87-462f-a112-9cca2340bec8 | QA registry and owner allowlist reads, contains store_id text in a Code node, **not real authenticated canonical Store authority** |

All seven are Published with active graph matching current draft when inspected. The earlier RPC10 G03 legacy Messenger expected version d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92 is STALE; G3S pins the real current version and refuses drift (without overwriting historical G03 data).

**N8N DATA TABLE SCHEMA:** scanned 16/16 TIEN404_COMMERCE* tables using n8n connector. **14 include tenantId, ALL 16 have ZERO storeId**. Two metadata/config tables lack tenantId: V3_CHECKPOINTS, VERTICAL_PROFILES. This is a second separate authorization plane; a Supabase RLS migration does NOT magically restrict DataTable reads, Orders or Notifications.

**Supabase SECURITY DEFINER RPCs:** live metadata-only inspection of pg_get_functiondef (booleans only, not exporting function source) confirms:
- save_merchant_product: authenticated EXECUTE, auth.uid + tenant_memberships + public.products + tenant_id references, **no store_id** in body. P0 Store write compatibility blocker, not an alleged exploit.
- qa_owner_pairing: authenticated EXECUTE, tenant membership, no store_id reference. P1 owner RPC caller review.
- qa_shop_b_zalo_claim: anon EXECUTE, no store_id reference. P1 signature/role and Store binding review; do not revoke without caller audit.

## 4. Practical, ordered staging GO/NO-GO

G0 PRIVATE ORIGINAL OWNER: HOLD. Obtain a PRIVATE 4-row ledger: original source artifact (not SKU/order_source), verified authenticated merchant/Store owner, current Store membership, exact canonical Store assignment, private digest/date, independent reviewer challenge. Use existing RPC12 PR #244 runbook, not ChatGPT/GitHub for real UUID/customer records.

M0 RECOVERY: HOLD for hosted changes. Founder previously waived additional backup proof only for synthetic disposable QA. Before hosted DDL/UPDATE/privileged grants, independent restore/recovery coverage (current scope including Auth/Storage dependencies), rollback checkpoint, approved maintenance window and stop conditions. Use existing PR #382 tool only if private operator has approved exact scope; an encrypted dump checksum is NOT a tested full restore.

M1 CANONICAL SCHEMA: HOLD. Canonical PR #247 must be reviewed to produce a hosted-specific, guarded and approved migration. Disposable-only SQL explicitly refuses hosted and is NOT suitable for direct staging execution. Hosted schema cannot be changed from a source-only gate.

M3 WRITER/CALLER COMPAT: HOLD. n8n Trusted Tenant Resolver, Catalog, Cart, Business/Outbox and save_merchant_product must accept/derive BOTH tenant_id AND store_id ONLY from a trustworthy server-side signed installation/Store membership, reject customer-supplied store, enforce read AND write scope, preserve DEMO separation. Review every published caller and perform old-writer fail-closed rehearsal without changing production workflows.

M2/M4 ATOMIC POLICY SWAP: HOLD. Six old tenant-permissive SELECT policies must be REPLACED atomically; creating another PERMISSIVE Store policy while old Tenant policy remains is unsafe (OR semantics). Composite FK, index, Order Customer Owner mapping, concurrency reader blackout and rollback all need verified staged tests.

G3 JWT A/B: HOLD. One Tenant currently has TWO Owner auth IDs, but no independently authenticated TWO current JWT sessions bound to TWO distinct canonical Stores in same Tenant. Only after approved Store schema and real owner pairing: A own Store allowed/A→B denied/B own Store allowed/B→A denied, outsider/revoked staff denied, RPC service-role bypass negative QA, no customer data.

CHANNELS: HOLD. Only after G3 and provider owner signed installation proof, customer opt-in link Messenger PSID ↔ Zalo Bot sender, Order ownership verification and independent one-event No-Send audit can a status reader be considered. Existing Bot webhook preserved.

## 5. G3S source-only changes, testing and rollback

- qa/v152-rpc10/g3s-hosted-original-row-provenance-readonly.sql: executed exact SQL on staging; aggregate only, no mutation.
- qa/v152-rpc10/g3s-hosted-original-provenance-evidence.json: sanitized output, including current 3/3 privileged RPCs missing store_id and missing original row proof.
- qa/v152-rpc10/g3s-connected-published-owner-mapping-evidence.json: dynamically derived current published versions and exact 16-table schema metadata.
- qa/v152-rpc10/g3s-store-ownership-published-caller-gate.cjs: fail-closed seven-caller, two storage-plane, four-row, JWT and privileged RPC compatibility validator. Even forged self-green metadata cannot grant real Store/Order access, SQL deployment, n8n publish, provider send or billing.
- qa/v152-rpc10/g3s-store-ownership-published-caller-gate.test.cjs: adversarial schema/version/identity/owner/store/no-send and meta-scope regression.
- New GitHub Actions G3S CI running all inherited RPC10 source tests plus evidence and strictly No-IO/No-DB update guards; repaired parent G3R workflow independently executes disposable PG17 again on this child PR.
- This document.

VERIFIED: real data-plane aggregate readback and current published workflow/table versions.
IMPLEMENTED: source-only G3S security gate and no-mutation regression.
TESTED: only when exact final HEAD GitHub CI is successful; Node/PG17 tests are synthetic, real owner and Auth JWT are not.
BLOCKED: G0 / M0 / M1 / M3 / M2M4 / G3 / native channel one-event acceptance.
APPROVAL: any PII access, real Merchant owner proof operation, Auth sessions, hosted Supabase SQL write/RLS, privileged revoke, n8n publish, provider webhook, actual order or paid resource requires separately scoped permission.
ROLLBACK: close child Draft PR; no Cloudflare Worker, n8n, Supabase Auth, credential, legacy DEMO or hosted migration altered.

Final decision: RPC10_G3S_STAGING_MIGRATION_NO_GO__FOUR_ROW_OWNER_AND_PUBLISHED_CALLER_STORE_UNVERIFIED.
