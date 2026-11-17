# TIEN404 AI — V17.1G Pinned DNS Image Preflight × Vision Corpus Gate

**Date:** 2026-11-17 JST  
**Parent:** V17.1F Draft PR #256 HEAD 59598cbc211caab5cdcc997454b57af3a7eb6f37  
**Child:** Source-only Draft, NOT merged  
**Security posture:** OFFLINE QA / NO REAL FETCH / NO MODEL BILLING / NO PROVIDER SEND / NO HOSTED WRITES

## 1. Verified basis
- V17.1F actual Google Sheets read-only inspection: simplified active QA Products has image_url but existing rows are DEMO_LEGACY and photo URL blank; archived V17.2 PRODUCT_MEDIA has headers only. No merchant-provided real product website or image URL has been supplied for authorized verification.
- V17.1F tested 112/112 source cases at 59598cbc...: 32 website/media mapping + 28 corpus/receipt + 52 PNG/cross-channel. Hosted NO-GO intentionally RED.
- V17.1E/V17.1D are separate OPEN DRAFT parents; no merge or hosted production change.

## 2. Implemented: injected pinned DNS/TLS fixture gateway
- File: qa/v171g-commerce/pinned-dns-media-gateway.cjs.
- Consumes only a V17.1F Store/SKU-bound IMAGE_URL reference registered by the trusted-catalog fixture. A shop product page reference cannot be mistaken for an image.
- Requires an explicit short-lived QA-only grant containing Tenant, Store, productId, SKU, exact URL/domain, expected SHA-256 hash, rights and domain declarations. Source marker is QA_ONLY_INDEPENDENT_REVIEW_PLACEHOLDER, NOT a real reviewer signature or property-rights proof.
- Requires an externally supplied DNS-answer adapter; all returned answers must correspond to expected hostname and be **public IPv4**. Denies RFC1918, localhost, link-local, CGNAT, documentation ranges, multicast, IPv6 and mixed safe+unsafe answers. IPv6 is deliberately not supported in this phase; add only after independent verification.
- Creates an immutable transport request plan containing pinned IPv4, exact hostname/TLS SNI, TLS-peer-verification requirement, no redirects, no proxy, no automatic decompression, 3-second timeout and 2 MiB response limit.
- The ONLY accepted read adapter has mode OFFLINE_FIXTURE_TRANSPORT_ONLY and reports fixture TLS/peer/pin/status/headers. It must match exact IP, URL, hostname, status=200, identity encoding, image/png type and declared buffer length. A forged QA adapter could lie; no real HTTPS/TLS/network verification is implied.
- Reuses strict V17.1D PNG byte decoding, metadata rejection, anti-bomb protection; compares actual decoded source PNG sha256 to separately reviewed expected SHA. Returns only SHA, pixel descriptors, dimensions and Store/SKU; no image bytes leave result.
- No DNS resolver implementation, HTTP client, HTML parser, JPEG/WebP decoder, model inference, storage or credential access is included. This is not a network-capable server or ready-to-deploy image proxy.

## 3. Intended future real media adapter (NOT in this change)
- Merchant's official shop URL is onboarded privately, proven controlled by the shop and bound to authenticated Store owner via hosted JWT/RLS, with commercial image rights and retention permission.
- Independent security engineer reviews a dedicated outbound proxy: DNS all-answer verification before each connection, exact pinned IP via TLS SNI/Host and verified connection peer, strict private/link-local IPv4/IPv6 CIDR block, no redirects, 2 MiB body cap enforced while streaming, mime sniffing, timeouts and response decompression bombs.
- For JPEG and WebP websites, add an audited raster decoder/normalizer to private media processing; V17.1G intentionally accepts PNG only. A link to an HTML product page still needs authorized page-to-image mapping.
- Real product photo sample must include independently labeled known/unknown SKU queries. Proposed first benchmark sample 30 known +15 unknown per Store (not production statistical acceptance); bound real vendor calls and cost with explicit approval, record model/version/latency/price and false-positive rate.
- Query images from Messenger/Zalo are untrusted data. Model suggestions are candidates, not product price, ownership, stock or order authority; merchant/customer must select SKU and confirm order.
- Independent signed Meta Page / Zalo OA ownership, Store JWT/RLS, customer OrderAccessGrant, source-approved cross-channel link, privacy and Recovery remain mandatory before provider UAT.

## 4. CI and QA
- Source job planned: 40 focused DNS/URI/rights/TLS/response/PNG security fixtures + inherited 32 V17.1F + 28 V17.1E + 52 V17.1D = 152 offline Node cases. Count as TESTED only after GitHub Actions logs show PASS.
- Deliberate RED hosted gate. Do not confuse synthetic TLS receipt with a real certificate or signed provider payload.
- No actual merchant website fetched; no Google Sheets/Supabase/n8n Published mutations; no outbound network, model charges, Meta/Zalo SEND, order/stock writes or public deployment performed by this milestone.
- Rollback: close child Draft PR, leaving V17.1F parent and all hosted data untouched. No restore required.

**Pre-CI status:** V171G_SOURCE_IMPLEMENTED_CI_PENDING_HOSTED_NO_GO
