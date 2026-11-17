# TIEN404 AI — V17 CBOT-COMMERCE-UAT-01
## Phase A Capability Audit × Phase B/C/D No-Send Contract Pilot × Acceptance Checkpoint

**Status (before exact-HEAD CI):** `VERIFIED_AUDIT` / `IMPLEMENTED_SOURCE_ONLY` / `TEST_PENDING` / `REAL_CHANNEL_UAT_BLOCKED`
**Date:** 2026-11-17 JST
**Parent checkpoint:** RPC.10 PR #237, exact base SHA `8cebbf72aabb943242c4dcbecb83238292c258d6`.
**Safety:** No Supabase hosted SQL writes/DDL, no credential changes, no Published n8n workflow edits, no provider messages, no model billing, no production Webhook or Commerce orders.

### 1. User-defined objectives and boundaries

Work originated in the user's full V17 CBOT-COMMERCE-UAT-01 instruction:
Messenger × Zalo OA and Zalo Bot adapters, Verified Cross-Channel Identity, Context Intelligence, Visual SKU candidates, explicit SKU selection + final order confirmation, Custom Bot Studio, and actual UAT acceptance, not only diagrams.
**This checkpoint implements the first safe pilot of B/C/D**. It does NOT pretend the final commercial product or live Meta/Zalo image recognition exists.

Rules: **EXPERIMENTAL → CANDIDATE → APPROVED → RELEASED**. Real webhook signatures, Page/OA privileges, customer linking, catalog truth, Store RLS and order writes remain server-owned and must be proven independently.

### 2. VERIFIED — direct n8n inspection

Current n8n has these independent workflows:
| Workflow | ID | State | Observation |
|---|---|---|---|
| Messenger main | `Z7FdV7uDvApfbURQ` | active Published | 27 nodes. HMAC verification + duplicate handler + live AI Agent + Google Sheets DEMO + order tools + HTTP send; not Commerce V17 |
| Zalo Bot ingress V1 | `yIJk8LvJoLF40Z62` | active Published | 10 nodes, protected webhook / private router / V2 shadow; **no assurance of Commerce cross-channel live identity** |
| V17.1A Channel→Store QA | `DCj7mQbovyYNf7Li` | inactive | Four-node synthetic QA, no SEND |
| V17.1B native ingress QA | `Bs4QX1fP2S226N8j` | inactive | Four-node synthetic Meta HMAC / Zalo Bot header / binding QA |
| CBOT-UAT-02 cross-channel lookup | `6IMJj5xdCGC2b5ll` | inactive | Four-node synthetic no-send, not a real linked customer lookup |
| Commerce Catalog Query | `oOOXicKXGkBskKqh` | active | Separate Commerce sandbox, not equivalent to live Store-scoped catalog proof |
| AI_SALES_DEMO main | `v6PBwcqSapVzACMW` | active | Preserve DEMO/Commerce separation |

Instance/user n8n preference verified: DO NOT share AI_SALES_DEMO Orders/Products/credentials with Commerce, do not break Published; separate folders for DEMO/Messenger live/Commerce/Website/QA.

**No workflow was changed, published or executed by this V17 intake.**

### 3. VERIFIED — Supabase staging only aggregates

Project `ifxlvrhyjhbzbrkdsida`:
- 2 Tenants, 2 Products, 2 Orders, 0 Customers, one Product/Order + active Owner in each Tenant.
- `public.stores` and `public.store_memberships` ABSENT. Legacy Tenant-scope policies still permissive; real same-Tenant Store JWT/RLS not certified.
- Presence of `tenant_agent_configs` and `tien404_qa_sandbox_products` does not establish live merchant Custom Bot self-service or Vision image retrieval.
- RPC.10 FK rehearsal passed only in disposable PG17. Real four-row Owner→Store proof and independent full recovery remain blocking.
- Old H11R user-accepted partial Application archive inspection `H11R_PARTIAL_APPLICATION_ARCHIVE_LOCAL_QA_OWNER_ACCEPTED_WITH_LIMITATIONS` **stays unchanged**. Auth/Storage independent recovery not verified.

### 4. VERIFIED — QA dataset inventory (local uploaded CSVs)

- `AI_SALES_QA_96_SINGLE_TURN.csv`: **96 unique cases**, all `actual_output` blank. `AI_SALES_QA_96_SINGLE_TURN (1).csv` is byte-for-byte SHA256 duplicate.
- `AI_SALES_36_MULTI_TURN_FOR_LATER.csv`: **36 unique groups**, all `status=NOT_RUN`.
- `AI_SALES_QA_CASES.csv`: **97 rows but 96 unique case IDs** because QA01 repeats; all 97 `actual_output` cells are populated, but the CSV does not itself certify live model execution, real tools or production.
- This source-only branch contains **new separate tests** for cross-channel identity + image selection; it does not claim the 96+36 uploaded benchmark suites were re-run on a live provider or model.
- The local CSVs have NOT been uploaded into the public GitHub repository.

### 5. Official provider documentation reconnaissance (not account entitlement proof)

- Meta Messenger Quick Start supports image attachments in message webhook events and Page-scoped sender IDs. Account permissions and eligible Page testing must still be verified:
  https://developers.facebook.com/docs/messenger-platform/getting-started/quick-start
- Zalo OA OpenAPI requires App/OA grants, Webhook registrations and relevant permission groups:
  https://oa.zalo.me/home/documents/guides/Khoi-tao-ung-dung-va-cap-quyen_117071366476220195
- Zalo Bot and Zalo OA are DISTINCT products. Do not treat `X-Bot-Api-Secret-Token` as OA's signature contract. The native provider-specific verifier must be independently reviewed.
- New Supabase CLI v3 and provider changes exist; no CLI migration is performed in this branch.

### 6. IMPLEMENTED — safe reusable source layer

`qa/v17-cbot/cbot-readonly-contract.cjs`:
- **Existing V14.3 reuse:** `../channel-v143/channel-core.cjs` handles Shop-scoped catalog item truth and preview response validation. The existing V14.7 Custom Bot Studio synthetic contract and V15.2 server-injected identity connector are **preserved without edits**.
- Requires injected callbacks `attestInbound`, `readCatalog`, `matchImage`, `resolveVerifiedLink`, `lookupOrder`. Source does NOT verify actual Meta/Zalo credentials or signed JWT; it fail-closes on missing/mismatched claims and states evidence remains unverified. The callback implementations in unit tests are intentionally synthetic.
- Image candidate scores never authorize a SKU: accepts only catalog items belonging to the verified Store, returns maximum three candidates and `SIMILAR_PRODUCTS_REQUIRES_SKU_SELECTION`; no `EXACT_MATCH` confidence certification from uncalibrated model scores. `NO_RELIABLE_IMAGE_MATCH` for absent candidates.
- Text conversation uses **ephemeral per-Store/per-verified-customer** 15-minute in-memory state: SKU can be selected, quantity uses authoritative catalog price and stock, creates only `ORDER_DRAFT_AWAITING_CONFIRMATION`. No write even if customer explicitly says `xác nhận đặt hàng`. Ambiguous quantity asks for product selection.
- Order reference remains only a **lookup hint**. Without an independently verified channel→canonical customer link, no lookup callback is invoked. Cross-Tenant/Store/customer mismatches cause generic denial. Does not return any address or phone even if backend returns them.
- In-memory replay ID check is **ephemeral demo protection only**, never claimed durable idempotency. Future real backend needs persistent dedup/event_id and transactional order writes.
- No real image bytes processed, embedding index built, model called, n8n workflow changed or live Order inserted. It is a contract fixture, **not a working Vision model or end-to-end bot**.

`qa/v17-cbot/cbot-readonly-contract.test.cjs`:
- Synthetic Messenger/Zalo and Shop A/B/C positive/negative cases.
- Candidate/price/stock grounding, explicit confirmation refusal, cross-channel verified grant/session rules, fake order lookup authorization, expiration, replay and no send.
- Actual outcomes require exact-commit CI confirmation before marking TESTED.

### 7. Blockers and UAT admission criteria

**P0 BLOCKED:** real Store Ownership/RLS; canonical identity link challenge/OTP & consent store; durable cross-channel conversations; real customer-level OrderAccessGrant, Meta/Zalo account permissions, genuine provider signature verifier and real signed Session/JWT; protected private media retrieval; actual Vision embedding/pipeline & measured SKU Recall@K; atomic order confirmation via Commerce Core.

**P1 BLOCKED:** browser/merchant Custom Bot Studio actual hosted ownership controls; catalog ingestion image versioning; staff handoff real Page/OA; real provider rate limits/policies; benchmark model budget; actual 96+36 case re-run.

Real API sends, Commerce hosted writes, provider credential changes, paid model calls, production webhook, migration and source merge remain **UNAUTHORIZED**.

### 8. QA release matrix

| Acceptance level | Current status |
|---|---|
| Level 1 — source contract/unit tests | IMPLEMENTED, CI pending |
| Level 2 — synthetic Messenger/Zalo text and image candidate workflow | IMPLEMENTED within test harness only |
| Level 3 — n8n + Supabase hosted staging E2E | BLOCKED until real Store authority and approved writes |
| Level 4 — authorized real Meta/Zalo account UAT | BLOCKED until account-specific consent/permissions and direct verified evidence |

**No synthetic PASS can promote a bot to APPROVED or RELEASED.**

### 9. Rollback and next action

Close this child Draft PR / revert only `qa/v17-cbot` and V17-specific CI/checkpoint. Hosted systems and n8n workflows need no rollback because no changes were made.

Next safe step is a *server-side* verified provider adapter + ephemeral catalog image benchmark, and an offline identity link proof-flow (out-of-band challenge) with distinct n8n candidate only after review. Do not force actual Auth/Storage backup or perform M0/M1 hosted changes during this milestone.


### 10. Exact code-and-contract QA receipt — 17 November 2026 JST

**Tested source HEAD:** `d6ce6fc3a3b393bac51b722c6d8bbe97f43333bc`  
**GitHub Actions:** https://github.com/ngoctien20/demo-git/actions/runs/43996631884

**TESTED (GitHub Actions job SUCCESS):**
- `qa/v17-cbot/cbot-readonly-contract.test.cjs`: **33/33 PASS**. Covers allowed Messenger/Zalo OA/Zalo Bot, rejected malformed/stale inbound, image candidate/score/scope fallback, SKU+quantity confirmation only, price/stock grounding, unverified order reference rejection, authorized readback mismatch rejection, verified cross-channel Store-specific ephemeral context, TTL, replay, blocked provider and order execution.
- Reused **V14.3 channel 36/36 PASS**, **V14.7 Studio 36/36 PASS**, **V15.2 verified identity/canonical gateway 14/14 PASS**.
- **119/119 Node cases PASS**, plus static no-provider send, no direct network/DB, no paid model, no hosted credential path scan **PASS**.
- **Hosted release eligibility intentionally FAILURE / exit code 3**: `V17_L3_L4_NO_GO_REAL_STORE_RLS_IDENTITY_VISION_PROVIDER_AUTHORITY_REQUIRED`. This explicitly prevents source-only success from being called an approved real Meta/Zalo Page/OA UAT.
- GitHub workflow overall FAILURE is deliberate release gating, not a regression in the unit/source tests.

**CRITICAL LIMITATIONS:** QA callbacks are synthetic (not Meta HMAC, Zalo OA permission, real Zalo Bot secret attestation, Supabase JWT, OTP challenge, or signed order grant); images are represented only by opaque synthetic references and scored candidate IDs; no actual image recognition/embeddings/cost/performance benchmark has been run. Memory and replay ID tracking are in-process, expire or vanish across worker restarts, and do **not** establish durable multi-instance continuation/idempotency. Cross-channel order lookup is a source-only readback contract; no live Orders database was accessed.

**Current canonical checkpoint:** `V17_PHASE_A_VERIFIED_BCD_SOURCE_CONTRACT_TESTED_L3L4_NO_GO`.
**No hosted or provider side effects**; rollback is close Draft PR.
