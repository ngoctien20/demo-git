# TIEN404 AI — V15 Sales Lite P0-I
## Real Merchant / Provider Ownership Proof × Backup-Gated Store Schema Decision

**Checkpoint date:** 16/11/2026 JST  
**Parent:** Draft PR #184, HEAD `29cc9e85bb227a8a729c42c9b25c22e5d3167f2b`  
**Scope:** VERIFIED hosted READ-ONLY, n8n execution metadata READ-ONLY, source-only reconciliation and QA.  
**Decision:** **NO-GO** hosted schema, real Commerce catalog and Order/Provider-send pilot.

### 1. Concrete independent verified evidence

The exact committed `docs/ai-handoff/V15_P0I_REAL_HOSTED_MIGRATION_IMPACT_READ_ONLY.sql` was executed on actual Supabase project `ifxlvrhyjhbzbrkdsida` using a **READ ONLY** transaction and aggregate-only output. No customer names, IDs, Page IDs, credentials, JWT, raw provider request, Order values or tokens were retrieved. Read-only result preserved in `qa/v15-sales-lite-p0i/real-hosted-reconciliation-20261116.json`:

| Category | Verified result | Decision implication |
| --- | ---: | --- |
| Tenants / active Tenant memberships | 2 / 3 | Does not provide Store ownership |
| Products / Orders / Customers | **2 / 2 / 0** | At least **4 current business rows** need independently verified Store attribution before any cutover; absence of store_id means existing rows cannot be scoped today |
| Actual private hosted provider mappings `app_private.channel_secrets` | **0** | No real provider-account→Tenant mapping in this registry |
| QA owner binding / confirmed claims / synthetic bots | 2 / 3 / 2 | QA-only, not native Meta/Zalo/G2.3 consent |
| `public.stores` / `public.store_memberships` | **ABSENT** | Canonical Store membership impossible on current schema |
| Products / Orders `store_id` | **ABSENT** | Real per-Store price/Order isolation not possible |
| Legacy Tenant-scoped PERMISSIVE SELECT policies | **7** | Must account for permissive-policy OR behavior during Store cutover |
| Store-scoped SELECT policies | **0** | JWT A/B/C hosted cannot be certified |
| Products `UNIQUE(tenant_id,sku)` | Present | Cannot allow independent A/B prices for identical SKU in same Tenant without planned change |
| Private channel secrets PK `(tenant_id,platform)` | Present | Cannot represent multiple same-platform accounts for one Tenant via current table |
| Preview bot config | 1 `pilot_lab` | Not a native provider authorization |
| Duplicate provider refs | 0 | Vacuous when 0 provider mappings; not a proof of correctness |

**Read-only n8n verification:** `Z7FdV7uDvApfbURQ` Messenger Published has Meta HMAC check and legacy DEMO Sheets/reply nodes. Execution metadata #3865–#3868 = webhook success; **not** Page admin consent or Commerce authorization. Zalo V1 `yIJk8LvJoLF40Z62` active delegates to V2 shadow `OgDZNSAvKEvhnAvn` active with a public-QA-RPC HTTP node; retained most recent inspected V1 #2835–#2839 and V2 #2858 executions were **manual**. **Not** native Zalo Bot/OA owner proof.

This comparison uses source/type/status metadata, not payload, secret, phone, Page ID or recipient. Existing Messenger Published, Zalo Published, DEMO Products/Orders and credentials untouched.

### 2. Parallel work reconciled — do NOT rebuild or cherry-pick blindly
| PR | Existing useful result | Why not permission to apply hosted |
| --- | --- | --- |
| [#184](https://github.com/ngoctien20/demo-git/pull/184) | Real hosted metadata gate, 121/121 CI | Native provider/Store still absent |
| [#143](https://github.com/ngoctien20/demo-git/pull/143) | Hosted signed Auth.getUser → JWT/RLS read-only matrix (source/offline) | No real Store/JWT A/B/C test |
| [#135](https://github.com/ngoctien20/demo-git/pull/135) | Private G2.3 and backup authorization **synthetic** signature review | No real Controller/security reviewer signatures |
| [#136](https://github.com/ngoctien20/demo-git/pull/136) | Disposable PG17 Store expansion, RLS rollback | Not deployed or restored on hosted |
| [#189](https://github.com/ngoctien20/demo-git/pull/189) | Source-only M0–M7 Store isolation/remediation plan + same-Store FK QA | NO backed-up hosted migration, Owner proof or canary |

**No SQL migration is created or copied into P0-I**. This is a real-data reconciliation and decision record only. PR #189 already documents Store migration impacts; reuse it after owner consent, real backup/restore and exact approval.

### 3. Real provider and merchant evidence intake — private, never into GitHub

**Meta Messenger Page:**
1. Verified Page administrator/controller uses the native Meta Business/Page access interface and confirms the exact Page asset and app assignment, including Page messaging permissions (not just a public Page URL).
2. Independently prove relevant app is installed/subscribed to Page and that the workflow verifies incoming `X-Hub-Signature-256` on the **raw** webhook body with the app secret. A successful n8n execution alone is not enough.
3. Collect a private signed consent record binding that exact Page to the proposed Merchant + Tenant + Store. Record validity, revocation, signer and authorized scope. Mask Page/account identifiers and personal names in public reports.

Official Meta docs: https://developers.facebook.com/docs/graph-api/webhooks/ and https://developers.facebook.com/docs/graph-api/webhooks/getting-started/webhooks-for-pages .

**Zalo OA / Zalo Bot:**
1. Verify exact channel type, official OA administrator/authorized app association, permissions and channel-specific webhook configuration at the **actual provider console**. Do not treat Zalo Bot and Zalo OA as identical.
2. For OA, official OAuth v4 authorization must bind the genuine OA to the application with minimum rights. Verify authorization without copying/printing access token, refresh token, code verifier or OA secret into chat/GitHub. Zalo OA webhooks document an `X-ZEvent-Signature`; assess the right scheme for the exact channel/provider version. Zalo Bot may have different contract.
3. Collect a private scoped merchant consent and independent verified identity chain. Zalo staging QA pairing is **not** live ownership.

Official Zalo docs: https://stc-developers.zdn.vn/docs/v2/official-account/bat-dau/xac-thuc-va-uy-quyen-cho-ung-dung-new and https://stc-developers.zdn.vn/docs/v2/official-account/webhook/tin-nhan/su-kien-nguoi-dung-gui-tin-nhan .

**Private evidence minimum:** authorized controller identity + native Page/OA admin role + provider app/channel authorization + exact channel account binding to proposed Store + revocable consent. Evidence must be privately evaluated by a distinct authorized reviewer or separately approved, documented staging-only compensating controls. An AI technical review cannot impersonate a second human.

### 4. Backup and migration release decision

Current status: **NO-GO**. No connected, independently verified real encrypted hosted logical export **and isolated restore** receipt. Prior local-file/TOC indexing, if available, is not proof of a restorable, correctly scoped hosted snapshot. Never treat artifact SHA, synthetic dump or CI PASS as independent backup certification.

The narrowly scoped next sequence:

**G0a — Real owner/provider evidence:** Privately independently verify Meta/Zalo owner/app consent and the correct Merchant/Tenant/Store, including four existing Products/Orders ownership references. Do NOT infer from QA `store_key` or message sender alone.

**G0b — Backup readiness:** Independently verify whole-project Controller, private encrypted offsite vault, authorized one-time export operator, real checksum and scope (Auth/Storage/data/roles/extensions); require separate permission for real export, and separate permission for isolated restore. Retain a rollback-tested backup. Supabase Free projects lack guaranteed scheduled backup; manual off-site backups are recommended by Supabase.

**G1 — Specific Store expand authorization:** After G0a+b, review actual SQL SHA, dependency graph, legacy 4-row private attribution/quarantine, `products_tenant_id_sku_key`, `channel_secrets` PK and same-Store Order/Customer FKs from PR #189. SQL must be generated via supported versioned migration process and reviewed by operator before use. Do not indiscriminately drop constraints or default unassigned products/orders to Shop A.

**G2 — Store RLS cutover:** Replace or safely intersect old Tenant PERMISSIVE policies; merely adding another PERMISSIVE Store policy **ORs**, and could leak B to A. Use reviewed restrictive constraints or atomic policy replacement; backend privileged callers and `SECURITY DEFINER` need separate audit. Genuine Auth.getUser and three **real** JWT principals (A/B same Tenant, C other Tenant) must pass negative and positive read checks, anon/revoked/paused tests. Source PR #143 has a reusable plan.

**G3 — Only after G2:** Separately authorize read-only staging Commerce pilot with exact Store-scoped price/stock, NO provider sends or Orders. Live messaging, pending Order + Outbox, billing and deployment remain separately approved later.

For source-only P0-I, all release capabilities stay FALSE. No change to Supabase hosted, RLS, credentials, customers, live Pub/Sub, n8n Published, Orders, models or production. Rollback current code by closing the child Draft PR.

### 5. QA evidence and checkpoint
- **VERIFIED:** Actual hosted read-only SQL counts, n8n workflow and execution metadata, GitHub PR source states.
- **IMPLEMENTED:** Aggregate evidence reconciliation JSON, exact SQL source, fail-closed evidence comparison/tests, this decision document.
- **TESTED:** Only after exact-HEAD GitHub CI; previous disposable PG17 QA reused, not represented as real hosted proof.
- **BLOCKED:** Independent Page/OA ownership, merchant consent, backup+restore, mapped four legacy rows, hosted Store JWT/RLS, real Commerce catalog and provider-send pilot.
- **RELEASED:** None. This is an architecture NO-GO decision; **not** permission to export a backup or apply the migration.

**Recommended next checkpoint:** `V15 Sales Lite P0-J — Private Native Page/OA Owner Evidence Intake × Authorized Backup Operator Handoff`. This requires evidence/actions from the real provider portals and operator, not more synthetic approvals. If private evidence is unavailable, continue with offline Sales Lite quality/latency work instead of advancing another proof-only version.
