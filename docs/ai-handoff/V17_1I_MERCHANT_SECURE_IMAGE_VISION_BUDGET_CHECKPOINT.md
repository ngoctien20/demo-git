# TIEN404 AI — V17.1I Real Merchant Image Corpus × Secure Website Image Acquisition × Bounded Vision Benchmark

**Date:** 2026-11-17 JST  
**Source parent:** V17.1H Draft PR #259 HEAD a60a7316fdbb4c99369baee6e2c6efee520cf7c1  
**Status (pre-CI):** IMPLEMENTED SOURCE CANDIDATE / QA PENDING / LIVE MODEL & REAL PHOTOS BLOCKED

## 1. Requested product workflow
- Shop with its website: merchant supplies approved product page URL and image/CDN host. Page may expose og:image; image candidate must be independently linked to Store/SKU and verified before the image can enter a model corpus. No scraping of arbitrary sites.
- Small shop: continue using Products.image_url for one SKU; PRODUCT_MEDIA can hold extra images. Do not create new complicated operating sheets for merchants.
- All user-visible price, stock and order details come from trusted server-side Commerce data; image model can only suggest candidate SKUs. Customer explicitly selects SKU and separately confirms Order.

## 2. Implemented source
### Secure website image acquisition candidate (not production deployed)
- qa/v171i-commerce/secure_merchant_fetch.py has strict known-domain HTTPS parsing, excludes URL credentials/query tokens/fragments, validates global IP addresses for all DNS answers, rejects private/loopback/link-local/CGNAT and non-global IPv4/IPv6, pins one IP for direct socket and certificate-verified HTTPS via original hostname SNI, no proxy/redirect, identity encoding, status=200, duplicate and conflicting response headers check, streaming 2 MiB maximum, 3-second transport timeout.
- Requires externally injected server-trusted owner_authorizer callback that explicitly returns True for the exact Tenant/Store/Product/SKU and merchant URL proof. This module does NOT independently authenticate that callback or prove the user really owns the shop. Unsigned merchant proof or a permissive test callback must not be accepted for production.
- Acquired raw image bytes stay temporarily in returned isolated decoder hand-off and MUST NOT be logged, uploaded to public GitHub, or sent to Messenger/Zalo. V17.1H still independently checks actual MIME magic/raster integrity/EXIF/pixel bounds.
- HTML og:image extraction is conservative; it produces an UNVERIFIED image candidate and NEVER infers SKU from page text, follows redirects, executes JS, or promotes an image into Commerce.
- This is a network-capable draft implementation. No real merchant URL is configured or invoked in this milestone. It requires separate security review, egress restrictions, disposable/sandboxed worker, proxy bypass audit, real DNS/TLS UAT and independently verified merchant owner/rights before any live release.

### Merchant catalog/image rights and benchmark admission
- qa/v171i-commerce/merchant_corpus_budget.py holds Store/SKU/catalog revision, rights and commercial consent declarations, image digest and TTL, blind-eval labeled known+unknown photo hashes, deduplication and train/eval SHA leakage prevention.
- Proposes sample MIN_KNOWN=30 + MIN_UNKNOWN=15 per Store as a starting benchmark scope, not a validated statistical acceptance criterion.
- Worst-case budget quote works in integer micro-USD: number of images/cases times approved **proposed** per-call maximum must not exceed proposed total cap; never invokes a provider. No model name, vendor price, balance, actual spend or provider receipt has been independently verified.
- Inspects supplied mock/external receipts for Recall@1, Recall@3, unknown candidate rate, SKU scope violations and claimed spend, but all results remain UNVERIFIED / NOT FOR RELEASE. Does not treat unverified receipts as actual model execution.
- Never auto-select SKU, confirm Order, train AI, modify hosted data, or send provider messages.

## 3. Exact missing real-world evidence
- No user-provided merchant-owned website URL or licensed product image rows yet.
- No independently verified merchant domain, store owner auth, image licenses/retention, approved real corpus, blind reviewer labels, actual paid Vision model, current vendor quote or user-approved hard-cap budget.
- No verified signed Messenger Page/Zalo OA callbacks, Store hosted JWT-RLS, customer OrderAccessGrant, independent Recovery acceptance.
- Do not claim real merchant corpus creation or real model benchmark. User data/credential, product media, and image query identity remain private; no sample media committed.

## 4. QA, change control and rollback
- Source tests proposed: 46 URL/DNS/TLS/HTTP/og:image/authorization cases + 36 merchant corpus/budget/metrics cases = 82 new cases; 192 inherited V17.1H/G/F/E/D. Do not mark PASS until CI logs.
- GitHub Actions has an intentionally failing real-world admission job. Failure is expected and preserves NO-GO for all external sends, hosted writes and model billing.
- No changes to production website, n8n Published workflows, Supabase, Google Sheets, Orders, notification outbox, real model billing or provider SEND. No merge.
- Rollback: close child Draft PR (GitHub source-only); parent PR #259 untouched, no hosted restore.
- Next gate: private shop domain/rights evidence intake; reviewed outbound network proxy and real-photo sample; human-validated labels; explicit exact model budget approval; only then bounded low-cost real model benchmark and signed channel read-only UAT.

**Pre-CI lifecycle:** V171I_SOURCE_DRAFT_LIVE_CORPUS_MODEL_BLOCKED.

## 5. Verified V17.1I offline regression acceptance — 2026-11-17 JST

**Implementation HEAD tested:** `ad505fd9dc0392580b9a6ea8dced2f36a8c75740`.  
**GitHub Actions:** https://github.com/ngoctien20/demo-git/actions/runs/44009669731

- QA job 133793368576 **SUCCESS**.
- New V17.1I `secure_merchant_fetch` tests **46/46 PASS**: URL credentials and token rejection, strict hostname allowlist, mock DNS all-IP global filter including IPv6 link-local and CGNAT, authorization callback fail-closed, pinned plan, outbound response limits, redirect & header conflicts, conservative og:image extraction; local JPEG bytes forwarded through the existing V17.1H raster decoder without real network access.
- New V17.1I `merchant_corpus_budget` tests **36/36 PASS**: store-scoped products and image labels, retention/consent declarations, duplicate SHA, blind evaluation holdout, budget cap calculations in integer micro-USD, model quote NO-CALL, unverified sample receipt metrics and out-of-store SKU counter.
- Inherited **192/192 PASS**: V17.1H 40 Pillow tests; V17.1G 40 DNS/TLS fixture; V17.1F 32 Store/product media registry; V17.1E 28 receipt/rights; V17.1D 22 PNG +25 identity +5 integration.
- **Total source-only tests 274/274 PASS**, 0 failing. Static no model/provider send/DB write and explicit authorization-boundary guard PASS.
- GitHub Actions real-world NO-GO job 133793579453 **FAILURE intentionally**, preserving the hosted deny gate. The overall workflow conclusion is FAILURE by policy, not source test failure.
- Initial GitHub Actions source run found test-fixture errors: missing underscore in several Python test function names and a stream limit case blocked at Content-Length rather than byte streaming. Both test specifications were corrected before this verified run.

**Important caveat:** The code contains an explicit pinned-IP HTTPS transport candidate, but **NO live HTTPS connection** was made in this milestone. DNS, transport and authorizer inputs in successful tests are local mocks. The contract is not independently penetration-tested or production authorized. A permissive owner_authorizer callback or unreviewed egress environment cannot be regarded as verified shop rights; the callback must be bound to independently verified hosted owner/session, Store RLS, licensed product image and permitted domains in a separately approved integration. Retention, data residency and access permissions need owner-approved policy.

**The word "Real" in the milestone title describes the intended next corpus**, not a tested real merchant dataset. There is **no actual merchant image corpus** and **no actual Vision vendor run or cost**. The existing Google Sheets rows remain DEMO/synthetic.

### Minimal merchant operator intake (no new shop sheet required)
For a single shop pilot, the merchant can continue using the existing Products sheet columns `sku`, `name`, `image_url`. The operator collects domain verification and licensing consent privately, plus a tiny private QA-only evidence record: `tenant_id`, `store_id`, `sku`, `image_url`, `rights_evidence_ref`, `consent_at`, `retention_until`. This record is not public GitHub data and is not a replacement for hosted security authorization. A product page URL is mapped to a candidate image URL under review before ingestion; no automatic SKU linking from untrusted web text.

**Checkpoint life cycle:** V17.1I SOURCE IMPLEMENTED / OFFLINE TESTED / LIVE OWNER-DOMAIN-PHOTO-VISION NO-GO.  
**Rollback:** close child Draft PR #261; parent #259 and older PRs unchanged; no hosted data recovery.  
**Next:** get privately authorized first merchant URL/image or owner-provided samples, independently review domain and image rights, then explicitly authorize **a capped real inference** with verified provider price and balance; finally signed read-only Messenger/Zalo pilot under Store JWT-RLS.
