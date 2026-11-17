# TIEN404 AI — V17.23S Dedicated Zalo QA Bot Enrollment × Private Webhook Isolation × One Real Inbound Event

**SOURCE-ONLY DRAFT; RECEIVER NOT DEPLOYED; NO BOT ENROLLED; ONE REAL EVENT NOT RECEIVED.**
Parent: [V17.23R PR #386](https://github.com/ngoctien20/demo-git/pull/386), immutable audited starting commit `a243ccf811f5e8143943def3a9dba361822d666b`.

## 1. Verified live state, no duplicate enrolment
- Current Zalo Bot configured in connected n8n: real `getMe` manual exec **5087** success; `getWebhookInfo` manual exec **5088** success with `has_webhook=true`, `matches_staging_webhook=true`, `matches_test_webhook=false`, reported zero sends/changes. This is an **existing staging Bot**, not an isolated QA Bot.
- n8n credentials metadata contains Zalo gateway, Zalo staging, QA pairing etc; no credential alone proves a *second* dedicated QA Bot. No Zalo Bot Manager/Creator account connector is installed to create a Bot on the Owner's behalf. Do not read token bytes, assume ownership or hijack the existing callback.
- Cloudflare already has `tien404-v177h-provider-nosend-inactive-staging` placeholder **returning 404 only**, with no deployed version and workers.dev disabled. Existing issuer/replay Workers are separate and not automatically QA ingress.
- Cloudflare account currently has 3 D1 staging DBs: `tien404-g22-botmap-qa-staging`, `tien404-zalo-live01-security-qa-staging`, `tien404-zalo-replay-staging-v1`. No one has authorized use of those for the new Bot's single-event receipt. **Do not share them or modify their schemas.** An isolated D1 binding is a future cost-bearing decision needing approval.
- Supabase canonical Store A/B, owner attribution, current M0 recovery and issuer-validated real JWT remain blocked. None is a precondition to a fully isolated provider-only QA test that never accesses Commerce.

## 2. Owner's minimum external enrollment — no secrets to chat/GitHub
Official Zalo procedure: in Zalo search **OA Zalo Bot Manager** → **Tạo bot** → **Zalo Bot Creator**; enter a *new* name starting with `Bot`, e.g. `Bot TIEN404 QA S1`. The official manager sends the Bot Token privately. This is an Owner-only step in the official Zalo account. Do NOT use the already-connected staging Bot; do NOT paste token, user identifiers or raw messages into PR, ChatGPT or issue.

After creation a private authorized Operator verifies `getMe` and `getWebhookInfo` using a separate secret manager binding *only* for this new Bot, confirms its identity differs from existing staging Bot and current callback has not been hijacked. An independently confirmed Owner/control proof and scoped one-event/no-send consent (expiry, rollback) are needed before any webhook write.

Official docs:
- https://docs.zaloplatforms.com/docs/BOT/create_bot
- https://docs.zaloplatforms.com/zalo-bot

## 3. Candidate receiver code and isolation contract

`isolated-qa-webhook.mjs`: Cloudflare Worker **candidate for a NEW isolated route**, not an update to the existing inert Worker until separately approved. It intentionally has no Fetch outbound, Meta/Zalo send, n8n call or Supabase data access.

Required private deployment bindings (NOT provisioned):
- `QA_CANARY_MODE=OWNER_SCOPED_PRIVATE_NO_SEND_ONCE` (default if absent: inert 404).
- `QA_CALLBACK_PATH` = unique unguessable `/qa/zalo-bot/<24-80 random URL-safe chars>`, not a path from the existing staging Bot.
- `QA_START_MS`, `QA_END_MS` = scoped window at most 30 minutes. No indefinite public webhook.
- `QA_HEADER_SECRET` = independently configured webhook secret-token for the **new** Bot, never its Bot API token.
- `QA_EVENT_PEPPER` = separate random secret for HMAC redaction (never log/store).
- `QA_CHALLENGE=TIEN404-QA-<random private nonce>`, a one-time test message sent *by a separate authorized test user*, not by Bot.
- `QA_EVENT_DB` = newly approved isolated D1 binding with `disposable-qa-d1.sql` schema applied only after signed go-live approval.

Worker enforces exact path, POST, authenticated secret header, JSON, max 8 KiB, event type `message.text.received`, PRIVATE chat, `is_bot=false`, exact message challenge, provider message timestamp within ±3 min, request window ≤30 min. All user identifiers/chat/text are discarded; only a keyed digest and acceptance time are written to a disposable receipt. SQLite primary-key + atomic `INSERT OR IGNORE` enables precisely one successful inserted event, even across concurrent Worker isolates. Subsequent provider retries get the same empty HTTP 200 ACK. Missing D1 or failed write never gets success ACK; invalid calls are rejected.

**Security nuance**: `X-Bot-Api-Secret-Token` is a shared-secret header, **not a cryptographic signature over event bytes**. Its presence is only one input to acceptance and is vulnerable to credential compromise. The separate HMAC used by the Worker is a *storage digest*, NOT a provider-signed proof. Provider ownership, TLS, request controls, rate limiting, exact event layout, replay provenance, private independent attestations and no-send evidence remain mandatory. Third-party ecosystem examples disagree on flat vs wrapped event payload; this candidate deliberately accepts *only the flat format* and fails closed otherwise. Verify on a dedicated Bot's actual event before approval.

D1 schema is supplied as a **source artifact only**; do not apply to the three existing D1 DBs. Never enable this Worker in the current Cloudflare account without a new scoped approval covering route exposure, secrets, independent no-send monitoring, D1 usage/cost and a specific rollback.

## 4. One real inbound event private test (NOT EXECUTED)
1. Owner independently proves new Bot's control (and dedicated getMe/getWebhookInfo).
2. Approve private HTTPS ingress, new QA D1 and its access policy, WAF/rate limit, secret manager, 30-min window and independent operator/reviewer.
3. Approve `setWebhook` **on the new QA Bot only**, after checking the exact callback. Verify `getWebhookInfo` read-only without touching staging Bot.
4. Test user sends *one* exact disposable challenge to the **new** Bot, once. Capture provider HTTP delivery evidence and D1 one-row receipt. Check missing/wrong header, wrong path, wrong Bot, stale event, forged payload/challenge, replay/race, and no outbound bot reply and no Commerce writes via independent logs.
5. Independent reviewer signs redacted receipt in private evidence registry. No real event payload, QA Bot Token, private path, user/chat id or secret in public code or reports.
6. Disable QA callback/receiver by **approved** QA-only rollback; preserve staging Bot, n8n Published, Commerce and unrelated D1. Retain only privacy-minimized receipt for approved period.

## 5. Actual verification levels
- VERIFIED: existing stage Bot getMe/getWebhookInfo; Cloudflare 404 placeholder; D1 catalog; official Bot Creator steps.
- IMPLEMENTED: isolated event receiver and single-row D1 schema candidate, source-only, not provisioned.
- TESTED: Node synthetic Request/Response + fake D1 atomicity, replay and security regression **after CI success**; NOT Cloudflare workerd/D1 or real provider UAT.
- BLOCKED: new dedicated QA Bot Owner evidence; actual isolated provider ingress; one real inbound event; independent no-send acceptance.
- NO-GO: Store A/B real JWT and cross-channel customer Order queries, plus production.

## 6. Rollback
Close Draft PR for code-only rollback. No hosted changes, financial actions or secrets were performed in V17.23S. Previous getMe/getWebhookInfo audit events remain read-only historical evidence.

References:
- Zalo official Bot creation: https://docs.zaloplatforms.com/docs/BOT/create_bot
- Zalo Bot API overview: https://docs.zaloplatforms.com/zalo-bot
- Zalo Bot webhook event model (third-party, require live confirmation): https://kaiyodev.github.io/zalo-bot-js/en/webhook-events
- Cloudflare D1 prepared statements: https://developers.cloudflare.com/d1/worker-api/prepared-statements/
