# TIEN404 AI V14.4.9 — Private Recovery Verification and Merchant Ownership Intake

**Status:** DRAFT / READ-ONLY HOSTED / OFFLINE QA. **NO AUTH EXPORT OR HOSTED WRITE.**

## A. Real checkpoint used

- Supabase staging `ifxlvrhyjhbzbrkdsida`, PostgreSQL 17.11.
- Aggregate-only SQL audit executed from this branch:
  `qa/private-recovery-v1449/HOSTED_P0_READ_ONLY.sql`.
- Observed: auth.users=3; 7 dependent application tables, 9 foreign keys;
  Products=2, Orders=2; tenant memberships=3; canonical Stores and
  Store Memberships absent; 6 Commerce tables FORCE RLS, none store-scoped;
  six legacy tenant-wide permissive SELECT policies.
- Products and Orders each expose an updated_at column, enabling a
  future authorized private freshness check, **not proving ownership**.
- Original selective five-schema app-only backup: schema-only local restore
  succeeded (38 tables; 38 RLS; 12 FORCE). Full-data restore FAILED when
  auth.users FK was missing. Atomic rollback of that failed restore verified.
- No full application+Auth data restore or independently verified release
  rollback has succeeded.

## B. R0-R5 — Full recovery evidence (private operator only)

**DO NOT start a new sensitive Auth export without separate approval.**

R0. Authorized staging scope: who is permitted to handle backup, storage,
    review and cleanup, least-privilege access, retention period, and budget.
R1. Capture a coherent snapshot of required roles/schema/policies/ACL and
    application+Auth rows. Backup must include referenced auth.users records;
    the old application-only archive alone cannot satisfy this.
    **Four filenames sharing a snapshot label are not proof of consistency.**
    Capture the database snapshot identity/method and independent evidence.
R2. Protect source files with strong encrypted storage and restricted access.
    Never upload backup, password hashes, row content, raw Auth user data, JWTs,
    connection strings or row digests to GitHub, CI, ChatGPT or public logs.
R3. Independently restore on a clean, disconnected/disposable Supabase PG17
    environment. Do not reuse hosted DB or local primary Restore Lab.
    Document engine/CLI version, privileges, exact transaction exit and
    extensions. Do not disable FKs merely to force a false PASS.
R4. Check 9 FK constraints; 7 dependent application tables; relevant Auth row
    count, 2 Products + 2 Orders and privately compared row hashes; policy,
    roles and privilege parity where applicable; prove no orphaned references.
    Rebaseline if counts changed between snapshot and live inspection.
R5. Validate rollback from a separate independent fixture and record proof;
    independent reviewer signs off. Storage and OAuth/webhook/Gateway settings
    are outside a pure database archive and must be reviewed separately.

Official guide: https://supabase.com/docs/guides/self-hosting/restore-from-platform

**No execution commands or credentials belong in this public Draft.**

## C. Four-row Merchant Ownership intake

Private slot inventory, NOT existing database IDs:

| Slot | Source | Primary source evidence | Authorized merchant | Independent reviewer |
|---|---|---|---|---|
| P01 | Product | Original catalog/import lineage | Required | Required |
| P02 | Product | Original catalog/import lineage | Required | Required |
| O01 | Order | Order-origin/integration record | Required | Required |
| O02 | Order | Order-origin/integration record | Required | Required |

Each PRIVATE record packet must bind: exact existing row ID, tenant ID,
candidate approved Store ID (once registered), source updated_at, source
snapshot digest/version, origin document, actual Store merchant's verifiable
attestation and a different authorized QA reviewer with a verifiable
signature, scope and time. Refresh every row before any eventual backfill.
Any conflict or unavailable evidence is a STOP, not an invitation to guess.
One anonymized tenant group has **two active owners**, not proof of Store.
Even one tenant owner is not itself evidence of which Store owns a record.

A private offline linter inherited from V14.4.3 checks four evidence
packets' shapes. This V14.4.9 addition checks backup **manifest metadata**
and four abstract evidence slots, but cannot authenticate real signatures,
evaluate actual source documents or authorize any Store mapping.

## D. Operator artifacts and privacy

- `qa/private-recovery-v1449/private-recovery-intake.cjs` — pure
  metadata-only no-I/O linter, no network/database/export functions.
- `qa/private-recovery-v1449/private-recovery-intake.test.cjs` —
  synthetic positive/negative validation, no actual customer files.
- `qa/private-recovery-v1449/HOSTED_P0_READ_ONLY.sql` —
  actual read-only hosted metadata audit; successful against staging.
- `qa/private-recovery-v1449/PRIVATE_BLANK_INTAKE_TEMPLATE.md` —
  blank schema for restricted private handling, no live data.
- Prior: `qa/security-definer-v1443/four-row-owner-evidence.cjs`,
  `qa/recovery-owner-v1448/recovery-owner-gate.cjs`,
  `qa/store-rls-v1447/store-isolation-gate.cjs` remain reused.

**Safety:** A SHA256 or a flag such as "signature checked" is
untrusted user data. Even all fields set true return
READY_FOR_PRIVATE_MANUAL_REVIEW_ONLY, never FULL_RECOVERY_VERIFIED,
MERCHANT_OWNER_VERIFIED or APPROVED_TO_MIGRATE. Even after human review,
a separately approved hosted SQL change is required.

## E. No-Go gates

- Full coherent application+Auth restore and rollback not independently
  verified on fresh target => BLOCKED.
- Real P01/P02/O01/O02 ownership evidence not privately signed and reviewed
  => BLOCKED.
- Store/Membership hosted schema absent; six legacy permissive policies,
  tenant-only Product RPC and legacy callers => BLOCKED.
- Real JWT A/B same tenant + C separate tenant + revoked R hosted acceptance
  => BLOCKED.
- Separate approval for any database DDL/DML, GRANT, permission, credential,
  Meta/Zalo provider send, charge or billing change => REQUIRED.

## F. Rollback and next

Source-only Draft PR can be closed/reverted with no hosted rollback,
because no hosted changes were performed.

Proposed next milestone: **V14.4.10 — Recovery Operator Approval Gate ×
Store Ownership Adjudication & Hosted JWT Preflight**. Only after
separate explicit approval for a protected Auth export/restoration may
authorized operators create and validate full private evidence. No
sensitive data collection is authorized by this Draft.
