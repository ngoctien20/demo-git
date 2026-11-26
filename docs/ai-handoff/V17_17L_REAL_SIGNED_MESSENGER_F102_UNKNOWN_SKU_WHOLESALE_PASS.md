# TIEN404 V17.17L — Real signed Messenger three-message V17.17 Core intent UAT

**Date:** 2026-11-17 JST (native events 16:08–16:09 JST). **Verdict:** `PASS_REAL_SIGNED_V1717_MESSENGER_INTENT_ADVISOR_3_OF_3` for limited **sample-only read-only** `QA_CORE:` pilot; merchant Store and Zalo OA/Website commerce **NO-GO**.

## Current verified PUBLISHED versions
- Messenger `TIEN404_MESSENGER_TEST` ID `Z7FdV7uDvApfbURQ`: `1064b1b3-d3f1-4a6b-a367-2414ba691522` PUBLISHED.
- Central Commerce Core `TIEN404_COMMERCE_AI_AGENT_SANDBOX` ID `iyfGUiEsZlNTBWOR`: `456862c9-e5ee-4bfa-9931-47dbc39ab73d` PUBLISHED.
- Existing signed Messenger fail-closed shadow `dw1JOxWOEY8csTnm`: unchanged.
- Zalo Bot staging and Website marketing were NOT changed in this acceptance. No Merchant OA/domain authority inferred.

## Actual live signed webhook and customer-facing reply evidence

| Event | Messenger webhook execution | Date JST | Sanitized Core input | Actual Core execution | Observed response |
| --- | --- | --- | --- | --- | --- |
| F-102 sample lookup | **#4951** SUCCESS, 3695ms | 2026-11-17 **16:08:29** | `QA_CORE: F-102` | **#4952** SUCCESS | `F-102 — Áo sơ mi slimfit (MẪU): 289.000đ (giá mẫu)`, explicit demo disclaimer |
| Cross-store SKU `VL-101` | **#4959** SUCCESS, 3499ms | 2026-11-17 **16:09:03** | `QA_CORE: __T404_UNKNOWN_SKU__` | **#4960** SUCCESS | `Không tìm thấy mã sản phẩm đó trong danh mục DEMO của Page này. Không lấy sản phẩm từ cửa hàng khác.` |
| Wholesale policy inquiry | **#4965** SUCCESS, 3102ms | 2026-11-17 **16:09:46** | `QA_CORE: __T404_WHOLESALE__` | **#4966** SUCCESS | `Chưa có bảng giá sỉ hoặc điều kiện đại lý được chủ shop phê duyệt; không tự báo giá sỉ.` |

For EACH of #4951/#4959/#4965:
- Actual Messenger Webhook event; raw Meta HMAC `Verify Signature Timing-Safe` result `verified:true`.
- `V17.15 Route QA_CORE Only?` → `V17.15 Strip PII and Normalize Demo Query` forwarded **synthetic sender `V1717_DEMO_TECH_ONLY`**, never raw sender/customer text, to Central Core.
- `V17.15 Call Actual Commerce Core Read-Only` and `V17.15 Assert Demo Reply Safe to Send` succeeded.
- Exactly **ONE** execution of `Send Messenger Reply - CONFIGURE TOKEN`, Meta returned a nonempty message ID; `Verify Messenger Send Result` and `Record Successful Messenger MID` succeeded. Does NOT independently prove actual client-device delivery.
- `Messenger AI Agent`, legacy `create_order`, `manage_order`, `update_order_address` **did not run for these three `QA_CORE:` messages**. Existing other nonprefixed Messenger messages still use the DEMO Agent with its preexisting Order writer, which V17.17 did not remove.
- One V17.13 shadow path also ran for each event, but no secondary Send Reply node was invoked.

Central Core #4952/#4960/#4966 all returned `success:true`, `tenantId:'demo_tien404'`, `environment:'sandbox'`, `demoOnly:true`, `canSend:false`, `canWrite:false`, `live:false`. Each reply displayed `[TIEN404 CORE — DEMO CHỈ ĐỌC]` and clear sample data warnings.

## Verified no unnecessary Catalog reads in these three LIVE events

- Core #4952 **did** invoke `V17.15 Query Existing Commerce Catalog`, with integrated catalog execution **#4954** SUCCESS, only for real SKU F-102.
- Core #4960 cross-shop unknown SKU **did NOT invoke Catalog**, returned policy source `demo_unknown_sku`.
- Core #4966 wholesale inquiry **did NOT invoke Catalog**, returned policy source `demo_wholesale_unverified`.
- Exactly **one** integrated `TIEN404_COMMERCE_CATALOG_QUERY` execution was found in the bounded 07:07–07:11 UTC window, matching the F-102 event. This demonstrates efficient per-intent routing for this 3-message live sample, NOT general latency/cost performance certification.

## Independent signed shadow no-send evidence

- Messenger #4951 → signed private shadow **#4956** SUCCESS → central Core **#4957** SUCCESS DENY.
- Messenger #4959 → signed private shadow **#4962** SUCCESS → central Core **#4963** SUCCESS DENY.
- Messenger #4965 → signed private shadow **#4968** SUCCESS → central Core **#4969** SUCCESS DENY.
- In each shadow: `V1713_SIGNED_PATH_SHADOW_CORE_DENY_PASS`, `provider_sends:0`, `commerce_writes:0`, `model_calls:0`; associated Core deny reason `unregistered_or_disabled_channel`, no Catalog or model use.

## Evidence and release gates

**VERIFIED / TESTED:** Actual V17.17 signed Meta QA intent routing (3/3), sample F-102 price, no cross-tenant SKU disclosure, no fabricated wholesale policy, exact one Meta accepted send per event, no legacy order writer invocation for these three opted-in messages, one catalog query out of three provider events, shadow fail-closed.

**NOT VERIFIED:** Message successfully rendered on customer's own device (API acceptance only); distributed concurrent replay security; real merchant Store and owner proof; Zalo native OA installation or outbound message; authorized merchant Website signed session; Store-qualified hosted Supabase RLS and merchant-approved live Products/Prices/Stock; full Messenger Page-wide read-only policy. No permission to enable Commerce order creation/stock/payment.

**Rollback:** Messenger previous published `2b869035-fe39-46fb-a253-18fefe4ecbfd` and Core previous `b08f806b-25dc-40d4-9e82-212307ce19b9`, coordinated only if current V17.17 regressions are found; do not undo successful live acceptance or send duplicate provider messages.

**Action:** Preserve current Published versions; no need to ask owner to resend these 3 messages. Next priority: independent native Zalo Bot staging no-send acceptance, approved Zalo OA installation and merchant Website signed session / actual hosted Store RLS. PR #243 remains DRAFT, not production merchant release.
