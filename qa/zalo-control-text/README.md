# TIEN404 V13.5 — Zalo Bot Controls & Rich Text capability QA (2026-11-15 JST)

## Scope and separation

This branch tests Zalo **Bot Creator** (not Zalo OA or ZBS), as an isolated offline R&D QA exercise. The product is **multi-channel AI sales SaaS**, not a standalone Zalo bot service. AI Studio remains future scope. Do not merge into production or attach to published n8n webhooks.

## Official API evidence

Zalo official Bot API reference: https://docs.zaloplatforms.com/docs/BOT/apis/sendMessage

- POST `/bot{BOT_TOKEN}/sendMessage`, body requires `chat_id` and `text` (1–2000 code units/characters as documented).
- `parse_mode`: `markdown` or `html` with limited markup.
- `text_styles`: array of `{start, len, st: [codes]}`; `start` and `len` count UTF-16 code units. Color palette and font sizes are fixed.
- Fixed style codes: `b,i,u,s,f_13,f_15,f_18,f_20,c_050a19,c_15a85f,c_f7b503,c_f27806,c_db342e,lst_1,lst_2,ind_1..ind_5`.
- `parse_mode` takes priority if both are provided; use one only.
- Official high-level overview mentions buttons, quick replies and carousel, but the specific `sendMessage` API parameters shown are only `chat_id,text,parse_mode,text_styles`. There is NO verified Bot Creator keyboard/reply_markup/callback schema in this audit. Treat native interactive buttons as **UNKNOWN**, never fabricate or reuse OA payloads.
- `sendPhoto` supports `chat_id,photo,caption`, and `sendChatAction` supports `typing` (distinct API; not a generic custom button).

## Actual connected n8n state (read-only verified)

- `TIEN404_ZALO_BOT_LAB_V1_STAGING`, workflow `yIJk8LvJoLF40Z62`, active with protected header webhook. It ACKs without sending; do not modify.
- `TIEN404_ZALO_V123_PRIVATE_CUSTOMER_ROUTER_STAGING`, workflow `sIPs6egzIwOY1GNv`, active and read-only. Do not modify.
- `TIEN404_SALES_LITE_V11_MENU_SMOKE_QA_STAGING`, workflow `2JUqVjPToWUmLfPL`, inactive. Re-ran it through pinned manual QA: execution `3813`, SUCCESS, **16/16**, `external_sends=0`, `orders_written=0`, `paid_model_calls=0`.
- An earlier authorized Shop B one-shot provider test, workflow `Nm2sYvW0cCT2FpWR`, execution `3361`, previously returned `API_ACCEPTED`; that ACK is NOT proof of Rich Text delivery, menu buttons, or current connectivity. Do not reuse/retry sender automatically.
- No confirmed Zalo recipient/chat_id is provided for the new Rich Text trial. No new provider send was made.

## Source code

- `qa/zalo-control-text/zalo-payloads.cjs`: builds 4 offline candidate messages; reuses existing `qa/sales-lite/v133/rich-text.cjs` validation (no duplication). It NEVER emits `chat_id`, token, URL, fetch, or a send action. Numbered menu uses text and internal Action IDs only.
- `qa/zalo-control-text/zalo-payloads.test.cjs`: official codes; Unicode surrogate/UTF-16; fixed palette; invalid offsets; no fake controls; no send.
- Existing V13.3 regression tests retained.
- Output = local QA draft content only, never actual Zalo message.

## Test protocol for **actual** Zalo (approval-gated)

1. Owner confirms exact Bot QA + authorized receiving account (one QA owner already allowlisted for Shop B is a candidate, but must be confirmed for this particular test); no real customer recipients.
2. Owner explicitly approves **maximum three test messages once**, no retry, no webhook/credential/domain modification, no billing, no Orders writes. Example:
   - T1 Numbered text menu: reply manually `1`, `2`, `3` and observe received webhook, do not automatically reply.
   - T2 Rich Text `text_styles`: bold green 18px header, second line italic and emoji included.
   - T3 Rich Text `parse_mode:markdown`: bold, list, green, underline.
3. Before send: verify bot identity via `getMe` (read-only API), authorized chat identity and gateway kill switch; ensure sender is a separate manual-only staging QA workflow, not the published webhook.
4. Sender binds recipient only server-side from verified QA allowlist, enforces maximum sends and expiration + idempotency. No bot token or chat_id in GitHub, screenshots, logs or copied payloads. Verify schema, payload and approval gates; do not disable gateway without permission.
5. On explicit approval: one-shot send, capture sanitized provider `ok`, `message_id`, timestamp; no automatic retries. Check actual rendered appearance on Zalo app via recipient's observation or supplied screenshot. API accepted is not the same as client rendered correctly.
6. Immediately stop and reconcile sends and log redacted QA evidence; leave production and active n8n unchanged.

## Status

- **VERIFIED** official Rich Text schema + connected n8n workflow metadata.
- **TESTED** offline text menus 16/16 at execution 3813.
- **IMPLEMENTED** offline rich text/menu payload builders and CI in this branch.
- **BLOCKED** actual Zalo client rendering and native buttons until approved QA Bot/recipient and a verified sender path.
- **ROLLOUT** none, this is an experimental QA-only Draft PR.

Rollback: close/revert the new GitHub Draft PR, no n8n/database/Cloudflare changes needed.
