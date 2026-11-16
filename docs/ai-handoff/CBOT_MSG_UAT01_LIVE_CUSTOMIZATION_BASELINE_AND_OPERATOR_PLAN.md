# TIEN404 AI — CBOT-MSG-UAT-01 · REAL Messenger Custom Bot Acceptance

**Checkpoint date:** 2026-11-16 (Asia/Tokyo)  
**Parent:** CBOT-UAT-02 PR #204, HEAD `cae493b5665deca9f15fa2ee12871cf3657612b2`  
**State:** Actual Published workflow AUDITED READ-ONLY, Custom Bot integration **NOT DEPLOYED**, source-only QA candidate **NO SEND / NO ORDER WRITE / NO PAID MODEL TEST**.  
**Scope:** Messenger-first sales Lite MVP; do not merge Enterprise Custom Bot Studio directly, do not change Page theme/color through Webhook (not supported for an app).

## A. The reality to use for real Messenger testing

Verified through connected n8n, **without exposing prompts, credential IDs, customer messages, PSIDs or tokens**:

| Observed item | Evidence / result |
| --- | --- |
| Messenger Published workflow | `TIEN404_MESSENGER_TEST` ID `Z7FdV7uDvApfbURQ`, ACTIVE, 27 nodes |
| Published version | `d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92` |
| Last inspected successful webhooks | #3865, #3866, #3867, #3868 — historical success, not new test this turn |
| HMAC & replay | Verify Meta Signature, Verify Signature Timing-Safe, Skip Duplicate Message ID present |
| Parser | `Extract Messenger Text` recognizes `postback` |
| AI Agent | `Messenger AI Agent` has a **6984-character static systemMessage**; NO dynamic `bot_profile_version`, `prompt_version` or `$json` merchant config reference was found in the systemMessage |
| Product reader / order actions | `Read Products - Messenger Read Only` uses **AI_SALES_DEMO** Google Sheets; `create_order`, `manage_order`, `update_order_address` and related legacy tools remain attached |
| Actual app and Page subscription fields | **UNKNOWN**, user screenshot showed miscellaneous Meta webhook fields but not the actual `messages` and `messaging_postbacks` rows or Page-level subscribed app record |
| Native Page/admin owner + explicit Store binding | **NOT independently verified** |

**Hard finding:** Custom Bot V14.7 and V15.2 have experimental branding, greeting, tone, card/menu previews; V16.7 has Store-scoped drafted changes, owner review and in-memory routing. **None of these Draft capabilities are evidenced as wired into the Published Messenger Agent today.** The user cannot yet prove that changing a Custom Bot Studio setting changes the reply on the real Page. Do not claim an actual personalized reply was sent because a Studio preview passed.

Legacy bot may send a real model-generated reply and retains **DEMO writer tools**. Therefore **do not test by typing "đặt hàng", "chốt đơn", "đổi địa chỉ", refund, pricing overrides or other write-intent into the live Page**. Keep the Published workflow unchanged while owner-only baseline is measured; do not silently alter token, model, prompt, HMAC, Page subscription or data.

## B. Source-only Custom Bot configuration regression now implemented

File `qa/cbot-messenger-live-uat/messenger-custom-preflight.mjs`:

- Fails closed against the actual read-only n8n metadata snapshot `actual-published-messenger-metadata-20261116.json`.
- Explicit reasons: static Published prompt, legacy DEMO writers, unknown Meta field subscriptions, unknown Page consent/Store binding.
- Reuses **existing** `qa/v167-merchant/merchant-registry.mjs` (PR #199) to perform a Shop A **draft-only** change to greeting, bot name, tone, business hours/wholesale flag with Manager→Owner approval, verifies Shop B is unaffected, and confirms that no published active bot is changed.
- Proves only code/runtime behavior, **not** a real Page deployment. It cannot send provider messages, call a paid model, read customer rows, apply Supabase migration or write Orders.
- This PR deliberately does not merge/copy V14.7/V15.2 Rich UI from parallel branches [#118](https://github.com/ngoctien20/demo-git/pull/118) and [#162](https://github.com/ngoctien20/demo-git/pull/162), or silently publish the shared runtime. Their ancestry has diverged; reconcile compatibility via a separate audit before future integration.

## C. Operator-directed REAL Page UAT script (no assistant-initiated sends)

This is the **next real-world step** using the Page administrator's **own designated test Facebook account**. It tests the CURRENT Published Messenger baseline, not the unavailable new personalized config. Conduct only in a controlled private QA conversation, not with customers.

**PRE-CHECK**, prior to any test message:
1. Meta Developers: verify `messages` is actually subscribed at App level AND the Page has this app in `/{page-id}/subscribed_apps`. `messaging_postbacks` is needed only to test postback controls. Do not toggle or POST any settings under this audit.
2. Confirm exact Page ID/account and owner-only test session *privately*, not in chat. Existing owner technical Supabase role is not Page administrator evidence.
3. Capture baseline newest execution ID for Messenger `Z7FdV7uDvApfbURQ`, current Published version and deployed node counts; ensure no new change to Published.
4. Restrict tester to **safe informational text only**, no order or personal info, because legacy writer tools are live and may be selected by the Agent. Each message triggers the existing model and may use provider/model quota. Keep to a small manual test session.

**Owner sends exactly ONE baseline-safe message**:
```text
TIEN404-CUSTOM-LIVE01: Xin chào! Bot đang có tên hiển thị và lời chào như thế nào? Chỉ trả lời giới thiệu, không tạo đơn.
```
At most one message initially. If this test is not possible or App/Page verification is incomplete, record `BLOCKED` and do not force a send. The owner should confirm the reply was received in the actual Messenger conversation; a webhook success alone does not confirm the rendered response.

**Post-test READ-ONLY acceptance**, after the owner reports a new execution ID:
- Verify exactly one new webhook execution, correct Published version, Meta HMAC verified, correct Page/channel, extract text, dedup, Agent reply, Meta send HTTP provider message ID, and **zero** execution of `create_order`, `manage_order`, `update_order_address`, `get_order_status`, `create_support_ticket`, and any other write tool.
- Redact message text and all PSIDs/Page IDs except private evidence. Capture sanitized response and actual user-visible screenshot if needed.
- Grade `LIVE_BASELINE_DELIVERY_PASS` only if outbound Meta response and tester screenshot align. **Do not mark `LIVE_CUSTOMIZATION_PASS`** until a separately authorized published Merchant/Store configuration change has been deployed and compared in A/B version-controlled test.

**Future (requires separate approval):** add a genuine trusted provider Page→Store resolver, owner-controlled `bot_profile_version` from an independently authorized merchant config registry and a no-write UAT routing policy before connecting Studio draft to the Messenger Agent. Verify controlled before/after greeting and tone with a real Page, including rollback to original Published version. Approve one narrow canary only after trusted Meta Page owner proof, no-write tool fence, budget protection and exact backup/rollback.

## D. UAT matrix

| Case | Current status | Acceptance |
| --- | --- | --- |
| Messenger receives/sends ordinary greetings | Historical successful webhook only | One new owner-controlled Page reply with Meta send ID and no write-tool execution |
| Change bot name | Source-only draft preview | Actual real Page reply changed only after approved config version cutover |
| Change greeting | Source-only draft preview | Expected text after approved cutover; no Store B contamination |
| Tone / industry profile | Source-only draft preview | Real reply changes according to approved Shop config, not user prompt injection |
| Menu postback | Parser code present; App/Page registration UNKNOWN | Real Meta postback event, signed payload and no privileged writer |
| Product carousel / quick replies | Rich UI documented, Draft only | Real entitlement, approved template, provider success, user-visible card |
| Theme/color | Website Widget only | **Not applicable to Messenger chat bubble/color** |
| A/B Store isolation | Source-only test fixtures | Real Page→Store ownership and hosted Store/JWT RLS required |
| Order, inventory, notifications | Prohibited in this UAT | 0 writes, 0 sends outside owner-controlled reply |
| Published Bot rollback | Existing version `d5c96b...` recorded | No changes now; later canary requires backup & approval |

## E. Scope, QA evidence, rollback, next step

- **VERIFIED:** Existing Published 27-node version, static agent prompt, attached legacy tools and 4 historical webhook successes.
- **IMPLEMENTED:** fail-closed actual metadata preflight and code-only Store-scoped custom draft acceptance.
- **TESTED:** Node CI only; do not claim real new send until owner action and n8n execution trace.
- **BLOCKED:** native app/Page subscription evidence and signed Merchant→Store authority; Live Custom Bot applied config, Rich UI and no-write canary.
- **CHANGES MADE TO LIVE:** NONE. No n8n Published, Supabase, Messenger Page, token, customer Order, credential, billing or model call.
- **ROLLBACK:** close this Draft PR; no hosted rollback needed.
- **Next checkpoint:** `CBOT-MSG-UAT-02 — Owner-Controlled Messenger Greeting Evidence × Read-Only Execution Acceptance`. When App/Page webhook subscriptions are privately verified, the owner sends one test greeting and provides its local execution ID/time. Only then can the assistant audit it, before designing a separately approved safe studio-to-live canary.
