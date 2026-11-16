# TIEN404 AI V16.4E — Frozen 8-Case Private Reviewer Packet × Real Evidence Handoff (NO SEND)
**Date:** 2026-11-16 JST | **Parent:** OPEN DRAFT PR #223, exact parent SHA \`0f43bcb3a47eaf84db47872a6b4df1b9d4d198e0\`
**Decision:** Source-only/QA-only GO, paid or customer-data provider transfer NO-GO. Previous V16.4D PR #223 must remain untouched.

## 1. Inputs independently reopened, not guessed
- Current user-provided files reopened locally: \`AI_SALES_QA_96_SINGLE_TURN.csv\` with exactly 96 unique IDs and blank actual_output; \`AI_SALES_36_MULTI_TURN_FOR_LATER.csv\` contains 36 rows / 71 turns / 27 real multi-turn. \`AI_SALES_QA_CASES.csv\` holds 97 historic outputs and duplicate QA01, not V16.4 model results.
- Source V16.4B redacted private pack \`V16_4B_LOCAL_REDACTED_QA_132_REVIEW_REQUIRED.json\` extracted read-only from user-provided private handoff ZIP. **Actual corpus file is not committed to GitHub or passed to public Actions**.
- Exact case IDs: SINGLE:QA01, QA02, QA03, QA04; MULTI:QA01 (2 turns), QA07 (4 turns), QA20 (2 turns), QA28 (2 turns). Total 8 cases, 14 sequential requests per model, 24 case×model slots and 42 minimum calls for 3 models IF LATER APPROVED.
- The private redacted texts were inspected to derive an evidence freeze. Public source holds ONLY generic policy-tag identifiers, never private prompt/expected output text. Four single cases check product catalog price/stock/name/list. Multi cases check two-turn comparison, four-turn order correction/confirmation, expected_total when changing SKU, and stale preview/concurrent order conflict.
- Original data source remains REVIEW_REQUIRED; there may be names, addresses, rare identifiers or other contextual identifying details even when regex patterns find none.

## 2. Actual completed private local review packet (NOT privacy approval)
Created restricted local files **outside the GitHub tree**:
- \`V164E_PRIVATE_8_CASE_REVIEW_REQUIRED.json\`: 8 redacted cases with each input turn, expected behavior as source text (NOT gold-certified), policy tags, per-case hash, two separate blank human-review entries, disallow provider transfer and NOT_RUN model status.
- \`V164E_PRIVATE_AUDIT_METADATA_ONLY.json\`: SHA256 provenance of redacted input, source case/turn counts, five-pattern residual-regex screen and missing operator/human authority. No prompts or responses in metadata.
- Local output folder mode 0700 and JSON files mode 0600. No overwrite, no provider upload and no API cost. On the eight selected redacted cases, phone/email/URL/long numeric/key-like regex counts = **zero within those regex definitions**. That is NOT sufficient for privacy certification.
- User may download the PRIVATE reviewer packet in chat for human review, but it must NEVER be uploaded to public GitHub/GitHub Actions or sent to AI provider while \`provider_transfer_allowed=false\`. The separate metadata-only ZIP is safe for normal progress tracking.

## 3. Public additive implementation
- \`qa/v164e-review/freeze_private_canary.py\`: operator-local CLI for exactly 8 frozen case IDs, source 132-case shape, explicit no-provider-send flag, reject non-allowlisted extra fields, unexpected actual model output, altered turn count, missing redacted source, duplicate keys, invalid SHA/per-case format; makes review packet 0600 in private directory with no-overwrite. Prints only counts to terminal.
- \`qa/v164e-review/test_freeze_private_canary.py\`: **27 synthetic tests**, including injected secret field, missing no-send flag, unexpected actual model reply, proof of no human QA PASS, privacy flags, directory/file mode, frozen tags and 42-request denominator.
- \`.github/workflows/v164e-private-review-no-send.yml\`: 27 new Python tests + 20 previous Python + 425 previous Node = **472 UNIQUE offline assertions** if CI green. All GitHub tests are synthetic; no user source CSV/JSON in repository or CI. Human privacy/paid-provider job intentionally SKIPPED.
- This handoff document and private metadata contain no private message or key.

## 4. Real account entitlement cannot be inferred
Browser tab audit this turn: no signed-in OpenAI Platform or Google AI Studio project rate-limit pages. Public documentation is NOT project entitlement.
- Official Gemini docs: https://ai.google.dev/gemini-api/docs/rate-limits : RPM, TPM and RPD per project/model; dashboard active limits by project.
- Official Gemini billing docs: https://ai.google.dev/gemini-api/docs/billing : project spend caps can lag (~10 minutes), so provider dashboard alone is not a synchronous atomic kill-switch.
- Earlier n8n Gateway free credit observation is a separate ledger, not a verified direct OpenAI/Google API entitlement.
- Actual account model IDs, API tool support, billing, exact quota, privacy terms, reviewer ownership: **NOT VERIFIED**.
- Current authorized paid canary budget under this request: **USD 0.00**, no billable calls.

## 5. Needed independent human operator inputs
- Two separate identified reviewers inspect exact eight PRIVATE redacted texts, manually check free-text identifying data and assess source-gold expected behavior. Two names typed into a form do NOT verify two human identities. Reviewer signatures/trust root and provenance must be verified privately.
- Actual operator opens the corresponding OpenAI or Gemini project *in an authenticated browser*, inspects model visibility and RPM/TPM/RPD, project Billing/Spend, data retention/use terms, service model/tool support. Supply private **redacted fact summary** only, no API key/credential or customer content.
- After independent signed evidence, ask user for **specific provider/model(s), explicit one-time USD budget in cents, max request count, expiry, no auto-renew** and security consent. Only separately authorized live-canary executor can be designed then. The current source-only PR has no paid executable path.
- Any Order/Stock/Store action must remain synthetic with mock tools. Public SECURITY DEFINER RPC, hosted JWT-RLS, owner authority and backup/restore P0 issues remain separate barriers to live Commerce, unchanged here.

## 6. QA and rollback
Record the exact CI success/fail on FINAL HEAD before claiming TESTED. Synthetic review evidence != human independently verified acceptance. Leave V16.4D PR #223 unchanged and create child Draft for V16.4E. Rollback is closing new child Draft. No API calls, payment, hosted SQL, n8n Published, Gateway send or data writes were made.
