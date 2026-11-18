# TIEN404 AI — V18.5.5 Protected Read-Only Commerce Adapter

**Date:** 18/11/2026 JST  
**Status:** INTERNAL ADAPTER IMPLEMENTED; 12/12 REAL n8n SANDBOX QA PASS; HTTP INGRESS AND HOSTED CONNECTION BLOCKED PENDING DEDICATED AUTH CREDENTIAL.  
**Release:** CANDIDATE — NO PRODUCTION.

## 1. Objective and continuity

V18.5.5 continues V18.5.4 and reuses the existing Commerce Core child workflows. It does not create a second AI Sales Core. The full Commerce AI Agent is intentionally excluded because its tool graph can reach a support-ticket writer; this phase calls only the Published Catalog Query and Cart Preview children.

The V18.5.4 owner Access runtime remains verified. The alternate-identity denial is still pending; the new V18.5.5 work is limited to inactive internal workflows and source-only Worker candidate code.

## 2. Actual n8n implementation

### Internal Adapter Core — IMPLEMENTED

- Workflow: `TIEN404 V18.5.5 Protected Read-Only Commerce Adapter`
- ID: `rYwrJfJavcaZcjUI`
- Personal project, folder: `03_TIEN404_COMMERCE - PRODUCT / 01_CORE - ENGINE`
- Version: `7e72477e-ab8e-4176-a6c1-4277e5e2c538`
- Active: **false**; Published: **no**.
- Trigger: internal Execute Workflow Trigger only. No public Webhook.
- Caller policy: `workflowsFromAList`; only QA workflow `At2msGSDpmJ1GvnK` is allowed.
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

### BLOCKED — dedicated HTTP authentication

No existing credential is reused. A dedicated n8n Header Auth credential is required, with header name `x-t404-adapter-token`. The same high-entropy secret must be stored as a Cloudflare Worker secret `T404_N8N_READONLY_ADAPTER_TOKEN`; the webhook URL is `T404_N8N_READONLY_WEBHOOK_URL`.

The available n8n connector can list credentials but does not expose a credential-create action. Therefore no credential was created and no public Webhook ingress workflow was activated. Do not paste the shared secret into chat.

### BLOCKED — hosted integration

The next controlled step is to create the dedicated staging Header Auth credential and a separate inactive Webhook ingress workflow, then attach the credential, call the internal adapter, and return a bounded JSON response. Only after that should the Worker secret/URL bindings be set and a V18.5.5 private canary be deployed under the existing owner-only Access application.

### NOT VERIFIED — Store A/B RLS

V18.5.4 and V18.5.5 prove cross-tenant Sandbox isolation for two separate tenant records. They do not prove same-tenant Store A/B isolation or database Store-level RLS. Do not claim Store-level isolation.

### NOT IMPLEMENTED — durable replay and rate limiting

The internal adapter enforces a 60-second timestamp freshness window and the Worker generates a request ID. It does not yet persist used request IDs or enforce durable per-installation rate limits. Duplicate reads are idempotent and do not mutate Commerce data, but they can consume resources. Durable replay deduplication/rate limiting is required before public customer exposure.

## 6. Safety and release decision

- No n8n Published workflow was changed.
- No credential was created, rotated, shared or reused.
- No Cloudflare Worker deployment or binding was changed.
- No website, Supabase, Render, billing, Messenger or Zalo production changes.
- No customer/order/PII reads, order writes, stock writes or provider sends.

**Decision:** `V18.5.5_INTERNAL_ADAPTER_IMPLEMENTED / N8N_SANDBOX_QA_12_OF_12 / WORKER_SOURCE_CANDIDATE_ONLY / HTTP_INGRESS_BLOCKED_PENDING_DEDICATED_AUTH / STORE_RLS_NOT_VERIFIED / PRODUCTION_NO_GO`.

## 7. Next approval required

Approve creation of a dedicated **staging-only** Header Auth credential and the corresponding Cloudflare Worker secret binding. The credential must be unique to this adapter, must not reuse any Zalo/Messenger credential, and must never be sent through chat. The public Widget and production remain disabled.
