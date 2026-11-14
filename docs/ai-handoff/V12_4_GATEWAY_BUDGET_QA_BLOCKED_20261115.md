# TIEN404 AI — V12.4 Gateway Budget Gate & QA checkpoint

**Recorded:** 2026-11-15 (JST). **Owner authorization:** Up to 10 GPT-5.4 nano test inferences using n8n Gateway credits, absolute spend <= $0.10; if enforceable spend control cannot be verified, STOP before any real model call.

## VERIFIED — Hard spend gate
- n8n `list_n8n_gateway_services` reported `available=true`, with `openAiApi` and `@n8n/n8n-nodes-langchain.lmChatOpenAi` covered by Gateway credits.
- Existing DRAFT `uGesZLvNkhY4ZO6l` configured GPT-5.4 nano. Workflow `active=false`, `activeVersionId=null`, manual trigger only, no send or Orders node.
- n8n connector currently exposes gateway service capability but no verified USD spending balance, per-workflow hard limit, or atomic reservation of this pilot's `$0.10` across in-flight calls.
- Official n8n Gateway credits documentation: instance-wide prepaid balance is shared across workflows; spend can be viewed in Cloud console; auto-top-up monthly limit is not the same as per-workflow spend cutoff; in-flight calls may finish after balance reaches zero.
- Therefore **THE REQUIRED HARD LIMIT IS NOT VERIFIED**. Do not run AI model inference using the approved allocation; this is a safety stop, NOT rejection of the model.
- Real inference attempted in this checkpoint: **0 of 10**; no new GPT paid calls or quota consumption from this QA. This checkpoint is not an independent statement about other workflows' account-wide spend.

## TESTED — No-cost tests
- n8n synthetic reply guard workflow: `nKNKDLO4l2PXL4tx`, manual-only and inactive. Execution `3666` returned **25/25 PASS**, `real_llm_tested=false`, `zalo_auto_reply_enabled=false`, `external_sends=0`, `orders_written=0`.
- GitHub isolated test suite: `qa/zalo/public-reply-pilot.test.cjs` (35 code tests). GitHub Actions run `43613199965` status completed / conclusion success on code commit `7f9a3e58052de0270ce608100033bead931f8c67`.
- DRAFT `uGesZLvNkhY4ZO6l` was NOT executed against live model. Earlier pinned execution `3665` was synthetic only and not counted as paid inference.
- LLM quality on live model: **BLOCKED/UNTESTED**; do NOT mark intent accuracy, pricing safety or hallucination safety as live-model verified.

## Unchanged
- Zalo V1 `yIJk8LvJoLF40Z62` published version `8ca4a6f6-ab3f-42f1-8637-d4f5db790a3e` remains untouched.
- Owner Shadow V2, V12.3 Customer Router, Supabase Orders and inventory unchanged; Zalo auto-send remains OFF.
- PR #41 Shop A/B and Owner session work remains an independent draft; no merge performed.
- V12.4 PR #52 stays OPEN / DRAFT and unmerged.

## Required to unblock paid QA
1. Verify a mechanism that actually enforces `$0.10` of billable Gateway spend for this test, not just UI accounting, an estimated token cost, or an automatic top-up ceiling. Account for in-flight requests and retries.
2. Verify remaining credits, available metering, model rate and output-token controls. Keep the test trigger strictly manual and at most 10 calls.
3. Only after those gates are supported, execute synthetic intents and compare actual model outputs against validated schema and backend guard. No real customer content.
4. Obtain distinct explicit approval before any Zalo outbound or production activity.

## Rollback
- No runtime or production change during this checkpoint; no rollback required.
- DRAFT workflows and PR #52 can stay inert. Do not change credit limits or billing settings without explicit approval.