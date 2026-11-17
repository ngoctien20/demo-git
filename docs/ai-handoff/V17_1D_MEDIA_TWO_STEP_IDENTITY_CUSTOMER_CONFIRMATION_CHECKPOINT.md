# TIEN404 AI — V17.1D
## Pixel Product Media Intake × Source-Confirmed Messenger→Zalo Read-Only Link × Customer SKU Confirmation UAT
**Checkpoint:** 2026-11-17 JST
**Lifecycle:** EXPERIMENTAL / DRAFT CANDIDATE / NO HOSTED SEND-WRITE
**Parent:** V17.1C Draft PR #250 HEAD `cfdbacbe7664ff1817947878a6850171032d1c96`
**Target Supabase staging:** `ifxlvrhyjhbzbrkdsida` — **no writes or migration**

### 1. VERIFIED — actual current state
- Parent PR #250 OPEN DRAFT, UNMERGED. V17.1C actual GitHub CI 158/158 Node PASS plus isolated PG17 challenge/session/replay success, with intentionally RED hosted release.
- Staging Supabase: **2 Tenants / 2 Products / 2 Orders / 0 Customers**, no `public.stores`, `public.store_memberships`, or `public.identity_link_challenges`. No independent Store ownership or real JWT Store A/B proof.
- Existing n8n `TIEN404 CBOT-UAT-02 — Synthetic Lookup QA [INACTIVE NO SEND]` `6IMJj5xdCGC2b5ll`, manual-trigger/Code-only; source graph inspected, no send/database/write. Direct n8n execution **4350 SUCCESS 10/10 synthetic cases**, `provider_sends=0`, `hosted_order_writes=0`, `real_provider_verified=false`, `hosted_lookup_verified=false`.
- Existing n8n `TIEN404_V17_3_COMMERCE_CATALOG_PRICE_STOCK_QA_NO_WRITE` `qmqR3H66QCRXE4Vb`: manual trigger + **READ-only** four Google Sheets nodes + Code assertions, no provider send/write. Manual execution **4351 SUCCESS, 24/24 QA_PASS**, `provider_sends=0`; only synthetic Store/catalog/price/stock data.
- Google Sheets native `TIEN404_COMMERCE_V17_2_MASTER_SCHEMA_AND_SYNTHETIC_PRODUCTS_QA` (read-only inspection): `PRODUCT_MEDIA` has **header only**, with image/rights, embedding and per-Store fields but no registered media records. `PRODUCTS` QA items `QA-F-001`, `QA-F-002`, `QA-F-003` in Store `S_QA_A` have `image_main_url` empty, `vision_reference_status=not_trained`, `is_synthetic=TRUE`, `published=FALSE`. **No actual merchant photos available** or approved for upload/train. Simpler `TIEN404_PRODUCTS_SIMPLE_MERGED_QA_V17_4` contains separate DEMO products; do NOT merge with Commerce.
- H11R owner accepted the previously inspected partial Application local backup **WITH LIMITATIONS**; Supabase Auth+Storage independent restore/bytes still not certified; no duplicate backup or hosted migration authorized.

### 2. IMPLEMENTED — real PNG bytes/pixels through a safe synthetic-image intake
- `qa/v171d-commerce/png-media-intake.cjs` parses actual PNG binary data and reconstructs RGB/RGBA pixels from zlib-inflated scanlines. Enforces PNG chunk CRC, strict IHDR/format and file/pixel bounds, PNG filter validation, rejects ancillary metadata, EXIF-like payloads, APNG animation, unknown chunks, SVG, remote URL and corrupted/truncated/compression-bomb candidates.
- Only **server-attested synthetic QA media manifests** with matching Tenant/Store, reference image and QA-generated rights are admitted; **no real image uploaded to Supabase Storage or Google Sheet** and no customer photos retained. It emits a one-way SHA256 and a simple 16D spatial color descriptor derived from **actual synthetic pixels**; this is not a semantic Vision embedding or trained AI model. Top-K candidates remain hypotheses requiring customer SKU choice and a further final order confirmation.
- Source-only regression includes 22 media negative tests. Actual PNG bytes are generated in-memory with Node stdlib; no copyrighted merchant imagery is bundled or fabricated as real.

### 3. IMPLEMENTED — safer two-stage Messenger→Zalo identity proof, status-only lookup
- `qa/v171d-commerce/two-step-link-readonly.cjs`: distinct independently injected Source and Target provider verifiers. A 32-byte challenge is issued to verified Messenger (QA only), target Zalo OA submits it and reaches **PENDING_SOURCE**. The target MUST NOT read an Order until the **original verified Messenger identity explicitly approves** the target account. This resolves V17.1C's identified stolen-token-with-verified-target threat. Challenge TTL 5 minutes; source subject/account/Store/Tenant rechecked, replay and expired/challenge conflict denied.
- After simulated approval, every lookup freshly checks target identity and calls an **injected trusted OrderAccessGrant readback**, matching exact Tenant, Store, canonical Customer, OrderRef and status. Only status and reference returned; never address or phone.
- `createMemoryStoreQa` is unit-test-only and **NOT durable, authorized or usable for production**. No actual Meta Page, Zalo OA, signed provider session, OTP, HMAC secret, real customer or hosted Order is used.

### 4. Implemented — PostgreSQL 17 durability of source-approved link (DISPOSABLE ONLY)
- `qa/v171d-commerce/pg17-two-step-link-disposable-only.sql` reuses **existing** V17.1C throwaway PG17 `qa_v171c` schema/database, creates private `pending_link_approvals` status table with FORCE RLS and no public grants, strict database+GUC+role guard, no hosted schema path.
- `qa/v171d-commerce/ci-pg17-two-step-link-rehearsal.sh`: independent signed-proof **synthetic placeholders only**, requires verified target presentation, confirms wrong source subject/Store denied, then atomic source approval + token consume + link activation in one transaction, persistent link and blocked re-use, scope isolation, revocation, private grants checks. **This is database mechanism proof, not actual provider/JWT authority**.

### 5. IMPLEMENTED — full synthetic Customer Confirmation UAT
- `qa/v171d-commerce/cross-channel-image-order-uat.test.cjs` uses actual generated PNG pixels → Store A media candidates → source V17 read-only pilot → Customer explicitly chooses `QA-F-001` → verifies price VND 159,000 and quantity 2 = VND 318,000 → `ORDER_DRAFT_AWAITING_CONFIRMATION` → explicit `xác nhận đặt hàng` still fails to perform Order writes → separately seeded QA Order `T404-QA-0001` is looked up via two-step Messenger approval then Zalo status-only. **The seeded QA order was NOT created by the draft**; this is a complete **read-only fixture demonstration**, not live Order end-to-end.
- Fixes prior source pilot's `A003`-only SKU regex to recognize current Commerce `QA-F-001`-style codes, while preserving old tests and leaving Messenger Published unchanged.
- New test target: media 22 + two-stage link 25 + integrated E2E 5 = **52 new cases**; inherited V17.1C 158 cases = expected **210**. Do NOT mark TESTED until exact GitHub Actions logs pass.

### 6. Release requirements & missing evidence
**L1:** source-only QA, PNG pixel parsing on synthetic generated photos, two-stage memory QA.
**L2:** disposable PG17 source-approved link and certified QA flows; n8n manual synthetic workflows.
**L3 BLOCKED:** real merchant product photographs/ownership & retention license, image model inference/embedding, calibrated realistic Recall@K, actual messenger/zalo inbound signatures/account ownership, merchant customer consent, durable secure identity adapter and Store Auth/JWT/RLS.
**L4 BLOCKED:** independently authorized Page/OA real conversation, real approved Store owner ledger, M0 recovery, hosted migration & one-message approved canary, transactional Order draft/commit and idempotent workflow.
- Images returned from QA are PNG raster files but **generated patterns**, not store merchandise photographs. Do not claim any real picture recognition.
- The SKU false-positive rate from V17.1C synthetic vectors (25% of 4 negative queries) remains a warning, not real catalog Vision accuracy.
- No model billing, object upload, n8n Published update, provider send, real Order creation/stock update, host DB DDL/RLS mutation, credential change, production deployment or merge.
- No need to back up or modify already-accepted limited H11R archive during this source-only milestone.

### 7. QA acceptance / checkpoint / rollback
After GitHub Actions: record actual 52 test outcomes, 158 regression, 2-stage PG17 job, deliberate hosted NO-GO gate; verify exact final commit after documentation update.
- N8N evidence: execution #4350 synthetic 10/10 and execution #4351 catalog read-only 24/24.
- For two-stage identity production design add independent source confirmation UI, bounded rate limit, fresh consent recheck on **every** read, private encrypted record, explicit link-revoke UX, separate reviewer and audit signoff.
- **Rollback:** close child Draft PR and revert only V17.1D source/CI/checkpoint + source-only SKU parser improvement; hosted requires no restoration.

**Classification before final CI:** `V171D_SOURCE_IMPLEMENTED_REAL_PNG_SYNTHETIC_PIXEL_QA_PENDING_HOSTED_NO_GO`.
