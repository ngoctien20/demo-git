# TIEN404 V16.11 — Private Hosted Authority × Real Backup/Restore Authorization × Store JWT-RLS Acceptance Gate

**Date:** 2026-11-16 JST
**Status:** IMPLEMENTED SOURCE ONLY, QA PENDING EXACT HEAD; **HOSTED SECURITY NO-GO**
**Stacked base:** PR #212 HEAD \`f24117b9c9e5ee3700d9172564be7b19993428ed\`. No merge or change to the parent V16.10 #212, V16.9 #207, V16.8 #203, V16.7 #199, V16.3 #194, Hybrid #190, Custom Studio #117 or RPC remediation #186.

## 1. VERIFIED AS-IS: actual hosted metadata (SELECT queries only, no customer records)

- Supabase staging project \`ifxlvrhyjhbzbrkdsida\` is healthy, PostgreSQL 17. The unrelated personal bio Supabase project is not in V16.11 scope.
- Public tables \`tenants\`, \`tenant_memberships\`, \`products\`, \`orders\`, \`customers\` exist. Those tables have RLS **enabled AND FORCE RLS**. This is useful but **not Store isolation**.
- \`public.stores\` and \`public.store_memberships\` ABSENT; \`store_id\` columns in \`products\`, \`orders\`, \`customers\` ABSENT.
- Current product SELECT checks **active Tenant membership**. Current order/customer SELECT checks Tenant owner/manager roles. **No Store-owner predicate** applies to any of the three.
- Existing product unique constraint \`products_tenant_id_sku_key = UNIQUE(tenant_id,sku)\` prevents two same-Tenant Shops using SKU \`SAME01\` with independent prices. \`orders_tenant_id_customer_id_fkey\` only guarantees order/customer share a Tenant, NOT a Store.
- Public SECURITY DEFINER \`qa_shop_b_zalo_claim\` is executable by \`anon\`. \`qa_owner_pairing\` and \`save_merchant_product\` are executable by \`authenticated\`; each still needs exact caller inventory, privileged operation analysis and individually authorized remediation. Do not blindly REVOKE; Zalo Shadow may be a caller. Supabase Security Advisor also warns leaked password protection disabled.
- n8n Published Messenger \`Z7FdV7uDvApfbURQ\`: \`d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92\`; Commerce Tenant Resolver \`5Eeh8hbpsoNhuiVo\`: \`a99c7350-7aea-446d-bdc5-4b10f52c3ad1\`. No new n8n execution or Published edit.
- V16.10 PR #212 exact-head GitHub run #43867059447: 334 Node tests, 68 Chromium checks, synthetic PG17 RLS and local pg_dump→SHA256→pg_restore PASS. **No real JWT Supabase or hosted backup was proven.**

**All above are operational read-only/catalog evidence.** No live merchant Store Owner consent, independently signed backup acceptance, provider Page/OA proof or Cloud license acceptance was obtained in this iteration.

## 2. New V16.11 source artifacts and contracts

- \`docs/ai-handoff/V16_11_HOSTED_READ_ONLY_BASELINE.json\`: versioned verified metadata facts and explicit hosted NO_GO.
- \`qa/v1611-hosted-gates/authority-gate.mjs\`: fail-closed assessment of missing Store schema, Store-aware policy, SKU and order/customer FK; private operator request hygiene; recovery coverage with database + Storage object bytes + Auth/session roles; 15-category QA evidence ledger with separated synthetic actors. **A QA metadata reviewer is NOT a real human security reviewer.** No function can issue a production/hosted capability or perform SQL/backup.
- \`docs/ai-handoff/V16_11_PRIVATE_OPERATOR_APPROVAL_PACKET.json\`: project-specific request ledger. Every proposed hosted backup, restore, Store migration, RPC privilege change, provider connection, paid service and real merchant import is **NOT_AUTHORIZED**.
- \`docs/ai-handoff/V16_11_READ_ONLY_HOSTED_METADATA_QUERIES.sql\`: catalog-only SELECT metadata, wrapped \`BEGIN TRANSACTION READ ONLY\` + \`ROLLBACK\`. **Not executed by CI or in V16.11 hosted.**
- \`qa/v1611-hosted-gates/v1611-gate.test.mjs\`: negative tests for forged proof, role spoofing, JWT/RLS and recovery self-report, unauthorized cost/downtime, private proof leakage, cross-Shop metadata, and immutable production NO_GO.
- \`.github/workflows/v169-onboarding-security-nosend.yml\`: child-only addition of V16.11 source tests to the already proven GitHub Actions trigger, inherits V16.10 PG17 disposable test; original V16.9/V16.10 PR branches remain unchanged.

## 3. HOSTED ACTION GATE — explicit approvals required before any real backup/restore

All planned high-risk actions require a dedicated **change ticket** completed by authorized human operators in a private system (not GitHub, public file, LLM prompt or Messenger). Required named fields:
- **Exact target**: Supabase project reference and whether staging/production (no ambiguous "same as last time").
- **Reason and minimum data scope**: catalog/Store mapping only vs Orders/Customers/PII; legal purpose and merchant DPA. Avoid exposure of customer rows in logs.
- **Owner authority**: merchant or lawful Platform Operator approved, with two-person independent reviewer and scoped evidence references; native provider Page/OA proof for channel integrations.
- **Backup operator**: person authorized to access the actual source project, encryption/key custody, restricted storage destination, checksum evidence, backup type and timestamp/PITR target.
- **Restore target**: independent disposable environment verified to have no real customer access or uncontrolled send; exact resources, cost, retention and destruction date.
- **Recovery plan**: separate DB and Storage Object bytes/metadata, custom role credentials, Auth/session strategy, dependencies, backup and redo/canary plan, RPO/RTO measurement.
- **Security reviewer**: different identity from requesting/deploying/backup operator; real authenticated signature outside this repo.
- **Budget & maintenance window**: explicit amount/time zone, written user approval, downtime and rollback.
- **No privileged RPC revocation** unless all true callers and compatibility evidence are independently recorded and each revocation receives its own signoff.
- **Order data write gate**: exclusive authoritative transaction writer and tested idempotency, inventory price/version checks, no dual writers.

### Required decision status sequence
\`EVIDENCE_MISSING → PRIVATE_INTAKE_REQUESTED → EXTERNALLY_REVIEWED → SPECIFIC_ACTION_AUTHORIZED → DISPOSABLE_RECOVERY_TESTED → REAL_JWT_STORE_RLS_TESTED → PILOT_RELEASE_APPROVAL\`

**V16.11 stops at \`PRIVATE_INTAKE_REQUESTED\` source contract.** None of the later stages can be automatically emitted by the model or these local tests. No self-report is accepted as an independent certification.

## 4. Backup/restore technical distinction

Official Supabase Database Backups guide: https://supabase.com/docs/guides/platform/backups
- Database backups cover database metadata and rows, **not the actual bytes of Storage API objects**. A merchant catalog may include product images and attachments stored in Storage. Recovery planning must handle **both** object metadata consistency and actual object bytes, permissions, paths and expiration.
- Depending on plan, Supabase may provide managed database backups and PITR. The *current TIEN404 project's plan/backup eligibility and available snapshots have NOT been verified*, therefore do not claim they exist or are sufficient.
- Database restore can cause downtime and dependency impacts; do not run one in an active project without an approved window and operator.
- The V16.10 disposable pg_dump/restore proves **only local synthetic data mechanics**, not encrypted production-backup custody, object backups, real customer PII or business RPO/RTO.

## 5. JWT-RLS PRIVATE UAT acceptance, not yet run

**Prerequisites**: approved Store schema + Store memberships in an isolated approved hosted nonproduction environment, duplicate \`tenant_id,sku\` migration compatibility, all legacy rows mapped to real Store with merchant authority, real Supabase Auth accounts Owner A/B (same Tenant distinct Stores) and C (different Tenant), individually authorized independent tester, separate JWTs stored only in private secure environment.

Run the actions through the **same REST/Data API role and route used by the merchant Dashboard**, using proper sign-in; do not substitute SQL Editor postgres, \`service_role\`, text or fake claims. Verify signature, issuer, audience, session revocation and token expiry using supported Supabase Auth controls. Never paste JWT in GitHub PR/logs/chat.

Expected matrix:
| Principal | Own products | Other Store products | Own order/customer | Other Store order/customer | Write outside Store |
|---|---|---|---|---|---|
| Owner A, Tenant 1 | ALLOW | DENY B | ALLOW A | DENY B | DENY |
| Owner B, Tenant 1 | ALLOW | DENY A | ALLOW B | DENY A | DENY |
| Owner C, Tenant 2 | ALLOW | DENY A/B | ALLOW C | DENY A/B | DENY |
| Anonymous | DENY | DENY | DENY | DENY | DENY |
| Revoked/expired owner | DENY | DENY | DENY | DENY | DENY |
| Support without temporary grant | DENY | DENY | DENY | DENY | DENY |

Additional required cases: owner A cannot change \`store_id\`/tenant on a row; cross-Store Customer FK insert rejected; same SKU \`SAME01\` prices are independent; duplicate signed webhook cannot generate two orders or stock deductions; stale JWT and revocation test. Every real mutation UAT must use **dedicated nonproduction synthetic test rows** and rollback transaction/restore as approved. Never use live Orders or Customers.

**Present state:** public Store schema absent; matrix **NOT_RUN_HOSTED**. Pass criteria includes **independent trace**, exact source SHA/API version, token identity assurance without token exposure, reviewer acceptance and reproducibility.

## 6. Release decision, QA, next stage

- PASS on source-only Node/PG synthetic tests proves the source contract and Postgres policy simulation only.
- PRIVATE EVIDENCE = all missing; budget and operator approvals not supplied; real JWT not run; hosted migration not authorized.
- Release **NO_GO** regardless of local test green or merchant self-reported "all done".
- Rollback now: close new V16.11 Draft PR; no hosted resources changed.
- Next: V16.11P — genuinely private Operator Evidence Intake × approved backup-target costing/authorization × signed Store Ownership / Page OA proof. After obtaining that, separately approve a disposable *private* nonproduction restore and real JWT Store UAT. Do not automatically create a Supabase branch/project (costs apply), decrypt backup, or touch hosted schema.
