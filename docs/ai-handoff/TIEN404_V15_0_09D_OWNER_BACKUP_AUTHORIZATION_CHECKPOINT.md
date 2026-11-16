# TIEN404 AI — V15.0-09D CHECKPOINT
Date: 16/11/2026 JST
Release: DRAFT / NO-SEND / NO-HOSTED-EXPORT / NO-GO

## 1. Inherited checkpoint and current direct verification
Parent: V15.0-09C Draft PR #132 HEAD 70494f279f8efca5b1ac62004c3fca0186d454a0; previous V15.0-09B PR #129, V15.0-09 PR #126 and #125/#123/#122/#121 remain unchanged.
Direct read-only Supabase: ifxlvrhyjhbzbrkdsida ACTIVE_HEALTHY, PostgreSQL 17.11, org plan Free. 2 tenants, 3 Auth users, 3 active tenant memberships, Products 2, Orders 2, QA identity map 2, paired Owner binding 2, QA claim CONFIRMED 3 + pending 1. 19 pairing challenges = 9 used + 10 expired unused + 0 active unused.
No public.stores or public.store_memberships. All seven inspected core business table SELECT policies still Tenant-level, no Store scope. No real four-row Auth→Tenant→Store→Membership certification possible before separately approved schema expansion.
n8n previous G2.1 provider attestor execution #3874/#3880 success and G2.2 #3881 success (manual); NOT equivalent to merchant-independent provider consent G2.3.
Docs https://supabase.com/docs/guides/platform/backups : paid Pro/Team/Enterprise have daily managed backups; Free recommended offsite logical export. No verified real hosted backup or restoration artifact was inspected.
V15.0-09C synthetic PostgreSQL dump→restore and 163/163 offline QA passed previously. This does not establish hosted backup readiness or authorization.

## 2. IMPLEMENTED in this child Draft PR
- docs/ai-handoff/V15_09D_PRIVATE_G23_MERCHANT_OWNER_INTAKE.md: seven-lane independent Owner proof, distinction between per-Store merchant consent and platform data-controller global backup scope.
- docs/ai-handoff/V15_09D_REAL_BACKUP_EXPORT_AUTHORIZATION_REQUEST.md: tightly scoped, one-time STAGING database logical-export authorization request; project controller and independent security approver, destination/privacy, no-cost and retention constraints; all approvals empty; no actual dump.
- qa/v1509d-owner-backup/backup-authorization-gate.cjs: synthetic-only Ed25519 two-signature review model. Privately verified trust anchors not provisioned; module NEVER grants export/restore/migration/production permissions even when synthetic signatures valid.
- qa/v1509d-owner-backup/backup-authorization-gate.test.cjs: generated in-memory ephemeral Ed25519 keypairs, forgery, cross-project, scope, cost, retention, expiry, secret privacy and independent reviewer regression.
- .github/workflows/v1509d-approval-gate-no-send.yml: Node22 offline policy tests and inherited 09C/09B/09/15 security suites; no provider/DB connection or paid model.
- This checkpoint doc: source-only release gates; linked CI must be checked on exact current HEAD.

## 3. Security boundary / blockers
Three distinct approvals exist:
A) Merchant Owner authorizes their particular Shop↔Provider Account/Bot mapping, not a full database export.
B) Platform project data controller authorizes one-time staging database export covering multiple tenants, after data classification, legal basis and minimization.
C) Independent security reviewer verifies owner/operator identity, correct project, off-site encrypted vault, key custody, retention, permissions, spending zero, trust anchors and request expiration.
Real backup operator/supported least-privilege export procedure is a fourth separate permission. Permission to EXPORT is distinct from permission to RESTORE or migrate.
Synthetic offline signatures prove only Node crypto verification works, not real authority: public GitHub cannot host secret keys, approved private signers, JWT, payment info, PII or actual backup artifacts. The module never calls pg_dump or Supabase.
No implicit consent from user request to build V15.0-09D. Request must explicitly authorize real backup after private scope review. Do not infer/issue an authorization simply by setting booleans or a test receipt.
A shop owner cannot authorize exporting customers/Orders of other tenants. G2.3 requires separately verified merchant approval for exact Store/Channel.
No valid unused pairing challenges currently remain; do not create or replay without explicit owner approval.

## 4. QA labeling
VERIFIED: live read-only Supabase and n8n execution metadata, org Free, baseline.
IMPLEMENTED: source-only signing policy, intake docs, tests and CI.
TESTED_OFFLINE: only after latest commit GitHub CI succeeds, count from job log.
BLOCKED: real merchant G2.3; hosting Store ownership; backup authorization; encrypted backup artifact; private restore rehearsal; real signed JWT RLS; commercial launch.
NO-GO: any customer sends, public deployment or production.

## 5. Approval checklist (NOT checked)
- [ ] Explicit owner-authorized private G2.3 evidence review for real Shop A/B/C.
- [ ] Real Data Controller verifies authorized access to entire staging database.
- [ ] Separate Security Reviewer enrolled privately with cryptographic key provenance.
- [ ] Approve destination, encryption, data scope, storage retention, private custody and no-cost budget.
- [ ] Controller signs exact one-time EXPORT scope, reviewer's matching signature validated in trusted backend.
- [ ] User explicitly authorizes export execution after evidence; new cost requires separate approval.
- [ ] Export via approved private operator, secure offsite copy, hash/size/time verified without PII leak.
- [ ] Separately approve isolated RESTORE and verify source coverage, RLS, extensions and Storage assets.
- [ ] Only then consider new Store migration and real JWT/RLS UAT.

## 6. Rollback
No Supabase database migration, no RLS/GRANT/RPC/Auth change, no credential access, no actual backup, no n8n Published workflows edited/executed, no real Messenger/Zalo send, no Cloudflare deploy, no Orders/Stock/customer mutation and no cost incurred. Close this child GitHub Draft PR to roll back source only; parent PR #132 remains intact.
