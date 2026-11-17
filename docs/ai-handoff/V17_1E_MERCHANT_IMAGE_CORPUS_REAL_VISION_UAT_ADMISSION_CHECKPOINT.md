# TIEN404 AI — V17.1E source-only checkpoint

**Date:** 2026-11-17 JST  
**Lifecycle:** IMPLEMENTED / OFFLINE TESTED / HOSTED NO-GO  
**Parent:** V17.1D Draft PR #252 HEAD b86bb1e0005ddfa5c05829f9966177a3f8f3a1e1  
**Child:** V17.1E Draft PR #254 (separate branch, not merged)  
**Tested implementation HEAD:** a712ce7a56a15ae8b60331962dfbe9bb532bf622  
**GitHub Actions proof:** https://github.com/ngoctien20/demo-git/actions/runs/44005457376

## 1. VERIFIED — parent checkpoint and current CI
- PR #252 OPEN DRAFT, not merged; V17.1D node source 210/210 and disposable PG17 13/13 passed. The V17.1D provider release gate intentionally failed.
- Existing parent photo inputs are generated PNG pixels; NOT genuine merchant product photography or real AI image model inference.
- V17.1E source contract GitHub Actions job SUCCESS: 28/28 new Node tests PASS, inherited V17.1D pixel media 22/22, two-stage link security 25/25, synthetic integrated E2E 5/5 PASS. Total **80/80** source assertions PASS, static no-send/no-hosted/no-paid-model guard PASS.
- V17.1E hosted-release job is intentionally FAILED with NO-GO: merchant photos, real Vision vendor evidence, Meta/Zalo Page/OA identity, Store-level hosted authorization and recovery evidence are not proven.
- These checks only validate source contracts and synthetic data. No authorized live Meta/Zalo UAT or benchmark inference was run by this change.

## 2. IMPLEMENTED — merchant corpus preparation (NOT a certified dataset)
- File: qa/v171e-commerce/merchant-corpus-contract.cjs.
- Exact Tenant/Store, revision-bound catalog SKU/item, merchant origin declaration, commercial-use consent, rights evidence reference, retention window and SHA256 checks.
- Uses parent bounded real PNG byte/pixel decoder with metadata restrictions; rejects reused image hashes/IDs, inactive product, wrong tenant/store/SKU, corrupt bytes and false hashes.
- Returns SHA256 and metadata, never original image bytes or media URL. No Google Sheet, Supabase Storage, public repository image, customer or media database write.
- Merchant JSON declaration or source verified flag CANNOT establish actual rights, photo authenticity, owner identity or trusted Store authorization. Output stays PENDING_INDEPENDENT_RIGHTS_AND_STORE_REVIEW.

## 3. IMPLEMENTED — receipt analysis harness (NOT real Vision inference)
- File: qa/v171e-commerce/model-receipt-benchmark.cjs.
- Computes Recall@1, Recall@3, unknown-image candidate rate, out-of-Store SKU violations, claimed latency and claimed vendor cost from separately provided labeled query/receipt data.
- Validates score ordering, duplicate candidates, image-hash-to-receipt identity and input bounds.
- Neither calls nor pays a Vision model; vendor billing or signed response, provenance, labels and real photo rights have NOT been independently verified.
- Proposed first read-only evaluation sample minimum: at least 30 positive and 15 out-of-catalog photo queries **per Store**; sample-size planning assumption, not an approved production accuracy threshold.

## 4. IMPLEMENTED — fail-closed Messenger/Zalo UAT checklist
- File: qa/v171e-commerce/uat-admission-gate.cjs.
- Eleven explicit evidence requirements: licensed real photos; independently reconciled model inference and billing; labeled photo quality; SKU/Store isolation; verified Messenger Page and Zalo OA signatures/ownership; durable source-confirmed link; hosted JWT+Store RLS/customer OrderAccessGrant; independent Restore; consent/revocation; reviewed no-send shadow scope.
- Source gate always returns HOSTED_NO_GO, including when all checklist fields are self-labeled INDEPENDENTLY_VERIFIED. No local JSON assertion can authorize real UAT or provider sending.
- Customer image is only a product-match hypothesis, never an authority for Store, price, inventory, customer identity or Order. Customer must explicitly select SKU and separately confirm final order.

## 5. Outstanding independent evidence
- Genuine merchant product photos with provenance, rights and retention consent stored in a private approved location; **do not push raw product/customer photos or private credentials into public GitHub**.
- Trusted per-Store ownership/RLS and actual media-to-Store binding. Store A cannot access Shop B photos, embeddings or orders.
- Human-blind labeled real photo benchmark (multiple angles, lighting, confusing near-matches, unknown items). Authorized vendor calls with fixed budget; independent bill receipt and actual latency/precision.
- Actual Messenger Page and Zalo OA admin ownership, signed provider ingress, two-step link with durable revocation, verified Store JWT/RLS plus customer-scoped Order status access.
- Independent recovery/restore and release authority for bounded UAT. None are certified by this source-only milestone.

## 6. Risk / QA / releases
- **TESTED:** 28/28 new media/vision receipt/UAT contract tests; inherited 52/52 V17.1D contract tests; static scanner PASS.
- **NOT TESTED:** real product image recognition, recall on a merchant corpus, actual provider billing, real Meta/Zalo webhooks, hosted Store-level RLS, customer authorization and Order persistence.
- **NO HOSTED CHANGE:** No provider SEND, no Vision API call, no n8n Published activation, no Google Sheets or Supabase write, no credential or billing change, no production promotion or merge.
- **Release gate:** V171E_L3_L4_HOSTED_NO_GO_REAL_CORPUS_VENDOR_RECEIPTS_PAGE_OA_STORE_RLS_AND_RECOVERY_MISSING. Intentional RED release job must not be considered a source QA failure.
- **Rollback:** close child Draft PR #254; do not close or rewrite parent PR #252. No hosted data restore necessary.

## 7. Checkpoint
Source contract and GitHub CI tested at a712ce7a56a15ae8b60331962dfbe9bb532bf622. Documentation-only checkpoint commit will advance head; verify the new CI after it runs.

**Status:** V171E_SOURCE_CONTRACT_28_NEW_52_INHERITED_PASS_REAL_VISION_AND_PROVIDER_HOSTED_NO_GO
