# TIEN404 AI — V16.4C Private Acceptance × Provider Evidence × 8-Case Budget Canary (NO CALL)

Date: 2026-11-16 JST. Scope: source-only, offline synthetic, no paid model APIs, no customer dataset/provider transfer, no production, no hosted SQL/RPC/RLS. Parent PR #208 is pinned to HEAD ea88b62410da1c4878f908839da152ef7d7ae1fb. Other draft PRs unchanged.

## 1. Input audit, provenance and privacy
Verified directly from locally supplied files: 96 unique single-turn rows with all actual_output blank; 36 dialogue scenarios with 71 turns (9 one-turn, 21 two-turn, 4 three-turn, 2 four-turn); 27 genuinely multi-turn scenarios. Historical 97 rows contain 96 unique IDs and duplicate QA01. Duplicate uploaded copy of the single-turn CSV has the same SHA-256 as the first. No real model outputs or completed model benchmark exist.

The previous private V16.4B sanitizer audit within the private handoff reports 12 phone-like regex matches + 1 long numeric identifier in candidate source, and 8 phone-like matches in the historical-only source. Same regex patterns yielded zero matches in redacted candidate output. This does NOT prove de-identification: free-text names, addresses, merchants and contextual identifiers remain unreviewed. Redacted private corpus is for local human privacy assessment only, not third-party provider submission. It is NOT part of the GitHub PR or public CI.

## 2. Source-only privacy and account authority contracts
- qa/v164c-canary/private-acceptance.mjs validates strictly allowlisted hash-only fields, candidate case keys and distinct QA role markers, with no customer text or credentials.
- Two reviewer claims may match, but final state is TWO_REVIEWER_CLAIMS_AWAITING_EXTERNAL_ATTESTATION, NOT independently accepted. Unresolved PII or any reviewer disagreement blocks transfer. Self-reported evidence does not verify identity, consent, authenticity or safe provider transfer. No review at all was performed by an authenticated external human reviewer in this turn.
- Provider account evidence intake separates DIRECT_PROVIDER and N8N_GATEWAY routes. Even model visibility, RPM/TPM/RPD, data-terms or budget hashes require an independently verified private project review; hash presence cannot prove entitlement or billing.
- User account entitlement for direct OpenAI and Google Gemini projects was NOT VERIFIED. No provider organization, project, model account list, quota, billing cap or provider API keys were accessed.
- Earlier observed n8n Gateway balance is NOT proof of direct OpenAI/Google API project access, available models or hard spend cap. No financial transaction was performed.

Official public reference:
https://ai.google.dev/gemini-api/docs/rate-limits (project/model-specific RPM, TPM, RPD)
https://ai.google.dev/gemini-api/docs/billing (billing/spend cap delay and potential overages).
Neither public docs nor a user's unchecked proof flag authorizes a paid model call.

## 3. Frozen 8-case canary plan (NOT_RUN)
Case keys selected only from actual manifest, without copied prompts:
- SINGLE:QA01, SINGLE:QA02, SINGLE:QA03, SINGLE:QA04: four one-turn QA entries; real expected behavior requires private review.
- MULTI:QA01: consultation, 2 turns.
- MULTI:QA07: order workflow, 4 turns.
- MULTI:QA20: price and stock, 2 turns.
- MULTI:QA28: tool interaction/dispute, 2 turns.

8 source cases x 3 source-catalog candidates = 24 case-model pairs. Actual sequence requires at least 14 requests per model, 42 minimum across three models before tools/retry/reasoning. All 24 pair results remain NOT_RUN, zero real model API calls and zero certified quality passes.

qa/v164c-canary/canary-budget.mjs implements only a synchronous in-memory synthetic budget ledger with reservation before settlement, cross-provider simulated caps, no overwrite of event IDs, strict full token-bound idempotency, release/refund and zero-cap blocking. Cannot enforce a real cross-worker cap or provider billing. No execution or upload method is available; live methods throw unconditionally.

Example QA assumptions only: 2,000 input and 500 output tokens per request, using earlier documentation prices without verification of project discounts, reasoning/cache/tools. Offline simulation estimates 32,900 microUSD ($0.0329) across 42 steps. NOT actual spend, NOT a worst-case cost bound, NOT a provider invoice, NOT user-approved budget.

## 4. Required separate approval gates (currently BLOCKED)
1. Two authenticated human privacy reviewers classify 8 cases, confirm synthetic-only source and golden behavior, and record evidence in a private trusted system. Review all sensitive context including free text beyond regex. Check consent and provider data processing terms.
2. Read-only correct-provider account inspection: direct OpenAI project vs Google AI Studio project vs n8n Gateway, model IDs and entitlement, RPM/TPM/RPD, supported tool-calling, billing, provider retention, region and data terms. Never paste API keys or project customer information in PR.
3. Explicit bounded per-provider and aggregate USD budget, expiry, token/rate limits, retry ceiling, durable atomic pre-reservation, invoice reconciliation and an external stop gate. Google documents billing delays that can allow cap overages.
4. Two separate blinded reviewer assessments for each actual synthetic model response. Any wrong price/stock/order, cross-store exposure, unauthorized tool call, unapproved data transfer or P0 security violation triggers NO-GO and manual adjudication.
5. Hosted Store JWT/RLS and legacy SECURITY DEFINER RPC concerns remain separate P0 blockers and are not modified by V16.4C.

All true self-reported flags cannot authorize live execution or model promotion. A future real 5–10 case pilot requires a separate, explicit user approval with named provider, USD budget, private QA-only data and access-verification evidence. Previously expressed general credit-spending intent is not treated as specific authorization for this new experiment.

## 5. QA/checkpoint and rollback
Files: qa/v164c-canary/private-acceptance.mjs, canary-budget.mjs, v164c-private-canary.test.mjs, CI workflow v164c-privacy-budget-no-call.yml, this checkpoint.
Source tests: 64 V16.4C Node + 52 V16.4B Node + 55 V16.4 Node + 42 private preflight Node + 75 V16.3 Node + 37 V16.2 Node + 42 V16.1 Node = 367 Node, plus 20 synthetic Python privacy assertions = 387 offline tests. An additional inherited browser workflow may run but is not included here unless checked at exact HEAD.
The first CI attempt failed before running jobs due to YAML run syntax and was repaired; a successful full CI on FINAL HEAD is required to claim TESTED. Paid/hosted job SKIPPED intentionally (not PASS).

Rollback: close the child Draft PR; no production resource, n8n Published workflow, credential, money, customer data, provider message or hosted database was changed. No deletion of original local CSV files.
