# TIEN404 AI — V16.4E Gateway Route Evidence × Eight-Case Private Operator Review (NO SEND)
**Date:** 2026-11-16 JST
**Parent:** V16.4D PR #223 pinned commit 0f43bcb3a47eaf84db47872a6b4df1b9d4d198e0, remains OPEN DRAFT. V16.4C #219 and earlier Draft PRs remain unchanged.
**Status:** SOURCE ONLY / LOCAL PRIVATE REVIEW. Not a provider-account model entitlement certificate; NOT a paid model QA run.

## VERIFIED actual intake
- Locally re-read exact uploaded sources: 96 single-turn, all actual_output empty; 36 dialogue scenarios with {1:9,2:21,3:4,4:2} turns totaling 71; 27 real multi-turn; 97 historical response rows with QA01 duplicate. Both uploaded 96-case source copies match SHA-256.
- 8 fixed V16.4C canary case IDs: SINGLE QA01-QA04 and MULTI QA01/QA07/QA20/QA28. Four single-turn plus 10 multi-turn dialogue steps = 14 user turns per candidate. Three candidates produce 24 case-model pairs, minimum 42 model requests before retries/tool recursion. No real model output, no paid model calls and no certified model-quality pass.
- A PRIVATE V16.4B sanitized corpus exists in the earlier user handoff, not in GitHub. Local private eight-case subset can be produced from that file with only redacted QA candidate text. Redaction regex is not proof of removal of free-text names, addresses, unique attributes and other contextual PII. It remains human-review-only; do NOT send to provider, public repository, CI logs or release artifacts.

## NEW actual connected n8n gateway observation (read-only)
- Used TIEN404 n8n connected app's read-only Gateway service list on 2026-11-16, confirmed available=true.
- Credential type coverage observed: openAiApi and googlePalmApi.
- Supported chat node types observed: @n8n/n8n-nodes-langchain.lmChatOpenAi and @n8n/n8n-nodes-langchain.lmChatGoogleGemini.
- This independently establishes **platform integration surface only**. It does NOT list model IDs or prove the user has access to gpt-6-luna / gemini-2.5-flash-lite, real paid credits, project-specific RPM/TPM/RPD, consent/retention terms or a hard budget.
- The Browser connected-tab tool returned a "requires the originating browser context" error, so no fresh direct OpenAI Platform or Google AI Studio signed-in dashboard was inspected in this turn. Do not infer absence of provider accounts from browser/tool access limits.

## Implemented on child Draft PR
1. qa/v164e-operator/gateway-route-evidence.mjs: grounded, nonsecret Gateway coverage snapshot and exact DIRECT_PROVIDER vs N8N_GATEWAY route contract. Hash-only account evidence cannot self-certify entitlement.
2. qa/v164e-operator/evidence-review.mjs: eight-case source-only reviewer checklist, two distinct QA reviewer claims + runner, strict case scope and hash evidence, context/PII/gold checklist, negative tests. Even 8 filled review records do NOT certify reviewer identities, the gold standard or provider-transfer authority.
3. qa/v164e-operator/v164e-operator.test.mjs: 48 offline tests for consent, reviewer collision, forged metadata, model entitlements, no-send and scope.
4. .github/workflows/v164e-operator-no-call.yml: 48 new + 445 inherited tests (425 Node + 20 Python) = 493 UNIQUE offline tests when green, paid/human approval job disabled.

## External official API documentation and financial safety
- Google Gemini rate limits RPM/TPM/RPD are project/model and billing-account-tier dependent, https://ai.google.dev/gemini-api/docs/rate-limits
- Google AI Studio project spend caps can be delayed about 10 minutes and allow overages, https://ai.google.dev/gemini-api/docs/billing
- OpenAI organization/project model limits must be verified in the actual owner's platform, not inferred from docs: https://platform.openai.com/docs/guides/rate-limits
- n8n Gateway coverage and earlier credit screen are separate from direct provider entitlements.
- No operation-specific paid USD budget was approved for this V16.4E. Authorized paid API calls: 0; approved new API spend: $0.00; no on-platform model QA performed. Prior $0.0329 synthetic 8-case estimate is NOT a hard cap or a billable quote.

## Independent human review handoff
- Open the separate restricted eight-case private review pack, do not paste any source chat or customer identifiers into the public PR.
- Two reviewers, distinct from the benchmark runner, must independently mark data as synthetic/nonidentifying vs potential/confirmed PII, verify any contextual identifiers beyond regex and review frozen expected behavior. Source, redacted, gold and reviewer receipt hashes must match.
- A verified operator must examine actual OpenAI project or Gemini AI Studio project and/or n8n Gateway authorized model selection + quota + tool interface + billing + data-use, and supply NONSECRET private evidence in a trusted channel.
- Model and budget canary cannot proceed until trusted operator authorizes a selected model(s), USD max, max requests, expiry, durable reservation/kill switch and independent cost reconciliation. Self-asserted flags and a signature with a self-supplied root are NOT sufficient.
- Hosted RPC SECURITY DEFINER / Shop JWT-RLS P0 remains a separate production GO/NO-GO and is not changed here.

## Status and rollback
VERIFIED gateway surface, dataset structure, pinned parent; IMPLEMENTED read-only evidence contracts; TESTED only after final HEAD Actions success; BLOCKED real model entitlements, human privacy acceptance, real paid budget, hosted Store P0; NOT_RUN paid canary.
Close the V16.4E child Draft PR to rollback source. No production data, credentials, billing, provider messages, hosted DB, published n8n or real shop state were modified. Keep the original uploaded and private reviewer files restricted.
