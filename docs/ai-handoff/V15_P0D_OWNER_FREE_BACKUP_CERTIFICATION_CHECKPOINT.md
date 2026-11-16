# TIEN404 AI — V15 Sales Lite P0-D: Independent Owner Evidence × Free-Tier Backup Certification
**Date:** 2026-11-16 JST  
**State:** Source-only IMPLEMENTED candidate · Real owner / real backup / real restore **BLOCKED** · Staging/Production NO-GO

## 1. Purpose and strict scope

Continue from V15 Sales Lite P0-C Draft PR #136, not restarting a separate Commerce or backup system. Prepare the actual certification process for a **first small-merchant pilot**. Advanced Dashboard, custom presentation, merchant premium model selection and complex enterprise functions remain deferred.

**No user approval has been given for exporting actual hosted data**. This P0-D work only audits metadata, adds a private evidence-reference contract and QA CI, and prepares a consent/backup authorization **request**, not an execution.

## 2. VERIFIED live metadata (read only)

Supabase staging project `ifxlvrhyjhbzbrkdsida` (PostgreSQL 17.11), org on **Free plan**. Latest counts: 3 Auth accounts, 2 Tenants, 3 active Tenant memberships, 2 Products, 2 Orders; `public.stores=absent`, `public.store_memberships=absent`, `store_id` absent from seven core tables.

QA-only `tien404_r1_qa.owner_bindings`: 2 paired; `owner_pairing_claims_v3`: 3 confirmed of 4; challenges: 19. These are **not** real merchant/provider ownership certification. Current core SELECT is tenant-scoped. The anonymous SECURITY DEFINER RPC finding requires independent security review; do not infer exploitation from warning alone.

Free tier: Official Supabase guidance <https://supabase.com/docs/guides/platform/backups> recommends manual `supabase db dump` and offsite storage for Free projects; automatic daily backups are on Pro/Team/Enterprise. **No connected action verifies or retrieves real backup bytes or an independently restored copy.** No actual backup was exported, no real restore performed, no private backup encryption/retention proven. Supabase database backups do not include Storage API object bytes (separate recovery plan).

## 3. Reuse existing already-tested work, NO duplicate crypto/backup implementation

| Existing source | Immutable HEAD | GitHub Actions | What is actually TESTED |
| --- | --- | --- | --- |
| PR #132 · V15.0-09C | `70494f279f8efca5b1ac62004c3fca0186d454a0` | `43790419032` SUCCESS | **Disposable** PostgreSQL17 pg_dump/pg_restore, SHA256 and Store/RLS synthetic fixture |
| PR #135 · V15.0-09D | `6ef086202a524b0c595fda3f03ae89a10fe73676` | `43792524351` SUCCESS | **Synthetic** dual Ed25519-signature approval envelope; real human signer keys/consent NOT verified |
| PR #136 · V15 Sales Lite P0-C | `5cc67aabf0ead335b1ceab413fd32b295a11da16` | `43792737344` SUCCESS | **Disposable** Store A/B/C RLS expand/rollback; real JWT and hosted Store isolation NOT verified |

**PR #135 already contains a detailed one-time real staging logical-export approval request** at `docs/ai-handoff/V15_09D_REAL_BACKUP_EXPORT_AUTHORIZATION_REQUEST.md`. Reuse it; do not duplicate keys, merge the Draft branches or call a database export from this task.

## 4. P0-D implementation

- `qa/v15-sales-lite-p0d/private-certification-gate.cjs`: cross-branch evidence dependency reference and 12 private proof classes (merchant Auth, Tenant, provider consent, whole-project controller, independent security reviewer, encrypted private vault, backup operator, actual export manifest and integrity, independent isolated restore, legacy row provenance, hosted Store/JWT QA).
- Ticket manifest stores **only** abstract private `SEC-...` references and `PENDING_INDEPENDENT_PRIVATE_REVIEW` labels. It rejects credentials, email, phone, raw JWT, dump URLs, claims of PASS and cross-project scope. It does not authenticate issuers; it cannot validate actual source, identity or backup bytes.
- Even a fully filled manifest returns **BLOCKED**, because self-declared tickets are not verified evidence and no real execution authorization exists.
- Test suite confirms no hosted export, hosted restore, migration, backfill, provider send, paid model calls, real Order writes or pilot unlock is possible.
- CI runs only source tests and inherited P0-B/P0-C negative gates, with no Supabase credentials, API or real customer data.

## 5. Operator-only real backup certification: approval dependencies

**DATA CLASSIFICATION:** Staging contains accounts and merchant Orders, so treat a full database dump as sensitive. Merchant ownership for Shop A/B does **not** grant authority to export all Tenant records, Auth data, or the rest of this project.

**A. Controller and independent reviewer:** Privately verify authority of the *whole-project* data controller, plus a distinct security reviewer. Store separately any actual personal identifiers / signature proofs in private records, **never** in ChatGPT/GitHub.
  
**B. Explicit one-time scope:** Backup operation must be explicitly approved for project `ifxlvrhyjhbzbrkdsida`, one-time logical export only; no restore, no DDL, no credential modification, no data or stock writes, no provider sends; 0 incremental USD without separate approval.

**C. Vault & retention:** Privately verify encrypted offsite location and custodian, deny public access, encryption key ownership, hash manifest, limited retention and secure deletion policy. Do not attempt when destination missing.

**D. Operator runbook:** Confirm secure supported `supabase db dump` CLI version and permissions privately, no project tokens in logs or public environments; decrypt and restore only in a separately authorized isolated environment. Authorize all sensitive actions individually. Limit backup scope according to legal basis; verify schemas/extensions/Auth/roles, Storage objects excluded and independent services not covered.

**E. Independent verification of real export:** Encrypted archive receipt (sha256, size, UTC timestamp, source snapshot, retained schemas) checked privately by reviewer. GitHub synthetic SHA is NOT acceptable.

**F. Separate restore certification:** Actual copy restored only into a pre-approved isolated target, outbound actions disabled, no paid resources without explicit cost permission; prove row counts, RLS policies, FK constraints, Auth/Store and functional read paths. Refrain from restoring against Supabase staging.

**G. Permission to apply Store migration:** Only after all above plus authenticated merchant ownership, exact migration SHA, reviewer and specific owner approval. Export authorization never implies restore/migration/sending authorization.

## 6. Private evidence outstanding (no fabricated receipts)

- Independent merchant Auth session → Tenant membership, proposed Store intake, provider native Page/OA consent: **NOT CERTIFIED**.
- Independent whole-project controller + security approver sign-off: **NOT SUBMITTED**.
- Approved encrypted offsite vault/operator credentials scope: **NOT VERIFIED**.
- Actual hosted logical export sha256/file custody: **NOT RUN**.
- Actual independent restore drill with real authorized snapshot: **NOT RUN**.
- Legacy 2 Products / 2 Orders Store attribution: **NOT VERIFIED** (do not auto-assign).
- Hosted signed JWT Store RLS positive/negative QA: **BLOCKED**.
- Hosted Store migration, Order writer, owner alert/live pilot: **NOT APPROVED**.

## 7. Operational checkpoint & rollback

**If source CI succeeds:** label P0-D **SOURCE IMPLEMENTED + OFFLINE TESTED**, **NOT BACKUP CERTIFIED**. The Draft PR can be closed without altering Supabase hosted, n8n Published, real Products/Orders, Meta/Zalo, credential, billing or production.

**Next action:** independently review private owner/whole-project controller authority and prepare a one-time backup-export approval in private; use PR #135's existing detailed request. Never claim consent from a synthetic signature or from the user's instruction to continue a roadmap. Only ask for a specific real backup authorization once the secure operator and private encrypted destination are established.

**Proposed next checkpoint:** `V15 Sales Lite P0-E — Private Controller Approval × Authorized One-Time Free Backup` (still blocked until explicit approval and provider/hosted proofs), then real restore certification and separately authorized Store schema expansion.
