# TIEN404 SALES LITE V1.3 — Zalo Bot Creator Capability Recheck

Date: 2026-11-15 (JST). Status: DOCUMENT REVIEW ONLY. No token use or provider send.
This concerns Zalo Bot Creator, not Zalo OA OpenAPI, ZBS templates or Mini Apps.

## Verified official references

1. Zalo Bot API overview: https://docs.zaloplatforms.com/docs/BOT — overview mentions quick reply, buttons, carousel and templates as high-level capabilities, but does not publish a concrete Bot Creator message payload or callback signature there.
2. sendMessage: https://docs.zaloplatforms.com/docs/BOT/apis/sendMessage — parameters: chat_id, text (1–2000), parse_mode: markdown|html, or text_styles array. Schema for each text_styles item is { start: integer, len: integer, st: array<string> }. UTF-16 code units. If both parse_mode and text_styles are supplied, parse_mode takes precedence and text_styles is ignored; do not mix.
3. Official supported text_styles codes: b, i, u, s, f_13, f_15, f_18, f_20, c_050a19, c_15a85f, c_f7b503, c_f27806, c_db342e, lst_1, lst_2, ind_1 through ind_5. No arbitrary color or HTML code.
4. Bot creation: https://docs.zaloplatforms.com/docs/BOT/create_bot — name initially entered in Zalo Bot Creator, required prefix "Bot", Bot Token delivered to owner's Zalo.
5. Bot Creator official landing: https://zalo.me/s/botcreator — describes mobile creation and management of bot information, but does not explicitly prove post-creation name edit API or whether changing name affects ID/QR/token/webhook.
6. getMe: https://docs.zaloplatforms.com/docs/BOT/apis/getMe — read-only bot profile/token check; not a rename endpoint.

## Capability matrix

| Feature | Status | Why |
|---|---|---|
| Text send primitive | OFFICIALLY_DOCUMENTED | sendMessage text, chat_id |
| Rich Text / UTF-16 / whitelist | OFFICIALLY_DOCUMENTED, CODE_TESTED | v133/rich-text.cjs, no provider call |
| parse_mode markdown/html | OFFICIALLY_DOCUMENTED | Must not combine text_styles |
| Numbered menu / fallback | MOCK_TESTED | V13.1 renderer, never live send |
| Bot persistent menu | UNKNOWN | No verified Bot Creator endpoint/payload |
| Bot quick reply | UNKNOWN | Overview general only |
| Bot inline/keyboard buttons | UNKNOWN | No validated Bot sendMessage request schema |
| Bot callback event | UNKNOWN | No signature/role-safe event schema |
| Bot carousel/message templates | UNKNOWN | Overview general only, no compatible payload proof |
| Bot profile initial name | OFFICIALLY_DOCUMENTED | Must start with Bot |
| Rename existing Bot | UNKNOWN | Bot Creator management description not sufficient |
| Rename API endpoint | UNKNOWN | No public verified endpoint |
| Rename side-effects token/ID/QR/webhook | UNKNOWN | No test or official guarantee |
| Commercial use, quotas, broadcast restrictions | UNKNOWN | No audited contract or quota |
| zBusiness Basic grants Bot Creator API permissions | UNKNOWN | Cannot infer from paid Zalo plan |
| Zalo OA menu/quick response | DIFFERENT PRODUCT | Never reuse OA/ZBS payload for Bot Creator |

## Implementation decision

Use offline TEXT_NUMBERED fallback and validated Rich Text drafts only. No payload with buttons/callback guessed from public OA/ZBS examples. No bot renaming, token access, webhook edits, new bot creation or new paid plans. The new validator does not transmit text.

## Questions for Zalo Developer Support

1. Is persistent/custom interactive menu available in current Bot Creator for third-party integrations? Which official schema and limits?
2. Are quick-reply, inline/keyboard, carousel and callbacks supported by public Bot API? If yes, where is the exact request and webhook event schema, including callback verification?
3. Can a created bot be renamed from Bot Creator? Any public API? Does the rename alter Bot ID, token, QR/link, webhook, existing subscribers, naming rules or review process?
4. Are commercial monthly subscriptions to third-party merchant bot automation permitted? What pricing, quotas, account limits, owner notification and proactive messaging policies apply?
5. Which rights, if any, does zBusiness Basic confer on Bot Creator versus OA OpenAPI?
6. What rules apply to multi-shop/merchant bots and owner pairing without exposing customer chats?

Provider-test gate: explicit owner approval, QA account/recipient, authorized budget, redacted request/response proof, rollback, signed webhook verification. None executed.
