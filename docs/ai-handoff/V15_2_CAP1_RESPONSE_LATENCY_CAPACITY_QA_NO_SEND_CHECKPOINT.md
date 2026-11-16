# TIEN404 AI V15.2 CAP.1 — READ-ONLY AUDIT × SYNTHETIC CAPACITY × QA132 (NO SEND)

**State**: DRAFT / VERIFIED read-only metadata / OFFLINE TESTED contract / PRODUCTION NO-GO  
**Parent**: RPC.3 HEAD `7300d9e6feaaf9d8601721bd544d73c1d36f80a0`; PR #186 OPEN DRAFT.  
**Date**: 2026-11-16 JST. **No merge, n8n change, credential read, RPC GRANT/REVOKE, hosted write, Meta/Zalo send, paid-model benchmark, or customer-row export.**

## A. Verified sources

- GitHub PR #186 retains the independent RPC revocation and Owner JWT/RLS blockers. GitHub Actions runs `43823337522`, `43823337560` have all offline/PG17 tests successful, but the separate hosted certification NO-GO jobs deliberately fail; do **not** equate a failure status to product regression or turn it green.
- n8n Published and draft IDs match: Messenger `Z7FdV7uDvApfbURQ` `d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92`; Zalo V1 `yIJk8LvJoLF40Z62` `8ca4a6f6-ab3f-42f1-8637-d4f5db790a3e`; Zalo V2 Shadow `OgDZNSAvKEvhnAvn` `f00ba506-c52a-4340-9a0c-809fd9c6ea9a`; AI SALES `v6PBwcqSapVzACMW` `c0f04eb1-9e2b-4b42-bf70-0ce12d5b0c30`.
- Messenger metadata returned 27 executions: webhook 24, manual 3; success 25, error 2. Across these 27, total execution p50=8948ms, p95=15407ms, p99=16589ms. This is **not customer-reply E2E** and mixes modes.
- Zalo V1: 11 manual success; Zalo V2: 1 manual success, no observed production webhook/delivery in this result set; Main AI SALES: 3 manual success. Commerce QA workstreams 17+16+16 manual success; these are **not live customer transactions**.
- Messenger webhook trace `#3867`: Meta signature check 1805ms, OpenAI Chat Model calls 2772ms + 7712ms, Products read 1916ms, HTTP Send 538ms. `#3868`: signature 1701ms, model 2725ms + 4061ms, Products 636ms, HTTP Send 457ms. Node spans overlap; do not sum to infer end-to-end.

## B. Observability contract

Use a metadata-only request trace: `event_id` (one-way pseudonym), `run_id`, `tenant_id`, `store_id`, `channel`, `intent`, `error_class`, timestamps and `webhook_ack_ms`, `queue_wait_ms`, `catalog_read_ms`, `ai_inference_ms`, `tool_execution_ms`, `provider_send_ms`, `customer_reply_e2e_ms`, `model_input_tokens`, `model_output_tokens`, `actual_cost`, `execution_success`, `provider_delivery_verified`.

- ACK measured at public webhook HTTP response.
- Queue time needs enqueued/worker-start measurement and cloud queue visibility; missing = **BLOCKED**, not 0.
- AI latency includes separate calls, capture token use and model ID without prompts or contents. Provider API success is **not** proof of recipient delivery or UI display.
- Client receipt E2E only after explicit, independently verified delivery/read/receipt event with permitted correlation; otherwise `null`.
- No message text, phone, address, JWT, user token, system prompt, raw customer row, or secret in public logs. Synthetic IDs are the only identifiers allowed in source-only CI.

## C. Local mock capacity test (separate downloadable offline harness)

A separate dependency-free Node 22 harness operates on `127.0.0.1` only, using synthetic Shop A/B/C mapping, mock AI/catalog/tool/provider. Artificial injected stage delays are catalog 4ms, AI 22ms, tool 3ms, provider 5ms. **No real provider usage, no actual OpenAI token cost, no customer delivery.** The run tests three waves of each level and injects cross-store denial, write disabled, mocked 429/503, queue over-capacity rejection and post-failure recovery.

| Level | Requests | Mock completion | Capacity conclusion |
| --- | ---: | ---: | --- |
| 1 concurrent | 3 | 3/3 | HARNESS ONLY |
| 5 concurrent | 15 | 15/15 | HARNESS ONLY |
| 10 concurrent | 30 | 30/30 | HARNESS ONLY |
| 25 concurrent | 75 | 75/75 | HARNESS ONLY |
| 50 concurrent | 150 | 150/150 | HARNESS ONLY |

1/10/30/60 actual RPM sustained 60-second windows remain **NOT_RUN** in the evidenced baseline. This GitHub PR contains the **contract-level CI only**, not the complete local load harness, which remains a separately generated review artifact. CI must not claim throughput certification.

## D. QA data integrity and quality status

- Single-turn: 96 unique IDs, `actual_output` empty on all 96 CAP.1 inputs.
- Multi-turn: 36 unique IDs, 71 total turns; source status `NOT_RUN`.
- Historical output file: 97 rows, 96 unique IDs, duplicate `QA01`. These unlinked retrospective outputs do not count as validated CAP.1 model runs.
- CAP.1 verdict: **PASS=0 FAIL=0 BLOCKED=0 NOT_RUN=132**. No model-quality claim until trace-linked, approved, isolated execution plus human/automated rubric.

## E. Capacity model (hypothetical; never a production guarantee)

For active users `U`, assumed messages per active user per minute `m` (normal 0.10, peak 0.30, burst 0.60), assumed AI-query fraction `a=0.8`, and assumed request service time `W=8..15 seconds`: `messages/min=U*m`, `AI queries/min=U*m*a`, `inflight_AI=(AI queries/min)*W/60` (Little's law). Store count `S=1,5,20,100` changes tenants and quota partitioning, but **not** the number of requests unless additional traffic assumptions are supplied.

Example for 1,000 active users in burst: 600 messages/min, 480 AI queries/min, 64..120 AI calls in flight **hypothetically**. Actual account limits for n8n, OpenAI, GSheets, Meta, and Zalo must be privately verified; no inferred production throughput.

## F. Blockers / priorities

- **P0**: publicly callable RPC remains as documented by RPC.3; hosted Owner A/B JWT/RLS independent evidence missing. No revocation without the separate approval gate.
- **P1**: real n8n Cloud concurrency/plan/queue metrics missing; model tokens and cost missing; provider delivery receipt missing; Messenger small samples and catalog/model latency unoptimized; Zalo only manual evidence in returned set.
- **P1**: provider/account rate limits unknown; need read-only account dashboards. Public policy numbers are not proof of a specific account's quota.
- Add tenant-scoped synthetic cache and request deduplication in staging after profiling, bound retries with idempotency, separate rate budget per channel/store, and a circuit breaker for slow providers.

## G. GO / NO-GO

- **GO**: source-only contract tests, local mock, offline synthetic 132-case schema/rubric readiness.
- **NO-GO**: production capacity at 1/5/20/100 stores or 10..1,000 active users; 132-case *quality pass*; real delivery/latency SLA; public RPC revocation; provider throughput certification.

**Approval still required** for paid model benchmark, provider sends, hosted load, Supabase security mutations, customer data, billing, and final release promotion.

**Rollback**: Close the CAP.1 Draft PR or delete its isolated CAP.1 branch; no runtime rollback is required because no production or hosted mutations were made. Keep RPC.3 HEAD anchored, never edit PR #186 via CAP.1.
