# TIEN404 AI — V17.1C Checkpoint
## Verified Cross-Channel Identity Challenge × Durable Conversation Contract × Vision Catalog Retrieval Benchmark

**Date:** 2026-11-17 JST
**Phase:** PROPOSED → EXPERIMENTAL source code / disposable PostgreSQL 17 QA
**Parent:** V17 CBOT Draft PR #248 exact base HEAD `858190577682655be42f5025b46e7a2350124486`
**Supabase staging:** `ifxlvrhyjhbzbrkdsida`. **No hosted writes.**

### 1. VERIFIED CURRENT STATE (read-only)
- PR #248 OPEN DRAFT, UNMERGED. Prior V17 checkpoint: GitHub 119/119 Node PASS and real n8n manually executed synthetic 5/5 + 18/18 without SEND/Order writes.
- A *separate* V17.1A→C Draft PR #243 already contains native Messenger binding and a persisted-shadow n8n QA workflow. Do not duplicate its webhook infrastructure or promote its work into Published without independent approval. New V17.1C focuses on **different unmet functions**: customer identity challenge, durable conversation contract and Vision catalog retrieval QA.
- n8n `TIEN404_V171C_AUTHORITY_BOUND_MESSENGER_SHADOW_QA_NO_SEND` `AKgE96Xvbqxw4rGb` is INACTIVE but includes a Data Table **read** node; do not execute it without checking actual table access and side effects. `qmqR3H66QCRXE4Vb` Commerce Catalog QA is also INACTIVE and contains credentialed Google Sheets reads. They were inspected, **not executed** during this task.
- Staging Supabase read-only aggregates: **2 Tenants, 2 Products, 2 Orders, 0 Customers**, no `public.stores`, `store_memberships`, `channel_identities` or `identity_link_challenges`. Store-level Owner/RLS/independent four-row identity and hosted migration remain BLOCKED. The user-accepted H11R archive is a **limited partial Application archive local QA milestone only**; no full-service Auth/Storage restore proof exists.
- Existing source reuse: `qa/v152-advanced-actions/verified-identity-connector.cjs` requires injected true JWT/provider signature verifiers and Store/consent checks; `qa/v152-advanced-actions/pg-nonce-store.cjs` provides private Postgres nonce-claim contract but is not deployed; `qa/v17-cbot/cbot-readonly-contract.cjs` offers image candidate/SKU draft flow in memory. None certify production.

### 2. IMPLEMENTED — Verified two-channel link challenge (SOURCE ONLY)

`qa/v171c-commerce/private-cross-channel-link.cjs`:
- Mandatory, independently verified **source Messenger/Zalo Bot/Zalo OA** and **destination provider** callbacks from a trusted server, each scoped to Tenant, Store, channel, installation account, pseudonymous user and consent.
- A 32-byte CSPRNG challenge/token generated only from server random. HMAC-SHA256 with a server-injected >=32-byte secret stores only `challengeHash` in the private store. TTL exactly 5 minutes. Token is returned to the verified source-channel application handler only; this package contains no provider SEND.
- Binding requires distinct channels, matching verified Tenant/Store, unexpired, unused challenge and a destination account. Private adapter must **atomically consume and bind** so no cross-account takeover, lost consume or same-Store conflicting customer reassignment is allowed.
- QA includes a **Map-based in-memory test adapter** to test behavior. This adapter has no persistence or production authorization, and its callbacks are mock proofs. The module never claims actual Meta/Zalo signature validation or real customer identity.
- A 5-minute token alone is insufficient for Order access: after linking, OrderAccessGrant + Store ownership/RLS/consent must be independently checked again. Future hosted adapter must recheck source consent/revocation before redemption and bind under one SQL transaction with rate limiting, idempotency and privacy retention.

### 3. IMPLEMENTED — Durable context & event replay, PG17 disposable ONLY

`qa/v171c-commerce/pg17-private-link-context-disposable-only.sql`:
- Guard requires EXACT ephemeral database `t404_v171c_ci`, PostgreSQL 17, `postgres` CI role and `RPC171C_DISPOSABLE` GUC; creates isolated `qa_v171c` schema, NOT `public`, and NO Supabase migration.
- Four private tables: `link_challenges`, `identity_links`, `conversation_sessions`, `inbound_event_claims`. Tenant+Store composite FK to QA Store registry, explicit scope-based PKs, versioned session CAS, TTL, unique event key; all four have ENABLE+FORCE RLS; PUBLIC grants revoked. No real customer records, JWTs, photos or provider tokens.
- `qa/v171c-commerce/ci-pg17-private-link-context-rehearsal.sh`: runs real disposable Postgres 17, verifies wrong Tenant/Store/channel rejection; single-transaction `consumed_at` + identity bind; consumed-token replay denied; conflicting canonical customer bind rolls back; expired challenge denied; session state survives a new DB connection, version-CAS rejects stale writer; Store B cannot retrieve A context by exact Store-scoped query; expired session denied; **two concurrent PG client connections** race to claim one event and exactly one succeeds; private tables FORCE RLS/no untrusted grants.
- Important: this test uses a privileged disposable `postgres` role and does NOT prove real hosted API least privilege, true JWT-based RLS, concurrent business writes or a hosted conversation store. Separate server adapter and migration approval still required.

### 4. IMPLEMENTED — Vision catalog retrieval benchmark (numeric fixture only)

`qa/v171c-commerce/synthetic-vision-retrieval.cjs`:
- Accepts ONLY a **merchant-approved Store-scoped synthetic image embedding catalog** with tenantId/storeId, image approval, SKU/itemId, embedding and catalog revision/version. Unapproved, stale, cross-Store or duplicate image embeddings are rejected.
- Cosine similarity Top-K (<=5) returns candidate SKU identity, not confirmed SKU. `CANDIDATES_NEED_CUSTOMER_SKU_SELECTION` and separate final order confirmation remain mandatory. Unknown items return `NO_RELIABLE_MATCH`.
- Labeled synthetic vector fixture (10 queries including 6 labeled positives, 4 negatives, one adversarial visually similar noncatalog query) measures Recall@1/K and false-positive queries **for those numeric vectors only**, not an image model. A likely lookalike false positive is *intentionally* present to demonstrate that confidence/threshold cannot replace customer SKU confirmation. No raw customer image, image decoding, model API or cost was used.
- **No trained model, dataset of real images, embedding provider, calibration or production Recall@K claim.** Next stage needs authorized product-image dataset, privacy/Storage policies, genuine vision embedding inference, SKU labels and budget+latency acceptance.

### 5. Prior QA preserved; current verification pending
- New Link unit tests: 20 (expected).
- New synthetic Vision unit tests: 19 (expected) and 10 labeled QA query samples.
- Inherited V17/V14/V15 tests: 119. **Potential total 158 tests**; do not declare PASS until exact-HEAD GitHub Actions evidence.
- Real ephemeral PostgreSQL 17 durability and parallel event claim job must be checked separately.
- Hosted release Gate MUST intentionally refuse with `V171C_HOSTED_NO_GO`. Overall workflow **will be RED** by policy even when offline QA is green.
- V17.1A/B manual n8n QA executions #4342/#4343 remain valid historical synthetic evidence but are not real provider UAT.
- 96+36 uploaded linguistic tests have not been re-run against actual AI model.

### 6. Security blockers / approvals
**P0 BLOCKED**: actual messenger Page and Zalo OA/Bot user signatures/permissions, verified source and destination channel proof, real consent & rate limits, persisted private Store Owner/identity mapping, independent four-row Store/RLS and JWT tests, host DB ACL and independent M0 recovery, Postgres adapter privileged-caller authentication and independent transaction review.

**P1 BLOCKED**: real catalog media ingestion, consent and image retention, Vision embedding model evaluation, source→destination account verification UX, durable session service API, persistent outbox, production n8n integration, model cost approved benchmark and real one-message authorized UAT.

No real provider SEND, n8n Published change, order/stock/customer mutation, Supabase hosted DDL/RLS/GRANT/REVOKE, credential change, photo upload, backup/export or model billing authorized here.

**Rollback:** close Draft PR. No hosted database or provider rollback required.
**Checkpoint:** `V171C_SOURCE_IDENTITY_LINK_PG17_CONTEXT_VISION_RETRIEVAL_CANDIDATE_HOSTED_NO_GO`.


### 7. Verified exact-source CI acceptance and reproducible benchmark — 17 November 2026 JST

**Tested source commit:** `9868e112b65edd45e4a3aca735d75e9094c5a1fe`  
**GitHub Actions:** https://github.com/ngoctien20/demo-git/actions/runs/43998457127

**TESTED:**
- Source QA job **SUCCESS**: 20/20 new cross-channel challenge tests + 19/19 new synthetic vision retrieval tests + 33/33 V17 pilot + 36/36 V14.3 Channel + 36/36 V14.7 Studio + 14/14 V15.2 identity/gateway = **158/158 Node PASS**. Static no-direct-provider/hosted-write/network/credential scanner PASS.
- Genuine throwaway PostgreSQL 17 CI job **SUCCESS**: 18 explicit SQL/bounded assertions PASS, including Hash-only private challenge, wrong Tenant/Store/Zalo variant rejects, atomic redeem→link, replay refusal, conflict rollback without consuming token, expiry refusal, persistent conversation across new connections, CAS revision 1→2 with stale rejection, Store-specific query isolation, expired session refusal, **two concurrent PostgreSQL connections one-event/one-claim**, four FORCE-RLS private tables and no untrusted grants.
- Reproducible benchmark executed in CI with `node qa/v171c-commerce/run-synthetic-vision-benchmark.cjs`, static `synthetic-vision-benchmark-corpus.json` dataset, **10/10 labeled numeric vector queries** comprising 6 present-SKU and 4 absent-SKU queries: `syntheticRecallAt1=1.0`, `syntheticRecallAt3=1.0`, `syntheticUnknownFalsePositiveRate=0.25` (1 out-of-catalog lookalike matched a catalog candidate). This deliberate negative illustrates that similarity **does NOT establish SKU identity**. These statistics have zero measured real image recognition value; `realImageBytesExamined=0`, `realModelCalls=0`, `productionThresholdApproved=false`.
- Hosted L3/L4 release job is deliberately **NO-GO**, exiting 3; overall GitHub run therefore appears FAILURE while both offline QA jobs are green. This is policy enforcement, not a failed source or PostgreSQL test.

**P0 caution:** a stolen unexpired pairing token might be presented from an attacker-controlled authenticated destination. Before any real linkage, require an independently verified destination identity and revocation/consent recheck at redemption; additionally consider explicit confirmation on the originating verified channel after displaying the masked target binding. The QA Map / anonymous callback inputs and PG17 test fixtures are **NOT an approved real end-to-end identity system**.

**No changes to Pubished Messenger/Zalo, Supabase hosted, real customer Orders, Auth/Storage or credentials.** The owner-accepted H11R limited Application local QA archive remains unchanged; M0 full independent restore and Store JWT/RLS still BLOCKED.

**Canonical classification:** `V171C_PRIVATE_CHALLENGE_AND_PG17_CONTEXT_SYNTHETIC_VISION_TESTED_L3L4_HOSTED_NO_GO`.
