# TIEN404 AI V13.6M.3 — Canonical Messenger Resolver Pipeline (OFFLINE)
**Date:** 2026-11-15 JST  
**Lifecycle:** EXPERIMENTAL → DRAFT CANDIDATE (not RELEASED)  
**Base:** V13.6M.2 Draft PR #89, SHA `917754e2b54707aae80913bfb3817cad26db6626`.  
**Branch:** `work/v136m3-canonical-messenger-pipeline-offline-20261115`  
**Approval scope:** source-only staging/Draft engineering, review and synthetic QA. No migration/RLS/credential/production/Meta send approval.

## 1. Read-only current system audit — VERIFIED
- `TIEN404_MESSENGER_TEST` n8n `Z7FdV7uDvApfbURQ`: Active/Published version `d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92`, 27 nodes. Unchanged in this version; still separate DEMO order tools.
- `TIEN404_MESSENGER_RICH_UI_CANDIDATE_V13_6M1_NO_SEND` `X0MwwQ7LRUqfOVjM`: Inactive, 5 nodes. Unchanged.
- Supabase staging `ifxlvrhyjhbzbrkdsida` read-only preflight: `public.stores` false, `public.store_memberships` false, `app_private.messenger_page_bindings` false, `public.products.store_id` false. No real hosted multi-store catalog path can be approved.
- V14.2 Draft PR #86 owns Store/RLS migration readiness. Its changes are not approved as deployed; neither migration nor backfill is performed here.

## 2. New source artifacts — IMPLEMENTED
1. `qa/messenger-rich-v136m3/canonical-pipeline.cjs`: one canonical entrypoint `previewMessengerV136M3` with default `mode='BLOCKED'`. Explicitly permits **SYNTHETIC_QA_ONLY**. Verifies raw Messenger HMAC **before any DB repository query**, then uses only `trusted-repository.cjs` for schema preflight, verified Page → Tenant/Store mapping, shop entitlement, read-only Catalog and replay Dry Run. Reuses V13.6M.1 Rich UI renderer. Fails closed on missing proof or mutated/unsanitized results. No service adapter or Graph Send API.
2. `qa/messenger-rich-v136m3/canonical-pipeline.test.cjs`: synthetic suite for signed body, HMAC-before-query, same-tenant two-store A/B, misleading payload tenant/store claims, duplicate/revoked pages, missing Store schema, unauthorized entitlements, duplicate replay, money validity, Data API error sanitization, and no-send invariants. Tests intentionally encode failure for multiple senders in one Store batch rather than silently leaking cross-sender state.
3. `.github/workflows/v136m3-canonical-messenger-qa.yml`: inherited Rich UI+V13.6M.1+V13.6M.2 (both previous contracts) plus canonical new tests, static offline guard.
4. Previous `trusted-resolver.cjs` remains for historical QA/regression only. Canonical runtime path now imports **only** `trusted-repository.cjs`, avoiding ambiguous adapter selection. No edits to previously working published workflows.

## 3. Trust & data flow
```text
Meta raw body + signature
  → verifyMetaRaw BEFORE any DB query
  → private injected restricted read-only database port
  → inspect canonical Store schema + FORCE RLS (synthetic preflight only)
  → unique owner-approved verified Messenger Page → Tenant → Store
  → shop state, pause/entitlement gate
  → signed postback + replay DRY_RUN guard
  → (tenant_id, store_id) exact Catalog SELECT and per-row validation
  → Rich UI PREVIEW ONLY / sendEnabled=false / no order write
```
All source status strings are contracts tested against fictional fixtures; they **do not** prove a real authenticated server, actual Supabase RLS, Meta Page ownership or Meta send.

## 4. QA
- **TESTED:** [GitHub Actions 43710956069](https://github.com/ngoctien20/demo-git/actions/runs/43710956069) **SUCCESS** on source HEAD `37cae96c87482c3b278d9a3bdf1c3391badbf499`: **189/189 Node tests PASS, 0 FAIL, 0 SKIP**, plus static HMAC-first/no-network/no-credentials/no-send assertions PASS. 53 inherited adapter, 41 V13.6M.1 integration, 48 restricted store repository, 22 previous resolver, 25 canonical pipeline cases.
- **VERIFIED:** static safety workflow run had 1/1 job SUCCESS; no real Messenger or Supabase API calls in this CI.
- No real Messenger events, no n8n executions, no actual database Catalog SELECT, no real shop JWT, no sends, no real order changes.
- Static no-network/no-secret tests must remain clean.

## 5. P0/P1 gates and rollback
**P0**: Need approved restorable staging backup/rollback, canonical `stores`/`store_memberships`/`products.store_id`, verified ownership mapping, authorized restrictive Store RLS, hosted JWT A/B same-tenant tests and private Page registry. Ownership + subscription source cannot be self-attested. Restricted DB driver must be audited for real Postgres grants and no `BYPASSRLS`; a `readOnly` flag alone is not proof.

**P1**: Multi-sender batch for same Store fails closed by design; before live rollout, redesign per-event immutable context, PSID-specific session isolation, atomic durable replay/outbox and audit. Meta policy/24h and delivery permission remain untested.

**No approval for:** schema migration, Page token/credentials, actual Messenger send, production deployment, changing payment, releasing Core Bot, merging this PR.

**Rollback:** close/revert this Draft branch/PR only, return to V13.6M.2 SHA `917754e2`. No DB restore/message recall needed because no external state changed.

## 6. Next allowed work
Run offline QA and review; if passed, prepare reviewed plan for V14.2 Store/RLS release gates with explicit owner decisions. Do not bypass V14.2 or turn on Messenger send.

## 7. Owner-facing verdict
- Status: **SOURCE IMPLEMENTED / OFFLINE TESTED / HOSTED BLOCKED / NOT RELEASED**.
- Primary remaining blocker: V14.2 Store RLS/backup and private Page binding registry. Not a reason to alter n8n Published or data without explicit approval.
- Source-only rollback: close Draft PR #90, baseline PR #89 HEAD `917754e2b54707aae80913bfb3817cad26db6626`. No external state mutated.
