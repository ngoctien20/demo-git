# TIEN404 V21 — Phase 2 continuation checkpoint (2026-11-22)

Status: **DRAFT / NO PUBLISH / NO LIVE MESSENGER ACCEPTANCE**.

This document records the continuation after the Claude session ended. It distinguishes evidence observed on the **published** Messenger workflow from isolated QA and changes to **unpublished drafts**. Do not mistake an n8n execution status of `success` for customer-facing acceptance.

## 1. Recovered baseline

- Config Core: GitHub Draft PR #489, head `886f1f2e1931a2cc0089618a6f90619727d2ecee`; stacked on V23 Owner App Draft PR #487. Neither is approved for merge.
- Messenger: `Z7FdV7uDvApfbURQ`; published `47b48f6d-bc3d-40ae-afe6-96c5fd5452ac`; prior menu draft `1f4069a5-5e74-4c79-935b-40f02b3582d8`. The older handoff version `d1ec9147-...` is not the currently published version.
- Menu Bridge: `9HXjjJ5ghPKUu43b`; **inactive, no active version**.
- Existing hosted step-20 proof and backups are documented in `docs/config-core/README.md`, PR #489 and GitHub Actions run 44998110645. They are not evidence that Messenger live consumes Config Core.
- Config Core's owner App and hosted tests use simulated auth in part; real GoTrue-signed A/B account tests remain separate acceptance work.

## 2. Findings and draft corrections

### F-V21-02A: menu handoff role was not carried to Messenger announcement

Before this continuation, the Bridge correctly emitted `team=manager` but the Messenger "Áp quyết định menu" node discarded that field. The outbound acknowledgment was a hardcoded **Shop/nhân viên** message irrespective of the selected industry or page.

**Changed only the Messenger DRAFT**, not the published flow:

- "Áp quyết định menu" now propagates `menuHandoffTeam` only from the allowed `sales/page_admin/booking/consultant/support/manager` set and only for `mode=handoff`.
- "Notify customer and Inbox of handoff request" now announces the specific team with a truthful **pre-transfer** acknowledgment ("Mình đã nhận ... đang gửi yêu cầu chuyển ..."); it does **not** say Meta has already transferred the thread.
- Existing sequence remains pre-transfer notification → Meta `pass_thread_control` → `success === true` gate → waiting label. No changes to voice, order tools or production credentials.
- New Messenger DRAFT: `abd98c7e-2ed1-42fe-8e76-215e74e285c7`. Published remains `47b48f6d-bc3d-40ae-afe6-96c5fd5452ac`.

**Static structure check:** 10/10, including allowlist, role wording, no early transfer-success claim, node order, label behind Meta confirmation, and unchanged published version. This is NOT end-to-end Meta UAT.

### F-V21-02B: new menu payload on an unconfigured/disabled connection fell through to legacy

Isolated baseline `6696` returned `legacy` for `T404:M:handoff` when there was no published menu. Old behavior may confuse customers instead of providing the required safe response.

**Changed only the inactive Bridge DRAFT and this unmerged branch:**

- `config-core/lib/bot-bridge.mjs`: unknown `T404:M:*` with no config yields `rejected/menu_unavailable` and a safe text response.
- `config-core/n8n/build-bridge.mjs` and generated `bridge.sdk.js`: explicit HTTP/RPC error retains `legacy` fallback to preserve operational continuity; a genuinely missing published menu is a safe rejection.
- `config-core/test/bot-bridge.test.mjs` and `bridge-bundle.test.mjs`: expectations updated to preserve old `TIEN404:*` behavior and distinguish unavailable menu from transient read failure.
- Bridge DRAFT: `4376f77c-5747-481e-85b5-0c82d673d859`. `active=false`.

## 3. Isolated test evidence (no external send)

These cases used `test_workflow` on the 3-node **inactive** Bridge with pinned trigger + HTTP read; only the pure decision Code node ran. Inputs were synthetic and had no customer data.

| Case | Input / assertion | Execution | Result |
|---|---|---|---|
| M-01 | Artist manager button -> `mode=handoff,team=manager` | 6693 | PASS isolated |
| M-02 | Artist profile -> exact seeded bio, no invention | 6694 | PASS isolated |
| M-03 | Disabled button -> `rejected`, current enabled menu item offered | 6695 | PASS isolated |
| M-04 | No published config -> baseline `legacy`, gap documented | 6696 | FAIL acceptance (pre-fix) |
| M-05 | No published config -> safe `rejected/menu_unavailable` | 6697 | PASS isolated |
| M-06 | Simulated RPC timeout -> `legacy/read_failed` | 6698 | PASS isolated |
| M-07 | Old `TIEN404:ASK:human` -> `legacy` | 6699 | PASS isolated |
| M-08 | Artist manager button after fix -> team still `manager` | 6700 | PASS isolated |

**Important:** M-04 is intentionally recorded as an acceptance failure that led to the fix; do not report the historical baseline as a PASS. No real customer Messenger message, Meta ownership transfer, Messenger mobile UI, Zalo send or store payment was exercised by these tests.

## 4. Remaining acceptance gates

| Gate | Status |
|---|---|
| New button click in Messenger mobile and desktop | NOT RUN / needs separate live approval |
| Meta persistent menu / Get Started change | NOT RUN / separate owner approval |
| Shop SKU, unit price and stock against source of record | NOT RUN for new menu path |
| Artist configured playlist URL and profile in real Page | NOT RUN |
| Owner A cannot read or edit B with real hosted GoTrue-signed sessions | NOT RUN (prior SQL/mock UAT does not substitute) |
| Meta pass success/failed + standby + staff Finish -> bot returns | NOT RUN for new menu path |
| Cross-channel config propagation to Messenger, Zalo and Website | NOT RUN (draft adapters exist; no shared live release) |
| Daily Briefing with verified conversation/payment events | PROPOSED; no production event-source proof |
| Previously identified public privileged RPC and migration-history drift | OPEN in separate security workstreams; no change made here |

## 5. Safety / rollback

- Git branch `work/v21-phase2-menu-fallback-handoff-qa-20261122` is stacked on Config Core PR #489. Its changes are **unmerged**.
- To restore Messenger DRAFT before F-V21-02A: restore saved version `1f4069a5-5e74-4c79-935b-40f02b3582d8`. This changes the draft; do **not** publish as part of rollback.
- To restore Bridge DRAFT before F-V21-02B: restore saved version `2c6fb047-e800-406b-ac40-2f8e6b5cfcd1`. It remains unpublished.
- Published Messenger `47b48f6d-bc3d-40ae-afe6-96c5fd5452ac` was not changed; no production rollback needed.
- No Meta permissions/settings, credentials, real customer data or Commerce payment state were modified.

## 6. Next safe work

1. Run CI and code tests on this Draft PR, compare compiled bridge bundle to source generator.
2. Continue Page/Store A-B negative tests and preview UX in an isolated environment; evaluate legacy postback routing.
3. Before any Messenger publish: replay a full representative QA suite against a staging fork with all external sends and writes stubbed, then request a **new, explicit approval** identifying workflow and version.
4. Only after approved live Messenger acceptance, coordinate the Config Core with the separate V24 Shared Bot Core (#488). Do not merge them blindly.
5. Build the Event/Daily Briefing contract from verified channel and business events; do not infer paid orders from conversations.

Ownership: this checkpoint covers QA and draft work only. **No claim of released multi-industry/multi-channel capability.**

## 7. Second continuation — Messenger multi-Page ingress (2026-11-22 08:41 UTC)

The earlier draft correlation node `Tìm nút menu` keyed postback/quick-reply payloads only by `messageId`. Future multiple Fanpages could have collisions in one webhook batch (or conflicting sender contexts), allowing the wrong button to be associated with a normalized message. This is a **security/tenant-isolation hardening**, not a claim of a confirmed production exploit.

- **Draft-only edit:** composite key `JSON.stringify([pageId,senderId,messageId])`; first duplicate of the same composite key wins.
- **Compatibility:** quick replies missing Meta `mid` use the same `attachment_<sender>_<timestamp>` synthetic ID as `Extract Messenger Text`; legacy `TIEN404:*` stays unchanged.
- Messenger **new DRAFT**: `b967d427-62e6-40aa-90f4-60d222bb6e03`. Published still `47b48f6d-bc3d-40ae-afe6-96c5fd5452ac`.
- New synthetic, **credential-free** node/graph snapshot: `config-core/test/fixtures/messenger-phase2-draft.json`; it includes no full workflow, webhook signature, token or credential.
- New offline Node.js VM runner: `config-core/test/messenger-phase2-route.test.mjs`. It replays the actual audited Code-node bodies against fake Messenger webhook postbacks/quick-replies and pure Config Core decisions; asserts AI routing, artist bio, manager handoff, stale/disabled buttons, no-config response, legacy payload, Get Started, cross-Page and cross-sender collisions, duplicate events, missing `mid` and Meta-success-only waiting label.
- **Boundary:** tests do not execute the Meta Graph API, external services, real order tools or provider standby, and cannot replace mobile/desktop live acceptance. The `Extract Messenger Text` node itself is not copied into the public repo; upstream signature and allow-list remain separate checks.
- **Rollback only for this second draft edit:** restore n8n draft `abd98c7e-2ed1-42fe-8e76-215e74e285c7` (prior role-aware update) or the original menu draft `1f4069a5-5e74-4c79-935b-40f02b3582d8` if required. Never publish during rollback.
- **CI:** GitHub Actions runs `45003909606` (Config Core) and `45003909604` (Owner App) passed on the initial test snapshot. Newest run `45004017065` is required to verify the missing-MID addition; confirm its conclusion before marking this round TESTED.

## 8. Third continuation — Shop SKU/price + order status + Messenger mobile tap QA (2026-11-22 09:30 UTC)

**Boundaries:** strictly read-only Google Sheets DEMO inspection, synthetic node-replay tests and n8n Messenger **Draft-only** modification. No customer order, Messenger send, Meta Page menu, Commerce data or production publish was modified.

### Verified source and existing behavior

- Messenger `Read selected demo product` and the AI `Read Products - Messenger Read Only` both refer to the **AI_SALES_DEMO** spreadsheet, tab `Products`. This is distinct from Commerce; keep it distinct.
- Direct read of `Products` (2026-11-22) verified: `A002` = 159000 VND, 25 in stock; `A003` = 159000 VND, 18 in stock; `A011` = 289000 VND, 0 in stock; `B011` = 469000 VND, 0 in stock. These are DEMO values, **not** promises of future inventory.
- The Google Sheets product read already had `alwaysOutputData=true`; no change was needed for missing SKU handling. Formatter's existing explicit not-found/invalid-data cases were confirmed by replaying the actual Code-node body with synthetic rows.
- The published `TIEN404_MESSENGER_ORDER_STATUS` read-only tool `4DFFCk60exrzaIl6`, published `1faaa1ee-a45c-4bf0-8e3f-f197051f33f8`, reads Orders by `order_id` with `alwaysOutputData=true`. It only returns allowed order fields when both the exact order ID and normalized phone match. The test uses **no real Orders rows**.
- Crucial limitation: order ID + supplied phone is a DEMO verifier, **not** a full trusted cross-channel ownership/OTP gate. Do not reuse for multi-tenant Commerce or cross-channel order status without the separately proposed Trusted Order Ownership Gateway and its negative A/B tests.

### Fixed in Messenger Draft only — SKU clickability on mobile

- Found: `Prepare Messenger Reply` previously attached clickable `TIEN404:VIEW:<SKU>` buttons **only when the answer mentioned 1–3 SKUs**. A reply listing 4+ SKUs was text only, violating the intended mobile "Xem sản phẩm → chạm mẫu → chi tiết" interaction.
- Change: parse ordinary bullet lists and numbered lines such as `1. A002`, `2) A003`; if 4+ SKUs, attach buttons for the first 3 unique SKUs. Meta 3-button limit, 1–3-message output limit and legacy postback IDs remain unchanged. This **does not** implement full catalog pagination or a guaranteed tap button for every listed SKU; further UX review required.
- New **Messenger Draft**: `9c08fdd3-7583-49e5-adb4-8b4d9e0c0688`; **Published remains** `47b48f6d-bc3d-40ae-afe6-96c5fd5452ac`.
- Rollback of this change: restore the previous draft `b967d427-62e6-40aa-90f4-60d222bb6e03`, without publishing.

### Expanded isolated QA

- `config-core/test/messenger-phase2-route.test.mjs`: synthetic catalog QA: A002 available, A011 out of stock, Z999 missing, mismatched SKU, duplicate rows, malformed price/stock; 4+ and numbered SKU lists result in tappable choices; output capped to <=3 messages.
- `config-core/test/demo-order-status.test.mjs` + sanitized `fixtures/demo-order-status.json`: 10 synthetic cases for code from the **published** DEMO status verifier: matching ID/phone, wrong phone, wrong order ID, missing credentials, +84 normalization, no rows, duplicated order ID, unknown status, allowed status without payment-verification assertion. Never stores an actual customer's name, phone or order.
- `config-core/test/fixtures/messenger-phase2-draft.json`: updated with no-credential product-code and graph excerpts. It is **not** a deployable workflow JSON.
- **GitHub Actions Config Core CI:** run `45007669075` on commit `290b7c063004eb7e303d94942b212b8be5081a7a`: `# tests 112`, `# pass 112`, `# fail 0`; offline PG17 suite also succeeded. CI `45007669090` for Owner App was still running at initial evidence collection, check separately.
- The compiled original Menu Bridge remains inactive and unchanged in this continuation. Zalo/Telegram numeric menu selection **FAIL** remains in GitHub issue #492; never claim omnichannel acceptance.

### Remaining blockers before release

1. A real private Fanpage customer on Messenger mobile and web must click `Xem sản phẩm`, select an available and unavailable SKU, and produce a correctly formatted read-only result.
2. Validate Meta handoff success/failure, Page Inbox standby and "Hoàn tất" resume with real, separately approved QA. Structural tests are not adequate.
3. Authenticated owners A/B need real GoTrue-signed multi-tenant negative tests; never rely solely on fake roles/JWTs.
4. The 3-button fallback does not cover full 21-item DEMO catalog browsing; add pagination/category UX based on per-assistant config before marketing "all products selectable".
5. Trusted order ownership (not phone+order ID alone), payment authority, event logging and Daily Briefing remain separate acceptance gates.
6. Pre-existing n8n validation warnings for Messenger memory subnode and OpenAI builtInTools configuration were not modified or cleared; re-evaluate before publication.

This is **IMPLEMENTED + OFFLINE TESTED**, not RELEASED or LIVE END-TO-END TESTED.

## 9. Fourth continuation — Published-authorized Messenger product catalog paging (2026-11-22 ~09:42 UTC)

**Scope:** Draft-only implementation and isolated QA for [Issue #494](https://github.com/ngoctien20/demo-git/issues/494). This is a **DEMO-only Messenger adapter**, not the generic Commerce catalog or a platform-wide tenant authorization release. No Meta Graph API calls, live messages, order writes, pricing changes, credentials or published workflow activation.

### Audit + checkpoint

- Starting Messenger Draft `9c08fdd3-7583-49e5-adb4-8b4d9e0c0688`, Published `47b48f6d-bc3d-40ae-afe6-96c5fd5452ac`; inactive Menu Bridge Draft `4376f77c-5747-481e-85b5-0c82d673d859`, no published version.
- Current Messenger Draft **`18125761-5898-4950-bcd8-3c8d15539063`**, with 67 nodes (3 new). Published **still `47b48f6d-bc3d-40ae-afe6-96c5fd5452ac`**; no publish.
- Menu Bridge new inactive Draft **`4709a9b1-0569-4eea-9eb5-b9770c2be2f8`**, still no published version.
- Google Sheets catalog source is exactly **AI_SALES_DEMO / Products**, the same DEMO-only spreadsheet as existing product-detail lookup. Existing Commerce data and credentials remain separate. Product catalogue lookup is `operation=read`, `alwaysOutputData=true`, no SKU filter (read all current DEMO products).
- Public Meta documentation and provider examples confirm button templates allow up to 3 buttons, and quick replies are supported for navigation; actual Messenger mobile UI remains to be proven on the test Page.

### Implementation

1. Config Core `SHOW_CATALOG` is recognized by its **published action type and stable item ID**, not a hardcoded `catalog` ID. The Messenger adapter's bridge now returns `mode:'catalog'`, `itemId`, `catalogCategory`, and `catalogPage:1`. Non-Messenger channels keep the previous `mode:'ai'` until individually approved.
2. The page buttons use `T404:C:<published_item_id>:<published_config_version>:<page>`. On every tap, the bridge rereads the published menu and rejects invalid cursors, outdated menu versions and inactive/other action items. Cursors carry **no SKU price, tenant ID, credential or tool name**.
3. Messenger ingress `Extract Messenger Text` and `Tìm nút menu` recognize both postback and Quick Reply catalog cursors. The composite Page+sender+event-ID correlation remains intact. `Áp quyết định menu` converts only validated catalog decisions to `mediaType:'catalog_page'`.
4. After existing `Trả lời menu cố định?`, `Danh mục Messenger cần phân trang?` directs only catalog events to `Đọc danh mục Products DEMO` -> `Trình bày trang danh mục Messenger` -> existing `Prepare Messenger Reply` -> existing Send flow. All non-catalog messages retain original product-detail / AI / handoff routing.
5. The renderer `config-core/n8n/messenger-catalog-page.code.mjs` does **not** use the AI for prices, filters malformed rows and duplicated SKUs, sorts by SKU and returns 3 clickable SKU postbacks per page, with native `Trang tiếp`/`Trang trước` quick replies. All 21 current DEMO SKU slots fit 7 pages. Out-of-stock products remain selectable for truthful detail; no payment/order is written by browsing.
6. The DEMO adapter explicitly restricts catalog read/output to the currently allowed test Page. Supported `action_config.category` mapping is currently `all` / `áo` / `quần`; unrecognized categories fail closed rather than showing untrusted products. **This must be generalized through tenant-scoped catalog authority before Commerce rollout**.
7. All browser/mobile Meta delivery and standby/resume testing remains **NOT RUN**. Template + quick reply behavior has been simulated as JSON, not verified through an actual Meta send.

### Test evidence

- Isolated n8n Bridge pin-data QA on inactive Draft (no send/write):
  - `6716`: current published catalog button -> page 1 PASS
  - `6717`: authorized next-page cursor -> page 2 PASS
  - `6718`: prior config version -> rejected PASS
  - `6719`: non-catalog action ID cursor -> rejected PASS
  - `6720`: out-of-bounds page -> rejected PASS
  - `6721`: legacy SKU postback keeps previous behavior PASS
- Source-aligned, offline `config-core/test/messenger-catalog-page.test.mjs` tests pagination for **21 synthetic products, seven pages**, category map, tenant Page isolation, invalid/duplicate prices/SKUs, safe empty pages, bounded templates and next/previous.
- `config-core/test/messenger-phase2-route.test.mjs` uses sanitized real Messenger Code-node snippets and graph edges. It checks catalog events **bypass AI and write tools** while order, handoff, voice and legacy SKU nodes remain connected.
- CI functional commit `af2ab967a9dfdcf54bf0ecf801ba320b6ec07149`: Config Core run **45008743670 PASS, 127/127 unit tests, 0 fail**, offline PostgreSQL 17 UAT PASS. Owner App run **45008743633** separately verifies desktop/mobile browser with mocked Supabase, **not real Messenger UI**.
- Added byte-for-byte `build-bridge.mjs` -> `bridge.sdk.js` generator parity assertion. Confirm final CI after the checkpoint before labeling that assertion TESTED.

### Release gates and rollback

- Keep `#491` **Draft**, stacked on Claude's `#489`. Keep `#494` open until actual test Page **mobile + web** UAT proves every product can be tapped across pages, correct live DEMO price/stock, and safe Meta send/quick reply delivery.
- Before changing any Meta Profile persistent menu or n8n Published version, request **explicit user approval** identifying both target version and QA sample Page. No ambiguous approval from prior separate work applies.
- Restore Messenger Draft **`9c08fdd3-7583-49e5-adb4-8b4d9e0c0688`** to roll back the new pager without touching the published workflow; restore Menu Bridge inactive Draft **`4376f77c-5747-481e-85b5-0c82d673d859`** independently. Do not publish while rolling back.
- Remaining risk: a mid-session modification to the Products sheet can reflow page indices even when the menu version is unchanged. The adapter rereads fresh prices on each page and responds safely to empty/out-of-range pages, but catalog snapshot/cursor stability has **not** been implemented. Future tenant binding, RLS/owner A-B, full mobile Meta delivery, status/OTP, Zalo numeric menu #492, and workflow validation warnings remain separate gates.

**Disposition:** IMPLEMENTED on DRAFT + TESTED by isolated simulation and offline CI; **NOT RELEASED / NOT VERIFIED on real Messenger mobile**.

## 10. Fifth continuation — Stale catalog / concurrent Social Reaction Draft protection (2026-11-22 ~10:00 UTC)

**Reason:** The prior catalog pager bound each cursor to the published menu version, but **not to the Products snapshot**. A change in product price, inventory or eligible SKU rows between page 1 and page 2 could silently shift the page contents. This is a usability/consistency risk, not an authorization exploit.

### Current verified versions

- Main Messenger Draft **`9342025c-ea16-4965-97ac-bc4b98591996`** (68 nodes), Published remains **`47b48f6d-bc3d-40ae-afe6-96c5fd5452ac`**.
- Inactive Menu Bridge Draft **`0d04c978-fa95-4b25-9dc0-df4cdbb2db04`**, no Published version.
- A separate concurrent task added `V21 Social Reactions Shadow (ALL OFF)` in Messenger Draft **`9a705cbe-79bd-4bd5-ae41-578da7286c4f`** after the pagination checkpoint. The diff was audited before modifying: 1 added Code node, a reroute of `Classify explicit human request` -> Shadow -> `Human handoff request?`, no changes to the product/catalogue nodes. The shadow's `PAGE_POLICIES` remains an empty frozen object and its output is **NO SEND**. It was **preserved** by the subsequent three-node patch; no false claim that this separately authored work has been fully tested.
- **Do not** restore Messenger Draft `18125761` on top of this newer Draft without coordinating with the parallel Social Reactions work; doing so would discard their ALL OFF shadow. For rollback **of this fifth continuation only**, restore Messenger Draft `9a705cbe-79bd-4bd5-ae41-578da7286c4f`; restore inactive Menu Bridge Draft `4709a9b1-0569-4eea-9eb5-b9770c2be2f8`. No Published change required. Consult workflow versions/history before restoring if parallel work continues.

### Change made in this continuation

- The navigation payload is now `T404:C:<published_item_id>:<menu_version>:<catalog_digest>:<page>` rather than the previous version-only cursor.
- The `catalog_digest` is a deterministic, **non-cryptographic eight-character checksum** of normalized, validated, sorted visible DEMO product data (category, SKU, name, price and stock). The server recalculates it on each read. A mismatch or missing digest for non-first pages fails closed with a plain-language request to reopen the catalog. The checksum is only for **change detection**, not for tenant authorization, cryptographic integrity, payment/price verification or a credential.
- Menu Bridge re-authorizes the current published `SHOW_CATALOG` item and checks `version_no` on every cursor; then passes the digest unchanged downstream. Messenger `Áp quyết định menu` only propagates a strictly formatted digest to the existing `catalog_page` renderer, where actual comparison happens **after** the fresh, read-only Products lookup.
- `Prepare Messenger Reply` validates the new cursor form. The Meta button template still has at most 3 SKU buttons, <=2 navigation quick replies and one emitted message on the deterministic catalog path. Provider acceptance/mobile rendering remains **NOT VERIFIED**.
- The legacy `TIEN404:VIEW:<SKU>`, original order/tool paths, signed inbound gating, human handoff/voice and normal AI messages remain unchanged.
- No production Meta, Orders, RLS, credentials, Web/Zalo adapter, payment or real tenant/customer data was changed.

### QA and acceptance evidence

- Inactive Bridge isolated pin-data tests (synthetic, NO SEND): `6724` open menu PASS, `6725` valid digest page 2 PASS, `6726` old digest-less cursor rejected PASS, `6727` stale menu version rejected PASS, `6728` non-catalog action rejected PASS, `6729` malformed digest rejected PASS.
- Offline Node/PG17 CI: [GitHub run 45010180711](https://github.com/ngoctien20/demo-git/actions/runs/45010180711) **PASS, 131/131 unit tests, 0 failures**, including changed price, changed stock, changed SKU list, missing digest, wrong digest and safe navigation back/forward; byte-identical `build-bridge.mjs` / `bridge.sdk.js` parity PASS.
- The first CI attempt [45010088970](https://github.com/ngoctien20/demo-git/actions/runs/45010088970) failed on **one outdated test input** still using the old version-only cursor; test fixture was corrected and the next run passed. This was a QA fixture issue, not evidence of a live Messenger failure.
- n8n direct inspection confirmed the updated renderer / decision applier / Send-prep cursor format in Messenger Draft; the Bridge Draft contains `catalogDigest: cursor[3]`. Main Published and Bridge inactive state were re-verified after edits.

### Still blocked / needs separate owner approval

1. Real private Meta Page mobile + Messenger web: Meta Graph Send API response, 7-page navigation usability, button/quick-reply display and incoming postback matching; no actual send was run here.
2. Full tenant-bound Commerce catalog (current reader intentionally uses **AI_SALES_DEMO** allowlisted Page only), signed owner A/B, anti-replay/idempotency, failed/uncertain Send API handling and order ownership.
3. Non-cryptographic fingerprint collision risk remains theoretically possible; it is not an authorization mechanism. An authoritative catalogue revision/snapshot and stable pagination contract are needed for commercial multi-store.
4. Existing Messenger validation warnings for Memory Manager, OpenAI builtInTools and top-level canvas organization remain; this change did not modify those nodes. Bridge public publishable-key lint warning remains.
5. Keep **Draft PR #491**, issue **#494** (mobile catalog release acceptance), **#492** (Zalo numbered menu) and security blockers OPEN until independent evidence exists.

**Disposition:** IMPLEMENTED on DRAFT, TESTED with offline simulation and read-only pinned Bridge calls; **NOT VERIFIED end-to-end in Messenger mobile, NOT RELEASED**.
