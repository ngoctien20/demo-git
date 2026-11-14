# TIEN404 AI V12.4 — Public Customer AI Sales Reply Pilot (staging draft)

**Date (JST):** 15/11/2026
**Stage:** EXPERIMENTAL / CANDIDATE; NOT RELEASED.
**Separate from PR #41** Shop B Owner/session/SQL work; this branch does not modify PR41.

## Verified prerequisites
- Zalo V1 ingress yIJk8LvJoLF40Z62, published version 8ca4a6f6-ab3f-42f1-8637-d4f5db790a3e.
- V12.3 Customer Router sIPs6egzIwOY1GNv, published version 8d91d23c-cd87-462f-a112-9cca2340bec8.
- EXT03 customer ingress previously recorded PII-free accepted/customer markers in staging.
- Shop A/B are QA fixtures. Public bot registry b/route-b is synthetic, NOT production verified mapping.
- Shop B F01 QA snapshot taken 2026-11-14T12:41:35.598Z, 199000 VND/stock 5. This 3h snapshot expired at 2026-11-14T15:41:35.598Z: NEVER report it as live price.

## Implemented
- qa/zalo/public-reply-pilot.cjs: pure intent-only LLM post-processor, server-scoped customer gate, stale/invalid catalog safety, quantity recheck; returns candidate text only.
- qa/zalo/public-reply-pilot.test.cjs: 35 isolated unit tests for security, pricing, PII non-echo, quote expiry and no Orders/Zalo side effects.
- n8n manual-only staging workflow nKNKDLO4l2PXL4tx: 25 synthetic reply-guard cases, execution 3664 = 25/25 PASS. This is NOT real LLM testing.

## Proposed contract — not connected to live
1. Provider webhook verified with backend-held secret, secure bot/store identity resolved on server. NEVER trust client JSON saying verified=true.
2. Fresh store-scoped catalog read; fail closed on stale/invalid data. No hardcoding Shop B in general Core Bot.
3. AI returns strict intent enum only, no reply prose to customer. Backend rechecks SKU/quantity and renders all final replies.
4. Protected operator-preview only; no external send before separate approval.
5. Persistent idempotency, rate limits, multi-turn customer memory and human-handoff service still require implementation and QA.

## Blockers / approvals
- No dedicated OpenAI credential was listed for new Commerce pilot. AI provider catalog entries are not proof that inference or billing is configured.
- No AI inference has been executed; do not claim actual LLM quality.
- Approve provider credential + small explicit inference budget before real model tests.
- Approve trusted read-only preview integration after fresh catalog and security checks; any actual Zalo auto-reply requires additional explicit approval.
- Do not approve Orders writes, production send, credential rotation or PR41 merge as part of this work.
- PR41's concurrent PostgreSQL lock test is still inconclusive; this public customer pilot does not touch its DB sessions.

## Rollback / checkpoints
- Close this draft PR; no published n8n V1/V2/customer router workflow touched by these GitHub files.
- Manual n8n harness remains inactive, no webhook and no send nodes.
- n8n QA 3663 initial 24/25, PII marker fix followed by 3664 25/25. GitHub 35-test CI must still be checked before claiming pass.