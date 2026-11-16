# TIEN404 AI — V15.2 ADV.5.1 Action Vocabulary Reconciliation × No-Send Security Gate

Checkpoint: 2026-11-16 JST. Lifecycle: **DRAFT / EXPERIMENTAL / NO SEND / NO MERGE / NO HOSTED WRITE**.

## 1. Source audit: parallel tracks, do NOT rebuild
- [PR #152](https://github.com/ngoctien20/demo-git/pull/152) — ADV.5 Safe Channel Adapter × server-only HMAC Action Registry, verified HEAD \`58cd3acd19982592d05fb41dbe5f829304c51934\`, 5/5 exact-HEAD GitHub Actions SUCCESS, OPEN DRAFT. Backend actions: \`CATALOG\`, \`QUOTE\`, \`ORDER_REQUEST\`, \`ASK_STAFF\`, \`POLICY\`.
- [PR #162](https://github.com/ngoctien20/demo-git/pull/162) — separately developed ADV.4 Studio V14.7 extension, verified HEAD \`b018524f4a7daeb7ce681195dde365581259bfa2\`, 7/7 GitHub Actions SUCCESS, OPEN DRAFT. UI IDs: \`VIEW_CATALOG\`, \`REQUEST_QUOTE\`, \`ASK_STAFF\`, \`VIEW_POLICY\`, \`ORDER_REQUEST_DRAFT\`, \`TRACK_ORDER\`, \`OPEN_VERIFIED_LINK\`.
- [PR #159](https://github.com/ngoctien20/demo-git/pull/159) — sibling ADV.5 Canonical Registry candidate/merchant UAT, HEAD \`bfeefe655a95e334de33ba6ca3d75f46b0f1bcc7\`, 5/5 GitHub Actions SUCCESS; **no independently verified real merchant UAT**.
- [PR #163](https://github.com/ngoctien20/demo-git/pull/163) — ADV.6 Canonical Gateway × Verified Identity × PG Nonce Design, HEAD \`0edae15bb9e8256858e5b5db3f516d63cb5dfa75\`, 2/2 CI SUCCESS; its PG nonce store is only an injected interface and proposed SQL draft, **no hosted database migration or real JWT cert**.
- All four PRs remain OPEN DRAFT (not released), on divergent ancestry. No automated merges/cherry-picks. This child PR is based on **#152** and does not silently include #162, #159, or #163.

## 2. Identified integration defect / architectural conflict
An action selected in the Advanced Studio is not directly compatible with the signed receipt action allowlist. It is unsafe to map \`ORDER_REQUEST_DRAFT\` to \`ORDER_REQUEST\` because the former implies draft creation whereas ADV.5 \`ORDER_REQUEST\` is only a conversation/confirmation hint, never a write. \`TRACK_ORDER\` is private Commerce data and \`OPEN_VERIFIED_LINK\` needs an approved server-side link registry, neither exists in ADV.5 server receipt policy.

## 3. Implemented additive source-only solution
- \`qa/v152-advanced-actions/studio-action-crosswalk.cjs\`: **read-only, no-sign/no-send/no-execute** semantic crosswalk from Studio vocabulary to ADV.5 receipt names for non-sensitive preview hints; source-text from existing trusted ADV.5 adapters; independent Store fixture validation. Explicitly BLOCK \`ORDER_REQUEST_DRAFT\`, \`TRACK_ORDER\`, \`OPEN_VERIFIED_LINK\`; all output has \`canSign:false\`, \`canSend:false\`, \`canExecute:false\`, no provider payload or approved media/link URL. No identity/owner entitlement is inferred.
- \`studio-action-crosswalk.test.cjs\`: 35 deterministic tests including 3 Shop × 4 Channel × 11 Action Alias = **132 combinations** of No-Send QA coverage; same-tenant Shop A/B price isolation, unknown action/channel/store denial, model-supplied recipient/url/price injection denial, semantic mismatch report, blocked private Order Lookup/creation, blocked OA paid message.
- \`studio-action-crosswalk-report.cjs\`: JSON manifest for next integration gate with references to sibling PRs, explicitly marks **every production certification gate false**.
- \`.github/workflows/v152-adv5-action-reconciliation-nosend.yml\`: syntax, 35 tests, inherited signed HMAC action tests, four channel adapters, V14.7/ADV.2/ADV.3 regressions, manifest artifact, static No-Send and No-Sign scan.
- **No parallel backend signer added**; PR #152 is the only HMAC signer on this branch, and the crosswalk never calls \`issue()\` or \`verifyAndClaim()\`.

## 4. Trust boundary
A merchant-selected Studio UI option, model proposal, and provider capability report are **untrusted presentation inputs**, not authenticated action commands.
All real actions need independent verified channel identity + Owner/Customer authorization, Store JWT/RLS, current account consent, approved action/resource, short-lived signed receipt, **durable atomic one-time nonce**, business-level idempotency and audit before effects. No check-then-insert; receipt validation alone cannot authorize order execution.

The existing QA-only memory nonce store is not distributed/restart-safe. PR #163 PG adapter and SQL are **proposals** and remain untested against real hosted auth/RLS/DB. No source-only CI can certify real Meta/Zalo entitlement or hosted ownership.

## 5. QA and release gates
Record exact final commit, CI jobs, test results and artifact; mark TESTED only on that exact HEAD.
- Real JWT/Owner/Customer consent and same-Tenant Shop A/B hosted RLS: BLOCKED.
- Durable PostgreSQL transactional, restart- and multi-instance-safe consume + business write/idempotency: BLOCKED.
- Link/media allowlists and provider entitlements (Messenger/Zalo Bot/OA): BLOCKED.
- Real model intent generalization & high-risk safeguards: BLOCKED; 68-case ADV.3B diagnostics found 15/68 heuristic correct, 11/20 high-risk misroutes. **Not a real model benchmark**.
- Merchant Owner UAT, provider one-shot approval, paid ZBS/LLM budget, release approval: BLOCKED.

## 6. Rollback and follow-up
Close/revert this child Draft PR. PRs #152, #162, #159, #163 and Sales Lite remain unchanged. No database, credential, production, billing or provider operations performed.

Next: a single approved **integration reconciliation decision** choosing canonical component/action registry, replacing synthetic identity with hosted proof, and actual PG atomic nonce/commerce transaction testing in an isolated disposable Postgres environment. Do not publish or merge parallel Draft PRs as a batch without resolving ancestry and schema conflicts.
