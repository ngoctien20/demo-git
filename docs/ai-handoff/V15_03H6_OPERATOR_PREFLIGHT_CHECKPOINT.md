# TIEN404 AI — V15.0-03H.6 · Private Backup Coverage × Operator Authorization Preflight

**Checkpoint: 2026-11-16 JST | SOURCE-ONLY DRAFT / OFFLINE / NO SEND / NO HOSTED EXPORT / NO-GO.**

## 1. Scope
Continue existing V15.0-09D two-signature synthetic review in PR #135, without replacing its approval gate. This child adds a **backup coverage completeness and private operator preflight**; it never verifies actual controller identity, enables real export, signs actual authorization, or accesses any Supabase credential or customer record.

- Shop Merchant Owner approves that Store's exact Provider/Channel binding only; not a multi-tenant database export.
- Platform Data Controller authorizes whole-project privacy scope; Independent Security Reviewer is separate; Backup Operator is a distinct least-privileged actor.
- No real public keys, signature registry, authorized execution adapter, private encrypted vault, or durable one-use authorization ledger is deployed in this draft.

## 2. Direct hosted read-only baseline
Project Supabase staging \`ifxlvrhyjhbzbrkdsida\` on Free tier: 3 Auth users, 2 Tenants, 3 active memberships, 2 Products, 2 Orders, 0 Storage buckets; canonical \`stores\` and \`store_memberships\` absent. Existing Tenant-only Commerce RLS does not certify Store A/B hosted signed-JWT isolation. QA paired/confirmed claims are not independent Owner or provider G2.3 certification.

## 3. Implemented source-only
- \`qa/v1503h6-backup-preflight/backup-coverage-preflight.cjs\`: strict 12-class private coverage **plan**. Required: application schema, business data rows, private schema/data, Auth identities, role grants, RLS/RPC, migration history, Storage metadata, Storage object bytes, external n8n/Cloudflare/provider dependencies, independent data-integrity reconciliation, isolated restore readiness.
- Valid source packet requires 3 different **synthetic** operator/controller/security refs, encrypted vault review **PENDING**, actual privilege check **PENDING**, durable one-use ledger **NOT PROVISIONED**, retention 1–30 days, max additional spend 0, explicit source scope and **no default schema-only dump accepted as sufficient**.
- Reject missing coverage (especially Auth/data/roles), duplicate receipts, unsupported recovery claims, real-action flags, producer send, credentials, unsafe cost and injected sensitive keys.
- Even a fully formed packet returns \`COMPLETE_SOURCE_PLAN_REQUIRES_INDEPENDENT_PRIVATE_REVIEW\` with \`allowedToExport=false\`, \`allowedToRestore=false\`, \`allowedToMigrate=false\`, \`allowedToSend=false\` and all verified states false.
- \`backup-coverage-preflight.test.cjs\`: 35 deterministic offline checks, including forged approvals and missing components.
- \`.github/workflows/v1503h6-coverage-no-send.yml\`: dedicated Node 22 tests and static no-network/no-executor guard, no secrets and no hosted Supabase connection.

## 4. Official documentation and recovery gap
- https://supabase.com/docs/guides/platform/backups — Free does not imply managed scheduled daily backups; plan secure logical offsite exports.
- https://supabase.com/docs/reference/cli/supabase-db-dump — default CLI dump excludes **data and custom roles** and filters managed schemas including **auth/storage**. This code does **not** create a backup or claim Auth users, storage objects, grants, RLS or external resources have been saved.
- Zero current Storage buckets is a metadata observation, not certification of future Storage, Auth or external recovery.
- Any real backup requires a private encrypted destination/custody, reviewed schema/data scope, real least-privilege operator, independent controller/security approvals, explicit user authorization, separately approved costs, and a trusted persistent one-time/revocation mechanism.
- Actual restore is **separately authorized** on an isolated approved target with outbound automations disabled; then validate checksums, roles/policies/RLS, Auth/Storage, object counts, FK, and measured RPO/RTO.

## 5. Blocked gates
1. Independent real Owner/G2.3 Store↔Provider consent: **BLOCKED**.
2. Real signed controller+security approvals, operator eligibility, vault and atomic replay ledger: **BLOCKED**.
3. One-time real hosted logical backup: **NOT APPROVED / NOT EXECUTED**.
4. Independent restore: **NOT APPROVED / NOT EXECUTED**.
5. Hosted Store schema migration and JWT Store A/B/C tests: **NO-GO / NOT TESTED**.
6. Real Sales Lite Commerce/Meta/Zalo/production launch: **NO-GO**.

**Rollback:** close this draft child PR, affecting source only. No change to Supabase Auth, roles, RLS, GRANT, RPC, DDL/DML, Orders/Stock, credentials, n8n Published, real provider sends, production deployment or billing.
