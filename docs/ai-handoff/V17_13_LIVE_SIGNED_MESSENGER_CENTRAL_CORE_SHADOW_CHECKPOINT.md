# TIEN404 V17.13 — VERIFIED Messenger Published Signed Shadow → Restricted Central Core (NO SEND)

Date: 2026-11-17 JST. **APPROVED IN CHAT:** Owner previously authorized central Core LIVE experiment and explicitly requested to continue connecting. This milestone intentionally limits the new connection to **silent, PII-minimized shadow reception**, with NO new customer replies or Commerce writes.

## Verified actual state / IDs

| Component | n8n ID | Current Published version | Role |
|---|---|---|---|
| Existing Messenger DEMO receiver | `Z7FdV7uDvApfbURQ` | **`ff7a57d2-519a-4283-933c-37a854df92d2`** | Real Page webhook GET/POST, existing HMAC, Page allowlist, dedupe, original AI Sales DEMO reply/tools left untouched; one additive shadow branch |
| New private Messenger shadow | `dw1JOxWOEY8csTnm` | **`450f2693-aad9-47d8-aaba-ac7a94abe644`** | n8n ExecuteWorkflowTrigger only; caller allowlist only Messenger workflow; drops sender ID, message ID and message text; sends deliberate unregistered synthetic context into real Core, tests fail-closed |
| Existing central Commerce Agent | `iyfGUiEsZlNTBWOR` | **`ddc3ce5b-365e-47e2-a06d-08daffceb9a8`** | Internal subworkflow only. Caller allowlist only bridge `dw1JOxWOEY8csTnm` and existing manual QA `7XzLd51D7C6tlaS4`. Existing `live_connector_not_implemented` gate remains. No direct public Webhook or customer reply channel. |

- Messenger current 28 nodes. **n8n actual version diff** `d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92` → `ff7a57d2-519a-4283-933c-37a854df92d2` showed **exactly 1 node added, 0 removed, 0 modified, 1 new connection, 0 removed connections**. New edge: `Skip Duplicate Message ID` → `TIEN404 V17.13 Signed Shadow -> Central Core (NO SEND)`. Original connection `Skip Duplicate Message ID` → `Loop One Message` remains exactly intact. Original Messenger 27 node definitions are byte-equivalent in native tool readback, and original legacy DEMO order tools preserved. No Meta callback URL or subscription changed.
- Original Messenger verified signature branch: real Meta `Webhook1` POST → `Crypto` HMAC → `Verify Signature Timing-Safe` → `Verify Meta Signature` → HTTP 200 → `Extract Messenger Text` (hardcoded original Page ID + recipient checks) → `Skip Duplicate Message ID`. Only then new shadow branch. This is NOT independent real Page ownership proof for new commercial Store.
- **Only five fields cross from Messenger into the new private subworkflow:** `source` static marker, `pageId`, `hmacVerified` derived from upstream timing-safe signature result, `mediaType`, `fixtureOnly=false`. No `senderId`, `messageId`, `chatInput`, customer name, phone, address or media URL forwarded. Existing legacy Messenger naturally still sees normal customer content as before; this milestone does not authorize Commerce customer data use.
- Shadow bridge requires exact existing Page ID and HMAC-verified path marker, provides only **reserved unregistered synthetic** Account ID, no-person Sender ID, constant text into central Core. Core must return `success:false,canSend:false,canWrite:false,reason:unregistered_or_disabled_channel`; fail if not. It never sends to provider, writes an Order, reads a real customer's Commerce record or runs a model on customer content.
- Settings: bridge `callerPolicy=workflowsFromAList`, `callerIds=Z7FdV7uDvApfbURQ`. Core `callerPolicy=workflowsFromAList`, `callerIds=dw1JOxWOEY8csTnm,7XzLd51D7C6tlaS4`. Shadow outbound Execute Workflow node in Messenger uses `mode:each`, `onError:continueRegularOutput`, no credentials and none of the PII fields in workflowInputs.

## Actual n8n tests

- Initial bridge Manual fixture execution **#4402** SUCCESS; actual Core called, denied, no provider send, model or Commerce write. No real signed Meta webhook was involved.
- Negative HMAC-false simulated fixture **#4405** SUCCESS: `V1713_SHADOW_INGRESS_DENIED`, Core branch not executed. This manually seeded false boolean is not a provider cryptographic test.
- Restored HMAC-true synthetic fixture, execution **#4406** SUCCESS; `V1713_SIGNED_PATH_SHADOW_CORE_DENY_PASS`; zero sends, models, order writes.
- Restricted original central Core to two known internal callers, then re-ran V17.12 manual QA **#4409 SUCCESS 8/8 denied**, no customer data or real signed callbacks.
- Published internal Core and private bridge sequentially, then bridge re-test **#4426 SUCCESS** fail-closed.
- Published existing Messenger current draft after confirming original graph exactly unchanged. n8n publish returned success with exact version above.
- Synthetic production webhook POST test **#4429 ERROR inside Crypto**: MCP-supplied webhookData did **not** contain n8n binary property `data` required for rawBody. This is an **invalid test harness input**, not verified HMAC-negative coverage, not a real Meta signed callback, and no AI/Send/Shadow nodes ran. Do not count as PASS. The old raw-body Crypto path was not edited.
- Synthetic production webhook GET test **#4430 SUCCESS** with deliberately wrong verify token: only `Webhook` → `If` → `Respond to Webhook1` ran; no model, new shadow branch, or Meta sends. Supports unchanged GET invalid-token behavior only, not signed POST acceptance.
- **No real signed Meta POST has been observed after the V17.13 release** in latest execution search (only #4429 and #4430 test runs after publish). Thus **REAL LIVE SHADOW RECEIPT = PENDING_REAL_EVENT**, not falsely claimed pass.

## What this does and DOES NOT mean

**IMPLEMENTED / PUBLISHED:** a LIVE-ready additive technical shadow connection from existing signed Messenger path to protected internal central Core. **TESTED:** mock internal positive/negative and legacy GET invalid-token. **UNVERIFIED:** actual signed Meta callback after this new release, actual Core response to customers, Zalo OA native authorization, real Store ownership, hosted JWT RLS and independent recovery.

Never claim the central Commerce Bot is now live for customer conversations or order creation. The **old Messenger DEMO Agent still replies to customers**; the new Core only records an attempted internal read-only/deny shadow trace on valid inbound. Any later promotion to real catalog response or order commit requires separately verified Page/OA ownership, tenant/store-permission binding, customer consent, Store RLS and transaction/backup gates.

## Next UAT (operator runbook)

1. Have **the owner** send one ordinary test message from their authorized QA Facebook account to the **existing Page** connected to this n8n Messenger receiver, e.g. `Chào shop, mình muốn xem sản phẩm nào còn hàng?`. Do not include phone, address or personal secrets.
2. Inspect **new** Messenger `Z7FdV7uDvApfbURQ` execution after deployment: `Webhook1`, `Crypto`, timing-safe signature verified, Page matched, dedupe, **added V17.13 shadow node** and unchanged original Reply Sender branch, all with proper statuses. Inspect the nested `dw1JOxWOEY8csTnm` and `iyfGUiEsZlNTBWOR` execution IDs; evidence must show reserved/unregistered shadow and **no Core model/send/order**.
3. Ensure existing Page sends **one normal legacy DEMO** reply to the test user, and there is no second reply, no cross-Store read and no PII in new private bridge. Replayed duplicate MID should not invoke shadow or repeat a reply. Test a bad raw-body HMAC over an isolated authorized QA harness rather than forging public Meta Page traffic.
4. Only after real signed shadow success, and independently verified original Store authority/hosted RLS/recovery, consider provider-specific **read-only central replies** on bounded QA Page/OA. Do not enable Commerce writes yet.

## Rollback
- Original Messenger Published Version **`d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92`** is in n8n version history. If new shadow affects the original live Page or causes execution failure, republish that pinned version via `publish_workflow({workflowId:'Z7FdV7uDvApfbURQ',versionId:'d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92'})`, then verify published ID and actual Page reply. Do not replace the Page webhook URL or Meta subscriptions.
- Stop/restore private shadow and central internal publish only after confirming no current signed event depends on it. Their original prepublish state is pinned in [internal snapshot](https://github.com/ngoctien20/demo-git/blob/work/v171a-channel-store-bot-vertical-slice-nosend-20261117/qa/v1713-bridge/internal-core-bridge-prepublish-snapshot.json).
- Original Messenger graph snapshot is [here](https://github.com/ngoctien20/demo-git/blob/work/v171a-channel-store-bot-vertical-slice-nosend-20261117/qa/v1713-bridge/messenger-original-published-prechange-snapshot.json).

**RELEASE VERDICT:** `GO_LIVE_TECHNICAL_SHADOW_ONLY` / `NO_GO_REAL_CORE_CUSTOMER_REPLY_OR_ORDER`. No change to Supabase hosted or Google Sheet `1siR8y7lxrYch8w6P1CVn5ta6XdWpYX9NJ384Yb1kujw`. Zalo Published staging still untouched.
