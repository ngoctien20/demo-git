# TIEN404 AI — V13.6M.7 Hosted Gate Evidence Pack & Atomic Replay Migration Review

Checkpoint: 2026-11-15 JST.
Lifecycle: EXPERIMENTAL / DRAFT / TEST-ONLY / NO SEND / NOT RELEASED.
Parent: V13.6M.6 PR #93, HEAD b3636e0da5baf617331c49fdd31d647ab1432fba.
Branch: work/v136m7-hosted-evidence-atomic-pg-review-20261115.
Approved: read-only audits, Draft GitHub, synthetic QA, disposable PostgreSQL CI.
NOT approved: Supabase migration/RLS/backfill, credential/key rotation, real Meta send, actual customer orders, production release, extra-cost branches.

## 1. READ-ONLY LIVE EVIDENCE — VERIFIED

- GitHub Messenger V13.6M.6 PR #93: OPEN DRAFT at baseline; 280/280 offline tests PASS, 2/2 CI jobs SUCCESS at last checked commit.
- V14.2 Store/RLS PR #86 remains DRAFT. Its runbook owns canonical Stores, memberships, product store_id, backup restore, per-record Product/Order ownership and hosted JWT release gates.
- n8n Messenger Published Z7FdV7uDvApfbURQ ACTIVE, 27 nodes, version d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92 unchanged.
- Rich UI QA shadow X0MwwQ7LRUqfOVjM INACTIVE, 5 nodes unchanged.
- Supabase tien404-staging ref ifxlvrhyjhbzbrkdsida runs PostgreSQL 17.11. Absences: public.stores, public.store_memberships, public.products.store_id, app_private.messenger_page_bindings, app_private.messenger_event_claims. Hence real hosted Store RLS and private replay currently BLOCKED.
- Supabase Security Advisors: 1 WARN anon-executable SECURITY DEFINER function, 2 WARN authenticated-executable SECURITY DEFINER functions, 18 INFO RLS enabled without policy, 1 WARN leaked password protection. These are findings for review, NOT proof of exploitation.
- Security advisor reference docs:
  https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable
  https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
  https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy
  https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- Backup listing/export/restore not available through connected Supabase tools. Actual restorable backup is UNKNOWN / NOT VERIFIED. Neither source commits nor row counts nor migration history prove backup.
- Latest inspected migration: 20261114170717. V14.2 Store migration not observed.

## 2. V13.6M.7 SOURCE ARTIFACTS — IMPLEMENTED

1. qa/messenger-rich-v136m7/read-only-hosted-evidence.snapshot.json captures only non-sensitive public/version/security metadata; includes UNKNOWN backup fields and explicit blockers. No JWT, token, passwords, customer identifiers or order data.
2. qa/messenger-rich-v136m7/hosted-evidence-pack.cjs is fail-closed and reports MISSING vs NOT_VERIFIED status for 17 gates. No synthetic input can enable migration, data writes, live Messenger or secret rotation.
3. qa/messenger-rich-v136m7/hosted-evidence-pack.test.cjs covers evidence freshness/shape, missing schema, unknown recovery, fail-closed authorization, migration review and SQL guards.
4. qa/messenger-rich-v136m7/PROPOSAL_ONLY_ATOMIC_REPLAY_MIGRATION_DO_NOT_RUN.sql contains an unconditional RAISE EXCEPTION and comment-only design. NEVER RUN OR CONVERT TO MIGRATION.
5. qa/messenger-rich-v136m7/EPHEMERAL_CI_POSTGRES_ONLY.sql creates test schema only in GitHub Actions disposable PostgreSQL named tien404_replay_ci with a guard checking exact database and user. It is NOT a Supabase migration or hosted test.
6. qa/messenger-rich-v136m7/ci-ephemeral-postgres-atomic.sh is restricted to that test database and requires an explicit CI marker. Tests 32 different PostgreSQL connections for one UNIQUE winner, replay under rotated HMAC versions, same-tenant two-store boundaries, tenant/Page/sender isolation, transaction rollback, connection loss before COMMIT, lease finalize and FORCE RLS default deny.
7. .github/workflows/v136m7-hosted-evidence-atomic-pg-qa.yml runs inherited + new Node suites, disposable real PostgreSQL 17 tests, and independent static guard for no external changes.

## 3. ATOMIC REPLAY MIGRATION — CRITICAL REVIEW FINDING

V13.6M.5 proposed UNIQUE(tenant_id, store_id, page_id, sender_hash, binding_version, event_hash). The sender_hash and event_hash both change during HMAC key rotation. V13.6M.6 synthetic dual-read uses one in-memory process; between independent workers, a read-old/insert-new race can admit TWO logically identical events. These modules are not deployed but must NOT be connected to a real sender without correction.

OPTION FOR REVIEW ONLY: derive a separate, durable canonical_event_digest from a SERVER-ONLY keyed HMAC over fully VERIFIED Tenant/Store/Page/PSID and Meta MID (or controlled deterministic fallback). Use UNIQUE(tenant_id,store_id,page_id,canonical_event_digest) as the PostgreSQL atomic claim arbiter. Versioned sender_hash and event_hash are metadata, not the uniqueness key. Never store raw PSID/payload.

WARNING: this introduces a distinct long-lived canonical anchor secret whose own rotation/tombstone migration is P0, NOT solved by CI. Real retries, distributed workers, session identity, RLS and retention still require owner-approved design and hosted QA.

## 4. QA PROOF AND LIMITS

CI was pending when this checkpoint first authored. Append exact run ID, PASS/FAIL and job conclusions only after verifying.
A passing GitHub ephemeral PostgreSQL test demonstrates only PostgreSQL mechanics in an isolated CI container; it does NOT establish Supabase 17.11 hosted permissions, real Shop A/B JWT RLS, stable HMAC anchor deployment, customer-data isolation or backup restoration.

## 5. P0 OWNER APPROVAL CHECKLIST

- [ ] Gate 0 — Identify real backup ID/timestamp, isolated restore drill, integrity/RTO/RPO checks, rollback plan and owner signature.
- [ ] Gate 1 — Individually verify owner-approved store assignment for 2 existing Products and 2 Orders. No blind synthetic key mapping.
- [ ] Gate 2 — Separately approve V14.2 Stores/Membership/product.store_id migration and atomically replace tenant-only permissive SELECT RLS; review SECURITY DEFINER RPCs.
- [ ] Gate 3 — Verify two real authorized JWTs for TWO STORES IN ONE TENANT, plus cross-tenant negative tests; NEVER use service_role as an RLS acceptance proxy.
- [ ] Gate 4 — Verify private Messenger Page binding, actual Page ownership/consent, restricted non-BYPASSRLS DB role and private schema exposure.
- [ ] Gate 5 — Review Private Event Store and canonical digest secret lifecycle, actual hosted 32+ concurrent clients, crash/restart, retention/tombstones and key rotation.
- [ ] Gate 6 — Separate approvals for Meta provider sends/outbox, customer/stock/order edits, payments, credentials and production.

Without all applicable approvals: MIGRATION_EXECUTION=BLOCKED, HOSTED_REPLAY=BLOCKED, MESSENGER_SEND=BLOCKED.

## 6. ROLLBACK AND NEXT ACTION

Close/revert the V13.6M.7 Draft PR, leaving PR #93 at baseline b3636e0d. GitHub Actions ephemeral PostgreSQL service destroys its test-only synthetic data after job. Supabase staging, Meta, n8n Published, credentials, real customers and bills were NOT changed.

NEXT: Prioritize V14.2 Gate 0 verified restorable backup and Gate 1 Store ownership ledger, then explicit migration/RLS review. Do not keep adding offline-only Messenger features when P0 hosted isolation is unresolved.
