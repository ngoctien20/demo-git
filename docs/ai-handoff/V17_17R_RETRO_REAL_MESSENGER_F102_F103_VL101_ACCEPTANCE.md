# TIEN404 V17.17R — Retrospective live Messenger F-102 / F-103 / VL-101 acceptance

**Date:** 2026-11-17 JST. **Reason:** The owner clarified two tests had already been sent in a PREVIOUS chat session; avoid resending provider messages or attributing them to a new version.

## Actual native Messenger evidence

All executions are `TIEN404_MESSENGER_TEST` workflow `Z7FdV7uDvApfbURQ` and returned `status=success`. In each, raw Meta HMAC verification returned `verified:true`, `V17.15 Route QA_CORE Only?` took the new Core pilot branch, **one** `Send Messenger Reply` executed and Meta returned a nonempty message ID, `Verify Messenger Send Result` and successful MID recording. The original Messenger Agent and old create/manage/update order tools did not execute for these QA-prefixed inputs.

| Native webhook execution | Local JST timestamp | Sanitized request | Real integrated Commerce Core execution | Result |
| --- | --- | --- | --- | --- |
| **#4746** | 2026-11-17 **15:46:47** | `QA_CORE: F-102` | **#4747** | Exactly F-102, sample price **289000 VND**, name `Áo sơ mi slimfit (MẪU)` and demo-only disclaimer. One Meta-accepted reply. |
| **#4754** | 2026-11-17 **15:47:17** | `QA_CORE: F-103` | **#4755** | No sample product found; no fabricated SKU or price. One Meta-accepted reply. |
| **#4762** | 2026-11-17 **15:49:35** | `QA_CORE: VL-101` | **#4763** | No sample product found; **no materials-tenant price or cross-shop product disclosed**. One Meta-accepted reply. |

Each core response was tagged `[TIEN404 CORE — DEMO CHỈ ĐỌC]` and `canWrite:false`, `canSend:false`, `live:false`, using current Page's sandbox tenant `demo_tien404`. Integrated central Core execution for each used existing `V17.15 Query Existing Commerce Catalog` and deterministic `V17.15 Format Safe Demo Consultation` only: no central model calls, no central order writes. Each signed original webhook additionally ran the **separate** V17.13 zero-PII shadow `#4751`, `#4759`, `#4767`, all PASS with `provider_sends:0, commerce_writes:0` in that shadow branch. These proofs are per-event, not a stress test or an independent customer-device delivery receipt.

## Critical version chronology / evidence attribution

- The three genuine signed messages were received at **06:46:47**, **06:47:17**, **06:49:35 UTC**.
- **Core V17.17** version `456862c9-e5ee-4bfa-9931-47dbc39ab73d` was **CREATED** at `2026-11-17T06:50:36.867Z`. Thus all 3 tests preceded even creation of this version; they tested **the earlier Core V17.16 generation**, not V17.17.
- **Messenger V17.17** version `1064b1b3-d3f1-4a6b-a367-2414ba691522` was **CREATED** at `2026-11-17T06:53:39.198Z`. Thus these 3 tests used the earlier Messenger `QA_CORE:` normalization, not the subsequent static-intent-only sanitizer.
- This distinction was corroborated by Core input `QA_CORE: VL-101` in #4763; the current V17.17 Messenger classifier should instead forward `QA_CORE: __T404_UNKNOWN_SKU__` after sanitization.
- Consequently: `PASS_PREVIOUS_VERSION_REAL_SIGNED_F102_UNKNOWN_CROSS_STORE` and **`NOT_YET_VERIFIED_NEW_V1717_REAL_SIGNED_INTENT_ROUTING`**. Do not incorrectly mark previous-branch tests as new-version live acceptance.
- The CURRENT published Messenger/Core versions remain `1064b1b3-d3f1-4a6b-a367-2414ba691522` and `456862c9-e5ee-4bfa-9931-47dbc39ab73d`; previous independent n8n manual QA #4866 tested 25/25 new Core cases, but did not substitute for real Meta-native callback after upgrade.

## Safety / next acceptance

- No test message was sent or replayed by the assistant. This checkpoint is based entirely on read-only execution/history inspections.
- No provider token, recipient PSID, message ID or customer PII is stored in GitHub. Native Meta send API acceptance is **not** proof that the customer's app/device displayed the message.
- **Required next real signed canary for V17.17:** a single new merchant-controlled Messenger test such as `QA_CORE: gia si` or `QA_CORE: F-102`, once the user chooses to send, to verify latest intent-token routing and one Meta-accepted outbound. No need to resend old examples to prove the earlier generation.
- Real Page→merchant Store owner authority, Zalo OA native installation, Website signed real Store session, hosted Store RLS, real merchant products and live Commerce order/stock remain **NO-GO**. Legacy unprefixed Messenger DEMO path retains its preexisting order tools.
- Rollback if necessary: Messenger previous `2b869035-fe39-46fb-a253-18fefe4ecbfd`; Core previous `b08f806b-25dc-40d4-9e82-212307ce19b9`. Do not deploy rollback merely for retrospective verification.
