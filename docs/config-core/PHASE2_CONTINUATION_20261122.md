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
