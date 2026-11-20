# TIEN404 V19.8.18 — REAL Published Writer Caller Inventory (Read-only)

**Evidence time:** 2026-11-21 JST. Connected n8n details + exact active saved version content were inspected, without executing or modifying workflows. No credential values or customer records retrieved. IMPORTANT: **PARTIAL inventory; full caller closure BLOCKED.**

## Verified Active/PUBLISHED graph

| Workflow | Active Published version ID | Draft version ID | Verified behavior / protection gap |
|---|---|---|---|
| `Z7FdV7uDvApfbURQ` TIEN404_MESSENGER_TEST | `1064b1b3-d3f1-4a6b-a367-2414ba691522` | same | Active Messenger Agent calls 4 Google Sheets order tools + support ticket, separate signed shadow and Commerce Core read-only connection |
| `KrSn4DNR9ALX5ng4` Create Order Tool (AI_SALES_DEMO) | `4740251a-cd01-4f7f-b8e1-e300a8393151` | `af9ee686-2a9f-483e-9622-6e449500ac5e` | Input `customer_name,phone,address,sku,quantity`; reads Google Sheets Products/Orders, `Append Order` maps `order_id,customer_name,phone,address,sku,quantity,unit_price,total,status,created_at`; no trusted Tenant/Store |
| `fDB9dvs1qPPVt9Sp` Manage Order | `137d5689-40c5-4147-9bbc-b22809ad5908` | `2e8786fd-e5c5-410f-9d6c-655653c32278` | Input `mode,order_id,phone,new_customer_name,new_phone,new_sku,new_quantity,expected_total`; Google Sheets read/update/readback; no Store authority |
| `BkAi6TVUKAjCnI7v` Update Address | `93cf227a-ab8a-42c6-9185-7ec44f7aeb00` | `3bd7043f-78e7-4a1c-93e5-2bc9d60ac767` | Input `order_id,new_address,phone`; Google Sheets row update; no Store authority |
| `4DFFCk60exrzaIl6` Order Status | `1faaa1ee-a45c-4bf0-8e3f-f197051f33f8` | same | Input `order_id,phone`, Google Sheets lookup; phone+Order ID not verified cross-channel identity |
| `iyfGUiEsZlNTBWOR` Commerce AI Core | `456862c9-e5ee-4bfa-9931-47dbc39ab73d` | `c96422e0-170b-46a3-8d75-3a2695e645e7` | Active workflow, present tools Catalog Query/Cart Preview and tenant resolver; not a verified protected Store-scoped Order writer |
| `5Eeh8hbpsoNhuiVo` Commerce Tenant Resolver | `a99c7350-7aea-446d-bdc5-4b10f52c3ad1` | same | Inputs `channelType,accountId`; tenant-only, no Store Owner credential proof |
| `yIJk8LvJoLF40Z62` Zalo Bot staging | `2d912cb0-007f-452f-9536-b92ba12a03e6` | same | Webhook/protected read-only normalizer, receipt with NO send, shadow/router connections; no proven real Zalo installation authority |

## Caller paths verified

`Messenger Agent -> create_order -> KrSn4DNR9ALX5ng4 -> Google Sheets Append Order`

`Messenger Agent -> manage_order -> fDB9dvs1qPPVt9Sp -> Google Sheets Update Order Row`

`Messenger Agent -> update_order_address -> BkAi6TVUKAjCnI7v -> Google Sheets Update row in sheet`

`Messenger Agent -> get_order_status -> 4DFFCk60exrzaIl6 -> Google Sheets read`

Additionally Messenger calls `iyfGUiEsZlNTBWOR` in a designated read-only demonstration path and its NO-SEND shadow. These cannot authorize an order write without independent server verified tenant+Store installation/actor.

**P1 blocker**: These are separate *single-Store DEMO compatibility* workflows. They have no canonical `store_id` and must never be silently routed to multi-Store Commerce; do not alter or disable them. Draft ≠ Published for the 3 writers, so editing in Editor is not proof Published is updated.

## Source and infrastructure closure gates (open)

- n8n: all other active Execute Workflow, HTTP Request, Google Sheets and AI Tool callsites across projects, including dynamic workflow references, must be inventoried against actual Published graph. This sample is not exhaustive.
- GitHub repository main/default search did not return definitive live Render/Cloudflare caller contracts; absence of search results **does not** mean no callers.
- Render: connector requires user to select a workspace; none was selected, so service caller audit **BLOCKED**, not bypassed.
- Cloudflare deployed Workers/Pages bindings and current deployed commit, including API endpoint references, remain **NOT VERIFIED**.
- Supabase: hosted `public.save_merchant_product` SECURITY DEFINER is authenticated/tenant-scoped; Store isolation is absent. `qa_shop_b_zalo_claim` and `qa_owner_pairing` require separate privileged caller review (V19.8.16).
- Any hosted change must include accurate credential ID mapping (IDs only), actual deployed commit/version, exact SQL function dependencies, signed auth/owner Store links, customer data backup and restore evidence.
- **Never use** only phone + order_id to prove cross-channel customer identity; dual opt-in and server-authoritative linkage are required.
- No changes to current published workflow, data tables, credentials, webhook, payment or database were performed.

## Release decision
`PUBLISHED_WRITER_PARTIAL_AUDIT_VERIFIED / FULL_CALLER_CLOSURE_BLOCKED / LEGACY_COMPAT_LANE_UNCHANGED / STORE_COMMERCE_NO_GO`.

**Rollback:** no live changes. This document and local QA code can be reverted by closing Draft PR.
