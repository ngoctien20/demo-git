# TIEN404 V17.15R — First Real Signed Messenger QA_CORE Product Consultation UAT

**Date:** 2026-11-17 JST. **Outcome:** `PASS_FIRST_REAL_SIGNED_QA_CORE_DEMO_READONLY_REPLY`; **NOT** merchant Store or Zalo/Website LIVE commerce certification.

## Grounded runtime evidence

- **Owner action:** Sent `QA_CORE: F-101` to existing connected Messenger Page. No account/PSID, Meta message ID, signature, phone, order ID or tokens included in this checkpoint.
- **Messenger Published workflow** `Z7FdV7uDvApfbURQ`, version `2b869035-fe39-46fb-a253-18fefe4ecbfd`, real webhook execution **#4544 SUCCESS** at `2026-11-17T04:50:20.589Z` (13:50:20 JST), stopped `04:50:24.980Z` (elapsed **4.391 s**). Nodes executed: `Webhook1`, `Crypto`, `Verify Signature Timing-Safe` (`verified:true`), `Verify Meta Signature`, webhook ACK, `Extract Messenger Text`, `Skip Duplicate Message ID`, `Loop One Message`, `V17.15 Route QA_CORE Only?`, `V17.15 Strip PII and Normalize Demo Query`, `V17.15 Call Actual Commerce Core Read-Only`, `V17.15 Assert Demo Reply Safe to Send`, `Prepare Messenger Reply`, **one** `Send Messenger Reply - CONFIGURE TOKEN`, `Verify Messenger Send Result`, `Record Successful Messenger MID`, plus original independent `V17.13 Signed Shadow` node.
- **Observed exact customer-facing reply** (already public demo copy, no PII):
  ```
  [TIEN404 CORE — DEMO CHỈ ĐỌC]
  • F-101 — Áo phông unisex cơ bản (MẪU): 159.000đ (giá mẫu)
  Đây là giá/danh mục mô phỏng, không phải báo giá hay tồn kho thực tế. Chưa nhận đặt hàng hoặc giữ hàng.
  ```
- **Meta acceptance**: Send HTTP node SUCCESS, returned nonempty Meta message ID; verification node had `metaMessageId` and `deliveryAcceptedAt`; MID recording node succeeded. This confirms a single accepted send in **this execution**, not client-device delivery or population-wide anti-replay.
- **Full old-model and order-write tool isolation for this message:** `Messenger AI Agent`, old `create_order`, `manage_order`, `update_order_address`, `get_order_status`, `create_support_ticket` absent from this execution's run data. **Do not generalize this to non-`QA_CORE:` chat**: previous real execution #4498 demonstrated existing legacy DEMO order creation.
- **Core input to new advisor**: sanitized and synthetic session sender ID, no customer sender identity, no original raw personal text; `channelType=messenger`, `accountId` exactly current n8n DEMO Page, `chatInput` prefixed `QA_CORE:` and sanitized SKU. No customer product/Order/Stock writes.
- **Actual Central Commerce Core** `iyfGUiEsZlNTBWOR`, Published version `3d3905a4-0d26-4253-8a1d-57fd73b043c2`, integrated execution **#4545 SUCCESS**, 04:50:22.455Z to 04:50:23.221Z (**0.766 s**), ran existing Tenant resolver, `Known Sandbox Tenant?`, `V17.15 Demo Catalog Advice Requested?`, `V17.15 Sanitize Read-Only Demo Query`, `V17.15 Query Existing Commerce Catalog`, `V17.15 Format Safe Demo Consultation`. Output `success:true`, `tenantId=demo_tien404`, `environment:sandbox`, `demoOnly:true`, `canSend:false`, `canWrite:false`, `live:false`. The sample SKU F-101 at **159000 VND** matched current isolated n8n Commerce Catalog. `Commerce Sandbox Agent`, `Commerce OpenAI Model`, `Create Sandbox Ticket`, cart or write tool nodes did NOT run on this input.
- **Independent old V17.13 non-PII shadow** `dw1JOxWOEY8csTnm`, integrated execution **#4549 SUCCESS**, 04:50:24.138Z to 04:50:24.801Z (**0.663 s**), returned `V1713_SIGNED_PATH_SHADOW_CORE_DENY_PASS`, `provider_sends:0`, `commerce_writes:0`, `model_calls:0`. Nested Core `iyfGUiEsZlNTBWOR` execution **#4550 SUCCESS**, 04:50:24.293Z to 04:50:24.636Z (**0.343 s**), `Reject Unknown Shop` returned `reason:unregistered_or_disabled_channel`, `canSend:false`, `canWrite:false`. This separate technical branch did not issue an extra Meta send.
- Search of Messenger executions after 04:45 UTC returned **only #4544** at the time checked. For that one event, Meta Send node executed **one time** and MID was recorded. No independent duplicate/replay storm was attempted or certified.

## Release and QA verdict

| Check | Result |
| --- | --- |
| First actual Facebook signed QA_CORE: F-101 routed through Core | **VERIFIED / TESTED #4544 → #4545** |
| Sample-only F-101 name and price with conspicuous DEMO warning | **VERIFIED** |
| Existing Meta endpoint accepted one Core-origin reply using original sender | **VERIFIED** |
| Real individual message's Core model and Commerce write tools not executed | **VERIFIED** |
| Independent no-PII signed shadow still works | **VERIFIED #4549 → #4550** |
| New positive real `QA_CORE: F-102` and unknown SKU/customer responses | NOT TESTED IN PROVIDER LIVE |
| Business-owned Store/Page authority, RLS, real merchant product approval | **BLOCKED** |
| Zalo native OA callbacks, merchant Website verified session, actual outbound canary | **BLOCKED** |
| Real order create/update, stock, payment via central Core | **NOT ENABLED** |
| Actual delivery displayed on user's Messenger device | Not independently verified by connector |
| Global Page write prohibition | **FALSE** (legacy DEMO writer still exists) |

## Rollback and next checks

- Current Messenger Published: `2b869035-fe39-46fb-a253-18fefe4ecbfd`; if regression to normal replies, restore previous known-good `ff7a57d2-519a-4283-933c-37a854df92d2` from n8n version history and observe native signed webhook/MID. Preserve same Meta Page callback and token.
- Current Core Published: `3d3905a4-0d26-4253-8a1d-57fd73b043c2`; if Core pilot regression, restore `ddc3ce5b-365e-47e2-a06d-08daffceb9a8` **only after** decoupling the Messenger QA_CORE branch.
- Existing Zalo Bot staging `776486b2-092f-49ec-a7c4-f74ec8b60f07` and Website demo `c81929d4-ab55-4c24-8659-795842739e24` remain independent no-send denial/copy-preserving routes; cannot be elevated to merchant OA/Website consulting from this Messenger UAT.
- Do not alter Supabase, catalog product prices, customer data, orders, payment or credentials based on this one UAT.
- Next UAT: Messenger `QA_CORE: F-102` and `QA_CORE: VL-101` should respectively show sample F-102 and refuse unknown/cross-catalog SKU; Website valid authorized test session response exact equality; real Zalo **Bot staging** protected ingress no-send. The OWNER does not need to repeat Page signed F-101 test or live approval.

**Checkpoint:** This document supplements V17.15, PR #243 (DRAFT); not a declaration of real merchant Commerce GO.
