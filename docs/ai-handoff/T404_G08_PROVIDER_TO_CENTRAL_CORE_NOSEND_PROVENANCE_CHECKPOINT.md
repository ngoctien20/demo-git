# TIEN404 G0.8 — Real Meta Signed DEMO Evidence × Central Commerce No-Send Compatibility Gate

**Date:** 2026-11-17 JST  
**Scope:** audit READ-ONLY, source-only release gate and replayable Node22 tests.  
**Lifecycle:** EXPERIMENTAL / CANDIDATE / DRAFT / NO PROD CHANGE  
**Parent:** G0.7 Draft PR #263, exact parent SHA \`4f4dcd96bb4b6fdbaf180dfe598e627c335f6847\`.

## 1. Why this milestone does not create another webhook

Parallel V17.1E / V17.12 have already implemented the required source contracts:

- V17.1E \`qa/v171e-meta-real-event/isolated-meta-no-send.mjs\` in Draft PR #243: separate QA App/Page approval contract; Meta GET challenge and POST raw-buffer HMAC; tester-only Page event; injected durable \`claimOnce\`; no send, model or Order. Previously source-tested only; **not** the actual first independently authorized QA Page event.
- V17.12 actual inactive central Core diagnostic workflow \`7XzLd51D7C6tlaS4\` calls existing Central Commerce Core \`iyfGUiEsZlNTBWOR\` (not a duplicate agent) and correctly denies synthetic unregistered channel paths. Real Core is inactive. It is not proof of signed provider→Store routing.
- G0.7 \`mmt3ToandWrLAcjH\` is a manual-only authority NO-GO gate; it **does not** implement real provider listening or release approval.

Opening a new public n8n webhook, moving the live Meta callback, or reusing DEMO credentials would create channel conflicts and is **not authorized**. This checkpoint instead reconciles existing *actual runtime evidence* with the proposed signed Commerce no-send cutover.

## 2. Directly VERIFIED live n8n evidence — no PII exported

Read-only connected n8n workflow metadata and selected execution node flags:

### A. Existing LIVE Messenger DEMO

- Workflow \`Z7FdV7uDvApfbURQ\`, **ACTIVE / PUBLISHED**, current active version \`d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92\`, **27 nodes**.
- Execution \`4176\` at \`2026-11-16T11:31:09.716Z\`, \`mode=webhook\`, \`status=success\`.
- \`Verify Signature Timing-Safe\`: executed SUCCESS, \`verified=true\`.
- \`Verify Meta Signature\`: executed SUCCESS, \`verified=true\`.
- \`Send Messenger Reply - CONFIGURE TOKEN\`: actually **executed** SUCCESS.
- \`Verify Messenger Send Result\`: actually **executed** SUCCESS.
- **Conclusion:** real signed webhook path exists for **the old DEMO Page**, but it **SENDS**; do not relabel it a signed **NO-SEND** Commerce pilot and do not reuse the old DEMO token/catalog/tools for tenant Store Commerce.
- No sender/page/customer ID, webhook body, access token, credential or model content was copied into the G0.8 source receipt.

### B. Actual Central Commerce Core negative-path n8n

- Core workflow \`iyfGUiEsZlNTBWOR\`: currently **INACTIVE**, version \`ddc3ce5b-365e-47e2-a06d-08daffceb9a8\`.
- Diagnostic workflow \`7XzLd51D7C6tlaS4\`: **INACTIVE**.
- Actual execution \`4381\`, \`mode=manual\`, \`status=success\`; \`V1712_ACTUAL_CENTRAL_CORE_EIGHT_NEGATIVE_CASES_PASS\`: **8/8 unregistered/invalid channel cases denied**, **8 real Core subworkflow calls**, **0 provider Sends**, **0 writes**, **0 external model calls**, \`real_store_rls_verified=false\`.
- **Conclusion:** the actual Core has a working negative-path resolver, but NO authorized real signed Page→canonical Store data path has been proved.

### C. G0.7 authority gate

- Workflow \`mmt3ToandWrLAcjH\`, **INACTIVE Manual QA**.
- Execution \`4401\`, \`mode=manual\`, \`status=success\`; \`G07_PRIVATE_REVIEW_20_OF_20_REAL_ADMISSION_DENIED\`: 20/20 synthetic attempts to admit real provider denied, 0 live signed messages admitted; 0 Commerce read, 0 Send.
- **Conclusion:** deny-by-default readiness is proven only on synthetic G0.7 QA sources.

### D. Zalo Bot

- Published staging ingress \`yIJk8LvJoLF40Z62\` is **ACTIVE**, version \`8ca4a6f6-ab3f-42f1-8637-d4f5db790a3e\` with ACK/no-send.
- Its 11 newest connected executions were **manual**, not true Zalo provider webhooks. No Zalo OA native signature proof. **Do not** certify real Zalo traffic from these executions.

## 3. Implemented on this G0.8 Draft

- \`qa/v152-g08/live-vs-nosend-source-receipts.json\`: three **redacted**, exact-workflow and exact-execution observations, plus eight independent missing release proofs. No real customer data, Page ID, sender, token, phone or raw payload.
- \`qa/v152-g08/real-provider-to-core-nosend-gate.cjs\`: pure fail-closed provenance checker:
  - verifies source contract, three specific receipt references, immutable observation shapes, temporal validity and whether the actual verified callback **sent** a reply;
  - detects any attempt to conflate **real signed DEMO/send**, **synthetic Core deny/no-send** and **synthetic G0.7 admission deny**;
  - tracks unverified Page/OA No-Send authority, original Store ownership, canonical Store registry, durable replay, real signed No-Send Commerce UAT, real same-Tenant Store JWT/RLS, recovery and production callback isolation;
  - **always** returns \`REAL_SIGNED_COMMERCE_NOSEND_ADMISSION_NO_GO\` with \`mayReuseDemoCallback=false\`, \`mayReadCommerceOrders=false\`, \`mayWriteCommerceOrders=false\`, \`maySendProviderReply=false\`, \`mayPublish=false\`, \`mayMigrate=false\` even if someone supplies self-claimed all-green JSON;
  - no network, credential, webhook, n8n mutation, app/source read beyond sanitized receipt.
- \`qa/v152-g08/real-provider-to-core-nosend-gate.test.cjs\`: negative tests including spoofed source record, copied signed DEMO incorrectly marked No-Send, self-claimed Store authority, missing recovery, PII keys, stale/future receipts and all-green fake report.
- \`.github/workflows/v152-g08-provider-to-core-nosend.yml\`: new source QA, inherited G0.7–G0.4 tests and explicit deny-go-live CI job.

These components **do not grant provider ingress** and must not be interpreted as a substitute for the private owner/reviewer primary-source checks. They prevent accidental unsafe promotion while reducing redundant webhook construction.

## 4. Cross-team integration contract: next practical steps (PROPOSED)

**Provider Team / V17.1E:** obtain permission for a distinct dedicated Meta QA App+Page or a separately approved isolated no-send callback, and independently verify authentic owner, app and webhook subscription. Reuse V17.1E existing validated handler; do not change the current Published Messenger Page callback. For Zalo, verify actual Bot or OA developer policies and ownership separately.

**Integration Team / G0.7:** retain private evidence of actual Page/OA installation, signed original source and independent reviewer; use an operator-administered trust root. Fake Ed25519 signatures and user-provided flags are structurally testable, but not true merchant authority.

**Commerce Team / V17.12 + G0.4:** only after a verified installation→canonical tenant and store mapping, pass an authenticated *store-scoped* context into actual Central Commerce Core. Current Core accepts \`channelType/accountId/senderId/chatInput\` and its internal resolver is Tenant-only; it is **not** a secure real Store-scoped Commerce API. Do not call AI or Orders with real customer data until Store RLS and recovery are approved. A real signed No-Send receipt is not permission to send, create orders, bill or reuse legacy DEMO Sheets.

**Safety:** separate real provider no-send event, actual Store ownership, authorization/membership and current recoverability must be independently accepted. Local backup task remains **DEFERRED BY OWNER**, not **RESTORE CERTIFIED**. No new paid resources, production credential action, Published workflow modification, merchant customer data access or callback change authorized.

## 5. Rollback and checkpoint

Scope rollback: close new G0.8 Draft PR; no hosted or n8n state to roll back (no production write). The existing DEMO Messenger + Zalo Bot Published, existing Central Core Inactive and V17.1E isolated QA contracts remain unchanged.

**Checkpoint:** \`G08_REAL_META_DEMO_SIGNED_SEND_PROVEN__ACTUAL_CORE_8_OF_8_NO_SEND_DENY__G07_20_OF_20_REAL_ADMISSION_DENY__HOSTED_NO_GO\`.
