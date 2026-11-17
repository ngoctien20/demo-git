# V17.23U-DIAG4 — Private read-only Zalo Bot webhook preflight

Status: DOCUMENTED / OWNER EXECUTION PENDING / HOSTED WORKER OFF / NO NEW SEND.

## Verified official Zalo Bot contract
- getMe: POST https://bot-api.zaloplatforms.com/bot{BOT_TOKEN}/getMe, no parameters. Checks token and returns bot account identity; read-only.
- getWebhookInfo: POST https://bot-api.zaloplatforms.com/bot{BOT_TOKEN}/getWebhookInfo, no parameters. Reads currently registered webhook configuration; read-only.
- deleteWebhook and setWebhook are mutations and MUST NOT be called during this preflight.
- Official docs: https://docs.zaloplatforms.com/docs/BOT/apis/getMe and https://docs.zaloplatforms.com/docs/BOT/apis/getWebhookInfo .

## Owner-only privacy and authority gates
- Use ONLY NEW dedicated TIEN404 QA Bot API Token, not existing staging Bot token and NOT webhook Secret Token.
- Do not paste token, bot ID, full endpoint URL, raw JSON response, authorization header or callback path into chat, screenshots, CI or GitHub.
- Token must be securely entered at a local PowerShell prompt (Read-Host -AsSecureString), decoded in transient memory and used over HTTPS for getMe and getWebhookInfo only. Token exists in the HTTP request path by provider protocol; don't print network exceptions or verbose logs.
- Compare returned bot identity privately against the QA Bot shown in Bot Creator. A valid token alone does not prove it belongs to the intended QA Bot.

## Sanitized output contract
| Output | Meaning |
|---|---|
| QA_BOT_TOKEN_VALID_CHECK_OWNER_IDENTITY | getMe succeeded; owner still must check that this is NEW QA Bot |
| QA_WEBHOOK_ABSENT_CONFIRMED | getWebhookInfo returns ok=true, result.url empty |
| QA_WEBHOOK_PRESENT_STILL_REGISTERED | getWebhookInfo returns ok=true, result.url non-empty |
| QA_WEBHOOK_STATUS_404_AMBIGUOUS | getWebhookInfo returned ok=false,error_code=404; prior no-webhook case did this, but not documented as a guaranteed deletion proof |
| QA_WEBHOOK_STATUS_INCONCLUSIVE | Other provider error or unrecognized result |
| QA_READ_ONLY_HTTP_ERROR_N | HTTP error N; never report the raw request URI or provider response |

These outputs prove only current provider configuration for the supplied token, never the origin or successful delivery of historical messages. No webhook re-enrollment or send authorized.

## Historical checkpoint and next gate
- Cloudflare aggregate 403/405/410 evidence at DIAG3 is NOT tied to a verified Zalo caller. This API does not expose event delivery logs.
- Dedicated QA Worker workers.dev and previews OFF, D1 original accepted receipts 0, diagnostic mode/schema not installed. Keep that state.
- After owner-only read-only verification, review provider registration vs controlled one-event testing; new public exposure, migrations, and diagnostic storage require separate scoped security/budget approval.
- Production Commerce and original Zalo Bot remain out of scope.


## Owner diagnostic result: getMe application 404

- OWNER-REPORTED: Local PowerShell getMe (POST) returned JSON `{ok:false,error_code:404}`. The call did NOT reach getWebhookInfo, so webhook presence/absence cannot be inferred.
- VERIFIED in official Zalo Bot error table: application error 404 = `Not found` / invalid access request, whereas 401 denotes invalid/expired token. This does NOT prove credential validity, and 404 may reflect a malformed/token-wrong-endpoint access request.
- VERIFIED in official getMe docs: path must be `https://bot-api.zaloplatforms.com/bot${BOT_TOKEN}/getMe`, POST, using raw Bot API Token. Local UI must distinguish Bot API Token from Webhook Secret Token, Bot ID, full URL or challenge. A raw Token should follow Zalo Bot Token example containing a colon; the code itself prepends `bot`, so pasted token must not include that prefix.
- SECURITY: no token, endpoint path, private identity or raw API response was pasted to chat/GitHub; no reset, webhook modification, message send, D1 mutation or network admission authorized. Keep Cloudflare Worker OFF.
- NEXT: owner locally recopy Bot API Token of new QA Bot (without resetting); examine token **shape** privately, never print token. Repeat read-only getMe only after local shape check. If still application 404, stop and use Bot Creator / vendor support, no repeated blind requests. Then getWebhookInfo only after getMe validates NEW QA Bot identity.
- STATUS: `ZALO_BOT_IDENTITY_404_BLOCKED / OWNER_TOKEN_SHAPE_CHECK_PENDING / WEBHOOK_STATE_UNVERIFIED / NO_GO`.

## Owner follow-up: local getMe validated, getWebhookInfo has no URL

- **OWNER-REPORTED**: After recopying token and passing a local format sanity check, read-only `getMe` returned `BOT_HOP_LE` (application `ok=true`, `result.id` exists). This supersedes the previous local application 404 as a current validity check for the token used. No Bot ID or token value was disclosed or recorded.
- **OWNER-REPORTED**: Read-only `getWebhookInfo` produced `WEBHOOK_KHONG_CO_URL`. In the supplied PowerShell script, this output requires application `ok=true` with non-null `result`, while `result.url` is absent/empty. This is positive evidence **no callback URL is currently exposed by the API for the Bot Token supplied**, not a cryptographic attestation of Bot ownership or a record of historical webhook delivery.
- **Identity gate STILL OPEN**: The API result does not independently establish the token belongs to the **NEW QA Bot** versus a different existing Bot. The owner should verify inside the trusted Bot Creator UI that the token was copied from the new QA Bot, without publishing identifiers/secrets. Until that check, mark `NEW_QA_BOT_OWNER_MAPPING_PENDING`.
- **Historical DIAG3 remains unresolved**: This current webhook state does not establish why the earlier challenge failed, whether the same Bot Token and Webhook Secret Token were used, or whether Zalo had delivered any request. Cloudflare prior aggregate 403/405/410 counts cannot identify the sender.
- **Cloudflare DIRECT VERIFIED (after user result)**: QA Worker workers.dev=false and preview=false; D1 accepted event receipts=0; no QA diagnostic mode/rate-limit binding; hosted version `75d9a289-64c3-4fe1-bc13-18c0051b529f` remains unchanged.
- **No mutation** to Zalo, Cloudflare hosted Worker, QA D1, credentials, Messenger, or Commerce; GitHub Draft PR only. No Bot reset, webhook enrollment, request sending, or hosted diagnostic migration.
- **Next gate**: Private QA Bot identity association; retain locked receiver; separately authorize any further attempt with no-content event diagnostics, bounded spending and rollback.
- **Classification**: `TOKEN_VALID_OWNER_TEST / GETWEBHOOKINFO_OK_NO_URL_OWNER_TEST / QA_BOT_IDENTITY_MAPPING_PENDING / CLOUDFLARE_OFF_VERIFIED / HISTORICAL_EVENT_UNPROVEN`.
