# TIEN404 AI — V15.2 ADV.6A: Real Disposable Postgres Nonce Certification × Branch Reconciliation

Date: 2026-11-16 JST.
Release: **EXPERIMENTAL / Draft / No Send / No Hosted DB Change / Not Sales Lite default**.

## 1. Audited and preserved existing work

- PR #163 V15.2-ADV.6 (Canonical Action Gateway × Durable Nonce Design × Verified Identity): OPEN DRAFT at verified HEAD \`0edae15bb9e8256858e5b5db3f516d63cb5dfa75\`, 2/2 CI SUCCESS. This child branch extends PR #163 **without rebuilding it**.
- PR #152 ADV.5 Safe Adapters × HMAC action signer: OPEN DRAFT at \`58cd3acd19982592d05fb41dbe5f829304c51934\`; the existing canonical HMAC V1 signer is retained unchanged. No Ed25519 QA signed *presentation preview* is confused with HMAC signed *action receipt*.
- PR #164 ADV.5.1 Studio/Action vocabulary reconciliation: separate OPEN DRAFT, HEAD \`dd8c205a6183d75981668648a6eb0d43500ef33f\` with 2/2 CI SUCCESS. Its exact mappings remain **not yet merged** here. High-risk Studio actions (draft order create, private TRACK_ORDER, open unapproved link) stay BLOCKED.
- PR #162 ADV.4 Studio: OPEN DRAFT at \`b018524f4a7daeb7ce681195dde365581259bfa2\`. PR #159 canonical registry+Merchant UAT: OPEN DRAFT at \`bfeefe655a95e334de33ba6ca3d75f46b0f1bcc7\`. Neither is included in this child branch; no unreviewed branch mass merge.
- Supabase staging read-only tables: \`public.tenants\`, \`public.tenant_memberships\`, \`public.orders\` exist with RLS enabled, but \`public.stores\` and \`public.store_memberships\` are **absent**. Tenant membership != independent same-tenant Store ownership proof. No database migration, GRANT, RLS policy, app secret or Order row changed.

## 2. Exact scope of ADV.6A

**Actual PostgreSQL 17 running as ephemeral GitHub Actions service, NOT mock**.

Files:
- \`qa/v152-advanced-actions/adv6a-disposable-postgres-schema.sql\`: self-contained, ephemeral private schema and nonce table with digest PK, RLS enabled, no public grants; separate purely synthetic QA business event table. SQL aborts unless database \`adv6a_qa\` and role \`adv6a_qa\`. **Not placed in migration directory**.
- \`qa/v152-advanced-actions/adv6a-disposable-postgres.test.cjs\`: Node test with STRICT preflight requiring GitHub Actions, CI flag, ephemeral marker, loopback PGHOST, known database/user/port. Uses \`pg\` driver only during CI; calls existing \`pg-nonce-store.cjs\`, \`canonical-action-gateway.cjs\`, \`verified-identity-connector.cjs\`. 10 test cases:
  1. Actual PG 17 private nonce RLS and unprivileged role denies SELECT.
  2. 32 concurrent claims from distinct Node pools, one success, 31 duplicates.
  3. Reopen pool, same nonce rejected.
  4. Malformed nonce/expiry and simulated DB-down reject without fallback.
  5. Two canonical gateways + synthetically Ed25519-verified JWT + real PG nonce, one success.
  6. Same-tenant Shop A/B mismatch blocked before nonce.
  7. Tampered JWT, revoked session and revoked membership rejected.
  8. 12 concurrent synthetic *business-effect* inserts and nonce claims in the **SAME** PG transaction: exactly one commit.
  9. Simulated abort -> SQL ROLLBACK of nonce+synthetic event -> authorized retry succeeds once.
  10. All real Commerce/Meta/Zalo send, publish and business execution remain disabled.
- \`.github/workflows/v152-adv6a-disposable-pg-qa.yml\`: postgres:17 isolated service, ephemeral fixture password, Node 22, driver installed into QA directory only, targeted test, inherited canonical gateway/ADV5 adapter regressions, static no-send rules and JSON evidence artifact.

**Important:** Synthetic Event table and synthetic JWT are not real authenticated commerce events. Successful tests show PG primitive/transaction properties in an independent ephemeral environment, NOT RLS/Owner proof on Supabase hosted, not a real trusted provider webhook, not a production business write.

## 3. Acceptance/claims gate

Use only **exact final child Draft HEAD** CI. Do not call TESTED until both jobs complete SUCCESS and artifact confirms:
- \`actualPg17Tested=true\`, \`multipleConnectionsUniqueNonce=true\`, \`poolReconnectReplayDenied=true\`, \`qaTransactionalWriteAtomic=true\`, \`rollbackAfterFailureVerified=true\`, \`syntheticSignedJwtScopeChecked=true\`, \`leastPrivilegeNegativeTest=true\`.
- ALL \`hostedOwnerJwtRlsCertified\`, \`realCommerceTransactionCertified\`, \`actualProviderWebhookCertified\`, \`dbCrashRestartCertified\`, \`livePublishAuthorized\`, \`liveActionAuthorized\` remain **false**, even if ephemeral tests pass.

This is a **local CI instance reboot (pool recreation)** check, not a real database restart/crash recovery or multi-region failover proof.

## 4. P0/P1 still blocked

**P0** Hosted JWT ownership and verified same-tenant Shop A/B row isolation; \`public.stores\` and \`store_memberships\` absent; independent Owner proof and authorized migration needed.
**P0** Dedicated private hosted DB role, backups, review of export and restore evidence, transactional Commerce writer and real idempotency/operation log.
**P0** Provider verified channel ownership and customer consent (Messenger/Zalo/Widget); signed webhook credentials held server-only.
**P0** Real ambiguous/adversarial model intent routing: ADV3B 15/68 offline heuristic diagnostic, 11/20 high-risk misclassified. Zero real presentation model benchmark.
**P1** Registry/Studio/API contract reconciliation across sibling PRs #159/#162/#164/#163, without breaking SHA/CI.
**P1** Actual merchant UAT and per-provider approved capability/fees, rollout/rollback authorization.

**No production merge, send, hosted RLS/GRANT/DDL/DML, key rotation, credential changes, billing or paid model calls.**

## 5. Next safe milestone

**V15.2 ADV.6B — Independent Hosted Store Ownership Proof × Private DB Role Approval × Durable Replay Certification**
1. Independent private owner authority receipt and explicit one-time hosted migration authorization; no checkboxes as approval.
2. Private staging backup/restore evidence before changes; implement approved Store tables/RLS with separate migrations only.
3. Real JWT on hosted QA users, same Tenant A/B isolation and attack tests; independent reviewer.
4. Production-compatible transactional service action and one-time nonce staging review, crash/recovery tests.
5. No provider send/live Commerce until explicitly approved.

## 6. Rollback
Close child Draft. PRs #163/#164/#162/#159/#152 remain unchanged. Ephemeral CI Postgres container destroyed at end of job; **zero hosted database rollback**.
