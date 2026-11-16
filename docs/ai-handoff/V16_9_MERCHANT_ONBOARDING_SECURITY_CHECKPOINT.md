# TIEN404 V16.9 — Merchant Onboarding Security × Private Import Readiness × Store Ownership Proof

**Checkpoint:** 2026-11-16 JST
**Release:** DRAFT / SOURCE ONLY / OFFLINE SYNTHETIC / NO SEND / NO HOSTED SQL / NO PAID API
**Production and real-merchant-data onboarding:** **NO-GO**
**Upstream:** V16.8 PR #203 HEAD \`20d51ffad8c03977901ad2e92f9dbe50d45fa133\`. Ancestor V16.7 #199, V16.3 #194, Hybrid V16.0/16.1 #190; independent Custom Studio #117 and RPC.3 security #186 are preserved unmerged.

## 1. VERIFY FIRST: external systems read-only
- GitHub PR #203 OPEN DRAFT, HEAD verified. Not merged. V16.8 source contains Vietnamese Merchant Setup Studio, CSV/XLSX synthetic-only preview, Store/RLS DO NOT APPLY text, cost 1–500 Shop; CI previous exact HEAD #43851759941 SUCCESS with 235/235 Node + 55/55 Chromium.
- n8n Cloud: Messenger \`Z7FdV7uDvApfbURQ\` Published Version \`d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92\`; Tenant Resolver \`5Eeh8hbpsoNhuiVo\` Published \`a99c7350-7aea-446d-bdc5-4b10f52c3ad1\`; Catalog Query \`oOOXicKXGkBskKqh\` Published \`e0f1e345-8e6c-40cb-8e6a-d7ad2eb92696\`. No version changes performed in V16.9, no workflow execution. Messenger DEMO still has Google Sheets order tools and must not be used for new merchant Shop writes.
- Supabase staging project ref \`ifxlvrhyjhbzbrkdsida\` has \`tenants\`, \`tenant_memberships\`, \`products\`, \`orders\`, \`customers\` with tenant_id; **NO public stores/store_memberships nor store_id on those business tables**. Existing UNIQUE(tenant_id,sku) prevents same-Tenant Shop A/B same SKU independently. Existing SELECT RLS policies are Tenant membership scoped, NOT same-tenant different-Store scoped. Real Owner A/B JWT and cross-store denied writes are **NOT_RUN**.
- Supabase Security Advisor currently WARN: anon executable SECURITY DEFINER \`qa_shop_b_zalo_claim\`; authenticated executable \`qa_owner_pairing\`, \`save_merchant_product\`; leaked-password protection disabled. Need individually authorized external caller review and remediation, not blind REVOKE. INFO private no-policy entries are not automatically a vulnerability.
- No real backup/restore, host migration, Page/OA ownership, consent, external n8n license acceptance, storage buckets, private files or security reviewer signed certificate was generated.

## 2. What is actually implemented in V16.9
**A. Synthetic ownership intake** \`qa/v169-security/owner-evidence.mjs\`
- Reuses V16.7 same-Tenant Shop A/B / separate Tenant C QA fixtures. Issues in-process QA capability objects scoped by a WeakSet; these **are NOT actual authenticated JWT**.
- Separate synthetic roles: Owner A/B/C, support with Shop A grant only, independent metadata reviewer per Store and QA scanner per Store.
- Only opaque QA_EVID_* metadata references allowed; raw receipts/tokens/OTP/IDs/PII not accepted. There are nine required evidence categories: merchant authority, owner JWT/session, provider Page/OA owner, Store record mapping, restore drill, RLS cross-store, RPC caller inventory, data processing agreement, n8n SaaS license.
- Operator submission and independent metadata review are recorded separately. Even when 9/9 metadata items are reviewed, \`actual_external_certification=false\`, \`merchant_production_ready=false\`.
- Cannot issue a production capability or approve hosted migration.
- Does NOT actually verify identity, scope, ownership, a signed merchant contract, MFA or human expert credentials.

**B. Quarantine-state private import readiness** \`qa/v169-security/private-import-readiness.mjs\`
- It is a lifecycle **simulation of metadata**, NOT private file storage, an uploader or an antivirus scanner. All file bytes remain absent.
- Allowed: strict QA_FILE_* opaque reference, QA_IMPORT_* request id, exact format CSV/XLSX, MIME/size 2MiB, per-Store uniqueness, 20 min QA expiration, state/revision checks, simulated scanner, V16.8 synthetic-only product catalog preview, Owner-only preview approval, independent metadata review.
- Forbids: customer PII, hidden columns, arbitrary SKU/price, duplicate import, cross-store read, support self-approval, false real scanner verdict, raw URL/path, real signed upload URL, live product write, service_role, Meta/Zalo send, model calls.
- Scanner \`CLEAN_QA_SIMULATION\` is expressly **not actual malware clearance**; \`METADATA_REVIEWED_OFFLINE_QA_ONLY\` is expressly **not authorized for database import**.
- Logs are safe mock metadata only, no raw file content or unredacted customer data.

**C. Internal readiness UI** \`qa/v169-security/index.html\`, \`readiness-ui.mjs\`
- Purely local browser UI with \`connect-src 'none'\` CSP: choose synthetic Shop, submit opaque metadata proof, mock independent metadata review, simulate quarantine→scan→catalog diff→Owner approve→review, then see commit permanently denied.
- Show real gate status NO-GO, never fake green real certificate. No login or hosted identity, not an operator-grade production console.

**D. Evidence handoff template**
- \`docs/ai-handoff/V16_9_PRIVATE_OWNER_OPERATOR_HANDOFF_TEMPLATE.json\`: all real owner/provider/restore/legal/license proofs initially \`MISSING\`; never use GitHub to store sensitive evidence or file bytes.
- Security Reviewer **must be a genuinely independent authorized person/process outside the synthetic author**, privately verifying evidence. A developer/self report or offline CI cannot satisfy this.

## 3. Commercial private import design (PROPOSED only)
\`\`\`mermaid
flowchart TD
 M[Merchant Owner verified JWT and consent] --> A[Trusted private onboarding API]
 A --> O[Server-scoped tenant/store authorization; revalidate on every step]
 O --> Q[Private bucket quarantine, no public URL; signed short-lived upload grant]
 Q --> V[AV/magic-byte MIME/XLSX formula/zip-bomb checks and encryption]
 V --> D[Dry-run import diff by Store; price/stock version checks]
 D --> P[Actual Owner reviews diff and confirms]
 P --> R[Independent security/recovery gate]
 R --> T[Authorized transaction: Product/Price/Stock import]
 T --> L[Versioned import audit + rollback receipt]
\`\`\`
**Proposed private storage controls:** private bucket, no publicly guessable path, scoped upload grant generated *server-side* after genuine Owner auth; disable overwrite; private quarantine tenant/store/key; AV and content-type sniffing, plaintext CSV PII scanner, zip bomb, formula injection and workbook link policy, file-content digest, hard size limits. Time-bounded scan/import job and revalidation upon change/consent revocation.

**Supabase design caution:** private buckets are governed by RLS; upsert permissions differ from initial upload. Signed download URLs generally **cannot be revoked individually**; do not treat Owner JWT revocation as signed URL revocation, use short TTL and object delete/move/rename/key rotation strategy as appropriate. Be aware of private storage browser/CDN caching after rights are withdrawn. These policies must be tested in an approved nonproduction environment before enabling any file ingestion.
Official docs:
- https://supabase.com/docs/guides/storage/buckets/fundamentals
- https://supabase.com/docs/guides/storage/security/access-control
- https://supabase.com/docs/guides/storage/serving/downloads
- https://supabase.com/kb/troubleshooting/storage-private-bucket-files-still-accessible-after-remove-access-or-logout
- https://supabase.com/docs/guides/storage/uploads/file-limits

**Import precedence:** Merchant data is controlled by the merchant for contractual/business purposes; TIEN404 is an authorized service processor, not a new data owner by virtue of a copy. For initial Economy commercial pilot import **Products and public Shop Profile only**, and require separately approved DPA/consent/mapping/retention and Store/JWT-RLS for Customer PII. No file transferred through unprotected Messenger/email to TIEN404 staff. Real legal assignment must be reviewed under Vietnam personal-data legislation effective 2026.

## 4. Store ownership proof and rollback gates (NOT PASSED)
Before any hosted Store/RLS schema change:
1. Merchant signs Shop-specific authority and data processing agreement. Records of actual provider Page/OA ownership must come from native platform proof or verified private operator, not a text field provided by AI.
2. Independent Owner A/B genuine JWT (same Tenant, different Store) with **cross-Store read AND write denial** test; Shop C (other Tenant); expired and revoked users; unauthorized manager/staff and support roles.
3. All legacy Products/Orders/Customers rows must be mapped to correct Store with source provenance. Unknown rows default to **quarantine**, not auto-map. \`UNIQUE(tenant_id,sku)\` must be redesigned for Store scope and existing dependent RPC/n8n queries inventoried.
4. Independently approve encrypted database backup and **disposable restore** with checksum, timing and operator ledger. Never claim a SELECT query equals restore proof.
5. Inspect every caller for privileged \`qa_shop_b_zalo_claim\`, \`qa_owner_pairing\`, \`save_merchant_product\` before selectively revoking. Separate revoke authorization and canary.
6. Proven transactional writer, inventory reservation, idempotency and dual-writer prevention.
7. n8n Cloud SaaS commercial license written permission; exact scope of customer-provided Messenger/Zalo/POS credentials reviewed. Unlimited workflow count is not licensing evidence.
8. Separate explicit owner/private operator/security reviewer **production activation authorization**. Approval for this source-only PR is not consent to open the gates.

No hosted credential, SQL, file, account ownership credential, paid API, n8n workflow, Cloudflare resource or Meta/Zalo network action is allowed now.

## 5. QA acceptance / limitations
\`qa/v169-security/v169-security.test.mjs\`: 75 synthetic tests on evidence life cycle, unauthorized and cross-Store access, operator/reviewer separation, expiry/replay/size/MIME, product preview and permanent hosted NO-GO.

\`qa/v169-security/browser.test.cjs\`: local Chromium 320/390/768/1280 QA of Owner metadata and scan simulator, Shop switching and blocked production commit; run with no outbound requests.

Inherited baseline: V16.8 Node 53, V16.7 65, V16 Hybrid 42, V16.3 Studios 75 = **235** existing tests. Together **310 Node planned + 68 browser checks planned**; do not state PASS until CI completed on exact HEAD. The prior 55 Chromium checks on V16.8 may be rerun independently in CI if time permits.

What this test **cannot** certify: true JWT, real security-reviewer independence, a safe production file parser for arbitrary XLSX, AV detection, object storage ACL, durable quota, Supabase Store RLS, Page/OA identity, real customer consent, n8n production capacity or live commerce.

## 6. Decision and rollback
- **IMPLEMENTED**: source-only QA evidence and import lifecycle, local UI, operator handoff and CI.
- **TESTED**: only after exact-HEAD CI green.
- **BLOCKED**: all hosted auth, real data onboarding, signed storage, external reviewer, production Commerce, public RPC changes, licensing signoff.
- **Rollback**: close new Draft PR; no hosted/production resource changes to undo.
- **V16.10 proposal:** separately authorized disposable-backup recovery drill + genuine same-Tenant Store A/B JWT security testing, and private file onboarding in a dedicated nonproduction environment *only after* written approvals, legal and cost gates. Do not create hosted resources from this source-only checkpoint.
