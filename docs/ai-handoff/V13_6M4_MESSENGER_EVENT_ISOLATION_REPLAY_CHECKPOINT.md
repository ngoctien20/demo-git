# TIEN404 AI — V13.6M.4 Messenger Per-Event Isolation & Replay Readiness

**Date:** 2026-11-15 JST. **Lifecycle:** EXPERIMENTAL / DRAFT / OFFLINE ONLY.  
**Parent:** V13.6M.3 Draft PR #90, baseline commit `7c1acdd49bc2351a625636dfba7507d25d8cd1e0`.  
**Branch:** `work/v136m4-messenger-event-isolation-replay-offline-20261115`.

## 1. Verified current audit (read only)
- n8n Messenger Published `Z7FdV7uDvApfbURQ`: **ACTIVE** version `d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92`, 27 nodes; unchanged.
- n8n Rich UI staging QA shadow `X0MwwQ7LRUqfOVjM`: **INACTIVE**, 5 nodes; unchanged.
- Supabase staging project `ifxlvrhyjhbzbrkdsida` read-only check: `public.stores` not present; private `app_private.messenger_page_bindings` not present; `public.products.store_id` not present. Therefore hosted multi-shop Catalog and durable database replay remain **BLOCKED**.
- V14.2 Store/RLS Draft PR #86 handles the canonical migration dependency. No schema migration, RLS edit, backfill, credential change, external request or n8n publication was authorized or performed here.

## 2. Implemented (source-only)
1. `qa/messenger-rich-v136m1/integration.cjs`: backward-compatible optional **per-event server-only portsFactory**. Verifies exact raw Meta HMAC before any factory call; each messaging event gets an independent store/Page/PSID resolver. Original single-ports API preserved for inherited regression.
2. `qa/messenger-rich-v136m2/trusted-repository.cjs`: dry-run replay contract now includes the **verified Page ID, sender PSID and Page-binding version**, in addition to tenant_id, store_id and replay event hash. This is source-only and does not store or transmit IDs to any third party.
3. `qa/messenger-rich-v136m3/canonical-pipeline.cjs`: optional eventIsolation mode, retains first verified repository port for first event, builds fresh private scoped port for each further event. No shared issuedScopes across multiple senders.
4. `qa/messenger-rich-v136m4/event-isolation.cjs`: new V13.6M.4 wrapper, forces eventIsolation=true and SYNTHETIC_QA_ONLY, no live send/order/outbox. Includes deterministic **synthetic memory-only** replay model with atomic-in-process claim semantics, 7-day default expiry, scoped fingerprint and safe capacity rejection. Not durable across process restart.
5. `qa/messenger-rich-v136m4/event-isolation.test.cjs`: tests same Page/two senders, separate Pages under the same tenant, same/different MID behavior, signed postbacks, malformed HMAC before any DB call, missing schema, rogue catalog rows, 100 concurrent replay claims and negative cases.
6. `qa/messenger-rich-v136m4/PROPOSAL_ONLY_DURABLE_REPLAY_DO_NOT_RUN.sql`: guarded with an unconditional RAISE EXCEPTION and **no executable DDL or DML**. Reviewed architecture only, not a migration.
7. `.github/workflows/v136m4-messenger-event-replay-qa.yml`: six source/security suites plus static deny-send/deny-write checks. No credentials.

## 3. Architecture
```text
Raw Meta webhook + X-Hub-Signature-256
  └─ VALIDATE exact original byte-level HMAC
       └─ Parse verified multiple event envelopes (Page+sender+mid)
            └─ FOR EACH EVENT create independent server repository scope
                 ├─ Page→Tenant→Store / binding version
                 ├─ Verified entitlement and bot pause
                 ├─ Synthetic replay claim key = hash(tenant/store/page/psid/version/event)
                 └─ Store-scoped read-only catalog + Rich UI preview
  → NO SEND, NO ORDER WRITE, NO DB MUTATION
```
In this milestone the replay implementation is **in-memory synthetic QA only**. The real transaction-safe unique database claim, persisted event processing statuses, expiry and outbox will require a separately approved private schema and negative concurrency testing with restricted PostgreSQL roles.

## 4. QA evidence and status
- **TESTED** on commit `35fa2166db76d7413def1ee69e4c3717f5d8f667`: [V13.6M.4 GitHub Actions run 43712106620](https://github.com/ngoctien20/demo-git/actions/runs/43712106620) **SUCCESS: 211/211 Node tests PASS, 0 FAIL, 0 SKIP**, plus static no-provider-send, no-network, no order-write and fail-closed SQL guards PASS. Includes 53 Rich UI, 41 V13.6M.1 integration, 48 repository, 22 previous resolver, 25 V13.6M.3 canonical and 22 V13.6M.4 event/replay scenarios.
- Inherited [V13.6M.3 run 43712106648](https://github.com/ngoctien20/demo-git/actions/runs/43712106648) SUCCESS; [V13.6M.2 Store/Catalog run 43712106588](https://github.com/ngoctien20/demo-git/actions/runs/43712106588) SUCCESS. These are synthetic GitHub runner tests, **not** hosted Supabase or real provider QA.
- Explicit tests must prove that same-Page/different-PSID batch now works without sharing resolver; prior V13.6M.3 fail-closed behavior remains in its historical entrypoint and V13.6M.4 opt-in changes behavior only for this offline candidate.
- Repeated message IDs from same verified Page/PSID suppressed in synthetic replay; same MID from different sender or store is treated independently.
- No Meta send, receipt, real customer conversation, real Supabase DB event claim, outbox, n8n publish or production deployment was attempted.

## 5. Remaining risks and gates
**P0:**
- Before hosted: V14.2 canonical Store + Product store_id, real JWT A/B same-tenant RLS verification, restorable backup + rollback, owner-approved Page registry and token/permissions/consent.
- Before live: transaction-atomic persisted idempotency with audited retention/TTL, single-writer outbox, retry/crash reconciliation, Meta policy + 24-hour window validation and bounded provider QA. Customer/order changes remain separately approval-gated.

**P1:**
- Sequential per-event handling deliberately avoids shared mutable scopes but has not been load-tested against live Meta webhook retries, timeouts or high-volume bursts; async concurrency is tested only for synthetic replay claims.
- Test-only replay store loses state after process restart and therefore **cannot** prevent duplicate live sends or order creation.
- Do not use the replay proposal SQL as migration. Future staging migration requires backup, explicit approval and tested rollback.

## 6. Rollback and next step
- Close/revert this stacked Draft PR; return to PR #90 baseline SHA `7c1acdd...`. No DB restore, message recall or credential rotation required.
- After offline QA, coordinate V14.2 Store/RLS readiness and prepare an **independent PostgreSQL atomic replay/outbox design review**. Never promote experimental features to Core Bot by implication.

## 7. Release status — source-only
- **VERIFIED:** Published Messenger n8n graph unchanged; existing inactive QA shadow unchanged.
- **IMPLEMENTED:** Isolated per-event scope, synthetic replay and guarded durability design.
- **TESTED:** 211/211 offline Node cases, 0 fail; no messages sent.
- **BLOCKED:** Durable PostgreSQL claim/outbox, multi-store hosted RLS, verified private Page binding, authenticated subscription source, Meta provider pilot.
- **Approval required:** separate backup/restore + Store migration/RLS approval; then private Page registry and provider/token live tests after their own approvals. No merge/deploy or Core Bot promotion is authorized by this checkpoint.
