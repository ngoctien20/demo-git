# TIEN404 AI — V15.2 ADV.3B Independent Evidence, Generalization Audit & Multi-Worker Replay Certification Gap

Date: 2026-11-16 JST. Source: child Draft of PR #148. Status: **DIAGNOSTIC ONLY / NO-SEND / NO PRODUCTION**.

## 1. Evidence and scope

- V15.2 ADV.3 [PR #148](https://github.com/ngoctien20/demo-git/pull/148) remains OPEN DRAFT and NOT MERGED. Verified predecessor HEAD \`f3148b09a9a49206bc0ac6630caeade789b91f6f\`; five exact-head CI runs succeeded.
- ADV3 original 76/76 is **deterministic heuristic agreement with hand-authored labels on development-style examples**, NOT an AI model performance benchmark. Original 53 signed-action QA tests prove only source-level and in-memory checks in a disposable environment.
- n8n manual QA workflow \`uNTFqxh6OLPuH7Vw\` (inactive, unPublished, GPT-5 Nano QA Gateway) has real model executions **#3883/#3884** dated 2026-11-15; #3884 reported successful execution but tool-calling schema issues were observed in the model trace (extra unrelated input keys rejected by QA Catalog tool). This is a **different V14.5 Sales QA workflow**, NOT ADV.3 presentation model validation or 132-case benchmark. No new AI model calls or credits used in ADV.3B.
- Store security/Owner JWT & same-Tenant cross-Store hosted RLS remain separately gated. A synthetic Owner/Customer context does not authenticate any real Merchant or Customer.

## 2. Implementation: new *diagnostic* challenge (not production accuracy)
- \`advanced-intent-diagnostic-challenge.json\`: 68 synthetic, author-designed Vietnamese cases distinct in wording from original development corpus: 48 paraphrases covering 8 intents, 12 adversarial cross-store/tool/PII requests, and 8 multi-intent/high-risk messages that require clarification or safe multi-stage planning.
- \`advanced-diagnostic-evaluator.cjs\`: OFFLINE, no model call or spend. Reports per-group exact-match, unsafe high-risk dispositions, raw case-wise mistakes. Explicit \`operationalReleaseGate: BLOCKED\`, \`liveModelAccuracyCertified:false\`, \`modelUsed:null\`; no accuracy claim for real traffic.
- \`advanced-diagnostic-evaluator.test.cjs\`: 24 integrity and release anti-overclaim tests. CI does not require the heuristic to be "100%" on hand-selected labels — failures are legitimate findings for subsequent real model/fallback improvements. Distinct challenge created in the same project, so it is **NOT blind third-party holdout**; do not overclaim independence.
- The new challenge is intentionally NOT the user's prior 96 single/36 multi commercial AI Sales dataset. It tests presentation intent and security refusal only.

## 3. Explicit multi-instance anti-replay gap
- \`advanced-multiworker-replay-gap.test.cjs\`: seven isolated tests including **expected red-team demonstration** that a token signed by the same key, consumed in instance A, can also be consumed in instance B because the two in-memory nonce Maps are separate. This is a **confirmed architectural blocker for LIVE**, even though its test passes to document the limitation. Both returns have \`canExecute:false\` and the QA module rejects all side effects. Do not state "distributed anti-replay PASS".
- Signing, expiry, current synthetic role, Store ID, exact order ID checks still pass in single-process QA. However there is **no distributed atomic consume, JWT, hosted Store RLS or provider authentication**.
- Do not deploy or expose this test-only key/token mechanism as a public endpoint. Do not use source-only QA signature as authorization evidence for Merchant Order writes.

## 4. Proposed production architecture (REVIEW ONLY / NOT APPLIED)

Trust boundary:

Channel webhook signature / authenticated Widget session
→ Trusted Store & Channel Resolver
→ Server-owned JWT or authenticated Owner session
→ current membership / Store RLS / entitlement and consent
→ validate action/audience/version/expiry/resource scope
→ **atomic durable one-time consume + business effect in one transaction**
→ trusted backend Commerce service
→ provider response adapter with its own send idempotency.

Durable replay ledger conceptual fields:
- \`tenant_id\`, \`store_id\`, \`audience\`, \`jti_digest\` (hash, never raw token), \`action_type\`, \`actor_id\`, \`resource_id\`, \`issued_at\`, \`expires_at\`, \`consumed_at\`, \`result_id\`, \`state\`.
- Atomic uniqueness on \`(audience, jti_digest)\`; transactional code must fail closed on collision, TTL expiry, changed membership, or RLS scope mismatch.
- No non-transactional "check then insert". No automatic retry of side-effecting order creation unless business-level idempotency has been proven.
- Delivery of same Meta/Zalo event again must be deduplicated by provider-scoped event IDs independently of the action receipt. Ordering/receipt acknowledgment not equivalent to customer receiving a message.
- Key IDs + rotation, limited sign permission, signer separation, audit without PII/secret, recovery and private approval record design.
- **No hosted SQL, migrations, GRANT, RLS or production changes executed.** Free-tier backup/independent owner authorization are still prerequisites.

## 5. QA / acceptance matrix

**TESTED only after exact final-head GitHub Actions:**
- 68-case diagnostic evaluator integrity and artifact;
- 7 multiworker replay-risk tests, including expected acceptance of replay by separate memory maps; this FAILS a production requirement by design;
- prior 40 presentation and 53 action unit tests remain PASS;
- no network, no paid model calls, no provider sends, no Order/Customer writes.

**Blocked release gates:**
1. Independent real low-cost model benchmark on labeled presentation data, with a clear budget and usage records; should not be conflated with V14.5 GPT-5 Nano Sales execution #3884.
2. Same-Tenant A/B live hosted Store RLS/JWT/Owner permission evidence, user/merchant channel binding and consent.
3. Durable, cross-instance atomic replay protection and key custody/rotation in authorized staging; test A/B concurrency, termination, retry and crash.
4. Approved media/link/action registries, send eligibility, NO-SEND adapter contracts and separate one-shot real channel approval.
5. Owner UAT and explicit RELEASE approval.

## 6. Reporting and rollback

Mark: **IMPLEMENTED** if source code exists; **TESTED** only if relevant exact-head CI succeeds; **PRODUCTION NO-GO** despite green diagnostics.

Rollback: close/revert child Draft PR. Parent #148 and earlier PRs #144/#134/#118 plus Sales Lite remain unchanged. No database or live workflow rollback necessary.
