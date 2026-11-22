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

## 11. Sixth continuation — Messenger partial Send API result guard (2026-11-22 ~10:08 UTC)

**Starting state / audit:** Messenger Draft `9342025c-ea16-4965-97ac-bc4b98591996`, Published `47b48f6d-bc3d-40ae-afe6-96c5fd5452ac`, inactive Menu Bridge Draft `0d04c978-fa95-4b25-9dc0-df4cdbb2db04`, PR #491 open/draft. The earlier separate Social Reactions Shadow remains **ALL OFF**. n8n user preferences re-read: keep DEMO distinct from Commerce and never disturb Published workflows.

### Problem found

- The outgoing path is `Prepare Messenger Reply` → `Send Messenger Reply - CONFIGURE TOKEN` → `Verify Messenger Send Result` → `Record Successful Messenger MID`.
- Previous verification checked only `1 <= results.length <= 3` and each result's `recipient_id`/`message_id`. It did **not** require that `results.length == original.messageCount`.
- Therefore a 3-message planned reply with only one confirmed Meta message could theoretically be marked fully answered, causing later replay/deduplication to suppress missing message fragments. This is a **code-level finding / risk**, not proof Meta has produced the partial result in production.
- The existing `Skip Duplicate Message ID` uses a **read-only Data Table `rowNotExists`** before sending, followed by writing the dedupe row only after complete acknowledgment. Two truly concurrent webhook retries could pass the preflight before either writes the row. **This is not an atomic claim.** Record independently at [Issue #495](https://github.com/ngoctien20/demo-git/issues/495); no schema, live event table, credentials or customer records modified.

### Safe Draft-only fix

- Updated only n8n Code node `Verify Messenger Send Result` to require `original.messageCount` integer in 1..3; `original.messageIndex==1`; exactly `messageCount` Meta receipt objects; each has a nonempty unique `message_id` and the exact intended `recipient_id`.
- On any mismatch, **throw and do not advance** to `Record Successful Messenger MID`. The workflow performs **no automatic blind retry** in this change. Partial/ambiguous Send side effects still need a durable claim / reconciliation design; simply failing the workflow cannot guarantee no duplicate reply on external webhook redelivery.
- No changes to `Send Messenger Reply - CONFIGURE TOKEN` HTTP request/credentials, `Prepare Messenger Reply`, Meta Page profile, commerce tools, handoff, reaction shadow, Published version or other tenant data.
- Current Messenger Draft after change: **`41bcea84-703d-40bc-be2a-71f84ca4e2d8`** (68 nodes). Published remains **`47b48f6d-bc3d-40ae-afe6-96c5fd5452ac`**. Menu Bridge unchanged/inactive.
- **Rollback:** restore Messenger Draft **`9342025c-ea16-4965-97ac-bc4b98591996`** to remove only this new receipt guard while keeping the earlier Social Reactions Shadow ALL OFF; do not restore without checking for newer concurrent changes. No publication or external send required for rollback.

### Isolated evidence

- The exact new n8n Code node body plus post-Send graph edges were captured as **credential-free** snippets in `config-core/test/fixtures/messenger-phase2-draft.json`, not as an executable Published workflow.
- Six new isolated VM tests in `config-core/test/messenger-phase2-route.test.mjs`: 1-message success, 3-message success with distinct Meta MIDs, partial and zero confirmations, excess and invalid planned count, wrong recipient/error response/duplicate MID, and structural assurance that event-success marking follows full verification.
- [GitHub Actions Config Core CI run 45010853380](https://github.com/ngoctien20/demo-git/actions/runs/45010853380): **138/138 tests PASS, 0 FAIL**, disposable PostgreSQL 17 workflow still PASS; no live Meta send or Commerce database writes.
- Meta public Messenger documentation and provider examples support a Button Template with up to three postback buttons, quick replies and a 640-character template body, but these are **API format constraints**, not live-device visual acceptance.
- A read-only inspection of the connected Meta Business Suite Inbox still shows an older text-based catalog response. This is consistent with the unchanged Messenger Published version; **not** proof the Draft pager works on a phone or that a new message was sent during this audit.

### Remaining release gates

1. **Issue #495 P1:** atomic inbound claim, uniqueness across trusted Page/sender/event, timeout/uncertain-send reconciliation and parallel webhook duplicate prevention.
2. **Issue #494:** dedicated test Page + actual mobile/desktop Messenger button-template and Quick Reply delivery; test all seven pages, terminal pages, stale products, Meta send failure and human handoff/Finish. Requires explicit owner approval identifying workflow version and test recipients before any publish/send.
3. Verify signed owner A/B tenant isolation; no DEMO credentials/Products/Orders reuse in real Commerce; pending P0 privileged RPC security closure.
4. Pre-existing n8n linter warnings (Memory Manager, OpenAI builtInTools, canvas complexity); not changed.
5. Zalo/Telegram numeric menu #492; unrelated to this Messenger Send guard.

**Disposition:** IMPLEMENTED in Messenger Draft and TESTED offline; **NOT RELEASED**, not asserted as Meta-delivered or customer-facing.

## 12. Seventh continuation — P1 atomic Messenger claim: real disposable PostgreSQL 17 concurrency (2026-11-22 ~10:16 UTC)

**Goal:** Continue [Issue #495](https://github.com/ngoctien20/demo-git/issues/495) without touching any production customer, published n8n workflow, hosted Supabase schema or credentials. **Do not rebuild** the earlier V13.6M.5 private event-store design.

### Reused existing contract; what is new

- Reused `qa/messenger-rich-v136m5/private-event-store.cjs`: private table name `app_private.messenger_event_claims`, HMAC-scoped synthetic identity, immutable `SQL.claim` and `SQL.finalize`, `INSERT ... ON CONFLICT (...) DO NOTHING RETURNING` and lease-bound status transitions. Existing V13.6M.5 `PROPOSAL_ONLY_PRIVATE_EVENT_STORE_DO_NOT_RUN.sql` remains guarded and **was never applied**.
- Existing source/test status before this task: **source-only synthetic private PG model**, intentionally `hostedReady:false`, `providerSendEnabled:false`, **not evidence** of PostgreSQL transaction behavior.
- Added `qa/messenger-rich-v136m5/pg17-atomic-claim-uat.sh`. It imports the **existing** claim/finalize SQL strings from that module (not a rewritten algorithm), creates a random PostgreSQL database and non-login role under a LOCAL GitHub Actions PG17 service, creates only a representative private claim table with UNIQUE scope, RLS FORCE and no public grants, then runs real concurrent `psql` clients. It drops **only its own disposable DB/role** at exit.
- Hard safety gates: `T404_DISPOSABLE_PG_QA=YES`, `CI=true`, `GITHUB_ACTIONS=true`, `PGHOST=127.0.0.1|localhost`, `PGPORT=5432`, empty hosted `DATABASE_URL`, `SUPABASE_DB_URL`, `SUPABASE_ACCESS_TOKEN`, `PGHOSTADDR`. No pg/service network connection outside local CI. No Meta Send, no order, no customer PII.
- Config Core GitHub workflow `.github/workflows/tien404-config-core.yml` now runs this separate disposable PG17 UAT after the existing **independent** Config Core PG17 suite and also triggers on this specific test file. Existing CI and release checks remain intact. The V13.6M.5 independent offline workflow is also triggered and must remain PASS.

### Exact evidence (VERIFIED / TESTED)

- [CI Config Core run 45011514119](https://github.com/ngoctien20/demo-git/actions/runs/45011514119): **PASS**. `138/138` existing Config Core Node tests, `0` failures; existing disposable Config Core PostgreSQL17 tests PASS; NEW `PG17_REAL_UNIQUE_CLAIM_TESTS=21` PASS.
- PG17 real concurrency: two overlapping separate transaction connections yield **1 winner**, 1 row; **16 separate client processes** concurrently claiming the same six-field event scope yield **1 winner / 1 row**, and 15 losers.
- Lease wrong/duplicate finalization rejected, correct issued lease finalized exactly once to `PREVIEW_READY` (**not** `SENT` or provider delivery); consumed event remains deduplicated.
- Cross-tenant, cross-store, cross-Page, cross-sender and binding-version independence PASS; one transaction rolled back can be claimed again, no phantom row; expired/stalled event remains reserved and cannot be reclaimed without explicit reconciliation.
- PostgreSQL no-login unprivileged role lacks both read and insert privileges to the private schema/table. This is **local negative ACL evidence**, not hosted RLS/Owner A-B acceptance.
- [V13.6M.5 workflow run 45011514129](https://github.com/ngoctien20/demo-git/actions/runs/45011514129): **PASS** (both preexisting offline contract/security jobs).
- [V23 web + Owner App QA run 45011514173](https://github.com/ngoctien20/demo-git/actions/runs/45011514173): **PASS** (independent mocked-browser / offline DB checks, not Messenger live UI).
- Change checkpoint before this doc: commit `638cdc51487625ab5cee289e9f6a4affa0a6e942`; no n8n node changed in this continuation. Direct read confirms Messenger Draft **`41bcea84-703d-40bc-be2a-71f84ca4e2d8`**, Published remains **`47b48f6d-bc3d-40ae-afe6-96c5fd5452ac`**; Config Menu Bridge inactive Draft **`0d04c978-fa95-4b25-9dc0-df4cdbb2db04`**. PR #491 OPEN/DRAFT.

### Honest release gates / known gaps

1. **Real database test is not the production installed feature.** It proves a PostgreSQL UNIQUE claim can suppress parallel writers. It does **not** replace `Skip Duplicate Message ID` in n8n or execute against hosted Supabase. The Published and Draft Messenger send paths still use the existing Data Table check-then-send-then-record; the concurrency race remains open.
2. No real Page→Store binding and trusted tenant authority was supplied to the local SQL test. It uses synthetic UUIDs, synthetic HMAC hashes, a superuser to issue claims to a disposable database and a negative no-login-role test. Hosted Shop A/B, same-tenant Store A/B, non-BYPASSRLS claims and privileged RPC P0 gates remain necessary.
3. No durable **OUTBOX/uncertain-send reconciliation** or provider-level exactly-once delivery has been implemented. An atomic inbound claim is necessary, **not sufficient**, to prevent all duplicates across an external Meta Send API timeout. Never blindly auto-retry when Meta outcome is uncertain; no automatic stalled-claim takeover.
4. Hash/lease secret rotation, lease ownership across workers, retention/pruning, Meta policy window, handoff/Finish and mobile/web button-template acceptance remain untested for release.
5. The existing V13.6M.5 proposal-only SQL must **not** be enabled or applied hosted without approved migration, authenticated owner mapping, backup/restore rehearsal, restricted role policy and explicit cost/security approval.

### Rollback / checkpoint

- Only GitHub Draft files were added/updated: `qa/messenger-rich-v136m5/pg17-atomic-claim-uat.sh` and `.github/workflows/tien404-config-core.yml`. Revert the introducing commits `6e7c294c07bed4eea799be49565a0bd7368c9fe2` and `638cdc51487625ab5cee289e9f6a4affa0a6e942` (or restore earlier file contents) to remove the new CI test; **do not** revert concurrent Messenger Social Reactions Draft updates.
- No hosted schema/API rollout and no n8n published/draft mutation in this continuation; no runtime rollback needed.
- **Status: TESTED (real disposable PG17 contract), PROPOSED/BLOCKED (hosted atomic claim + Meta Send integration), NOT RELEASED.**
## 13. Eighth continuation — P1 atomic claim to uncertain-Send outcome gate (2026-11-22 ~10:23 UTC)

**Scope:** GitHub Draft source-only orchestration. Messenger n8n Draft and Published, Supabase hosted, customer data, credential, Meta Send and orders all unchanged. Reused the existing V13.6M.5 private event-store SQL contract rather than creating another table or queue.

### IMPLEMENTED / TESTED

- Added qa/messenger-rich-v136m5/messenger-inbound-gate.cjs, a SYNTHETIC_QA_ONLY wrapper around the prior createPrivateEventStoreCandidate source. It rejects missing injected HMAC/timing-safe, trusted Page→Store resolver, active entitlement/window, bad replay fingerprint and fake event stores. These are **synthetic server-injected QA attestations only**, not a real Meta webhook cryptographic signature verifier.
- A first claim produces a server-only, NO SEND ticket; duplicate webhook receives DUPLICATE_HOLD. Tickets have no raw PSID/secret/lease. A dry-run decision explicitly never enables Meta calls or Commerce/order writes.
- Synthetic provider receipts are checked for expected 1–3 count, distinct nonempty Meta-shaped message_id and exact intended recipient. A fully simulated response can finalize the prior lease-bound store as PREVIEW_READY only; acceptedByMeta:false, delivered:false and sendAllowed:false remain explicit.
- Partial 1/3 receipts, timeout/unknown external effect, wrong recipient, missing or duplicated message ID yield irreversible UNCERTAIN_HOLD, retryAllowed:false; no auto-finalization and no automatic stalled-claim takeover. Concurrent finalize calls permit at most one attempt, and a failed transaction enters HOLD pending reconciliation.
- Added 14 dedicated isolated unit tests and updated .github/workflows/v136m5-private-event-store-qa.yml to execute them and static checks for no network/Meta, credentials, pg pools or hosted writes. Original V13.6M.5 migration blueprint stays guarded and unapplied.
- GitHub Actions https://github.com/ngoctien20/demo-git/actions/runs/45012156906 : **258/258 PASS, 0 FAIL**, both offline-contract and static-release-gate jobs PASS.
- GitHub Actions https://github.com/ngoctien20/demo-git/actions/runs/45012156961 : **PASS**, includes existing disposable real PG17 concurrency contract verification (21 cases). Code checkpoint before this documentation commit: 8d755f09909feb20ef876ad9c12ca6b49b1bc00e.

### BLOCKED / NOT RELEASED

1. Actual n8n Messenger inbound still uses Data Table rowNotExists → Send → insert success, not the atomic SQL contract; no live migration or n8n change was made in this step.
2. A production endpoint must verify Meta raw HMAC itself, independently resolve trusted tenant/store/Page/binding/entitlement and enforce restricted non-BYPASSRLS role. Untrusted client-supplied booleans must NEVER grant authority. Hosted owner A/B and cross-store negative QA and backup/restore are still absent.
3. An atomic claim alone does not give exactly-once external Meta sends. Future approved durable outbox, per-part provider delivery evidence and manual/automatic **reconciliation (not blind retry)** of uncertain outcomes remain prerequisites.
4. Issue #495 stays OPEN; Issue #494 mobile/web Messenger UAT stays OPEN; no publish/merge/Meta send. PR #491 remains DRAFT.

### Checkpoint / rollback

- Messenger Draft 41bcea84-703d-40bc-be2a-71f84ca4e2d8, Published 47b48f6d-bc3d-40ae-afe6-96c5fd5452ac; Menu Bridge inactive Draft 0d04c978-fa95-4b25-9dc0-df4cdbb2db04.
- To roll back only this continuation, remove messenger-inbound-gate.cjs and messenger-inbound-gate.test.cjs and restore the prior V13.6M.5 CI workflow file. Keep the earlier PG17 UAT, Social Reactions ALL OFF and other independent draft changes. No runtime rollback is needed.

**Status: IMPLEMENTED + TESTED in isolated GitHub Draft; NOT VERIFIED in live Meta/hosted RLS; NOT RELEASED.**
## 14. Ninth continuation — real signed Page/Store admission and restricted PostgreSQL role QA (2026-11-22 ~11:36 UTC)

**Checkpoint baseline:** PR #491 head 6509b306e97f2224e29a0455b04a44c1675c719b, Messenger Draft 41bcea84-703d-40bc-be2a-71f84ca4e2d8. Safe scope: source-only GitHub Draft and disposable CI PostgreSQL17. No Meta Send, no hosted Supabase schema change, no n8n mutation or orders/customer writes.

### Important live-state drift discovered READ-ONLY

- During this continuation the actual Messenger Published version read from n8n became **1f4069a5-5e74-4c79-935b-40f02b3582d8**, while the previous checkpoint said **47b48f6d-bc3d-40ae-afe6-96c5fd5452ac**. Workflow metadata updatedAt 2026-11-22T11:04:49.906Z; Draft remained 41bcea84-703d-40bc-be2a-71f84ca4e2d8, 68 nodes, Published 64. The Published graph includes `Tìm nút menu`, `Nút menu đã cấu hình?`, `Đọc menu đã kích hoạt (CONFIG BRIDGE)`, `Áp quyết định menu`, `Trả lời menu cố định?`. Menu Bridge 9HXjjJ5ghPKUu43b still had an inactive Draft when last checked.
- n8n execution search with startedAfter 2026-11-22T11:04:00Z returned zero executions at inspection. This is NOT proof of working mobile/web behavior or a production regression. No attempt was made to publish, restore or interfere with parallel work. Confirm the published graph with the release owner before a live test.

### New verified HMAC + canonical authority integration, offline only

- Created `qa/messenger-rich-v136m5/messenger-signed-admission.cjs`, a **SYNTHETIC_QA_ONLY** adapter that reuses the existing `verifyMetaRaw()` path from V13.6M.1 through the V13.6M.3 canonical pipeline, existing V13.6M.2 restricted read-only repository `DB_PROBE` and `SQL.binding`, per-event isolation, Shop status/entitlement gate, and V13.6M.5 HMAC-scoped event `replayCheck()`/atomic claim source.
- The Meta HMAC is calculated over the exact original raw webhook string, with server-injected QA app secret. Incorrect HMAC/tampered raw body is denied **before** any repository call. The adapter accepts only `inspectSigned({rawBody,signature})`, not `verified:true`/tenant/store from client input. Per-event private resolver is refreshed between multiple Page/PSID messages. Outputs contain only route/status summary; no PSID, lease, customer message, provider payload, token or permission to send.
- `qa/messenger-rich-v136m5/messenger-signed-admission.test.cjs` added **12 synthetic negative/positive cases**: real HMAC verification, schema/RLS preflight, unknown/ambiguous/forged bindings, owner revoked/Store paused/entitlement expired, multiple Page/PSID isolation, same Page differing MID, untrusted postbacks, stale event, browser-supplied authority ignored, replay duplication. The injected DB remains synthetic/read-only: this test does NOT prove hosted Page binding or Meta traffic.
- [V13.6M.5 CI run 45017779409](https://github.com/ngoctien20/demo-git/actions/runs/45017779409) **270/270 tests PASS, 0 fail**; static no-send/no-hosted-write gate PASS.

### Real PostgreSQL17 role-specific RLS UAT

- Added `qa/messenger-rich-v136m5/pg17-restricted-rls-uat.sh`, invoked by `.github/workflows/tien404-config-core.yml`. Creates a random disposable local database and three independent temporary PostgreSQL LOGIN roles with `NOBYPASSRLS`. These roles connect with their own ephemeral QA passwords rather than being simulated with `SET ROLE` from a superuser.
- Uses the **same existing V13.6M.5 `SQL.claim` and `SQL.finalize`** over a temporary private claim table + an isolated role-to-Page/tenant/store binding table protected with ENABLE + FORCE RLS, explicit grants, and a role-scoped policy using `current_user` and the trusted test binding table. No SECURiTY DEFINER or public RPC, no hosted migration.
- [Config Core CI run 45018100550](https://github.com/ngoctien20/demo-git/actions/runs/45018100550) **PASS**: Config Core 138/138 unit tests, previous real PG17 atomic uniqueness 21/21, and NEW `PG17_REAL_RESTRICTED_RLS_TESTS=24` **PASS**.
- New PG tests verified same-tenant different Store and different tenant isolation, 3 non-BYPASSRLS roles, two FORCE RLS tables, positive scoped claim and duplicate suppression, private role-binding SELECT isolation, cross-tenant/store/Page INSERT denial, cross-store READ/UPDATE denial, inability to impersonate another SQL role or mutate protected bindings, correct and wrong lease finalization, fake client JWT claims cannot confer scope, owner role revocation hides existing claims and denies further writes.
- Hard local-only CI guards: `CI=true`, `GITHUB_ACTIONS=true`, `T404_DISPOSABLE_PG_QA=YES`, `PGHOST=127.0.0.1|localhost`, `PGPORT=5432`, empty hosted access environment. Random database/roles are cleaned by trap. No customer data, no production credential or hosting work.
- The independent V13.6M.5 workflow [45018100571](https://github.com/ngoctien20/demo-git/actions/runs/45018100571) PASS. CI harness code commit before this checkpoint: **01f94cb3d1ce3764edf2e0619e8acdf86ee8b998**.

### Explicit limits / OPEN gates

1. These are real cryptographic code tests and real disposable PG17 RLS tests with synthetic Page bindings and test roles. They do **not** show current hosted Supabase has the same tables, grants, private schema exposure, DB-role credential mapping, owner approvals, JWT session verification or Page/tenant/store authority. Hosted A/B acceptance is still BLOCKED.
2. Current live Messenger workflow still does `rowNotExists` → Send → insert dedupe and is not wired to this atomic claim/signature adapter. On the changed Published version there are no observed recent execution outcomes. Do not call it fixed or released.
3. Exact-once external Meta sending is not guaranteed by the DB claim. Per-message durable outbox/attempt ledger, failure/timeout reconciliation, expiry policy, human handoff and no-blind-retry protocol remain P1.
4. n8n Published drift requires release owner comparison/approval; DO NOT restore or publish without explicit authorization. PR #491 stays OPEN/DRAFT; Issues #495 and #494 remain OPEN.

### Rollback

- Remove only new GitHub Draft files `messenger-signed-admission.cjs`, `.test.cjs`, `pg17-restricted-rls-uat.sh`; restore the two affected CI files to the previous PR revision, preserving previous PG17 21-pass test, prior synthetic gate tests and concurrent Social Reactions Shadow ALL OFF.
- No n8n/Meta/Supabase hosted operations were performed here; no runtime rollback is needed.

**Status: VERIFIED published drift read-only; IMPLEMENTED source-only adapter; TESTED real PG17 24/24 and offline HMAC 270/270; BLOCKED hosted integration; NOT RELEASED.**
## 15. Tenth continuation — Messenger per-message outbox/attempt ledger with PG17 real concurrency (2026-11-22 ~12:00 UTC)

**Goal:** Continue Issue #495 by closing the source-only model gap between unique inbound claims and uncertain Meta Send API responses. Use the existing V13.6M.5 claim infrastructure; do not modify n8n or deploy hosted tables. PR #491 remains DRAFT.

### Audit / starting versions

- Read n8n user preferences, Messenger workflow metadata and GitHub PR #491 before edits. Messenger current Draft 41bcea84-703d-40bc-be2a-71f84ca4e2d8, Published 1f4069a5-5e74-4c79-935b-40f02b3582d8; both **unchanged in this continuation**. Published differs from older 47b48f6d checkpoint; we did not restore it.
- Existing code reused: qa/messenger-rich-v136m5/private-event-store.cjs for trusted HMAC-scoped event claim identity. New ledger exists independently as a *source-only* transactional state machine; it does not install an authorization path to Send API.

### IMPLEMENTED — GitHub Draft only

- Created qa/messenger-rich-v136m5/message-attempt-ledger.cjs as a source-only, SYNTHETIC_SQL_QA_ONLY SQL transaction contract. It requires a no-send mock claim ticket and server-derived tenant/store/Page/sender, fingerprint and HMAC secret; **a mock claim ticket is forgeable and MUST NOT authorize production sends**. Rejects hosted/live modes and drivers that declare external writes.
- SQL.plan creates at most one unique reply plan per scoped inbound event (tenant, store, Page, HMAC-sender, binding-version, HMAC-event) and inserts exactly 1-3 body-digest parts atomically in a PostgreSQL CTE. On duplicate event, returns DUPLICATE_PLAN_HOLD even if a caller changes reply content. No raw PSID, customer text, access token or order details are recorded by this contract.
- SQL.reserve is an atomic compare-and-set from PLANNED to MAY_HAVE_SENT_HOLD, with an attempt UUID per part, **before** any hypothetical external provider side effect. Reserving again never creates a second attempt, even across different PostgreSQL client processes.
- SQL.accept accepts a mock receipt only under matching plan, part and attempt UUID, with a HMAC digest of the synthetic provider MID and intended recipient. A local partial UNIQUE index enforces distinct receipt digest per plan. This does not constitute real Meta acceptance or delivery.
- SQL.uncertain moves a reserved part to UNCERTAIN_HOLD on timeout, missing/mismatched receipt, or transport ambiguity; no automatic retry or takeover. A database transaction failure while recording a result also leaves the attempt in MAY_HAVE_SENT_HOLD and marks the in-memory ticket as requiring reconciliation.
- SQL.close permits MOCK_PARTS_ACCEPTED only when **every expected part** has API_ACCEPTED_MOCK; 1/3, 2/3, planned or held parts cannot close. All mock status objects retain sendAllowed:false, retryAllowed:false, providerAccepted:false and delivered:false.
- Created qa/messenger-rich-v136m5/synthetic-message-ledger-model.cjs for strictly local serialized synthetic SQL transactions, and message-attempt-ledger.test.cjs with 20 focused offline cases. The synthetic model is **not durable** across fresh process starts.
- Created qa/messenger-rich-v136m5/pg17-message-ledger-uat.sh for real disposable LOCAL PostgreSQL17. It imports the exact SQL strings from the new source, creates temporary private plans/parts tables with UNIQUE scoped event, per-part key, attempt UUID and provider-MID digest constraints, and tests concurrency/partial/timeout across independent psql clients. It drops its own random database at exit. This is a **disposable test schema**, not an approved hosted migration.
- Updated both existing CI workflows to run the new tests and no-provider/network static guard; existing source/readiness and non-BYPASSRLS claim-store suites remain untouched.

### TESTED — evidence

- First new offline CI run 45019501065 had **1/290 failing test** due to wrong expectation: after attempting to close incomplete 2/3 plan, the candidate intentionally locks the local ticket. Fixed test expectation in commit 2c555072f76eb56c5c6b5d082a9deea1481011c0; no production-safety behavior was loosened. Subsequent CI PASS.
- [V13.6M.5 CI run 45019644868](https://github.com/ngoctien20/demo-git/actions/runs/45019644868): **290/290 PASS, 0 FAIL**, including new 20 ledger tests; static no-host/no-Meta/no-send checks PASS.
- [Config Core & PG17 run 45019644923](https://github.com/ngoctien20/demo-git/actions/runs/45019644923): **SUCCESS**. Config Core 138/138 PASS; previously installed local PG17 event claim 21/21 PASS and restricted role FORCE RLS claim test 24/24 PASS; NEW real PG17 send-ledger suite `PG17_REAL_MESSAGE_LEDGER_TESTS=28` **PASS**.
- Real ledger PG17 verified competing transactions create one plan and three parts, two competing part reservations yield one winning attempt, 1/3 and 2/3 cannot close, timeout on last part stays UNCERTAIN_HOLD and blocks retry, status remains in new psql connection, duplicate synthetic provider MID is rejected by UNIQUE, and another distinct event with all 3 parts can close exactly once in mock-only state.
- [V23 web + Owner App run 45019644893](https://github.com/ngoctien20/demo-git/actions/runs/45019644893): PASS (independent mocked/offline QA). Source/CI HEAD before documentation: aafd8e787106f75504b52eac3ce7dc35f3941290.

### OPEN / BLOCKED release gates

1. The new ledger tables do **not** exist on Supabase hosted and this code does not run in live n8n. Published Messenger still uses Data Table rowNotExists → Send → record; the actual runtime duplicate-send race is NOT fixed. Neither Draft nor Published changed here.
2. New ledger PG17 tests use a disposable test database with privileged test creator; the **new send-plan/part tables do not yet have restricted-writer tenant A/B and same-tenant store A/B RLS negative acceptance**. Earlier non-BYPASSRLS tests apply only to the inbound claim table. Do not conflate them.
3. This SQL CTE design is an experiment; production requires an actual trusted, non-forgeable claim receipt bound to server-authenticated Page/Store and configured adapter; real Meta raw HMAC, owner/tenant authorization, token management, restricted writer role, RLS on hosted, migration backup/restore and rollback review.
4. There is no provider transport or real outbox sender worker. Exactly-once Graph API side effects are not promised. Acknowledgment may be lost after Meta accepted a send; manual/provider-safe reconciliation must precede any retry. Distinguish `API_ACCEPTED_MOCK` from provider API accepted, delivered or read.
5. Explicit owner approval is required before any hosted table/role/RPC modification, Meta Send, production n8n publish/restore, changes to customer data, credentials or release.

### Rollback / checkpoint

- Revert Draft-only files message-attempt-ledger.cjs, synthetic-message-ledger-model.cjs, message-attempt-ledger.test.cjs, pg17-message-ledger-uat.sh and restore both modified CI workflow files to pre-ledger HEAD. Preserve all previous signed ingress, V13.6M.5 private event claim, PG17 RLS and Social Reactions ALL OFF work.
- This continuation made no live n8n, Supabase hosted, Meta, credential, Orders/Products or customer changes; no runtime rollback required.

**Status: IMPLEMENTED source-only / TESTED offline 290/290 and disposable PG17 ledger 28/28 / BLOCKED hosted & live send / NOT RELEASED.**
## 16. Eleventh continuation — per-part ledger RLS closure on actual restricted PG17 accounts (2026-11-22 ~12:39 UTC)

**Goal:** Continue Issue #495 from checkpoint 8ee764723ab0b1711030169e36cdac95d8fa4069, test BOTH ledger tables with real non-BYPASSRLS SQL LOGIN accounts. No n8n changes, Supabase hosted migration, credential changes, real Meta send, or customer/order writes.

### Audit (VERIFIED)

- Starting PR #491 OPEN/DRAFT at 8ee764723ab0b1711030169e36cdac95d8fa4069. n8n Messenger Z7FdV7uDvApfbURQ Draft 41bcea84-703d-40bc-be2a-71f84ca4e2d8; Published 1f4069a5-5e74-4c79-935b-40f02b3582d8; workflow remains live, no version changes by this session.
- Existing ledger SQL.plan used a PostgreSQL data-modifying CTE to INSERT parent send plan and child send parts atomically, while child RLS would normally check parent scope by SELECTing messenger_send_plans. Real restricted-role UAT uncovered this *does not work*: child part INSERT RLS cannot see a just-inserted parent row from the same statement, even though privileged prior PG tests were green.
- First new disposable CI attempt [run 45022847115](https://github.com/ngoctien20/demo-git/actions/runs/45022847115) FAILED at restricted RLS plan/part creation with `new row violates row-level security policy for table messenger_send_parts`. This is a genuine design/QA finding, not a permission change on any hosted DB. Earlier existing claim/ledger suites continued passing.

### IMPLEMENTED (GitHub Draft only)

- Created qa/messenger-rich-v136m5/pg17-ledger-rls-uat.sh, guarded by CI=true, GITHUB_ACTIONS=true, T404_DISPOSABLE_PG_QA=YES, localhost PGHOST/5432, absence of hosted DB credentials. Creates and later destroys its *own random* PostgreSQL17 QA DB and three temporary independent LOGIN roles (tenant A/store A/Page A, tenant A/store B/Page B, tenant B/store C/Page C) with NOINHERIT/NOBYPASSRLS, random test-only passwords.
- FIXED the source-only SQL.plan in qa/messenger-rich-v136m5/message-attempt-ledger.cjs: each child part stores `tenant_id`, `store_id`, and `page_id` copied directly from the parent authority proof within the same CTE. This means the child INSERT RLS can validate its own row scope without reading an invisible just-inserted parent.
- Require an explicit COMPOSITE FOREIGN KEY `(plan_id,tenant_id,store_id,page_id)` → parent `(id,tenant_id,store_id,page_id)` and parent UNIQUE composite key. This prevents a role in Store B from linking its correctly scoped child row to a Store A parent plan, despite direct child RLS success. No `SECURITY DEFINER`, no bypass RLS, no service_role, no policy relaxation.
- Updated BOTH disposable PG17 fixtures: `pg17-message-ledger-uat.sh` now enforces scoped child columns + composite FK and retains prior 28-case concurrency/timeout tests; `pg17-ledger-rls-uat.sh` defines SELECT/INSERT/UPDATE child RLS against a private SQL role→tenant/store/Page registry (not client-asserted JWT), verifies restricted writer can create parent/children in one CTE and cannot cross boundaries. Added source unit assertion that SQL.plan must populate child scope fields.
- Hooked the new restricted ledger test into `.github/workflows/tien404-config-core.yml` path filter and a dedicated PG17 test job step. All writes are inside a disposable local test database only, never hosted Supabase.

### TESTED / evidence

- [Config Core PG17 run 45023317038](https://github.com/ngoctien20/demo-git/actions/runs/45023317038): **SUCCESS**. **PG17_LEDGER_RESTRICTED_RLS_TESTS=29 PASS**; includes different-tenant, same-tenant cross-store, new plan+parts from non-BYPASSRLS role, unauthorized part reserve/receipt/timeout/close denied, private Page role membership, forged JWT denial, revoked tenant-role inability to see old plans/parts or write new plans, composite FK negative test `PASS_B_COMPOSITE_FK_DENIES_CROSS_STORE_PARENT`.
- The same CI confirms old real PG17 suites **21/21** atomic event claim, **24/24** restricted inbound claim RLS and **28/28** per-part ledger concurrency/partial/uncertainty all PASS; Config Core 138/138 Node tests PASS, 0 fail.
- [V13.6M.5 offline workflow run 45023317076](https://github.com/ngoctien20/demo-git/actions/runs/45023317076): **290/290 PASS, zero fails** including source contract checks, and static security/no-send job SUCCESS.
- [V23 Web/Owner App run 45023317091](https://github.com/ngoctien20/demo-git/actions/runs/45023317091): SUCCESS (independent offline QA, not live Messenger verification).
- Fix/test code HEAD before this documentation: **2cb86602d0e880385f326203a54bc91dda68a4b1**. Earlier failed proof and corrected successful proof both retained in GitHub Actions.

### OPEN / BLOCKED

1. **Only local PG17 tests, not hosted Supabase.** The child scope/composite FK design is a source-only candidate; hosted private schemas, grants, restricted runtime role issuance, canonical Page/store authority, backup/restore and negative hosted A/B checks remain blocked pending owner approval.
2. The test uses one temporary SQL LOGIN per scoped Page/Store, a *synthetic authorization fixture*, not a reviewed multi-tenant role-issuance design. A real production worker must bind trusted installation Page/store/owner with current entitlement and enforce a secure credential/session pool, not accept role names, JWT metadata or tenant ids from user-controlled input.
3. A unique inbound claim, plan and per-part attempt ledger do NOT guarantee exactly-once Meta external side effects or prove provider delivery. Real Graph API sender, durable per-part attempt journal, uncertain-outcome reconciliation, retry policy and replay retention require independent design and tests. No blind sends/retries.
4. n8n Messenger Published and Draft were never changed in this continuation. Current Published still uses rowNotExists → Meta Send → record; the production race remains open. No real Android/iOS/web UAT in this continuation. PR #491 remains OPEN/DRAFT; Issue #495 stays OPEN.

### Rollback

- Revert only the source-only scope-column changes in `message-attempt-ledger.cjs`, `pg17-message-ledger-uat.sh`, `message-attempt-ledger.test.cjs`; remove new `pg17-ledger-rls-uat.sh` and restore its added CI path/step. Preserve earlier V13.6M.5, Messenger Social Reactions ALL OFF, independent user/Work revisions.
- No production/system changes; no hosted rollback required.

**Status: DESIGN BUG DISCOVERED + FIX IMPLEMENTED/TESTED in Draft and disposable PG17; NOT RELEASED.**
## 17. Twelfth continuation — claim-bound reply-plan admission in real restricted PostgreSQL 17 (2026-11-22 ~13:38 UTC)

**User request:** Continue from §16 checkpoint commit 504bc92a8adcfd6ca2e5560dcd3e2e04bdf890fd with the next P1 security dependency: prevent a caller from creating a per-part send plan using a forged JavaScript `claimTicket` object; test claim/ledger relationship with disposable PostgreSQL 17 and scoped RLS. No Meta Send, no hosted Supabase migration, no n8n edit, no Commerce order writes.

### Starting audit (VERIFIED, read-only)

- PR #491 OPEN/DRAFT at 504bc92a8adcfd6ca2e5560dcd3e2e04bdf890fd. Messenger n8n Draft `41bcea84-703d-40bc-be2a-71f84ca4e2d8` and Published `1f4069a5-5e74-4c79-935b-40f02b3582d8` were read-only verified, without any n8n changes.
- `message-attempt-ledger.cjs` still uses `proofOfClaim(ticket)` with ordinary `mode='CLAIM_RESERVED_DRY_RUN'`, `sendAllowed:false`, etc. This is explicitly forgeable in JavaScript and **must never be considered production authorization**. Since the source-only ledger has no Meta transport, this was a candidate-contract gap, NOT a proven live send vulnerability.
- Existing V13.6M.5 private atomic claim store `private-event-store.cjs` uses an HMAC-derived six-dimensional event identity plus a random UUID `lease_id`, `status='CLAIMED'`, `expires_at`, and keeps the actual lease inside a private `WeakMap`. The existing claim store interface does NOT currently expose a secure cross-module lease transfer. Reused its existing `deriveIdentity` and `SQL.claim` unchanged.

### IMPLEMENTED — additive source-only candidate

- Added `qa/messenger-rich-v136m5/claim-bound-plan-contract.cjs`, default `BLOCKED`, only `SYNTHETIC_SQL_QA_ONLY` with explicitly offline/no external-write driver. Builds `SQL.claimBoundPlan` from the existing ledger `SQL.plan` (guards against SQL version drift) by replacing the parent INSERT VALUES with `INSERT SELECT ... WHERE EXISTS(...)` against `app_private.messenger_event_claims`. The new guarded plan SQL takes 12 parameters including a private `serverClaimLease` UUID and server clock, and in **one SQL statement** checks tenant, store, Page, HMAC sender, bindingVersion, HMAC event key, exact `lease_id`, `status='CLAIMED'`, `claimed_at <= now`, `expires_at > now` before inserting exactly 1–3 child parts. Previous RLS-safe child scope + composite FK design is preserved.
- Return outputs strictly `BOUND_PLAN_PREVIEW_ONLY` or `CLAIM_NOT_ADMITTED_OR_DUPLICATE_HOLD`, always `sendAllowed:false`, `retryAllowed:false`, `providerAccepted:false`, no PSID/lease/token in user-visible decisions. This is a **SQL claim-admission proof**, not a deployed `eventStore.claim` → ledger connector.
- Added 9 targeted unit tests in `claim-bound-plan-contract.test.cjs`: fail-closed hosted mode, invalid/fabricated lease input, real issued synthetic claim, duplicate, status finalized, expiry and time skew, identity mismatch across six fields, 50 parallel planners only one winner, malformed body digests, no claim token leaks.
- Added `pg17-claim-bound-plan-uat.sh` with local-only CI guards; creates and drops its own random PostgreSQL 17 database and two test-only `LOGIN NOBYPASSRLS` roles for Store A/B under same tenant. Private test-only schema contains atomic claims, scoped send plans/parts with composite FK, and role-scoped `FORCE RLS`. Imports the **unchanged existing** SQL.claim plus the **new exact** SQL.claimBoundPlan through Node; does not create hosted schema or call Meta.
- Updated `.github/workflows/v136m5-private-event-store-qa.yml` for new Node tests / static no-provider guard; updated `.github/workflows/tien404-config-core.yml` for real PG17 claim-bound-plan acceptance.

### TESTED — actual CI evidence

- [V13.6M.5 workflow run 45028402484](https://github.com/ngoctien20/demo-git/actions/runs/45028402484): **299/299 PASS, 0 fail**; security static no-host/no-Send job PASS.
- [Config Core + PG17 run 45028402469](https://github.com/ngoctien20/demo-git/actions/runs/45028402469): **SUCCESS**. New `PG17_CLAIM_BOUND_PLAN_TESTS=23` **PASS** with real restricted Postgres roles. Verified no claim → no plan, correct claim/lease → exactly one plan and 2 children, wrong lease/HMAC sender/event/Page/Store → denied, same-tenant Store A cannot bind Store B, revoked/finalized or expired claim denied, distinct authorized Store B can create a separate plan, reusing the claim to create a second plan is blocked.
- Existing same PG CI suites all remain PASS: 21/21 atomic inbound claims, 24/24 restricted inbound claim RLS, 28/28 message ledger concurrency/partial/timeout, 29/29 restricted ledger RLS, 138/138 Config Core Node tests.
- [V23 Web/Owner App workflow 45028402468](https://github.com/ngoctien20/demo-git/actions/runs/45028402468) SUCCESS (independent offline QA; not live Messenger). Source/CI checkpoint before this documentation: **8bc19fc7670709fb169e6ed57d2977d5ac3abd9a**.

### Important LIMITATIONS / BLOCKED release conditions

1. Real source-only `createPrivateEventStoreCandidate.claim()` intentionally keeps its lease in an internal `WeakMap`. The new contract currently accepts **a server-injected UUID lease for synthetic QA**, and the test fixture can see it. No trusted runtime bridge has been implemented; it would be unsafe to expose raw lease to client messages, webpage, untrusted n8n nodes or logs. An ordinary JS object and guessed lease alone cannot pass the PostgreSQL claim match, but a compromised trusted DB role that can SELECT its own lease may be able to fabricate plans in its allowed scope. Release requires a private server capability, restricted caller design and audit.
2. SQL guarded existence checks the claim **at plan creation**; it is not a proof that a later real send is authorized or that Meta received/delivered the message. Additional entitlement/window/revocation pre-send gates, durable ledger part state, crash recovery and unknown-provider reconciliation remain outstanding. No blind retries and no exactly-once Meta claim.
3. The `PG17_CLAIM_BOUND_PLAN_TESTS=23` tests are **disposable** SQL on synthetic identities and per-scope roles, not hosted Supabase RLS or owner A/B. No hosted tables, role/credential minting, production API or webhook wiring were implemented.
4. Messenger Published still runs the older Data Table dedupe `rowNotExists → Meta Send → record`, not the claim-bound ledger. Both Messenger Draft and Published n8n were unchanged; live customer/mobile/web acceptance remains blocked. PR #491 remains DRAFT, Issue #495 OPEN.

### Rollback / next approved step

- To roll back this continuation only: remove `claim-bound-plan-contract.cjs`, `claim-bound-plan-contract.test.cjs`, `pg17-claim-bound-plan-uat.sh` and revert only their added entries in the two existing CI workflow files. Preserve §16 RLS/composite-FK fix and earlier PG17 tests. No runtime rollback required.
- Next: design a private, non-extractable bridge between the successful `eventStore.claim()` server-side receipt and the guarded SQL plan, ideally in the same trusted service boundary with scoped transactions; test worker crash/restart and revocation without leaking lease or widening DB grants. Hosted Supabase, Meta Send and n8n publish still require explicit owner approval.

**Status: IMPLEMENTED source-only claim-bound SQL / TESTED offline 299/299 and real restricted PG17 23/23 / NOT wired to live Messenger / NOT RELEASED.**
## 18. Thirteenth continuation — atomic claim + plan + parts without lease transfer (2026-11-22 ~13:50 UTC)

**Goal:** Continue P1 Issue #495 from GitHub Draft PR #491 head `7c0878ca18eae49e4677bfd2fc95f7c7e45f90f1`. Eliminate the remaining need to pass an extractable lease between `private-event-store` and `claim-bound-plan-contract`. Preserve their successful older QA and live Messenger.

### Audit (READ-ONLY VERIFIED)

- Starting GitHub PR #491 OPEN/DRAFT, Messenger workflow `Z7FdV7uDvApfbURQ` Draft `41bcea84-703d-40bc-be2a-71f84ca4e2d8`, Published `1f4069a5-5e74-4c79-935b-40f02b3582d8`. No n8n edit or publish.
- Existing `claim-bound-plan-contract.cjs` checks exact live PostgreSQL lease but requires a server-injected UUID. Existing V13.6M.5 `createPrivateEventStoreCandidate.claim()` retains its lease inside private WeakMap. Neither was altered in this continuation.
- Reused existing V13.6M.5 HMAC-scoped `deriveIdentity` and SQL claim uniqueness, existing per-part ledger SQL schema, child direct-scope RLS design, composite FK, and all previous QA.

### IMPLEMENTED — an independent additive source-only candidate

- Created `qa/messenger-rich-v136m5/atomic-claim-plan.cjs`: default `BLOCKED`; only `SYNTHETIC_SQL_QA_ONLY` with a synthetic driver explicitly advertising `rollbackOnThrow:true` and zero external writes. No HTTP, Meta token, Supabase client, Order writes, dynamic imports, or hosted service.
- The **single PostgreSQL statement** uses data-modifying CTEs `claimed` → `prepared` → `parts`: (1) claim unique tenant/store/Page/HMAC sender/bindingVersion/eventHash with a server-side ephemeral random UUID lease and retention window; (2) create one reply plan **SELECT FROM newly acquired claim**; (3) create 1–3 parts with direct tenant/store/Page scope and expected composite FK to the plan; (4) return only plan id and count *to the private transaction driver*, then return only an opaque status/count to its caller. The random lease is never passed between JS modules nor returned to external callers.
- `ON CONFLICT DO NOTHING` handles replay. A `WHERE NOT EXISTS older plan` condition prevents a newly minted orphan claim if an old plan survives claim retention. The candidate's transaction callback intentionally **throws on zero or malformed result before COMMIT**, requiring rollback across claim + plan + parts; duplicate returns `DUPLICATE_OR_NOT_ADMITTED_HOLD` with `sendAllowed:false`, `retryAllowed:false`.
- Created `atomic-claim-plan.test.cjs` (10 new synthetic tests): 1/2/3-part completeness, 50 concurrent entrances across workers (1 winner), rollback fail-closed, no orphan claim when plan survives, cross Page/store/tenant/sender/bindingVersion/event key isolation, rejected malformed trusted source/digests, no lease/PSID in outputs, hosted/send disabled.
- Created local-only `pg17-atomic-claim-plan-uat.sh` importing **the exact SQL** from `atomic-claim-plan.cjs`. Creates and drops a random disposable PostgreSQL17 DB, two independent restricted LOGIN `NOINHERIT NOBYPASSRLS` roles (same tenant, Store A/B), and three FORCE RLS tables with private role-to-Page scope. Scope is trusted in DB test fixture, not read from client JWT. No hosted credentials and no Meta calls.
- Updated the existing V13.6M.5 offline CI syntax, test and no-network static gate and Config Core PostgreSQL 17 CI for this isolated new suite. No existing per-part, claim-bound, protected Page authority, or published workflow logic was rewritten.

### TESTED — actual evidence

- [V13.6M.5 offline CI run 45029311824](https://github.com/ngoctien20/demo-git/actions/runs/45029311824) **309/309 PASS, 0 fail**; security static job PASS.
- [Config Core PG17 CI run 45029311901](https://github.com/ngoctien20/demo-git/actions/runs/45029311901) **SUCCESS**, initial new atomic claim/plan real PG17 tests 22/22 PASS. Existing local PG suites 21/21 claim, 24/24 restricted claim RLS, 28/28 per-part ledger, 29/29 restricted ledger RLS, 23/23 claim-bound plan PASS; 138/138 Config Core Node tests PASS.
- Added a further **real two-connection concurrent PostgreSQL race** to the new PG17 suite, verifying 1 winner → exactly one claim, one plan and two child rows, no duplicate writes. [Config Core PG17 CI run 45029458251](https://github.com/ngoctien20/demo-git/actions/runs/45029458251) **SUCCESS**, `PG17_ATOMIC_CLAIM_PLAN_TESTS=26`, with `PASS_TWO_PG_CLIENTS_ONE_ATOMIC_WINNER`, `PASS_RACING_ONE_CLAIM`, `PASS_RACING_ONE_PLAN`. Real rollback before commit and no replan after restart also PASS.
- The direct source/no-send and browser-independent CI after the latest PG script change were triggered as runs [45029458254](https://github.com/ngoctien20/demo-git/actions/runs/45029458254) and [45029458310](https://github.com/ngoctien20/demo-git/actions/runs/45029458310); their completed status should be checked independently. Code checkpoint before this documentation: `40dd7b591d5c4e882646607d1989d05faf83d2ea`.

### Remaining BLOCKED gates

1. **Still offline source-only.** The single-transaction candidate is not wired to the real Meta HMAC verifier, hosted private binding/entitlement resolver, Messenger n8n webhook, Supabase schema or Graph API sender. Its synthetic `trusted` object is shape-validated by `deriveIdentity`, not independently cryptographically verified; a real trusted ingress is mandatory before a live release.
2. The new `SQL.claimAndPlan` currently generates the random lease in the private Node code and sends it as a SQL parameter solely inside the trusted local transaction. It does not expose the lease via returned responses; this is *not a security guarantee against a compromised DB driver, SQL logging or privileged operator*. Hosted deployment must audit secret exposure, grants, logs and restricted worker credentials.
3. The disposable PG17 test roles have scoped RLS on tenant/store/Page, not real hosted owner/JWT/merchant admission; production role issuance and RLS A/B user authorization are unproven. The scope registry in tests is synthetic.
4. Atomic claim+plan exactly once in PostgreSQL does NOT imply exactly-once Meta sending. A worker crash after actual Meta side effects leaves outcomes uncertain; per-part attempt journal, manual/provider-safe reconciliation, expiry/retention and revocation/window checks at send time are still needed. Never blindly resend uncertain parts.
5. The live Messenger workflow remains unchanged (Draft `41bcea84...`, Published `1f4069a5...`) and still has the old non-atomic Data Table `rowNotExists → Meta Send → record`. Neither real Messenger mobile/web QA nor production duplicate-send remediation is complete.
6. Hosted DB migration, role/grant changes, real provider send, n8n publish/restore and PR merge require explicit owner approval. Issue #495 stays OPEN and PR #491 stays DRAFT.

### Rollback / safe continuation

- Revert only new `atomic-claim-plan.cjs`, `atomic-claim-plan.test.cjs`, `pg17-atomic-claim-plan-uat.sh` and their added entries in two CI workflow files. Preserve earlier §16 RLS/composite FK and §17 claim-bound plan QA. No runtime rollback: NO production DB, n8n, Meta or customer data was changed.
- Next offline P1: build a bounded **read-only reconciliation/observation inspector** that identifies `MAY_HAVE_SENT_HOLD`, `UNCERTAIN_HOLD`, partial 1/3 or 2/3, plan mismatches and stale attempts without automatically claiming, resending or revealing PSID/lease; test crash/restart and owner revocation. Independent hosted admission/release review remains a separate gate.

**Disposition: IMPLEMENTED source-only / TESTED 309/309 offline, 26/26 real restricted PG17, 50 simulated and 2 real concurrent workers / NOT RELEASED.**
## 19. Fourteenth continuation — bounded READ-ONLY message reconciliation inspector + real restricted PostgreSQL 17 (2026-11-22 ~14:34 UTC)

**Objective:** Continue from GitHub Draft PR #491 checkpoint `f9cbd2639c2fac0689c003589135cfe57c7a56a7` and Issue #495. Provide operator-safe, *read-only* incident triage for Messenger partial 1/3, 2/3, uncertain transport and worker crashes without changing send, order or customer data. All work in source-only Draft. No Supabase hosted migration, Meta Graph API call or Messenger Published workflow change.

### VERIFIED baseline / source audit

- Read-only audit: PR #491 remained OPEN/DRAFT at initial SHA `f9cbd2639c2fac0689c003589135cfe57c7a56a7`; n8n `Z7FdV7uDvApfbURQ` Draft `41bcea84-703d-40bc-be2a-71f84ca4e2d8`, Published `1f4069a5-5e74-4c79-935b-40f02b3582d8` active. User preferences confirmed AI_SALES_DEMO must remain isolated. No n8n write was attempted.
- Existing `message-attempt-ledger.cjs` distinguishes PLANNED, MAY_HAVE_SENT_HOLD, UNCERTAIN_HOLD, API_ACCEPTED_MOCK; closes only after every expected mock part is recorded. Those mock statuses must never be represented as actual Meta accepted/delivered/read. This work did not alter the ledger writer or atomic claim-plan candidate.

### IMPLEMENTED (SOURCE ONLY / ADDITIVE)

- New `qa/messenger-rich-v136m5/message-reconciliation-inspector.cjs`. Explicit default BLOCKED; accepts only `SYNTHETIC_SQL_QA_ONLY` driver with `synthetic:true`, `externalWrites:false`, `readOnly:true`, `rollbackOnThrow:true`, known offline profile. The SQL transaction begins with `SET TRANSACTION READ ONLY` before a single scoped SELECT. The query reads existing plan/part statuses (tenant+store+Page filtered) and returns counts for PLANNED, MAY_HAVE_SENT_HOLD, stale in-flight relative to configurable server cutoff, UNCERTAIN_HOLD, API_ACCEPTED_MOCK and unexpected statuses. No UPDATE, INSERT, DELETE, Meta or Order operations.
- Classifies per-plan diagnostic outcome as `DATA_INTEGRITY_REVIEW`, `UNCERTAIN_OUTCOME_REVIEW`, `STALE_MAY_HAVE_SENT_REVIEW`, `MAY_HAVE_SENT_REVIEW`, `PARTIAL_MOCK_ACK_REVIEW`, `MOCK_COMPLETE_PLAN_NOT_CLOSED`, `MOCK_ALL_PARTS_RECORDED`, or `PLANNED_NOT_ATTEMPTED`; never authorizes retry/send. Even 3/3 acknowledged is explicitly MOCK, not proof of provider acceptance or delivery.
- Returns only a private HMAC-pseudonymized opaque plan reference and aggregate counts; does **not** return plan UUID, raw PSID, tenant/store/Page IDs, attempt UUID, claim lease, raw provider MID or MID digest. Hard limit of 50 output rows and query LIMIT 51 to mark `truncated:true` / `complete:false` whenever an audit batch is incomplete; no false full-audit claim.
- New `message-reconciliation-inspector.test.cjs` with 16 synthetic cases: no-send/hosted default refusal, no records, 1/3 and 2/3 partials, unknown timeout, stale/fresh/missing attempt time, restart-safe read-only snapshot, 3/3 mock-only vs plan-not-closed, inconsistent row counts/unknown state fail-closed, cross-shop/tenant scope, forged scope, no PII leaks, 51-row truncated preview, explicit SELECT-only SQL, malformed driver response.
- New `pg17-readonly-reconciliation-uat.sh` creates random disposable local PG17 DB and three independent real LOGIN roles with NOINHERIT/NOBYPASSRLS. Applies FORCE RLS to plan, part and private role→Page scope tables, populates synthetic 1/3, 2/3 timeout, stale/fresh in-flight, complete mock, planned-only cases across tenant A Store A/B and tenant B Store C; executes the **exact inspector SELECT from JS module** in explicit read-only transactions and verifies denial of cross-store/tenant reads. Runs a separate privileged-user negative INSERT inside READ ONLY transaction to prove writes are blocked. Tests new client/restart snapshot stability and role revocation. Deletes disposable DB/roles on exit.
- Updated both GitHub CI workflows to include new 16-case unit suite, a static no-network/no-hosted-write audit, and real disposable PG17 restricted read-only acceptance.

### TESTED — CI evidence

- [Messenger V13.6M.5 offline CI run 45033444814](https://github.com/ngoctien20/demo-git/actions/runs/45033444814) **SUCCESS, 325/325 tests PASS, 0 fail**, including 16 new reconciliation cases and no-Send/no-provider static gate PASS.
- [Config Core + PG17 run 45033445192](https://github.com/ngoctien20/demo-git/actions/runs/45033445192) **SUCCESS** with `PG17_READ_ONLY_RECONCILIATION_TESTS=20` PASS. Inherited Config Core 138/138, atomic event claims 21/21, inbound claim RLS 24/24, message ledger concurrency 28/28, ledger RLS 29/29, scoped claim-bound plan 23/23 and atomic claim→plan→parts 26/26 PASS.
- [V23 web + Owner App CI run 45033444827](https://github.com/ngoctien20/demo-git/actions/runs/45033444827) SUCCESS, independent offline QA. Latest code/CI successful checkpoint before this doc: `7874c2015b244985ab297fa4909467ad420b3f24`.

### Limitations / BLOCKED release gates

1. **Only synthetic identities and disposable PG17**, not Supabase hosted or live Messenger. Actual worker is not connected to this inspector; no real webhook/provider error was diagnosed. The output is a test-only operational report, not external Meta delivery truth.
2. The `SERVER_VERIFIED_MESSENGER_BINDING` proof in the isolated source module is shape-checked at its boundary, not cryptographically verified there. Real read-only admission must use server-validated token/owner entitlement, current Page→Tenant→Store binding, restricted role issuance and hosted RLS (tenant A/B and Store A/B). A guessed user scope is not authorization. Synthetic RLS proves only local fixture isolation.
3. Inspector must remain strictly read-only and **never** automatically retry UNCERTAIN_HOLD or MAY_HAVE_SENT_HOLD. Real Messenger remote side effects can have occurred before a timeout. Human/provider-safe reconciliation and policy-compliant recovery need independent approval; exactly-once Meta delivery is unproven.
4. Bounded result returns at most 50 reports; if `truncated:true`, the current scan is incomplete. This version has no production cursor/pagination, no claim ownership enforcement for a real admin viewer, no alert delivery, no retention/archival policy, and no real trusted host adaptation.
5. Existing Messenger Published retains Data Table check-before-send ordering and has not been fixed in live runtime. Messenger Draft/Published, Supabase hosted schema/grants, credentials, Meta Send, Commerce Orders/Products and real customer data were **not modified** in this continuation. PR #491 stays DRAFT / Issue #495 OPEN.

### Rollback and next step

- To rollback just this continuation: delete `message-reconciliation-inspector.cjs`, `message-reconciliation-inspector.test.cjs`, `pg17-readonly-reconciliation-uat.sh` and revert their appended checks in `.github/workflows/v136m5-private-event-store-qa.yml` and `.github/workflows/tien404-config-core.yml`. All prior V13.6M.5, per-part ledger, atomic claim+plan, Page-menu/reaction QA remain unchanged. No production rollback required.
- Next source-only P1 recommendation: authenticated *operator review decision contract* with explicit `NO_SEND` evidence trail and scope/authority rechecks (never an automatic resend), plus review whether minimal report metrics can be safely displayed in the Owner App; hosted migration or live send requires separate owner approval.

**Status: IMPLEMENTED source-only / TESTED 325/325 offline and PG17 20/20 read-only RLS / PRODUCTION BLOCKED / NOT RELEASED.**
## 20. Fifteenth continuation — owner/manager/staff scoped reconciliation review + immutable audit (2026-11-22 ~15:37 UTC)

**User request:** Continue from §19 Git checkpoint `c536ddd09eaa7f91eb06c9d2d1bbe50f7afbd8f3`; design and TEST authorized operator viewing, Page/store authorization at access time and decision recording without creating any automatic resend path. ALL development source-only under existing Draft PR #491. No production writes.

### VERIFIED source and runtime starting point

- PR #491 OPEN/DRAFT at start, head `c536ddd09eaa7f91eb06c9d2d1bbe50f7afbd8f3`; n8n Messenger `Z7FdV7uDvApfbURQ`: Draft `41bcea84-703d-40bc-be2a-71f84ca4e2d8`; Published `1f4069a5-5e74-4c79-935b-40f02b3582d8`. No workflow writes/publish.
- Existing source-only `message-reconciliation-inspector.cjs` returns opaque HMAC pseudonymous plan reference with counts and explicit MOCK acknowledgment semantics; it checks the supplied `SERVER_VERIFIED_MESSENGER_BINDING` object shape, **NOT real hosted owner authentication**. Therefore its direct use in a user-facing UI without an additional current operator-grant check would be unsafe.

### IMPLEMENTED (additive Draft, no hosted system changes)

- New `qa/messenger-rich-v136m5/operator-reconciliation-review.cjs`: offline-only `createOperatorReconciliationReviewCandidate()` defaults BLOCKED, synthetic driver must attest `externalWrites:false`, `journalOnly:true`, `rollbackOnThrow:true`. **No provider transport, order writes, hosted DB client, or automatic retry API**.
- Role contract: STAFF may view only; MANAGER may append `REQUEST_PROVIDER_REVIEW` and `ESCALATE_TO_OWNER`; OWNER additionally may append `ACKNOWLEDGE_NO_SEND`. Any attempt to send, resend, declare delivered or alter a part state is explicitly not on the decision allowlist.
- The existing inspector's pure `classify` function is now exported (no behavioral changes), reused for aggregated operator reports. `SQL.view` derives from the original read-only scoped SELECT and additionally requires an active, unexpired binding from private `app_private.messenger_operator_grants` to current PostgreSQL `CURRENT_USER` on the EXACT tenant/store/Page. The transaction begins `SET TRANSACTION READ ONLY`. The viewer never receives raw plan UUID, sender PSID, lease or provider MID, only an HMAC pseudonymous reference and MOCK-only status counts.
- `SQL.append` inserts exclusively into new *candidate* `app_private.messenger_review_events` table, never updates `messenger_send_plans`, `messenger_send_parts`, `messenger_event_claims`, Orders or credentials. The authoritative actor is stamped as `CURRENT_USER::name` in `actor_db_role` (NOT claimed by the UI); role and Page/store scope come from the private current-grant registry. It records one enumerated decision, HMAC request digest/idempotency and DB `transaction_timestamp()` without free-form PII. Database UNIQUE `(plan_id,request_digest)` prevents double journal entries. Foreign key must be composite `(plan_id,tenant_id,store_id,page_id)` to prohibit wrong-store attachments.
- Added 15 unit tests in `operator-reconciliation-review.test.cjs`: owner/manager/staff permitted access; staff no write; manager cannot owner-ACK; exact Page/store/tenant isolation; revoked and expired roles; fake `operatorRole`/`isSuperAdmin`; resend/delete/edit decisions rejected; HMAC-safe public responses; same idempotency request does not change a decision; no mutation to ledger; pure read-only snapshot.
- Added `pg17-operator-review-uat.sh`: disposable LOCAL PostgreSQL17, creates/destroys random database and **SIX independent LOGIN roles** `NOINHERIT NOBYPASSRLS`: owner A, manager A, staff A, owner B (same tenant other store), owner C (other tenant), expired owner A. Enforces FORCE RLS on private grants, plans, parts and append-only review journal; SELECT scoped to role grant, INSERT policy strictly checks `CURRENT_USER`, active/unexpired grant and enumerated decision privilege. NO UPDATE/DELETE grants to operator roles; records real role name as `actor_db_role`. Validates cross-store/tenant negative cases, expired/revoked access, forged `SET ROLE` and forged JWT, immutable journal, idempotency and frozen UNCERTAIN ledger status.
- CI: extends `.github/workflows/v136m5-private-event-store-qa.yml` for 15 new offline unit tests and no-network/no-provider static check, plus `.github/workflows/tien404-config-core.yml` for actual restricted PG17 operator grant/journal acceptance.

### TESTED — CI and evidence

- [V13.6M.5 offline run 45038874702](https://github.com/ngoctien20/demo-git/actions/runs/45038874702): **340/340 PASS, zero fails**, static hosted-write/Meta-Send guard PASS.
- [Config Core + PG17 run 45038874790](https://github.com/ngoctien20/demo-git/actions/runs/45038874790): **SUCCESS**, new **`PG17_OPERATOR_REVIEW_RLS_TESTS=34` PASS** including owner/manager/staff and six role RLS; confirms one actual owner actor + two manager actors stamped into audit, spoofed actor insert denied; status UNCERTAIN_HOLD not changed and plans remain PREPARED. Other PG suites remain PASS: 21/21 atomic claim; 24/24 claim RLS; 28/28 ledger concurrency; 29/29 ledger RLS; 23/23 claim-bound plan; 26/26 atomic claim+plan; 20/20 read-only reconciliation. Config Core 138/138 PASS.
- [V23 Web / Owner App run 45038874676](https://github.com/ngoctien20/demo-git/actions/runs/45038874676): SUCCESS (independent offline QA, NOT actual Owner App integration with review journal).
- **QA evidence retained:** first restricted PG run [45038739539](https://github.com/ngoctien20/demo-git/actions/runs/45038739539) FAILED because synthetic sample INSERT swapped the `body_digest` and `status` values; authorization and actor checks passed. Corrected fixture to proper SQL column order AND added `CHECK(status IN ('PLANNED','MAY_HAVE_SENT_HOLD','UNCERTAIN_HOLD','API_ACCEPTED_MOCK'))` so an invalid fixture cannot silently pass in future. No ledger production code was weakened or changed. Subsequent **34/34 PASS** in run 45038874790.
- Test/CI code checkpoint before documentation: `608ee10c0ef9fb60cae3a59ab88403be33b154b3`.

### Limits / BLOCKED

1. This is a **source-only and disposable SQL fixture**, not a live hosted API or Owner App feature. Six PG17 LOGIN roles are synthetic test stand-ins for actor identity; real Supabase JWT/role issuance/connection pooling/owner consent/revocation remains unverified. The `scope.verified` flag in JavaScript alone is NOT adequate authentication; DB role-to-Page/store grant and RLS MUST be bound to a trusted host authority.
2. The private journal is append-only *for restricted operators* via GRANT/RLS; privileged database owners/operators may still modify it. A production tamper-evident audit/backup/retention design is required before relying on records in disputes.
3. The review API still takes a `serverPrivatePlanId` for a trusted backend-only call; no safe public opaqueRef→plan resolution, hosted operator session, or UI is implemented. Raw plan UUID must NEVER be sent to client/browser. HMAC output pseudonymization is not itself authorization.
4. `ACKNOWLEDGE_NO_SEND` is a record of viewing/review only; **not** permission to resend a potentially delivered Messenger message. Any `MAY_HAVE_SENT_HOLD` or `UNCERTAIN_HOLD` remains held; real Meta delivery proof or human escalation still needs separate policy and vendor-safe QA.
5. Existing Messenger Published still uses Data Table rowNotExists → Send → record non-atomic ordering, unchanged. No real webhook HMAC integration, live staff login, hosted Supabase migration, plan/part mutation, Meta Send, Orders/Products, credential, billing or real customer data writes occurred. PR #491 remains DRAFT and Issue #495 OPEN. Production remains BLOCKED.

### Rollback and next safe continuation

- Revert only `operator-reconciliation-review.cjs`, `operator-reconciliation-review.test.cjs`, `pg17-operator-review-uat.sh`, the additive `classify` export in `message-reconciliation-inspector.cjs`, and corresponding CI additions. Preserve existing read-only inspector, atomic claim/plan, ledger security and Messenger workflows. No runtime rollback needed.
- Next suggested gate: design and test a **private opaque reference resolver** and operator-session admission proof in sandbox, with current owner/staff roles and grant revocation. Do NOT connect to hosted Supabase, deploy, send Meta or publish workflows without explicit approval.

**Disposition: IMPLEMENTED source-only / TESTED 340/340 offline and 34/34 actual restricted PG17 operator RLS / hosted owner-staff access BLOCKED / NOT RELEASED.**
