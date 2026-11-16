# TIEN404 V15.0-10B — PRIVATE MODEL QA / COST / MEASUREMENT CHECKPOINT
Date: 2026-11-16 JST. Classification: PREPARED_OFFLINE / REAL_132_CASE_BENCHMARK_NOT_RUN.

## 1. Parent, scope
- Child of V15.0-10A PR #140, HEAD 31330d3e0e25a39939fcbd14e1901e00919af3a3.
- Reuse V15 Model Router, V15 Agent Core, V14.7 Shop Studio, Shop Knowledge and 10A disposable order QA.
- 96 single-turn + 36 multi-turn exact private uploaded data: SHA256 single f266447e4be2a9a22733cfa81fb80ace8862d286752b15d2d6d1ffc77c9ba257; multi 8cfccde67964207e199dc20e911a9e6d4ebcbb8b1e2410526f3b40f5b8a2a1c4. 96 blank actual_output, 36 NOT_RUN, 71 customer turns. Input customer turns = 96+71=167, not 132 model calls if each turn is evaluated separately. Agent/tool retries can increase actual model requests.
- Local filenames and SHA pinned; analyzer never publishes raw CSV or prompt/reply data in GitHub. No private upload in CI.

## 2. Verified historical low-cost AI ONLY
- n8n workflow uNTFqxh6OLPuH7Vw, version 85b91983-2d4d-4129-9467-a0fce162da9a, INACTIVE manual; GPT-5-nano QA static Shop A.
- Execution #3884 15/11/2026: SUCCESS, five case verdicts D01–D04 PASS; D05_CROSS_SHOP FAIL because toolHealthy=false. D05 text explicitly refuses Shop B and doesn't show observed Shop B data. Cannot infer data leak from text.
- Read-only execution runData: 25 model node runs, 4 QA Catalog Read Only node runs, 2 QA Order Request Dry Run node runs, 5 case outputs. Agent intermediateSteps visibly includes a QA Order Request Dry Run in one case; not enough to independently map every tool invocation to every case or certify tool-call correctness.
- No reliable aggregate per-case input/output token usage in inspected metadata; actual Gateway credits charged and OpenAI invoice not independently reconciled. Do not claim ACTUAL token cost, 132-case accuracy, p50/p95 or hallucination from these outputs.
- No new paid model call performed.

## 3. API LIST prices — NOT actual billed cost
Verified 16/11/2026:
- GPT-5 nano (DEPRECATED): $0.05 / million input, $0.005 cached input, $0.40 output.
  https://developers.openai.com/api/docs/models/gpt-5-nano
- GPT-6 Luna (current cost-sensitive candidate): $0.10 / million input, $0.01 cached input, $0.50 output.
  https://developers.openai.com/api/docs/pricing
- Estimate = (uncached_in*input_rate + cached_in*cached_rate + output*output_rate)/1e6.
- Gateway routing, tool charges, reasoning tokens, model version, caching policies, provider invoice and n8n costs may differ from API list-price estimates.
- No concrete approved USD budget or Gateway credit cap for a NEW 132-case batch; no new paid requests allowed.
- Verify model ID/availability/permissions and prices immediately before any independently approved paid run. Deprecated GPT-5 nano must not be assumed available.

## 4. Implemented code
- qa/v15010b-model-benchmark/private-benchmark-contract.cjs: PRIVATE dataset SHA/checkpoint validation, 132-case/167-turn plan, safe token/latency/quality/tools receipt analyzer, list-price estimates, p50/p95, human adjudication coverage, explicit unknown actual billed cost. No network/model.
- qa/v15010b-model-benchmark/private-benchmark-contract.test.cjs: synthetic receipt tests for forged cost/accuracy, duplicate turns, privacy, changed model, bad usage, missing review and full-case completeness.
- .github/workflows/v15010b-private-model-benchmark-no-send.yml: Node22 offline and inherited QA; public CI has only synthetic receipts.
- This checkpoint.

## 5. Future real benchmark requires separate approval
1. Verify exact model and Gateway pricing, credit balance and finite approved budget; no credentials in public PR.
2. Explicitly approve capped QA run and a private mechanism stopping at budget threshold, maximum requests/retries/timeout. Do not expand or publish old manual 5-case workflow automatically.
3. Run 96 single cases; then 36 multi cases with 71 customer turns. Preserve conversation continuity only within each Shop/case/channel.
4. Capture per-turn execution/version, independently verified tool traces, actual end-to-end latency, input/output/cached tokens, retries/errors, and human rubric. Exclude PII, secrets and live orders.
5. Compare expected vs actual model reply with independent scoring; do not label string matching as full accuracy. Report exact coverage/accuracy only when all cases graded, plus estimated vs invoice-measured costs separately.
6. Abort on unexpected tool, cross-Shop, non-QA data, outbound send, budget overrun, hidden writes or billing anomaly.
7. Candidate promotion and Owner UAT separately approved.

## 6. Release / rollback
BUDGET NOT APPROVED; REAL 96+36 MODEL QA NOT RUN. No Published n8n edits, hosted Supabase schema, Messenger/Zalo sends, customer Orders, paid inference or production.
G0 Owner/Backup PR #135 and hosted Store RLS stay parallel BLOCKED prerequisites. Rollback: close child Draft PR.
