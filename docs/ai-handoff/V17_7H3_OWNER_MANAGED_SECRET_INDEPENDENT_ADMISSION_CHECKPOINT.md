# TIEN404 AI — V17.7H.3 Owner Evidence × Managed Secret Read-Only × Independent One-Event Decision

**Checkpoint date:** 2026-11-17 JST.
**State:** SOURCE ONLY IMPLEMENTED; REAL ZALO BOT OWNER / GETME / NATIVE EVENT **NO-GO**.

## 1. Audit checkpoint and lineage

- Primary development parent: [Draft PR #364](https://github.com/ngoctien20/demo-git/pull/364), HEAD 7eea373f29d00b0a578be67ff1d6c0ec98c569aa, inherited 640/640 synthetic QA success.
- Parallel owner UI evidence: [Draft PR #360](https://github.com/ngoctien20/demo-git/pull/360), HEAD af85e5ac83041550f112f76bdf7998a1e0f19c9b. User uploaded a Bot Creator (Beta) screen showing display name **Bot TIEN404 AI**, with 1 of 3 Bot slots. Image SHA256 da459617e310e2341eb7f27430b8c6e0c6fe3f745560ab54e2be771b74b54258 is recorded there; no image bytes are copied to this child.
- The screenshot is USER-SUPPLIED UI evidence. It does NOT display Bot ID or prove real provider-admin session, a dedicated disposable QA installation, a current Bot Token or Store owner authority.
- PR #360 and #364 are sibling OPEN DRAFT branches; do not merge both independently into main. This H.3 branch is based on #364 and references #360's SHA-bound metadata without copying/replacing the source files.
- Existing RPC16 Merchant evidence and RPC17 Durable replay, canonical Store RLS PR #247, upstream A–H.1 source PRs remain unchanged.

## 2. Verified current cloud resources (read-only)

Cloudflare account staging contains inactive Worker tien404-v177h-provider-nosend-inactive-staging, worker ID 0265c4d1f3d64f9196eb7587b8f1a552, exact version c39b8e9d-2dfc-454d-b29d-40b495ff2043. Current connected API readback: **0 deployments, deployed_on=null, workers.dev=false, previews=false, 0 bindings**, one saved version. It has no enabled public callback. RPC16 Merchant Evidence Access still DENY ALL with no inline Allow/Bypass changes.

n8n safe QA MQcbjLWZ5QUTJW0k remains INACTIVE, version b8aaf94c-def1-472c-bd92-fccea1d946b8, ManualTrigger+Code only. Existing Published Zalo Bot LAB yIJk8LvJoLF40Z62 includes DataTable QA marker UPSERT and is NOT a zero-write callback. Existing Messenger TEST has actual send node. Neither was changed or executed.

Supabase staging ifxlvrhyjhbzbrkdsida QA map has 2 Tenants, maximum 1 Store per Tenant, **no real same-Tenant Store A/B JWT/RLS**. No customer rows, credentials or merchant documents read.

## 3. Official Zalo Bot authority

- [Zalo Bot Create](https://docs.zaloplatforms.com/docs/BOT/create_bot) shows how Bot Creator creates Bot and delivers Bot Token to a Zalo account.
- [Authentication](https://docs.zaloplatforms.com/docs/BOT/authorize): token is embedded in API URL path and remains valid until reset; token possession alone cannot attest human admin/Store rights.
- [getMe](https://docs.zaloplatforms.com/docs/BOT/apis/getMe): POST read-only business call returns Bot id/account_name.
- [getWebhookInfo](https://docs.zaloplatforms.com/docs/BOT/apis/getWebhookInfo): POST reads existing URL/timestamp. Existing callback means STOP and preserve the published Bot.
- [setWebhook](https://docs.zaloplatforms.com/docs/BOT/apis/setWebhook) mutates callback and shared secret; NOT called. Bot API is separate from Zalo OA OAuth.

## 4. Changes implemented in source only

1. qa/v17-7a-oa-independent/v17-7h3-managed-secret-readback-offline.mjs — OFFLINE VAULT CALLBACK adapter wrapping inherited H.2 getMe/getWebhookInfo mock with QA_ONLY token held only in callback. No real Vault, real provider transport, global HTTP, env or logging. Existing webhook -> HARD STOP. Redacted output never exposes token, Bot ID, name, URL, provider errors or customer data. Rejected live adapter and non-QA token.
2. qa/v17-7a-oa-independent/v17-7h3-managed-secret-readback-offline.test.mjs — one callback/two POST calls, no retry/redirect, secret URL error redaction, scope and webhook mutation negatives.
3. qa/v17-7a-oa-independent/v17-7h3-independent-one-event-decision.mjs — explicitly reconciles #360 UI-only SHA and #364 mock-only getMe, ensures Worker still inactive and refuses all self-reported real credentials/consent/proofs. Output is independent decision REAL_ONE_EVENT_NO_GO with eight concrete missing gates.
4. qa/v17-7a-oa-independent/v17-7h3-independent-one-event-decision.test.mjs — negative screenshots, missing/forged Bot identity, worker exposure drift, fake owner/operator/getMe/ledger/sends/JWT.
5. qa/v17-7a-oa-independent/v17-7h3-reconciled-owner-uat-evidence.json — sanitized actual hosted state, immutable lineage and explicit pending real authority.
6. .github/workflows/v17-7h3-owner-managed-secret-no-send.yml — inherited A–H.2 QA, new regressions, source syntax/no-network/no-send/no-commerce-write static gates. Exact HEAD PASS required before claiming CI TESTED.
7. This checkpoint.

## 5. Real owner + private managed-secret UAT: PROPOSED, NOT EXECUTED

A. The owner opens Bot Creator in the Zalo-managed session, picks a **distinct disposable QA Bot** and privately pins its actual Bot ID. The existing Bot TIEN404 AI might already have a callback; never repoint it automatically. A UI screenshot without Bot ID or attested session is insufficient.

B. A trusted independent operator/reviewer verifies the owner session, grants scoped written consent for only two read-only business methods and registers issuer-signed evidence. For this solo-founder project, automated QA can independently inspect results, but must not impersonate a second human; if reviewer separation is mandatory for acceptance, obtain a real reviewer or retain NO-GO.

C. Separately approve a PRIVATE service with managed secret storing the Bot Token, no raw credential in chat/GitHub/CI/n8n execution data. Run POST getMe and getWebhookInfo only; disable redirect/retry, sanitize all URL logs/APM/errors because token appears in URL. Compare actual getMe Bot ID with the independently pinned one. Output only redacted evidence, not a URL or token. If callback exists STOP.

D. Only with owner, operator, signed native webhook, durable hosted replay/rate gate, separately approved route/budget and independent audit should ONE bounded QA message be authorized, in a 10-minute window. Required authoritative observations: one native inbound event, zero outbound, zero Commerce reads/orders/stock writes, no cross-Store access. The current 404-only Worker is inactive and cannot receive events.

E. Commerce Store A/B real JWT/RLS remains independent under canonical PR #247. Bot ownership never conveys Commerce tenant/Store permission. Zalo OA requires separate owner/OAuth.

## 6. Status, approvals, rollback

- VERIFIED: parent PRs, Zalo official API contracts, Cloudflare version-only inactive Worker, n8n QA state, QA tenant counts. Screenshot is user-provided, not independent native owner identity.
- IMPLEMENTED: private managed-secret **MOCK** compatibility and independent cross-PR admission decision, negative QA, CI, redacted checkpoint.
- TESTED: only source CI after exact HEAD green; **not** real Vault or getMe provider response.
- BLOCKED: separate QA Bot ID, independently authenticated owner/operator, actual private managed token, real getMe/getWebhookInfo, hosted signed native one-event callback, durable replay, external no-send audit and Store RLS JWT.
- NEEDS APPROVAL: scoped real private managed-secret read-only call, then separately any callback activation, native test event, token handling or cost.
- No Cloudflare, n8n, Supabase, Merchant/Customer data, token or provider API mutations in V17.7H.3.
- Rollback: close child Draft PR. Preserve both H.2 drafts for review, existing inactive Worker, RPC16, n8n Published and DEMO/Commerce boundaries. Do not delete or rotate credentials automatically.

**Final security checkpoint:** V17_7H3_PARALLEL_H2_RECONCILED__MANAGED_SECRET_MOCK_ONLY__REAL_OWNER_AND_ONE_EVENT_NO_GO.
