# TIEN404 V17.19R — Real Zalo Customer EXT03 → Customer Router acceptance + Core shadow DENY

**Date:** 2026-11-17 JST, real user-confirmed non-owner Zalo Bot staging test. **Verdict:** `PASS_REAL_NON_OWNER_ZALO_BOT_EXT03_CUSTOMER_ROUTE_STAGING`; `PASS_ZALO_TO_CENTRAL_CORE_SHADOW_NO_SEND`. Not a native Zalo Official Account/merchant-store rollout.

## Published baseline and previous checkpoint

- Zalo Bot staging workflow `yIJk8LvJoLF40Z62` Published version **`2d912cb0-007f-452f-9536-b92ba12a03e6`**, active; new V17.19 PII-free marker logic was already Published before this test.
- Customer Router V12.3 `sIPs6egzIwOY1GNv`, Published **`8d91d23c-cd87-462f-a112-9cca2340bec8`**, unchanged.
- Shared Zalo/Web Core shadow `4ycmVzaNzVRulBjQ`, Published **`76bbb4e9-7ad2-45a6-8188-260523ced57a`**, unchanged.
- The prior owner's actual EXT03 event (V17.18R, `2026-11-17T07:29:21.514Z`) yielded `owner_gate=eligible` and `v123_ext03_customer=NOT_ACCEPTED_BY_CUSTOMER_ROUTER` due to intentional `OWNER_ROUTE_SEPARATE`. Prior owner event predates the new `v123_ext03_route` marker.
- No new workflow/credential/Owner allowlist/product/order/subscription changes were made for this follow-up; all checks read-only. The existing Bot staging workflow intentionally does NOT persist success/error executions, so correlate marker and independent integrated shadow.

## Actual new non-owner Zalo Customer event

User reported **“Đã gửi Zalo Customer”**. Immediately thereafter the existing n8n PII-free marker table `TIEN404_QA_SHOP_B_PAIRING_TRACE` (`e7eJAGSwzn67aA1z`) showed these fresh records from **2026-11-17T09:41:19–09:41:20Z** (18:41:19–18:41:20 JST):

| Marker slot | Outcome | observed_at UTC |
| --- | --- | --- |
| `v123_ext03_ingress` | **`SEEN_AUTHENTICATED_WEBHOOK`** | `2026-11-17T09:41:19.425Z` |
| `v123_ext03_customer` | **`CUSTOMER_ROUTE_ELIGIBLE`** | `2026-11-17T09:41:19.425Z` |
| **New** `v123_ext03_route` | **`CUSTOMER_ROUTE_ELIGIBLE`** | `2026-11-17T09:41:19.425Z` |
| `owner_gate` | **`denied`** (correct for an unregistered non-owner) | `2026-11-17T09:41:20.449Z` |
| `inbound` | `other_text` | `2026-11-17T09:41:20.596Z` |
| `v1_ingress_any` | `ACCEPTED` | `2026-11-17T09:41:20.790Z` |

The `CUSTOMER_ROUTE_ELIGIBLE` marker is emitted only if V12.3 returned `status=PUBLIC_CUSTOMER_EVENT_ACCEPTED`, `route=CUSTOMER`, `qa_ext03_match=true`, `external_sends=0`, and `orders_written=0`. This is stronger than an ingress-only marker; it attests actual customer routing through the existing trusted QA Bot binding. `owner_gate=denied` means the event was **not recognized as an Owner in the current staging allowlist** and is an **expected pass**, not blocked webhook or broken authorization.

Caveat: raw per-event V12.3 workflow execution output is not saved; the result is verified through the live downstream PII-free markers and their known Code-node condition, not through a separate retained raw Customer Router execution. No customer message body, chat ID, PSID, phone, or secret was included in this report.

## Real Zalo Bot event → central Commerce Core fail-closed

- Real technical bridge **#5014 SUCCESS**, `2026-11-17T09:41:20.985Z`: input consists of exactly `channelType=zalo_bot`, `source=protected_bot_header`, `authorityStatus=STAGING_NOT_OA`, `fixtureOnly=false`. The bridge immediately sanitized to technical-only scope; **no actual customer text or identifier forwarded**.
- Bridge `admittedTechnicalShape=true` and output **`V1715_ZALO_AND_WEBSITE_CENTRAL_CORE_SHADOW_DENIED`**, `total=1`, `denied=1`, `provider_sends=0`, `commerce_writes=0`, `stock_writes=0`, `model_calls=0`, `customer_text_forwarded=false`, `can_live_consult=false`.
- Actual nested Core **#5015 SUCCESS**, `2026-11-17T09:41:21.113Z`: the `Reject Unknown Shop` path denied `unregistered_or_disabled_channel`, `canSend=false`, `canWrite=false`, **no Catalog or AI model** invoked.
- This shows **the customer is recognized by V12.3's synthetic staging customer router** while **central Core still independently blocks unregistered OA/Store-bound commercial consultation**. Do not interpret this as the customer having been enrolled in real Commerce Store or being answered in Zalo.

## Acceptance decisions and remaining gates

| Gate | Decision |
| --- | --- |
| User-confirmed real Zalo Bot staging message correlated to new PII-free ingress | **VERIFIED** |
| Non-owner recognized as CUSTOMER, Owner Gate correctly excludes non-owner | **PASS** |
| New V17.19 `v123_ext03_route` emitted correctly in the next real event | **PASS** |
| Owner-vs-Customer isolation across two separate historical real events | **PASS** (different events; no same-user identity claim) |
| No additional Zalo reply, catalog access, model call, order/stock writes in Core shadow | **PASS** |
| Direct independent Zalo provider-origin signature/installation attestation | **NOT VERIFIED** (header Auth and correlation only) |
| Zalo Official Account merchant authorization / hosted Store RLS / genuine product catalog | **NO-GO** |
| Customer-facing Zalo bot reply to real customer | **NOT ENABLED / NOT TESTED** |
| Distributed replay, spoof prevention beyond header credential | **PENDING** |

**Safety:** no workflow edits, Data Table write operations by assistant, provider sends, credentials changes, customer data or commercial transactions in this turn. The Bot's normal PII-free marker writes are designed in the existing workflow. No need for user to resend EXT03.

**Rollback:** Zalo Bot V17.19 new marker logic is still intact in Published `2d912cb0-007f-452f-9536-b92ba12a03e6`. Prior Published `776486b2-092f-49ec-a7c4-f74ec8b60f07` remains the telemetry-only rollback if new marker introduces regression. PR #243 remains DRAFT, unmerged.

**Next recommended work:** separate V17.20 signed real Zalo Bot provider ingress proof/replay hardening and Zalo OA owner authorization with no-send pilot. First verify any pending prior concurrent changes, then stage with independent QA; do not activate Zalo OA/customer sending or production Commerce writes without scoped owner approval.
