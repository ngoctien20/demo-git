# TIEN404 V17.1-A — Existing Channel Audit × Trusted Store Resolver Contract × Custom Bot Binding

Date: 2026-11-17 JST. State: IMPLEMENTED as executable source-only synthetic module; not yet deployed into n8n. All new changes additive and Draft-only.

## VERIFIED — Existing platform, read-only
- n8n Messenger Z7FdV7uDvApfbURQ: active/published, 27 nodes, active version d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92. Already contains webhook, Meta signature/timing-safe verification, duplicate MID, AI Agent, Google Sheets read and FIVE legacy business tools. It has a live send node. This new source does NOT modify the workflow, credential, session or tools.
- n8n Zalo ingress yIJk8LvJoLF40Z62: active, 10 nodes, version 8ca4a6f6-ab3f-42f1-8637-d4f5db790a3e. Zalo private router sIPs6egzIwOY1GNv: active, 6 nodes, version 8d91d23c-cd87-462f-a112-9cca2340bec8. Router has staging trusted QA registry, owner allowlist and Shop B read-only catalog nodes. These are not proof of real hosted Store A/B isolation or OA ownership.
- n8n AI Sales Main v6PBwcqSapVzACMW: active, 8 nodes, version c0f04eb1-9e2b-4b42-bf70-0ce12d5b0c30, gpt-5-mini. Unchanged.
- Supabase staging ifxlvrhyjhbzbrkdsida inspected via SELECT only: public.stores absent, public.store_memberships absent, 0 Store ID columns among Products/Orders/Customers; three permissive core Commerce policies and anon EXECUTE on public.qa_shop_b_zalo_claim (SECURITY DEFINER). This is a P0 security gate, not itself proof of exploitability.
- GitHub existing Draft PRs were inspected. Store/RPC/M3 #237 HEAD 8cebbf72aabb943242c4dcbecb83238292c258d6, Messenger one-shot #239 HEAD fb4a85139acfdb3116dc44f4476eb70205f87855, private model QA #228 HEAD 9cb5fd316ad8f991728e13cd33a28953c5011f2b. They are OPEN DRAFT and unmerged. New source branch starts from pinned gh-pages HEAD ff2daf970e8209399a28b2d0cade8a33b9fa71c6, not from a competing Draft.

## IMPLEMENTED — Executable thin slice (QA only)
Module: qa/v171-channel-first/vertical-slice.mjs
Tests: qa/v171-channel-first/vertical-slice.test.mjs
Smoke: qa/v171-channel-first/smoke.mjs
CI: .github/workflows/v171a-channel-bot-vertical-slice-nosend.yml

Pipeline: SYNTHETIC CHANNEL EVENT → MOCK SIGNATURE CHECK → SERVER-SIDE QA CHANNEL INSTALLATION → TRUSTED QA TENANT/STORE/BOT → SHOP-SCOPED CATALOG_READ → DETERMINISTIC READ-ONLY RESPONSE → SAME-CHANNEL MOCK OUTBOUND.

Messenger A and B, Zalo B, Website A, and cross-Tenant Messenger C all use the SAME resolver/core interface. Shop A/B share Tenant QA_TENANT_1 and SKU QA_SKU_001 but have distinct product, price, stock and Bot/Prompt/Knowledge versions. A is 159000 VND / 5; B is 259000 VND / 2. Cross-Tenant C is 309000 VND / 8. All values are clearly fake fixtures, not merchant records.

Security: Incoming tenant_id/store_id/bot_id, verification_status and unexpected credentials cannot authorize Store choice. Tool authorization re-resolves channel binding; there is no self-asserted Bot/Store trust. Only catalog_read is allowed. Orders, price writes, LLM calls, vendor network calls and outbound sends are absent/disabled. Returned outbound includes source installation and customer scope, MOCK_ONLY status. Replay checks use in-memory per-installation idempotency, not durable atomic cross-worker acceptance. Trace excludes private message text. Fake HMAC fixture keys are NOT genuine Meta/Zalo/Website webhook verification and must never be used in hosted runtime.

## TESTED vs NOT TESTED
- Source local Node.js tests and five smoke scenarios were run before GitHub commit; capture the actual new GitHub Actions case count at final HEAD.
- No real n8n execution ID exists for this new module, and no actual Meta/Zalo/Website message was delivered.
- No real OpenAI/Google model was called. Mock answers are not LLM quality evidence.
- No real Supabase Store RLS or Store ownership was accepted. No SQL mutation, data transfer or live customer tool was performed.
- Production website and all Published n8n graphs unchanged.

## Release Gate and responsibility
- SOURCE-ONLY synthetic QA: GO if CI succeeds.
- INACTIVE n8n staging candidate: NOT IMPLEMENTED YET; next safe step to add after n8n preference/SDK review and no-send workflow contract.
- Actual native channel signature/authority and outbound recipient: NOT VERIFIED for the new path.
- HOSTED SAME-TENANT STORE A/B: NO-GO until real Owner, JWT-RLS, composite FKs, Store mapping and RPC audit from Store security track.
- Real Commerce writes, live canary, model migration, Core Bot RELEASED: NO-GO.

## Immediate next implementation
1. Wire a non-active QA workflow in n8n: synthetic input → trusted fixture registry → Custom Bot A/B profile → catalog-only fake data → response mock; get execution proof. Do not attach five legacy writer tools.
2. On the same API contract, compare Messenger staging ingress and Zalo router, then add Website installation verification.
3. Independently reconcile merchant ownership and approve hosted Store migration in PR #237; private Page/OA ownership and one-shot live send authority in PR #239; model migration as separate cost-gated track.
4. Allow only bounded staging read-only activities without real merchant context; use explicit independent approvals before hosted schema, production credentials, model billing or live sends.

Rollback: close the additive child Draft PR. Parent gh-pages, PR #237/#239/#228, Published n8n versions, Supabase and production remain unchanged. No runtime rollback required because this phase has no live writes.
