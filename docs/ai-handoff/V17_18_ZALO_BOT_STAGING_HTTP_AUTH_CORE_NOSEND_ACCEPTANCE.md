# TIEN404 V17.18 — Zalo Bot staging ingress HTTP authentication × Core shadow NO-SEND acceptance

**Date:** 2026-11-17 JST. **Verdict:** `PASS_STAGING_PROTECTED_ZALO_BOT_HTTP_NO_SEND`; **NOT** live Zalo provider-origin proof, Zalo OA ownership, real merchant Store or public customer-facing send acceptance.

## 1. Current baseline verified

- **Zalo Bot staging Published** `TIEN404_ZALO_BOT_LAB_V1_STAGING`, workflow `yIJk8LvJoLF40Z62`, unchanged Published version `776486b2-092f-49ec-a7c4-f74ec8b60f07` (active).
- Existing n8n webhook `POST /webhook/tien404-zalo-bot-lab-v1` configured for **headerAuth**, response ACK `{ok:true}` (no provider message), private-text normalization, owner allowlist, sanitized staging QA upsert, V12.3 private customer router and V17.15 internal Core shadow.
- **Shared Zalo/Web private Core shadow** `4ycmVzaNzVRulBjQ` remains Published `76bbb4e9-7ad2-45a6-8188-260523ced57a`, unchanged; sends only four technical fields, no customer text, to central Core as intentionally **unbound** installation.
- **Core** `iyfGUiEsZlNTBWOR` preserved. Zalo Bot staging (Bot Creator-like protected header) is distinct from **merchant Zalo Official Account**, which is **NOT installed/approved** for this flow.
- Zalo workflow has `saveDataSuccessExecution='none'`, `saveDataErrorExecution='none'`, and `saveManualExecutions=false`. Therefore absent entries in n8n execution search are not proof of no webhook receipt; use sanitized Data Table QA markers, independent HTTP probe and Core shadow execution evidence.

## 2. What was tested and the actual outputs

| Check | Actual n8n execution | Verified result |
| --- | --- | --- |
| Native-format fixture protocol and trusted QA routing | **#4971 SUCCESS** | **18/18**: 3 ALLOW, 14 DENY, 1 DUPLICATE; includes synthetic Zalo Bot correct/wrong header and unbound route, Zalo OA unverified DENY; provider send 0, Orders written 0, model calls 0 |
| Shared Zalo Bot/Website unbound Core bridge manual no-send | **#4972 SUCCESS** | **2/2 denied** by actual central Core; no customer text, provider send, model or Commerce writes |
| Authenticated synthetic HTTP POST to existing protected n8n webhook | **#4977 SUCCESS** (2026-11-17 ~16:20 JST) | Actual HTTP **200**; existing staging header-auth credential accepted, no real Zalo provider event or send |
| Existing PII-free markers after authenticated POST | Data Table `TIEN404_QA_SHOP_B_PAIRING_TRACE` | `v1_ingress_any=ACCEPTED`, `inbound=other_text`, `owner_gate=denied` at `2026-11-17T07:20:56Z`, no PII/PSID/body/chat ID retained in report |
| Post-auth Zalo source→shared Core shadow | **#4981 SUCCESS → central Core #4982 SUCCESS** | Input `channelType:zalo_bot`, `source:protected_bot_header`, `authorityStatus:STAGING_NOT_OA`, no customer fields; Core intentionally DENY `unregistered_or_disabled_channel`, no Catalog, model or writes |
| Independent staging gateway webhook diagnostics | **#4984 SUCCESS** | `has_webhook:true`, `matches_staging_webhook:true`, `matches_test_webhook:false`; host `ngoctien20.app.n8n.cloud`, path `/webhook/tien404-zalo-bot-lab-v1`. `external_sends:0`, `configuration_changes:0` |
| First unauthenticated negative harness draft | **#4985 ERROR** | n8n HTTP Request attempted to parse plain-text/HTML HTTP 403 error as JSON; **test harness parsing issue**, not evidence of webhook acceptance. Corrected *inactive QA* parser to read response text. |
| **Bounded authenticated vs no-authenticated HTTP acceptance** | **#4992 SUCCESS** (2026-11-17 ~16:25 JST) | Same harmless synthetic test event: authenticated POST **HTTP 200**, no-credential POST **HTTP 403**; independent assertion `ZALO_V1_REAL_HTTP_HEADER_NEGATIVE_DENY_PASS`; provider sends 0 / order writes 0 / model calls 0 |
| Owner/Central Core after second successful authorized probe | PII-free markers + **#4996 SUCCESS → #4997 SUCCESS** | `owner_gate=denied` for synthetic nonowner, one technical Core shadow, no model/catalog/Commerce writer or provider message |

**Actual provider-signed live Zalo event:** NOT OBSERVED/INDEPENDENTLY VERIFIED IN THIS ACCEPTANCE. HTTP probes use an existing stored staging credential and known synthetic body. Success of header-auth n8n webhook does not prove Zalo provider installation ownership or Zalo OA callback authenticity.

## 3. Scope of QA-only changes

- Existing **inactive, manual-only** HTTP probe workflow `RnbsXSriPcythZjq` was extended from three to five nodes (two additions and two connections): existing positive authenticated POST + **negative POST without header auth** + strict assertion that HTTP status is 401/403 and positive control was 200.
- On first negative execution #4985, HTTP 403 body was not valid JSON, producing an expected parser issue. Fixed only the negative probe's `responseFormat` from JSON to Text and reran #4992 PASS. Current **INACTIVE draft** version `d4d117da-866d-4a36-b9e2-881d4b4ef53f`; previous QA-only version `bed2b408-e4ed-4dc0-a775-d9e58bfdb02c`.
- The original Published Zalo Bot, central Core, shared bridge and provider credentials were **not changed**. Existing QA PII-free marker upserts occurred as a known effect of positive synthetic webhook requests. No customer data, product stock, subscriptions, real Orders or payment changes were made. No additional model cost in QA paths.

## 4. Security boundaries and residual risks

**VERIFIED** for synthetic staging: HTTP headerAuth positive 200 / missing authorization 403, native-shaped fixture denial tests, owner gate denies unrecognized synthetic chat ID, technical no-PII Core shadow fails closed, no new provider sender in tested path, registered webhook target matches staging gateway.

**NOT VERIFIED:** real Zalo Bot client-to-webhook event on this version, exact transport/provenance from Zalo vendor; native Zalo OA app/owner proof and provider signature; customer reply delivery (all outbound disabled); real Store ownership in hosted DB, Store-RLS, merchant-approved product catalog; robust distributed replay/idempotency for Zalo provider events; Bot-vs-OA installation allowlists; actual verified human handoff. Legacy staging V2 workflow contains a separate **specific pairing command** that can call staging Supabase RPC; synthetic test text does not trigger that branch. Do not promote this QA as all workflows being globally read-only.

## 5. Next safe real provider ingress UAT

To collect a real Zalo Bot event without enabling sending or changing credentials:
1. Owner opens the **existing Zalo Bot staging conversation**, not Zalo OA.
2. Sends exactly `TIEN404 EXT 03` once. This is an existing staging read-only probe command.
3. Read only PII-free markers `v123_ext03_ingress` and `v123_ext03_customer` after owner confirms, noting times and whether owner route was eligible. Do not expect an automated Zalo reply; this Bot currently only ACKs webhook.
4. Only then claim `REAL_ZALO_BOT_PROVIDER_INGRESS_ACCEPTED` if independent provider-origin/credential and marker evidence correlate. Marker alone still cannot prove provider's true origin or native OA ownership.

**Release gate:** `GO_PROTECTED_ZALO_BOT_STAGING_HTTP_QA_NO_SEND` only. `NO_GO_ZALO_OA_COMMERCE_OR_CUSTOMER_REPLY`.

## 6. Rollback / checkpoint

- For negative manual QA regression, restore `RnbsXSriPcythZjq` draft version `bed2b408-e4ed-4dc0-a775-d9e58bfdb02c` (original three nodes); no production rollback required.
- Zalo Bot Published version `776486b2-092f-49ec-a7c4-f74ec8b60f07` and shared Bridge Published `76bbb4e9-7ad2-45a6-8188-260523ced57a` unchanged.
- Preserve separate DEMO and Commerce stores/credentials, do not publish merchant Zalo OA/Store integration or enable Zalo sends/Orders without separately approved gates and direct provider evidence.
- GitHub PR #243 stays **DRAFT**, unmerged.
