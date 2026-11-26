# TIEN404 V17.18R — Owner's real Zalo Bot EXT03 ingress / owner-route isolation UAT

**Date:** 2026-11-17 JST. **Owner action:** Sent `TIEN404 EXT 03` in the existing Zalo Bot staging conversation. No request to resend.

## Fresh observed evidence (PII-free)

- Zalo V1 PUBLISHED workflow `yIJk8LvJoLF40Z62` remains active, published `776486b2-092f-49ec-a7c4-f74ec8b60f07`; success/error executions are NOT retained by its workflow settings. The absence of a workflow execution row is expected and is NOT an absence-of-event finding.
- n8n staging Data Table `TIEN404_QA_SHOP_B_PAIRING_TRACE` (`e7eJAGSwzn67aA1z`) was read after the owner reported sending the message:
  - `v123_ext03_ingress = SEEN_AUTHENTICATED_WEBHOOK`, `observed_at = 2026-11-17T07:29:21.514Z` = **16:29:21 JST**.
  - `v123_ext03_customer = NOT_ACCEPTED_BY_CUSTOMER_ROUTER`, same event timestamp.
  - `owner_gate = eligible`, `observed_at = 07:29:21.943Z`.
  - `v1_ingress_any = ACCEPTED`, `observed_at = 07:29:22.185Z`.
  - `inbound = other_text`, `observed_at = 07:29:22.043Z`.
- These markers retain only slot/outcome/time, no chat ID, provider message ID, phone number, customer input, secret, or sender identifier. Event timing and exact command are correlated with owner confirmation. Because n8n uses stored header credential and does not independently expose signed provider callback origin in these logs, **independent vendor-origin cryptographic proof remains pending**; the correlation is strong operational ingress evidence, not formal Zalo OA authentication.

## Owner-route vs Customer-route diagnosis

- The independently read `TIEN404_ZALO_V2_SHADOW_STAGING` Owner Gate has one active allowlist row (not expired on 17 Nov) and recorded `owner_gate=eligible` for this incoming event.
- The `TIEN404_ZALO_V123_PRIVATE_CUSTOMER_ROUTER_STAGING` (`sIPs6egzIwOY1GNv`) reads the same owner allowlist, plus a synthetic bot registry. The registry contains exactly one matching `bot_provider=zalo_bot_fixture, bot_id=b, webhook_route_ref=route-b, enabled_mode=dry_run, identity_status=synthetic_qa` staging binding. **Code ordering:** valid event/bot check then `else if(owner) {status='OWNER_ROUTE_SEPARATE'; route='OWNER'; reason='owner_isolation';}` before any customer EXT03 acceptance.
- The **V1 marker logic** in `Build EXT03 Sanitized Markers V12.3` labels customer accepted only if `result.status==='PUBLIC_CUSTOMER_EVENT_ACCEPTED' && result.route==='CUSTOMER' && result.qa_ext03_match===true && zero sends/writes`. Therefore an OWNER `TIEN404 EXT 03` is marked `NOT_ACCEPTED_BY_CUSTOMER_ROUTER` **by design** even though Owner Gate accepts owner. Do not remove owner isolation to make the marker green. Because V12.3 success executions are not saved, the exact per-event V12.3 output `OWNER_ROUTE_SEPARATE` cannot be directly read back; it is a strong inference from code + fresh active allowlist and owner-gate marker, not direct runtime proof.
- This is a **QA criteria/telemetry-label discrepancy** (the one EXT03 marker assumes non-owner customer) rather than evidence of failed header auth or Store leak. Proposed separate safe marker `EXT03_OWNER_ROUTE_SEPARATE` in future version, tested in a candidate first; no change executed in this UAT.

## Core Shadow real post-event evidence

- The real incoming event triggered the existing Zalo-to-Core shared technical shadow **execution #5002 SUCCESS** at `2026-11-17T07:29:22.386Z`: technical `channelType:zalo_bot`, `source:protected_bot_header`, `authorityStatus:STAGING_NOT_OA`, `fixtureOnly:false`; `admittedTechnicalShape:true`, no raw customer text or customer identity forwarded.
- Actual nested central Commerce Core **execution #5003 SUCCESS** at `2026-11-17T07:29:22.499Z`: `Reject Unknown Shop`, `reason=unregistered_or_disabled_channel`, `canSend:false`, `canWrite:false`, **no Catalog or model invoked**.
- Shared bridge result `V1715_ZALO_AND_WEBSITE_CENTRAL_CORE_SHADOW_DENIED`, `total=1`, `denied=1`, `provider_sends=0`, `commerce_writes=0`, `stock_writes=0`, `model_calls=0`, `customer_text_forwarded=false`.
- Existing Published Zalo bot only ACKs the protected webhook; no outbound Zalo message node on this path. No orders, payments, stock modifications or cost-bearing model requests for this acceptance.

## Verdict and safe next gates

| Gate | Evidence | Status |
| --- | --- | --- |
| Owner sent staging Zalo Bot command and authenticated callback produced fresh PII-free marker | Fresh EXT03 marker 07:29:21Z | **VERIFIED operational ingress** |
| Owner recognized by staging allowlist | `owner_gate=eligible`, active owner allowlist | **VERIFIED** |
| Customer Router should accept OWNER as CUSTOMER | Deliberately separate `OWNER_ROUTE_SEPARATE` policy | **NOT a valid acceptance goal** |
| Owner's EXT03 accepted by Customer Router | `NOT_ACCEPTED_BY_CUSTOMER_ROUTER` marker | **NO**, expected for owner |
| Zalo technical shadow to shared Core | #5002 → #5003, fail-closed, no send/writes | **PASS** |
| Real Zalo OA merchant installation/provider signature | No authenticated OA evidence | **BLOCKED** |
| Customer route via a different non-owner consented testing account | Not run | **PENDING** |
| Merchant commercial bot replies/order/stock | No real Store RLS/owner/catalog authorization | **NO-GO** |

**Next:** Do not ask owner to resend `TIEN404 EXT 03` from the same owner account. If a **customer-route** UAT is desired, use a separately consented **non-owner** Zalo Bot test account, never change the Owner allowlist to simulate a customer. Future QA instrumentation should explicitly distinguish Owner separation from failed authentication; this requires separate candidate QA before a staging Published change.

**Rollback / change scope:** Purely read-only queries plus a new GitHub checkpoint; **no n8n workflow, Owner allowlist, vendor credentials, Store data or channel routing changed**. Existing V17.18 manual HTTP QA is still inactive. Prior V17.18 staging header-authenticated 200 vs unauthenticated 403 evidence remains valid. PR #243 remains DRAFT.
