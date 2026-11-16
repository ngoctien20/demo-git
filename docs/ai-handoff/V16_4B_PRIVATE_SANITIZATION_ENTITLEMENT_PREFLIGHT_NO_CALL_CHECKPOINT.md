# TIEN404 V16.4B — Private Dataset Sanitization × Account Model Entitlement × Independent Evaluation Preflight
**Date:** 2026-11-16 JST | **Status:** SOURCE-ONLY + LOCAL PRIVATE REVIEW; NO PAID API / NO SEND
**Parent:** V16.4 Draft PR #202 pinned HEAD \`4137290c91a86816dc911589e3c73612c43afe46\`.
**Earlier:** PR #197, #194, #193, #190 and security RPC #186 all remain independently Draft; nothing merged.
**Change owner:** AI Research + QA + Security. This branch does not modify Website production, Messenger/Zalo Published, billing, credentials or Supabase permissions.

## 1. Audit-first: exact actual supplied files (private local, not committed)
| File | Verified rows | SHA-256 stored | Model outputs |
|---|---:|---|---|
| AI_SALES_QA_96_SINGLE_TURN.csv | 96 unique | PRIVATE LOCAL HANDOFF ONLY | 0/96 |
| AI_SALES_36_MULTI_TURN_FOR_LATER.csv | 36 unique | PRIVATE LOCAL HANDOFF ONLY | NOT_RUN |
| AI_SALES_QA_CASES.csv | 97 / 96 unique; QA01 duplicate | PRIVATE LOCAL HANDOFF ONLY | Historical replies, NOT new eval |
| AI_SALES_QA_96_SINGLE_TURN (1).csv | 96 | Same SHA as main 96 source | Duplicate source, DO NOT DOUBLE COUNT |

Dialogue pack = 71 turns with {one-turn:9, two-turn:21, three-turn:4, four-turn:2}; 27 genuine memory evaluations. Each model would have 132 scored case pairs but at least 167 requests to replay every user turn, total 501 minimum across three candidates.

## 2. Local private sanitizer and exact limitations
- New \`qa/v164b-privacy/private_sanitizer.py\`: strict schema and SHA-256 inventory, signed-off synthetic-only case keys, mandatory blank single-turn actual_output, dialogue NOT_RUN, historical QA01 duplicate.
- Regex redaction supports VN phone numbers, 11–18 digit numeric identifiers, email, URLs, common long API-key patterns, and CSV-formula prefix escape. Redacts BOTH prompt turns and expected behavior; historical replies never enter the candidate corpus.
- Must not print raw user text to stdout. Optional \`--private-output-dir\` writes filenames selected by a fixed allowlist, no-overwrite, \`0600\` files and local output folder \`0700\`.
- Private local current-session aggregate: 12 VN-phone matches in candidate corpus (4 single, 8 dialogue), plus one additional long-number match; historical source has 8 VN-phone matches, not exported to candidate corpus. 20 phone-like regex matches across three original source files. In local redacted candidate corpus 0 matches for this tool's exact regex set.
- **IMPORTANT:** This is NOT proof of anonymization. Real names, addresses, order details, free text identities, unique attributes and unexpected secrets may remain. Manual independent privacy classification and consent verification remain BLOCKED. \`provider_transfer_allowed=false\` on every generated case.
- Actual local private results exist outside this public GitHub repository, in the user's private handoff directory. Do NOT check in source datasets or redacted corpus to GitHub; DO NOT upload private files into GitHub Actions artifacts or third-party models.
- The public GitHub CI runs synthetic-generated fixture tests ONLY; no private source CSV used in CI.

## 3. Public model documentation versus PRIVATE account entitlement (2026-11-16)
Public model catalog independently checked in official docs:
- OpenAI \`gpt-6-luna\`: standard text $0.10 input / $0.50 output per million tokens. Documented, but private TIEN404 project model-list access, RPM/TPM, hard spend cap and credentials are UNVERIFIED.
- Google \`gemini-2.5-flash-lite\`: published paid text $0.10 input / $0.40 output per million tokens; Google Gemini 2.5 access restricted for newly created projects even though documented/served to some existing projects. Need AI Studio project-specific model visibility, rate dashboard and billing/privacy term review.
- Historical \`gpt-5-mini\`: published $0.25 input / $2.00 output, deprecated, scheduled API shutdown 2026-12-11. Not a long-term TIEN404 production candidate.
Official sources: https://developers.openai.com/api/docs/models/gpt-6-luna ; https://developers.openai.com/api/docs/guides/rate-limits ; https://developers.openai.com/api/docs/deprecations ; https://ai.google.dev/gemini-api/docs/pricing ; https://discuss.ai.google.dev/t/request-to-restore-gemini-2-5-flash-api-access-for-an-existing-user/196637

Read-only observation on user's existing *n8n Cloud Gateway credits* page during this session: balance was **$0.55 remaining of free credit**, updated 2026-11-16 19:56 JST. This is n8n Gateway credit, NOT OpenAI/Gemini direct API balance, project model entitlement or verified hard limit. No top-up, billing modification, model call or credit consumption was performed.
Google Gemini free-tier submitted content may be used for product improvement under current docs; paid tier describes different data processing terms. Do not transmit identifiable customer data to either tier without private policy and consent assessment.

\`qa/v164b-privacy/entitlement_gate.mjs\` only accepts scrubbed account proof metadata (model, provider, view type, observer QA-role, SHA-256); never accepts secrets or screenshots, and NEVER certifies a hash as authentic account access. User-supplied assertions cannot authorize paid calls.

**Operator-only read-only verification handoff, WITHOUT sharing credentials:**
1. OpenAI: select correct organization/project -> Settings > Organization > Limits for model RPM/TPM -> check model availability in intended project with matching credential scope -> inspect project hard spend cap and approved data retention/privacy settings.
2. Google AI Studio: choose intended project -> model list/rate limits RPM/TPM/RPD -> confirm whether 2.5 Flash-Lite is available for this particular (possibly new) project -> billing plan, training/data terms. Do NOT upgrade just to run this check.
3. Produce private redacted screenshots or signed operator evidence, only nonsecret facts, independent reviewer attestation. Even filled proof fields remain REVIEW_REQUIRED until human acceptance.

## 4. Independent evaluation, source-only
- \`qa/v164b-privacy/independent_eval_gate.mjs\`: exact 132 cases × 3 unverified candidate labels = 396 NOT_RUN pairs; min 501 turn requests; 27 genuine multi-turn per model.
- Requires distinct synthetic runner, two reviewers, adjudicator; collision denied but actual human identity NOT verified.
- Freeze fingerprints for dataset, prompt, knowledge, tools, policy, gold, budget authorization, project entitlement, hosted Store security; metadata hashes alone do not prove authenticity.
- Critical P0 safety requirements: zero wrong price, wrong stock, unauthorized order, missing confirmation, cross-store access, leakage, prompt injection tool abuse or duplicate order effects, with independent adjudication for disputed outputs.
- No source-only routine can ever return live GO or a certified quality PASS. \`model_result=NOT_RUN\` until approved real model outputs exist from a separate authorized execution. No anonymous screenshots or self-assessment accepted as independent reviewer.

## 5. QA evidence and production gates
New CI \`.github/workflows/v164b-private-preflight-no-call.yml\` tests: 20 synthetic Python privacy scenarios + 52 V16.4B model entitlement/reviewer assertions + 251 inherited Node offline tests = **323 checks** when green. Hosted/paid API job is intentionally SKIPPED.
- Need exact HEAD Actions checks after creating PR; do not report PASS for unrun changes.
- Security live P0 remains NO-GO: public RPC SECURITY DEFINER risk, hosted Owner A/B JWT-RLS, backup/restore, verified provider ownership and real Commerce Order writer. This branch does not touch these concerns.
- Paid benchmark approval needs separate explicit USD budget, provider project entitlement evidence, limits/cap, private content classification, two human reviewers, frozen gold, safe non-PII synthetic fixtures, and 5–10 canary checks before any 132-case run.

## 6. Rollback
Close the child Draft PR. No hosted side effect has occurred. Private local derived artifacts can be deleted by operator after review; they are separate from GitHub and the original uploaded files. Do not delete source datasets or any customer record as part of rollback.
