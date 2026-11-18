# TIEN404 AI — V19.0-B5 Checkpoint

**Date:** 2026-11-18 JST.
**Stage:** Isolated local Worker Binding D1 UAT × Durable Event Processing Contract × Protected Admission Review.
**Decision:** LOCAL_BINDING_TESTED / SOURCE_ONLY_IMPLEMENTED / HOSTED_BINDING_NOT_TESTED / PRODUCTION_NO_GO.

## Continuity and audit
- Parent PR #428 (B4) is OPEN DRAFT, exact head baseline: 163f15258eb10853980d8fe95b46be991c7563ce.
- Ancestors: #423 (B3), #419 (B2); no reimplementation/replacement of their code.
- The immutable deployed Worker source B2 Git blob remains 11affa7658b46ae7c411eed7877d7ccdce61bbad.
- Existing Cloudflare Worker: tien404-v1723u-qa-inbound-locked-staging, deployment 8a43101c-39fa-40a0-a022-2528e54b2102, version 1d2666ac-3b4d-4fd2-9cba-0f05b65dd195. workers.dev and previews disabled.
- Existing B4 disposable hosted D1 was inspected read-only: zero B5 tables, old qa_canary_once still zero, B3 claims four, B4 synthetic registry three.
- Supabase Store authority remains unverified/blocked; no production RLS change.

## IMPLEMENTED on new QA GitHub branch only
1. Local-only SQL schema: v19_b5_qa_inbox with synthetic receipt, lease, retry, DONE and DLQ states.
2. Durable-inbox-contract.mjs: atomic SQL single-statement insert/conflict, claim with crypto.randomUUID lease, time-bound ACK, backoff failure and expired-lease sweep. Default Worker fetch 423.
3. Protected-admission-qa.mjs: server-fixture-only B4 registry lookup; matches do not grant provider, Store, customer, Commerce read/write or send permissions; local QA only.
4. Local-binding-worker.mjs: isolated Miniflare/workerd test harness. It rejects all requests unless explicitly enabled by a hardcoded local fixture binding and exact test path; not a real Zalo webhook.
5. Node.js Miniflare D1 Binding and Python SQLite contract tests.
6. GitHub Actions CI with full B2/B3/B4 regression; pinned Miniflare 3.20250718.3 after runtime verification.
7. ADR with durable event state-machine and security P0/P1 trade-offs.

## TESTED evidence
Inspected successful CI run #44287741595 (before ADR/checkpoint/pinned dependency follow-up):
- Local workerd Miniflare D1 Binding: 11/11 PASS.
- B5 native SQLite exact SQL: 8/8 PASS.
- B4 synthetic registry Node.js: 30/30 PASS.
- B4 SQLite: 10/10 PASS.
- B3 Node.js: 47/47 PASS.
- B3 SQLite: 8/8 PASS.
- B2 Node.js: 105/105 PASS.
- Total: 219/219 PASS, 0 FAILED, 0 SKIPPED. Source SHA guard PASS.
- Initial CI runs failed because D1.exec() treats multi-line/comments as separate statements; the test fixture initializer was fixed to execute each uncommented DDL statement through D1 prepared statements. Final CI verified this behavior.
- No customer/merchant data, credential values, provider send, webhook register, WAF change or real Commerce execution.

**Evidence qualification:** local Worker Binding simulation using workerd is more representative than Node FakeD1 tests, but it is NOT proof of Cloudflare-hosted Worker Binding behavior. Previous B4 hosted Cloudflare D1 REST SQL was not changed in B5.

## BLOCKED / NO-GO
- Real Zalo Bot webhook delivery, Zalo OA signature, real provider getMe/getWebhookInfo and real installation owner binding.
- Canonical Store/Owner A/B authenticated RLS (B4 registry explicitly synthetic).
- Replayable customer event payload contract (B5 intentionally stores only synthetic fixture reference and HMAC, NOT actual messages).
- Durable downstream n8n/Commerce consumer and service-scoped outbox/receipts.
- Ambiguous provider ACK reconciliation; no guaranteed exactly-once external message delivery.
- Hosted Cloudflare Worker Binding QA and request/WAF/TLS observability.
- Production release, messages sent, orders written: NO-GO.

## Changes, backup, rollback
- GitHub QA branch only. No Cloudflare Worker deployment, routes, bindings, secrets, D1 hosted writes, new D1 DB, Supabase migration, n8n publish, Zalo setWebhook or provider send.
- Backup/checkpoint: prior B2 snapshot/blob SHA; exact B4 parent PR SHA, original Worker version.
- Rollback: close PR or revert B5 QA branch. No cloud data to delete; B4 disposable QA tables remain per B4 checkpoint.
- Exact final PR-head CI must be checked after this document and PR creation.

Next proposed V19.0-B6: explicit private hosted Worker Binding admission UAT after operator-scoped approval, plus P0 encrypted replayable inbox and trusted Store authority design. Do not enable any publicly reachable webhook as part of B5.

**Checkpoint:** V19_B5_LOCAL_WORKER_D1_BINDING_219_OF_219__SOURCE_ONLY__HOSTED_BINDING_PENDING__REAL_AUTH_BLOCKED__NO_PRODUCTION.
