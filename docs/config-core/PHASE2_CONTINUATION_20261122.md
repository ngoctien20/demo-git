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
