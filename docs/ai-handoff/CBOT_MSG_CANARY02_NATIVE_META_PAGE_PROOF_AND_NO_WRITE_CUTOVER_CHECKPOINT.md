# TIEN404 AI — CBOT-MSG-CANARY-02
## Native Meta Page Ownership Evidence × No-Write One-Recipient Cutover Authorization

**Ngày checkpoint:** 2026-11-16 JST  
**Tiếp tục từ:** [CBOT-MSG-CANARY-01 PR #211](https://github.com/ngoctien20/demo-git/pull/211) HEAD `d51d1fc8bf2a5aef163ff390358fd7ccbe827ad4`  
**Mục tiêu:** Nghiệm thu chứng cứ quyền Page thật, định nghĩa **một webhook, một responder**, chuẩn bị Canary greeting không có writer; **không Publish, không SEND, không credential, không dữ liệu khách hàng**.

### 1. Kết quả kiểm toán thực tế — VERIFIED READ ONLY

Read-only connector access on 2026-11-16:
- Messenger `Z7FdV7uDvApfbURQ`, active 27 nodes, `activeVersionId=d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92`. Real LIVE01 execution **#4176** Meta HMAC success, one accepted Send MID, 0 writer tool invocations in that one execution; USER directly confirmed Messenger bubble matched #4176.
- **Critical structural risk:** Exactly **5** legacy business tools still connect via `ai_tool` to `Messenger AI Agent`: `create_order`, `manage_order`, `update_order_address`, `get_order_status`, `create_support_ticket`; static system prompt has no Merchant Studio config version. Normal Page reply path goes to existing `Send Messenger Reply - CONFIGURE TOKEN` (one sender).
- Separate QA n8n `VSmXkK7Y1Bb3Dg2w`, **Inactive** manualTrigger+Code only, no Published version; execution **#4177** (manual) success with synthetic Canary greeting, zero provider messages, Orders and paid model. Do **not** activate or add a webhook to this workflow.
- Supabase staging `ifxlvrhyjhbzbrkdsida`, fresh read-only aggregate: `app_private.channel_secrets` binding count **0**, `public.stores` count **0 tables**, `public.store_memberships` **0**, Products Store column **0**, Store-scoped SELECT policy count **0**.
- Connected browser tab listing had Facebook Messenger customer chat but **no Meta Business Settings/Developers admin page** to inspect. Therefore native Page ownership, exact app assignment and permissions are **NOT OBSERVED**, not VERIFIED.

**Conclusion:** `LIVE01_ACCEPTED_USER_CONFIRMED`; `REAL_CUSTOM_BOT_CANARY_CUTOVER=NO_GO`.

### 2. Native Meta evidence intake — only OWNER in provider portal, no token transfer

Private authorized Page operator (and independent security reviewer if available):
1. Open [Meta Business Settings](https://business.facebook.com/settings), inspect **Business portfolio → Accounts → Pages → exact test Page → People / assigned assets**. Validate actual business control + Page role/tasks, including messaging where applicable. Public Page link, nickname, Facebook conversation screenshot, or n8n webhook success alone are insufficient.
2. Open [Meta for Developers](https://developers.facebook.com/apps/), select the **correct app**; check App ID **privately**, Messenger setup, Page attachment, App Mode, required permissions `pages_messaging` and App Review / task entitlement for intended QA sender. Tester/developer privileges may make a test message work without broad production entitlement.
3. In [Graph API Explorer](https://developers.facebook.com/tools/explorer/) with the authorized operator's own access, do **read-only**:
   - `GET /v27.0/{app-id}/subscriptions` using appropriate App token; inspect `object=page`, `active=true` and `fields` includes **`messages`**; `messaging_postbacks` only needed if testing postbacks.
   - `GET /v27.0/{page-id}/subscribed_apps` using **Page Access Token** selected privately inside Meta tooling; verify the correct app and `messages` subscription at Page level.
   - An API permission error means **NOT VERIFIED**; do not change scopes, generate new credentials or POST as part of Canary-02.
4. Bind exact native Page asset to an authorized merchant test context and **one** consenting QA Messenger account. A sender PSID is not a Store ID. Reviewer must verify private evidence against the actual Page/app; never copy PSID, Page ID, tokens, raw responses, app secret, owner email or business records into GitHub or chat.
5. Store screenshots (cropped/redacted when shared), private Page/app/account refs, reviewer identity, timestamp, Page permission/App Review state, explicit owner consent, scope/revocation, intended Page-only or Store-scoped use and a **private** immutable evidence ticket in a sealed vault. GitHub records only `NOT_OBSERVED`, `PENDING_PRIVATE_REVIEW` or a non-sensitive operator decision note; no self-signed machine `VERIFIED` claim.

Official docs, checked November 2026:
- App-level read-only: https://developers.facebook.com/docs/graph-api/reference/app/subscriptions
- Page-level read-only: https://developers.facebook.com/docs/graph-api/reference/page/subscribed_apps
- Page Webhooks permissions: https://developers.facebook.com/docs/graph-api/webhooks/getting-started/webhooks-for-pages
- Webhook mode and permission restrictions: https://developers.facebook.com/docs/graph-api/webhooks/

**Important:** `GET` is a read operation. `POST /subscribed_apps`, webhook field toggling, new OAuth token, App Review changes, and Page permissions are **mutations** and explicitly excluded.

### 3. Two release scopes, avoid blocking the tiny greeting experiment on Commerce migration

**A. PAGE-ONLY QA GREETING (potential future separately authorized canary):**
- May be architected without live Products/Orders or Canonical Store because it **never reads Commerce, Store config or customer data**; it uses only an **owner-approved Page-bound deterministic greeting**, owner-approved specific QA recipient, short TTL and versioned Page-only test config in a secured private operator registry.
- Not a claim that `Page→Store` is yet authoritative or that same-Tenant Store A/B data isolation is achieved. The preview's `QA_STORE_A` is a synthetic label only.
- Needs genuine Meta Page/app/recipient proof, exact no-writer route, single responder guarantee, explicit one-message live operator authorization and a rollback. Can only send if an entirely separate approved change request authorizes this *exact* Page-only trial.

**B. STORE-SCOPED Custom Bot / Commerce canary (CURRENTLY BLOCKED):**
- Requires actual merchant consent Page→Tenant→Store, canonical Store registry/owners and signed least-privilege JWT/RLS (or independently reviewed equivalent trusted resolver) before any real Store-specific catalog, price or customer Order lookup.
- Source-only Store migration/backup/restore planning is already on [PR #189](https://github.com/ngoctien20/demo-git/pull/189) and [PR #192](https://github.com/ngoctien20/demo-git/pull/192), not duplicated here. No migration is authorized.

### 4. Single-inbound, mutually exclusive response design — PROPOSED SOURCE ONLY

```text
Existing ONE Meta Webhook
   → Verify raw HMAC
   → Replay/dedup ID once
   → Trusted private Page authority resolver
   → Expiring private QA recipient allowlist
   → Exclusive branch: targeted authorized test?
        YES → pinned approved greeting → TTL/rate/one-use guard ─┐
        NO  → existing baseline Messenger AI Agent ────────────────┤
                      [5 legacy tools remain on baseline ONLY]   │
   ←────── ONE existing Send Messenger Reply provider node ──────┘
```

For page-only QA, resolver must be explicitly Page-only and must **not** claim Store ownership or load private Commerce data. No user-supplied `page_id`, `store_id`, `customer_id`, `qa=true` flag or LLM output is authority. Do NOT create a second webhook/subscription, a parallel Messenger responder or a second Send node. The canary path must be **physically disconnected** from the legacy Agent/ToolWorkflow nodes. If exclusive routing or HMAC cannot be demonstrated and tested, rollback/no send.

**Static graph validator** `qa/cbot-messenger-canary02/native-owner-cutover-gate.mjs` checks:
- Exact read-only baseline and version pin; all 5 legacy tools acknowledged, one existing sender;
- Hypothetical one ingress, one responder, disabled canary, explicit HMAC → dedup → private owner binding → recipient allowlist → exclusive routing → versioned deterministic greeting → TTL guard → single send;
- Negative checks reject second send/webhook, missing HMAC/allowlist/rate, added external requests/writer/model, fake owner `APPROVED`, injected PSID/token, and same recipient on baseline and canary branches.
- **The graph is declarative, not an actual published n8n patch.** The validator always returns `NO_GO_NO_LIVE_CUTOVER` even if source topology is valid. Never use it as automatic host authorization.

### 5. Cutover operator authorization — formal gates before any real SEND

| Gate | Current status | Required independent artifact |
| --- | --- | --- |
| L0 User receipt LIVE01 | ACCEPTED | Real #4176 and user's confirmation |
| L1 Native Meta Page admin & subscription proof | **NOT OBSERVED** | Private native Page assignment, App + Page `messages`, `pages_messaging` scope |
| L2 Merchant/recipient consent | **NOT VERIFIED** | Signed private Page-only QA consent; exact QA account, one Page and revoke path |
| L3 Version-pinned safe graph | **SOURCE ONLY** | Actual n8n workflow diff (SHA+version), no-write QA path, no double send |
| L4 Synthetic negative tests | CI pending | forged sender/Page, bypass HMAC/replay, second send, order intent, cancellation |
| L5 Rollback snapshot | NOT TAKEN FOR CUTOVER | Operator-controlled original workflow JSON/version, exact return route and independent revert test |
| L6 Exact final one-recipient SEND authorization | **NOT GRANTED** | Human owner signs Page/PSID masked scope, greeting SHA, TTL, max sends=1, exact workflow patch and restore plan |
| L7 Store-specific Commerce authority | BLOCKED | Separately approved Store migration & trusted resolver; **not required** for Page-only greeting |

**No blanket "I agree" / no flags**: Approving a source Draft PR or checklist is NOT approval of Meta Page mutation or Published n8n cutover. Before a real send, request explicit operator review and approval of the exact final diff and Page/QA recipient scope.

### 6. UAT plan after narrowly authorized live cutover (future)

- Stop if Page/App evidence is absent, owner differs, recipient not on allowlist, published version unexpected, expired allowlist, duplicate webhook subscriber or writer tool reachable.
- Only authorized owner/tester may send one informational input `TIEN404-CANARY-LIVE02: Xin chào! Hãy hiển thị lời chào Canary đã được duyệt.`.
- Expected deterministic reply: `TIEN404-CANARY-01: Xin chào! Tôi hỗ trợ thông tin cửa hàng QA, chưa tiếp nhận đặt hàng.`
- Trace HMAC, only one incoming MID, only one Meta Send MID, 0 business tools, 0 real Orders/stock writes, 0 paid model on **canary branch**; independent Messenger device screenshot matched.
- Immediately revert routing to pinned original Published version after acceptance; confirm original LIVE01 behavior and no double responder. Any mismatch → stop/revert, preserve private evidence and no repeat SEND without a new approval.

### 7. Change ledger, rollback and checkpoint

- **VERIFIED:** LIVE01 user receipt, Published active 27 nodes/5 tools, QA inactive 2 nodes #4177, Supabase Store/channel registry absent (read-only).
- **IMPLEMENTED:** actual metadata snapshot and single-response declarative source design, native Meta read-only evidence SOP, fail-closed no-live cutover checker/tests.
- **TESTED:** Offline GitHub CI only once exact-head run passes.
- **BLOCKED:** Native Meta admin/app/Page proof, Page-only private scope/recipient attestation, actual safe n8n patch, rollback rehearsal and signed final release. Real Store-scoped Commerce remains separately BLOCKED.
- **LIVE CHANGES THIS MILESTONE:** NONE. No Meta Portal/Graph Explorer session or token was accessed; no Page subscription changed, no n8n Published edited, no order/customer data, credential, database migration or paid API call.
- **Rollback:** Close child Draft PR to remove source proposal. Existing **inactive** QA workflow `VSmXkK7Y1Bb3Dg2w` remains, without new changes or activations.
- **Next evidence needed:** One private Meta Business Page owner/App subscription observation and independent Page-only QA scope review. If user supplies redacted screenshots, assess permissions without seeing tokens or private Page IDs.
