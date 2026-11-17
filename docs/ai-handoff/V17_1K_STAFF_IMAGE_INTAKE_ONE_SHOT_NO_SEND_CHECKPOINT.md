# TIEN404 AI — V17.1K Staff-Verified Image Intake × One-Shot Vision Quote × Signed Provider No-Send

**Checkpoint date:** 2026-11-17 JST  
**Source parent:** V17.1J Draft PR #264 HEAD cf8f9ad8d3d6c61d18930c30ee33b9b07df3171c  
**User direction:** Staff at TIEN404 manually checks shop image links; skip automatic backend website image crawler for the initial commercial pilot.  
**Lifecycle before CI:** IMPLEMENTED SOURCE CANDIDATE / CI PENDING / REAL VISION & CHANNEL UAT NO-GO.

## 1. Product and operational decision — fewer moving parts

The shop maintains only a simple Products record with sku, name, image_url (or supplies original files directly). A TIEN404 staff member collects owner permission, reviews SKU-image match, commercial media rights and private domain/license evidence; then uploads the actual approved file through an authenticated staff UI into the merchant's private media quarantine. The backend never crawls shop websites, follows arbitrary product pages, or downloads URLs directly from customer messages. This staff-led procedure **replaces automatic URL discovery and basic content curation**, not backend security or reliable isolation.

**Mandatory minimal backend remains**:
- Validated TIEN404 staff session with role + MFA, trusted Tenant and Store from server authorization, and active product SKU read-back.
- Binary MIME and SHA-256 validation, isolated V17.1H real raster decoding with pixel limits and EXIF sanitation; the V17.1K CJS preflight only checks magic bytes, NOT full raster safety.
- Private media quarantine/storage scoped by Tenant/Store/SKU, immutable media ID and content hash; no public credentials or signed URLs in editable Sheets.
- Auditable merchant media rights/consent/retention plus revocation and redaction, immutable staff-review attribution, customer image privacy and per-shop access. Manual staff claims alone do not prove legal rights.
- Explicit user-approved provider/model budget with genuine verified price/balance and server-side atomic spend ledger before one real Vision call.
- Signed Meta Page or Zalo OA authority tied to trusted installation and Store; no live send, order reads, or publish as a side effect.

## 2. IMPLEMENTED source-only contracts
- qa/v171k-commerce/staff-image-intake.cjs: accepts local bytes only, approved media role, short-lived rights declaration, exact active Store/SKU/catalog revision and SHA-256; rejects auto scraper or remote fetch intent; yields nonauthoritative quarantine receipt with no image bytes or enabled model.
- qa/v171k-commerce/vision-one-shot-quote.cjs: matches a separately claimed private media storage receipt with Store/SKU/image SHA; requires single call, no retry, micro-USD upper bound and expiring proposed budget. Does NOT call provider, verify the user approval, or authorize billing; this needs atomic server-side enforcement.
- qa/v171k-commerce/signed-provider-shadow.cjs: uses exact raw-body HMAC-SHA256 with timing-safe comparison for synthetically signed Messenger fixture. This verifies CRYPTO against a **test secret**, not a real Meta Page. Zalo signature stays fail-closed until independently confirmed official OA/app signature profile and real installation ownership. No webhook execution, response or customer order data.
- qa/v171k-commerce/v171k.test.cjs: tests staff, authorization, price limits, one-shot and synthetic crypto. Inherited prior 350 cases remain unchanged.
- .github/workflows/v171k-staff-intake-vision-one-shot-nosend.yml: source tests and intentionally failing hosted release block.

## 3. Real-world blockers
- No real merchant-owned image corpus, independent staff session, Store owner and media rights, private storage integration, controlled upload UI or live staff audit receipts were connected during this stage.
- No paid Vision one-shot invoked. No verified vendor price, account balance, credit spend or user-approved fixed cap.
- No real signed Meta Messenger Page or Zalo OA event admitted. Synthetic Meta raw-HMAC fixture is not a real provider authorization. No real customer messages read or sent.
- Existing Messenger TEST and Zalo Bot Lab are ACTIVE and potentially side-effecting; do not run V17.1K against them. G06/G07 shadow workflows remain inactive by prior read-only inspection.
- Hosted Store JWT-RLS, customer OrderAccessGrant, recovery/restore and channel ownership admission remain unverified.

## 4. QA / release / rollback
- 45 new V17.1K source cases + 350 inherited V17.1J–D = 395 expected unit tests. Never claim PASS before CI logs.
- Entire branch is source-only Draft. No GSheets/Supabase/n8n Published/Commerce Orders/Meta/Zalo changes, no uploads, no paid model, no credential changes, no merges.
- Release gate deliberately RED until all real evidence and separate user approval.
- Rollback: close child Draft PR; all hosted data and parent PR #264 unchanged. No restoration needed.
