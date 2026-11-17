# TIEN404 — V17.13R Real Signed Meta POST UAT × Messenger Shadow Core Acceptance
**Verified at:** 2026-11-17 JST. **Scope:** an owner-reported single Messenger test message sent to the already-configured existing Page after V17.13 release. Do not store customer's message, sender ID, recipient ID, Meta MID, Page token, signature, or account secrets in this checkpoint.

## Real production webhook acceptance (no synthetic Meta POST)
**Existing Messenger:** `Z7FdV7uDvApfbURQ`, execution **#4431**, mode **webhook**, 2026-11-17 04:02:43 UTC = 13:02:43 JST, status **SUCCESS**, duration approximately **22.576 seconds**. Current Published version `ff7a57d2-519a-4283-933c-37a854df92d2`.

Specific executed nodes and checked evidence:
1. `Webhook1`: success on incoming POST, `Crypto`: success using the raw-body path previously unavailable to the synthetic MCP POST test.
2. `Verify Signature Timing-Safe`: `verified:true`; `Verify Meta Signature`: success true route; `Respond to Webhook2` success.
3. `Extract Messenger Text`: one normalized input; `Skip Duplicate Message ID`: one passed item; `Loop One Message` succeeded. Existing hardcoded Page ID and recipient checks were in the code and unchanged from baseline.
4. `Messenger AI Agent`: one successful execution. `Send Messenger Reply - CONFIGURE TOKEN`: **one successful HTTP send node execution** with a nonempty Meta `message_id` (not recorded here). `Verify Messenger Send Result`: success, nonempty `metaMessageId` and `deliveryAcceptedAt`; `Record Successful Messenger MID`: success. This confirms Meta **accepted** a reply; actual handset/user-visible delivery was not independently checked.
5. `TIEN404 V17.13 Signed Shadow -> Central Core (NO SEND)`: exactly one successful invocation, independent of legacy send. Its output `V1713_SIGNED_PATH_SHADOW_CORE_DENY_PASS` reports `provider_sends:0`, `commerce_writes:0`, `model_calls:0`, `live_customer_data_used:false`, `central_replied_to_customer:false`.

**Private Shadow Bridge:** `dw1JOxWOEY8csTnm`, nested actual integrated execution **#4432**, 04:03:05 UTC, **SUCCESS** approximately 0.449 s. `Private Signed Messenger Receipt - Internal Only` data contained exactly these five keys: `source,pageId,hmacVerified,mediaType,fixtureOnly`; **no** `senderId,chatInput,messageId,phone`. `Fail Closed Page HMAC Context and Drop PII` returned `accepted:true,fixtureOnly:false,canSend:false,canWrite:false`. Then actual central Core invoke and `Assert Central Core Denied and No-Send` succeeded. The bridge did not call provider, model, or order writer.

**Central Commerce Core:** `iyfGUiEsZlNTBWOR`, nested integrated execution **#4433**, 04:03:05 UTC, **SUCCESS** approximately 0.243 s. `Resolve Commerce Tenant` returned `resolved:false,reason:unknown_or_duplicate_channel,canSend:false,canWrite:false` for the reserved synthetic internal account; `Reject Unknown Shop` returned `success:false,reason:unregistered_or_disabled_channel,canSend:false,canWrite:false`. `Commerce Sandbox Agent`, `Commerce OpenAI Model`, catalog tools and order writers did not execute in this path.

## What changed from V17.13
- **PENDING_REAL_EVENT → VERIFIED_ONE_SIGNED_EVENT** (Messenger inbound, existing legacy Messenger reply accepted by Meta, new shadow call and central Core deny).
- Real Meta HMAC POST **is verified** on this test message; former synthetic HTTP #4429 failure (binary input missing) remains in history and is not a passing test.
- The real event proves a **single successful received and sent path**, NOT system-wide absence of duplicates under replay/concurrency, NOT positive Store authorization, NOT Commerce catalog read correctness, NOT Zalo OA integration, NOT production Core Agent customer response.
- Existing Messenger agent did perform one model inference. **Only the NEW shadow Core path had zero model calls.**
- Real execution duration 22.576 s end-to-end; `Messenger AI Agent` node used around 11.110 s. Do not interpret time to completion as the webhook acknowledgment latency or promise response SLO without measurement.

## Release gates
**VERIFIED**
- Native signed Meta message passed existing HMAC and Page checks and duplicate filter in live workflow.
- Existing legacy bot executed once and Meta accepted one reply.
- New published private shadow genuinely executed with a PII-minimized receipt and called published central Core.
- Central Core failed closed to intentional unregistered internal Shop and performed no provider sends or Commerce writes.

**BLOCKED / NO-GO**
- Core customer-facing AI replies; real per-Store product price/stock and transactional order/stock writes.
- Actual Shop A/B JWT RLS/Store ownership and independent M0 recovery; unverified Zalo OA signed inbound and outbound.
- Replay/duplicate provider event QA, concurrency and network failure isolation of this real path, additional real-event UAT (this report observed ONE).
- User-visible delivery on Facebook device remains unknown; provider accepted reply only.

## Rollback / checkpoints
- Keep new Published versions pinned: Messenger `ff7a57d2-519a-4283-933c-37a854df92d2`, internal bridge `450f2693-aad9-47d8-aaba-ac7a94abe644`, central Core `ddc3ce5b-365e-47e2-a06d-08daffceb9a8`.
- Legacy Messenger last-good snapshot **`d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92`** still available in n8n version history. Only roll back when monitoring or owner UAT reveals a regression; do not unpublish now.
- No production write or credential changes made during acceptance check. No additional messages sent, no Commerce orders added, no Supabase or Google Sheets mutations.
- Underlying plan/checkpoint: [V17.13 live shadow](https://github.com/ngoctien20/demo-git/blob/work/v171a-channel-store-bot-vertical-slice-nosend-20261117/docs/ai-handoff/V17_13_LIVE_SIGNED_MESSENGER_CENTRAL_CORE_SHADOW_CHECKPOINT.md). PR #243 remains Draft, no merge.

**Acceptance verdict:** `V17_13R_REAL_SIGNED_SHADOW_ONE_EVENT_PASS`, with `NO_GO_CORE_CUSTOMER_FACING_COMMERCE`.
