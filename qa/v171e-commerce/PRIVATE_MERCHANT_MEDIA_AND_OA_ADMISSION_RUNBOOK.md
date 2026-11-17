# TIEN404 AI — V17.1E Private Merchant Image Intake & Real Provider Pilot Runbook

**Scope:** operator-only procedures. This is not consent to download, upload, train or send images. Do **not** post actual product photos, original URLs, authorization tokens, JWTs, customer names or private ownership paperwork in this public GitHub branch.

## A. Verify authority and define the first merchant pilot

1. Controller identifies one **authorized QA Store** and its independently verified merchant owner. Never infer a real Store from the current Tenant owner or one of the four legacy hosted rows. The currently unmerged RPC.10/hosted Store-RLS gates must be respected.
2. Obtain written merchant authorization to process/store **product photos for catalog search** only. Request a separate, independently recorded approval before fine-tuning/training. Clarify third-party trademarks, photographer licensing, PII and retention/deletion policy.
3. Designate a different independent reviewer, plus a least-privilege image intake operator. Store original attestation/evidence in an approved **private evidence location**, never GitHub/Google Sheets public links.
4. Establish image quarantine/scanning: enforce MIME by bytes, file-size/pixel limits, decode in isolated worker, remove EXIF/GPS and embedded metadata, quarantine malicious/unsupported media. The V17.1D parser only implements safe **limited PNG** QA, not a production-grade multi-format ingestion service.
5. Write raw media to a dedicated tenant/store-scoped private Storage bucket with owner authorization, short-lived signed access, no public-readable paths and RLS/ACLs verified independently. Object bytes are not an ordinary PostgreSQL backup; define separate disaster recovery before claiming full backup.
6. Keep Google Sheet `PRODUCT_MEDIA` as a metadata-only QA inventory. Map existing columns `tenant_id`, `store_id`, `media_id`, `product_id`, `variant_id`, `media_type`, `object_storage_key`, `vision_training_approved`, `embedding_model`, `embedding_version`, `source_license`. Do not put original images, access tokens, full customer media or unverified links in cells.
7. Each image gets a private digest, licensed source, canonical Store ID, product ID, SKU, model/index revision and separate reviewer decision. Reject duplicate image hashes, wrong Store, ambiguous SKU and expired rights.

## B. Build a SMALL privately reviewed pilot dataset (not a production accuracy benchmark)

- Target first pilot: 3 approved SKUs from one real merchant Store, ~5 distinct angle/lighting photos per SKU; 5 entirely out-of-catalog and 5 visually similar **hard-negative** photos, each with independently reviewed labels. This is a **proposal** for a feasibility pilot, not an accuracy threshold or claim that images exist.
- Split by **underlying original photo / near-duplicate group**, not randomly by generated crop. Keep reference/index and holdout query sources separate. Enforce tenant/store-specific search using the **server-derived** Store Binding.
- Evaluate semantic Vision model on genuine licensed photos only after confirming exact provider/model version, price, remaining credit, cost ceiling, privacy transfer, operator signoff and explicit one-action spending authorization.
- Log bounded outputs only: immutable anonymized case ID, product ID, expected SKU/unknown, top-K candidate IDs, latency, model version, token/image count, provider request/usage receipt and actual charged cost. Never publish images or customer PII.
- Metrics: Recall@1, Recall@3, unknown-product false-positive rate (hard negatives separately), confusion between variants, failed requests, P50/P95 latency, per-image cost. Do **not** interpret model confidence as verified SKU identity. Require customer SKU selection and final order confirmation regardless of score.
- Retention: original media encrypted at rest, deletion and access logs according to merchant agreement; remove test derivatives on retention expiry. Do not silently train models on user-submitted Messenger/Zalo images.

## C. Real Page/OA UAT admission (NO-SEND first)

1. Independently verify source-of-authority: Meta App/Page ID and correct Page owner, `pages_messaging` grant and webhook subscribe/proof. Dev-mode restrictions and actual permitted test users must be checked in the Meta account; the code currently does not.
2. Independently verify Zalo **OA** App→OA permission, relevant webhook event and signature mechanism; keep Zalo Bot test token/header **distinct** from OA OpenAPI rights. A functioning Zalo Bot QA workflow does **not** prove OA ownership.
3. Collect private verified source and destination identity proofs; confirm Messenger SOURCE explicitly approves the masked Zalo target before linking. Confirm expiry, rate limit, replay, revocation and independent signed customer OrderAccessGrant.
4. Validate hosted Store-level RLS with real signed JWT positive and negative for same-Tenant Shop A/B, plus cross-Tenant and revoked staff. Real four-row Store ownership and M0 recovery remain blockers.
5. Only then request specific **no-send** vendor inbound UAT under an authorized QA Page/OA. Actual outgoing message sending, real customer Order read/write and paid model inference require separate approvals. Record complete (redacted) execution IDs and rollback.

Official provider references:
- Meta Messenger Quick Start: https://developers.facebook.com/docs/messenger-platform/getting-started/quick-start
- Meta Pages Webhooks: https://developers.facebook.com/docs/graph-api/webhooks/getting-started/webhooks-for-pages/
- Zalo OA App/Permissions: https://oa.zalo.me/home/documents/guides/Khoi-tao-ung-dung-va-cap-quyen_117071366476220195
- Supabase Storage Access Controls: https://supabase.com/docs/guides/storage/security/access-control

## D. Definition of readiness
- `SOURCE_TESTED`: isolated code/CI tests only; no real vendor or merchant rights proof.
- `MEDIA_PRIVATE_PROOF_ACCEPTED`: independently audited rights, Storage, merchant Store binding and source images, with approved retention; cannot be set by a JSON boolean.
- `MODEL_BENCHMARK_ACCEPTED`: actual provider receipts and calibrated results on heldout merchant photos with budget signoff; an offline score of synthetic inputs cannot satisfy.
- `META_ZALO_ADMISSION_ACCEPTED`: actual Page/OA permissions, signatures, customer source approval, Store JWT/RLS, recovery, safe rollback and security reviewer.
- `LIVE_UAT_APPROVED`: separate written approval for exact action, date/time, spending and Page/OA. No step above automatically authorizes next step.

**Current actual state:** V17.2 `PRODUCT_MEDIA` is header only; public GitHub contains no merchant photos; Supabase hosted `stores`, `store_memberships`, `identity_link_challenges` are missing; Meta/Zalo account proofs have not been gathered. Gate is **NO-GO**.
