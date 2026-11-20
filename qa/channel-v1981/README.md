# TIEN404 Zalo V19.8.1 — Bot→Store Authority Admission

Status: CANDIDATE / DRAFT / OFFLINE ONLY. This code does not authorize live reads.

## Verified audit, 19 Nov 2026 JST
- Real Zalo Bot owner chat inbound/outbound succeeded in prior PowerShell UAT.
- V19.7I protected webhook jy7vCmt8LH6BSqGh accepted an authenticated incoming text event. It only creates PII-free markers.
- n8n TIEN404_R1_SHOP_BOT_REGISTRY_QA holds only synthetic A/B records, not real Bot→Store authority.
- Supabase staging public products, orders, conversations, messages, order_items and tenant_agent_configs have tenant_id but no store_id.
- QA shop_bots and channel_identity tables exist in non-public schemas but are not sufficient evidence of canonical Owner A/B authority.
- Meta PR #418 remains DRAFT and untouched.

## Scope of this branch
- authority-policy.mjs: synthetic-only, fail-closed candidate read plan. Never authorizes real reads.
- authority-policy.test.mjs: 31 scenario tests including wrong Bot, replay, Store A/B, ownership, priviledged claims and invalid inventory.
- This document: test evidence, remaining blockers, safety and rollback.

## Security boundary
Do NOT trust tenant_id, store_id, owner, admin, canWrite or botId values from the message body.
A verified transport header binds to one configured endpoint only. It does not establish merchant ownership or Store authority.
Cryptographic transport binding, owner authorization, canonical installation/Store mapping, durable replay protection, real JWT A/B and Store RLS are NOT implemented by this offline module.
All synthetic outputs explicitly set canReadHosted=false, canSend=false and canWrite=false.
Never pass a real Zalo webhook directly to this synthetic contract as an authorization decision.

## Acceptance gates to implement next
1. Verify server-owned Zalo Bot Installation binding to canonical Tenant+Store with actual merchant ownership evidence.
2. Create approved versioned schema migration proposal and backfill plan for store isolation. DO NOT RUN against hosted staging until owner review.
3. Validate real Store A/B JWT membership, isolated RLS and a protected read-only catalog API.
4. Verify exact SKU, price, stock, freshness and privacy in a single trusted Store catalog.
5. Add durable installation-scoped replay, echo detection and rate limits.
6. After real read-only admission passes, get separate approval for one controlled provider send; order writes and revenue notifications remain OFF.

## Testing
node qa/channel-v1981/authority-policy.test.mjs

## Rollback
Close DRAFT PR and remove feature branch. Does not alter published n8n, Supabase, Zalo webhook, credentials or production.

Checkpoint: V19.8.1_CANONICAL_STORE_AUTHORITY_ADMISSION_CANDIDATE_NO_LIVE