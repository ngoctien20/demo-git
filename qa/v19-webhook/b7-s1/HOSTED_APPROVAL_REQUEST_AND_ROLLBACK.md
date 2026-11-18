# TIEN404 V19.0-B7-H0 — Protected Hosted Canary Approval Package

**Status:** PROPOSED, not APPROVED. Private hosted Cloudflare Worker Binding UAT **NOT RUN**.
**Parent:** B7 #436, B6 #432. B7-S1 only adds an offline form reviewer; no deployment.
**Do not use the word APPROVED based on an earlier title or a completed local CI.**

## Proposed future test target, for human decision only

- New isolated QA-only Worker: name to be approved separately. Do NOT replace existing V17.23U worker.
- New private caller Worker or approved service principal: independently authenticated and allowlisted; a Service Binding alone does not authenticate a human operator.
- No workers.dev, no preview URL, no public route, no Zalo callback and no provider credentials.
- Approved scoped disposable D1 connection only. Reuse an existing disposable D1 **only if exact database and table-level rights are explicitly approved**; do not assume staging == disposable.
- Bounded at most 20 synthetic HTTP-equivalent calls, at most 5 new synthetic rows, at most 30 minutes. These are proposed upper bounds, not grants or cost guarantees.
- Mock provider fixtures only; no order, customer data, sensitive tokens or real Messenger/Zalo messages.
- Separate reviewer and documented cost/retention/rollback acceptance.
- Existing V17.23U deployment remains untouched; its workers.dev and preview flags stay disabled.

## Approval record (non-secret references; all fields required)

| Field | Required evidence |
|---|---|
| cloudflareAccountRef | Exact account, documented privately |
| newQaWorkerName | New TEST-only Worker name, verified not currently in use |
| disposableD1Ref | Exact isolated database binding and inventory |
| privateCallerService | Approved caller Worker/service binding |
| operatorAllowlistRef | Independently verified operator identity/allowlist |
| signedApprovalEvidenceRef | Actual user approval for exact target/resources, not the assistant's claim |
| securityReviewerRef | Separate reviewer or review receipt |
| exactGitCommitSha | The tested source HEAD, not a moving branch |
| beforeStateEvidenceRef | Existing versions, Access policies, D1 table inventory, binding snapshot |
| rollbackPlanRef | Concrete disable/restore and evidence |
| testWindowStart / testWindowEnd | Specific UTC dates and times, <=30 min |
| maxSyntheticRequests | <=20 |
| maxSyntheticRows | <=5 |
| maxBudgetRef | Approved cost/request cap, monitor and stop criteria |

All six settings must be false: productionEnabled, providerSendEnabled, orderWriteEnabled, publicWorkersDevEnabled, previewUrlsEnabled and webhookRegistrationEnabled.

The B7-S1 hosted-approval-preflight.mjs only validates FORM SHAPE and records missing/invalid fields. **It always returns deployAllowed=false, even if the data is filled in and approved:true is supplied.** It cannot verify Cloudflare Access JWTs, real service identity, owner approval or hosted D1.

## Real hosted H01-H16 checklist

Use the source of truth in B7 PRIVATE_HOSTED_CANARY_APPROVAL_GATES.md. A local HMAC fixture is not a signed Cloudflare Access JWT, and a Miniflare binding is not a hosted D1 Worker Binding.

Testing should establish:
- denied unauthenticated access before binding execution;
- allowed narrow caller only after trusted service-identity verification;
- exact Worker-to-D1 destination and data-scope verification;
- fault/timeout, duplicate/replay, parallel lease and rollback QA;
- zero provider sends, zero orders, zero real customer data;
- audit/trace/metrics and bounded cost.

If any real D1 hosted mutation or deployment is separately approved, the change ticket must name the exact table/row scope, backup, observer and cleanup/retention disposition. No implicit destructive cleanup.

## STOP / ROLLBACK

Stop on unexpected public URL, wrong D1 database, unauthorized caller, missing verification, unexpected provider event, any Store/Order access, unknown Worker source, excess cost or evidence gap.
Disable the newly approved QA admission path, validate no public path remains, restore prior target config only under the approved change. Do not alter V17.23U or Zalo webhook.

**Current gate:** BLOCKED_NO_EXACT_TARGET_APPROVAL / NO_HOSTED_DEPLOY / NO_PRODUCTION.
