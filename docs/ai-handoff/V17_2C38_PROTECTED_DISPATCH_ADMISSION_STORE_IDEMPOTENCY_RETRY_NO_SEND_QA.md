# TIEN404 AI — V17.2C.38 Protected Notification Dispatcher Admission × Store-Scoped Delivery Idempotency × Failure/Retry No-Send QA

**Date:** 2026-11-18 JST. **Scope:** Draft PR #392; existing P1 issues #402/#403; Option A (no Supabase Pro upgrade, paid branch, hosted deploy, customer-data write or send). **Source baseline:** V17.2C.37 checkpoint HEAD `27b8f0ab26797885973347988bc81d1c65febae1`.
**Verified QA code SHA:** `f6cf369a1ea8394d105b042d007107884d485035`. **Status:** source-only and isolated PostgreSQL QA PASS; hosted/provider delivery NO-GO.

## 1. Source-of-truth baseline VERIFIED, before write
- V17.2C.37 ephemeral-only schema `tien404_v172c37_outbox_qa.notification_outbox` contains exactly 10 synthetic committed lifecycle events at end of its CI drill. All source events have `dispatch_state='HELD_NO_SEND'` and `can_send=false`. Event uniqueness is `(tenant_ref,store_ref,order_ref,event_type)`; source has no recipient or external sending information.
- Same-tenant Store A/B and cross-tenant C RLS, single-line atomic writer, multiline reservation and no-send expiry worker remain existing, passing regression steps; this stage **does not** replace or modify them in a hosted environment.
- Supabase `tien404-staging` still has 0 development branches, and public Commerce Orders remain tenant-scoped (no store_id); there is no approved live multi-Store writer or real identity/consent UAT.

## 2. IMPLEMENTED — isolated synthetic source only (GitHub Draft branch)
- `qa/v172c-rpc-closure/v172c38-protected-no-send-dispatcher-ci-only.sql` creates private schema `tien404_v172c38_dispatch_qa` only when the prerequisite V17.2C.37 synthetic schema exists in PostgreSQL `postgres`. No production/public Commerce table touched.
- Enhances the *ephemeral* V17.2C.37 outbox with a composite unique source key enabling a five-column FK from the dispatcher queue. Every staged row proves source `event_id + tenant_ref + store_ref + order_ref + event_type`, not a client-supplied Store.
- Private route registry maps synthetic Store B → Zalo and Store C → Messenger. Store A's synthetic Telegram route is disabled. Route admission requires active route, merchant opt-in, subscription active, consent attested, no-send and synthetic-only flags. Store/channel-specific worker registry requires private active attested worker and limits simulated attempts to 1–3.
- Staging `admit_committed_events_no_send()` creates a unique `source_event_id + channel` queue record only for **already committed** outbox events and approved synthetic route. Re-admitting is an idempotent no-op.
- `delivery_queue` states are restricted by DB CHECK to `READY_NO_SEND`, `RETRY_NO_SEND`, `PREVIEW_OK_NO_SEND` and `TERMINAL_NO_SEND`; `can_send=false` is immutable by constraint. There is **no SENT/DELIVERED**, recipient, token, URL, provider integration, or transport adapter.
- `simulate_attempt_no_send(private_worker_ref,synthetic_delivery_id,simulated_outcome,fault)` is a private SQL function with NO SEND implementation. It validates no-hosted release gate, worker's exact Store/channel, route consent/subscription and source outbox, selects one eligible queue row `FOR UPDATE SKIP LOCKED`, writes an attempt ledger, updates queue state and attempt counter **in one transaction**. Duplicate/locked/final records return NO_WRITE, not a second simulated delivery.
- `transient` results use bounded backoff (1 minute after first attempt, 2 after second); max 3 attempts then `TERMINAL_NO_SEND`. `permanent` becomes terminal immediately. `ok` is solely `PREVIEW_OK_NO_SEND` — it is never real customer delivery.
- Fault injection at `after_attempt_log` and `after_queue_update` raises SQL exceptions and rolls back ledger and status/count. The shell drill manually advances fake retry timestamps only in ephemeral CI — no production scheduler.
- `preview_due_no_send(worker_ref)` exposes Store-scoped synthetic count only and requires verified private worker.
- `PUBLIC`, `anon` and `authenticated` have no USAGE/EXECUTE on the private schema. Code is intentionally available only to ephemeral CI administrative principal and contains no provider credentials.
- `qa/v172c-rpc-closure/v172c38-protected-no-send-dispatcher-ci-drill.sh` is a localhost-only regression; workflow `.github/workflows/v172c15-ephemeral-postgres-qa.yml` gained one final V17.2C.38 step. No new workflow/service/schedule was deployed.

## 3. TESTED — GitHub Actions evidence, final code SHA `f6cf369a1ea8394d105b042d007107884d485035`
- [Ephemeral PostgreSQL 17, existing RLS/stock/expiry + new dispatcher QA, run #44246102725](https://github.com/ngoctien20/demo-git/actions/runs/44246102725) — **SUCCESS**.
- [Protected Consent / Source Security, run #44246102762](https://github.com/ngoctien20/demo-git/actions/runs/44246102762) — **SUCCESS**.
- [RPC privilege regression, run #44246102696](https://github.com/ngoctien20/demo-git/actions/runs/44246102696) — **SUCCESS**.

Verified cases:
1. 10 synthetic source outbox events staged exactly once, partitioned by Store B 8/Zalo and Store C 2/Messenger; a second stage pass adds 0.
2. Forged Store/tenant mapping fails exact-source FK; source events that rolled back in V17.2C.37 never enter the queue.
3. Global worker-disabled, unattested/unregistered worker, wrong Store/channel, missing consent, inactive subscription and merchant disabled route all DENIED before recording attempts.
4. `SENT` state or `allow_real_delivery=true` are refused by CHECK constraints. No recipient/provider send fields or external API exist in this schema.
5. Fault after attempt-log or queue update causes **no partial attempt or counter update**. A subsequent simulated result can be recorded exactly once.
6. Transient errors enforce no immediate retry, accept isolated backoff advancement and cap at three attempts. Permanent failures are terminal; a transient error may later receive a simulated preview-success. No state represents delivered.
7. Concurrent workers attempting the same Store C event insert exactly one attempt and leave a terminal preview state; Store B worker cannot operate Store C events.
8. Cross-check all queue rows against authoritative outbox scopes and verify every `delivery_queue.attempt_count` equals its attempt ledger, attempt ceiling 3, zero `can_send` across queue/outbox/attempts.

### Failure found and corrected before final PASS
- First CI run [#44245940095](https://github.com/ngoctien20/demo-git/actions/runs/44245940095) FAILED at the new drill because it assumed the V17.2C.37 race `cancel vs expire` always selected `cancelled`. The prior CI contract deliberately permits either **one** terminal event. Fixed test lookup to select `order.cancelled` **or** `order.expired` for the race Order. No production change or external send resulted.
- Final V17.2C.38 CI on code SHA above fully PASSED. Do not cite the first failed run as successful.

## 4. PROPOSED requirements for any real notification dispatcher (NOT built)
- Secure channel-adapter boundary: resolve tenant/Store/installation/owner, recipient consent, subscription status, messenger/zalo policies, and reason for event before any send. Do not lift simulated flags into production.
- Key business idempotency by `(tenant_id,store_id,event_id,channel,recipient_scope)`, with durable unique constraints and provider response correlation. An internal attempt ledger cannot guarantee true external exactly-once delivery: provider timeouts may leave ambiguous send status. Use reconciled at-least-once semantics, provider dedupe where supported and explicit operator escalation.
- Release gate must require independent source verification, real webhook signature/actor session, Store isolation, confirmed Order commit and outbox atomicity, private channel credentials, secrets rotation, rate limits, delivery and PII audit controls.
- Implement encrypted delivery identities, bounded retries with jitter/circuit breaker, dead-letter retention and reconciliation policy, SMS/messaging cost budget limits, fallback channel eligibility, merchant off-hours and cancellation policy, channel-specific legal/platform rate limits.
- No scheduled dispatcher and **NO REAL SEND** are approved under Option A. Need separate owner approval, independent reviewer, protected hosted environment, restore drill and negative Auth A/B UAT before integration.

## 5. Report status and rollback
- **VERIFIED:** Source input, zero Supabase branches at beginning, PR Draft, all 3 GitHub CI workflows SUCCESS on tested SHA.
- **IMPLEMENTED:** synthetic private route registry, no-send dispatcher queue/attempt ledger, private admission and bounded simulation functions, shell regression and CI step on Draft only.
- **TESTED:** Store scope, no-send constraint, commit provenance, idempotency, rollback, retry and concurrency PASS in ephemeral PostgreSQL 17.
- **PROPOSED:** true provider adapters / dispatcher and operator policy, not currently implemented.
- **BLOCKED:** hosted JWT A/B, cross-channel customer linkage, real Supabase Store-scoped schema, real Order Writer, production notifications, independently approved cost/backup.
- **NO-GO:** any Messenger/Zalo/Telegram/Gmail send, production publish or live multi-Store capability.
- **ROLLBACK:** revert V17.2C.38 Draft source, test and workflow modifications or close Draft PR. GitHub's PostgreSQL 17 container is disposable and destroyed after execution, with no external DB rollback.
