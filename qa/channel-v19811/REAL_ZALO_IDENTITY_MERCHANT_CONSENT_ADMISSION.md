# TIEN404 V19.8.11 — Real Zalo Bot Identity Evidence × Merchant Consent × Protected No-Send

## Release status: **NO-GO LIVE** / IMPLEMENTED & TESTED OFFLINE/LOCAL

This gate is an evidence collection and read-only admission candidate. **A GitHub Actions synthetic pass is not proof that the real Zalo Bot belongs to a real merchant Store.** Never use this PR to enable a provider send, hosted Store catalog, order write, stock reservation, subscription billing or published workflow cutover.

## VERIFIED source evidence — 20 Nov 2026 JST

- Official Zalo Bot API `getMe` (POST, Bot Token in API path) returns the Bot ID and profile; the token is provided to the Bot creator. Official `getWebhookInfo` (POST) returns the currently configured webhook URL and update time. Neither is a merchant Store authorization signal.
- Official Zalo Bot webhook uses `X-Bot-Api-Secret-Token` whose value must be checked before accepting requests. **This is a shared secret header, not the HMAC signature used in V19.8.10 mock QA**. The official webhook docs do not establish that incoming `message.from.id` is a merchant owner.
- Actual n8n receipt-only Zalo workflow `jy7vCmt8LH6BSqGh` remains ACTIVE; Published version `175b6609-6a95-4432-986a-075bf8cced35`. Webhook uses Header Auth credential reference. Its receipt normalizer explicitly emits `botIdentityBound=false`, `storeAuthorized=false`, and `ownerRoleGranted=false`. The inspected execution metadata was manual/success, not an independently verified `getMe`/`getWebhookInfo` pair.
- n8n `TIEN404_R1_SHOP_BOT_REGISTRY_QA` has 2 entries with `bot_provider=zalo_bot_fixture`, `identity_status=synthetic_qa`, `enabled_mode=dry_run`. These are not real provider installations.
- Supabase hosted `tien404-staging` is ACTIVE_HEALTHY. Six inspected Commerce tables still lack a Store column, so hosted Owner A/B same-tenant isolation is **NOT** verified. Supabase Free plan blocked creation of an isolated hosted development branch.
- Credential references/metadata were inspected without retrieving or printing any secret. The connected tools do not provide a verified Bot Token→`getMe` result or a real signed merchant Owner session to approve this installation.

Official documentation:
- https://docs.zaloplatforms.com/docs/BOT/authorize
- https://docs.zaloplatforms.com/docs/BOT/apis/getMe
- https://docs.zaloplatforms.com/docs/BOT/apis/getWebhookInfo
- https://docs.zaloplatforms.com/docs/BOT/webhook
- https://docs.zaloplatforms.com/docs/BOT/apis/setWebhook

## V19.8.11 artifacts

1. `zalo-official-readonly-verifier.mjs`: operator-only **two POST reads** (`getMe`, `getWebhookInfo`) over HTTPS with a Bot Token typed directly into a local hidden TTY. No credential saved, no raw Bot ID or webhook URL printed, no `setWebhook` or `sendMessage`. Requires an exact expected Bot ID and existing webhook URL input. This operator tool is **NOT RUN in CI** and has **NOT been run against the live Bot**.
2. `zalo-official-readonly-verifier.test.mjs`: validates the two official API response shapes using fictional data ONLY.
3. `protected-no-send-admission.mjs` and tests: strict fail-closed candidate requiring server-owned mock Installation, mock provider `getMe`+webhook match, scoped mock Owner consent version/challenge/session, unique private receipt and NO SEND/WRITE/READ flags. **Even all-green mock inputs return `OFFLINE_NO_SEND_PREVIEW_CANDIDATE`, never a live grant**. Real Zalo or Hosted state is not inferred from values in a customer request.
4. `local-owner-consent-rls.sql`: disposable PostgreSQL Store/Installation consent fixture; Owner may UPDATE only the `state` column via RLS and signed Auth JWT. One-time `pending→approved` and `approved→revoked` transitions use a server-side trigger to set timestamps, with the remaining authority columns immutable by API privilege.
5. `local-merchant-consent-jwt-uat.mjs`: creates two independent **local** GoTrue Auth users, checks genuine JWTs through `/auth/v1/user`, binds synthetic new installations with SQL in a temporary Docker DB, and tests that each signed Store Owner alone can approve/revoke their own installation; cross-Store/anonymous writes are refused, and revoking Store membership blocks access even while JWT remains valid.
6. GitHub Actions in `.github/workflows/tien404-v19811-identity-no-send-qa.yml` and appended existing ephemeral Supabase CLI Docker workflow. No remote Supabase token, Bot Token or live API access in CI.

## Minimum actual real-world evidence required — NOT YET VERIFIED

| Gate | Required independently verified proof | Current |
|---|---|---|
| Provider profile | Successful official POST `getMe` authenticated with Bot Token, returned `result.id` matches expected server-bound Bot | BLOCKED |
| Webhook configuration | Successful POST `getWebhookInfo`, exact HTTPS callback matches the registered protected endpoint; read time and config version recorded without token/URL leakage | BLOCKED |
| Shared secret | Confirm webhook `X-Bot-Api-Secret-Token` is checked using the server-owned matching secret at the protected endpoint; never read secret from chat body | PARTIAL: n8n Header Auth configured, actual shared binding not verified |
| Merchant Auth | Signed unexpired Supabase Auth Owner session + active tenant membership and exact Store-owner membership verified server-side, not provided by a chat sender or user_metadata | BLOCKED hosted |
| Consent | Server-created, single-use challenge; explicitly approved `catalog_readonly` scope for exact installation/Store and binding version by authenticated Owner; revocation effective immediately | BLOCKED hosted |
| Store catalog | Store-scoped hosted RLS using authorized caller principal; no fallback to old tenant-only Commerce Query | BLOCKED hosted |
| Replay and send guard | Installation-scoped durable event dedupe; private text only; `providerSend=false`, `orderWrite=false`, no-snapshot write | CANDIDATE local |

### Operator-only real Zalo read evidence process (requires a separately authorized secure session)

From a trusted local checkout of this Draft PR, use `node qa/channel-v19811/zalo-official-readonly-verifier.mjs --operator-readonly`. The program requests confirmation, then Bot Token, expected Bot ID and current HTTPS callback, all entered without echo. It issues **only** `POST /getMe` and `POST /getWebhookInfo`, checks exact values, prints a sanitized boolean result and then exits. Bot Token is never printed, committed or sent to the assistant. Actual API calls are only permitted if the credential owner authorizes this secure operator action. This script does not touch n8n or configure webhook.

**Important:** An exact webhook URL match plus Bot Token `getMe` is not proof that the owner approved any Store. The next protection gate is a separate authenticated Owner action, not a Zalo sender message. The real Owner session and Store RLS remain blocked on hosted TIEN404 staging.

## Local synthetic QA acceptance

- Bot installation C is bound to Store A, D to Store B under the same fake tenant; fictional Owner Auth identities and local QA Bot references are not production Bot IDs.
- A real local Supabase Auth-issued JWT must approve only its own pending consent via PostgREST `PATCH state`, not SQL-superuser approval.
- Cross Store consent reads and approvals denied; anonymous cannot read; Owner cannot reassign `store_code` or `owner_user_id`; consent revocation blocks read-only admission, and Store membership revoke immediately blocks old valid JWT.
- No real provider send, hosted store read, order/stock write or merchant message in the test environment.

## Rollback and release gate

Closing Draft PR #459 or reverting only `qa/channel-v19811/` and additive CI steps restores prior verified V19.8.10 QA. Docker containers are discarded. No real Zalo, Supabase Hosted, n8n Published, credential or customer data has changed.

**Do not merge/promote until:** independent security review, official provider Bot identity evidence, merchant Owner consent with genuine hosted Store authority, protected Store RLS and explicit go-live approval. A successful GitHub Actions workflow does not clear these gates.

Checkpoint: `V19.8.11_REAL_ZALO_PROOF_PENDING / LOCAL_MERCHANT_JWT_CONSENT_QA / PROTECTED_NO_SEND_ONLY`.
