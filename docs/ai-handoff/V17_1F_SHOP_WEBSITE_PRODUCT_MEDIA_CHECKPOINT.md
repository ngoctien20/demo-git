# TIEN404 AI — V17.1F Shop Website and PRODUCT_MEDIA source adapters

**Checkpoint:** 2026-11-17 JST  
**Parent:** V17.1E child Draft PR #254 HEAD af6723718869f10df37184009434e652a2db991e  
**Scope:** source-only NO-FETCH, NO-SEND, NO hosted write; do not merge.

## 1. VERIFIED — actual Google Sheets schemas from read-only access
- Simplified active QA spreadsheet: TIEN404 - 01 SAN PHAM TEST (CHUA BAN THAT), tab Products contains sku, name, price, stock, price_clean, store_id, category, variant, unit, wholesale_price_clean, status, image_url, source and demo_only. The current product rows are DEMO_LEGACY and image_url is blank. DO NOT use DEMO as Commerce.
- Archived technical 31-tab QA schema: PRODUCT_MEDIA contains tenant_id, store_id, media_id, product_id, variant_id, media_type, object_storage_key, public_safe_url, alt_text, vision_training_approved, embedding_model, embedding_version, perceptual_hash, confidence_threshold, source_license and created_at. This archived tab currently has headers only.
- Archived Commerce PRODUCTS tab includes product_id, sku, image_main_url and vision_reference_status. QA synthetic products are not merchant merchandise.
- Do not migrate, populate, reactivate or alter these existing sheets in V17.1F.

## 2. Source integration contract
Three references are supported behind the same Store/SKU-scoped catalog read:
1. Direct shop-hosted photo URL in simple Products.image_url.
2. Product page URL in an optional product_page_url input (not present in the current simple sheet; may be collected separately). HTML page is NOT a JPEG/PNG or model image. It requires separate verified page-to-image mapping, e.g. structured data or og:image from an authorized URL.
3. Advanced per-product or multi-angle PRODUCT_MEDIA row using store_id, tenant_id, product_id, media_id and public_safe_url. The shop owner does not have to maintain this complex table when one photo per SKU is enough.

Files:
- qa/v171f-commerce/shop-media-source-registry.cjs normalizes website and PRODUCT_MEDIA references by Tenant, Store, product and SKU, requires exact allowlisted HTTPS hosts and rejects signed query tokens, embedded credentials, paths at root, duplicate IDs and Store scope mismatch.
- qa/v171f-commerce/shop-media-source-registry.test.cjs tests authorization boundaries, URI constraints, false source claims and strict no-network behavior.
- .github/workflows/v171f-shop-media-nosend.yml runs source tests and inherited V17.1E/V17.1D regression, then intentional RED hosted gate.

## 3. Critical security boundaries
- This registry is source-only and does not fetch links, perform DNS lookup, parse remote HTML, decode product images, create embeddings or invoke a real vision model. All external media and Store claims remain pending independent verification.
- A product URL is stored as PAGE_TO_IMAGE_MAPPING_REQUIRED. A proposed extracted image URL is only a hypothesis needing independent mapping review; the SKU is NEVER extracted from URL text or vision output.
- An exact host allowlist alone is not an SSRF defense. Before any authorized real fetch, require a dedicated server-side proxy with verified domain ownership, per-hop DNS resolution and private/link-local/loopback rejection (IPv4 and IPv6), redirect blocking, exact mime and byte limits, timeouts, image pixel decompression limits, origin licensing review and Store binding recheck. Do not let n8n HTTP Request nodes fetch arbitrary end-user URLs.
- Clean public HTTPS URLs only; never store private signed URLs, passwords, OAuth tokens or temporary access parameters in public GitHub or editable Sheets. Separate server-side private media adapter may be designed later after owner authorization.
- Merchant consent, licensing, domain ownership, catalog and authenticated user role require independent evidence. The source-only registry cannot certify them.
- The real Vision model can only return candidate SKUs; customer chooses the SKU, then confirms final order. Price, inventory, Store and buyer identity are always trusted Commerce readbacks, never model statements.

## 4. Release controls and next milestone
- Offline: source contract and inherited QA only. Do not merge the child Draft or modify V17.1E PR #254.
- BLOCKED: actual store website domain, approved image URLs, direct image HTTP/DNS security checks, real licensed merchant photos, model-billed visual inference, Messenger and Zalo real Page/OA authority, hosted JWT/RLS Store and customer Order access, independent Restore.
- No current user-provided shop URL has been inspected; neither real website fetch nor image download has occurred.
- Rollback: close V17.1F Draft PR; no hosted data restore.
- CI evidence to be recorded only after exact run finishes.

**Status:** V171F_SOURCE_REF_REGISTRY_IMPLEMENTED_QA_PENDING_HOSTED_NO_GO
