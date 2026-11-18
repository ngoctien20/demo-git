# TIEN404 AI — V19.0-B3 Checkpoint

**Date:** 2026-11-18 JST
**Phase:** V19.0-B3 — Bounded Body Timeout × Installation-Scoped Idempotency × Rate Limit.
**Status:** SOURCE-ONLY IMPLEMENTED / OFFLINE TESTED / NO PRODUCTION / NO REAL PROVIDER ADMISSION.

## Provenance
- Parent Draft PR #419: B2 exact Cloudflare Worker snapshot and strict Zalo Bot QA.
- B2 worker source SHA: 11affa7658b46ae7c411eed7877d7ccdce61bbad (preserved by CI).
- B2 Cloudflare Worker version reference: 1d2666ac-3b4d-4fd2-9cba-0f05b65dd195.
- B3 child branch: qa/v19-b3-bounded-replay-rate-limit-20261118.
- B3 new files: ingress-candidate.mjs, disposable-only schema, Node synthetic tests, native SQLite concurrency tests, README, checkpoint, B3 CI.
- No changes to B2 source snapshot or original strict parser.

## Implemented and tested
1. Bounded 8192-byte streamed body read; whole-stream deadline; 408 on timeout; best-effort cancellation.
2. Fail-closed HTTPS-independent synthetic handler with QA-window, shared-header check, exact canonical Zalo Bot schema and default locked 423.
3. Single-statement D1/SQLite fixed-bucket UPSERT rate cap per HMAC installation scope; 429 on exhaustion and 503 on database errors.
4. Single-statement event UPSERT keyed by installation and message; exact retry increments attempts; same ID with changed semantic payload conflicts 409.
5. No raw sender/chat/message ID storage; installation identity is injected in server-configured QA env, never taken from client payload.
6. Unit tests include two installations, simultaneous requests, duplicate retry, forged authority, slow drip, oversize, D1 failures and regression of B2 snapshot.
7. Native SQLite tests run actual SQL extracted from B3 JavaScript source, including concurrent writer contention.

## QA evidence
- GitHub Actions run 44281014625: SUCCESS.
- Node B3: 47/47 PASS.
- Native SQLite: 8/8 PASS.
- B2 regression: 105/105 PASS.
- Combined: 160 tests, 0 failures, 0 skipped.
- Source-immutability check: PASS.
- No external network, Cloudflare D1 mutation, secrets, provider sends or n8n execution by test code.
- Follow-up CI at final PR head must be checked separately.

## Explicit remaining risks
- Fixed-window rate allows bursts across a bucket boundary (up to 2x). No IP-based brute-force limiter.
- Header secret is not a body signature. Independent provider-specific auth and Store binding are not proven.
- SQL atomicity tested only with native local SQLite, not real Cloudflare D1.
- Event is stored with QA_ADMITTED_NO_SEND; no durable processing, retry outbox or downstream ack. NOT safe to serve real customer events.
- Bound cancellation may not terminate all network uploads on every platform. Hosted body/TLS/WAF tests remain blocked.
- Real installation registry mapping, Store A/B RLS, real Zalo Bot webhook and Zalo OA signature are not tested.
- No TTL cleanup, D1 migration or retention changes implemented.

## Operational safety
- Cloudflare Worker, deployments, workers.dev, WAF, routes, bindings, D1, secrets unchanged.
- n8n workflows and AI Core unchanged.
- GitHub branch/CI only, Draft PR is not a production release.
- Backup: B2 snapshot and deployed version recorded. Rollback is to discard/close B3 Draft PR; no cloud rollback necessary because no deploy occurred.

## Next gate
V19.0-B4 — independently review data-plane security and exact admission contract; run isolated disposable D1-based hosted test only after scoped approval. Require trusted installation registry, at-least-once downstream processing design, authenticated Store authority and explicit provider webhook permission before any public ingress.

**Release gate:** V19_B3_OFFLINE_160_OF_160 | SOURCE_ONLY | NO_HOSTED_D1 | NO_PROVIDER_SEND | STORE_RLS_BLOCKED | PRODUCTION_NO_GO.
