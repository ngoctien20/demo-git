# TIEN404 V17.17 — Bounded Messenger Demo Intent Router × Shared Core Catalog-Only Release

**Checkpoint date:** 2026-11-17 JST. **Scope owner authorization:** Continue developing previously verified Messenger `QA_CORE:` demo-only read-only product consultations and shared Core security. No production Commerce Store owner/data authorization, customer order writer, stock update, Zalo OA messaging or public merchant Website session enabled.

## 1. Actual current published versions

| Workflow | ID | Previous version | Current PUBLISHED |
| --- | --- | --- | --- |
| Messenger LIVE | `Z7FdV7uDvApfbURQ` | `2b869035-fe39-46fb-a253-18fefe4ecbfd` | **`1064b1b3-d3f1-4a6b-a367-2414ba691522`** |
| Shared central Commerce Core | `iyfGUiEsZlNTBWOR` | `b08f806b-25dc-40d4-9e82-212307ce19b9` | **`456862c9-e5ee-4bfa-9931-47dbc39ab73d`** |
| Existing Meta signed non-PII shadow | `dw1JOxWOEY8csTnm` | unchanged | `450f2693-aad9-47d8-aaba-ac7a94abe644` |
| Shared Zalo/Web fail-closed Core bridge | `4ycmVzaNzVRulBjQ` | unchanged | `76bbb4e9-7ad2-45a6-8188-260523ced57a` |
| Protected Zalo Bot staging (NOT OA) | `yIJk8LvJoLF40Z62` | unchanged | `776486b2-092f-49ec-a7c4-f74ec8b60f07` |
| Public Website marketing assistant | `wgkkmT7q4lm4HyuA` | unchanged | `c81929d4-ab55-4c24-8659-795842739e24` |
| Manual Core QA | `7XzLd51D7C6tlaS4` | `ec998d42-2b23-4dbf-b29b-5a6bfc2489ee` | **DRAFT `71a07fe7-b152-4a02-93bd-54ff1de3a0b2`, INACTIVE / NOT PUBLISHED** |

## 2. Design and implemented code

### A. Messenger opt-in policy

- The exact existing `V17.15 Strip PII and Normalize Demo Query` Code node was modified; **no other Messenger node or connection was added, removed or modified** (verified n8n version diff). Signed raw Meta HMAC, registered Page gate, existing MID dedupe, original Messenger Agent for non-prefixed messages, existing one Meta reply route and shadow branch preserved unchanged.
- Applies only to existing signed Page and **`QA_CORE:`** messages; other messages run the original legacy DEMO bot.
- The new pure classifier removes original customer text and original sender identifier from central Core input; forwards only stable **synthetic sender ID**, fixed Page technical account ID and bounded whitelisted **static intent token or F-101/F-102**.
- Categories: known sample SKU (supports `F101` and `F102` formatting), unknown or cross-Store SKU (fail no product), product catalog, private input, order/payment/hold-stock request, shipping, wholesale, human handoff request, and unknown intent. Phone/email/URLs/API keys/OTP/admin impersonation/overlength prompts do not get forwarded as customer text.
- Security: this is **sanitization at the new Core boundary**, NOT a claim that the existing Messenger webhook/dedupe/Audit never receives sender identifiers. No real customer ID enters the new deterministic Core advisor.
- Customer-facing response remains the existing **single** Messenger Meta Send Reply node; the new `QA_CORE:` pilot still cannot invoke the existing legacy order tools. For **unprefixed** messages, the historical legacy DEMO bot still has `create_order`, `manage_order` and other DEMO tools and can write a DEMO order (prior #4498). **Full Page write prohibition is NOT true.**

### B. Central Commerce Core

- New `V17.17 Catalog Intent Only?` IF node gates the *existing* read-only Commerce Catalog call; non-catalog intents go directly to deterministic safe policy responses. This avoids unnecessary product table reads, model calls or Commerce actions for shipping/wholesale/human/privacy/order/unknown requests.
- Only two existing Code nodes modified: `V17.15 Sanitize Read-Only Demo Query`, `V17.15 Format Safe Demo Consultation`. Zero other Code/Agent/tool edits.
- The only positive source remains the existing `demo_tien404` SANDBOX Tenant, named Page and sample-only Commerce Catalog. F-101 and F-102 sample prices are returned only by the actual existing Commerce Catalog; no real Store/products/discounts/warehouse policy fabricated.
- The new deterministic FAQ does not promise shipping pricing, wholesale policies, real human transfer, ticket creation, order creation, payment or stock reservation. Every safe reply starts `[TIEN404 CORE — DEMO CHỈ ĐỌC]`, identifies sample-only data, and carries `canSend:false, canWrite:false, live:false` internally.
- This is **NOT a multi-turn LLM commerce bot** and does not replace the old Messenger language model for ordinary non-prefixed chats.

## 3. Executed regression evidence (actual tool n8n execution, not fabricated results)

| Execution | Grounded evidence | Scope |
| --- | --- | --- |
| **#4809 SUCCESS** | **25/25** actual integrated Core calls, 8 unbound denied, 2 known SKUs, 7 older privacy/unknown/order cases, 8 new shipping/wholesale/handoff/private/catalog/unknown-SKU/order markers. No model/Commerce writes/new provider sends. | Core candidate DRAFT tested before publish |
| **#4866 SUCCESS** | **25/25** actual integrated Core calls after Core Published; same fail-closed and sample catalog assertions. | Post-publish Core |
| **#4889 SUCCESS** | **2/2** private Zalo Bot and Website technical bridge calls to real Core rejected with no Store authorization, no sending/customer text/order writes. | Post-publish multichannel deny |
| **#4917 SUCCESS** | **8/8** separate actual Commerce Catalog QA: correct sample F-101/F-102 prices, unknown Page denied, cross-Tenant products not returned. | Post-publish tenant catalog |
| **32/32 offline JS classifier checks** | In-process V8 classifier function evaluated with 28 synthetic content cases and four untrusted Page/sender/media/prefix rejections **before Messenger publish**. Exact pure-source snapshot was saved and subsequently compared byte-for-byte to the Published Messenger Code node function. | Unit/offline, NOT real Meta event |
| **#4544 + #4545 + #4549 + #4550** (prior V17.15R) | Real signed Meta Messenger `QA_CORE: F-101` was already verified, with one accepted Meta reply, no writer on opt-in path and original non-PII shadow. | **OLD** V17.15 published version, not reinterpreted as post-V17.17 real signed UAT |

- During isolated `#4809` QA window (06:52:30–06:52:42 UTC), only **three** actual `TIEN404_COMMERCE_CATALOG_QUERY` integrated executions occurred for 25 Core requests: #4828, #4832, #4858. This is the measured pilot routing efficiency, NOT production latency or billing savings.
- Post-published QA runs `#4866`, `#4889`, `#4917` overlapped in calendar time, so do not attribute all catalog execution counts observed in that window to a single suite.
- All four edited/added n8n Code/IF nodes independently schema-validated before publish. Messenger version diff: exactly **one existing Code node changed**, zero graph edges changed, no other node touched. Core version diff: **one IF added**, two existing Code nodes changed, expected catalog branch rewiring.
- Added reproducible source-only test files:
  - `qa/v1717-core-intent/messenger-classifier.snapshot.mjs`: exact pure function extracted from the real **Published** Messenger n8n Code node.
  - `qa/v1717-core-intent/messenger-classifier.test.mjs`: 32 Node builtin test cases. Local container could not retrieve GitHub raw sources due unavailable DNS, so **the committed standalone Node test command was NOT independently executed** in container this turn; 32/32 V8 pre-publish tests and GitHub snapshot/live byte comparison were observed. Run `node --test qa/v1717-core-intent/messenger-classifier.test.mjs` in an authorized CI or developer workspace before a wider release.
- A post-release synthetic Messenger GET wrong-token canary was not re-executed due execution-harness refusal; earlier previous-version invalid GET #4538 was verified. No new signed Meta POST to the newly published V17.17 opt-in path has yet been independently observed.

## 4. Authorization reality / remaining NO-GO

Read-only hosted Supabase PG17 staging metadata freshly checked after publish:
- `public.stores`: absent.
- `public.store_memberships`: absent.
- `store_id` across six Commerce surfaces: **0**.
- Store-qualified RLS policies across those surfaces: **0**.
This is **no actual merchant Store authorization** for using Core as a real commercial sales advisor.

Commerce channel registry Data Table `gKN8yR1CabZT2nZ8` freshly checked:
- Existing Messenger Page → `demo_tien404`, `connectionStatus=sandbox`, enabled.
- Zalo OA for that tenant: `not_connected`, disabled and unconfigured.
- Website channel for that tenant: `not_connected`, disabled and unconfigured.
- Two other Website channels are **sandbox fixtures** for materials and grocery QA; not real merchant Website installation authority.

The existing private Website signed issuer and browser QA V17.4 source already exist under `qa/v174-private-issuer/`. Do not rebuild or claim hosted integration; hosted Store owner/domain proof and dedicated issuer authorization are separate tasks. No provider credentials, Meta App subscriptions or website canonical domain routing changed.

## 5. Rollback, approval and next acceptance

- Rollback **Messenger first** to `2b869035-fe39-46fb-a253-18fefe4ecbfd` if the V17.17 classifier causes any existing Messenger regression. Do not reset the original Messenger Page callback or disable the existing demo bot.
- Rollback central Core to `b08f806b-25dc-40d4-9e82-212307ce19b9` **only if necessary** after Messenger rollback; ensure other restricted internal callers still behave fail-closed.
- Zalo Bot staging, Website marketing, private multichannel bridge and original Meta signed shadow are unchanged by this checkpoint.
- No credential, Supabase writes/migrations, Google Sheets rows, order/stock/payment data, or production send API behavior deliberately changed by this release. No paid LLM requests were initiated by the new deterministic pilot and QA test harness.
- Next **real signed QA** from owner-authenticated test Page account: `QA_CORE: F-102`, `QA_CORE: VL-101`, `QA_CORE: gia si` (or human/ship). Independently confirm HMAC, normalized static intent, Core response, only one Meta MID, no old DEMO agent invocation, zero new orders. No synthetic Meta HMAC success claim.
- Next positive Website UAT needs a known valid session and cost-admitted model QA, or separate independent Website Store-signed issuer acceptance. Zalo Bot real protected inbound and Zalo OA native signed installation are separate from this manual bridge deny.
- **Release verdict:** `GO_DEMO_READONLY_MESSENGER_INTENT_CANARY`, `GO_INTERNAL_ZALO_WEBSITE_FAIL_CLOSED_SHADOW`, `NO_GO_MERCHANT_STORE_COMMERCE_LIVE`. PR #243 remains DRAFT.
