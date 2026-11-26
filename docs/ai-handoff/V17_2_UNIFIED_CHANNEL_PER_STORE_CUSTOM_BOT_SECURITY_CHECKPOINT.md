# TIEN404 V17.2 — Unified Channel Integration × Per-Store Custom Bot × Security Enforcement

Checkpoint 2026-11-17 JST. Status: IMPLEMENTED / TESTED on REAL n8n MANUAL QA with SYNTHETIC data; NO live ingress, no hosted Store RLS, no send.

## VERIFIED baseline
- Messenger Published Z7FdV7uDvApfbURQ ACTIVE 27 nodes, version d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92. Unchanged.
- Zalo Bot ingress yIJk8LvJoLF40Z62 ACTIVE 10 nodes, private customer router sIPs6egzIwOY1GNv ACTIVE 6 nodes. Unchanged.
- Messenger shadow V17.1-C AKgE96Xvbqxw4rGb INACTIVE; locked V17.1-D 6ZWYRBKieTKQMzoQ INACTIVE. Untouched.
- Supabase hosted staging ifxlvrhyjhbzbrkdsida SELECT: public.stores and public.store_memberships ABSENT, zero store_id columns across products/orders/customers, one anon-executable SECURITY DEFINER QA RPC. Separate P0 security authority gap, not evidence of exploitation.
- PR #243 OPEN DRAFT; new V17.2 commits are additive, not merged to production.

## IMPLEMENTED n8n shared synthetic channel & Bot registry
NEW Data Table AAlsUnaAxbp0BscT in Personal:
TIEN404_V172_QA_UNIFIED_CHANNEL_CUSTOM_BOT_PROFILES_NO_SEND
Exactly 7 fake rows: Messenger Page A→Store A/Bot A; Messenger Page B→Store B/Bot B; Zalo Bot A→Store A/Bot A; Zalo OA B→Store B/Bot B; Website Widget A→Store A/Bot A; Messenger Page C→Tenant 2 Store C/Bot C; Messenger Page REVOKED→Store B/Bot B but REVOKED. Store A and B share Tenant 1. Each row has Bot/Prompt/Knowledge/Policy version, tone, selling mode, catalog price/stock, allowlist catalog_read. Every row has approval_scope=SYNTHETIC_ONLY, owner_authority_verified=false, read_only=true. Not business/customer data, credential or genuine Page/OA authority.

NEW workflow AjG4xCGD4OEvvgeB:
TIEN404_V172_UNIFIED_CHANNEL_CUSTOM_BOT_SECURITY_QA_NO_SEND
Version 17c3f1ea-e266-405f-8456-b182f6ffaf99; INACTIVE, no active version; 5 nodes; Personal / 90_QA - DIAGNOSTICS. Manual Trigger → 26 fake channel cases → server-side Data Table GET (7 rows) → Store+Bot/Version/Tool policy checks → fail-closed MOCK_ONLY response. No webhook, HTTP, credentials, LLM, channel send or Commerce write.

## QA EXECUTIONS — include failed first run
- First manual execution #4357 FAILED by acceptance guard: test generator used options.event_id || default, incorrectly replacing deliberately invalid blank event_id in QA_V172_23 with a valid default. This was a QA fixture defect, not proven production exploitation.
- Fixed generator to preserve provided blank ID via Object.hasOwn(options,'event_id').
- Second manual execution #4358 SUCCESS. 26/26 exact expectations: 6 QA ALLOW, 19 QA DENY, 1 QA DUPLICATE.
- Six synthetic allowed paths: Messenger Store A, Messenger Store B, Zalo Bot Store A, Zalo OA Store B, Website Store A, Messenger Store C from distinct Tenant 2. Store A 159000 VND/5, Store B 259000 VND/2, Store C 309000 VND/8.
- Negative: revoked or unknown installation, wrong channel, spoofed Store/Bot/Tenant, false verified flag, real-looking unscoped customer ID, order_read, create_order, update_price, cross-channel order lookup, duplicate/conflicting replay, unsupported image, oversized text, empty event ID and unknown provider. Denied cases carry null trusted Store/Bot.
- All outputs provider_webhooks_verified=false, hosted_rls_verified=false, customer_cross_channel_identity_verified=false, provider_sends=0, model_calls=0, commerce_writes=0, outbound=MOCK_ONLY_NOT_SENT.
- Anti-replay is in-memory in one manual execution, NOT durable concurrent n8n processing. All QA records and signed provenance are fake, not actual Meta/Zalo/Web authority.

## GitHub evidence and contract
- qa/v172-unified-core/actual-n8n-unified-core-qa-snapshot.json: exact inactive n8n graph, 7 fake registry rows, 26 QA metadata outcomes.
- qa/v172-unified-core/test_unified_snapshot.py: 41 independent source assertions for Store policy, central registry, tool boundaries, no-send, version continuity, first invalid ID bug.
- .github/workflows/v172-unified-channel-custom-bot-nosend.yml: test suite and intentional live GO gate skipped. Cite CI only after checking final exact HEAD.
- Reuse Draft PR #243; no PR proliferation.

Target server-trusted channel contract:
REAL VERIFIED CHANNEL INGRESS (native Messenger HMAC; distinct Zalo Bot header and OA event signature; server-issued Website widget session)
→ INTERNAL TRUST ATTESTATION minted after verification (never client verified:true)
→ CHANNEL INSTALLATION ID → immutable server-side Tenant/Store/approved Bot binding
→ Bot Profile/Prompt/Knowledge policy (merchant-editable tone is lower trust than security policy)
→ authorized catalog-only access to scoped Store records, after hosted JWT-RLS accepted
→ identity challenge if cross-channel customer wants order lookup
→ server-side tool authorization + confirmation for writes
→ guarded same-channel outbound.

No linking customers by matching phone/name across Messenger/Zalo/Website; separate proof-of-possession challenge and order ownership required.

## Release / next action
GO: source QA, persistent fake registry, inactive n8n unified workflow and manual synthetic QA 26/26.
NO-GO: live Messenger/Zalo OA/Website verified inbound to this workflow, Page/OA owner binding, hosted same-Tenant Store isolation, durable replay, actual customer order lookup, model API costs, outbound or Commerce write. Meta QA App/Page deferred by user, do not block safe core engineering.
Next highest value: prepare a non-public, independently authenticated ingress-to-trusted-context adapter for staging (or website server-minted QA widget session) that invokes this same Store/Bot policy, WITHOUT changing Published. Store RPC/ownership proof in PR #237 remains a separate blocker for real Commerce reads.
Rollback: close Draft PR #243 and retain inactive workflow + QA Data Table for evidence; archive/delete only after explicit approval. No production rollback needed because production unchanged.
