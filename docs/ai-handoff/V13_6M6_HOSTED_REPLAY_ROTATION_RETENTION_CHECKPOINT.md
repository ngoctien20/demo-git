# TIEN404 AI — V13.6M.6 Hosted Replay Security Gate, Retention & HMAC Key Rotation

**Date:** 2026-11-15 JST  
**Stage:** EXPERIMENTAL / DRAFT / SOURCE-ONLY / OFFLINE QA / NO SEND  
**Parent:** V13.6M.5 Draft PR #92 HEAD `9aa08520525d746121194143e521a89393cd3988`  
**Branch:** `work/v136m6-hosted-replay-keyrotation-retention-offline-20261115`  
**Approved scope:** source-only QA, secure architecture review, Draft GitHub PR and checkpoint. NOT authorized: DB schema/RLS changes, hosted writes, credential rotation, Meta Page sends, real orders, production or Core Bot promotion.

## 1. Actual verified preflight (READ ONLY)

- GitHub V13.6M.5 PR #92 remains OPEN DRAFT at the baseline SHA above. Last commit CI had **244/244 offline Node tests PASS**; static release gate SUCCESS.
- n8n Messenger live `Z7FdV7uDvApfbURQ` still Active, version `d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92`, 27 nodes, not edited.
- n8n Rich UI QA Shadow `X0MwwQ7LRUqfOVjM` Inactive, 5 nodes, not edited.
- Supabase staging `ifxlvrhyjhbzbrkdsida` still lacks `public.stores`, `public.store_memberships`, `public.products.store_id`, `app_private.messenger_page_bindings`, `app_private.messenger_event_claims`. Therefore real Hosted Replay, Store RLS, actual Page ownership and Postgres transactions are **BLOCKED**. Read-only query performed; no DDL/DML.
- V14.2 PR #86 owns canonical Store/RLS migration. Do not duplicate/reorder without owner review.

## 2. Implemented Draft source only

1. `qa/messenger-rich-v136m6/hosted-security-gate.cjs` — default-deny readiness gate with explicit proof requirements: backup/restore, V14.2 Store/RLS, Page owner authorization, restricted non-BYPASSRLS PostgreSQL role, Data API exposure/grants, real concurrency/restart QA, retention, HMAC rotation, subscription and owner approval. **Even if 100% synthetic fixture flags are set, hostedReplayEnabled=false and canSendMessenger=false.** Includes a read-only schema preflight SQL string, not a DB connector.
2. `qa/messenger-rich-v136m6/key-rotation.cjs` — synthetic versioned HMAC key ring and per-event multi-version fingerprint lookup, with no raw PSID stored in index and no key material in JSON snapshots. Stale worker/epoch mismatch rejected; previously known key versions must remain available. Test migration v1→v2→v3, duplicate across old/new hashes, same-tenant distinct Store and separate sender.
3. `qa/messenger-rich-v136m6/retention-gate.cjs` — synthetic policy planner; default review retention range 30–365 days (DESIGN DEFAULT, not legal determination). Block unfinished claims, legal holds, pending outbox, too-recent and unproven tombstones. **No deletion and no key removal occurs even if eligibleForOwnerReview.**
4. `qa/messenger-rich-v136m6/security-rotation-retention.test.cjs` — V13.6M.6 QA tests, including 100 overlapping synthetic claims, stale workers, replay after rotation and negative retention cases.
5. `qa/messenger-rich-v136m6/PROPOSAL_ONLY_HOSTED_ROTATION_RETENTION_DO_NOT_RUN.sql` — guarded unconditional `RAISE EXCEPTION` prior to any operations, and comment-only design. **Not a migration; NEVER RUN.**
6. `.github/workflows/v136m6-replay-rotation-retention-qa.yml` — 8 Node security/regression suites + static no-credential/no-provider/no-DDL gate.

## 3. Security design decisions

- **Rotating HMAC without admitting duplicates:** old and new hashes must be compared within a real, atomic backend transaction; naive `SELECT` then `INSERT` across worker processes has a race. This Draft has only a synchronous in-memory simulator, NOT PostgreSQL distributed locking. A real DB-enforced unique canonical key or advisory transaction lock plus controlled key manifest rollout is required before deployment.
- **Stale workers:** reject old-only key manifests after a new version is activated. Rollout needs worker version coordination and lease/fencing tests.
- **Key removal:** cannot remove an old key while historical dedupe records may require it; key rotation and incident response must be reviewed separately. The user has NOT approved changing or rotating any real key.
- **Retention:** delete an old unique row and an old Meta MID could be treated as new; preserve replay tombstone horizon, test late deliveries, coordinate privacy/legal policy, and do not auto-delete CLAIMED, pending or legal-hold events. 30 days here is a QA/design minimum, not a law.
- **Role isolation:** JavaScript `readOnly`/synthetic driver flags are not evidence of PostgreSQL permissions. Supabase `service_role` may bypass RLS. Before hosted, confirm a genuinely restricted private role, authenticated server-side Page→Store identity and negative tests. No trust in client-supplied tenant/store.
- **Provider policy:** Replay/preview readiness cannot authorize a Messenger send, order write, stock change, outbox publish or Page Profile API call.

## 4. QA evidence and caveats

**TESTED:** [GitHub Actions run 43715436829](https://github.com/ngoctien20/demo-git/actions/runs/43715436829) **SUCCESS**, source commit `3565d10183ad1a12167c24cb464262a6ecba9a0c`: **280/280 Node tests PASS, 0 FAIL, 0 SKIP** (244 inherited plus 36 V13.6M.6 tests), 2/2 CI jobs SUCCESS. Static no-network/no-credential/no-send/guarded SQL gate passed. This is a synthetic source-only test; **real hosted Postgres/RLS NOT TESTED**.

The key-rotation index and retention planner are intentionally standalone offline components. No real secrets or PostgreSQL connection are present. No hosted role, backup restoration, server crash/restart, multi-instance transaction, legal retention or Meta 24-hour window has been verified.

## 5. P0/P1 blockers and explicit approval gates

- **P0:** Verified restorable staging backup; V14.2 owner-approved Store/Membership/Product migration and FORCE RLS; hosted Shop A/B same-tenant and cross-tenant negative QA.
- **P0:** Server-authenticated and owner-approved Messenger Page binding; private table schema and Data API exposure audit; restricted non-BYPASSRLS PostgreSQL identity with real grants.
- **P0:** Real PostgreSQL cross-process atomic claim, transaction abort, crash/restart, lease and replay-tombstone QA. Coordinate HMAC key versions; never deploy new keys from this Draft.
- **P0:** Explicit owner authorization for schema change, migration/backfill and any real credential rotation; separate approval for future Meta sends/outbox.
- **P1:** Privacy/data retention policy, pending claim reconciliation, key rotation incident/runbook, on-call alert thresholds and bounded provider throughput tests.

## 6. Rollback

Close/revert the stacked Draft PR and return to PR #92 baseline commit `9aa08520525d746121194143e521a89393cd3988`. No Supabase/Meta/n8n/credential/customer state changed, thus no external DB restore or message recall needed.

## 7. Proposed next milestone

**V13.6M.7 — Hosted Gate Evidence Pack & Atomic Replay Migration Review**, pending explicit approvals and V14.2 backup/RLS gate. Do not automatically merge, deploy, publish or connect real credentials based on offline tests.

## 8. Source-only acceptance record
- **IMPLEMENTED**: default-deny hosted evidence gate, synthetic HMAC manifest/dual-read & stale worker protection, retention review-only planner.
- **TESTED**: 280/280 offline, 2/2 CI jobs at run 43715436829; zero provider sends, no external data mutation.
- **BLOCKED**: real PostgreSQL atomic cross-process locking, schema/RLS, Page consent/ownership, retention legal approval, real key rotation and outbox/Meta sends.
- **Owner approvals NOT requested as execution:** backup/restore and V14.2 migration; separate private Page binding/Event Store grants; separate credential changes and bounded Meta pilot.
