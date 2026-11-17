# TIEN404 AI — V17.7H.2 Private getMe Owner UAT × One-Event No-Send Readiness

**Checkpoint:** 2026-11-17 JST. **SOURCE-ONLY IMPLEMENTED / REAL BOT OWNER & EXTERNAL NATIVE EVENT: NO-GO.**

## Parent and hosted status

Parent Draft PR #350, HEAD `f885ead22711539e2ca4a6347c804dd16be4aebf`, 564/564 offline tests and 9/9 CI success.

Current inspected Cloudflare Worker `tien404-v177h-provider-nosend-inactive-staging` remains one saved version `c39b8e9d-2dfc-454d-b29d-40b495ff2043`, **0 deployment, 0 binding, no workers.dev, no preview, no public route or domain**. Worker ID `0265c4d1f3d64f9196eb7587b8f1a552`. The saved code only returns 404, and is NOT live.

n8n QA fixture workflow `MQcbjLWZ5QUTJW0k` is Inactive, unchanged. Existing active Zalo Bot staging `yIJk8LvJoLF40Z62` includes marker upsert, so it is not used for a zero-write real QA event. Existing Messenger TEST sends replies, so is excluded. Supabase staging `ifxlvrhyjhbzbrkdsida` QA maps 2 Tenants with maximum 1 Store per Tenant; no real A/B same-Tenant JWT/RLS acceptance. Canonical migration owner is PR #247.

## Official Zalo Bot API contract

- Zalo Bot Creator issues the Bot Token to the creating Zalo account. Token possession is **not** proof of current owner identity, Merchant identity or Store permissions: https://docs.zaloplatforms.com/docs/BOT/create_bot
- Bot Token is carried in the **URL path** (bot + token), persists until reset; sensitive URL logging must be suppressed. See https://docs.zaloplatforms.com/docs/BOT/authorize.
- `POST /bot<TOKEN>/getMe` verifies token validity and gives Bot ID/account_name. Operationally read-only despite HTTP POST: https://docs.zaloplatforms.com/docs/BOT/apis/getMe
- `POST /bot<TOKEN>/getWebhookInfo` reads current webhook URL/updated_at, operationally read-only. Existing callback means **STOP** and no silent re-point: https://docs.zaloplatforms.com/docs/BOT/apis/getWebhookInfo
- `setWebhook`, `deleteWebhook`, `getUpdates` and `sendMessage` are never executed in this phase. Zalo Bot is not Zalo OA (which requires separately verified OAuth/permissions).

## Source-only implementation in V17.7H.2

1. `qa/v17-7a-oa-independent/v17-7h2-private-readonly-bot-probe.mjs`: **OFFLINE_MOCK_READONLY ONLY**, exact getMe -> getWebhookInfo order with mocked POST JSON requests; test-only QA_ONLY token; no global fetch, process.env, real HTTP, logs, retries or redirects. Redacts token, Bot ID, name and URL. Rejects existing callback and untrusted/malformed responses. This is not a live runner.
2. `qa/v17-7a-oa-independent/v17-7h2-private-readonly-bot-probe.test.mjs`: tests ordered two POST calls and negative cases for Bot ID mismatch, real-like token, leaked URL, request exception, malformed/overlarge responses and existing callback no-overwrite.
3. `qa/v17-7a-oa-independent/v17-7h2-one-event-nosend-admission.mjs`: **One inbound event only**, 10-minute planned test window, outbound=0, reads/writes/orders/stock=0, no new public route, no provider secret, durable replay required and independent log audit required. A fully shaped plan always returns real canReceiveRealEvent=false.
4. `qa/v17-7a-oa-independent/v17-7h2-one-event-nosend-admission.test.mjs`: QA for extra messages, wrong channel, increased cost/write/send scope, missing replay, previously active webhook changes, fake independent logs and user-supplied data.
5. `qa/v17-7a-oa-independent/v17-7h2-real-owner-one-event-evidence.json`: current hosted inactive infrastructure and explicit false for REAL owner, provider getMe, callback, event, durable replay and Store Auth.
6. `.github/workflows/v17-7h2-private-getme-one-event-nosend.yml`: inherited A–H.1 suites and H.2 offline test/lint/source-only no-HTTP/no-send/no-DB gate.
7. This checkpoint and future private operator runbook.

## REQUIRED real Bot Creator + operator runbook — NOT EXECUTED

A. Real owner creates or selects one dedicated disposable QA Bot via Zalo Bot Creator. Authenticate with the Zalo-managed account in a **private** separate session. The owner supplies scoped consent to a different operator and independent reviewer, with a challenge valid for <=10 minutes and revocation option. No credentials in ChatGPT, GitHub, CI or chat attachments.

B. Under separately approved private service with short-lived Secret Manager, operator checks Bot ID in Bot Creator, then uses a managed Bot Token ONLY for exactly two business read-only calls (`getMe` and `getWebhookInfo`). Do not log request URLs, provider responses, tokens, customer information or screenshots. Disable redirects/retries and redact errors. **Do not run** `setWebhook` even if the Bot appears idle. If an existing callback is found, stop and preserve it.

C. Operator/reviewer must verify the Bot owner's current admin role independently of the Bot Token. Verify the Bot-to-Store binding separately through real Supabase Auth and current Store membership; do NOT inherit permissions from token or from tenant-only mock mappings.

D. If/when separately approved, provision a **different isolated signed native callback** with provider header verification, authoritative installation registry, hosted durable replay/rate limits, strict no-send/no-write graph and one-event cap. The current V17.7H Worker remains inactive/404-only. Require exact route/domain/budget/rollback approval and prevent reusing the existing Published Bot webhook.

E. Allow exactly one authorized benign QA message only after all approvals. Independently confirm received provider-native signed event, wrong header/replay rejection, zero outbound sends (both provider and n8n logs), zero Orders/Stock writes and zero Store A/B data access (database audit), and recover from any unexpected behavior. A synthetic green receipt is NOT independent acceptance.

F. Zalo OA is separate and remains NO-GO without legitimate OA Admin OAuth. Messenger QA Page has its own owner consent and Meta HMAC verification; do not mix customer identities across channels.

## Status, QA, permission, rollback

- VERIFIED: actual parent PR, inactive Cloudflare Worker/version and read-only n8n/Supabase metadata, official Bot API methods.
- IMPLEMENTED: source-only private Bot readback mock and exact one-event No-Send safety rules, adversarial tests, CI, redacted evidence.
- TESTED: after exact final HEAD CI PASS; neither real getMe nor webhook event was run.
- BLOCKED: authenticated real Bot Creator owner, independently authenticated operator/reviewer, managed private Bot Token, real getMe/getWebhookInfo readback, hosted durable replay, actual native signed one-event callback, external edge verification, Store A/B real Auth JWT/RLS.
- Changed only a child Draft PR; no new Worker, Access rule, webhook, credential, provider call, merchant data, or Commerce change. No extra paid resource created.
- Rollback source: close V17.7H.2 Draft PR. Existing inactive Worker, n8n QA, RPC16 Merchant and legacy Published workflows remain intact.

**Next proposed:** V17.7H.3 — Authorized Disposable QA Bot Owner Evidence × Managed-Secret getMe Read-Only UAT × Independent One-Event Admission Decision. **No live deployment without separately scoped approval.**
