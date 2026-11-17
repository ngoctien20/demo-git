# TIEN404 AI — V17.1E
## Merchant Product Image Corpus × Real Vision Model Benchmark Gate × Verified Messenger/Zalo UAT Admission

**Checkpoint date:** 17 November 2026 (JST)  
**Lifecycle:** EXPERIMENTAL → Draft PR, source-only; no real Page/OA UAT or model call  
**Parent:** V17.1D Draft PR #252, HEAD `b86bb1e0005ddfa5c05829f9966177a3f8f3a1e1`  
**Supabase staging:** `ifxlvrhyjhbzbrkdsida` — **read-only inspection, no hosted writes**
**Current canonical classification (until CI acceptance):** `V171E_PRIVATE_MEDIA_INTAKE_BENCHMARK_GATE_IMPLEMENTED_L3L4_NO_GO`.

### 1. VERIFIED — current hosted, catalog and provider workflows

- GitHub parent PR #252 is OPEN DRAFT, **not merged**; old PR #250 also OPEN DRAFT. Inherit safe code, do not rewrite or modify core Commerce/Published workflows.
- Supabase staging read-only aggregate: **2 Tenants / 2 Products / 2 Orders / 0 Customers**; **no** `public.stores`, `public.store_memberships`, `public.identity_link_challenges`. Real signed JWT Store A/B, four original-row Owner→Store evidence, independent full-service backup/restore remain BLOCKED. Historic H11R local partial Application archive was previously owner-accepted **with limitations**; no redo, no stronger restore claim.
- Google Sheets native `TIEN404_COMMERCE_V17_2_MASTER_SCHEMA_AND_SYNTHETIC_PRODUCTS_QA` ID `1rdo1xreEbEytrLUtEz3hIQX7OkCzzBpi8VEOpdRyK44`: **PRODUCT_MEDIA has header-only** A1:P12; no rows for genuine merchant photographs. Store `S_QA_A` includes synthetic, unpublished `QA-F-001`, `QA-F-002`, `QA-F-003` with blank `image_main_url`, `vision_reference_status=not_trained`. `CHANNEL_BINDINGS` synthetic flags `signature_verified=FALSE`, `provider_scopes_verified=FALSE`, `inbound_enabled=FALSE`, `outbound_enabled=FALSE`. These are **Sheet QA fixtures only**, not actual vendor entitlement status.
- Google Drive image metadata search for 'product' and 'sản phẩm' had **no relevant accessible merchant product image files** returned. This is not proof that no image exists in any other private storage location; no unauthorized private files were downloaded or inspected.
- Messenger Published `Z7FdV7uDvApfbURQ` (Meta HMAC / DEMO Sheets / toolWorkflow create_order, send HTTP) left untouched; Zalo Bot Published `yIJk8LvJoLF40Z62` and separate inactive locked shadow `6ZWYRBKieTKQMzoQ` left untouched. **Zalo Bot != Zalo OA App/OA permission**. No Meta/Zalo Page/OA owner proof was available in read-only connector session. Graphs only examined, not triggered.
- Official Meta Page webhook documentation requires Page/Messaging authority and `pages_messaging`; Messenger Quick Start supports inbound image attachments. Official Zalo OA documentation requires App linked with granted OA permissions, relevant webhooks. These **generic docs do not establish user account entitlement**.
  - Meta Quick Start: https://developers.facebook.com/docs/messenger-platform/getting-started/quick-start
  - Meta Pages Webhooks: https://developers.facebook.com/docs/graph-api/webhooks/getting-started/webhooks-for-pages/
  - Zalo OA Permissions: https://oa.zalo.me/home/documents/guides/Khoi-tao-ung-dung-va-cap-quyen_117071366476220195
  - Supabase Storage ACL: https://supabase.com/docs/guides/storage/security/access-control
- Prior V17.1D exact-head GitHub source **210/210 Node PASS**, isolated PostgreSQL17 13 named source-approval cases PASS, and n8n manual QA #4350 **10/10 synthetic cross-channel lookup**, #4351 **24/24 read-only catalog**. These are inherited evidence, **not real Page/OA/merchant Vision proof**.

### 2. IMPLEMENTED — private Merchant Product Image Corpus admission

`qa/v171e-commerce/merchant-corpus-readiness.cjs` and tests:
- Require canonical server-derived Tenant/Store and **QA only** unpublished Products; each media record maps to a verified QA Product, SKU, object handle, SHA256, MIME, dimensions/byte bounds and explicit `contentStoredInGithub=false` (no original URLs or image content returned).
- Distinguish product-search/inference authorization from separate training/fine-tuning consent; reject uncontrolled training, missing rights, owner==independent reviewer, corrupt/duplicate hashes, out-of-scope Store/Tenant and non-media payload types.
- Enforce labeled `positive`, `unknown`, `hard_negative` cases, distinct `REFERENCE` and `HOLDOUT` images, positive holdout and rejection of reference/holdout same-image leakage. A self-reported "all-good" packet reaches **CLAIMED_CORPUS_PACKET_REQUIRES_INDEPENDENT_SOURCE_AUDIT** only; it never proves ownership or authorizes processing real product images.
- `PRIVATE_MERCHANT_MEDIA_AND_OA_ADMISSION_RUNBOOK.md` includes operator-level consent, rights, private Storage ACL/backup, photo QA labels, pilot image capture proposal, non-PII provider logs and rollback. Existing `PRODUCT_MEDIA` Sheet stays unchanged.

### 3. IMPLEMENTED — real Vision model evaluation / budget contract, not real inference

`qa/v171e-commerce/vision-model-benchmark-gate.cjs`:
- Evaluates **externally supplied** predictions against Store-known IDs and independently labeled cases: Recall@1, Recall@K, unknown/hard-negative false-positive rate, latency P50/P95 and claimed per-case costs. Rejects cross-Store SKU/model outputs, hallucinated item IDs, invalid scores, duplicate candidates and missing labels.
- `planPaidPilot` requires exact case count, per-call price bound, actual balance/budget evidence, separate merchant-rights/security/provider-billing approvals, model-version pin and explicit one-action authorization. All are packet claims requiring private verification and **`canInvokePaidModel=false` always**. There is deliberately **no API/model executor or provider credentials**. No unapproved paid Vision calls, retry or images forwarded.
- The V17.1C numeric vector results (10 synthetic queries, 25% false matches among four unknowns) are **not** real Vision accuracy. The V17.1D real PNG byte decoder only saw generated QA patterns, not licensed merchant photos. No claim of actual semantic product recognition or verified real model usage in V17.1E.

### 4. IMPLEMENTED — Meta Messenger × Zalo OA UAT NO-SEND admission

`qa/v171e-commerce/meta-zalo-uat-admission.cjs` and tests:
- Independently gate Meta Page ownership, App permissions, raw webhook HMAC and image attachment read; separately gate Zalo OA App/OA rights, webhook event proof and media permissions; distinguish Zalo Bot.
- Require two-step source-approved Customer Identity link, fresh OrderAccessGrant, consent/revocation, same-Tenant Store JWT/RLS negative tests, four-row ownership, recovery/restore, merchant image rights and real-provider Vision evaluation, cost/budget, dedicated authorized **no-send** Page/OA canary and independent security reviewer.
- Module only reviews **self-reported evidence shape**; all-green flags at best mean **CLAIMED_EVIDENCE_PACKET_PENDING_INDEPENDENT_OPERATOR_ACCEPTANCE**; never authorize live provider send, model invocation, Order read/write, workflow publish, hosted Store migration or merge.
- Current snapshot script `qa/v171e-commerce/read-current-corpus-gate.cjs` deliberately produces **NO MERCHANT IMAGES / PAID MODEL NO-GO / REAL META-ZALO UAT NO-GO**, rather than inventing a success.

### 5. QA plan, TESTED status and source rollback

**New source QA:** 22 Merchant corpus cases, 15 Vision output + provider cost cases, 12 Meta/Zalo admission cases = **49 new**.  
**Inherited source QA:** 52 V17.1D, 39 V17.1C and 119 V17/V14/V15 = **210 prior**.  
**Expected test budget:** **259/259 Node** plus static no-credential/network/write scanner, CI reference-snapshot check, and separate intentionally **RED** real hosted model/Meta-Zalo admission job. **Do not declare PASS until exact-commit Actions logs verify.**

**Current blockers:** no independently licensed merchant product photo corpus, owner-signed private media consent, approved private Storage and restore, real provider inference/charges, signed Meta Page or Zalo OA App/OA authority, canonical Customer Identity proof, Store JWT-RLS, independently verified four-row owner attribution, actual full backup recovery. Approvals for real Page/OA messaging and paid model benchmark NOT given.

**No changes made:** Supabase hosted DDL/RLS/data, Google Sheets product rows, real media storage, training, Meta/Zalo provider messages, n8n Published, credential, provider billing or production deploy. Only isolated GitHub Draft source and CI records.

**Rollback:** close V17.1E Draft PR. No hosted restore required.

**Next action:** independent merchant owner supplies a few **licensed product photos to a private authorized intake**, approves search/inference purpose separately from training; verify Page/OA owner authority and Store-RLS/backup with private operator; only then request bounded real model spending and no-send Page/OA UAT. No shortcuts from synthetic tests to real Commerce release.
