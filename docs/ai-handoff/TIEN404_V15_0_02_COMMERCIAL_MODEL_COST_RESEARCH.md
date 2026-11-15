# TIEN404 AI V15.0-02 — Commercial Model Research & Cost Comparison
**Research date:** 2026-11-16 JST  
**Release:** EXPERIMENTAL / RESEARCH + SOURCE-ONLY SIMULATION, no paid inference.  
**Pricing mode:** Provider **Standard** paid API (per 1,000,000 text tokens USD), except explicitly marked DeepSeek peak/off-peak. No free-tier pricing, promotional subscription or batch discount is mixed into the Standard comparison.  
**Critical:** Public model documentation **does not verify TIEN404's account entitlement**, n8n connector support for each new model, quality in Vietnamese, or actual invoice charges.

## 1. Model price comparison — provider docs
| Exact public API ID | Input | Cached input | Output incl. reasoning when applicable | Context | Tool / structured outputs | Account access | Source |
|---|---:|---:|---:|---:|---|---|---|
| `gpt-6-luna` | $0.10 | $0.01 | $0.50 | 1.05M | Functions: Responses; Chat Completions only with reasoning none; structured output docs | NOT VERIFIED | [OpenAI model](https://developers.openai.com/api/docs/models/gpt-6-luna) |
| `gemini-2.5-flash-lite` | $0.10 | $0.01 | $0.40 | ~1M | Function calling / structured output documented | NOT VERIFIED | [Google pricing](https://ai.google.dev/gemini-api/docs/pricing) |
| `gemini-3.1-flash-lite` | $0.25 | $0.025 | $1.50 | 1,048,576 | Functions, structured output, thinking supported | NOT VERIFIED | [Google model](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-lite) |
| `claude-haiku-5-5` | $0.10 | $0.01 hit | $0.50 | 1M | Tools/structured output; pricing **only input ≤100k per request** | NOT VERIFIED | [Anthropic pricing](https://platform.claude.com/docs/en/about-claude/pricing) |
| `deepseek-flash` (V4.1) **PEAK** | $0.30 | $0.006 | $1.20 | 1M | Tools, JSON output documented | NOT VERIFIED | [DeepSeek pricing](https://api-docs.deepseek.com/quick_start/pricing/) |
| `deepseek-flash` **OFF-PEAK** | $0.15 | $0.003 | $0.60 | 1M | Same API; different hour-dependent tariff | NOT VERIFIED | Same official pricing |
| **CURRENT Main/Messenger** `gpt-5-mini` | $0.25 | $0.025 | $2.00 | 400K | Supported; marked **Deprecated** in docs | OBSERVED IN PUBLISHED n8n | [OpenAI model](https://developers.openai.com/api/docs/models/gpt-5-mini) |
| **CURRENT isolated QA** `gpt-5.4-nano` | $0.20 | $0.02 | $1.25 | 400K | Supported; marked **Deprecated** | OBSERVED IN INACTIVE QA ONLY | [OpenAI model](https://developers.openai.com/api/docs/models/gpt-5.4-nano) |
| Alternative `gpt-5.6-luna` | $0.20 | $0.02 | $1.20 | 1.05M | Functions documented; account access not guaranteed | NOT VERIFIED | [OpenAI model](https://developers.openai.com/api/docs/models/gpt-5.6-luna) |
| Advanced fallback `gpt-6.1-terra` | $1.00 | $0.05 | $5.00 | 1.05M | Tool calling requires Responses API | NOT VERIFIED | [OpenAI model](https://developers.openai.com/api/docs/models/gpt-6.1-terra) |

**Other pricing conditions / fairness:**
- Claude Haiku 5.5: if a *single prompt* exceeds 100K input, pricing becomes $0.50 input / $2.50 output / $0.05 cache-hit per 1M. Vendor notes newer tokenizer can use more tokens for the same text; compare actual billed usage, not nominal word count.
- Google output rates include thinking tokens; explicit cache storage may cost **$1 / 1M tokens / hour**. Check paid-tier privacy rules before sending business data.
- DeepSeek peak hours and cache-hit rates differ, and its `deepseek-flash` alias can roll to a newer backend. Pin model response/version during trials.
- OpenAI GPT-6 / GPT-5.6 newer model caching may require 30-minute cache writes at 1.25× uncached input and other mode rules; do not count all cached input as free.
- Standard, Batch/Flex/Priority/Fast, cached tiers and region-residency upgrades are **not interchangeable**. The table above avoids comparing a model's Batch price against another model's Standard price.
- Additional paid tools such as search, hosted code, file search, web grounding, data residency, requests/retries and n8n Gateway markup must be measured separately.
- Model support in API docs ≠ permission in a particular account. No provider credentials, signed-in model inventory or paid API request was used.

## 2. Shortlist decision — 5 candidates for controlled benchmark
1. **`gemini-2.5-flash-lite`** — low-cost price/structured extraction candidate, tool and Vietnamese quality untested for TIEN404.
2. **`gpt-6-luna`** — low-cost OpenAI model candidate, requires Responses-capable adapter for tool-heavy use; current n8n model node may require upgrades or changes not approved.
3. **`claude-haiku-5-5`** — low-latency focused tasks, same narrow-text tariff as GPT-6 Luna; account and actual tokenizer impacts unverified.
4. **`gemini-3.1-flash-lite`** — stronger/newer throughput candidate; higher list price than 2.5 Flash-Lite; quality delta unmeasured.
5. **`deepseek-flash`** — conditional variable-tariff candidate; peak vs off-peak separately scored; data-processing/privacy and reliability not yet accepted.

Benchmark baselines: the actual `gpt-5-mini` Published model and isolated `gpt-5.4-nano` QA. `gpt-6.1-terra` is an **advanced escalation reference**, not an economical high-volume default. None is designated TIEN404's new production default.

## 3. Deterministic synthetic usage scenario
**ASSUMPTIONS, NOT REAL METRICS:** 1 conversation = 5 turns, 1 turn = 1,200 input tokens + 180 output tokens. Thus each simulated conversation consumes **6,000 input and 900 output tokens**, 0 cached, 0 tool fees, 0 retries, 0 streaming overhead. There are **no hidden reasoning extras**: output token total is assumed inclusive of any reasoning tokens. No claims of 100% success.

| Model (Standard unless specified) | Model-only USD / conversation | 1,000 conversations | 10,000 conversations | 100,000 conversations |
|---|---:|---:|---:|---:|
| Gemini 2.5 Flash-Lite | $0.00096 | $0.96 | $9.60 | $96.00 |
| GPT-6 Luna | $0.00105 | $1.05 | $10.50 | $105.00 |
| Claude Haiku 5.5 ≤100k / prompt | $0.00105 | $1.05 | $10.50 | $105.00 |
| Gemini 3.1 Flash-Lite | $0.00285 | $2.85 | $28.50 | $285.00 |
| DeepSeek Flash PEAK | $0.00288 | $2.88 | $28.80 | $288.00 |
| DeepSeek Flash OFF-PEAK | $0.00144 | $1.44 | $14.40 | $144.00 |
| Current Published GPT-5 mini | $0.00330 | $3.30 | $33.00 | $330.00 |
| Complex GPT-6.1 Terra | $0.01050 | $10.50 | $105.00 | $1,050.00 |

**Shop scaling:** under assumption **1,000 conversations per Shop monthly**, 10/50/100 Shops = 10k/50k/100k conversations. Model-only at GPT-6 Luna: **$10.50 / $52.50 / $105.00**. Gemini 2.5 Flash-Lite: **$9.60 / $48.00 / $96.00**. Real store activity may differ by orders of magnitude.

### Costs that are still unknown
`1. input 2. output 3. reasoning 4. cache 5. tools 6. retries 7. DB 8. n8n executions 9. Gateway 10. provider/channel 11. notification 12. gross margin` — the snapshot prices only base model input/output and optional cache tokens. **Full SaaS cost, cost per successful task, and gross margin are not calculable from current evidence**.

Important sizing example: with 5 turns/conversation, 10 stores × 1,000 conversations/shop produces ~**50,000 chat turns** monthly. If each turn triggers at least one billable n8n execution, that is ~50,000 executions (possibly more from nested workflows). Do **not** assume a 1,000-execution trial tier can sustainably cover this traffic. Must model subscription tier, retries, send notifications, network/webhook and usage billing before launch.

## 4. Acceptance measurement plan
- Freeze identical 96 single-turn and 36 multi-turn gold test cases, duplicate resolved, QA fixture Products/Prices/Stock SHA-pinned. Keep DEMO data isolated. Each model uses equivalent tool schemas, prompt intent, context bounds and retries. Use `model_id` exact API string in every response trace.
- **Security gate before score:** wrong tenant/store, unauthorized writes, false prices, fake inventory, prompt injection, missing order confirmation, credential leakage, disallowed side effects = BLOCKED candidate.
- Quality: Vietnamese accuracy; intent, grounded factual price, tool argument success, valid schema, multi-turn context, no hallucinated business history.
- Performance: host p50/p95 end-to-end, model first token and final token when measurable, cold/warm, failure/timeout, provider reliability and rate limits. 4 past Messenger runs are not an acceptable p95 sample.
- Economics: *actual* input/output/reasoning/cache tokens, all call attempts, **cost per successful task**, plus n8n execution, DB, Cloudflare, gateway, notification, retries and margin. Do not deduce accuracy from per-token price alone.
- Stability: run repeated evaluations with matched tool mocks and deterministic snapshots; record concurrency and rate limits.
- Privacy: no real customer data to unapproved provider; do not expose Chat ID, Bot Token, signed proofs, private tenant UUID or merchant consent materials.

## 5. Conditional decision options (NOT a winner announcement)
- **Least expensive if quality/security passes:** Gemini 2.5 Flash-Lite ($0.10/$0.40 Standard) in this shortlist; alternatives such as GPT-5 nano could be cheaper but are not benchmarked or validated as suitable.
- **Potential balanced default:** GPT-6 Luna vs Claude Haiku 5.5 vs Gemini 3.1 Flash-Lite, selected ONLY after same-dataset trial. Public model pricing does not establish answer quality, tool reliability or latency.
- **Complex tasks:** conditional GPT-6.1 Terra, but only for proven escalations with bounded budget and explicit tool policy; avoid model router LLM on every greeting.
- **Potential low-cost hybrid:** deterministic responses for greetings/simple lookup; small model for ambiguity; stronger model for complex analysis; ALL business writes mediated by backend. Pricing cannot prove hybrid saves money until actual workloads are measured.

## 6. Implementation and privacy-preserving rollback
- Snapshot: `qa/v15-model-lab/model-pricing-snapshot.json` dated 2026-11-16. 
- Reproducible no-network quote/scenario: `qa/v15-model-lab/cost-simulator.cjs` plus tests. No invoice is generated, no API token supplied, no actual user/merchant business data.
- Today's files are Draft only; nothing modifies Published model, n8n plan, billing or credential. Revert V15 branch to roll back. 
- **Next:** run the offline deterministic core and QA tests, request separate authorization of a tightly bounded paid 96+36 candidate benchmark only after accurate API entitlement and hard budget cap are confirmed. Keep existing trial review on Nov 22, 2026.
