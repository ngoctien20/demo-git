# TIEN404 AI V19.0-B3 — Bounded Body Timeout × Installation-Scoped Idempotency × Rate Limit

STATUS: IMPLEMENTED / OFFLINE TESTED / SOURCE-ONLY CANDIDATE / NO HOSTED INGRESS.
BASE: V19.0-B2 Draft PR #419; exact deployed snapshot and 105 B2 tests remain unchanged.

## Scope
No new Cloudflare Worker or database resources, bindings, WAF policies, Zalo webhook, n8n workflow, credential or commerce actions. Source code only on a separate GitHub branch with offline CI.

The candidate exports a handler only for tests. Its default Worker fetch is HARD-LOCKED at HTTP 423, regardless of configuration, to prevent accidental live admission.

## Bounded body
- Entire stream must finish within QA_B3_BODY_TIMEOUT_MS (permitted 10-5000 ms). Maximum 8192 actual bytes regardless of reported Content-Length.
- A global deadline spans every chunk, not per-chunk timeouts. Timeout results in HTTP 408 and non-blocking best-effort stream cancellation.
- Invalid JSON/UTF-8 400; wrong content type 415; large body 413; invalid strict Zalo Bot shape 422.
- No Zalo OA support, no generic body forwarding.

## Installation-scoped rate limit
- Server-configured installation ID, not any JSON, URL, header-provided store/tenant authority.
- An atomic SQLite/D1 UPSERT with RETURNING counts per HMAC-hashed installation ID in a 60-second fixed bucket. Query in ingress-candidate.mjs; schema in sql/001_disposable_only.sql.
- 429 when quota exhausted. Any D1 SQL exception or unexpected return fails 503. Rate budget consumed after shared header authentication but before body reading, including malformed payloads.
- Default test limit 5 requests/minute/installation, maximum allowable config 20. Fixed window can admit up to double at boundary; do not treat as full WAF replacement.
- Invalid header guesses are outside this D1 rate gate; need edge-layer WAF protection in later hosted test.

## Installation-scoped event uniqueness
- Compound D1 PRIMARY KEY (scope_key,event_key). Both keys HMAC with a Worker-only pepper.
- Event key derives from sender/chat/message ID and type, scope from trusted installation. No raw customer or chat ID is stored.
- First event creates one row with QA_ADMITTED_NO_SEND; a semantically identical retry increments attempts without a second event row. Same event identity but altered semantic payload fails 409.
- Same provider message ID across two trusted installations creates two independent scoped claims.
- No downstream processor, no outbox, no external send and no exactly-once business delivery promise.

## QA evidence
The CI workflow runs:
1. Node.js 22 candidate ingress tests including slow-stream timeout, injection rejection, rate exhaustion, source default 423, concurrent synthetic calls, D1 failures.
2. Native Python SQLite tests on the exact SQL extracted from the candidate source. Tests use separate SQLite connections and concurrent writers to validate atomic statements.
3. Full B2 Node.js 105-test regression.
4. Exact B2 deployed Worker snapshot immutability guard, Git blob 11affa7658b46ae7c411eed7877d7ccdce61bbad.
5. Read-only CI release guard; no deployment or production environment.

The SQLite tests demonstrate SQL atomicity in local SQLite, NOT hosted Cloudflare D1 reliability or real provider behavior.

## Current gate
| Gate | Status |
|---|---|
| Source-only default 423 LOCKED | TESTED |
| Bounded bytes, whole-stream deadline | OFFLINE TESTED |
| Fixed-window rate, D1 UPSERT SQL | SQLITE TESTED / HOSTED NOT TESTED |
| Per-installation event uniqueness | SQLITE TESTED / HOSTED NOT TESTED |
| Real Zalo Bot webhook | BLOCKED |
| Zalo OA | OUT OF SCOPE |
| WAF and TLS | NOT TESTED |
| Installed Bot to trusted Store authority | BLOCKED |
| Hosted D1 migration/schema/retention | NOT DEPLOYED |
| Durable event processor and reconciliation | NOT IMPLEMENTED |
| Production | NO-GO |

## Follow-up approval gates
Independent review; disposable D1-only SQL QA; verify real installation authority and Store RLS; design durable downstream event processing, recovery and retry; define rate/WAF/retention policy. Enabling a public QA URL, changing Cloudflare bindings or any webhook, or calling setWebhook requires explicit target-scoped approval and rollback.

References:
- https://developers.cloudflare.com/d1/worker-api/prepared-statements/
- https://developers.cloudflare.com/d1/worker-api/d1-database/
- https://developers.cloudflare.com/workers/runtime-apis/streams/
- https://docs.zaloplatforms.com/docs/BOT/webhook
