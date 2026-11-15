# TIEN404 AI — Zalo Bot Shop B V13.5 Rich Text QA checkpoint

**Date:** 2026-11-15 JST. **Environment:** Cloudflare Worker staging + n8n QA personal project only. **Status:** IMPLEMENTED / TESTED provider API ACK; **NOT TESTED client-side appearance**. **Production Sales Core/Orders untouched.**

## Identity clarification

- `Owner QA Shop B` is the authorized Shop B *merchant owner notification recipient* paired in staging on 14/11/2026 at 20:23:15 JST and valid to 21/11/2026. Not the platform super-admin role.
- The outside participant/friend that submitted `EXT03` is an **external customer QA actor**, not the Shop B owner. Never send owner-only tests to that external chat ID.
- No chat ID, recipient identity, or Bot token is committed to GitHub or reproduced in this report.

## Owner approval

- Explicitly approved construction/deployment of a dedicated protected staging QA route and maximum **3** one-shot T1/T2/T3 sends to the previously verified Shop B Owner QA; global `ZALO_SEND_ENABLED=false` must remain unchanged.
- No authority to publish production, open general messaging, change credentials, grant RLS rights, or write customer Orders.

## Old gateway audit and checkpoint

- Cloudflare Worker: `tien404-zalo-outbound-v1-staging`.
- Prior live version: `ef7b7a33-5551-48e0-954b-646c047b5c6d`, deployment `94d1e305-82e1-4e26-96c4-1c287463e95b`.
- Source SHA256 BEFORE: `cf755a31f2db480a555dc400bdad9e4bd9a3ec184d19348f38668b974786c440`.
- Source SHA256 new: `6471458ca4a0e52bf405744fd6af6ae99694a88531c739ea48c09adbcab89dc1`.
- Source version 24: `21b0580c-a76d-4331-bacf-d959e289da6d` uploaded via version API **with inherited existing secret_text/plain_text/d1 bindings**.
- Staging deployment: `912a5946-719b-434c-9802-fecd532125c6`, 100% version 24.
- Existing Worker general `/v1/send` branch continues returning 423 and `ZALO_SEND_ENABLED=false` verified after deployment and after sends.
- D1 `outbound_claims`: PRIMARY KEY on idempotency_key. New route uses fixed per-case claims T1/T2/T3. No schema migrations.
- New staging-only endpoints: `POST /v1/qa-richtext/preflight` (Bot getMe + server-side Shop B chat ID match + claim availability) and `POST /v1/qa-richtext/send` (fixed T1–T3 content only, no caller-defined text, credentials required).
- Authorization: existing gateway bearer credential with constant-time comparison, exact server-side recipient equality with secret binding, existing approval expiry, hard absolute expiry 2026-11-15 10:00 UTC (19:00 JST), global send must remain disabled, D1 claim before possible send, no automatic retry; unused cases rejected. No token rotation.

## n8n QA workflows

Folder: Personal / `90_QA - DIAGNOSTICS`.

1. Preflight-only workflow `kRJQAll005V21o5H`, `TIEN404_ZALO_V135_SHOP_B_RICHTEXT_PREFLIGHT_STAGING`. Reuses existing `TIEN404_ZALO_OUTBOUND_GATEWAY_AUTH_V1` credential; no new credentials. Manual execution `3819` SUCCESS: HTTP 200, owner_verified, bot_verified, global_send_enabled false, external_sends 0, claims empty. Execution `3822` SUCCESS after send: already_claimed = [T1,T2,T3], remaining 0, 0 sends on preflight.
2. Controlled sender `qWMu4n1wLkTZBNpI`, `TIEN404_ZALO_V135_SHOP_B_RICHTEXT_T1_T2_T3_ONCE_STAGING`: manual only, existing allowlist table, guarded unique approved owner, preflight and sequential T1→verify→T2→verify→T3→verify. No automatic retry. Simulated pin QA execution `3820` SUCCESS with **fake** chat ID and mocked HTTP responses; no real send.
3. Real execution **`3821`** at 2026-11-15 06:35:35 UTC (15:35 JST): SUCCESS at 06:35:45 UTC. Each T1/T2/T3 response **HTTP 200, result API_ACCEPTED, provider_message_id present, external_send_attempts=1, orders_written=0, retry_allowed=false**.
4. After real execution, **all three HTTP sending nodes explicitly disabled** in workflow `qWMu4n1wLkTZBNpI`; saveManualExecutions=false and execution-data retention none for future runs. Existing evidence for `3821` preserved in n8n history. No further sends allowed without new approval.

## QA fixtures tested with Zalo API

| Case | Payload | Status | Claim |
|---|---|---|---|
| T1 | Plain numbered menu text (no native buttons) | API_ACCEPTED | consumed |
| T2 | text_styles bold, 18px, green + italic emoji | API_ACCEPTED | consumed |
| T3 | parse_mode=markdown, bold/list/green | API_ACCEPTED | consumed |

D1 readback after send confirmed exactly 3 claim keys with status `API_ACCEPTED`. SDK source tested by GitHub Actions before deploy. The provider accepted each send; subsequent user-supplied **Zalo desktop screenshot** confirms T1/T2/T3 rendered as described in the visual QA section below. Zalo mobile and precise CSS-like font sizing are still unverified.

## GitHub and CI

- Parent QA PR #76: https://github.com/ngoctien20/demo-git/pull/76
- Separate Deploy/QA Draft PR #77: https://github.com/ngoctien20/demo-git/pull/77
- Source: `qa/zalo-control-text/worker-qa-richtext-route.mjs` + 16 negative unit cases + versioned n8n SDK preflight/sender workflows.
- GitHub Actions run `43685371225`: security-gates SUCCESS. No merge to `gh-pages`.
- n8n manual Menu smoke execution `3813`: 16/16 PASS (prior independent no-send QA).

## Remaining gates, rollback and limits

- **BLOCKED / UNVERIFIED:** Zalo mobile rendering, exact pixel font size, native Zalo buttons/quick replies/callback (API not confirmed), customer-to-bot reply end-to-end after selecting 1/2/3. Zalo desktop actual rendering was separately visually verified from Owner-provided screenshot.
- Legacy Cloudflare general send kill switch preserved OFF. New QA send gate is exhausted and expires 2026-11-15 10:00Z.
- Restore prior Worker deployment version `ef7b7a33-5551-48e0-954b-646c047b5c6d` via authorized Cloudflare Worker deployment if immediate rollback is required. Do not blindly reset secret bindings and **do not replay sent messages**.
- Never delete D1 claims or re-enable T1/T2/T3 to repeat tests without separate explicit approval.
- No customer Orders/Products, credential changes, Zalo webhook, Billing, or production deployments.

**Status:** LIVE PROVIDER API TEST PASSED 3/3; ZALO DESKTOP VISUAL QA PASSED 3/3 (from Owner-provided screenshot); mobile/interactive controls NOT VERIFIED; send permission EXHAUSTED.

## Additional verified visual QA — Owner-provided Zalo desktop screenshot (2026-11-15 JST)

An image of the authenticated conversation with **Bot TIEN404 AI**, provided by the project Owner in ChatGPT shortly after execution `3821`, visibly shows all **three** QA messages T1/T2/T3 in the same chat, with timestamp **15:35 JST**.

- **T1 / MENU QA — VERIFIED DISPLAY:** multiline plain text with choices `1. Xem sản phẩm`, `2. Hỏi giá`, `3. Yêu cầu mua hàng`; also `Tin kiểm thử, không tạo đơn.`. These are text instructions, **not native tappable buttons**; no response to numbered selections tested.
- **T2 / RICH TEXT QA — VERIFIED DISPLAY:** prefix `TIEN404` displayed in green bold, subsequent phrase `Chữ nghiêng và emoji 🛒` displayed italic and emoji rendered, final explanatory line displayed. Actual **18px exact font metrics cannot be proven** from screenshot; confirm only visible visual differentiation.
- **T3 / MARKDOWN QA — VERIFIED DISPLAY:** `TIEN404` visibly bold; `Chữ nghiêng` italic; two items rendered as bullet list; `Chữ xanh` green; no raw Markdown artifacts shown in screenshot. The gaps around bullet list and colored text are relatively large; improve copy compactness before commercialization.
- Platform visibility scope: **Zalo desktop app**. No separate Zalo mobile screenshot, screen-reader rendering or phone-native button actions have been tested.
- **Privacy:** screenshot remains in the private conversation, not committed to public GitHub, and no Zalo chat ID, account phone number, user identifier, message ID or token is recorded in this checkpoint.

**Acceptance:** T1/T2/T3 visual desktop content match = 3/3 PASS, native interactive controls = UNKNOWN, mobile = PENDING. This is a user-provided visual observation, not an automated Zalo UI test. There are no additional sends and no modifications to published webhook or Sales Core.
