# TIEN404 AI — V17.1J Merchant-Owned Image Evidence × Real Vision Pilot × Messenger/Zalo Read-Only UAT

**Date:** 2026-11-17 JST
**Parent:** V17.1I Draft PR #261 HEAD 9ba5e6ec6255a92e03bbe4f9af14994eac5a0684
**No production writes / no external fetch / no paid model / no Messenger/Zalo send / no merge.**
**Before CI:** IMPLEMENTED SOURCE CANDIDATE / CI PENDING / HOSTED NO-GO.

## 1. Verified actual n8n state, read-only inspection
- TIEN404_MESSENGER_TEST ID Z7FdV7uDvApfbURQ **ACTIVE**, draft=published node graph, includes Messenger OpenAI model, Send Messenger Reply HTTP Request, create_order and manage_order tools. NOT acceptable for V17.1J NO-SEND live UAT.
- TIEN404_ZALO_BOT_LAB_V1_STAGING ID yIJk8LvJoLF40Z62 **ACTIVE**, includes webhook Ack and QA marker DataTable writes; it is not a universally side-effect-free environment.
- TIEN404_ZALO_V123_PRIVATE_CUSTOMER_ROUTER_STAGING ID sIPs6egzIwOY1GNv **ACTIVE** with read-only catalog and owner allowlist nodes. Not proof of current real Zalo OA provider authority.
- TIEN404_G06_SIGNED_CHANNEL_STORE_COMMERCE_INACTIVE_QA_NO_SEND ID FqEcdmc8PRRMNUEb **INACTIVE**, source QA only with synthetic registry.
- TIEN404_G07_PRIVATE_PROVIDER_AUTHORITY_INACTIVE_REVIEW_NO_SEND ID mmt3ToandWrLAcjH **INACTIVE**, manual QA only, not a real Meta Page/Zalo OA provider challenge.
- TIEN404_V171D_ISOLATED_MESSENGER_SHADOW_LOCKED_NO_SEND ID 6ZWYRBKieTKQMzoQ **INACTIVE**, fail-closed webhook, no real callback deployed.
- These actual workflow states were read with n8n connector during this milestone. No execution, publication, credentials, migrations or live messages were performed.

## 2. Implemented V17.1J source-only contracts
### A. Private merchant-owned image evidence
- qa/v171j-commerce/merchant-evidence-pilot.cjs requires exact Tenant/Store/catalog revision, active SKU->product mapping, unique media IDs and hashes, clean pre-approved HTTPS media hosts, explicit merchant ownership/license/AI matching consent, PII-review declaration, domain ownership evidence reference, and retention expiry (max 365 days).
- Returns only SHA-256 URL fingerprint, media SHA-256 and evidence reference IDs; no image bytes, temporary signed links, credentials or user phone addresses. No photo is actually fetched or stored.
- All owner/store/domain/license claims remain **unverified**. The module cannot transform a merchant declaration into independently verified authority.

### B. Bounded real Vision pilot request proposal
- Same module prepares blind known/unknown query SHA manifests, enforces Store/SKU, prevents duplicate query SHA and reference/query image overlap, caps calls and worst-case estimated micro-USD. First evaluation sample 30 known +15 unknown per Store is a suggested scope, not verified statistical quality.
- Vendor name, model, quote, account balance and billing approval are NOT verified. It issues NO model invocation capability. Claimed provider receipts can be inspected for Recall@1, Recall@3, out-of-store SKU and unknown-image false candidates, but never count as a genuine model run.
- Vendor spend remains zero as far as this module is concerned. A real model pilot requires a separate user-approved limited authorization and independently enforced provider budget.

### C. Messenger + Zalo READ-ONLY shadow UAT safety
- qa/v171j-commerce/no-send-channel-uat.cjs handles only OFFLINE_SYNTHETIC_PROVIDER_FIXTURE_ONLY events with SYNTHETIC_TEST_INSTALLATION_ONLY and INACTIVE_QA_SHADOW installation records.
- Refuses actual active or side-effecting workflow IDs, wrong Tenant/Store, unbound installation, missing synthetic signature marker, model-selected SKU, >3 candidates, order query without a Store-scoped QA OrderAccessGrant, missing cross-channel two-step customer approval or target verification, replayed case/event IDs, and any non-read-only action.
- Outputs only case ID, channel, intent, decision and denial code; no customer IDs, phone, image URLs, order details, actual order lookup or messages.
- A SYNTHETIC_READ_ONLY_REHEARSAL acceptance only proves **fixture contract**. It NEVER certifies provider HMAC signature, real Page/OA authority, Store JWT-RLS, customer OrderAccessGrant or actual UAT.

## 3. Missing real-world evidence, no-go
- No merchant-owned real photo corpus with independent rights and Store proof; no verified domain image URL or independently tested live HTTPS egress.
- No explicit per-provider, per-model verified price, real balance and bounded spend approval for this V17.1J run; no paid model invocation and no real Vision accuracy.
- No genuine signed Messenger Page/Zalo OA callback + trusted installation owner evidence. No real source-approved cross-channel identity link or customer-order access proof. Hosted JWT Store RLS and independent recovery are not proved by synthetic fixtures.
- Do not move V17.1J into Messenger TEST or Zalo Bot Lab Published. They are ACTIVE with possible send/marker side effects.

## 4. QA plan and safe rollback
- New intended source tests: 40 photo evidence/Vision quote/receipt, 36 synthetic channel Store/OrderAccessGrant/NO-SEND = 76.
- Inherited V17.1I–V17.1D regression = 274. Target 350 tests, count as verified only after GitHub Actions logs.
- GitHub Actions has an intentionally RED hosted admission job. Never interpret source PASS as live provider or paid model acceptance.
- Rollback: close V17.1J Draft child PR, preserve V17.1I PR #261 and all hosted data unchanged; no restore required.
- Next authorized integration: private merchant rights + domain proof and uploaded licensed photo sample, verified provider quote/balance, explicitly approved bounded model call, isolated read-only signed Messenger/Zalo canary with no customer reply, Store RLS/OrderAccessGrant, independent Restore acceptance.

**Classification:** V171J_SOURCE_ONLY_PREPARED_HOSTED_NO_GO.
