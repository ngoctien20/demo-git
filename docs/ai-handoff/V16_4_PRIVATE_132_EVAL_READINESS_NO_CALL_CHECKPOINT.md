# TIEN404 V16.4 — PRIVATE 132-CASE MODEL EVALUATION READINESS (NO PAID API)
**Date:** 2026-11-16 JST | **State:** SOURCE-ONLY PRIVATE PREPARATION — NOT MODEL QUALITY CERTIFIED
**Parent:** Draft PR #197, HEAD \`84805e2f8a63fe2921c91573d371781159c8403e\`. This V16.4 branch is additive and is NOT merged into #197, #194, #193, #190 or RPC security #186.

## 1. VERIFIED source / checkpoint
- V16.3B Draft PR #197 is OPEN, not merged. Its exact parent PR #194 HEAD \`d50571228e052ca0cb90cab3df180a4c9e7199b0\`.
- V16.3B real Chromium was tested on localhost with 16/16 interactive checks at 320/360/390/768/1280/1440px, 0 browser failures; 196 Node offline checks and independent synthetic artifact in Actions run \`43847061218\`. Not live browser/merchant delivery certification.
- User-uploaded CSVs were inspected privately, never copied to GitHub:
  - \`AI_SALES_QA_96_SINGLE_TURN.csv\`: 96 unique cases, 96 \`actual_output\` blank.
  - \`AI_SALES_36_MULTI_TURN_FOR_LATER.csv\`: 36 case IDs, 71 turns, distribution **9 one-turn, 21 two-turn, 4 three-turn, 2 four-turn**. Exactly 27 multi-turn dialogues; 9 one-turn must not be scored as memory tests.
  - \`AI_SALES_QA_CASES.csv\`: 97 historical responses, 96 unique case IDs with duplicate QA01; NOT new V16.4 independent model evaluations.
- Private dataset hashes (SHA-256) must be tracked out of public source. The offline Python tool computes hashes and aggregate phone-like pattern counts WITHOUT printing prompts or content. Regex detection alone does NOT prove actual PII, and zero matches does not prove privacy.
- No real model responses were obtained: quality PASS 0, model evaluations 132/132 NOT_RUN; 396 planned case-model pairs all NOT_RUN.

## 2. MODEL CATALOG — verified public documentation only
Date of public documentation research: 2026-11-16 JST.
| Candidate | Provider API model ID | Standard input/output USD per million text tokens | Lifecycle | Project access |
|---|---|---|---|---|
| Economy OpenAI | \`gpt-6-luna\` | $0.10 / $0.50 | Publicly documented | UNVERIFIED |
| Economy Google | \`gemini-2.5-flash-lite\` | $0.10 / $0.40 | Documented, **access restricted for new projects** | UNVERIFIED |
| Historic reference | \`gpt-5-mini\` | $0.25 / $2.00 | **Deprecated; scheduled shutdown December 11, 2026** | UNVERIFIED |

- Official sources: https://developers.openai.com/api/docs/models/gpt-6-luna ; https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash-lite ; https://ai.google.dev/gemini-api/docs/pricing ; https://developers.openai.com/api/docs/models/gpt-5-mini ; https://developers.openai.com/api/docs/deprecations
- Actual account RPM, TPM, RPD, maximum concurrency, eligible endpoints, available models, tool use, supported reasoning modes, privacy terms, currency/tax and billable output must be verified per project BEFORE executing even a single paid call.
- OpenAI GPT-6 Luna supports Responses API built-in tools/function calling; do not assume identical Chat Completions function-calling behavior with default reasoning. Gemini needs its own grounded function-call adapter. Comparing text answers but skipping tool traces is not a complete Sales Agent benchmark.
- This repository includes no API client and no executable call path. The catalog deliberately sets \`eligible_for_real_benchmark:false\`.

## 3. Critical denominator correction: 396 versus minimum 501 requests
- **396** = 132 case IDs x 3 candidate models = number of planned scored case-model pairs.
- **501 minimum model requests** = (96 one-turn cases + 71 dialogue turns) x 3 models, **assuming just ONE model request per user turn**. Real agent might call multiple models/tools per turn or retry.
- Per candidate: **132 scored case slots; 167 user turns/request minimum**.
- Only 27 of the 36 dialogue-pack cases meaningfully assess multi-turn continuity.
- Do not use \`396 requests\` to estimate true token/runtime expenditure.
- Illustrative cost if every model request uses exactly 1,200 input and 180 output tokens, 1 model request/turn, no cached context, no tool calls/reasoning extra:
  - Luna: 167 x ($0.10*1200 + $0.50*180)/1,000,000 = **$0.035070**.
  - Gemini Flash-Lite: 167 x ($0.10*1200 + $0.40*180)/1,000,000 = **$0.032064**.
  - Legacy GPT-5 mini: 167 x ($0.25*1200 + $2.00*180)/1,000,000 = **$0.110220**.
  - Combined: **$0.177354**. This is **ONLY a low-complexity illustration**, NOT a spending limit, invoice, worst-case cap, or plan to purchase.
- Thinking/reasoning tokens, tools, retries, context growth, provider fees and rate tier can change cost drastically. A live cap requires a durable atomic ledger, provider budget/credit check, request-level limits, and independent approval.

## 4. Implementation — no data leak, no paid calls
- \`qa/v164-private-ab/model-catalog-readiness.mjs\`: public documentation snapshot of 3 candidate IDs; \`datasetRequestShape\` distinguishes case-model pair vs per-turn requests, \`projectUsageScenario\` estimates token costs (assumptions only), \`readinessDecision\` always returns \`NO_GO_SOURCE_ONLY\`, even if caller forges all approval flags. Real API and publication routines throw unconditionally.
- \`qa/v164-private-ab/quality-review-protocol.mjs\`: rubric for 5 dimensions (Vietnamese clarity 20%, fact accuracy 25%, tool trace 25%, Commerce policy 20%, safety 10%). Ten critical P0 codes include price/stock errors, cross-Store access, unauthorized order, missing confirmation, PII leak, prompt injection, unsafe spend, duplicate order and false delivery claims.
- Two different synthetic reviewers must use matching output/gold/tool SHA evidence; discrepancies >=2 points on any dimension, weighted disagreement >=1 point or ANY P0 cause escalation to independent human adjudication. Neither perfect synthetic scores nor hashes ever grant certified PASS.
- \`qa/v164-private-ab/validate_private_sources.py\`: local-only raw CSV schema/hash/turn validation, aggregate potential phone-like tokens without exposing text; sample \`--self-test\` runs only synthetic CSV in CI. The real CSVs remain outside public repo and should never be uploaded to GitHub Actions, CI logs, issue attachments, or public pull requests.
- \`qa/v164-private-ab/v164-eval-readiness.test.mjs\`: 55 positive/negative source-only tests for registry, model deprecation, denominators, cost validation, P0 disagreement, forged approvals, no model execution and no false certification. Inherited 42 private preflight + 75 V16.3 + 37 V16.2 + 42 V16.1 tests = **251 Node offline tests** when green.
- CI \`.github/workflows/v164-private-eval-no-call.yml\` executes Node tests, Python synthetic self-test, static no-network/credentials guard; intentionally skips paid and hosted certification job. Do not count skipped as PASS.

## 5. PRIVATE DATASET / AI research governance
Private evaluation proposal: encrypt and isolate a versioned data snapshot outside public repositories, hash it; label whether phone-like strings are synthetic placeholders or real PII, replace sensitive content before any third-party API. Review Data Processing Agreements, provider free-tier training-use terms, consent, data residency, and retention. A regex scanner is only screening, not consent proof.
- Per Shop/store, use fixture-bound catalog, price and stock with revision hash. Do not trust text or model-provided store/tenant IDs. Log anonymized latency/token counts, not raw chat.
- For multi-turn, reset private state between cases but preserve within each dialogue; freeze knowledge/prompt version, tools and time budget. Mock all Commerce writes. Record actual tool call attempts/accept/deny separately from language score.
- Two independent reviewers, blinded candidate label, separate from the runner; require independent human verifier and frozen golden behavior. Same rubric for three model candidates. Track P0 misses separately from average score. Halt/hold model promotion on any P0 fail; never let an excellent average mask unauthorized order or wrong price.
- Three statuses: \`NOT_RUN\` (no real model reply), \`BLOCKED\` (missing consent/proof), \`REVIEWED_NOT_CERTIFIED\` (review claims without independent acceptance). Only external controlled procedure may ever certify PASS.

## 6. GO / NO-GO, approvals and rollback
GO: source-only, local offline scripts, metadata audit, CI synthetic tests and read-only official docs verification.
NO-GO: real OpenAI/Gemini requests; private prompt upload; project credits, billing, API keys, cache/Queue/DB resources, live Messenger/Zalo/Website sends, real customer data writes, n8n Published mutation, Supabase hosted RPC/GRANT/RLS, Core Bot model promotion or any production merge.

Exact missing evidence before **separately approved** paid benchmark:
1. Credential owner and project-specific model ID access, RPM/TPM, price/region/retention read-only evidence.
2. Independent source-data classification, private encrypted storage, consent/data-processing scope, safe synthetic test corpus and approved golden expectations.
3. Frozen prompt/knowledge/tool mocks; two independent blinded human reviewers, explicit P0 failure conditions.
4. Approved total USD hard budget **per provider** + invoice reconciliation + durable reservation and stop gate, bounded initial 5-10 cases before full 132.
5. Hosted Store/RLS/RPC security P0 and real Commerce permission still entirely separately gated.

Rollback: close this new Draft PR. No customer data, paid API, cloud resources, n8n Published or production state changed. No runtime rollback.
