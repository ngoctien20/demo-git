# TIEN404 AI — V17.MULTI-CHANNEL-02
## Verified Store Staff Authority × Messenger Human Handoff Acceptance × Unified Customer Inbox Staging

Date: 2026-11-17 JST. Status: **SOURCE-ONLY / SYNTHETIC QA STAGING**.

Parent: [PR #295](https://github.com/ngoctien20/demo-git/pull/295), exact HEAD \`774c8eda439768d90bbeded399a966f6acb1dc03\`. This is an independent additive child Draft. Do NOT merge, deploy or point a real provider callback at this code.

## Direct read-only evidence

- n8n Messenger \`Z7FdV7uDvApfbURQ\`, published \`1064b1b3-d3f1-4a6b-a367-2414ba691522\`, 32 nodes; includes real Messenger Send and AI_SALES_DEMO order tools. **Do not wire experiments into that live send/order graph.**
- n8n Zalo Bot Lab \`yIJk8LvJoLF40Z62\`, published \`2d912cb0-007f-452f-9536-b92ba12a03e6\`, 12 nodes.
- n8n Private Customer Router \`sIPs6egzIwOY1GNv\`, published \`8d91d23c-cd87-462f-a112-9cca2340bec8\`, 6 nodes.
- Supabase staging \`ifxlvrhyjhbzbrkdsida\` ACTIVE_HEALTHY. Fresh read-only \`information_schema\` + \`pg_policies\` metadata check: Commerce \`products\`, \`orders\`, \`customers\`, \`conversations\`, \`messages\` all have **no store_id** and **zero Store-ID-qualified RLS predicates**. Metadata observation does not prove an actual exploit, but real Shop A/B same-Tenant JWT UAT is NO-GO.
- PR #82 \`qa/conversation-v138/conversation-core.cjs\` plus \`ui/...\` already provides a Zalo Bot-only synthetic Inbox/Handoff, 44 Node test cases and responsive preview. **Preserve and reuse** this, do not create a second Zalo Bot business state engine. UI here is a *four-channel exploratory shell*.
- PR #81/#78: Staff readiness + role ports, not an authenticated commercial staff backend. Tester staff is NOT merchant staff.
- PR #124: Unified Identity; PR #248: Image-to-SKU; PR #204: cross-channel read-only identity linking. Reuse, not duplicate.
- PR #295: \`handoff-planner.mjs\` and \`outbound-eligibility.mjs\` remain the single existing handoff/outbound source-only planners.
- Meta Graph v27 documentation: \`/{page_id}/pass_thread_control\`, \`/{page_id}/release_thread_control\`. Actual handover receipts vary with Page/App configuration and must be independently verified with native events in a no-send private QA app, not inferred from client payloads.

## Implemented in this child Draft

1. \`qa/v17-multichannel02/staff-authority-offline.mjs\`
   - Private adapters: \`verifySupabaseSession\`, \`resolveInstallation\`, \`readMerchantMembership\`, \`readCommercialStaffAssignment\`, \`verifyPageInboxAccess\`.
   - Rejects raw client roles, anon/revoked sessions, unrecognized Store, tester staff, wrong-Tenant membership, revoked/expired assignments, missing actions and wrong Page/App.
   - Real Supabase session/JWT is **not** called; \`QA_SYNTHETIC_SUPABASE_AUTH\` is a fixture marker and positive outputs are ONLY \`QA_SYNTHETIC_STAFF_PREVIEW\`.
   - No production authorizer minted, no UI token or high-privilege role granted.

2. \`qa/v17-multichannel02/meta-handoff-acceptance-offline.mjs\`
   - Private synthetic receipt-handle contract: expected pending transition, raw-HMAC-shaped QA receipt, Page/App/Store/conversation/request matching, timestamp and injected replay reservation.
   - Does NOT validate real Meta HMAC, execute pass/take/release, change conversations, unmute bot or claim real provider receipt. Positive output always \`canCommitState=false\`, \`realProviderVerified=false\`.
   - Meta Handover acceptance will be real only after independent Page primary/secondary receiver rights, signed webhook and native ACK evidence.

3. \`qa/v17-multichannel02/unified-inbox-qa-projection.mjs\`
   - Per-Store multi-channel synthetic rows, strict allowlist, rejects cross-Store/Tenant and unauthorized bindings, redacts/rejects phone/email/HTML and extraneous fields.
   - Never queries real Supabase; only injected fixture reader accepted.

4. \`qa/v17-multichannel02/ui/index.html\`, \`ui/unified-inbox-qa.js\`
   - Mobile-first four-channel UI preview, Store A/B filter, status filter, search and mock AI↔human states.
   - Local in-memory synthetic data only. CSP denies all network connections; no credential input, localStorage, customer records or outbound actions.
   - NOT a deployed staging URL. Run locally via \`python3 -m http.server 8765\` at repository root and visit \`http://127.0.0.1:8765/qa/v17-multichannel02/ui/\`. A local preview uses no billing or hosted resources. Python is used only to serve static files, not to implement bot functionality.
   - UI mock is **not** backed by the staff gate and does not enforce real permissions; only backend can authorize hosted reads and provider sends.
   - Built clean-room, not copied from \`yagizharman/Messenger-Repo\` (unlicensed) or Meta's Facebook-specific license code.

## Independent QA / release conditions

Run \`node --test qa/v17-multichannel02/*.test.mjs\`
and inherited \`node --test qa/v17-multichannel-intelligence/*.test.mjs\`
and \`node --test qa/zalo-oa-source-admission/*.test.mjs\`.

A correct UI shape, source marker or synthetic provider receipt is NOT Auth/Store/Page authority; do not treat positive synthetic tests as live acceptance.

### P0 / blocked
- Commercial Staff assignment registry, canonical Store ownership, authenticated same-Tenant Store A/B staff sessions, real multi-Store JWT/RLS negative proof.
- Native Meta Page roles, App assignment and handover permissions via authenticated provider console; signed event admission with raw-body HMAC and durable replay; no-send callback ACK.
- Durable atomic CAS for handoff state, ownership version and staff revocation; independent outbox, cost/quota and send policy.
- No real customer PII, live Page/OA token, real OAuth or workflow publish under this approval.
- Actual browser hosted UAT requires access-protected isolated staging deployment with a separate approval; this UI file is only a local/offline staging preview.
- Recovery/rollback operator evidence for any future hosted RLS/write migration.

### Source QA rollback
Rollback is to close child Draft PR (or remove new source-only branch after preserving QA evidence). Parent PR #295, prior PR #291/#292/#294, n8n live graphs, Cloudflare and Supabase are untouched.

### Future work order
1. Use existing PR #81 commercial role design and PR #290/#247 Store Owner evidence to obtain separately authenticated owner/staff QA sessions and Same-Tenant A/B RLS denial.
2. Private Page owner/operator approval for Meta native Handover and real signed no-send QA webhook.
3. Extend existing V13.8 mock to read from one private Store-scoped Inbox projection after hosted security gates; do NOT copy raw QA fixture data into live.
4. Only then consider an approved isolated hosted browser UAT. Live Meta handover/real customer sends require additional explicit approval.

Checkpoint acceptance: DRAFT + deterministic synthetic QA only; real human handover is BLOCKED.
