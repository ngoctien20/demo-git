# TIEN404 AI V16.0–V16.1 — Hybrid Worker × Queues × Direct Model API × n8n Commerce

Checkpoint: **2026-11-16 JST**.
State: **PROPOSED ARCHITECTURE / IMPLEMENTED SYNTHETIC SOURCE-ONLY QA / NO SEND / NO HOSTED WRITE / NO PROVIDER BILLING**.

## 1. Existing state — LIVE audit, do not rebuild

- Base repository: \`ngoctien20/demo-git\`; published website is GitHub Pages \`gh-pages\`, static demo; staging is separate from all production URLs. This Draft PR is based directly on \`gh-pages\`, not any of the independent ADV6 RPC/security Drafts. Do not merge automatically.
- Messenger \`TIEN404_MESSENGER_TEST\`, workflow ID \`Z7FdV7uDvApfbURQ\`, **Published** version \`d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92\`, 27 nodes. Existing flow is \`Webhook1 -> Crypto -> Verify Signature Timing-Safe -> Verify Meta Signature -> Respond to Webhook2 -> Extract Messenger Text -> Skip Duplicate Message ID -> Loop One Message -> Messenger AI Agent -> Prepare Messenger Reply -> HTTP Meta Send -> Verify -> Record Message ID\`. **Webhook already acknowledges before AI.** Model node currently selects \`gpt-5-mini\`. Agent uses Google Sheets Products read-only and multiple toolWorkflow nodes (including real create/manage/update order) on Published; **do not modify** without separate approvals.
- Existing Messenger execution metadata from 2026-11-10 through 2026-11-16: 27 executions, 24 webhook all completed successfully and 2 failed *manual* executions. Webhook elapsed time median \`8.961s\`, p95 (nearest-rank) \`15.407s\`, max \`16.589s\`. These are **workflow execution** times, not independently verified Messenger customer delivery latency; 24 calls are not a concurrency benchmark.
- Zalo staging V1 \`yIJk8LvJoLF40Z62\` Published \`8ca4a6f6-ab3f-42f1-8637-d4f5db790a3e\` (10 nodes), \`Ack Zalo (No Message Sent)\` and staging shadow parent; **no end-user reply/volume proof**.
- Zalo V2 Shadow \`OgDZNSAvKEvhnAvn\` Published \`f00ba506-c52a-4340-9a0c-809fd9c6ea9a\`, includes privileged \`qa_shop_b_zalo_claim\` caller. Do not reroute/REVOKE it automatically.
- Commerce Catalog Query \`oOOXicKXGkBskKqh\` Published \`e0f1e345-8e6c-40cb-8e6a-d7ad2eb92696\` uses tenant resolver \`5Eeh8hbpsoNhuiVo\` Published \`a99c7350-7aea-446d-bdc5-4b10f52c3ad1\`, both Data Tables. These are candidate **contracts** to inspect later, not a ready authenticated Worker HTTP API.
- Create Order Tool DEMO \`KrSn4DNR9ALX5ng4\` **Published** version \`4740251a-cd01-4f7f-b8e1-e300a8393151\` differs from draft \`af9ee686-2a9f-483e-9622-6e449500ac5e\`. Google Sheets writer; not a hosted Store-scoped atomic order writer. Do not switch the gateway directly to this workflow for new customers.
- ADV.6C-RPC.3 PR #186 has intended hosted **NO-GO** gates for privileged RPC revocation and private human evidence; offline tests can be green while whole CI has deliberate red gates. No hosted Store JWT-RLS, backup/restore and private role certification, so Commerce actions remain blocked.

## 2. Why Hybrid; architecture target (NOT deployed)

\`\`\`mermaid
flowchart TD
 A[Messenger / Zalo / Website] --> B[Provider-specific trusted ingress Worker]
 B --> C{Authentic raw signature & channel account?}
 C -->|no| D[401/403 NO SEND]
 C -->|yes| E[Verified platform account to tenant/store mapping]
 E --> F[Durable event inbox/outbox & per-shop quota]
 F --> G[Cloudflare Queues / dead letter handling]
 G --> H{Server-side intent router}
 H -->|safe FAQ| I[Trusted shop FAQ version]
 H -->|catalog price| J[Fresh tenant/store-scoped read-only catalog]
 H -->|complex| K[Direct model API via trusted server-side adapter]
 H -->|order/update| L[Secure Commerce Gateway - BLOCKED]
 I --> M[Provider-specific signed Send Adapter]
 J --> M
 K --> M
 L --> N[Safe confirmation / approved n8n Commerce orchestration]
 N --> M
 \`\`\`

**Important:** ACK only after signature verification plus accepted durable event receipt, never after untrusted parse alone. ACK p95 does not represent customer reply p95; add queue/model/send-to-provider latency to measure actual reply. Queue is **at least once**, so a replay-safe durable writer with transaction and per-conversation ordering is needed. Sequence/cross-store consistency must be server verified. A preliminary n8n ACK is already in place; Workers migration is for modularity, burst absorption, safe fast-path and limits, not magically speeding AI.

### Provider trust boundary
- Meta: verify raw HTTP body against authentic Meta app secret X-Hub-Signature-256 using constant-time HMAC verification. Check page app subscription, exact Page ID and account binding. Do not trust content-provided tenant/store.
- Zalo: independently implement and test **provider-specific** signature/contract using official Zalo version and app/SA policy; do not reuse Meta shared-HMAC as if equivalent. Verify OA/app/channel ownership and actual user consent/allowlist. A previously used Supabase Vault header gate is not conclusive raw provider-signature or replay protection.
- Website Widget: short-lived first-party signed session proof bound to tenant/store/origin, CSRF protections and server-side role validation; **not** the same as Meta/Zalo verification.
- All provider sends require authorization/consent, verified recipient account, rate limiting, provider-specific policy and durable outbound idempotency. **Absent here.**

### Product lanes
- **FAST FAQ:** trusted shop name/hours/address/policy, short fixed reply sourced from versioned verified shop profile, no model; stale/missing shop data = fallback, not invented answer.
- **FAST Catalog:** tenant/store scoped read-only catalog, short TTL cache only for product descriptions; price/stock must use freshly verified data for quote and always authoritative data at write. No cross-tenant cache keys or global conversation memory.
- **AI Complex:** model API direct server-side with allowlist and capped input/output/timeout; ability to benchmark \`gpt-6-luna\`, \`gemini-2.5-flash-lite\` vs published \`gpt-5-mini\`, full 96/36-case QA. No real API is called in this milestone.
- **COMMERCE:** create/manage/update/status tools require exact store-bound authenticated principal, server-verified price/quantity, explicit customer confirmation, durable idempotency, atomic inventory and order effect. As of RPC.3 these gates **remain BLOCKED**. n8n can orchestrate after trusted writer approval, not grant arbitrary SQL/service_role to model.

## 3. Implemented QA source files and limits

- \`qa/v16-hybrid/hybrid-core.mjs\`: strict synthetic-only raw-body QA HMAC; exact event contract, 5-minute timestamp freshness, distinct synthetic channel/store registry (injected), per-shop admission, injected mock outbox/queue, retryable enqueue failure, SHA-256 key for event replay scope, no price/order/model functionality.
- \`qa/v16-hybrid/worker.mjs\`: actual module-style Cloudflare Worker entrypoint for **QA-only** \`POST /__qa/v16/event\`. Rejects any real provider webhook URL. No Wrangler config/bindings or deployable production path committed.
- \`qa/v16-hybrid/hybrid-core.test.mjs\`: 42 cases including forged signature, fake tenant/role, cross-shop, queue retry, duplicate event, quota, different Store binding, disabled mode, FAST/AI/COMMERCE preview and 0 sends/cost.
- All external dependencies injected as **QA mocks**. The in-memory Ledger is NOT durable, NOT a real Cloudflare Durable Object, NOT a transactional outbox and NOT certified for cross-process atomicity. Exactly-once **business effect** requires hosted DB transaction and approved idempotency proof.
- Security hard stops: only exact canned synthetic text allowed; any real customer PII/phone/JWT/tenant/store/role field rejected; no direct model API; never persist the raw message or token; both \`performRealProviderSend\` and \`executeRealCommerce\` throw.
- Under an actual deployment, the QA mock bindings and HMAC would have to be replaced with a fully audited deployment design. **No Cloudflare routing, queue, secret, credential or Paid API connection created here**.

## 4. Latency SLO / test budget — PROPOSED NOT VERIFIED

| Metric | Stage target (p95) | Production/merchant pilot acceptance prerequisites |
|---|---:|---|
| Raw provider event validated & acknowledged | ≤1.0s | Time at provider edge + durable queue admission, 1k samples per channel and 95% CI |
| Queue waiting, low traffic | ≤0.2s | queue batching config \`max_batch_size: 1\`, \`max_batch_timeout: 0\`, monitor backlog |
| Shop scope / FAQ local read | ≤0.3s | trusted mapping + cache version, no public identity |
| Simple FAQ customer reply end-to-end | ≤3s | provider send acknowledgement and delivery evidence; 1k sampled |
| AI quote/consult p95 customer reply | ≤12s | real model/cat/provider timings, quotas, 1k sampled; reduce call iterations |
| Failure rate / provider timeouts | <1% | ≥1000 real provider/pilot attempts; CI errors distinguished from NO-GO |
| Wrong price, cross-shop read/write, duplicate Orders | 0 confirmed in regression | Negative authenticated Shop A/B, fresh price/stock, irreversible effects blocked |

**No measured end-user delivery p95 is available.** Existing Messenger webhook workflow p50=8.961s, p95=15.407s is NOT comparative V16 benchmark; model response tests require separately measured traces. Queue batch default is 10 msgs / 5s; choose max_batch_timeout=0 only if latency/throughput/limits tested in staging. Telemetry phase stamps: \`ingress_received_ms\`, \`verified_ms\`, \`outbox_committed_ms\`, \`queue_enqueued_ms\`, \`queue_dequeued_ms\`, \`router_started_ms\`, \`catalog_ms\`, \`model_first_token_ms\`, \`model_total_ms\`, \`send_api_accepted_ms\`, \`provider_delivery_ms\`; redacted IDs only.

## 5. Quotas — PROPOSED policy, NOT implemented on production

| Store tier | Accepted events per minute | AI in-flight/store | Token budget/day (input+output) | AI monthly spend cap | Retry/DLQ |
|---|---:|---:|---:|---:|---|
| QA synthetic | 2 | 1 (mock only) | 0 real tokens | $0 | queue mock only |
| First merchant Pilot | 10 | 2 | 200,000 | $10 soft warning; hard cap set after authorization | ≤3 retries, audited DLQ |
| Scale candidate | 30 | 5 | 1,000,000 | $40 warning; hard cap set after authorization | ≤3 retries, audited DLQ |

Cap at Store, tenant, provider channel and distinct subject to avoid fairness/replay abuse; global provider/project caps override tenant limits. **Real concurrency quotas must use atomic, durable state** (e.g., scoped Durable Objects), not a per-Worker variable or per-instance memory. Each Shop gets separate conversation memory and event/outbox partition. Enforce max AI calls and token budget at server adapter, not based on LLM claims. Owner receives notifications for cost 70%/90% and overload; fallback no hallucinated stock/prices.

Queue \`at least once\`, retries and dead letters: maintain a transactional inbox/outbox with \`UNIQUE(tenant_id,store_id,channel,event_id)\`; business effect and idempotency nonce must commit atomically to the same trusted authoritative database. Producer crash after enqueue before updating outbox can enqueue twice; consumer cannot assume Queue exactly-once. Conversation order must be serialized by session/store key; provider echo events must be filtered. Cancellation and revocation must invalidate queued actions before execution.

## 6. Cost / scenarios — US$ estimates, NOT actual account invoice

Official price reference checked 2026-11-16:
- Cloudflare Workers Paid minimum **$5/month**, with **10M Worker requests/month** included for standard requests; extra CPU and paid storage/analytics billed separately. Workers Free daily limits apply if plan is free.
- Cloudflare Queues Paid **1M operations/month included**, thereafter **$0.40 per million**; one message ≤64KB typically 3 operations (write/read/delete). Additional retry / dead-letter traffic costs more. Fees for Durable Objects/state, custom domain, Logs, security rules and other resources NOT included here.
- n8n Cloud Starter \`€20/month\` billed annually, includes **2,500 executions**, **5 concurrent executions**; Pro \`€50/month\` billed annually includes **10,000 executions**, up to **50 concurrent**. **Current user's n8n subscription and project concurrency limits NOT verified.**
- Example API model Standard per **1M input/output tokens**, price page subject to change: \`gpt-6-luna\` $0.10/$0.50; \`gemini-2.5-flash-lite\` $0.10/$0.40; existing \`gpt-5-mini\` reference $0.25/$2.00. Verify model availability/actual tier/token usage before any spend. Output often includes reasoning tokens if applicable.
- Usage illustration: **3,000 input + 300 output tokens per AI answer**, exactly **one** call per event, no retries/cache/tools/voice, USD only:

| Monthly AI answer count | GPT-6 Luna | Gemini 2.5 Flash-Lite | GPT-5 mini | Queue operations baseline |
|---|---:|---:|---:|---:|
| 10,000 | $4.50 | $4.20 | $13.50 | 30,000 included (Paid) |
| 50,000 | $22.50 | $21.00 | $67.50 | 150,000 included (Paid) |
| 100,000 | $45.00 | $42.00 | $135.00 | 300,000 included (Paid) |

**Not included:** Worker base $5, n8n € tier, Durable Objects/DB/Storage, provider delivery, AI agent multiple calls, tokens cache, added QA calls, FX, tax, premium model, support, paid plans outside subscription. Real cost per *conversation* differs from number of individual messages. If only 10% of 100k monthly events call n8n, then approximately 10k external workflow invocations; check which internal executions are billable and plan limits instead of assuming that n8n runs per queued message.

**Risk:** Using Cloudflare Queue for every trivial FAQ can increase latency. Benchmark A/B with audited durable fast path vs queue path. Never skip durable event receipt/verified signature to achieve speed.

Official sources:
- https://developers.cloudflare.com/workers/platform/pricing/
- https://developers.cloudflare.com/queues/platform/pricing/
- https://developers.cloudflare.com/queues/reference/delivery-guarantees/
- https://developers.cloudflare.com/queues/configuration/batching-retries/
- https://n8n.io/pricing/
- https://developers.openai.com/api/docs/models/gpt-6-luna
- https://ai.google.dev/gemini-api/docs/pricing

## 7. Regression, release gates and rollback

**Only approve TESTED after GitHub CI succeeds on the exact SHA.** 42 source-only no-send tests do not prove Workers live latency, Meta/Zalo signatures or real Durable Objects.

Separate required explicit approvals (none supplied):
1. Attach real Cloudflare Worker/Queue/DO resources, trigger paid storage or API plans.
2. Introduce real Meta/Zalo/Website provider verified auth and consent, migrate webhook or configure DNS.
3. Connect real OpenAI/Gemini API keys or set model spend budget.
4. Deploy private catalog endpoint / tenant/store ownership proof, finish P0 RPC and Owner A/B RLS.
5. Change n8n Published workflows or order tools, allow real Commerce writes or provider messages.

Rollback for **this Draft only**: close PR; there are no hosted resources/credentials/production data to revert. For future canary (NOT HERE), preserve existing n8n webhook URL and Published version, switch one QA account only after consent, dual route guard prevents duplicate send/Order, hold traffic, reconcile trace IDs, independent rollback authorization.

## 8. Next checkpoint

**V16.2 proposed:** measured A/B benchmark against current Messenger baseline, 96 single-turn + 36 multi-turn quality in No-Send, implement real provider-signature adapters on isolated fixture transport, build trusted DO/PG idempotent outbox and explicit Provider API Mock (no live send). Production Commerce remains **NO-GO** until independently verified hosted Store/JWT/RLS, backup+restore, RPC P0 resolution and authorized change window.

**VERIFIED:** GitHub \`gh-pages\`, n8n Published metadata, existing Messenger webhook/ACK and 24 webhook latency sample, official prices.
**IMPLEMENTED:** source-only synthetic QA gateway, routes, scoped quotas mock, preview router, cost calculator, Worker entrypoint, tests.
**TESTED:** pending exact-head CI.
**BLOCKED:** all provider signatures/real external calls, real Worker Queues/DO and transactional Commerce, paid API, hosted certification.
