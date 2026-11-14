# TIEN404 AI — V12.4 AI Intent Draft Staging Checkpoint

**Checkpoint JST:** 15/11/2026
**Status:** IMPLEMENTED / SYNTHETIC TESTED; NOT REAL MODEL INFERENCE, NOT LIVE ZALO.

## n8n implementation
- Customer ingress V1: yIJk8LvJoLF40Z62, unchanged published version 8ca4a6f6-ab3f-42f1-8637-d4f5db790a3e.
- Customer router V12.3: sIPs6egzIwOY1GNv, unchanged published version 8d91d23c-cd87-462f-a112-9cca2340bec8.
- V12.4 guarded reply QA: nKNKDLO4l2PXL4tx, manual-only inactive. 25/25 PASS on execution 3664; 3663 initial 24/25 before PII-marker fix.
- V12.4 AI intent draft: uGesZLvNkhY4ZO6l, version 27f8744a-229a-4da3-9ccf-1325e2d1cf89, INACTIVE; manual-only + GPT-5.4 nano intent classifier + strict JSON structured parser + fail-closed renderer; NO webhook, NO outbound, NO Orders.
- AI draft uses n8n existing managed Gateway credits metadata; no individual OpenAI credential was created and no model inference was authorized or performed.
- AI draft synthetic pinned execution 3665 success: intent_valid=true; intent PRODUCT_QUERY; real_price_quoted=false, external_sends=0, orders_written=0, ready_for_zalo=false. MODEL was PINNED, so this is NOT a real LLM test.

## GitHub source
- Independent Draft PR #52: https://github.com/ngoctien20/demo-git/pull/52
- Branch work/v124-public-ai-reply-pilot-20261115, base work/v12-r1-shop-owned. Does not modify PR #41.
- Pure intent-only guard: qa/zalo/public-reply-pilot.cjs; tests: qa/zalo/public-reply-pilot.test.cjs.
- GitHub Actions run 43613199965 completed success (safety-tests). Node test source contains 35 cases; Actions test step passed.

## Non-negotiable safety boundaries
- Neither V12.3 published workflow nor Owner V2 nor PR #41 touched by V12.4 changes.
- User messages/LLM outputs are untrusted; model chooses intents only; pricing and stock only from fresh trusted server catalog, and expired snapshots must fail closed.
- Synthetic QA fixture b/route-b is NOT tenant identity proof for multi-store production.
- Real recipient allowlist, unique receipts, rate limiting and strict E2E signed ingress still require verification.
- No Orders, no outbox sends, no model credit inference beyond pinned node tests, no production deployment.

## Approval gates
1. Approve a capped low-cost REAL model invocation budget for n8n Gateway before testing actual LLM intent quality (and user-provided prompts/PII handling).
2. Approve internal read-only integration with V12.3 Customer Router only after fresh tenant catalog source and signed identity attestation are tested.
3. Approve separately any single-recipient Zalo outbound auto-reply pilot; default remains OFF.
4. Never merge PR41 or PR52, write Orders or enable tenant-wide outbound without separate QA and Owner signoff.

## Rollback
- Keep both V12.4 workflows inactive; archive only if needed after review. Close Draft PR #52 for source rollback.
- No live V1/Owner/Customer versions require rollback since none changed during this step.