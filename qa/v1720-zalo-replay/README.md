# TIEN404 V17.20 — Zalo Bot replay / source authentication CANDIDATE

Status: **SOURCE-ONLY, TESTED IN GITHUB ACTIONS, NOT DEPLOYED**. Scope: staging Bot Creator-style webhook only. This project has separate Zalo Official Account (OA) and Store authorization gates. This source does not authorize merchant data, outbound messaging, orders or payment.

## What official Zalo documentation actually proves

- [Zalo Bot setWebhook](https://docs.zaloplatforms.com/docs/BOT/apis/setWebhook): `secret_token` (8–256 characters) is returned in the `X-Bot-Api-Secret-Token` request header.
- [Zalo Bot Webhook](https://docs.zaloplatforms.com/docs/BOT/webhook): validate that header before processing; `message.text.received` includes `message.message_id`, `message.chat`, and sample `message.date` (milliseconds).
- [Zalo OA user-send webhook](https://stc-developers.zdn.vn/docs/v2/official-account/webhook/tin-nhan/su-kien-nguoi-dung-gui-tin-nhan): OA has **different** `X-ZEvent-Signature` format and separate App/OA authorization and OAuth. Do not pass a Zalo Bot header to the Zalo OA verifier.
- A bearer-like shared header secret **does not bind a cryptographic MAC to each body**. Anyone who learns the secret can replay or fabricate a POST. Claims of "provider independently verified" or "signed every incoming Bot event" are **not justified** by the current staging proof.
- Official docs show a wrapped `{ok:true,result:{...}}` sample; additional implementations report flat events. The source-only candidate accepts both, but this has not been verified against a retained raw Zalo event under the current V1 webhook.

## Existing live system — MUST NOT CHANGE BY THIS CANDIDATE

- `yIJk8LvJoLF40Z62`: Zalo Bot V17.19 staging, Published **`2d912cb0-007f-452f-9536-b92ba12a03e6`**, protected `headerAuth`, ACK-only, Owner/Customer markers, no Zalo outbound, manual ordering disabled.
- Customer Router `sIPs6egzIwOY1GNv` (Owner isolation) and Zalo-Web Core shadow `4ycmVzaNzVRulBjQ` are separate. Previous real Owner `TIEN404 EXT 03` and nonowner Customer `TIEN404 EXT 03` passed staging identity/route gates, and the shared Core correctly denied unbound Commerce Store access.
- Staging HTTP 200 with configured credential / 403 without it passed actual n8n test **#4992**. This is **NOT proof** of idempotency or independent Zalo-origin attestation.
- The present Bot staging workflow uses upserted last-seen QA markers and does **not** have a verified durable replay claim in its inbound V1 path. Marker slots are evidence of last observation, **not** a unique durable event ledger. Do not confuse synthetic `qa_ext03` markers with a per-event replay table.

## Candidate source-only contract

`zalo-bot-replay-gate.mjs` provides `admitBotEvent()` and an **in-memory QA-only** `createInMemoryQaClaim()`.

Pre-admission: the host's real protected ingress must verify the Bot webhook shared header secret using managed credentials, prevent request-body authority spoofing, and resolve the installation from server-owned route registration. **Never** trust an `authenticatedByIngress` or `installation` field taken from the webhook payload.

Admission:
1. Require server-only `HEADER_SECRET_VERIFIED_SERVER_SIDE` and `installation.status=STAGING_ONLY`, `mode=NO_SEND`, `serverResolved=true`, `readOnly=true`.
2. Accept only private human text; deny bot echo, media, unsupported message shapes, forged Store/Tenant/Bot/owner fields, oversized text/body, bad IDs.
3. Require a numeric millisecond `message.date`, not seconds or a guessed missing timestamp. Max age **5 minutes**, future skew max **2 minutes**. Real Zalo message-date presence needs independent compatibility verification before any hosted cutover.
4. Compute HMAC-based event replay key over server-resolved installation + provider event name + provider message ID. HMAC-based payload digest includes timestamp, chat, sender and text without retaining the raw data in the durable claim interface. Rotate/key-management contract before hosted use.
5. Invoke `claimAtomic({key,digest,expiresAtMs})`. The storage implementation must **durably** make unique claims in a single atomic operation across concurrent workers. Return exactly `CLAIMED`, `DUPLICATE`, or `CONFLICT`. Backend unavailable or unknown result → fail closed.
6. Return only `ACCEPTED_SHADOW_ONLY`, `DUPLICATE_NOOP`, or `DENY`, always `canSend:false`, `canWrite:false`, `provider_origin_independently_verified:false`, `customer_route_approved:false`, and **no raw user text**. Owner/Customer routing remains separately enforced by V12.3.

**Do not use the QA Map on hosted systems.** A real datastore may use a unique-index PostgreSQL insert/claim or an existing audit-approved Cloudflare Durable Object. Audit existing TIEN404 hosted replay implementations first; **do not create a second isolated replay system without evidence it is needed**. Require expiry retention of 24 hours or more (candidate `expiresAtMs=now+86400000`), monotonic clock/skew acceptance, network failure behavior, same-key conflict handling, bounded storage and independent cross-instance/parallel QA.

**At-most-once caveat:** an atomic claim alone avoids duplicate processing but can lose an event after claiming if a worker crashes before downstream work. Future commercial side effects require a transactional outbox + per-operation idempotency, not merely this source module. No such side effects are permitted in this phase.

## Verified CI, limits and release gates

- GitHub Actions workflow: `.github/workflows/v1720-zalo-bot-replay-nosend.yml`.
- At commit **`4d5919d556a01d4df0ad587642185baf4b046593`**, [workflow run #44059983581](https://github.com/ngoctien20/demo-git/actions/runs/44059983581) **SUCCESS**, 54/54 Node 22 tests, 0 failures, source-only/static guard PASS; hosted release job intentionally **SKIPPED**.
- One initial CI version had a YAML syntax problem (quoted `Blocked:` within an unquoted YAML scalar); fixed. Second run: unit tests 54/54 PASS, static scan falsely flagged the literal `fetch(` in a test assertion; fixed to scan implementation for actual outbound APIs while separately restricting test imports. Final run succeeded. No live deployment or provider send occurred.
- TESTED: synthetic wrapped/flat events; exact/changed replay; stale/future timestamp; fake Store/Owner claims; untrusted installation; atomic service unavailable; concurrency 25 same-ID events (1 claimed, 24 suppressed) **within a single Node process QA mock**.
- NOT TESTED: real Bot event has `message.date` and ID in accepted bounds; real Zalo network origin beyond shared header; hosted durable claims; multi-region race; real per-Store ownership; Zalo OA OAuth/signature; real customer replies.
- **Promotion NO-GO** until: Owner-approved native Bot secret/route proof, real date compatibility, **hosted durable atomic** replay + concurrent failure recovery QA, verified merchant Store ownership / RLS, native OA-specific signature when OA used, documented rollback, no-send pilot before sends.
- Rollback: close PR #243 or remove new `qa/v1720-zalo-replay` source/CI; **no n8n Published rollback necessary** because none was modified by V17.20.
