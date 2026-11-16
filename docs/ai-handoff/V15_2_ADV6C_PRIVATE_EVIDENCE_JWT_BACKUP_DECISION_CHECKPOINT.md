# TIEN404 AI — V15.2-ADV.6C PRIVATE EVIDENCE × HOSTED JWT/RLS × ONE-TIME BACKUP DECISION
Date: 2026-11-16 JST
Status: **DRAFT / EXPERIMENTAL / SOURCE-ONLY / NO EXPORT / NO SEND / NO DATABASE MUTATION**
Parent: Security P0 Release Gate PR #174 at `212691647ded23a6c02adac85295c09b079619ed`.

## 1. VERIFIED — Hosted state (READ ONLY)
- Supabase staging project `ifxlvrhyjhbzbrkdsida`, public.tenants/tenant_memberships/products/orders/customers have RLS enabled and FORCE RLS.
- Public Store and Store Membership tables required for same-tenant Shop A/B access proof are **ABSENT**; no `tien404_action_private.action_nonce_claims` found in checked inventory. Metadata does not prove authorization.
- Count-only Auth inventory: `auth.users = 3`, `auth.sessions = 5` at the time of the query. These are counts, NOT a verified same-tenant Owner A/B identity; do not copy user IDs, JWTs or customer data into a public repo.
- `public.qa_shop_b_zalo_claim` SECURITY DEFINER remains callable by `anon`; `qa_owner_pairing` and `save_merchant_product` are DEFiner callable by authenticated. Existing Vault header gate on first function must not be described as an unconditional exploit. Revocation/replacement requires independent caller review.
- Parent PR #174 still OPEN DRAFT, no merge, release P0 gate is NO-GO with intentionally red job. No real backup, restore, Owner JWT proof, independent controller/operator authorization or hosted nonce replay attestation found in reviewed material.

## 2. EXISTING IMPLEMENTATIONS — REUSED, NOT REBUILT
- V14.4.2 `qa/hosted-readiness-v1442/hosted-jwt-acceptance.cjs` is a separately authorized GET-only hosted JWT acceptance runner. It requires four independent authorized real JWT sessions (Owner A/B same tenant, Owner C another tenant, revoked/unassigned R), canonical Store membership and verified synthetic test records. It is NOT run with real tokens in this PR. Existing `configFromEnv({})` confirms it fails closed with missing approvals/credentials; no real HTTP call.
- V14.4.3 `qa/security-definer-v1443/four-row-owner-evidence.cjs` is an offline private four-row evidence linter, NOT an actual hosted signer.
- V14.4.4 `qa/store-product-v1444/owner-intake-offline.cjs` is a QA-only private ownership intake; don't treat QA owner checks as live authorization.
- V15.2 ADV.6B `qa/v152-advanced-actions/owner-evidence-gate.cjs` is the previous five-domain review gate (Store schema, owner, real backup+restore, DB role and hosted replay), and stays intact.
- V15.2 PRE-ADV.6C `qa/v152-pre6c-security/p0-release-gate.cjs` already defines six P0 NO-GO gates; nothing overrides its release denial.

## 3. IMPLEMENTED — NEW OFFLINE THREE-SIGNER METADATA INTAKE
- `qa/v152-advanced-actions/adv6c-private-evidence-intake.cjs`:
  - Strict allowlisted payload: pinned project, audited base SHA, 15-minute maximum TTL, random 256-bit nonce, eight distinct evidence references + SHA-256 digests, proposed one-time backup scope/destination digests and cost/retention bounds.
  - Ed25519 detached signatures by three **distinct** pre-enrolled **SYNTHETIC QA** keys: CONTROLLER, SECURITY_REVIEWER, BACKUP_OPERATOR. Key registry must be supplied independently and MUST NOT come from the evidence packet itself.
  - Any signature modification, reused nonce, wrong project, expired proof, duplicated document, same signer, raw token/backup payload, missing independent proof or forged controller approval is rejected.
  - In-memory synthetic nonce ledger is injected by tests only. No live trust anchor, private evidence storage or durable hosted nonce ledger was provisioned.
  - If all metadata signatures verify, output is **SIGNED_METADATA_ONLY_PENDING_INDEPENDENT_PRIVATE_INSPECTION**. This is NOT proof that linked evidence exists or is truthful, and cannot approve an export.
  - Functions `exportBackup`, `hostedJwt`, `grant` and `release` deliberately THROW.
- `qa/v152-advanced-actions/adv6c-backup-decision.cjs`:
  - Reuses P0 Gate and ADV.6B Owner Evidence Gate.
  - Exact current decision **DENY_ONE_TIME_REAL_BACKUP_EXPORT**. Even forged all-green input or a valid synthetic signed metadata envelope cannot override the denial.
  - No authorization, no real export, no hosted reads/writes, no cost incurred.

## 4. PRIVATE OPERATOR SOP — REAL HOSTED OWNER PROOF (NOT RUN)
1. Controller privately verifies authorized Owner A/B and a separate unassigned/revoked identity via authoritative Supabase Auth in a protected operator environment. Never transmit JWT/bearer/API secret in chat, GitHub, screenshots, PR comments or CI logs. Use independently enrolled identities (not a single account asserting both roles).
2. Independently verify Store Ownership mapping and RLS schema actually exist on **hosted staging**, and that Store A/B share a tenant while Store C is independent. Do not create fake Store mappings in production to manufacture a PASS. If absent, STOP: schema remediation and backup approval are separate.
3. Only after explicit authorization, run existing V14.4.2 opt-in GET-only JWT acceptance with real owner-scoped bearer tokens in private operator environment; validate positive and negative Shop A/B including same-tenant cross-store denial and revoked staff. Operator should store redacted case result and evidence checksums privately. No service_role or superuser as an end-user RLS proof.
4. Security Reviewer independently inspects the actual request/response traces with PII redacted, role membership and RLS policies, Auth session freshness and signing key custody. A CI synthetic success is not hosted certification.

## 5. PRIVATE CONTROLLER BACKUP SOP — REAL EXPORT (NOT AUTHORIZED / NOT RUN)
1. Before ANY export, obtain a separate one-time **Controller decision**, independent **Security Reviewer**, and named **Backup Operator** authorization. Confirm operator privileges, scope of project/tables, data classification, encrypted destination, storage policy, retention, anticipated cost and rollback.
2. Controller must approve **one exact export** with exact project, nonce, operator, storage destination, TTL, data scope and maximum cost. A ChatGPT instruction like “continue” or checklist ticks are NOT a one-time real-data-export approval.
3. When authorization is independently established and separately approved by the user, the external authorized operator may export privately, record irreversible receipt digest, then restore to an isolated environment, compare data integrity and obtain independent review. No files or PII in public GitHub. Deny replay/retries outside approved scope, log authorization consumption in approved durable store.
4. Only after export **and independent restore** are verified, can migration/role approval be considered as a SEPARATE decision. NEVER infer that export approval authorizes a DDL migration or credentials change.
5. If data owner/Controller, independent reviewer, private storage, restore or cost approval is missing: **DENY / NO EXPORT**.
6. No production or hosted backup executed by this PR. Never mark backup “VERIFIED” merely because a document was signed or a synthetic nonce was consumed.

## 6. CURRENT DECISION & GATES
| Gate | Current |
|---|---|
| Authorized private evidence references | NOT SUBMITTED / NO REAL TRUST ENROLLMENT |
| Independently verified Owner JWT/RLS Shop A/B | BLOCKED (Store schema absent) |
| Independent signed Controller & Security attestation | BLOCKED |
| One-time real export Controller authorization | **DENIED — NOT APPROVED** |
| Real encrypted export receipt | BLOCKED |
| Independent restore drill | BLOCKED |
| Dedicated DB role and hosted durable replay | BLOCKED |
| P0 Multi-Store / Commerce live release | **NO-GO** |

## 7. TEST EVIDENCE & LIMITATIONS
- `adv6c-private-evidence-intake.test.cjs`: 20 synthetic QA tests; signatures verified using generated per-test Ed25519 key pairs, no customer/production identity. No network.
- `adv6c-backup-decision.test.cjs`: 6 DENY-on-missing-real-proof tests.
- CI uses existing V14.4.2 offline GET-only tests, P0 release security, ADV.6 identity and ADV.5 signed receipt regressions. Only GitHub Actions exact SHA can establish TESTED.
- CI separates policy QA (should be GREEN) and hosted certification release job (deliberately RED with exit 3).
- No trustworthy conclusion about real hosted Store RLS is possible from a metadata check alone. No approval is silently implied by signature validity.
- Backup signing keys, trust enrollment registry, private evidence hashes or transcripts MUST be separately stored and never committed to repo.

## 8. APPROVAL / ROLLBACK / NEXT
- No changes to Supabase hosted RLS/GRANT, Auth users/sessions, n8n Published, Cloudflare, credential stores, private backup files, billing or provider sends.
- Rollback: close Draft PR ADV.6C. Nothing to restore in hosted DB.
- Required future private evidence inputs: approved Owner A/B proof, signed independent Controller + Security Review + named Backup Operator, authorized encrypted storage location and approved budget, approved restoration evidence. **Do not submit bearer tokens or customer records in this chat**.
- Next safe milestone: **V15.2-ADV.6D — Independent Private Evidence Verification × Hosted Read-Only Acceptance Decision**, still NO-SEND until explicit operation-specific Controller approval. If canonical Store schema is still missing, reconcile schema/migration plan, backup and negative RLS proof BEFORE considering live.
