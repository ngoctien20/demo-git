# TIEN404 AI — V13.6 Button Lab: Zalo Bot Creator vs Zalo OA

Date: 2026-11-15 JST. Status: EXPERIMENTAL / QA ONLY / NO SEND.

## Why this exists

Owner requested continuing work on actual interactive buttons after T1–T3 Rich Text were API_ACCEPTED and rendered successfully in **Zalo desktop**. Those 3 real sends were consumed; Worker staged global `ZALO_SEND_ENABLED=false`, n8n sender T1–T3 nodes disabled. This change DOES NOT renew send approval or reuse old QA chat id.

## Provider capability evidence

- Official Zalo Bot overview https://docs.zaloplatforms.com/docs/BOT lists buttons, Quick Replies and carousel among high-level features (as of 2026-11-15).
- Official Bot Creator `sendMessage` https://docs.zaloplatforms.com/docs/BOT/apis/sendMessage lists **only** `chat_id`, `text`, `parse_mode`, `text_styles`; official API reference sidebar lists getMe/getUpdates/setWebhook/deleteWebhook/getWebhookInfo/sendMessage/sendPhoto/sendSticker/sendChatAction/sendVoice. No documented body schema / callback event for inline bot buttons at this URL. No `reply_markup` or OA CTA payload will be sent through this Bot.
- Official Zalo OA feature page https://oa.zaloapp.com/home/function/interaction?type=menu-chatbot documents menu, chatbot CTA and interactive actions for Zalo **Official Accounts**, a **distinct product** and permission system.
- Official OA transactional message and button documentation exists at https://docs.zaloplatforms.com/docs/OA/tin-nhan/tin-giao-dich/gui-tin-giao-dich but it is NOT a Bot Creator request schema, and those OA transaction buttons require the relevant OA messaging entitlement.
- Third-party SDKs sometimes describe additional keyboard methods. Unofficial SDK support is not proof of authorization, current provider acceptance, callback verification, or contractual right. Do not attempt undocumented endpoint without official provider confirmation and separate user approval.

## Implementation

- `button-capability.cjs`: provider-neutral selection intent adapter, **read-only QA**. Reuses `qa/sales-lite/v131/menu-registry.json` and `menu-engine.cjs` for exactly six CUSTOMER actions, no independent fake catalog or button registry.
- Channel `ZALO_BOT_CREATOR`: `TEXT_NUMBERED`, explicit `native_buttons_enabled=false`, `provider_payload=null`.
- Channel `ZALO_OA`: `NATIVE_BUTTONS_PREVIEW_ONLY`, official OA buttons documented but `native_buttons_enabled=false`, `provider_payload=null` until real OA access, approved API operation and correct capability verification.
- `resolvePreviewSelection`: requires CUSTOMER role, exact number in Bot mode, exact known Action ID in OA mock mode, permission whitelist, fail-closed on unknown controls; returns only preview result, no backend access/Orders/Outbox/sends.
- `button-lab/index.html` and `app.js`: mobile-first visual interactive demo. Uses GET-only fetch of the **existing V13.1 registry**; no localStorage, credential, external API or real tenant data. Bot mode buttons are **browser-only simulation outside the Zalo message**. OA mode buttons are browser-only OA lookalikes, **not actually deployed**.

## Local preview and QA

From repo root: `python -m http.server 8080`, then open
`http://127.0.0.1:8080/qa/zalo-control-text/button-lab/`.

Run Node: `node --test qa/zalo-control-text/button-capability.test.cjs`.

Browser QA (with Playwright): `node qa/zalo-control-text/button-lab-browser-qa.cjs` at localhost:8080.
CI: `.github/workflows/v136-zalo-button-lab-qa.yml`.

The browser QA checks 360, 390, 430, 768, 1280 px, sends no HTTP methods other than GET/HEAD, guards simulated drafts vs reads and fails closed if source registry unexpectedly becomes write-enabled.

## Product policy alignment

TIEN404 sells an AI Sales SaaS, not a stand-alone Zalo Bot. **Sales Lite** uses the managed standard text-menu flow with shop-owned orders handled in authorized channels; shop customer does not edit menus or internal Bot settings. **Sales Plus** includes staff-managed customization according to approved provider capabilities. **Enterprise** may adopt Zalo OA with stronger interactive UI only after real OA rights/terms and platform security gate confirmation. AI Studio remains FUTURE/PRESERVED; this lab is isolated QA.

## Exact gates before provider-native button test

1. Obtain official Bot Creator button payload and callback/webhook schema from Zalo support or updated official documentation; otherwise the Bot native-button lane stays **BLOCKED**.
2. Verify whether Bot supports keyboard buttons via a documented method, on which platform versions, supported button counts/title constraints and event signing. Do not probe guessed write endpoints.
3. Alternatively, verify a separate real QA Zalo OA and authorized API access + correct message-type scope, then prepare a separate OA adapter and read-only payload QA. Do not share Bot Token with OA token.
4. Build signed tenant/actor binding, callback anti-replay, permission checks, confirmation for writes, no credit card storage and strong negative tests before any send.
5. Ask for new approval for any provider sends. Previous 3/3 send quota is exhausted; never clear D1 claims, disable a gateway, replay messages, or modify the production webhook.

## Rollback

Close/revert Draft PR on `work/v136-zalo-button-capability-lab-staging`, preserving PR #77 and all existing n8n/Cloudflare/Supabase records. There are **no infrastructure writes** in V13.6.

**Implemented != provider buttons live.** Status remains EXPERIMENTAL until provider-specific capability and authorized real device test.
