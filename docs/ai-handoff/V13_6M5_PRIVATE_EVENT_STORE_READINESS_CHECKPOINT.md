# TIEN404 AI V13.6M.5 — Durable Replay & Private Event Store Readiness

**Checkpoint:** 2026-11-15 JST  
**Stage:** EXPERIMENTAL / DRAFT / SOURCE-ONLY / NO SEND / NO DB MUTATION  
**Parent:** V13.6M.4 Draft PR #91 at SHA 4e7c08d2c4a3a5cbc576205a921a6cc5e5d51e55  
**Branch:** work/v136m5-private-event-store-readiness-offline-20261115  
**Approval scope:** only offline source, synthetic QA and Draft PR. No database migration, customer data, Page token, billing, Meta send, n8n publish or production authorization.

## 1. Current audit (VERIFIED, read only)
- PR #91 remained open DRAFT at baseline; inherited V13.6M.4 suite 211/211 and legacy runs SUCCESS.
- Supabase staging project ifxlvrhyjhbzbrkdsida lacks public.stores, public.store_memberships, app_private.messenger_page_bindings, app_private.messenger_event_claims and public.products.store_id. Real private Event Store and hosted Shop RLS are BLOCKED.
- Messenger Published workflow Z7FdV7uDvApfbURQ remains separated from new Draft source; previous verified version d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92 (27 nodes). No n8n workflows edited in this milestone.
- Canonical Store/RLS migration belongs to V14.2 Draft PR #86. Do not bypass it.

## 2. Source artifacts (IMPLEMENTED; never deployed)
1. qa/messenger-rich-v136m5/private-event-store.cjs — isolated HMAC identity, parameterized PostgreSQL transaction contract. Default BLOCKED; only SYNTHETIC_SQL_QA_ONLY with synthetic non-writing driver. Atomic INSERT ON CONFLICT DO NOTHING RETURNING, followed by lease-bound UPDATE where state=CLAIMED. Allowed states CLAIMED, PREVIEW_READY, REJECTED; no SENT, no order write, no provider transport. Bridges to V13.6M.4 DRY_RUN replay port.
2. qa/messenger-rich-v136m5/synthetic-pg-model.cjs — fake in-memory shared table and serialized transaction/rollback simulation, NOT persistent across process restart. NOT proof of hosted Postgres isolation.
3. qa/messenger-rich-v136m5/private-event-store.test.cjs — 33 offline tests for concurrent claims, same-tenant different Store, duplicate, lease and rollback, replay bridge and privacy.
4. qa/messenger-rich-v136m5/PROPOSAL_ONLY_PRIVATE_EVENT_STORE_DO_NOT_RUN.sql — unconditional RAISE EXCEPTION; DDL suggestions are only commented. This file is NOT a migration.
5. .github/workflows/v136m5-private-event-store-qa.yml — inherited and new source suites, separate static safety gate.

## 3. Flow
Meta exact HMAC verified → server-verified Page/Tenant/Store + entitlement → independent per-event scope → keyed HMAC sender_hash/event_hash → proposed future atomic unique claim. First claim => CLAIMED + private lease; duplicate => DUPLICATE_SUPPRESSED; successful preview => PREVIEW_READY; denied event => REJECTED. All results are PREVIEW ONLY, not Meta sends.

If a crash happens after a committed CLAIMED, it remains pending, not silently reclaimed. Transaction rollback before commit permits first claim again. Live retry/outbox reconciliation is a separate design and permission gate.

## 4. Security / readiness gates
- Real DB connected: NO. Real durability, transaction isolation, RLS, grants, session identities: NOT TESTED. Synthetic tests are not proof of these properties.
- Keep raw PSID, customer text, Page token, phone, message content and credentials out of table, logs and frontend. Tests use synthetic secret only.
- Future backend must use a least-privileged non-BYPASSRLS DB role with audited server-owned Page/Store scope. Never infer real security from driver flags or service_role reads.
- Verify public and private schema exposure, RLS and grants with hosted Shop A/B same-tenant and cross-tenant negative tests.
- HMAC key rotation can change fingerprint and permit historical replay unless versioning/dual-read are designed; deletion of old keys can likewise re-allow old events. Retention and key rotation are P0 gates.
- Event claim does NOT authorize order writes or Messenger sends. Outbox/delivery/acknowledgement policy needs separate approval.

## 5. QA
**TESTED** on commit b312476128030a81ce0ddca0552eabd891ca61d7: GitHub Actions run https://github.com/ngoctien20/demo-git/actions/runs/43713967238 **SUCCESS**. Seven-suite Node regression **244/244 PASS, 0 FAIL, 0 SKIP** (211 inherited plus 33 V13.6M.5 cases). Separate static safety/release-gate job also SUCCESS, **2/2 jobs**. No network send or real DB write in QA. A source-only SUCCESS must NOT be described as real durable PostgreSQL readiness.

## 6. Separate owner approvals required before hosted implementation
- [ ] Restorable Supabase staging backup and rehearsed rollback.
- [ ] V14.2 Store, membership, product.store_id, tested RLS and owner backfill.
- [ ] Private verified Messenger Page binding and Page owner consent.
- [ ] Private Event Store schema, restricted DB permissions, real SQL transaction gate.
- [ ] Hosted PostgreSQL concurrency, crash/restart, retention, key rotation, 2 Store/1 Tenant negative QA.
- [ ] Only separately: durable outbox, Meta provider permission/window and bounded pilot.

## 7. Rollback and next
Close this new Draft PR; return to V13.6M.4 baseline SHA 4e7c08d2c4a3a5cbc576205a921a6cc5e5d51e55. No DB restore or message recall is necessary as nothing external was modified.

Next proposed milestone: V13.6M.6 — Authorized Hosted Replay Gate / Key Rotation & Retention, after V14.2 and independent owner approval. Do not merge or deploy on QA PASS alone.

## 9. Final source-only verification
- Re-checked existing n8n Messenger Published `Z7FdV7uDvApfbURQ` ACTIVE unchanged at `d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92`, 27 nodes.
- Re-checked offline Rich UI shadow `X0MwwQ7LRUqfOVjM` INACTIVE, 5 nodes.
- PR #92 OPEN DRAFT, stacked on PR #91, not merged/deployed.
- Status: VERIFIED metadata / IMPLEMENTED source / TESTED synthetic / BLOCKED hosted database / NOT RELEASED.
