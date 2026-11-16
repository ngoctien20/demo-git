# TIEN404 AI — V16.3B Independent Chromium Browser QA × V16.4 Private Model A/B Readiness
**Date:** 2026-11-16 JST. **Scope:** GitHub Draft-only; localhost browser; no send, no live model API, no hosted/data/billing changes.
**Parent:** V16.3 PR #194 at pinned HEAD \`d50571228e052ca0cb90cab3df180a4c9e7199b0\`.
**Earlier parents:** V16.2 PR #193 (Draft), V16.0/V16.1 PR #190 (Draft), RPC.3 security PR #186 (Draft, NO-GO).

## 1. User self-report vs independent machine evidence
The merchant checked five QA areas and reported PASS. That report is **MERCHANT_SELF_REPORT** and is not automatically a pass from an independent reviewer.

Independent evidence is **automated Chromium QA executed on checked-out source via GitHub Actions at local 127.0.0.1**, distinct from the merchant report:
- Runner: Ubuntu 24.04, Chrome executable, Python Playwright 1.57.0.
- Viewports: 320, 360, 390, 768, 1280, 1440 px. Real Chromium, responsive emulation only; no real device, Safari, Firefox or browser-hosted production.
- Cases: **16/16 PASS, 0 FAIL** (6 responsive screen checks, 5 tabs, FAQ A/B/C draft/review/version and Shop switch, budget alerts/limit and Store isolation, queue tenant scope, handoff state/denial, 132/396 Model A/B, ephemeral reload, accessibility label/locale smoke, JS console/error/no external requests).
- Evidence: GitHub Actions run #43846678101 (browser + private preflight), synthetic artifact ID \`14215407001\`, contains 3 screenshots and JSON browser result. Artifact retention 7 days.
- No screenshots or artifacts contain real user content, provider credentials or true customer data.
- True independent **human security reviewer certification is STILL NOT DONE**. Browser automation is not the real Owner A/B JWT/RLS proof.

## 2. P1 browser defect found, source-only patch
Original V16.3 preview retained output text from Shop A after switching to Shop B/C (visible prior-Shop synthetic state). It was not a backing database leakage, but the UI breached the expected Store isolation presentation rule.
V16.3B patch \`qa/v163-studios/preview-ui.mjs\`: every Shop switch clears outputs in FAQ/Cost/Queue/Handoff/Model Lab, re-selects scoped greeting options and shows a synthetic-scope notice.
Chromium covers stale-result checks across all five panels plus Shop A/B/C FAQ and no cross-Store ticket assignment.
No production migration/merge/deploy.

## 3. V16.4 private readiness implemented source-only
- \`qa/v164-private-ab/private-readiness.mjs\`: metadata-only inventory, SHA-256 private dataset/registry proof contract, synthetic blinding schedule, 132 cases × 3 unverified candidate labels = **396 NOT_RUN rows**, cost bounding with explicit assumed token rates and hard no-live-call stubs.
- \`qa/v164-private-ab/private-readiness.test.mjs\`: 42 no-call/privacy/security cases; all token/price numbers are hypothetical inputs. A user-supplied boolean for authorization or reviewer is **NOT independent evidence** and never enables execution.
- Private prompt, expected behavior, actual output, internal Shop data and sensitive identifiers are **NOT committed to public repository**. Source is only data schemas and metadata with QA fixtures.
- Local PRIVATE handoff bundle from user-provided CSVs can include hashes + case IDs and turn counts only; source CSV is never uploaded to model API or GitHub.
- Actual model API IDs, prices, RPM/TPM, consent/retention and spend approval still need independent verification and operation-specific consent. No paid API has run.

## 4. Evidence from existing input CSVs
Read user-supplied files locally with no network:
- \`AI_SALES_QA_96_SINGLE_TURN.csv\`: 96 unique QA01..QA96, 96 empty \`actual_output\`.
- \`AI_SALES_36_MULTI_TURN_FOR_LATER.csv\`: 36 dialogue-pack records, 71 turns total: 9 one-turn, 21 two-turn, 4 three-turn, 2 four-turn. Only 27 genuinely multi-turn scenarios.
- \`AI_SALES_QA_CASES.csv\`: 97 historical rows, 96 unique case IDs, QA01 duplicate; historical replies are NOT independently V16.4 scored.
- Real model quality remains 132/132 NOT_RUN. Planned model evaluations 396/396 NOT_RUN. No fabricated PASS.

## 5. CI and QA report
- GitHub Actions V16.3B workflow \`.github/workflows/v163b-browser-private-nosend.yml\`: two jobs (Chromium full-browser and independent privacy/Node test).
- 42 V16.4 contract tests, inherited V16.3 75, inherited V16.2 37, inherited V16.1 42 = **196 Node offline checks**.
- Browser checks: **16/16 PASS** on six sizes with source-only local HTTP and no network access.
- An initial CI failure came from incorrectly selecting \`files[0]\` by \`glob\` iteration in a static verification step. Fixed by specifying exact \`private-readiness.mjs\`; re-run succeeded at commit \`6e31e1d74c5572c0c1f58c0dacb2f4618f91a38e\`. Prior CI failures remain visible as traceable evidence; DO NOT conceal them.
- Any later HEAD change must have green CI checked again. NOT a production certification.

## 6. Data protection and live gates
- No Cloudflare resource created, no webhook route published or switched, no n8n Published mutation, no SQL/RPC/GRANT/RLS changes, no credential changes, no real customer row, no provider message, no model API calls, no external purchased service, no billing.
- P0 still BLOCKED: hosted owner/merchant identity, JWT/RLS same-tenant cross-store, RPC.3 public SECURITY DEFINER caller remediations and approvals, private backup restore, real provider account signatures, atomic Commerce writer.
- P1 still BLOCKED: durable per-store quota atomic transactions, external invoice reconciliation, real Queue fairness, provider delivery proof, 132-case scoring and actual model cost/latency.
- V16.4 source can never promote itself even if supplied with \`api_authorization:true\`. Actual API execution needs a **separate authorized architecture and specific budget**.
- Real data and customer messages must never be checked into public CI or artifacts.

## 7. Rollback and next steps
- Close V16.3B child Draft PR for full rollback of source-only patch/QA/private-preflight proposal; parent #194 and earlier Drafts remain untouched.
- Security Reviewer separately verifies real hosted ownership, backup and RPC before any live commerce.
- After explicit paid API approval: private-source prompt fixture storage, independently verified model IDs/price/rate, small budget bounded pilot, provider-specific privacy policy and token accounting, independent blinded human review.
- Future QA: real Safari/Firefox and physical mobile devices, live merchant consent and Store authority proofs, do not mix with synthetic CI.
