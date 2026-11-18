# TIEN404 V19.0-B5 — Durable Event Processing & Protected Admission ADR

**Date:** 2026-11-18 JST  
**Decision:** SOURCE-ONLY CANDIDATE. No real webhook, no customer payload processing, no production cutover.

## 1. Scope and exact evidence

This ADR covers **LOCAL workerd / Miniflare** D1 Worker Binding UAT; NOT a live Cloudflare-hosted Worker Binding UAT. The isolated Worker uses real local Workers runtime and a local D1 Binding with .prepare().bind().first() and .all() calls.

B4 already verified SQL on Cloudflare-hosted D1 **REST**, in a preexisting disposable QA database. No hosted D1 writes occur in B5. Do not conflate hosted REST and local Binding results.

Dependencies: Draft PR #419 (B2), #423 (B3), #428 (B4). The deployed Cloudflare Worker source snapshot remains immutable.

## 2. Target future architecture, NOT CONNECTED

    Incoming Zalo Bot POST (future)
       |
       +-- Provider-specific authentication + WAF
       +-- Server-owned installation registry -> trusted Store authority
       +-- Strict schema, body-size, timeout, rate/replay admission
       |
       +-- Atomic D1 durable event inbox insert
       +-- HTTP 200 only after persisted admission and provider-approved ACK
       |
       +-- Durable retriable consumer (NOT IMPLEMENTED)
             +-- Lease and fencing token
             +-- Verified tenant/Store-scoped handler
             +-- Idempotent Commerce command
             +-- Retry/backoff + DLQ
             +-- Delivery receipts and ambiguous-ACK reconciliation

No real provider messages are sent by B5. No Commerce data or n8n workflow is accessed.

## 3. Local synthetic-only implementation

Protected B4 registry admission:
- Requires exact synthetic QA installation ref, credential-binding fingerprint, provider zalo_bot, staging environment, QA_LOCKED status and SYNTHETIC_FIXTURE_ONLY proof.
- Only the test harness injects trusted installation ref; never take it from a client header, payload, URL or LLM.
- Even a registry match grants ZERO actual provider identity, Store ownership, customer/order read/write, webhook publication or provider send.
- The only permitted local side effect is a synthetic inbox receipt.

Minimal D1 state model:

    QA_READY_NO_SEND -> QA_LEASED_NO_SEND
      -> QA_DONE_NO_SEND (synthetic completion, NOT external delivery)
      -> QA_RETRY_NO_SEND -> QA_LEASED_NO_SEND
      -> QA_DLQ_NO_SEND after bounded failures

One inbox row per (HMAC installation scope, HMAC event ID), fixture ref and payload digest.
Matching duplicate increments observations without a second row; changed payload fails closed.
Atomic claim checks due time and lease expiration. Cryptographic randomUUID lease fencing rejects stale ACKs.
A failed synthetic attempt is retried after backoff; after 3 attempts state moves to synthetic DLQ.
An expired third lease can be swept to DLQ.

**P0 limitation:** the inbox stores only synthetic fixture refs and HMAC digests, never replayable customer messages. It therefore CANNOT recover/process real messages. Live use requires a separate approved encrypted payload retention contract, an authenticated downstream processor, and secure replays.

## 4. Admission truth table

| Case | Internal QA decision | Commerce access |
|---|---|---|
| Unknown/wrong installation | DENY | DENY |
| Wrong provider/environment | DENY | DENY |
| Wrong fingerprint or expired registry | DENY | DENY |
| Synthetic registry matched | QA_REGISTRY_MATCH_ONLY | DENY |
| Synthetic receipt persisted | QA_RECEIPT_PERSISTED_NO_SEND | DENY |
| Synthetic lease completed | QA_DONE_NO_SEND | DENY |
| Real owner A/B or Store RLS | NOT VERIFIED | DENY |

Never trust client-provided installation_id, store_id, tenant_id, role, customer ID or order ID as authority.
The Zalo Bot shared-secret header is NOT a signed body. Zalo OA requires a separate signature contract.

## 5. Recovery contract and unknown-ack handling

| Case | Decision | Verification scope |
|---|---|---|
| Duplicate exact event | One inbox row, increase observations | LOCAL TESTED |
| Same ID, changed payload | Reject, preserve prior record | LOCAL TESTED |
| Concurrent claims | One successful lease; others deny | LOCAL TESTED |
| Crash during lease | Expire, recover; stale lease rejects | LOCAL TESTED |
| Retryable failure | Backoff, bounded attempts, then DLQ | LOCAL TESTED |
| Exhausted expired lease | Sweep to DLQ | LOCAL TESTED |
| D1 error/unknown commit | Never report durable success without proof | HOSTED FAULT QA NEEDED |
| Provider send gives ambiguous ACK | Reconcile receipt; do not blindly resend | NOT IMPLEMENTED |
| n8n tool ran but reply lost | Store-scoped idempotency + readback | BLOCKED |
| Store A requests B orders | Real RLS denies | BLOCKED |

No exactly-once external delivery claim. A durable ACK must mean persisted and recoverable, not just a hash claim with no event payload.

## 6. CI and QA

- Miniflare local workerd D1 Binding (11 tests) executes Worker logic inside runtime.
- Python native SQLite (8 tests) runs exact SQL extracted from source, including concurrent lease behavior.
- B4 negative registry tests: 30 Node + 10 SQLite.
- B3 webhook reliability tests: 47 Node + 8 SQLite.
- B2 deployed Worker snapshot + strict Zalo contract: 105 Node.
- Total: 219 tests, zero failed in inspected CI; rerun on final PR head.
- Miniflare version 3.20250718.3 pinned after validating the runtime in CI.
- No new Worker, hosted D1 table or database, secret, route, WAF setting, n8n flow or provider webhook.

## 7. Security NO-GO

P0: Missing replayable encrypted payload contract; missing durable downstream processor/outbox; missing real authenticated Store RLS and owner A/B proof.
P1: Unauthenticated bad-secret traffic outside D1 rate limiter; hosted request deadline not proven; Bot callback and Zalo OA provider contracts not end-to-end tested.

The B5 security desk review is evidence-driven, NOT independent human sign-off.

Rollback: close or discard B5 Draft PR, no cloud rollback necessary. Any cleanup of B4 disposable hosted D1 is a distinct destructive action requiring explicit approval.

Next proposed B6: separately scoped, owner-approved hosted PRIVATE Worker Binding QA with explicit access controls and rollback; no active Bot webhook, no real Store data or provider sends.
