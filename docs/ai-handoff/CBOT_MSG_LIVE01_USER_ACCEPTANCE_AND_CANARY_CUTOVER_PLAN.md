# TIEN404 AI — CBOT-MSG-CANARY-01
## LIVE01 User Receipt Acceptance × Isolated Custom Greeting Canary Candidate

**Checkpoint date:** 2026-11-16 JST  
**Parent:** [PR #210](https://github.com/ngoctien20/demo-git/pull/210), HEAD `4c89353b9859b25e23ac3250c17163106482b63d`  
**Target Messenger workflow:** `Z7FdV7uDvApfbURQ`, Active/Published version `d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92`, 27 nodes.  
**Milestone classification:** LIVE01 **ACCEPTED on actual Meta send + USER-CONFIRMED display**. Canary candidate **SOURCE ONLY / NO SEND / NOT PUBLISHED**.

### 1. LIVE01 acceptance (separate provenance)

The owner/user explicitly stated in this conversation: **“Tôi đã nhận phản hồi LIVE01 đúng như execution #4176.”** This is **user-origin evidence**, not an independent inspection of the user's device. It upgrades previously audited #4176:
- Actual n8n webhook `#4176`, 2026-11-16T11:31:09.716Z–11:31:21.045Z, status success, `TIEN404-CUSTOM-LIVE01` marker.
- HMAC verifier and Meta signature verifier returned `verified=true`, AI Agent executed, Meta Send returned message ID which matched Send Result, user-visible reply acknowledged by owner.
- Exactly 11 nodes ran successfully and **zero** executions of business tools `create_order`, `manage_order`, `update_order_address`, `get_order_status`, `create_support_ticket`.
- **Judgment:** `LIVE01_ACCEPTED_USER_CONFIRMED`, not independent Meta Page ownership or Custom Studio before/after deployment.
- User report is recorded in `qa/cbot-messenger-canary/live01-user-receipt-20261116.json`. It has no PSID, Page ID, message ID, tokens, customer data or raw conversation.

### 2. VERIFIED NEW SOURCE-OF-RISK finding from actual published n8n graph

The **exact active-version graph** still connects **FIVE** `@n8n/n8n-nodes-langchain.toolWorkflow` nodes to `Messenger AI Agent` over `ai_tool`:
- `create_order`
- `manage_order`
- `update_order_address`
- `get_order_status`
- `create_support_ticket`

The path `Prepare Messenger Reply → Send Messenger Reply - CONFIGURE TOKEN` remains Published. Original 6984-character system prompt is static, not bound to Merchant Config version. **The absence of write calls in one greeting does not prove the current graph is safe for a live Custom Bot canary.**

**P0 safety rule:** Do not merely insert a “don't create orders” text prompt or swap a merchant greeting in the original agent. A live QA greeting canary must have a **different executable path containing NO business toolWorkflow nodes at all**, with verified Meta HMAC and owner-certified Page→Store mapping before allowing any provider send. Do not attach a duplicate Messenger responder to the same Page.

### 3. Source-only candidate built now (not fake native proof)

- `qa/cbot-messenger-canary/isolated-canary-guard.mjs`:
  - Reuses **existing V16.7 synthetic Merchant Runtime** for a Shop A Manager→Owner **preview-only** draft of name `Trợ lý Tạp hóa A — Canary QA` and deterministic greeting `TIEN404-CANARY-01: Xin chào! Tôi hỗ trợ thông tin cửa hàng QA, chưa tiếp nhận đặt hàng.`
  - Uses only private QA-issued scoped contexts. Shop B remains on its current greeting; invalid Store, Zalo route, user-supplied claims, cloned contexts and order/pricing/support intents fail closed.
  - All responses `can_send=false`, `can_publish=false`, `can_write_order=false`, `model_calls=0`, `hosted_writes=0`.
  - Independently analyzes **actual Published workflow/tool graph** with a release no-go contract. Owner receipt + “all green” declared flags do not grant real Meta send or workflow edit.
- `qa/cbot-messenger-canary/NO_SEND_MANUAL_N8N_CANARY_WORKFLOW.json`: **importable only as an INACTIVE, 2-node, manualTrigger → Code offline QA** preview. No webhook, HTTP Request, Meta token, Agent, toolWorkflow, database or external model. **It is not the real Page cutover workflow** and is not deployed/created on n8n Cloud in this milestone.
- `qa/cbot-messenger-canary/isolated-canary-guard.test.mjs`: tests isolation, user receipt provenance, retained Publisher writer block, source-only graph, fail-closed unknown authority and zero sends.
- Rollback for source-only candidate: close this child Draft PR. No n8n backup or host revert required because nothing was changed.

### 4. Exact real canary architecture — PROPOSED, requires separate permissions

```text
REAL Meta Page webhook received (existing stable ingress)
    → Raw payload HMAC verified by Meta app secret (EXISTING)
    → Deduplicate event/message ID atomically (EXISTING)
    → Trusted server-resolved native Page→Tenant→Store binding (NOT VERIFIED)
    → Exact designated QA PSID allowlist in server-side private registry (NOT CREATED)
    → Approved and version-pinned Merchant Custom Bot greeting, no client override
    → DETERMINISTIC greeting response only (NO AI MODEL)
    → NO-WRITE / NO-BUSINESS-TOOLS separated canary path
    → Single controlled provider send only after owner approval (NOT AUTHORIZED)
```

**Never** use a Page ID, Store ID, role, approved flag, recipient or app authorization supplied by customer text, webhook query string, Agent output or public settings. The current n8n `pageId` field is not a verified Owner→Store authority. Bind authenticated incoming event's Page asset to an **authorized private registry** under independently verified merchant ownership.

Meta documents Page App subscriptions and the Messenger `messages`/postback webhook behavior:
- https://developers.facebook.com/docs/graph-api/reference/app/subscriptions
- https://developers.facebook.com/docs/messenger-platform/getting-started/quick-start
- https://developers.facebook.com/docs/graph-api/reference/page/subscribed_apps

### 5. Exact release gates before any LIVE Custom greeting canary

| Gate | Current evidence | Requirement for GO request |
|---|---|---|
| LIVE01 Page text reply delivered | **USER-CONFIRMED**, real #4176 | Accepted baseline only |
| Meta App/Page subscription for messages and permissions | Message arrived; scope/grants not independently certified | Native Page admin/app link and exact messages subscription reviewed read-only |
| Owner consent binding the Page to Merchant/Store | NOT VERIFIED | Private owner evidence, precise Page→Tenant→Store association, revocation |
| QA recipient allowlist | NOT IMPLEMENTED | Single test PSID in private trusted backend, never logged |
| Live config version | NOT CONNECTED | Approved Store-specific config version/digest and isolated deterministic greeting |
| Live no-writer graph | **FAIL:** 5 tools still on main Agent | Physically separate canary path without toolWorkflow, data mutation or default Agent |
| Duplicate provider responder risk | NOT CERTIFIED | Enforce exact single responder/branch for QA test; no second webhook responder |
| Quota/consent | One message used model in LIVE01 | Canary no paid model; single owner-authorized reply, strict rate/TTL/replay |
| Backup/rollback | Original version captured | Export **config snapshot only** to private operator, exact SHA/version, undo route/disable canary; no customer data dump |
| Security review + operator approval | Technical AI review only | Private approval of exact graph diff and one Page/recipient, no auto-publish |

**G0:** Source-only QA must pass, no Meta or n8n change.  
**G1:** Owner/Reviewer independently verify native Page/app + Page→Store ownership and existing Page event subscription; no token in chat/PR.  
**G2:** Implement no-write canary in an **inactive QA workflow** or isolated reviewable code. Validate physically no tools/write nodes, full graph/diff and a single responder policy. Do not run parallel live webhooks.  
**G3:** Backup exact published config (not database dump), production rollback operator, final no-duplicate check. Owner explicitly approves one temporary Page+QA-recipient targeted canary and exact version/diff.  
**G4 (separately approved later):** One LIVE02 safe greeting, compare exact deterministic `TIEN404-CANARY-01` with human-visible reply, validate HMAC, sender/Page identity privately, Meta MID, **zero** business tools/writes/paid model, and restore original route. Stop and rollback on any mismatch, unexpected duplicate, HMAC fail, or unapproved recipient.

**Do not assume existing Page ownership after LIVE01:** successful webhook and ability to receive a message are necessary technical evidence, but not independent controller/Store consent.

### 6. Canary UAT content — ONLY AFTER approval

One owner-operated test message (do not send under this PR):

```text
TIEN404-CANARY-LIVE02: Xin chào. Cho tôi xem lời chào được chủ Shop phê duyệt; không tạo đơn, không yêu cầu dữ liệu cá nhân.
```

Expected deterministic candidate reply **only for approved Page/QA recipient**:

```text
TIEN404-CANARY-01: Xin chào! Tôi hỗ trợ thông tin cửa hàng QA, chưa tiếp nhận đặt hàng.
```

Shop B baseline and all other users must be unchanged. Check message and Meta Send response, rate, tool trace and duplicate filtering with independent QA. An AI-generated output text matching the greeting is not a deployed version proof.

### 7. Status checkpoint (not a production certification)

- **VERIFIED:** Actual Published version, five connected tools, #4176 webhook send and owner-reported visible response.
- **IMPLEMENTED:** User-acknowledgement evidence, deterministic Shop A synthetic greeting canary, graph blocker, optional importable *offline manual* workflow and test matrix.
- **TESTED:** Source QA only once exact-head CI succeeds; no live custom routing performed.
- **BLOCKED:** Native Page→Store authority, private QA PSID, production no-write path, complete safe cutover/rollback review, exact Owner approval.
- **RELEASED:** Nothing. Existing Messenger Published bot and Meta Page unchanged. A new, isolated INACTIVE n8n QA workflow exists; it is not a published provider workflow.
- **Next meaningful action:** Private Meta Page native verification and operator review of exact no-write node graph, then seek separate single-recipient canary cutover approval. Do not request yet another vague global production approval.


### 8. New REAL n8n QA execution #4177 (actual n8n instance, synthetic preview)

**Additional operation performed within safe draft authority (not a live Page change):**
- Created workflow **`TIEN404 CBOT Messenger Canary — QA [INACTIVE NO SEND]`**, ID `VSmXkK7Y1Bb3Dg2w`, in n8n Personal project, folder `90_QA - DIAGNOSTICS`; it is **inactive**, has **2 nodes** `Manual Canary QA Only → Preview QA Greeting NO_SEND`, zero credentials, no webhook/HTTP/Meta/model/toolWorkflow/database.
- Workflow verified via n8n connector: `active=false`, `activeVersionId=null`. The existing Published Messenger `Z7FdV7uDvApfbURQ` was **not** changed.
- Executed that isolated workflow in **manual** mode exactly once. n8n execution **#4177**, 2026-11-16T11:54:25.508Z–11:54:27.109Z, **SUCCESS**, both nodes success.
- Output: `contract=TIEN404_CBOT_CANARY_MANUAL_PREVIEW_V1`, `status=OFFLINE_SOURCE_ONLY`, QA_STORE_A_SYNTHETIC, greeting candidate `TIEN404-CANARY-01`, version 2, `can_send=false`, `can_create_order=false`, `can_publish=false`, `provider_messages_sent=0`, `orders_written=0`, `paid_model_calls=0`.
- Privacy-safe factual receipt: `qa/cbot-messenger-canary/n8n-manual-qa-4177-observed.json`; separate exact-head CI tests verify structure and NO-GO. This is a real n8n execution of **synthetic preview**, not a Meta provider message or actual live Studio→Page configuration.
- Link (QA only): https://ngoctien20.app.n8n.cloud/workflow/VSmXkK7Y1Bb3Dg2w

**Changed-system ledger:**
- GitHub: additive Draft PR files and CI only.
- n8n: **one new inactive manual QA workflow**, **one manual synthetic execution #4177**. n8n stores ordinary QA execution metadata by design.
- No change to Messenger Published, Meta subscriptions/tokens, Supabase, DEMO Products/Orders, actual customer data, credential, paid model or live provider send.
- **Rollback note:** Closing this Draft PR does **not** delete the separately created QA workflow. Keep it inactive; deleting it is a separate decision and requires approval, and the existing manual execution audit should not be removed casually.
