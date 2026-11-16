# TIEN404 — CBOT-MSG-LIVE01 · Actual Messenger Execution Acceptance

**Observed:** 16 Nov 2026, 20:31 JST  
**Source:** n8n connector **read-only**, Messenger workflow `Z7FdV7uDvApfbURQ` execution **#4176**.  
**Prior baseline:** #3868 and PR #209 HEAD `c759be635c85065c2de8a5e3e37fdb8795029472`.  
**Outcome:** **LIVE_BASELINE_TECHNICAL_PASS / CLIENT-VISIBLE DELIVERY PENDING**. **NOT LIVE_CUSTOMIZATION_PASS**.

## 1. Independent runtime inspection (real webhook, not fixture)

- Exactly one newer workflow execution after baseline #3868 matched message marker `TIEN404-CUSTOM-LIVE01`.
- New execution **#4176**, mode `webhook`, started `2026-11-16T11:31:09.716Z`, completed `2026-11-16T11:31:21.045Z`, status `success` (~11.3 sec).
- The current Published workflow remains `d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92`, active 27 nodes; no published mutation was performed.
- `Verify Signature Timing-Safe` returned verified `true`, `Verify Meta Signature` verified `true`.
- `Extract Messenger Text` correctly extracted the marker and message metadata; `Skip Duplicate Message ID` processed the incoming message.
- `Messenger AI Agent` executed once and created 162-char reply classified as **bot identity + default greeting**. It named TIEN404 AI and referenced the current generic shop greeting; no Shop A-specific Merchant Studio setting was used.
- `Prepare Messenger Reply` executed; `Send Messenger Reply - CONFIGURE TOKEN` executed **once** with a `message_id` returned by Meta. `Verify Messenger Send Result` echoed the matching `metaMessageId` and a populated `deliveryAcceptedAt`. `Record Successful Messenger MID` ran, recording the message ID for dedup.
- **All 11 executed nodes have success status**, including the expected non-business dedup record.
- **ZERO business tool invocations** observed: `create_order`, `manage_order`, `update_order_address`, `get_order_status`, `create_support_ticket`. No business Order writer node in runData. This does not license subsequent write-intent tests.
- No raw message body, PSID, Page ID, Meta Message ID, access token, customer details or credentials stored in this GitHub report. See redacted `qa/cbot-messenger-live-uat/live01-observed-execution-4176.json`.

## 2. Exact acceptance distinction

| Criterion | State |
| --- | --- |
| Real incoming Messenger webhook | **VERIFIED** |
| Correct user-requested LIVE01 marker | **VERIFIED** |
| Meta signature HMAC acceptance | **VERIFIED** |
| AI Agent ordinary intro reply | **VERIFIED** |
| Meta API accepted one outbound send + returned MID | **VERIFIED** |
| Zero business order tool calls | **VERIFIED on execution #4176** |
| User visibly received/rendered reply in Messenger | **NOT CONFIRMED by user yet** |
| Owner/Page rights and App+Page field subscriptions independently certified | **NOT CERTIFIED**; receiving `messages` in execution is a functional observation |
| Merchant Studio version read by Published Agent | **NO** — static prompt in read-only Published audit |
| Shop A/B real Store isolation / separate prompt+greeting real canary | **NOT TESTED** |
| Change Published, Meta permissions, token, real Orders | **NOT AUTHORIZED / NOT DONE** |

**Do not infer a new `messaging_postbacks` App/Page subscription from a normal text message.** The `messages` route is working in this real instance. HMAC + Meta send response is also distinct from a screenshot proving the user's device rendered the reply. The existing Published Agent still has legacy DEMO writer tools; the fact none ran during one greeting is a positive result for **this execution only**.

## 3. Actual reply (sanitized summary)

The Agent identified itself as TIEN404 AI and described its default greeting. It **did not use** the Shop A draft greeting from the synthetic V16.7 Merchant Runtime. This is **expected** because Custom Studio drafts have not been deployed to Published.

## 4. Next safe operator steps

1. From the user's **own Messenger QA account**, confirm the reply is visible. A screenshot redacted for private names/PSIDs is optional. A visible reply upgrades **LIVE_BASELINE_TECHNICAL_PASS** to **LIVE_BASELINE_USER_RECEIPT_PASS**; it **cannot** certify Custom Bot Studio live.
2. Test `messaging_postbacks` only if Meta App AND Page subscriptions are explicitly verified; do not toggle Page settings silently.
3. To conduct a real **Custom Bot change**, first implement and test a no-write canary branch that **resolves trusted Meta Page → Store**, loads an **approved Merchant config version**, enforces policy and a real one-Shop deployment/rollback gate. The Owner must approve exact Published workflow version change, and production risk must be evaluated separately. No changes made by this milestone.
4. When approved, compare before/after intro/greeting/tone on a designated QA Page, verify no DEMO tools were called and separate Shop B remains isolated. Do not test by placing actual Orders.

## 5. Checkpoint / rollback

- **VERIFIED:** Real webhook #4176, HMAC=true, AI reply, accepted Meta Message ID and absence of business tools.
- **IMPLEMENTED:** Privacy-safe factual execution receipt, documentation and source-only QA.
- **TESTED:** Github CI after exact HEAD; original n8n execution actual.
- **BLOCKED:** Page-level owner/Store proof and real Custom Studio→Published integration; client-side delivery still requires user acknowledgment.
- **CHANGED in hosted:** None. No app permissions, Published, Meta, Supabase/Orders, credentials, billing or provider message initiated by assistant.
- **Rollback:** Close this Draft PR; no live system changes to revert.
