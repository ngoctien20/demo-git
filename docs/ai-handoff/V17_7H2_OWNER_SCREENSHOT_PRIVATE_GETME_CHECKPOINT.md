# TIEN404 AI — V17.7H.2 Real QA Bot Owner Admission × Private getMe Verification × One-Event No-Send Readiness

Date: 2026-11-17 JST.  
State: **USER-CONFIRMED BOT CREATOR UI / SOURCE-ONLY READBACK CONTRACT / REAL ZALO BOT API AND NATIVE EVENT UAT NO-GO**.

## 1. Exact project lineage and invariant

Parent Draft [PR #350](https://github.com/ngoctien20/demo-git/pull/350) exact HEAD `f885ead22711539e2ca4a6347c804dd16be4aebf`, 564/564 offline regression / 9/9 CI SUCCESS. Previous V17.7H created the Cloudflare Worker **INACTIVE**; this child has not deployed or changed that Worker, n8n Published workflows, OAuth/credential, Supabase, R2, Merchant Access RPC16 or production endpoints.

Canonical Commerce Store isolation stays in Draft PR #247; RPC16/17 private Merchant evidence remains a separate trust boundary. **AI_SALES_DEMO** Products/Orders/credential must not be reused as Commerce. Zalo Bot, Zalo OA and Messenger have distinct native authorization paths.

## 2. Newly received evidence from the USER (NOT provider owner attestation)

The user attached a screenshot of a mobile session inside **Zalo Bot Creator (Beta)**, displaying "Danh sách bot của bạn", **1/3 có thể sở hữu**, and a card labeled **"Bot TIEN404 AI"**, and explicitly stated **"Tôi xác nhận quyền quản trị"**. The screenshot does not show Bot ID or Bot Token.

- Attached user image original bytes SHA-256: `da459617e310e2341eb7f27430b8c6e0c6fe3f745560ab54e2be771b74b54258` (78,358 bytes). The raw image remains in the conversation attachment, **not uploaded to GitHub**.
- Confidence class: **USER-CONFIRMED / BOT-LIST-UI-OBSERVED**. A screenshot and written assertion are useful initial evidence of access, but do NOT cryptographically authenticate the original Zalo session, current Bot Creator admin permission, Bot ID, tenant/store provenance, or owner-to-business delegation.
- No token, OTP, phone, JWT, password, webhook URL, private owner document or account identifier is collected. A user should NEVER paste a Bot Token or a screenshot of a token into GitHub/ChatGPT.
- **Unknown critical constraint**: whether the card "Bot TIEN404 AI" is the same Bot wired to active published n8n `yIJk8LvJoLF40Z62`. Until Bot ID + existing webhook is verified by private read-only API, **DO NOT call setWebhook, deleteWebhook, sendMessage, getUpdates or repoint the Bot**. It may currently be serving QA/other flows.

## 3. OFFICIAL native API contract (READ-ONLY operations)

- `getMe`: `POST https://bot-api.zaloplatforms.com/bot{BOT_TOKEN}/getMe`, JSON response `ok:true,result.id,account_name`; validates that an API token can access a specific Bot; this alone does NOT prove the human is its current administrator, nor Merchant/Store ownership. Official documentation: https://docs.zaloplatforms.com/docs/BOT/apis/getMe
- `getWebhookInfo`: `POST .../getWebhookInfo`, returns `ok:true,result.url,updated_at`; read-only inspection of existing webhook. Official documentation: https://docs.zaloplatforms.com/docs/BOT/apis/getWebhookInfo
- `setWebhook` and `deleteWebhook` modify provider configuration and are **NOT authorized**. Never use sendMessage as a shortcut for no-send admission. https://docs.zaloplatforms.com/docs/BOT/apis/setWebhook
- The Bot Token is embedded in the official URL path. A future private readback runner must acquire it only from a secure credential vault after approved owner identity and actor scope, must NEVER log the full URL / error stack / Zalo raw response, and must not do automatic retries or send the token into model input. Zalo Bot uses X-Bot-Api-Secret-Token on incoming webhooks, distinct from Bot API Token and Zalo OA OAuth.
- A real private authenticated `getMe` or `getWebhookInfo` request was **NOT performed in this phase**, because screenshot contains neither actual Bot ID nor a protected operator credential/session accessible to the current tool environment. Never invent "verified" results.

## 4. Verified direct hosted inventory in this phase (READ ONLY)

- Cloudflare Worker `tien404-v177h-provider-nosend-inactive-staging`: ID `0265c4d1f3d64f9196eb7587b8f1a552`; uploaded version `c39b8e9d-2dfc-454d-b29d-40b495ff2043`; 0 deployments, `deployed_on=null`, workers.dev=false, previews=false, 0 bindings. No route, real callback or native delivery verified.
- n8n manual QA `MQcbjLWZ5QUTJW0k`: INACTIVE, exact version `b8aaf94c-def1-472c-bd92-fccea1d946b8`; no webhook node. Existing published Zalo Bot LAB `yIJk8LvJoLF40Z62` active and includes PII-free QA Data Table upserts; cannot be used as a strictly zero-write canary without explicit bounded approval and separation.
- Supabase staging `ifxlvrhyjhbzbrkdsida`: 2 synthetic QA tenants, maximum 1 Store per Tenant; no same-Tenant two Store JWT/RLS acceptance. No Store/Commerce read or write occurred.
- Existing Merchant RPC16 Access Worker/R2 and Messenger webhook remain unchanged.

## 5. V17.7H.2 implementation — SOURCE ONLY

- `qa/v17-7a-oa-independent/v17-7h2-bot-owner-ui-readback-no-go.mjs`: strict SHA-bound UI owner receipt; no Bot ID or raw image persisted; strict mock `getMe/getWebhookInfo` response type, Bot ID mismatch checks, HTTPS-only webhook state; redact full webhook URL by SHA-256. All outputs explicitly deny real provider owner verification and one-event admission despite claimed green flags.
- `qa/v17-7a-oa-independent/v17-7h2-bot-owner-ui-readback-no-go.test.mjs`: adversarial tests for forged screenshot hash, asserted fake admin, claimed Bot ID, payload injection/PII, wrong official response, mismatched Bot, non-HTTPS existing webhook, attempt to enable sends/Commerce.
- `qa/v17-7a-oa-independent/v17-7h2-private-operator-readback-mock.mjs`: tokenless **injected transport contract** that invokes exactly `getMe` then `getWebhookInfo` as MOCK methods; blocks broad scope; rejects bad/mismatched Bot; catches and redacts all transport errors; returns only Bot ID SHA256, webhook URL SHA256 + configured flag. This module DOES NOT call the provider; live private transport is not connected.
- `qa/v17-7a-oa-independent/v17-7h2-private-operator-readback-mock.test.mjs`: offline transport mocks; fail-closed against malformed responses, bad owner scope, token injection, bot mismatch, and error strings containing secret-bearing URLs.
- `qa/v17-7a-oa-independent/v17-7h2-screenshot-private-readback-evidence.json`: exact screenshot hash and redacted actual read-only Cloudflare/n8n/Supabase state, explicit false for REAL getMe/getWebhookInfo/QA event.
- `.github/workflows/v17-7h2-owner-screenproof-private-readonly-nosend.yml`: full inherited V17.7A–H.1 and new H.2 offline QA; static no-network/no-send/no-write assertions. Exact HEAD CI result must be inspected before claiming TESTED.
- This checkpoint and rollback.

## 6. Minimal next private operator/owner action (NOT performed)

1. On the already logged-in **Zalo Bot Creator**, open the existing `Bot TIEN404 AI` item and inspect the Bot detail/profile screen. Identify any **Bot ID** (identifier only), management permissions, and whether a token or configured callback is shown. **Do not share token, recovery codes, QR login, OTP, cookie or private account ID; cover/hide them in any shared screenshot**. If a Bot ID is visible, the user can share just the ID.
2. Before any real API call, the owner authorizes a separate private operator runner with a vaulted Bot Token, short-lived read-only scope and independent reviewer. Bot Creator verified owner session must be checked through a provider-supported mechanism. A photo alone cannot replace this check.
3. Make at most **one** approved `getMe` and **one** `getWebhookInfo` via secure private runner; confirm exact Bot ID. If a webhook is already set, STOP and do not overwrite. Store only redacted digest, origin, UTC timestamp, runner ID and independent review receipt. Disable all transport/log tracing that could expose token embedded in the URL.
4. If this is the **only existing Bot** and it already has a customer/QA webhook, use a second **disposable QA Bot** if necessary, with separate approval, rather than repointing it. No new Bot or webhook has been created here.
5. Separately obtain verified operator and QA reviewer identity and consent to one benign test event, a hosted durable replay+rate limiter and isolated signed inbound Worker, with zero outbound and zero Commerce read/write bindings; independently observe native logs. The existing V17.7H Worker has 0 deployments and will return 404 if ever activated, so it is **not** a real callback.
6. Keep original source Store G0 and same-Tenant Store A/B real Auth JWT/RLS gate under canonical PR #247. **Bot owner is not automatically Store owner**.

## 7. Go/No-Go / QA / rollback

- **VERIFIED:** User-provided Bot Creator screenshot has "Bot TIEN404 AI" listed (not provider-verified), direct Cloudflare inactive Worker metadata, existing n8n QA and Supabase tenant store mapping, official Bot API docs.
- **IMPLEMENTED:** SHA-bound receipt, mock readback transport with redaction, deny-all one-event gate, adversarial source-only tests, GitHub Draft child checkpoint.
- **TESTED:** Only when exact final PR HEAD CI SUCCESS checked; synthetic tests are NOT real provider UAT.
- **BLOCKED:** Actual Bot ID, authenticated Bot Creator owner role, managed Bot API token, real `getMe` + `getWebhookInfo`, independent operator/reviewer, native event, hosted replay/rate, Store A/B JWT/RLS and external no-send acceptance.
- **NEEDS APPROVAL:** Verified owner and bounded operator session; protected token vault/private runner; any future callback, new disposable Bot, cost or one-event send from QA actor; no production re-routing before explicit scoped consent.
- **ROLLBACK:** Close the child Draft PR to abandon source. No hosted resource was created or changed in this stage; keep existing inactive V17.7H Worker and published n8n routes. No delete action.

**Checkpoint:** `V17_7H2_USER_SCREENSHOT_SHA_ATTESTED_UI_ONLY__PRIVATE_GETME_MOCK_READY__REAL_PROVIDER_NO_GO`.
