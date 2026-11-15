# TIEN404 AI V14.4.9 — Private Recovery Verification × Merchant Ownership Intake

Date: 2026-11-16 JST. Project: tien404-staging (ifxlvrhyjhbzbrkdsida).
Base: V14.4.8 Draft PR #111. Release: EXPERIMENTAL / GITHUB DRAFT.
Scope: SQL catalog/aggregate reads + isolated source-only metadata QA.
NO hosted database writes, Auth data export, credentials, GRANT/REVOKE,
merchant identity changes, provider sends or production deployments.

## 1. Directly verified hosted audit

Executed exact source file qa/private-recovery-v1449/HOSTED_P0_READ_ONLY.sql
with Supabase plugin on staging in SELECT-only mode.

- PostgreSQL 17.11; Auth users 3; memberships 3.
- 7 app tables reference auth.users through 9 foreign keys.
- Products 2 and Orders 2.
- Six Commerce core tables: RLS ON 6/6, FORCE RLS 6/6, store_id 0/6.
- Six existing tenant-wide PERMISSIVE SELECT policies remain.
- Canonical public.stores and store_memberships absent.
- Products and Orders both have updated_at, but none is Store-scoped.
- No raw user, row, tenant, order, phone, source document or credential
  was exported into this GitHub branch or the audit output.

## 2. Existing operator recovery evidence

Original selective five-schema backup was readable in PG17 local.
Full data restore FAILED because auth.users dependency rows were not included.
Atomic rollback of the failed restore was verified.
Schema-only restore PASSED exit 0, 38 tables with RLS and 12 FORCE tables.
Local no-JWT negative Product RPC was denied and rolled back.

**Full consistent application+Auth recovery remains BLOCKED.**
The old backup is NOT a full restorable Supabase project.
Local restore used --no-owner and --no-privileges, which does not
match hosted grants/owners exactly.

## 3. New source-only artifacts

- qa/private-recovery-v1449/private-recovery-intake.cjs:
  fail-closed offline manifest and merchant evidence intake linter.
  Takes only local private metadata; does not access actual archive or Auth.
  Never sets real-verified, canMigrate, canBackfill or provider-send.
- qa/private-recovery-v1449/private-recovery-intake.test.cjs:
  35 new synthetic tests (including missing Auth backup part, mismatched
  snapshot tags, bad digest/size, unencrypted storage, missing reviewer,
  ambiguous Store owner, duplicated source row, stale row version, forged
  "approved" flags, privacy/redaction).
- qa/private-recovery-v1449/HOSTED_P0_READ_ONLY.sql:
  Supabase staging read-only metadata audit, executed successfully.
- qa/private-recovery-v1449/PRIVATE_BLANK_INTAKE_TEMPLATE.md:
  public, EMPTY template only, never fill or commit real Auth/customer data.
- docs/ai-handoff/V14_4_9_PRIVATE_RECOVERY_MERCHANT_INTAKE_RUNBOOK.md:
  private operator R0–R5 and P01/P02/O01/O02 runbook.
- .github/workflows/v1449-private-recovery-intake-qa.yml:
  Node offline QA plus previously verified v14.4.8 recovery,
  v14.4.3 owner evidence and v14.4.7 Store isolation regressions,
  with SQL/select-only and blank template guard.
- This checkpoint (source and evidence, no real data).

## 4. Boundaries / no-go

- SHA256, manifest metadata, or signed-at boolean claims cannot prove
  true artifact integrity, data snapshot consistency or merchant signatures.
- Successful synthetic tests prove the linter's decision rules ONLY.
- No real full Auth data backup was taken and no actual user data was
  transferred to local, CI or GitHub.
- Neither two tenant groups nor three active owner memberships proves
  actual Store attribution; no blind mapping or backfill is authorized.
- Hosted Store migration, six old policy replacements and real signed
  JWT A/B same-tenant + C separate tenant + R revoked acceptance BLOCKED.
- Existing V14.4.3 four-row evidence linter is reused, not replaced.

## 5. Necessary separate approvals before the real rehearsal

1. Owner authorizes staging-only encrypted consistent backup with Auth
   dependencies, restricted operator storage/retention, independent reviewer
   and no GitHub/ChatGPT upload.
2. Owner approves safe independent restore+rollback and source version
   comparison using an isolated/disposable target.
3. Merchants and independent reviewer authenticate and attest P01, P02,
   O01, O02 privately with direct Store authority and fresh snapshots.
4. Separate approval for hosted Store schema/RLS/GRANT migration, Product V2
   rollout and signed-JWT acceptance. Never infer approval from source QA.

## 6. Rollback and proposed next version

Close/revert this source-only Draft PR. No hosted DB rollback is needed
since no hosted SQL writes, credentials, or published workflow changes happened.

Proposed V14.4.10: Recovery Operator Approval Gate × Independent Store Ownership
Adjudication and Hosted JWT Preflight. This is an approval/verification step,
not auto-deployment. Do not repeat completed local schema-only restore.

QA evidence and final source HEAD to be appended after GitHub Actions completes.
