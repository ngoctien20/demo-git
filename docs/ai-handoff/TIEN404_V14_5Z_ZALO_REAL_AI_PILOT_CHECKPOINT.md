# TIEN404 AI V14.5Z — Zalo Real AI Conversation Pilot Checkpoint
**Date:** 2026-11-15 JST  
**Mode:** STAGING DRAFT / OFFLINE QA / NO SEND  
**Release:** EXPERIMENTAL, not CANDIDATE or live service

## 1. Verified pre-change
- n8n protected Zalo ingress `yIJk8LvJoLF40Z62` active, 10 nodes, ACK-only, no sender; no changes made.
- Customer router `sIPs6egzIwOY1GNv` active, 6 nodes, QA table readback and preview only; no changes made.
- AI draft `uGesZLvNkhY4ZO6l` inactive, 7 nodes, prior manual execution 3665 completed a real OpenAI *intent classification* (PRODUCT_QUERY/F01), **not** customer Zalo reply.
- V13.8 source contains customer/handoff state machine and normalized routing; reuse, not replace.
- Supabase staging V14.2 store-level hosted RLS + isolated backup restore remain unverified. No DB writes.
- Previously approved V13.7 real Zalo sends have no remaining reusable authorization; obtain new bounded owner approval.

## 2. Implemented, source-only
- `qa/zalo-live-v145z/ai-pilot.cjs`: offline adapter wired to existing V13.8 `transition`, trusted QA catalog assertions, per-Shop SKU/price/stock, bounded integer VND arithmetic, short-turn SKU memory, suppression during handoff, replay rejection.
- Optional callback `modelPort` is an OFFLINE_FAKE_MODEL injection for QA **only**. It is not a real model connector. It cannot enable provider send, real Orders writes or live mode.
- `qa/zalo-live-v145z/ai-pilot.test.cjs`: negative tests for replay, forged Store, cross-Shop catalog/memory, stale data, model fact injection, handoff, quantity, invalid scope and no-send.
- `.github/workflows/v145z-zalo-ai-offline-qa.yml`: Node 22 tests + inherited V13.8 regression and source guard.

## 3. Evidence and limitations
- Local development tested an earlier equivalent adapter against a **temporary local Conversation Core test double**: 26/26 PASS. That is not a real V13.8 integration test.
- GitHub Actions (when completed on this PR) is the authoritative repository integration check against the actual V13.8 module; record action URL and exact counts after execution.
- No n8n workflow, provider token, Cloudflare Worker, Zalo webhook, Supabase schema/RLS, Orders, production route, billing, customer message or real model inference has been modified by this branch.
- This branch is stacked on `work/v142-store-rls-onboarding-staging` for code reuse only; it does not authorize or deploy V14.2.
- The source currently checks `source`/ `verified` markers as **interface contracts**, not cryptographic authentication. A real hosted pilot must supply binding through a server-owned verifier; do not accept markers from Zalo JSON.
- The in-memory session is a contract, **not durable**. Real replay/CAS/outbox must be implemented and verified before any live automated reply.
- Output is intentionally conservative and model participation is fake-labeled. Never report LIVE_AI_VERIFIED based on this branch.

## 4. Approval gate — proposed next limited pilot
Before any outbound Zalo message or real model call: verify Bot Creator vs OA, provider webhook signature/auth, private Bot→Store mapping, store-scoped QA allowlist, real chat ownership, durable event claim, session persist, rate limit, rollback and emergency disable. Require separate owner approval naming exact Bot, recipient, max messages, time window, model cost cap, workflow version and write boundaries.

Proposed controlled acceptance: owner sends at least 3 multi-turn Zalo QA messages; trace actual inbound and AI generation execution; record provider API message IDs; owner confirms visible responses on phone. No order write, inventory changes or cross-Shop data.

## 5. Status
- Verified ingress/router: VERIFIED / ACK_ONLY
- Local adapter: IMPLEMENTED / PRELIMINARY_OFFLINE_TESTED
- GitHub CI: PENDING until actual run is inspected
- Real AI model-to-Zalo response: BLOCKED (not yet wired)
- Live provider send: NOT AUTHORIZED
- Hosted Store RLS: BLOCKED
- Production/Commercial readiness: BLOCKED

## 6. Rollback
Close this Draft PR / delete only new V14.5Z branch. Published n8n workflows, Supabase staging and Zalo provider remain untouched. Do **not** merge this dependency-stacked branch to gh-pages without an explicit integration review.
