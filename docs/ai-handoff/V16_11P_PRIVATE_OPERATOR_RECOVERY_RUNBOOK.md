# TIEN404 V16.11P — Private Operator Evidence Intake × Approved Recovery Preparation

**Checkpoint:** 2026-11-16 JST
**Classification:** SOURCE-ONLY DRAFT / SYNTHETIC / NO SEND / NO REAL DATA / NO HOSTED BACKUP
**Base:** V16.11 PR #218 exact HEAD \`21bdc4dcbca41a5b4174476299e39cf0b1ed66b9\`. Continue without merging or rewriting parent PRs.
**Release status:** **NO-GO**. "Approved Recovery Preparation" is a target gate to *seek* approval, NOT evidence that the user has approved a hosted backup or cost.

## 1. VERIFIED read-only operational baseline

- GitHub PR #218 remains OPEN DRAFT; previous CI run #43869986403 succeeded with 392 Node checks, 68 local Chromium checks and real PostgreSQL 17 **synthetic** RLS/backup/restore mechanics.
- Supabase staging \`ifxlvrhyjhbzbrkdsida\` exists and is healthy. No development branch was found in this project's Supabase branch listing (read-only check 2026-11-16). **Do not create a new branch/project without an exact cost/usage review and explicit owner approval.**
- \`public.tenants\`, \`tenant_memberships\`, \`products\`, \`orders\`, \`customers\` have RLS + FORCE RLS; **no hosted** \`stores\` or \`store_memberships\`; \`store_id\` absent on Products, Orders, Customers. Existing SELECT checks Tenant Membership, not same-Tenant Store isolation.
- Products UNIQUE(tenant_id,sku); Orders/Customers linked by Tenant-only FK. Same Tenant Shop A/B real independent SKUs/Orders cannot be certified until an independently reviewed expansion/backfill/cutover.
- SECURITY DEFINER \`public.qa_shop_b_zalo_claim\` executable by \`anon\`, \`qa_owner_pairing\` and \`save_merchant_product\` callable by \`authenticated\`. No privileged revoke without caller proof and separately approved cutover.
- n8n Messenger Published \`Z7FdV7uDvApfbURQ\` and Commerce Tenant Resolver \`5Eeh8hbpsoNhuiVo\` remain unchanged; no real provider action.

## 2. New source-only deliverables

- \`docs/ai-handoff/V16_11P_PRIVATE_OPERATOR_REQUEST_PACKET.json\`: 18 distinct required evidence kinds, 9 high-risk operation scopes, account and Store preflight, operator/reviewer roles, DB/Storage/Auth/RPC/channel recovery, legal/cost gates. All real proof and cost/signature fields MISSING/NOT_AUTHORIZED.
- \`qa/v1611p-private/operator-intake.mjs\`: pure in-memory synthetic QA request validator and scoped QA receipt ledger with separated Owner/operator/reviewer; no real identity, no trusted signer, no upload URLs. **Always returns commercial NO-GO, including if all 18 QA metadata items are reviewed.**
- \`qa/v1611p-private/operator-intake.test.mjs\`: negative and positive synthetic QA: 68 cases covering forged approvals, wrong project, cost/downtime, Store boundary, raw proof URL rejection and hard-stopped cloud actions.
- \`qa/v1611p-private/index.html\`, \`operator-ui.mjs\`: local-only Vietnamese staff readiness dashboard, CSP \`connect-src 'none'\`, no storage, no PII, no files or network. QA Shop A/B, evidence checklist and recovery coverage shown as incomplete.
- \`qa/v1611p-private/browser.test.cjs\`: 72 Chrome/local-only assertions planned for 320/390/768/1280 px, including denial of backup permission. This is UI QA, **NOT a private production evidence vault**.
- Stacked child-only GitHub Actions workflow adds V16.11P tests to inherited V16.11/V16.10/V16.9/Hybrid/Studios suite, plus disposable PostgreSQL 17 and Chromium.
- Source-only tests must pass on the **exact Draft PR HEAD** before marking TESTED.

## 3. Private operating procedure — required real evidence, not public GitHub data

**Do not attach actual documents, QR login codes, JWT, refresh tokens, Supabase DB URLs, customer records, backup bytes, Telegram/Meta/Zalo tokens, contract scans, personal phone numbers or full backup encryption keys to GitHub issues, PR descriptions, this chat, n8n executions or CI artifacts.** Only sanitized status labels and opaque IDs may be committed.

**Real private evidence system requirements before use:** tenant/store-scoped access control by server-side authenticated user; roles Owner/Operator/Independent Reviewer; encryption at rest and in transit; audit trails with time/user/provenance; no anonymous/public bucket; file scanning and content limits; secret vault with separate key custody; expiry, retention and deletion according to signed DPA; tamper-resistant signed approvals. This system is **NOT** created in V16.11P.

Who provides which evidence:

| Role | Evidence/decision | Constraint |
|---|---|---|
| Merchant Owner Shop A | Business right, data provenance, Page/OA owner, signed store-level DPA | Not a Security Reviewer; must not share provider token |
| Merchant Owner Shop B | Separate business/Store right and real JWT testing consent | Cannot reuse Shop A's authority |
| TIEN404 Platform Requester | Exact staging project, scope, no-write preflight, proposed plan and budget request | Cannot authorize own backup |
| Backup Operator | Verifiable backup method, encryption/keys, object storage, independent restore plan | Must be an explicitly authorized human/service |
| Independent Security Reviewer | Authenticated real Owner A/B JWT & Store RLS acceptance; restore/checksum review | Independent of proposer and backup operator |
| Release Authority | Separate signed final decision after evidence | Cannot be inferred from this Draft or AI self-report |

**Private evidence reference contract:** each evidence item requires type, store/tenant, trusted source, authority verifying it, dated signing, digest/chain of custody where relevant, expiration, and a **non-sensitive opaque locator**. A bare screenshot, user claim or LLM-summarized PASS does not satisfy formal verification.

### Stage G0 — Preparation (this PR, safe)
- Confirm target \`tien404-staging\` / \`ifxlvrhyjhbzbrkdsida\` only. Exclude personal BIO project and any customer production tenant.
- Collect *only metadata about intended operators and proof categories*; all actual proof documents stay in future authorized private vault.
- Review 18-evidence packet and 9 proposed action scopes, no writing to hosted DB, storage or Auth.
- Obtain written cost estimate for disposable restore target and plan eligibility. Present price/duration/renewal/storage/backup and RTO/RPO separately. **Do not invent a quote or silently buy a resource.**

### Stage G1 — Human authorization (NOT DONE)
- Authorized Merchant Owner approves Shop-specific business proof/PII scope and signed DPA, including privacy/retention duties.
- TIEN404 assigns a real Backup Operator and **different** Independent Security Reviewer; separate signed identities, time-bound authority and exact changes.
- Approve exact target project, action, date/time, duration, customer data exclusions, encryption/key custody, budget cap, rollback and evidence retention.
- If new Supabase paid branch/project required, consult Supabase project/branch pricing and obtain **separate user approval of exact charges** before creation.

### Stage G2 — Real backup preparation (NOT DONE)
- First verify hosted plan's actual backup options and whether a downloadable logical backup or other copy is available; physical/PITR backups may not be downloadable as custom plaintext artifacts. Do not assume Pro entitlement.
- Prepare encrypted database backup with owner-approved destination, SHA256 *of encrypted artifact*, access controls, deletion/retention, provenance, a separate restore target and credential segregation.
- **Supabase database backup captures Storage object metadata, not Storage object bytes.** Prepare and later verify separate Storage object-byte backup and restore, ACL, bucket keys and metadata consistency.
- Include Auth/session behavior, custom PostgreSQL roles/password re-provisioning and secrets, RPC permission snapshots, external integrations and idempotent order cutover.
- The backup method, encrypted artifacts, credentials and actual backup execution stay outside this Draft and require signed G1 authorization.

### Stage G3 — Independent disposable restore (NOT DONE)
- Provision only approved isolated nonproduction target with no live webhooks, provider sends or existing customer data.
- Authorized Backup Operator restores approved encrypted data, records checksum, row counts/hashes and consistency, Store ownership mapping, storage object completeness, independent reviewer acceptance and measured restore time (RTO) and data freshness (RPO).
- Clean up the target after independent acceptance and retention period; do not DROP existing customer DB or disrupt Supabase staging.

### Stage G4 — Real Store/JWT-RLS acceptance (NOT DONE)
- Only after reviewed Store schema and safe legacy row mapping + G3, use **real Supabase Auth** Owner A/B accounts in a dedicated nonproduction test and route via REST/Data API; do not substitute SQL Editor postgres, \`service_role\` or a fake JWT claim.
- A and B share Tenant but must have separate Store memberships. Assert product/price/order/customer SELECT and INSERT/UPDATE denied across Store, and Shop C denied across Tenant. Test revocation, expiration, support no grant, composite FK, stale JWT and same SKU different price.
- All test rows must be synthetic, writes require signed authorization and rollback; independent reviewer certifies exact tested deployment/schema version.

### Stage G5 — Privileged RPC and Commerce release (NOT DONE)
- Complete caller inventory for three exposed SECURITY DEFINER RPCs; obtain separately approved per-function remediation/cutover with no unresolved legacy caller.
- Complete n8n Cloud multi-merchant SaaS license approval in writing. Prove one canonical transactional order writer; dedup, price/stock version, inventory changes and rollback; Page/OA binding and provider authority.
- A merchant canary needs fresh independent Security Reviewer and Release Owner signatures; no automatic promotion from any QA result.

## 4. Acceptance: no false green

| Requirement | Current state |
|---|---|
| Source-only private request and checklist | IMPLEMENTED |
| Synthetic in-memory metadata receipt + role negative tests | QA PENDING |
| Existing V16.11 PostgreSQL 17 synthetic restore | Previous CI TESTED, inherit regression |
| Signed real merchant Owner A/B authority | MISSING |
| Real Supabase Auth JWT and same-Tenant Store RLS | BLOCKED (schema absent) |
| Encrypted hosted backup, private disposable restore | NOT_AUTHORIZED / NOT_RUN |
| Storage object-byte recovery | NOT_RUN |
| Independent reviewer and operator signature | NOT_ASSIGNED |
| Resource cost and maintenance window | NOT_QUOTED / NOT_APPROVED |
| Production Commerce | NO-GO |

**Rollback now:** close V16.11P Draft PR. No hosted DB, tenant data, credentials, workflow, Cloudflare resource, billing or real user records to reverse.

**After source CI passes:** obtain human G1 evidence privately and a **quote-only** estimate of cost/restore target. Seek explicit bounded approval before any paid branch or hosted backup. No automatic "Approve recovery" button in this code.
