# TIEN404 V14.8-01 — ADR-0148 Unified Identity & Multi-Channel Routing

**Decision status:** CANDIDATE DRAFT. **Date:** 2026-11-16 JST. **Scope:** architecture + offline resolver, NO hosted migration or real provider connect.
**Parent:** PR #118 (V14.7 Custom Bot Studio OPEN DRAFT at HEAD 1bdc6f7d74e2e8ea2b2b15651831e50c6b8c980e). Other related PRs #114 (V14.6), #119 (Messenger LIVE03C), all OPEN DRAFT. This new Draft is stacked on PR #118; no merge performed.

## 1. Current system audit — verified by connected read-only tools

### n8n (Published versions; none changed)
- Messenger TIEN404_MESSENGER_TEST Z7FdV7uDvApfbURQ ACTIVE, 27 nodes, active version d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92. Raw-body HMAC, AI Agent, read-only Products and WRITE-CAPABLE create_order, manage_order and update_order_address tools exist in its Published graph.
- Zalo Bot Ingress yIJk8LvJoLF40Z62 ACTIVE, 10 nodes, active version 8ca4a6f6-ab3f-42f1-8637-d4f5db790a3e. Existing trusted staging bot/owner QA modules, marker data tables; not proof of active provider send permission.
- Zalo Private Router sIPs6egzIwOY1GNv ACTIVE, 6 nodes, active version 8d91d23c-cd87-462f-a112-9cca2340bec8. QA Bot Registry + Owner Allowlist; synthetic read-only.
- AI_SALES_DEMO Main Agent v6PBwcqSapVzACMW ACTIVE, 8 nodes, active version c0f04eb1-9e2b-4b42-bf70-0ce12d5b0c30; separately retained and not a hosted multi-tenant Commerce Core.
- Messenger LIVE01/02 actual responses #3866/#3867/#3868 earlier accepted by the owner; LIVE03 order confirmation on published Page remains unsafe under no-write requirement because Create Order Tool KrSn4DNR9ALX5ng4 has Google Sheets Append Order.

### Supabase staging ifxlvrhyjhbzbrkdsida — PostgreSQL 17.11
- Reuse existing public.tenants, public.tenant_memberships, public.products, public.orders, public.conversations, public.tenant_agent_configs. Their tenant-based RLS policies exist and FORCE RLS is enabled on major Commerce tables.
- **No public.stores or public.store_memberships exists in audited schema**; public.products/orders/conversations lack canonical store_id. Tenant-wide RLS is NOT authorization proof for two Stores within one Tenant.
- app_private.channel_secrets contains tenant_id/platform/external_account_ref/secret_ref; DO NOT expose, duplicate or migrate secret values into an identity registry.
- tien404_r1_qa.shop_bots and tenant_identity_map exist for limited QA claims; they are NOT canonical hosted Store authority; do not duplicate or automatically promote them.
- Security advisor: public.qa_shop_b_zalo_claim is SECURITY DEFINER and callable by anon; public.qa_owner_pairing and public.save_merchant_product are SECURITY DEFINER callable by authenticated. Investigate owner/operator intent and actual function body before proposing GRANT changes. RLS enabled/no-policy on several private QA tables is not by itself evidence of exposure.
- Security advisor findings are **outstanding audit items**, NO hosted change made.
- Auth-dependent full backup/restore, four-row Store ownership, hosted Store JWT/RLS remain BLOCKED.

### Cloudflare read-only resource inventory
- Existing Workers include tien404-v147-custom-studio-synthetic-nosend-staging, tien404-g22-shop-b-map-nosend-staging, tien404-zalo-outbound-v1-staging, tien404-widget-gateway-v144-staging and other existing components.
- Pages include tien404-ai-git-staging and tien404-ai-staging, both production_branch gh-pages. NO Worker or Pages deployment was performed.
- Cloudflare KV is eventually consistent; cannot be the sole authority for immediate revocation/Store reassignment. Source: https://developers.cloudflare.com/kv/concepts/how-kv-works/

## 2. ADR Decision: internal IDs unify, provider IDs remain separate

Internal IDs, assigned ONLY by verified trusted backend:
- tenant_id: canonical public.tenants.id where hosted evidence exists; synthetic fixtures use qa_tenant_1/qa_tenant_2 and are **not UUIDs or live row IDs**.
- store_id: canonical Store id **not yet established on hosted**; synthetic qa_shop_a/b/c only.
- channel_binding_id: exact provider account/bot/environment to Store map.
- bot_profile_id: references a versioned Shop/Channel custom bot profile.
- customer_id: separate server-namespace-derived person reference, not a cross-platform customer merge.
- conversation_id: references channel-binding+provider conversation scope.

External IDs NEVER lose their scope: channel/provider, environment, provider_account_ref, provider_bot_ref, provider_user_ref, provider_conversation_ref, event_id. Same provider user identifier string on Messenger and Zalo MUST resolve to different customers unless a separate verified account-link protocol exists.

**Trust boundary:**
provider-specific webhook/session verification → normalized trusted event → registry lookup on provider/env/account/bot → ACTIVE, unexpired and authorized binding → owner/policy/subscription status → Store + Bot Profile lookup → FAST/AI/TRANSACTION route → restricted response adapter.

An HTTP body, Messenger quick reply, Zalo payload, Website JavaScript or LLM must NEVER set tenant_id/store_id/is_admin/can_send. Trusted backend derives them independently. A normalized object marked verified=true by a client is not evidence.

Current source implements only an **internal QA synthetic HMAC envelope** shared by four channel fixtures; this is NOT real Meta/Zalo OA/Zalo Bot authentication. Provider-specific real production signature/session validation remains separate.

## 3. V14.8-01/02 canonical contract (candidate)

### Verified input for the offline synthetic adapter

{
  "channel": "MESSENGER",
  "environment": "qa_staging",
  "provider_account_ref": "qa_account_MESSENGER_A",
  "provider_bot_ref": "qa_bot_MESSENGER_A",
  "provider_user_ref": "qa_user_same_for_test",
  "provider_conversation_ref": "qa_conv_00000001",
  "event_id": "qa_event_00000001",
  "event_type": "message",
  "text": "Báo giá A001",
  "timestamp_ms": 1794776400000
}

The actual QA wrapper additionally supplies raw bytes + synthetic HMAC signature; the body above is never accepted without its signed envelope.

### Derived output example — partial fields

{
  "contract_version": "v14.8.0-candidate.1",
  "trusted": true,
  "status": "RESOLVED",
  "tenant_id": "qa_tenant_1",
  "store_id": "qa_shop_a",
  "channel_binding_id": "binding_MESSENGER_A",
  "bot_profile_id": "qa_profile_MESSENGER_A",
  "customer_id": "customer_<HMAC-derived>",
  "conversation_id": "conversation_<HMAC-derived>",
  "route_path": "FAST",
  "resolution_status": "FAST_REPLY_READY",
  "policy": {"can_process":true,"can_send":false,"can_write_orders":false},
  "provider_sends": 0,
  "actual_order_writes": 0
}

No phone, raw PSID, App Secret, sender text or real access token is logged by the resolver. The external account and bot aliases in QA outputs are synthetic.

## 4. Canonical hosted data reconciliation and migration PROPOSAL ONLY

**Reuse, do not recreate:** public.tenants and tenant_memberships. Do not add a new parallel tenant namespace; map authoritative Store only once.

**Candidate later migration after real restore/ownership approval (NOT APPLIED):**
1. Introduce canonical stores table with FK to existing tenants; optional store_memberships for per-Store merchant role and explicit authorization. Reject implicit tenant-level access to every Store.
2. Migrate only approved/verified Store mapping from ownership evidence; DO NOT infer Store from Products or from a client-provided ID.
3. Create channel_bindings in a PRIVATE or appropriately RLS-protected schema, unique active (provider, environment, account_ref, bot_ref), referencing Store and Tenant with server-validated ownership.
4. External identities reference channel_binding + provider_user_ref. Do NOT auto-merge Messenger/Zalo/Website by same name/phone.
5. Reuse public.conversations only with reviewed migration adding trustworthy store_id and channel_binding_id; do not create second competing Conversation source.
6. Add minimal PII-free audit logs trace_id, event_id hash, binding_id, resolution_status, reason_code, latency_ms; no raw tokens/content.
7. Private secret refs must remain separate in app_private.channel_secrets (or approved store-scoped vault). No plaintext secret migrations.
8. Index per scoped route lookup and private tenant/store foreign keys. Write RLS policies with both tenant AND store ownership, verify JWT/App Metadata trust and application role. PostgreSQL SECURITY DEFINER or GRANT changes require independent security review and user approval.

**Dependencies:** real backup restore, four-row ownership evidence, inventory/order migration design, real Store RLS/JWT acceptance. No SQL migration generated/applied in this gate because canonical Store ownership and approval are missing; avoiding premature DDL prevents duplicate tables.

## 5. Fast Path and caching decision

For authenticated requests only:
- FAST: greeting, short verified Shop info, exact SKU catalog read or quotation from fresh authorized Store source.
- AI: complex consultation, comparisons, multi-turn, complaint; load only the Store context needed for that intent.
- TRANSACTION: order creation/amendment/payment; MUST use separate authoritative Store scoped backend and independent explicit confirmation. Current candidate ALWAYS blocks transactions and AI provider calls.
- Never bypass signature, subscription, owner, Store or permission gates for speed.
- Private profile cache: test code stores immutable preview with 15-second TTL, and checks each Shop/Channel profile version plus binding status on every event. Revocation clears local profile cache. This is process-local synthetic and not a globally coherent authorization cache.
- No caching of permission grants without authoritative freshness/revocation.
- Do not cache customer-sensitive data or stale price/stock as if authoritative.

## 6. Architecture options — engineering assessment

A. **n8n-only:** minimal extra infrastructure and easiest rollback, but multi-node workflow orchestration and runtime/tool setup costs may dominate short greetings; real optimization needs node timing samples.
B. **Cloudflare Worker Gateway + Supabase + n8n:** short raw signature/normalized resolver hot path possible, but additional service ownership, authenticated edge-to-data round trips, caching invalidation and provider secret security increase complexity; no deployment until security and cost evidence.
C. **Hybrid:** leave n8n Sales Core orchestration; move only verified identity lookup/fast read-only replies to dedicated gateway *if* A fails full customer-visible SLO or measurable cost gates.

**Initial decision:** Preserve existing n8n + baseline (A); prototype an isolated gateway only as a candidate benchmark (B/C) when justified. Do not add a new paid service without scope, performance or budget approval.

## 7. Security & rollback

Must fail closed: unknown/revoked/expired binding, incorrect HMAC/session, scope spoof, duplicate event, inactive Shop, pending owner verification, expired subscription, unsupported channel, missing Store, stale provider rights. No default-store fallback.

Partial failure: log a scoped reason code and return a no-send outcome, never route to Shop A simply because store lookup failed. Provider sends remain DISABLED in all V14.8 source and UI fixtures.

**No production rollback needed now:** all implementations are draft source, independent synthetic QA and temporary in-memory state. Close Draft PR to revert. Hosted schema/Workers/n8n Published remain unchanged.

**Gate status:** V14.8-01 identity design CANDIDATE; V14.8-02 synthetic resolver IMPLEMENTED and undergoing QA; V14.8-03 offline benchmark not a live latency certification; V14.8-04/05 real provider integration and owner production signoff BLOCKED.
