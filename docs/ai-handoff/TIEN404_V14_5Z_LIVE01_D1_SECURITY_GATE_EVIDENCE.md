# TIEN404 AI — V14.5Z-LIVE-01 D1 ISOLATED SECURITY GATE
Checkpoint: 2026-11-16 JST
State: HOSTED_D1_ATOMIC_QA_TESTED / NO_SEND / LIVE_UAT_NO_GO

## Authorized scope
The owner approved limited staging D1 replay, session CAS and quota work after backup/rollback inspection, **not** live dispatch, production, credential changes, payments, or writes to existing data. The pilot envelope remains one verified Shop B Bot, one verified Owner QA account, max three replies and three model calls in ten minutes, max 2,500 tokens, no real customer, order or inventory writes.

## Original system: READ ONLY (preserved)
- Existing staging Cloudflare D1 database: `tien404-zalo-replay-staging-v1`, UUID `ed487f08-0fde-48c1-8d21-6abb29f3be1b`.
- Original tables: `_cf_KV`, `daily_quota`, `outbound_claims`; still present, schema unchanged in inspection.
- Captured pre-work Time Travel bookmark: `00000023-00000000-00005124-129a4cdbc5a636b79c9c24bb25ae2b54`.
- Read-only follow-up bookmark later advanced to `00000024-00000000-00005124-10362954f71ad5bf74fcfa0c221db276`. This may reflect separate ongoing staging activity and **must not be represented as unchanged data**. This session never issued SQL mutations against this existing DB.
- Cloudflare D1 export API: export completed and returned a signed download URL, but attempting download via the connected Cloudflare execution environment returned HTTP 403. **No independently verified durable SQL backup file was obtained**. Do not falsely report one.
- Because of that and to avoid touching the existing DB, all migrations went to a **new, completely separate QA database**.
- The Worker `tien404-zalo-outbound-v1-staging` remains configured `ZALO_SEND_ENABLED=false`; existing Zalo webhook/n8n Published workflows untouched. No outbound provider send.

## New isolated database (IMPLEMENTED and VERIFIED)
- Name: `tien404-zalo-live01-security-qa-staging`.
- UUID: `d6604745-8f8a-4eac-95a3-83f6e4df0d39`.
- APAC primary, read replication disabled, D1 production **storage-engine version** (not an application production deployment).
- Database **NOT bound** to any current Worker; no public/API route to it and no model/notification sender.
- Existing account D1 count 1; now 2. Cloudflare official included Free tier allows 10 D1 databases, paid allows 100,000 included. No incremental database fee expected under published allowances; actual billing status not independently checked. Rows are synthetic QA.
- D1 Time Travel backend is on; captured clean DB **before first schema** bookmark: `00000001-00000000-00005124-7e28fe0e4fa45171fa2d4fcb632f9e1c`. At that checkpoint no LIVE01 tables existed.
- Before atomic migration #002 bookmark: `00000003-00000000-00005124-3be569b22ae06299b34fa2e3803e7a97`.
- Automatic Time Travel: Cloudflare Free retention 7 days / Paid 30 days; this is a time-limited recovery checkpoint, NOT a permanent external backup.
- Migrations:
  * `qa/zalo-live-v145z/001_live01_qa_d1_schema.sql`: grants, quotas, events, sessions, event-by-session index.
  * `qa/zalo-live-v145z/002_live01_atomic_claims.sql`: fifth table `z145z_live01_atomic_claims` + `z145z_live01_atomic_claim_guard` AFTER INSERT trigger.
- Every QA scope row uses synthetic SHA-256 hashes (tenant/store/bot/recipient/session/event); no raw chat IDs, Bot credentials, client order data, customer PII, provider messages or actual merchant prices.
- The grant table is restricted to `environment='OFFLINE_QA'`, statuses `QA_PENDING/QA_ARMED/QA_STOPPED`; it is not an authenticated real owner grant.

## Atomic guard behavior
The SQLite AFTER INSERT trigger performs a **single statement transaction** for a new claim:
1. Verify active QA grant and 10-minute expiry **using database server time**.
2. CAS-update the scoped session only if expected revision, ascending message sequence, correct session and QA_ACTIVE state match.
3. Reserve one reply, one model call and N bounded tokens against grant quota.
4. Raise an ABORT on any failure, rolling back the event insertion and any preceding session/quota changes.
5. Duplicate event primary key with ON CONFLICT DO NOTHING means no trigger and no extra reservation.
6. No provider HTTP request, no Zalo sender, no actual LLM invocation exists on this D1 path.
**Not yet proven:** real signed grant issuance, authenticated Bot→Shop→Owner routing, accurate live prompt/model token reservation, server-controlled recipient, durable outbound provider receipt/idempotency or final live send.

## Test evidence — actual Cloudflare hosted D1
- Initial 4-table hosted gate: **28/28 PASS**, including duplicate events, stale CAS, 8 concurrent reply claims yielding exactly three, 3 model reservations totaling 2,500, 4th reply/model blocked, expired/stopped/handoff/cross-scope rejected. This suite used synthetic timestamps supplied as SQL parameters, so it was not by itself authoritative time enforcement.
- Improved 5th table + trigger hosted gate: **20/20 PASS**; tested server-side DB current time, replay exactly once, stale CAS rollback, sequence ordering, 501-token overage full rollback, 500-token exact cap, fourth claim blocked, expired grant with DB clock, stop/handoff/cross-shop, eight simultaneous distinct event claims with same revision yielding exactly ONE winner and ONE quota charge.
- Previous local SQLite first gate: 23/23 PASS; final automated atomic SQLite regression: **18/18 local PASS**. Local tests are supplemental, not substitutes for hosted test.
- Historical previous PR #103 CI: run 43727656808 104/104 PASS for earlier V14.5Z/V13.8 components, not this D1 migration. New CI for D1 must be inspected separately after commit.
- **Hosted total for current D1 QA stages: 48/48 PASS, 0 provider sends, 0 real customer data writes.**

## Rollback / backup gate
- New database is unbound: fail-closed by non-exposure; no deployment to revert.
- Immediate lowest risk rollback: leave new QA DB isolated with no Worker bindings; disable future tests and do not reuse grants.
- If destructive rollback is **separately approved**, restore **only database `d6604745-8f8a-4eac-95a3-83f6e4df0d39`** to its pre-schema Time Travel bookmark `00000001-00000000-00005124-7e28fe0e4fa45171fa2d4fcb632f9e1c`; this overwrites the QA DB and deletes all QA tables and fixtures. Must be done within applicable Cloudflare retention, and verify current D1 ID and backup availability immediately before restore.
- Alternative after approval: DROP the exact five `z145z_live01_*` tables and related trigger/index only on the new QA DB, never legacy D1.
- **No restore, DROP, DELETE, old-table modification or Worker binding is authorized or executed in this stage.**
- No SQL export file was saved; a permanent backup should be separately secured before any future production-like state.

## LIVE-01 FINAL APPROVAL REMAINS BLOCKED
1. Real Zalo Bot Creator `getMe` and `getWebhookInfo` read-only checks previously passed (n8n executions 3843 / 3842), BUT the existing R1 Bot registry is only `synthetic_qa/dry_run`; real server-issued Bot→Shop→Owner binding is not verified.
2. The new QA DB is deliberately unbound. Authenticated hosted server component must enforce signed owner grant, exact Bot/shop/recipient, trusted event signature, atomic claim transaction, safe token reservation and send-only receipt/outbox with a kill switch.
3. Actual model budget: n8n Gateway remaining credit balance, unit charges, auto-topup and final money cap still not checked with an authoritative account screen; 2,500 reserved tokens alone is not a measured monetary cap.
4. Hosted RLS of commercial Store data not approved; continue synthetic Shop B only.
5. No permission to change existing Published webhook/Cloudflare outbound, credentials or production. Send pilot needs a NEW explicit last approval of actual bot, verified QA recipient, ten-minute activation window and monetary ceiling after all P0 gates pass.
6. No actual Zalo delivery receipt / 3-turn owner phone UAT yet.

**Release decision: D1-QA-APPROVED / LIVE-SEND-NO-GO.**

## Final independent verification (2026-11-16 JST)
- GitHub Actions run [43731907070](https://github.com/ngoctien20/demo-git/actions/runs/43731907070), job **132865999625**: SUCCESS. Zalo adapter 28/28 + signed-owner preflight 32/32 + inherited V13.8 conversation 44/44 + new D1 atomic SQLite 18/18 = **122/122 PASS**. Static no-send and syntax checks PASS.
- Cloudflare API inspected settings of **17/17 currently listed Worker scripts**, all accessible. **Zero** scripts bind new D1 UUID d6604745-8f8a-4eac-95a3-83f6e4df0d39. Existing Zalo outbound Worker flag ZALO_SEND_ENABLED=false.
- n8n active ingress yIJk8LvJoLF40Z62 remains version 8ca4a6f6-ab3f-42f1-8637-d4f5db790a3e, active; private router sIPs6egzIwOY1GNv remains version 8d91d23c-cd87-462f-a112-9cca2340bec8, active.
- New manual QA workflows OMV22pdETQFVU9ru and xayBLEyUwd64mcLK remain INACTIVE, versions 0bbd2547-e68d-419f-a7cb-3460b38b5528 and 6bf96508-60f6-480a-a5c4-aa8012992a43.
- Validation boundary: hosted D1 QA passed but no paid model invocation, actual Zalo event ingress, signed live bot/recipient binding or provider receipt was exercised by these database tests.
