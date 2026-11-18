# TIEN404 AI — V18.5.5 Protected Read-Only Commerce Adapter

**Date:** 18/11/2026 JST  
**Status:** INTERNAL ADAPTER AND INACTIVE HEADER AUTH INGRESS IMPLEMENTED; 12/12 ADAPTER QA + 5/5 WEBHOOK-PIN QA; REAL HTTP AUTH AND HOSTED CONNECTION BLOCKED.  
**Release:** CANDIDATE — NO PRODUCTION.

## 1. Objective and continuity

V18.5.5 continues V18.5.4 and reuses the existing Commerce Core child workflows. It does not create a second AI Sales Core. The full Commerce AI Agent is intentionally excluded because its tool graph can reach a support-ticket writer; this phase calls only the Published Catalog Query and Cart Preview children.

The V18.5.4 owner Access runtime remains verified; alternate-identity denial is pending. V18.5.5 now contains a new inactive credential-bound webhook ingress; the V18.5.5 Worker remains source-only and is not deployed.

## 2. Actual n8n implementation

### Internal Adapter Core — IMPLEMENTED

- Workflow: `TIEN404 V18.5.5 Protected Read-Only Commerce Adapter`
- ID: `rYwrJfJavcaZcjUI`
- Personal project, folder: `03_TIEN404_COMMERCE - PRODUCT / 01_CORE - ENGINE`
- Version: `7e72477e-ab8e-4176-a6c1-4277e5e2c538`
- Active: **false**; Published: **no**.
- Trigger: internal Execute Workflow Trigger only. No public Webhook.
- Caller policy: `workflowsFromAList`; only QA `At2msGSDpmJ1GvnK` and inactive staging ingress `JZL4p8tLb65eU3aB` are allowed.
- No credentials, AI Agent, HTTP Request, provider send, order writer, stock writer or customer-order reader.

### Trusted installation mapping

The adapter accepts only two fixed Sandbox installation IDs and maps them server-side:

| Installation ID | Trusted channel | Server-side account |
|---|---|---|
| `v1855-materials-sandbox` | website | `demo-materials-website` |
| `v1855-grocery-sandbox` | website | `demo-grocery-website` |

The caller cannot supply `accountId`, `channelType`, `tenantId`, `storeId`, `customerId` or `orderId`. Any such authority fields are rejected. The browser never selects a tenant/store directly.

### Permitted operations

- `catalog.search` → existing Published Catalog Query.
- `cart.preview` → existing Published Cart Preview.

All other operations, including private order reads, order creation, updates, cancellation, payments and support-ticket writes, are denied.

The adapter validates request IDs, a 60-second timestamp window, catalog query length/limit, cart size, SKU format, quantity bounds and duplicate SKUs. Cart output is always preview-only with `canConfirm=false` and `canWrite=false`.

## 3. Real n8n QA — VERIFIED

QA workflow:

- `TIEN404 V18.5.5 Protected Read-Only Adapter QA`
- ID: `At2msGSDpmJ1GvnK`
- Folder: `90_QA - DIAGNOSTICS`
- Active: **false**; Published: **no**.
- Main manual execution: **5360**, status **success**.

**12/12 assertions passed.** The harness made five real calls into existing Published read-only child workflows: three Catalog Query executions and two Cart Preview executions. All five child executions succeeded.

| Test | Result |
|---|---|
| Materials Catalog — VL-101 | PASS |
| Materials Cart — 3 × VL-101 = 237,000 VND | PASS |
| Grocery Catalog — TG-101 | PASS |
| Grocery Cart — 2 × TG-101 = 9,000 VND | PASS |
| Materials cannot retrieve grocery SKU | PASS — 0 products |
| Forged Tenant/Store/Account authority | PASS — rejected |
| Unknown installation | PASS — rejected |
| Private order read | PASS — rejected |
| Order creation | PASS — rejected |
| Invalid cart JSON | PASS — rejected |
| Stale timestamp | PASS — rejected |
| Duplicate cart SKU | PASS — rejected |

The existing Published child versions were read-only DataTable `row.get` paths. Side effects observed/allowed by this harness: 0 order writes, 0 stock writes, 0 provider sends, 0 customer-order reads, 0 customer PII reads, 0 AI calls.

Evidence: `qa/channel-v1855/n8n-adapter-qa-evidence.json`.

## 4. Worker Gateway candidate — SOURCE ONLY

Candidate file: `qa/channel-v1855/worker-v1855-readonly-adapter-candidate.mjs`.

It preserves the V18.5.4 native Cloudflare `ctx.access` gate on every route and adds a candidate POST route:

`POST /v1/widget/commerce/read`

The Worker:
- accepts only the two fixed installation IDs;
- accepts only Catalog Search and Cart Preview;
- rejects client authority fields and unexpected request properties;
- bounds request/response payload size;
- creates a server-side request ID and timestamp;
- sends only installation ID, operation and sanitized query/cart to n8n;
- requires the n8n response to explicitly assert Sandbox/read-only/no-order/no-write flags;
- rejects upstream responses that contain tenant/store/customer/order data or missing safety flags;
- allows only HTTPS to the exact n8n Cloud hostname and a `/webhook/*` endpoint;
- sends the server-side `x-t404-adapter-token` header.

The Worker candidate is **not deployed**. No n8n URL or token binding has been set. The current V14.4 deployment remains V18.5.4 and the Commerce endpoints remain locked.

Unit tests: `qa/channel-v1855/worker-v1855-readonly-adapter.test.mjs`.

## 5. Explicit blockers and limitations

### VERIFIED CREDENTIAL METADATA — live HTTP authentication STILL BLOCKED

The user created dedicated credential `TIEN404_V1855_READONLY_ADAPTER_AUTH_STAGING`, type `httpHeaderAuth`, ID `IS2XrqEFUDv7aGsh`. Its metadata and exact binding to the new inactive webhook were verified. The credential secret was neither accessed nor exported. The expected HTTP header is `x-t404-adapter-token`, but its actual name/value cannot be independently inspected from the metadata connector; a genuine authorized HTTP negative/positive test is required before publishing.

Cloudflare Worker would need a separate `T404_N8N_READONLY_ADAPTER_TOKEN` secret containing the same private value and `T404_N8N_READONLY_WEBHOOK_URL` pointing to the staging webhook. Neither Worker binding exists at this checkpoint. Do not send any secret through ChatGPT, GitHub, or screenshots.

### BLOCKED — hosted integration

The dedicated credential and inactive Webhook ingress have now been created and tested with pinned Webhook inputs; real authentication over HTTP is NOT tested. Prior to any activation, verify second-identity Access denial, configure a safe durable replay/quota gate and approve a bounded staged test and rollback. Only after those gates should the owner manually set the identical Worker secret/URL using a trusted UI, and a reviewed V18.5.5 Worker version be deployed.

### NOT VERIFIED — Store A/B RLS

V18.5.4 and V18.5.5 prove cross-tenant Sandbox isolation for two separate tenant records. They do not prove same-tenant Store A/B isolation or database Store-level RLS. Do not claim Store-level isolation.

### NOT IMPLEMENTED — durable replay and rate limiting

The internal adapter enforces a 60-second timestamp freshness window and the Worker generates a request ID. It does not yet persist used request IDs or enforce durable per-installation rate limits. Duplicate reads are idempotent and do not mutate Commerce data, but they can consume resources. Durable replay deduplication/rate limiting is required before public customer exposure.

## 6. Safety and release decision

- No n8n Published workflow was changed.
- A new dedicated staging Header Auth credential was created by the owner and connected to the inactive ingress; its value was never read, exported or shared. No other credential was modified.
- No Cloudflare Worker deployment or binding was changed.
- No website, Supabase, Render, billing, Messenger or Zalo production changes.
- No customer/order/PII reads, order writes, stock writes or provider sends.

**Decision:** `V18.5.5_INTERNAL_ADAPTER_AND_HEADER_AUTH_INGRESS_IMPLEMENTED / N8N_SANDBOX_QA_12_OF_12 / INGRESS_PIN_QA_5_OF_5 / REAL_HTTP_HEADER_AUTH_NOT_VERIFIED / WORKER_NOT_DEPLOYED / STORE_RLS_NOT_VERIFIED / PRODUCTION_NO_GO`.

## 7. Next approval required

The credential is already created and bound to an inactive workflow. **Next approval** is for a tightly scoped real Header Auth HTTP UAT and, separately, adding the matching Cloudflare Worker secret and URL binding. These are NOT implied by credential creation. The public Widget and production remain disabled.


### CI regression wiring

The V18.5.5 QA workflow is also present on the stacked V18.5.4 base branch so GitHub can execute it for this draft pull request. It runs the inherited security regression suite plus the new Worker adapter tests and verifies the real n8n evidence packet. This is CI-only; it does not activate or deploy the adapter.


## 8. Source CI checkpoint

GitHub Actions run [#44271092019](https://github.com/ngoctien20/demo-git/actions/runs/44271092019) executed **119 tests: 119 passed, 0 failed, 0 skipped**, including the new Worker candidate tests and inherited security regressions.

The overall job then failed in the separate evidence assertion step because the assertion expected the Tenant Resolver to appear as a direct child execution. The real execution lineage shows it is invoked inside the Catalog Query and Cart Preview child workflows. This was an evidence-schema/CI assertion mismatch, not a failing adapter or Worker unit test.

The evidence packet and CI assertion have since been corrected to record the resolver as successfully invoked through those read-only children. **A green rerun has not yet been observed**, so overall GitHub CI remains pending and is not reported as PASS.

Current code/test status: `WORKER_UNIT_TESTS_119_OF_119_PASS / N8N_MANUAL_UAT_12_OF_12_PASS / EVIDENCE_ASSERTION_CORRECTED / GREEN_CI_RERUN_PENDING`.


## 9. Inactive Header Auth Webhook ingress — IMPLEMENTED / PIN-TESTED

**New n8n workflow**: `TIEN404 V18.5.5 — Header Auth Read-Only Webhook Ingress STAGING`, ID `JZL4p8tLb65eU3aB`. Personal project → `04_TIEN404_WEBSITE - MARKETING`. 7 nodes, version `5e5b87b2-1dcc-48c9-aa72-98c7866a12f3`. `active=false`, `activeVersionId=null`, **not Published**. Webhook path `t404-v1855-protected-readonly-commerce-staging`, method POST, `authentication='headerAuth'`, response mode `responseNode`. This path is not a live public endpoint.

**Credential binding:** User-created `httpHeaderAuth` credential `IS2XrqEFUDv7aGsh`, name `TIEN404_V1855_READONLY_ADAPTER_AUTH_STAGING`. n8n's SDK auto-assignment initially selected unrelated `Header Auth account`; this was immediately replaced with the exact intended credential via `setNodeCredential`, before any test or activation. A fresh read-back verified the correct credential ID and name. No actual secret value was retrieved.

**Security settings:** Save success/error execution data = `none`, save manual executions = false, save execution progress = false, 15s timeout, caller policy = none. This is deliberate because Webhook trigger outputs could contain authentication headers. Internal Adapter caller allowlist was expanded only to `At2msGSDpmJ1GvnK,JZL4p8tLb65eU3aB`.

**Seven nodes:** Header Auth Webhook → Validate Ingress Envelope → Allowlist IF → (True: call the restricted internal adapter → enforce safe readback → respond JSON) / (False: respond denied JSON). The Code nodes reject caller-supplied authority fields, unknown installations, invalid cart, stale requests, bad methods, and unsafe readbacks. Response output is constrained to Sandbox catalog or cart fields, never customer/tenant/store/order data. No AI Agent, Order Writer, provider dispatcher, or outbound HTTP request node was added.

**Five Pin-Data tests (no HTTP auth):** execution IDs `5383` (order-create denied), `5384` (catalog), `5388` (cart), `5392` (forged tenant), `5393` (unknown installation), all status **success**. The pinned trigger bypasses real network Header Auth. During catalog/cart tests, the existing read-only child workflows ran and returned successful integrated executions: Catalog `5386`, Cart `5390`. Since successful ingress data is intentionally not stored, the individual inbound responses cannot be independently read back through the execution API. Do NOT claim genuine Header Auth 401/403 negative or real remote HTTP success.

**Offline source test:** `qa/channel-v1855/n8n/ingress-contract-offline.test.cjs` runs selected n8n Code-node validators with synthetic request/readback fixtures, including tenant injection, order operations, malformed carts and nested unknown attributes. It does not authenticate against n8n over the network.

**Cloudflare cross-check:** Existing V18.5.4 Worker deployment remains `b4f501e0-ff37-4ea4-be77-6e3148667b15`, with only `T404_ACCESS_AUD` and `T404_QA_OPERATOR_EMAIL` bindings; no new n8n secret/URL and no V18.5.5 Worker deployment. Access audit still has one approved owner login, not an alternate-identity denial.

**Rollback/checkpoint:** Restore the Adapter's previous caller allowlist (QA only), archive the new inactive ingress, and revert the stacked Draft PR changes if necessary. Do not touch Commerce Published workflows or customer data. Preserve credential only if still independently needed; removal would require separate approval.

**Current NO-GO gates:** real Header Auth HTTP UAT, Cloudflare second identity denial, actual Store A/B RLS, durable replay/rate limiting, staged Worker secret and new deployment approval, and complete Website Widget end-to-end testing.
