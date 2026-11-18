# TIEN404 AI — V17.2C.37 Reservation Lifecycle Policy × Expiry Worker No-Send Preview × Notification Outbox Atomicity QA

**Date:** 2026-11-18 JST. **Mode:** user-approved Option A (isolated QA; no Supabase upgrade or paid branch, no live writes, no published n8n changes). **Parent:** Draft PR #392 and P1 issues #402/#403.
**Previous verified checkpoint:** V17.2C.36 HEAD `237a8877ccfffe8ececc7e32fb21141fbf3cd259`.
**Tested source SHA:** `a8bac5d1244a6ca2436100c4bd12627d7cfaa384`.

## 1. Verified source baseline
- V17.2C.36 had synthetic multi-line `reserved -> confirmed/cancelled/expired` transitions, atomic Store-scoped inventory locks and a **manually invoked** expiry transition, no schedule or notification outbox.
- Existing V17.2C.36 reservation lifetime in synthetic fixture was **30 minutes**. It is NOT an approved production business policy.
- Real Supabase `public.orders` remains tenant-scoped (no `store_id`); there is no real authenticated multi-Store Orders release or actual Messenger/Zalo identity binding. Existing legacy AI SALES DEMO is separate, not promoted.
- Supabase project `ifxlvrhyjhbzbrkdsida` has zero development branches from read-only connector check at start.

## 2. IMPLEMENTED on Draft PR, GitHub ephemeral PostgreSQL 17 ONLY
1. `qa/v172c-rpc-closure/v172c37-expiry-outbox-ci-only.sql`
   - Fail-closed database + prerequisite schema guard: only synthetically previously created V17.2C.35/V36 fixture in PostgreSQL database `postgres`.
   - Separate private schema `tien404_v172c37_outbox_qa` with `notification_outbox` table. Composite FK binds events to the exact `tenant_ref,store_ref,order_ref`. UNIQUE `(tenant_ref,store_ref,order_ref,event_type)` prevents double event recording.
   - Rigid CHECK constraints enforce `dispatch_state='HELD_NO_SEND'` and `can_send=false`. No recipient, external send address, access token, webhook URL or transport adapter fields.
   - `AFTER INSERT` on synthetic Orders records `order.reserved`; `AFTER UPDATE OF status` records only `order.confirmed|order.cancelled|order.expired`. Trigger only allows a terminal status transition from `reserved`. The Order change and event insert share the **same SQL transaction**. Outbox gate refuses new events when disabled, propagating SQL exceptions to rollback Order/stock changes.
   - Read-only `preview_due_count()` exposes only a synthetic overdue count under private administrative CI principal, not raw customer data.
   - `expire_due_batch_no_send(limit,fault)`: explicit private CI invocation, max 10 orders per batch. Guard requires synthetic, no-send, non-hosted worker gate. Uses `FOR UPDATE SKIP LOCKED` on overdue `reserved` orders, locks order_items' inventory rows in sorted SKU order, releases `reserved` only (does not increment `on_hand`), updates Order status to `expired`; trigger writes `order.expired` in same transaction. Exceptions and injected faults roll back all effects.
   - Private schema/tables/functions explicitly `REVOKE` from `PUBLIC`, `anon`, `authenticated`. Both functions are `SECURITY INVOKER`, accessible to only CI admin runner.
   - There is **NO running scheduler**, no production worker, no remote Supabase migration and **NO dispatch path**. This is a transactional design candidate, not a deployed integration.
2. `qa/v172c-rpc-closure/v172c37-private-expiry-outbox-fixtures-ci-only.sql`: synthetic private intents/line items for Store B/C, due/future/cancel/confirm/race and after-header/outbox refusal scenarios.
3. `qa/v172c-rpc-closure/v172c37-expiry-outbox-atomic-ci-drill.sh`: ephemeral localhost-only shell regression for immutable no-send outbox state, private privileges, no orphan events after failure, concurrent expiry batches, cancel-vs-expire arbitration, exact Store stock reservations, replay and ledger consistency.
4. Existing `.github/workflows/v172c15-ephemeral-postgres-qa.yml` extended with a final V17.2C.37 step after V17.2C.36 regressions.

## 3. TESTED CI — VERIFIED
Source SHA `a8bac5d1244a6ca2436100c4bd12627d7cfaa384`:
- **[PostgreSQL 17 ephemeral integration run #44244085835](https://github.com/ngoctien20/demo-git/actions/runs/44244085835): SUCCESS**, including final `Reservation Expiry Worker Preview and No-Send Outbox Atomicity QA (ephemeral only)` step.
- **[Protected Consent/source #44244085822](https://github.com/ngoctien20/demo-git/actions/runs/44244085822): SUCCESS**.
- **[RPC privilege/source #44244085840](https://github.com/ngoctien20/demo-git/actions/runs/44244085840): SUCCESS**.

Explicit negative/positive checks:
- Outbox table rejects `SENT` even under synthetic PostgreSQL admin; worker gate rejects `no_send=false`; anonymous/authenticated cannot use the private schema/function.
- Failure after creating Order header or deliberate disabled outbox trigger results in **no reserved stock, no Order and no outbox event**; failure of terminal event creation also rolls back cancellation and reserved-stock release.
- Verified `order.reserved`/terminal events only appear after successful commits; retries produce neither duplicate Order nor duplicate outbox event.
- Synthetic overdue preview returns count only and does not change Order or emit events.
- Disabled worker and fault after first released SKU/after terminal status+outbox both roll back completely. Re-running worker on already expired Order returns zero, with one `order.expired` event.
- Independent Store B confirm consumes physical `on_hand` once and inserts one held `order.confirmed` event; cancel frees reservation only and inserts one held `order.cancelled` event.
- Competing cancellation vs expiry for one overdue Order yields only one terminal event, and concurrent workers on a second due Order process it exactly once.
- Exactly **10** events created by new synthetic fixture tests (five reservation, five terminal) and all are `HELD_NO_SEND` with `can_send=false`; Store/SKU reserved inventory ledger equals active reserved OrderItem quantities.
- Existing V17.2C.35 atomic writer and V17.2C.36 multi-line reservation CI steps also passed on the same commit. No external send or live data used.

## 4. PROPOSED reservation lifecycle policy (not approved)
- Current synthetic TTL **30 minutes** exists only in V36 test fixtures. Actual TTL should be configurable per Store or per merchant, bounded by an approved product/business policy with a clear customer-facing meaning (pending vs reserved vs confirmed), and have deterministic timezone/expiry semantics.
- `reserved`: stock held but not sold; `confirmed`: reservation converted into physical stock reduction; `cancelled`/`expired`: reserved quantity released, without increasing physical on_hand. Do not allow conflicting terminal actions.
- Every business transition and outbox event must be transactionally atomic and Store-scoped. Outbox should be an immutable event log with exact tenant, Store, order, event_id and idempotency key; a real dispatcher must independently enforce provider permissions, subscription status, recipient consent, no-send policy, retries/backoff, delivery reconciliation and encryption, and never send before successful DB commit.
- A real expiry scheduler requires bounded, monitored execution, retries, lock timeouts, Store/tenant guard, safe rollback, independent trusted worker credentials, terminal collision handling and expiry notifications only when policy/legal requirements allow.
- No automatic notification just because a test event exists: **send stays disabled**.

## 5. Important limitations / approval gates
- **No actual scheduler**, no deployed outbox/dispatcher, no real signed Meta/Zalo webhook, no customer Auth/consent, no live Store owner mapping or real JWT/PostgREST A/B UAT.
- Existing n8n published Google Sheets order writer path is **not Store-scoped** and must not be transparently bridged into multi-Store Commerce.
- QA provider/actor flags and SQL roles are mock trusted private fixtures under CI administrative principal; NOT proof of live Supabase privileges or production data isolation.
- Production use requires approved canonical Store schema migration, channel-to-Store authority, provenance for legacy orders, approved reservation TTL/business rules, protected writer and worker identities, backup/restore and independent security review.
- No SMTP/Telegram/Messenger/Zalo dispatch, webhook registration, n8n workflow publish, credential, paid Supabase resource or real Order/Stock row modification authorized or performed.

## 6. Status, rollback and next
- **VERIFIED:** source PR status, zero dev branches, CI 3/3 pass at tested SHA.
- **IMPLEMENTED:** private ephemeral outbox trigger, worker candidate/preview, fixture and CI drill.
- **TESTED:** event atomicity, no-send constraints, expiry/cancel races, rollback and Store ledger PASS.
- **PROPOSED:** TTL policy, real expiry scheduler and protected notification adapter architecture.
- **BLOCKED:** Real commerce multi-Store writer/notifications, hosted JWT A/B identity UAT, deployment/production.
- **Rollback:** revert V17.2C.37 Draft PR source and CI commits or close PR. GitHub ephemeral PostgreSQL is removed at job end; no connected runtime/database rollback needed.
- **Possible next checkpoint:** V17.2C.38 — Protected Notification Dispatcher Admission × Store-Scoped Delivery Idempotency × Failure/Retry No-Send QA. No production send until a distinct explicit approval.
