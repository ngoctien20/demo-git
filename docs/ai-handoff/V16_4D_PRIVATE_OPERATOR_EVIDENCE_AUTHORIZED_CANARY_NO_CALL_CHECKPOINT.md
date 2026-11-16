# TIEN404 AI — V16.4D Private Operator Evidence × Actual Account Entitlement × Authorized Canary Decision
**Date:** 2026-11-16 JST
**Parent:** V16.4C PR #219 pinned SHA 566f891ce24673d073fafd68a339d7026f6e33de, OPEN DRAFT.
**Target state:** source-only/no-send. Actual paid-model authorization remains NO-GO. No source code on this branch can call an API or approve itself.

## 1. Audit-first source and checkpoint
- GitHub PR #219 OPEN DRAFT, HEAD 566f891ce24673d073fafd68a339d7026f6e33de; V16.4C Actions run 43870454597 SUCCESS.
- Input files reopened locally: 96 SINGLE unique with 0 new actual outputs; 36 MULTI pack with 71 turns and 27 genuine multi-turn; 97 historical responses, QA01 duplicate. Three local data source fingerprints verified, kept OUT OF GitHub repo/CI and docs.
- Fixed case IDs: SINGLE:QA01,QA02,QA03,QA04 and MULTI:QA01,QA07,QA20,QA28. Multi-turn lengths = 2+4+2+2, four singles = 14 total turns per model. Three unverified candidate model labels = 24 case-model pairs, **minimum 42 model requests** if a separate authorized executor later replays all turns; tooling/retries may add more. Real output 0; real model calls 0; real certified QA 0.
- A V16.4B regex sanitizer processed the raw input in local/private output only. It cannot establish full de-identification of names, addresses, or unique identifying context. PRIVACY_ACCEPTANCE_NOT_VERIFIED.

## 2. Operator evidence and cryptographic intake
- \`qa/v164d-decision/operator-evidence.mjs\`: zero-network, strict schema for private/QA-only evidence indices; includes proof kind, provider route, model ID, source SHA, short expiry (up to seven days), distinct QA operator/reviewer role markers, Ed25519 signature and public key fingerprint.
- No private key is committed, loaded or generated in the production source. CI generates an ephemeral test-only keypair; user-controlled/CI-generated public keys do NOT establish an independent trust root.
- With no private trust anchor, returns BLOCKED_NO_PINNED_PRIVATE_TRUST_ROOT. Matching signature provides ONLY cryptographic signature verification, never proof of provider project entitlement, user consent, reviewer identity or trusted authorization. Tampered, replayed, stale, future, cross-route and unexpected/PII-bearing fields are denied.
- Raw screenshots, emails, account IDs, API keys and customer text must NOT be placed into public PR, GitHub Actions, issue bodies, or delivered to arbitrary external services.
- Actual private human acceptance (privacy + gold reviewer, separate from runner) requires separate trusted identity verification, audience/context proof and original signed evidence in restricted private storage. Even all signed metadata fields cannot change NO-GO without separate authorization executor (absent here).

## 3. Actual model project entitlement (read-only)
- Browser tabs available in this session had NO signed-in OpenAI Platform or Google AI Studio project entitlement dashboards. Neither direct provider project ownership, model visibility, RPM/TPM/RPD, billed account, API credential scope, function calling availability nor approved data use/retention could be independently verified.
- Earlier n8n Gateway balances are a DIFFERENT ledger; not evidence of direct OpenAI/Gemini project model availability or limit.
- Official docs: https://developers.openai.com/api/docs/guides/rate-limits and https://ai.google.dev/gemini-api/docs/rate-limits. Gemini RPM/TPM/RPD vary by project/model and billing tier. Official billing docs https://ai.google.dev/gemini-api/docs/billing note project spend caps may have lag and overages. Therefore a dashboard cap is not a guaranteed atomic per-request hard stop.
- Required evidence per exact provider and route DIRECT_PROVIDER/N8N_GATEWAY: (1) operator identity and permission, (2) correct project/organization selected, (3) actual model visibility and endpoint support (including function calling), (4) model-specific RPM/TPM/RPD/quota, (5) verified billable rates and account balance, (6) data handling terms and customer data acceptance, (7) real external durable budget cap and rollback/stop. Operator proof must be independently attested, not a self-report.
- NO live key/model request made, NO credit deducted and NO top-up authorized.

## 4. Explicitly authorized canary decision — NO-GO
- \`qa/v164d-decision/authorized-canary-decision.mjs\`: exactly scoped proof matrix covering privacy, source hashes, approved golden behavior, project model visibility/rates/terms, operator authority, signed budget, durable atomic ledger/kill-switch, reconciliation, frozen mock tools, hosted Store security.
- Missing proof categories cannot be silently accepted, and all-true booleans are STILL a self-report. No trusted external operator sign-off or paid executor exists in this source. Therefore **NO_GO_PAID_CANARY**, always.
- Current approved paid experiment allocation: **USD $0.00**, no new call/supply of any project API key. Previous synthetic value USD $0.0329 for assumed 42 minimal calls (2,000 input + 500 output tokens each) is NOT an estimate upper bound, price guarantee or authorization.
- Independent P0 security remediation for live Commerce/Orders, legacy SECURITY DEFINER/RPC and hosted Store JWT-RLS remains separate, blocked. Source-only private synthetic evaluation may continue but cannot make real merchant writes.

## 5. QA plan and rollback
- 58 V16.4D Node synthetic tests for signature verification, role separation, proof expiry, duplicate evidence, account-model/route constraints, strict budget cents, forged approvals, zero-call and 8-case scope.
- 64 V16.4C Node + 52 V16.4B Node + 55 V16.4 Node + 42 private preflight Node + 75 V16.3 Node + 37 V16.2 Node + 42 V16.1 Node + 20 Python privacy tests inherited. **445 offline tests** total if all CI assertions pass.
- CI branch is child Draft-only, with paid/human job intentionally SKIPPED, not PASS.
- Rollback: close child Draft PR; no runtime rollback required. Parent #219 remains untouched, no hosted change. Private evidence must remain in restricted operator system and not this repository.

## 6. Next necessary human action — private evidence only
1. Read-only OpenAI Platform project or Google AI Studio project evidence on current permitted account, capture only model entitlement/limits/processing and budget facts in a private redacted report, no keys or customer text.
2. Have two independent human reviewers review eight sanitized cases and sign private source/gold acceptance; classify contextual PII and provider terms. If real customer data remains, BLOCK.
3. Operator selects named provider(s), explicit one-time maximum USD amount, expiry and total calls, supplies trusted signer and durable budget stop proofs. Do not infer consent from an earlier broad credit-spending statement.
4. Only a SEPARATE implementation and explicit approved action may create or run a real paid canary. This V16.4D Draft cannot execute it.
