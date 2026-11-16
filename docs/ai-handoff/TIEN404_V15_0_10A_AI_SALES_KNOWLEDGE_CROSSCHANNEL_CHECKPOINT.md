# TIEN404 AI V15.0-10A — VERIFIED AUDIT × SHOP KNOWLEDGE × CROSS-CHANNEL QA CHECKPOINT
Date: 16/11/2026 JST | Candidate: DRAFT | Production: NO-GO
Version correction: User-pasted "V15.0-09C REAL AI CAPABILITY" is renamed V15.0-10A because V15.0-09C already refers to Owner/G2.3 & Recovery in Draft PR #132. No old checkpoint changed.

## 1. Branch continuity
- Base PR #128, head before work 1099f8c7589544c93a03d4afe03545c266c00170, Sales Lite Pilot Consolidation (more recent V15 Universal Agent Core & Shop Studio integration).
- New PR #140, branch work/v15010a-sales-knowledge-order-continuity-nosend-20261116, child of #128; does not merge or overwrite other branches.
- Security/Owner backup authorization PR #135, HEAD 6ef086202a524b0c595fda3f03ae89a10fe73676, remains PARALLEL, not merged into #128 or this PR. Prerequisite security work must be reconciled by reviewed source changes, not assumed inherited.
- Existing V14.7 Shop Studio FIXTURES and V15 offline orchestrator were REUSED (not rebuilt/deleted). New source only in qa/v15010a-sales-knowledge.

## 2. VERIFIED external state
- Supabase staging ifxlvrhyjhbzbrkdsida: 2 Tenants, 2 Products, 2 Orders, missing public.stores and public.store_memberships. Hosted signed-JWT per-Store RLS not certified. Shop A/B same Tenant separation is synthetic only.
- n8n Messenger Published Z7FdV7uDvApfbURQ version d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92, still uses legacy AI_SALES_DEMO tool/data.
- n8n AI_SALES_DEMO Main Published v6PBwcqSapVzACMW version c0f04eb1-9e2b-4b42-bf70-0ce12d5b0c30.
- n8n Zalo Bot lab yIJk8LvJoLF40Z62 Published/active version 8ca4a6f6-ab3f-42f1-8637-d4f5db790a3e (NO production order path). Zalo private Customer Router sIPs6egzIwOY1GNv active version 8d91d23c-cd87-462f-a112-9cca2340bec8 but not wired to live customer path.
- n8n low-cost manual QA workflow uNTFqxh6OLPuH7Vw INACTIVE, version 85b91983-2d4d-4129-9467-a0fce162da9a, uses gpt-5-nano, 5-case Shop QA A, no live provider sends or Order writes.
- Historical n8n execution #3884 (manual 15/11 UTC) QA Verdict: D01–D04 PASS, D05 CROSS_SHOP FAIL due toolHealthy=false. Its response refused Shop B; therefore no observed data leakage from this text. Tool trace/per-case verdict requires further independent analysis. Workflow draft updated after that execution, so current scorer source must NOT be treated as the code evaluated at execution #3884. No new LLM calls in V15.0-10A.
- User CSV file check, LOCAL ONLY: 96 single-turn rows, 96 unique, actual_output entirely blank; 36 multi-turn rows, 36 unique, 71 turns, status NOT_RUN. Historical CSV has 97 records, 96 unique, includes old actual_output but not a new model run. Private CSV files were NOT committed to GitHub.

## 3. IMPLEMENTED
- qa/v15010a-sales-knowledge/shop-knowledge-v15-adapter.cjs: Shop profile, FAQ, returns/shipping, structured authoritative synthetic SKU price/stock, versioned QA knowledge, no premature draft. No vector/embedding because not needed for three tiny fixtures. Uses existing V15 offline Agent Core + V14.7 Shop Studio.
- qa/v15010a-sales-knowledge/shop-knowledge-v15-adapter.test.cjs: Node test suite 3 shops × 4 channels, draft knowledge approval, source trust and prompt-injection/customer claim defenses.
- qa/v15010a-sales-knowledge/disposable_order_continuity.py: SQLite QA source-of-truth with scoped Tenant/Store/Products/Orders/CustomerLinks/Owner Membership. ORDER_DRAFT→explicit Customer Confirmation→QA_PERSISTED. TEST Order ID minted by backend; no stock decrement; price/stock revalidated, idempotency across repeated confirmation/drafts. ONE-TIME synthetic customer identity challenge with explicit link consent. HMAC synthetic session proof, not real verified Meta/Zalo/JWT. Never exposes phone/address.
- qa/v15010a-sales-knowledge/test_disposable_order_continuity.py: actual SQLite file persisted and reopened, Shop A/B same Tenant vs C different, customer Zalo after link, Owner A query vs Owner B deny, replay, tampering, pause/revocation, stock/price conflict, FK.
- .github/workflows/v15010a-ai-sales-crosschannel-no-send.yml: Node22 + Python3.12 CI, 0 provider connections, 0 paid AI, 0 external real DB.
- docs/ai-handoff/V15_0_10A_AI_SALES_SHOP_KNOWLEDGE_CROSSCHANNEL_SCOPE.md: version correction and precise evidence classes.
- This checkpoint.

## 4. QA evidence / semantics
- GitHub Action initial verified at commit 6715396c12aa5bfcf7c6de98ce8ff168dc5ce9b0:
  #43795187093 SUCCESS, with 20 new Node Knowledge QA, 45 new Python SQLite QA, 78 inherited V15/Skills/Sales Lite/dataset synthetic tests = 143/143 PASS.
- After initial CI, client claim hardening and locale test were added. At commit fd60ba13897faa72385d33551476c11268019b2b, GitHub Action #43795536679 SUCCESS: 21 Node Shop-Knowledge tests + 45 actual disposable SQLite tests + 78 inherited tests = 144/144 PASS. V15 AI Core/Model Cost offline regression #43795536749 SUCCESS. These are OFFLINE/SYNTHETIC/SQLITE metrics ONLY. This checkpoint text commit itself must have green CI at exact HEAD before final TESTED claim.
- E2E is SIMULATED CHANNEL ingress with real DISPOSABLE SQLite persistence, not real hosted Messenger/Zalo provider data. Test proves synthetic post-link order lookup from same DB, not any real order or provider-native identity.
- 96+36 AI cases: DATASET STRUCTURE VERIFIED LOCALLY, REAL MODEL SCORE NOT RUN. No meaningful P50/P95, tool-call accuracy, hallucination rate or real token-cost metrics calculated.
- Legacy 5-case GPT5-nano QA verdict is not independent benchmark and does not certify tool call correctness. D05 toolHealthy is P1 to audit.
- No hosting Store RLS, real consent, provider signature, backup/restore, or real low-cost model performance proven.

## 5. Blockers & QA Acceptance
- VERIFIED: independent real state via GitHub, Supabase, n8n metadata, historical manual QA result, private CSV structure.
- IMPLEMENTED: additive source-only knowledge + disposable QA Order Service.
- TESTED: only local GitHub CI and SQLite synthetic workflow.
- BLOCKED P0: hosted Store ownership/RLS, native Provider identity, independent Owner G2.3, private hosted backup authorization & verified recovery from PR #135, shared canonical Commerce Order integration, signed JWT and real Messenger/Zalo inbound.
- BLOCKED P1: D05 old model QA tool-health verdict, real model 132-case baseline and cost/latency measurement, actual owner/customer UAT, QA Test Lab browser UI integration, checkout details/phone validation on disposable path, real replay event store.
- PROPOSED: V15.0-10B measured model QA once budget/credit and execution scope approved; V15.0-11A reconcile security parallel branches, phase approved hosted staging.

## 6. Security / rollback
No changes to Published n8n, Supabase hosted DDL/RLS/GRANT/RPC/credential/user/customer, Cloudflare staging/live, Telegram/Meta/Zalo sends, actual Orders/Stock or billing. Model API calls in THIS phase 0.
SQLite test DB generated in OS temporary directory and deleted by teardown. TEST IDs are NOT live order IDs.
Rollback: close PR #140, revert source-only change; parent PR #128 and security PR #135 remain intact. Do not merge/publish for customers.
