# TIEN404 AI — CBOT-MSG-CANARY-03
## Exact LOCKED No-Write Workflow Patch × One-Recipient Live Trial Preflight

**Ngày:** 2026-11-16 JST  
**Parent:** [PR #214](https://github.com/ngoctien20/demo-git/pull/214), HEAD `90c41f22635f729c5829c6cab5b0347c5232e1d8`  
**Target:** n8n `Z7FdV7uDvApfbURQ`, ACTIVE Published `d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92`, 27 nodes  
**Classification:** REAL Published **READ ONLY**, source-only exact LOCKED patch **DRAFT**, real n8n manual synthetic QA **TESTED**. **ONE-RECIPIENT LIVE TRIAL NOT RUN.**

### 1. Audit first — observed real workflow, no credentials copied

Connected n8n read-only confirms:
- Two webhook nodes `Webhook` GET verification and `Webhook1` POST message event, same `tien404-messenger-qa` path. LIVE01 #4176 actual signed event and Meta Send completed; owner confirmed received reply. No need to re-register Webhook or re-run LIVE01.
- Inbound trusted path: `Webhook1 → Crypto → Verify Signature Timing-Safe → Verify Meta Signature → Respond to Webhook2 → Extract Messenger Text → Skip Duplicate Message ID → Loop One Message`.
- `Loop One Message` outgoing `main[1]` connects directly to `Messenger AI Agent`, whose `ai_tool` connectors include `create_order`, `update_order_address`, `manage_order`, `get_order_status`, `create_support_ticket`. (Also read-only Products.) This is **not** a zero-writer production workflow.
- Existing response path: `Messenger AI Agent → Prepare Messenger Reply → Send Messenger Reply - CONFIGURE TOKEN`, one shared outbound Meta node. **Prepare** derives `pageId/senderId/messageId` from the current `Loop One Message` run context, rather than trusting an incoming Agent response. An incorrectly placed or paired canary could target the wrong recipient.
- Meta Developers screenshot user provided shows **App Administrator** role for `TIEN404 AI Messenger`; connected browser's Meta test user view shows **App unpublished ("Chưa đăng")**. User also attests Page Full Control and authorizes controlled QA. Native Page Business role, Page↔App subscriptions and one private QA recipient bound to Page have NOT been independently certified.
- Supabase Store canonical authority remains absent per P0-J/Canary-02 checkpoints. This proposal is **PAGE-ONLY greeting**; never read Commerce data or claim Shop-scoped authorization.

### 2. Exact source patch — 27 → 32 nodes, NOT APPLIED

Files:
- `qa/cbot-messenger-canary03/actual-published-redacted-topology-27nodes.json`: node names/types + connections + Webhook methods/path + a **redacted synthetic equivalent** of Prepare code's item-pairing expression. NO credential IDs, Code containing secret values, Page IDs, PSIDs or customer data.
- `qa/cbot-messenger-canary03/exact-locked-graph-patch.mjs`: real version-pinned, topology-verified **n8n patch blueprint**. Validates active version, 27 node names/types, Webhook GET/POST paths, HMAC chain, dedup, `Loop One Message` output 1→Agent, Agent→Prepare→one existing Send, all five business tool links and `Prepare` item-pairing expression. Fail closed on ANY baseline divergence.
- Adds five exactly specified n8n nodes with IDs, typeVersions, positions, IF params and Code:
  1. `T404 Canary Identity Guard — LOCKED` (Code)
  2. `T404 Canary Exact Match?` (IF)
  3. `T404 QA Recipient Block?` (IF)
  4. `T404 Fixed Canary Greeting — NO TOOLS` (Code)
  5. `T404 Drop Unauthorized QA Input — NO SEND` (Code)
- **Exactly one existing edge is replaced:** `Loop One Message.main[1] → Messenger AI Agent` becomes `Loop One Message.main[1] → T404 Canary Identity Guard — LOCKED`. On **CANARY** match, the deterministic reply outputs `output` to the existing `Prepare Messenger Reply`; on authorized-but-disallowed QA input, `Drop` returns `[]` (no Send); all non-QA inputs return to the existing Agent via the false/false route. Only **one existing Meta Send node**.
- **Fail-safe lock:** the new guard hardcodes `t404_canary_match=false` and `t404_qa_block=false`; it **never accepts real Page/PSID claims** and therefore cannot authorize a live Canary. The source module does not export a full workflow JSON, call n8n, write files, publish, invoke Meta or read credentials. All `can_apply_published`, `can_send`, `can_write_order` flags are always FALSE.
- **Do not "enable" simply by changing these booleans.** They must be replaced by a **separately reviewed trusted native Page/recipient registry**, expiry and **atomic one-time event claim** with an independently verified QA account. Existing dedup alone has not proven global one-shot behavior under concurrent webhook retries. Rate/budget protection and stop-on-duplicate must be tested.
- Even the locked patch is **not recommended to apply** to the Published workflow without independent staging QA, a private configuration snapshot/restore test, exact version review and separately authorized change window. This patch file is source review only, not a production-certified importer.

### 3. Actual n8n item-pairing QA #4181 (not a real provider send)

Created a NEW **INACTIVE** Manual + Code + `splitInBatches` 6-node workflow in Personal / `90_QA - DIAGNOSTICS`:
- `TIEN404 Canary-03 Exact Receiver Pairing — INACTIVE NO SEND`, workflow ID `CCb5PTNSRjYc9OfY`.
- SDK validation: VALID, 6 nodes. Contains one numeric synthetic Page/sender and fictional Message ID, `Loop One Message`, deterministic greeting, **the original unmodified production `Prepare Messenger Reply` Code node** (read-only copied into this private QA workflow), final assertions. No Meta credential, webhook, HTTP, Agent/model, Orders or provider Send.
- Actual manual n8n execution `#4181` (2026-11-16T13:03:52.418Z–13:03:54.159Z) **SUCCESS**, **6/6 node statuses SUCCESS**.
- Output `PASS_SYNTHETIC_PAIRING`, `sender_match=true`, `page_match=true`, `message_match=true`; provider sends=0, Orders written=0, model calls=0. This establishes exact **single-item** Loop→Prepare compatibility under synthetic data, **NOT** multi-message/multi-run concurrency, native Meta signature, Page owner or live configuration deployment.
- Evidence: `qa/cbot-messenger-canary03/real-n8n-qa-4181-item-pairing-receipt.json`, intentionally excludes actual sender/Page/MID or code secrets.
- Other prior no-send guard QA remains: `bOaSukunPYUWg2pS` execution #4180, 13/13 synthetic cases; `VSmXkK7Y1Bb3Dg2w` execution #4177, synthetic greeting. Both INACTIVE.

### 4. Release gates / exact owner authorization

| Gate | Current result | Acceptance evidence |
|---|---|---|
| G0 Native App admin & user LIVE01 visible | USER + NATIVE UI VERIFIED | Existing screenshots / #4176 |
| G1 Exact 27-node source pin + no-writer patch blueprint | **SOURCE IMPLEMENTED** | CI source QA; still locked/not applied |
| G2 One fake sender/page currentRunIndex compatibility | **MANUAL QA PASS #4181** | 6 nodes success, no send |
| G3 Native Page↔App & test-recipient entitlement | **PENDING PRIVATE PROOF** | Native Page business full-control / messaging task; App+Page `messages` subscription; QA Page scoped identity and consent |
| G4 Atomic one-shot, no double Meta Send, duplicate/replay & non-target QA suppression | **NOT IMPLEMENTED LIVE** | Disposable staging test against exact version and concurrent negative fixtures |
| G5 Private snapshot/rollback of exact Published workflow + credential preservation | **NOT EXECUTED** | Checksum, operator restore dry-run without touching current live route |
| G6 Independent security signoff of exact final graph and one recipient | **PENDING** | Reviewer, version, SHA, Page scope, tester, expiry, max sends=1, costs, rollback |
| G7 Explicit owner authorization for THIS exact live patch + one-send | **NOT GRANTED** | Not a blanket reuse of general "test Canary" assent |
| G8 Real single QA Messenger greeting received | **NOT RUN** | One approved LIVE02 event, native HMAC, one Meta Send MID, 0 Orders/tools/model, user receipt |

**BLOCKED** G3–G7: no live provider send, no workflow Published modification, no activation, no Supabase changes, no customer account/contact, no token request, no paid API. We cannot credibly mark a real one-recipient LIVE02 acceptance without performing a narrowly scoped event and matching response in native Messenger.

**One-recipient expected future LIVE02 input (do not send yet):**
`TIEN404-CANARY-LIVE02: Xin chào! Cho tôi xem lời chào đã được duyệt; không tạo đơn.`

**Exact future reply (only under separate approved cutover):**
`TIEN404-CANARY-01: Xin chào! Tôi hỗ trợ thông tin cửa hàng QA, chưa tiếp nhận đặt hàng.`

### 5. Change ledger / rollback

- GitHub: new additive Draft PR with redacted topology/patch/test/CI/checkpoint; non-production.
- n8n: **one NEW INACTIVE 6-node manual QA workflow**, one manual synthetic execution `#4181` (creates ordinary n8n QA execution record). Existing Published `Z7FdV7uDvApfbURQ` untouched; Meta Pages/tokens/subscriptions unchanged; prior #4177/#4180 QA unchanged.
- No Supabase schema change, no real Orders/Products, no Commerce tenant, no model/Meta paid call or customer data touched.
- **Rollback source:** Close child Draft PR. **Caution** this does NOT delete the new inactive n8n QA workflow `CCb5PTNSRjYc9OfY`; keep Inactive until separate deletion/retention decision. No published rollback is required because no live cutover was made.
- **Next milestone:** `CBOT-MSG-CANARY-03B — Private QA Recipient Proof × Atomic One-Shot Claim × Independent Patch Diff/Restore Acceptance`. After its independent evidence, seek **specific** one-recipient live SEND/PUBLISH approval.

**Checkpoint:** `VERIFIED` real Published 27-node baseline; `IMPLEMENTED` exact locked source patch; `TESTED` n8n #4181 synthetic pairing + CI; `BLOCKED` real Page-only one-recipient live trial; `RELEASED` NONE.

### 6. QA correction: next-message loopback and release risk

The source graph originally failed a test because an unrestricted reachability traversal walked `Send Messenger Reply → Verify Messenger Send Result → Record Successful Messenger MID → Loop One Message` into a **NEW** message which can use the legacy Agent. The correct **per-message** safety check terminates at the single shared Send node; it proves the deterministic greeting cannot invoke legacy business tools **before the current message is sent**, while it **does not** claim all subsequent Page conversations lack writer tools. A regression test now explicitly pins that real loopback.

The current branch is still **LOCKED** and cannot select any real Page/PSID; production is unchanged. Real one-recipient live acceptance also needs independent concurrency/atomic one-shot proof and a reviewer-approved rollout/rollback. A passing 6-node single-message QA is not a concurrent-message guarantee.
