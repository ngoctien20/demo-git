# V17.23U-DIAG5 — Wrong Bot Token at Worker: Evidence-Based Root Cause Audit

**Status:** DIRECT WORKER CODE / BINDING VERIFIED; WRONG INPUT OWNER-ATTESTED; ACTUAL SECRET VALUES UNREADABLE; HISTORICAL ZALO REQUEST ORIGIN UNPROVEN; HOSTED CHANGES NONE; PROD NO-GO.

## Critical owner correction

Owner explicitly confirmed: **"bot token lúc worker là nhập sai"**. This supersedes any prior assumption that credential entry was known correct. It is still **unknown** which text was pasted in which UI field (Cloudflare `QA_HEADER_SECRET`, registration `secret_token`, or a Bot API Token used by another operator action), because Cloudflare secret values are encrypted/hidden and neither raw token nor current registered webhook value should be disclosed.

Owner verified locally by read-only Zalo API that a newly recopied Bot Token passed `getMe` with Bot ID and `getWebhookInfo` returned `ok=true` but no webhook URL for the *token provided*. Private mapping from that Bot ID/token to exactly the **new QA Bot** remains an operator identity gate. This proves current no-URL state, not history.

## Directly VERIFIED live Worker, not merely GitHub candidate

Cloudflare Worker script: `tien404-v1723u-qa-inbound-locked-staging`; deployed script content read through Cloudflare read-only API, content analyzed locally in tool without emitting source or secret contents.

- Deployed source **uses** constant-time comparison `req.headers.get('x-bot-api-secret-token')` with `env.QA_HEADER_SECRET`.
- Deployed source has **NO** `env.BOT_TOKEN`, `env.ZALO_BOT_API_TOKEN`, or `env.QA_BOT_TOKEN`; **no outgoing Zalo Bot API host** and no outbound `getMe`/`setWebhook` call.
- Live Worker bindings: `QA_CALLBACK_PATH` secret_text; `QA_CHALLENGE` secret_text; `QA_EVENT_PEPPER` secret_text; `QA_HEADER_SECRET` secret_text; `QA_EVENT_DB` D1; `QA_CANARY_MODE`, `QA_START_MS`, `QA_END_MS` plain text.
- Workers.dev **OFF**; previews **OFF**; QA D1 `qa_canary_once` **0 accepted receipts**; no DIAG2 diagnostic hosted binding; deployed version `75d9a289-64c3-4fe1-bc13-18c0051b529f`.
- The deployed source checks correct QA route and POST, then time window, then prerequisites, then Webhook Secret header. HTTP 403 is returned on shared-header mismatch. HTTP 410 may be returned *before* checking that header; HTTP 405 checks non-POST *before* any secret comparison.
- Earlier Cloudflare 5-minute analytics indicated 403 x4, 405 x1, 410 x1; the requests **cannot be attributed to Zalo** and include operator probes. D1=0 therefore remains unexplained by source logs alone.

Official Zalo Bot contracts:
- `getMe` and `setWebhook` call `https://bot-api.zaloplatforms.com/bot{BOT_TOKEN}/...` using Bot **API** Token (provider authentication).
- `setWebhook` request has a distinct `secret_token` field, chosen for the webhook endpoint; Zalo then sends this value in header `X-Bot-Api-Secret-Token`.
- `QA_HEADER_SECRET` in the Cloudflare Worker MUST equal the **Webhook Secret Token**, NOT the Bot API Token, Bot ID, QA_CHALLENGE or n8n Gateway auth.
- Provider docs: https://docs.zaloplatforms.com/docs/BOT/apis/setWebhook and https://docs.zaloplatforms.com/docs/BOT/webhook .

## Root cause candidate matrix

| Owner's incorrect input location | Plausible effect | Current evidence | Confidence |
|---|---|---|---|
| **Bot API Token mistakenly pasted into Cloudflare `QA_HEADER_SECRET`** | Incoming Zalo Webhook Secret Token differs; receiver HTTP 403; D1 stays 0 | Live code compares header to `QA_HEADER_SECRET`; opaque secret value cannot be read | **HIGH PRIORITY HYPOTHESIS; NOT VERIFIED** |
| Wrong Bot API Token when locally calling Zalo's `setWebhook` | Provider rejects registration, or webhook linked to wrong Bot if valid different token | Owner had earlier `getMe` application 404 before correctly copying token; current webhook no URL | PLAUSIBLE; historical registration result unknown |
| Wrong `secret_token` typed during Zalo Bot Creator webhook setup | Mismatch against Cloudflare `QA_HEADER_SECRET` -> HTTP 403 | Prior 403 analytics un-attributed, cannot compare encrypted values | PLAUSIBLE |
| Wrong n8n `TIEN404_ZALO_WEBHOOK_STAGING_V2` headerAuth credential | Unauthorized requests to **n8n ingress**; does not directly explain separate Cloudflare QA D1 | n8n credential is headerAuth on active `yIJk8LvJoLF40Z62`; secret unreadable | INDEPENDENT POSSIBILITY |
| Wrong n8n `TIEN404_ZALO_OUTBOUND_GATEWAY_AUTH_V1` credential | n8n -> Gateway authentication issue; not directly a Zalo Bot API token | Credential type `httpHeaderAuth` on inactive read-only gateway preflight | INDEPENDENT POSSIBILITY |
| Wrong `QA_CHALLENGE` at Worker | After correct header auth, receiver HTTP 422 | Prior analytics showed no observed 422 | DOES NOT EXPLAIN 403 |
| QA time window expired | HTTP 410 before header validation | 410 observed | SEPARATE KNOWN GATE |

## Secure remediation proposal (NOT executed)

1. **Freeze existing infrastructure:** Leave dedicated Worker and previews OFF, QA Bot webhook absent per owner's read-only test, production/older Bot untouched.
2. **Owner identity/authority:** In Bot Creator privately verify the Bot selected for future QA matches the locally `getMe`-verified **new QA Bot**. Never print token, Bot ID, callback URL or secret.
3. **Select two separate independent secrets:** Keep Bot API Token only in owner-controlled Zalo Bot management/API client. Generate a *new random high-entropy* Webhook Secret Token (e.g., 32+ base64url characters) for the QA webhook. Never reuse Bot API Token, `QA_EVENT_PEPPER`, challenge or n8n credentials.
4. **Future gated fix only:** Under explicit scope and rollback authorization, rotate **`QA_HEADER_SECRET`** in disposable Cloudflare QA Worker to exactly the new Webhook Secret Token, and configure same value as Zalo Bot QA `setWebhook.secret_token`, only within a permitted short no-send test window. Keep public exposure limited and reversible; no production cutover.
5. **Verification gate:** Prior to a live attempt, conduct offline secret-consistency attestation in private operator environment without showing values; ensure exact intended Bot identity, random callback path, valid bounded window, minimum privileges, rate/cost caps and safe rollback. Single owner-approved message; compare observed Worker response distributions and exact one-slot D1 acceptance. If 403, do not infer provider identity from aggregate status alone.
6. **After test:** Delete QA Bot webhook, verify `getWebhookInfo` no URL, turn Worker OFF and previews OFF, check D1 receipt count and CI. Require evidence before RELEASE.
7. **Bot API Token rotation** is *not automatic* merely because a wrong token was typed into an encrypted Worker secret. Consider a scoped owner-approved rotation if a Bot API Token was exposed to untrusted logs, Git history, webhook header submissions, public content or other parties; account for dependent active Bot integrations before rotating.

## Audit effects and scope

- No hosted Worker code, binding, D1 table, n8n credential, published workflow, Zalo Bot config or Commerce action was changed during DIAG5.
- Draft GitHub doc only; no confidential values stored.
- Security distinction: `QA_HEADER_SECRET` matching is a shared bearer-header check, NOT a signed payload / verified merchant identity proof.
- **Decision:** ROOT_CAUSE_LIKELY_SECRET_ROLE_CONFUSION / NOT CRYPTOGRAPHICALLY_VERIFIED / REAL_ZALO_INGRESS_UNPROVEN / WORKER_LOCKED / NO-GO.

Checkpoint timestamp: 2026-11-18 JST.
