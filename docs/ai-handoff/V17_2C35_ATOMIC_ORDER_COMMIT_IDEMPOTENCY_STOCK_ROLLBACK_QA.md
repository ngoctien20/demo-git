# TIEN404 AI — V17.2C.35 Atomic Order Commit Candidate × Store-Scoped Idempotency × Stock/Price Rollback QA

Date: 2026-11-18 JST. Parent PR #392 Draft. Previous V17.2C.34 checkpoint SHA `419faff3024e3046237a305ddceaeabad33ff0c9`. User explicitly selected Option A — isolated no-new-Supabase-charge QA, no Pro upgrade, no Supabase branch, no live customer/order data or published workflow changes.

## Actual baseline retained
- V17.2C.34 protected preflight is source-only: every apparently allowed request returns `SECURITY_PREFLIGHT_ONLY_NO_ORDER_WRITE` and `canWriteOrder:false`.
- Live Supabase `public.orders` currently has `tenant_id` but no `store_id`; n8n legacy Messenger Google Sheets Create/Manage/Update workflows remain Published and store-unaware. Do not conflate those with new Commerce multi-Store.
- Supabase `tien404-staging` project ref `ifxlvrhyjhbzbrkdsida` has no development branch; no hosted migration/change permission.
- Existing PostgreSQL 17 ephemeral GitHub CI runs prior RLS, tenant/Store migration preview and consent replay tests before V17.2C.35.

## IMPLEMENTED candidate, CI environment ONLY
- `qa/v172c-rpc-closure/v172c35-atomic-order-commit-CI_ONLY.sql`
  - Guard requires `current_database()='postgres'`, loopback PostgreSQL server address and the earlier synthetic V17.2C.32 schema. It never addresses public Commerce tables or Supabase.
  - Separate schema `tien404_v172c35_atomic_qa` with synthetic Store A/B under tenant-1 and Store C under tenant-2, active trusted installation/membership fixture rows, Store-aware inventory, server-internal private intent fixtures, order headers and order items.
  - Private `commit_synthetic_order(intent_ref,inject_failure)` function is SECURITY INVOKER; schema/function/table privileges explicitly revoked from PUBLIC/anon/authenticated. Invoked only by CI PostgreSQL administrative runner, NOT reachable through a browser/API.
  - The sole caller parameter is an opaque internal intentRef. Function reloads trusted Store/actor/installation/confirmation from synthetic private tables and rejects any legacy lane, stale session, missing one-time consent, inactive membership or installation.
  - Enforces unique `(tenant_ref,store_ref,channel,provider_event_ref)` per order. Transaction-scoped advisory lock serializes retries using this event scope, followed by unique constraint. An exact retry returns `DUPLICATE_SAME_INTENT_NO_WRITE`; event reused for a different intent is DENIED.
  - Product row is selected `FOR UPDATE` by `(tenant_ref,store_ref,sku)` to serialize distinct-event buyers. Unit price and stock are rechecked under that lock; total computed via exact NUMERIC arithmetic, compared to `expected_total_vnd` and guarded against bigint overflow.
  - Stock decrement, order header and order_item insert happen inside the SAME database transaction. SQL exceptions propagate; PostgreSQL automatically rolls back all three writes. Fault injection after stock decrement and after order header is restricted to isolated QA.
  - Output `COMMITTED_SYNTHETIC_CI_ONLY` means **only the ephemeral fixture DB** committed; never means a customer order/stock change in a real system.
- `qa/v172c-rpc-closure/v172c35-atomic-order-commit-ci-drill.sh`
  - Fail-closed on non-local PostgreSQL environment.
  - Verifies anon/authenticated are denied executing function and accessing schema.
  - Negatives: legacy Google Sheets caller, unconfirmed or unconsumed intent, expired/revoked actor, forged installation/Store FK, product missing in Store, changed price/total, insufficient stock, unknown intent.
  - Injects failure after stock and after order header; verifies inventory, orders and items unchanged.
  - Confirms independent Store A/B scoped prices/inventory and replay of same event only once.
  - Concurrent distinct events buying the final unit from Store A must result in exactly one committed transaction and one denied `DENY_STOCK_INSUFFICIENT`.
  - Concurrent intents reusing same provider event in Store C must result in exactly one committed order and one denied `DENY_EVENT_REUSED_FOR_ANOTHER_INTENT`.
  - Revokes actor A after commit, then verifies retry denied while Store B remains independent. Rechecks summed VND totals and item/Order tenant+Store lineage.
- `.github/workflows/v172c15-ephemeral-postgres-qa.yml` extended with a final step invoking this drill on GitHub's ephemeral PostgreSQL 17 container only.

## TESTED evidence
- First candidate workflow run at code commit `6ff9ce7fd5e13189c1992ce77047e7db9565d5b5`:
  - PostgreSQL atomic QA [44240696308](https://github.com/ngoctien20/demo-git/actions/runs/44240696308) — verify final conclusion before declaring PASS.
  - Protected Consent / preflight source regression [44240696305](https://github.com/ngoctien20/demo-git/actions/runs/44240696305) — verify conclusion.
  - RPC privilege/source regression [44240696304](https://github.com/ngoctien20/demo-git/actions/runs/44240696304) — verify conclusion.
- No real Supabase JWT, Messenger webhook signature, Zalo OA identity, private consent or true customer price/stock/order data were tested.

## Remaining P0/P1 gates and limits
- **Not production-ready.** All authorizations are supplied through synthetic trusted fixture flags; actual protected server must verify signed provider event, current Auth session, Store membership, Store installation, explicit confirmation and one-time idempotency inside a real secure transaction.
- A per-Store event uniqueness key is appropriate only after a trusted server binds installation to Store. A forged Store must not change idempotency scope; an AI model or public caller must not supply Store/tenant/order authority.
- Current candidate demonstrates one-line-item order CREATE only. Does not cover split stock reservations, simultaneous ORDER UPDATE/CANCEL, refund/return, payment acceptance, payment webhook, multi-SKU orders, backorders, release of reserved inventory, notification outbox or failures in provider messaging. No send occurs.
- Product price changes and stock are rechecked atomically at commit, but a production system needs immutable price-tier/version policy and audit evidence. Currency VND integer semantics preserved.
- Production service_role/DB privileged access bypasses RLS; exact authorization checks must be enforced server-side and combined with database constraints. No direct public EXECUTE grant.
- Pending V17.2C.32 real Store column migration, provenance/backup/restore, independent owner A/B JWT/consent UAT and security reviewer. P1 GitHub issues #402 and #403 remain OPEN.
- No Supabase upgrade, branch creation, schema/data modification, n8n workflow publish, Messenger/Zalo sends, credential exposure or unexpected charges intentionally initiated. GitHub CI minutes may count against account quotas.

## Rollback
Revert the new SQL, shell test and CI workflow commits on Draft PR #392, or close Draft PR. Ephemeral GitHub CI PostgreSQL services are destroyed at job end; no hosted migration or external customer/order changes exist to roll back.
