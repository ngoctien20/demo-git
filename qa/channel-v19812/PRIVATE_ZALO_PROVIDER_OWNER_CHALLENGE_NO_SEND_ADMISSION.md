# TIEN404 V19.8.12 — Private Zalo Provider Read-Only Evidence × One-Time Owner Challenge × No-Send Canary

**State: CANDIDATE / tested locally only / hosted NO-GO / no live provider calls / Draft PR #459.**

This phase extends V19.8.11 instead of replacing its working contract. Do not treat simulated webhook HTTP, a locally issued Supabase Auth JWT, or any user-supplied evidence JSON as proof that a real Zalo Bot belongs to a merchant.

## 1. Real-world read-only audit — VERIFIED

- n8n receipt-only workflow `jy7vCmt8LH6BSqGh` remains Active / Published version `175b6609-6a95-4432-986a-075bf8cced35`. The webhook uses an `httpHeaderAuth` credential, but the accessible metadata does **not** prove the header name and secret value match Zalo's configured `secret_token`. No code path in this workflow sends provider messages.
- The n8n QA Bot registry has **2** entries, both `zalo_bot_fixture`, `synthetic_qa`, `dry_run`.
- Supabase staging is healthy but its six public Commerce tables still lack canonical `store_id`. No same-tenant two-Store hosted authority has been accepted.
- The currently connected tools cannot reveal a Zalo Bot Token and did not call the real `getMe` or `getWebhookInfo`. No live Zalo event is sent or reconfigured.
- Previous V19.8.10 local QA already proved mock Installation→Owner→Store binding and catalog retrieval using a real *local* Auth JWT; V19.8.11 local QA proved signed JWT consent state transitions.

## 2. Official Zalo proof contract, not a token request in chat

Authoritative Zalo Bot API:
- `POST https://bot-api.zaloplatforms.com/bot{BOT_TOKEN}/getMe` → `result.id`; validates token association with a Bot, not Store ownership. https://docs.zaloplatforms.com/docs/BOT/apis/getMe
- `POST https://bot-api.zaloplatforms.com/bot{BOT_TOKEN}/getWebhookInfo` → `result.url`, `result.updated_at`. Must match the **independently server-registered** callback for this installation. https://docs.zaloplatforms.com/docs/BOT/apis/getWebhookInfo
- The Zalo webhook uses `X-Bot-Api-Secret-Token` with the configured `secret_token`. This is a **shared-secret header**, NOT the HMAC employed for the mock V19.8.10 tests. A correctly configured n8n Header Auth alone does not validate official Bot/Store ownership. https://docs.zaloplatforms.com/docs/BOT/webhook

### Private operator procedure (pending operator approval and credential custody)

1. From a **trusted local computer**, open the private git checkout and run:

   `node qa/channel-v19811/zalo-official-readonly-verifier.mjs --operator-readonly`

   The already implemented CLI prompts privately without echoing credentials and calls **only** the above two read methods. No `sendMessage`, `setWebhook`, `deleteWebhook`, or provider write. It prints **only** sanitized match booleans, not Bot Token, raw Bot ID or callback.
2. Determine expected Bot ID and HTTPS webhook URL from a **trusted private operator-owned registration**, not a customer message or screenshot. Compare exact values.
3. Privately verify the n8n credential header name equals `X-Bot-Api-Secret-Token` and that the configured value corresponds to the Zalo webhook secret for this specific installation. Neither `getMe` nor `getWebhookInfo` returns the shared secret; the currently available connector does **not** establish this match. Do not copy the secret or raw URL to GitHub/chat/logs.
4. Save a redacted review event in the authorized private audit system: run reference, timestamp, pseudonymous installation reference, credential epoch, webhook configuration version, `getMe` match (true/false), `getWebhookInfo` match (true/false), credential/header binding reviewed (true/false), reviewer identity in the protected system, and a signed evidence provenance. **Do not store Bot Token, full URL, owner JWT, customer conversation or secret.**
5. Even if both official read API checks pass, leave `realMerchantConsentVerified=false` and Commerce rights disabled until a **separate, signed hosted Owner session** proves active tenant and Store ownership and explicitly approves exactly `catalog_readonly_qa_only`.
6. Do not run live Zalo test delivery or setWebhook without separate go/no-go approval; avoid sending a customer response even in a canary.

**Evidence acceptance is blocked at present:** no actual operator-authenticated `getMe`/ `getWebhookInfo` results have been collected by this project, and there is no independently verified hosted Owner-Store consent.

## 3. V19.8.12 one-time Owner challenge — local Docker only

Additive, separate test schema `t404_v19812_challenges` and `t404_v19812_grants`:
- A server-created 256-bit random nonce; **SHA-256 only** stored in the private database; original nonce stays in the local QA process and must never be printed or persisted.
- Challenge is bound to installation, owner Auth user ID, tenant, Store, immutable version and exact read-only scope; expires after **5 minutes**, and can be consumed **exactly once**.
- Authenticated Owner invokes an allowlisted `SECURITY DEFINER` RPC; it checks `auth.uid()` and `auth.role()`, installation active/version, owner consent, tenant+Store memberships, nonce hash, expiry, and locks challenge + grant rows during the atomic transition. These RPCs are **local test functions owned by a disposable database superuser**; never copy to hosted unchanged. A production implementation requires narrower protected roles, explicit grants and independent security review.
- No anonymous execution and no direct authenticated table DML; separate signed Owner-only revocation RPC. No reapproval after revoke/replay; a new installation/version and server-owned consent lifecycle are required.
- The test proves behavior with **real local Supabase Auth JWTs via PostgREST**, not with manually forged SQL `auth.uid()` claims. Test wrong Owner/Store, missing/wrong nonce, expired/replayed challenge, config version change, tenant-only member, revoked Store membership, cross-Store price separation and concurrent double submission.

## 4. Protected no-send receipt canary — localhost only

`local-no-send-canary.mjs` spins up an ephemeral HTTP server on **127.0.0.1**. It accepts synthetic official-shape Zalo payloads only with a matching `X-Bot-Api-Secret-Token` test header:
- Missing/wrong headers return 403; malformed/large payloads, unsupported event, group, bot echo, stale message and replay are denied or ignored.
- Response is minimal no-PII, no chat text, no recipient, and always reports `botIdentityBound=false`, `storeAuthorized=false`, `ownerRoleGranted=false`, `canSend=false`, `canWrite=false`, `providerSends=0`.
- The in-process `Set` used to reject repeated mock message IDs is **NOT** a durable production inbox. The V19.8.10 local PostgreSQL tests separately cover installation-scoped durable QA idempotency.
- This is **not** an acceptance test of a real Zalo delivery or the n8n Published webhook. No real provider token is loaded in CI, no provider API invoked, no Commerce order created.

## 5. Files, QA, safe rollback

- `local-one-time-owner-challenge.sql` and `local-one-time-owner-challenge-uat.mjs` — disposable local real-JWT PostgREST owner challenge and double-submit assertions, run after all V19.8.9–V19.8.11 suites in the same Docker CI.
- `local-no-send-canary.mjs` and `.test.mjs` — real HTTP localhost canary with fictional Zalo-formatted events.
- `PRIVATE_READONLY_EVIDENCE_STATUS_20261120.json` — explicit redacted NO-GO source snapshot; it is **not** verified provider evidence.
- `.github/workflows/tien404-v19812-no-send-canary.yml` — stand-alone, no credential Node CI; shared V19.8.9 Docker CI gains the one-time challenge UAT.

Rollback: close Draft PR #459 or revert only `qa/channel-v19812/` and the two additive workflow sections; local Docker and TCP listener are disposed. No production Supabase, Zalo, n8n Published, credential or customer data is changed.

## 6. Promotion gates — **NOT CLEARED**

1. Actual privately witnessed Zalo `getMe` response with matching registered Bot and `getWebhookInfo` matching independently registered webhook.
2. Verified official webhook shared-secret header association with this installation, not only a generic n8n credential reference.
3. A real signed **hosted** Owner JWT and active Store membership approved via server-issued, one-time challenge for the exact installation/version/scope.
4. Canonical Store-scoped Commerce hosted reader, independent QA and compatibility with existing writer callers.
5. Private hosted no-send canary with signed event evidence, operational rollback, audit log and security approval, then a **separate explicit approval** before any live provider reply, order/stock mutation or tenant rollout.

**Checkpoint:** `TIEN404_V19_8_12_PRIVATE_PROVIDER_EVIDENCE_PENDING / LOCAL_REAL_JWT_ONE_TIME_CHALLENGE_AND_NO_SEND_CANARY / LIVE_NO_GO`.
