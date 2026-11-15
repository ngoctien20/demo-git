# TIEN404 AI V14.8-01 — Identity Architecture ADR-0148 (STAGING / DRAFT)

Decision status: PROPOSED — 16 Nov 2026 JST. Architecture candidates must NOT be silently deployed. Real provider send + real Orders remain BLOCKED.

## 1. Facts verified by direct read-only connector audit

- GitHub PR #114 V14.6-01 OPEN DRAFT HEAD afe1b16cb37dbd758399c0c0768e4681bc008fe2: 4 changed files, pre-existing canonical reconciliation + L2 synthetic bridge. DO NOT rebuild or merge as part of this ADR.
- GitHub PR #118 V14.7-04/05 OPEN DRAFT HEAD 1bdc6f7d74e2e8ea2b2b15651831e50c6b8c980e: existing merchant Custom Bot Studio, Rich UI and Zalo experience lab. This branch is based on #118 HEAD; no V14.7 files modified. Existing owner V14.7-03 synthetic UAT 5/5 remains a historical owner report, not true provider qualification.
- GitHub PR #119 V14.5 LIVE03C OPEN DRAFT HEAD 66b1fa3c3be33e94e1ccfb7cc23495ee20ad3093: existing isolated signed fixture Messenger Order Intent Candidate. Its tests do not authorize a real Order and are a separate PR line.
- n8n Messenger Z7FdV7uDvApfbURQ, ACTIVE 27 nodes Published d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92. Still has legacy DEMO toolWorkflow create_order, manage_order, update_order_address and Meta HTTP Send.
- n8n Zalo Ingress yIJk8LvJoLF40Z62, ACTIVE 10 nodes Published 8ca4a6f6-ab3f-42f1-8637-d4f5db790a3e. Existing protected ingress/normalize, QA registry routing, no Message Send in inspected graph.
- n8n private Zalo router sIPs6egzIwOY1GNv ACTIVE 6 nodes Published 8d91d23c-cd87-462f-a112-9cca2340bec8. Uses QA Bot Registry, Owner Allowlist, Shop B QA catalog, private preview without send.
- n8n AI_SALES_DEMO Main Agent v6PBwcqSapVzACMW ACTIVE 8 nodes Published c0f04eb1-9e2b-4b42-bf70-0ce12d5b0c30.
- Supabase staging ifxlvrhyjhbzbrkdsida ACTIVE_HEALTHY PG17.11 in ap-southeast-1: public.tenants 2 rows, tenant_memberships 3, products 2, orders 2; aggregate counts only. Core public tenant tables RLS ENABLED/FORCED and membership-scoped SELECT. No canonical public.stores or public.store_memberships, and Store ID is missing from core tenant-level Products, Orders, Conversations. A separate QA schema tien404_r1_qa already has tenant_identity_map, shop_bots, owner_bindings, catalog; do not confuse QA store_key with a canonical Store UUID or create duplicate QA tables.
- Supabase Security Advisor warns public.qa_shop_b_zalo_claim is anon-executable SECURITY DEFINER; public.qa_owner_pairing and save_merchant_product are SECURITY DEFINER executable by authenticated. Review their business purpose and ownership before making any GRANT changes; this is a release-risk finding, NOT proof of exploit. Reference https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable
- Cloudflare connected account read-only: existing TIEN404 Workers include tien404-v147-custom-studio-synthetic-nosend-staging, tien404-g22-shop-b-map-nosend-staging, tien404-widget-gateway-v144-staging, tien404-zalo-outbound-v1-staging and other QA Workers; Pages include tien404-ai-git-staging and tien404-ai-staging. Worker code/bindings/deployment/actual ZALO_SEND_ENABLED configuration were NOT reverified in this V14.8 checkpoint. NO Cloudflare deployments.

## 2. Architecture decision

Keep n8n as the existing orchestration runtime; introduce an **internal normalized identity contract and backend-owned trusted binding** as a self-contained module, not a new full Commerce bot. Choose lowest-complexity deployment only after comparing real hosted latency and verified security. Three options:

A. n8n-only resolver: fastest to adapt existing workflows, fewer components, but per-execution cold starts, storage, replay and shared multi-Store trust need explicit solution. No proven p95/cost.
B. Cloudflare Worker ingress + Supabase + n8n: potentially fast verification and shared routing, but new deployment boundary, tenant identity authority, Worker-to-n8n auth, secret rotation and more maintenance. No measured cost/latency savings yet.
C. Hybrid: reuse n8n orchestration and later move **only verified hot identity routing** into a Worker if proper benchmarks support it. Prefer candidate architecture C conditional, not automatic production selection.

**Decision:** Source-only 01/02 resolver contract now; continue n8n no-send lab. Defer any real gateway deployment or switch until hosted permission/ownership proof, real telemetry and explicit review.

## 3. Canonical ID contract 1.0.0

Authoritative internal identifiers:
- tenant_id: canonical public.tenants.id UUID in real hosted system (QA fixtures use prefixed strings).
- store_id: future **canonical Store UUID**, mapped to tenant_id with true FK/RLS; MUST NOT use QA store_key as real ID without audited mapping.
- channel_binding_id: internal immutable scoped binding; identifies provider + environment + channel + provider account + bot.
- bot_profile_id: versioned configuration under authenticated Store; V14.7 preview remains separate Experimental until consent.
- customer_id: only if account linking is verified and consented; never auto-link Messenger and Zalo.
- conversation_id: independent per Store/binding/provider subject/conversation namespace.

Provider identifiers remain external-scoped:
- provider, channel, environment, provider_account_ref, provider_bot_ref, provider_user_ref, provider_conversation_ref, event_id.
- Raw user identifiers and event payload MUST NOT appear in public response/logs.
- A signed/provider-attested envelope is required before backend may use the provider account to lookup the private binding. Never accept client-supplied tenant/store/admin role.

QA resolver implementation: qa/v148/unified-identity-resolver.cjs.
- HMAC over EXACT synthetic raw normalized event bytes with a **synthetic adapter secret**. This authenticates the QA harness only, NOT real Meta/Zalo/webview.
- Strict keys; no tenant/store in payload; binding registry backend-owned; four channels with distinct provider namespace; no synthetic sender cross-link.
- Positive trust only when binding active + Store active + subscription active + can_process. No send entitlement at all (can_send false).
- Replay dedupe is in-memory ONLY; would require atomic hosted storage before live.
- Version-aware TTL metadata cache checks live synthetic policy on every read; deny on revoked/expired/suspended.
- Fast path only for verified greeting, opening hours and SKU/product read; complex support AI_PENDING (NO MODEL CALL); all transactional order requests BLOCKED until separately approved server-side write guard.
- No change to V14.7 UI preview, existing Bot Profiles, orders, credentials, published n8n graph or Worker routes.

## 4. Schema reuse and proposed future migration (NOT APPLIED)

REUSE:
- public.tenants and public.tenant_memberships
- public.products/orders/conversations with existing tenant-scoped RLS, after Store ownership migration REVIEW
- public.tenant_agent_configs if fits Bot Profile scopes (currently channel pilot_lab only)
- app_private.channel_secrets for actual secret scopes, only after audited auth model
- tien404_r1_qa.tenant_identity_map / shop_bots / owner_bindings as TEST-ONLY prior evidence, never as production canonical Store tables.

MISSING OR UNVERIFIED:
- public.stores canonical linked to tenants with unique(id,tenant_id), independent owner/store membership RLS, exact cross-Store enforcement.
- private channel_bindings with provider namespace + environment + bot/account and a unique live-binding constraint.
- private external_identities and conversations identity edges, consent-based cross-channel linking.
- identity audit event table/traces without PII and retention rules, private-only, no public SECURITY DEFINER.
- Store-aware Bot Profile link/version and subscription suspend/revoke version semantics.

Proposed additions only after independent 4-row ownership evidence, backup restore, stable JWT/RLS and written permission. See the separate non-executable SQL review sketch V14_8_01_SCHEMA_REVIEW_NOT_APPLIED.sql. No actual hosted migrations performed.

## 5. Performance requirements and measurement plan

Historical real Messenger execution baselines from V14.8 user checkpoint: #3865 7.163s; #3866 5.296s; #3867 15.075s; #3868 9.873s. These are full n8n execution durations, not measured user receipt latency. The named signature node durations 1.635/1.805 in that report should be interpreted as thousands of milliseconds per document notation, NOT raw HMAC compute time. Need actual node runtime vs n8n initialization profiling before optimization.
- Offline Node CPU candidate benchmark tests 100 greetings, 100 catalog, 100 price per warm and cold categories and 500 multi-channel calls (1100 total). It measures only isolated adapter HMAC validation + binding lookup/cache + local reply routing, EXCLUDING n8n, hosted DB, network, Meta/Zalo send and any real AI call. Never compare its p95 directly to full Messenger elapsed time or claim percentage gains.
- Target resolver p95<200ms and Store Config lookup p95<150ms in deployed environment remain **UNVERIFIED TARGETS**. CI CPU numbers are informational only.
- Real "end-to-end" p50<4s, p95<8s remain unverified until consented provider test with reliable receipt telemetry.
- No provider cost projection absent verified unit prices/model inference calls and n8n subscription limits; running synthetic Node does not incur AI provider usage.

## 6. Security/compatibility release gates

- Cross-store A/B same tenant, C another tenant: deny unauthorized reads/price contamination.
- Distinct scoped ID per messenger, Zalo Bot, Zalo OA, Widget; never merge by name/phone/external ID alone.
- Invalid adapter signatures, tampered payloads, revoked binding, subscription expiration, prompt/client store override: fail closed.
- No actual send when can_send=false. Real order create/update/write tools physically absent in this candidate.
- Preserve V14.7 Custom Bot Studio synthetic UI and experience workflow; run its inherited regression CI without changing its files.
- Review hosted RLS membership, QA public SECURITY DEFINER warnings, Store ownership/recovery before adding tables/migrations.
- Reliable production provider authentication is NOT yet implemented by this synthetic adapter; each channel needs its own real signature/identity verification before use.

**Rollback:** Close Draft V14.8 PR and any inactive QA Workflow (only with approval); hosted schema/workflows unchanged. GitHub SHA + no-send QA evidence at subsequent checkpoint.

**OWNER UAT:** proposed after demonstrable read-only synthetic QA. No release approval implied by offline tests.
