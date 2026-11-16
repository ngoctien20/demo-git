# TIEN404 AI — V16.2 Performance Baseline and 132-Case QA: NO-SEND CHECKPOINT
Date: 2026-11-16 JST. Parent: V16.0–V16.1 Draft PR #190 HEAD e3d704632df0a1757249f03c7b01c368ff2c9606.
Scope: offline source-only, synthetic Shop A/B/C, no provider send, no Cloudflare deployment, no n8n Published or Supabase mutations, no real model API calls, no billing changes.

## Live read-only baseline (do not equate to customer-visible E2E)
- PR #190 OPEN DRAFT, CI run 43831431945 SUCCESS, 42 inherited synthetic tests. PR #188 CAP.1 OPEN DRAFT, PR #186 RPC.3 OPEN DRAFT.
- Messenger Z7FdV7uDvApfbURQ Published d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92; 27 nodes; 24 webhook executions succeeded in observed sample. CAP.1 24 webhook full-workflow elapsed p50=8.961s, p95=15.407s. NOT customer delivery latency; no concurrency SLA.
- Zalo V1 yIJk8LvJoLF40Z62 Published 8ca4a6f6-ab3f-42f1-8637-d4f5db790a3e; Zalo V2 Shadow OgDZNSAvKEvhnAvn Published f00ba506-c52a-4340-9a0c-809fd9c6ea9a; no provider delivery proof.
- AI SALES Main v6PBwcqSapVzACMW Published c0f04eb1-9e2b-4b42-bf70-0ce12d5b0c30.
- Tenant Resolver 5Eeh8hbpsoNhuiVo Published a99c7350-7aea-446d-bdc5-4b10f52c3ad1; Catalog oOOXicKXGkBskKqh Published e0f1e345-8e6c-40cb-8e6a-d7ad2eb92696.
- DEMO Create Order KrSn4DNR9ALX5ng4 Published 4740251a-cd01-4f7f-b8e1-e300a8393151 differs from draft af9ee686-2a9f-483e-9622-6e449500ac5e. It is not a multi-tenant production writer.
- Cloudflare account: 23 existing Worker scripts, zero Queues listed (read-only query). No V16 Hybrid runtime deployed by this PR.
- Supabase staging ifxlvrhyjhbzbrkdsida ACTIVE_HEALTHY PostgreSQL 17.11; security advisor warns public.qa_shop_b_zalo_claim SECURITY DEFINER executable by anon, plus two authenticated-definer warnings. Do not modify grants without independent operation-specific approval.
- The metrics webhook_ack, queue_wait, AI inference, provider send, device receipt cannot be fully measured end-to-end from execution metadata alone; absent value must remain null.

## QA dataset integrity, no invented scores
- 96 single-turn cases, 96 unique, 96 blank actual_output.
- 36 multi-turn dialogues, 36 unique case IDs, 71 turns, 36 NOT_RUN.
- Historical file has 97 rows, 96 unique IDs and duplicate QA01; not independently accepted as benchmark outputs.
- Current V16.2 model-quality score: PASS=0, FAIL=0, BLOCKED=0, NOT_RUN=132. This is the count of attempted tests, not a 0% quality rating.
- Offline qualityVerdict prevents fabricated PASS: missing output => NOT_RUN, missing independent evidence => BLOCKED, self-asserted evidence still cannot grant PASS without separate independent acceptance.
- Full 132-case real model comparison requires provider model IDs, usage caps, credentials, snapshot data, explicit cost budget and safe mock Commerce adapter. None has been run.

## Implemented in this child PR
- qa/v162-capacity/capacity-core.mjs: strict metadata-only telemetry schema, null-aware percentile calculation, mode isolation, fail-closed QA gate, deterministic weighted tier scheduler (NOT a production queue), demand model.
- qa/v162-capacity/cost-model.mjs: 60 scenario cost grid, model pricing inputs, tokens/calls/retry controls, no fabricated provider or support costs.
- 37 node:test offline negative/positive cases; inherited 42 V16.1 synthetic cases in CI.
- Static safety guard prohibits fetch, network, process.env, subprocess or file writes within new core/test modules.
- This PR does NOT contain CAP.1 local loopback 273-request harness; keep its results separate, no claim that PR CI reproduced CAP.1 load performance.
- No Cloudflare Queue, Durable Object, transactional outbox, production provider signature adapter, PII processing, sending, Order writing or model invocation.

## Three lanes — design targets only
- Economy: trusted versioned FAQ and catalog reads, no model by default, per-shop 1 synthetic AI slot, 5 events/minute PROPOSED; never serve stale price or inventory as authoritative.
- Standard: scoped multi-turn + model escalation, 2 synthetic AI slots, 15 events/minute PROPOSED; Commerce remains BLOCKED behind hosted security gate.
- Priority: model router, 5 synthetic AI slots, 30 events/minute PROPOSED, backlog isolation and weighted fair scheduler; target p95 AI reply <=8s is STRETCH and has no live evidence.
- Proposed scheduler weights E:S:P = 1:2:4 but it is a finite in-process simulation, not proof of steady-state fairness or cross-instance coordination. Never starve Economy.
- Distinguish measured stage durations from budget goals: webhook ACK p95 <=1s; FAQ p95 4/3/2s; AI reply p95 15/12/8s (Economy/Standard/Priority), all NOT YET VERIFIED.

## FinOps input assumptions
For illustrative USD scenarios only: 1 call/AI turn, input=1,200 tokens, output=180 tokens, GPT-5-mini reference price input $0.25 / 1M and output $2.00 / 1M (as publicly documented on 2026-11-16). Model reference is now marked deprecated by provider; do not treat as long-term production selection. Cost per one call = $0.00066 under these assumptions; 100 AI calls = $0.066. Unknown prompt cache, tool call, extra reasoning, data residency, and retries change it.
- Coverage: 1/5/20/50/100 Shops x 500/2,000/10,000/50,000 messages per Shop/month x 20%/50%/80% AI fractions = 60 scenarios; full local CSV delivered separately.
- Example: 1 Shop, 2,000 messages, 50% AI => 1,000 calls, model $0.66/month; 20 Shops x 10,000 messages, 50% AI => 100,000 calls, model $66/month. These are NOT Shop COGS.
- Excluded and must remain unknown until measured: Cloudflare Workers/Queues/DO/KV and logs, n8n subscription/execution allocation, provider messaging fees, database/storage/backups, merchant support, FX, taxes, overhead, retry bursts. Gross margin = NULL until costs and sale price are verified.
- Cloudflare Workers public reference: Free 100,000 requests/day and 10ms CPU per invocation; Paid $5 minimum/month, 10 million requests/month included then $0.30/million plus CPU. Cloudflare Queues Free 10k operations/day, Paid 1m operations/month included then $0.40/million, typically 3 operations/message. Effective account plan/quota remains UNVERIFIED.
- Sources: https://developers.cloudflare.com/workers/platform/pricing/ ; https://developers.cloudflare.com/queues/platform/pricing/ ; https://developers.openai.com/api/docs/models/gpt-5-mini
- No paid API, plan upgrade, Worker deployment or billing action performed.

## P0 / P1 and releases
P0: anon callable SECURITY DEFINER RPC; missing hosted Owner A/B same-tenant JWT/RLS proof; backup/restore and operator authorization; Commerce writer cannot be opened. Keep all real Shop/Orders NO-GO.
P1: real n8n concurrency and usage limits unknown; model project RPM/TPM and API spending caps unknown; Queue non-existent; true delivery status unknown; insufficient statistically representative E2E traces.
Rollback: close child Draft PR / delete its source-only branch after review. No runtime rollback needed; no production resources changed.
Next gate: V16.3 Economy Router + Tenant Cost Engine, only offline code after separate review; V16.4 real 132-case A/B requires specific per-provider paid budget and credentials permission; V16.5 durable hosted replay requires independently tested transactions in isolation. Never promote to production based on synthetic CI.
