# TIEN404 AI — V17.1H Multi-format Product Photo Intake × Real Raster QA

**Date:** 2026-11-17 JST  
**Parent:** V17.1G Draft PR #257 HEAD 42506cd45bc1d5ac6cb9635aef777bd95f66ea02  
**Status before CI:** IMPLEMENTED / QA PENDING / HOSTED NO-GO

## Objective and exact source
V17.1H addresses a real gap in V17.1G: store websites commonly use JPEG or WebP, not just PNG. This is a source-only image byte parser that can normalize images already collected through an independently authorized private media transport. The actual connected Google Sheets simple Products includes image_url but DEMO_LEGACY rows have blank image URLs. Archived 31-tab PRODUCT_MEDIA only has headers. No merchant-authorized real product photo, store URL, provider message, or hosted migration is available.

## Implemented
- qa/v171h-commerce/multiformat-local-media.py uses Pillow==12.3.0 in isolated CI. It genuinely decodes PNG/JPEG/WebP raster bytes, applies EXIF orientation, converts to RGB, generates a 16D spatial color descriptor and one-way source SHA256. This is a color feature, NOT semantic embedding / trained AI recognition. Rejects GIF, animation, false MIME signatures, invalid/truncated raster, oversize bytes, dimensions/pixel bombs, source hash mismatch, missing merchant media rights declaration, wrong Tenant/Store/SKU reference and expired grants.
- Only previously registered V17.1F IMAGE_URL references are accepted; page URLs remain PAGE_TO_IMAGE_MAPPING_REQUIRED. Current source-only Store references and rights claims can be forged: they are not hosted JWT / signed independent rights.
- Returns no image bytes, no EXIF data, no original URLs, no personal metadata. Does not fetch remote websites, store photos, invoke an actual model or send a provider message.
- qa/v171h-commerce/test_multiformat_local_media.py generates actual binary PNG/JPEG/WebP QA pixels with Pillow, including a JPEG EXIF author and two-frame WebP, then tests strict Store/SKU and media restrictions. No merchant photo is bundled, trained or inferred.
- .github/workflows/v171h-multiformat-real-raster-nosend.yml installs Pillow in disposable GitHub Actions, runs V17.1H tests plus inherited V17.1G/F/E/D tests, and keeps a deliberately RED hosted-release gate.

## Risks / security gates
- No live network image fetcher was added or authorized. V17.1G pinned DNS/TLS adapter is still a MOCK; do not claim real domain verification. The next actual fetch milestone requires independent SSRF review, public/private CIDR checks, TLS pinning, redirect deny, download limits, ImageMagick/Pillow decoder hardening, storefront domain ownership and commercial image rights.
- Pillow must run in a sandboxed/disposable worker for customer-supplied bytes; byte/pixel limits alone do not guarantee exploit isolation. For production, use provider-recommended patches, resource limits and malware handling.
- Neither a color descriptor nor a merchant self-declaration is a real AI Vision benchmark. Before inference, obtain licensed merchant photos, blind human labels, independent owner consent and approved provider budget, then reconcile actual call receipts.
- Messenger/Zalo real Page/OA authorization, durable two-step customer identity, hosted Store JWT/RLS, per-customer OrderAccessGrant, independent Restore and explicit UAT approval remain BLOCKED.
- Price/stock/store/identity must be read from trusted Commerce catalog; image model may only propose a SKU, which customer must select before separate Order confirmation.

## QA & rollback
**Planned new tests:** 40 (actual encoded local PNG/JPEG/WebP). **Inherited:** 152 from V17.1G/F/E/D. Expected 192; do NOT mark TESTED before CI.
**No hosted action:** zero Sheets/Supabase/Storage writes, zero n8n Published edits, zero external media fetch, zero Vision model spend, zero Meta/Zalo sends, zero orders, zero production deploy or merge.
**Rollback:** close child Draft PR only; parent #257 and upstream PRs preserved, no hosted restoration required.

**Pre-CI classification:** V171H_REAL_RASTER_LOCAL_SOURCE_IMPLEMENTED_HOSTED_NO_GO.
