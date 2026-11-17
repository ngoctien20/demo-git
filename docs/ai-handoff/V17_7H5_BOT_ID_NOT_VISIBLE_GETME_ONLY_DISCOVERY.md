# TIEN404 AI — V17.7H.5: Bot ID Not Visible in Creator → getMe-Only Discovery

**2026-11-18 JST | SOURCE ONLY · MANUAL PRIVATE CONSENT REQUIRED · NATIVE BOT API NOT CALLED IN THIS PR**

## 1. New evidence and exact problem

The real owner confirmed that the Zalo Bot Creator (Beta) UI for Bot TIEN404 AI does **not** show a Bot ID. Four supplied screenshots show the Bot account, active status, two interacting users and an already populated n8n-hosted webhook configuration with both Bot Token and webhook Secret Token masked. These are user-provided screen observations, **not** independently verified provider account ownership. Do not mistake the public QR/deeplink for the numeric Bot API ID.

The inherited V17.7H.4 [Draft PR #381](https://github.com/ngoctien20/demo-git/pull/381), pinned SHA `66e3325e8a94ab6cbfc491023045b9ab2e8376c8`, incorrectly requires a numeric Bot ID *before* performing `getMe`, blocking this user's real onboarding. We intentionally retain that original **known-ID strict verification mode** but add a separate least-privilege **unknown-ID discovery mode**.

Official documentation:
- [Zalo Bot getMe](https://docs.zaloplatforms.com/docs/BOT/apis/getMe): POST `https://bot-api.zaloplatforms.com/bot{BOT_TOKEN}/getMe`. Valid token returns `result.id` and `result.account_name`. No pre-known numeric Bot ID is a required parameter.
- [Zalo Bot getWebhookInfo](https://docs.zaloplatforms.com/docs/BOT/apis/getWebhookInfo): separate read-only POST. **NOT called by H.5**.
- Bot Token is private and must not be sent to ChatGPT/GitHub/n8n execution logs. Secret Token on the existing webhook is a **different** credential. Do not reset or display either token, change the webhook URL or press Save/Delete/Reset.

## 2. Child additive source-only change

- `qa/v17-7a-oa-independent/v17-7h5-private-getme-discovery.mjs`: has **no `expectedBotId` field**; allows exactly one injected `postReadOnly('getMe',secret)` call after explicit owner read-only consent and an ephemeral local token callback. Checks returned numeric ID (8–24 digits) and Bot account handle; returns ID **only to the local console**, plus SHA256 for personal notes. All owner, Store/JWT, webhook, send/write, and hosted canary approval flags remain false. No automatic call to `getWebhookInfo`.
- `scripts/v177h5-discover-bot-id.ps1`: Windows, **no Docker**, reads Bot Token with masked PowerShell SecureString and requires the literal human confirmation `READID` for one lookup. Clears BSTR/environment after the local process.
- `scripts/v177h5-discover-bot-id.mjs`: refuses GitHub Actions, non-interactive and unauthorized execution; reuses the pinned H.4 HTTPS POST/TLS/no-redirect/no-retry transport; never prints Bot Token, full URL, webhook or provider raw error.
- `qa/v17-7a-oa-independent/v17-7h5-private-getme-discovery.test.mjs`: 10 cases, including lack of prior ID, refusal without consent, wrong token shape, malformed response/handle, redaction, CI fail-closed, only-one-getMe/no webhook operation.
- `.github/workflows/v17-7h5-bot-id-discovery-no-live.yml`: inherited H.4 18 tests plus 10 H.5 tests, no real provider secrets/network, real-provider job `if:false`.

## 3. Practical user path — later, manual only

1. No need to find numeric Bot ID in the Zalo Bot Creator UI. **Do not** press Save changes, Delete Webhook, Reset Secret Token or Reset Bot Token. The current webhook is present and must remain unchanged.
2. Only when comfortable, download/check out the **specific Draft PR commit** on a trusted Windows computer and visually review `scripts/v177h5-discover-bot-id.ps1` plus the Node scripts.
3. Launch the PowerShell wrapper locally. Type `READID` to approve **one POST getMe** to official Zalo Bot API. Enter the **Bot Token** only into the masked local prompt. Do NOT enter webhook Secret Token: it is for inbound webhook authentication and is not interchangeable with the Bot API token.
4. The tool prints numeric `discoveredBotId` to your local screen and labels it `UNPINNED_BOT_ID_DISCOVERED_LOCAL_ONLY`. Do not post a token or URL in the conversation. The Bot ID is an identifier (not a credential), but keeping the entire local receipt private is preferable.
5. Discovery is NOT proof that this Bot belongs to the real founder or same Commerce Store, nor that it is the Bot currently wired to n8n. For independent evidence, the person managing Bot Creator must compare the returned bot identity with the current logged-in Creator and separately verify current installed webhook via an approved read-only `getWebhookInfo`. That later operation should use the H.4 strict known-ID mode; if the existing webhook is present, **STOP**.
6. Cross-channel real Messenger→Zalo order status stays **NO-GO** until the independent Meta owner and canonical Store/JWT/RLS/recovery gates in [V17.22H PR #378](https://github.com/ngoctien20/demo-git/pull/378) are accepted.

**Privacy limitation:** This manual CLI passes the private Bot Token through a temporary child-process environment and constructs the official HTTPS URL with the token in the path. It does NOT implement a production Vault, private operator identity attestation or end-to-end no-logging proof for network proxies. Even if its own console output redacts values, a privileged process or outbound URL-monitoring proxy may observe them. Use only a trusted, consented environment. No one should paste raw tokens into GitHub, CI, chat, screenshots or public URLs.

## 4. Release and rollback

**VERIFIED:** Zalo official `getMe` output has numeric `id` and no pre-known ID input; the user confirms it is not displayed in Bot Creator. Existing webhook already configured in user screenshot.
**IMPLEMENTED:** new private local discovery utility and negative CI.
**TESTED:** only when exact child HEAD CI succeeds; no real getMe was run in this task.
**NOT EXECUTED:** live provider request, webhook read, provider send, Supabase/Commerce writes.
**BLOCKED:** provider owner proof, real same-Store binding, native signed inbound event, Store A/B JWT/RLS, hosted no-send canary and M0 recovery.
**ROLLBACK:** close child Draft PR, no hosted change.

**Checkpoint:** `V17_7H5_GETME_ONLY_BOT_ID_DISCOVERY_READY · REAL_API_NOT_EXECUTED · EXISTING_WEBHOOK_PRESERVED · SAME_STORE_HOSTED_NO_GO`.
