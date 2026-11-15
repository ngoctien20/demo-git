# TIEN404 V13.8 — Customer/Shop Conversation + Human Handoff API and Security Contract

**Status: PROPOSED architecture, not deployed** — audit 15/11/2026 JST.

## Product scope

TIEN404 AI is a multi-channel AI Sales SaaS (Zalo / Messenger / Website), NOT a Zalo-only Bot product.

**Customer-to-Shop via Bot:** the customer messages the shop's Zalo Bot. An authorized shop operator or TIEN404 support staff can eventually respond within the same Bot conversation through a separate TIEN404-managed inbox + server-side outbound adapter, NOT by magically sending from their personal Zalo accounts.

Lite: standard, staff-managed product and order-request assistance. Plus: richer staff-managed bot customization. Enterprise: advanced collaboration and, after permission verification, OA capabilities. AI Studio remains future scope. Merchant account/plan/billing portal is NOT a Bot editor. Shop staff, if specifically authorized later, may reply to their shop's conversation but may not configure Bots or access other stores.

## Audited existing systems — reuse before building

**n8n**
- Active Zalo Bot webhook workflow yIJk8LvJoLF40Z62 receives protected events and ACKs without sending. It calls V12.3 customer router. Do not replace it.
- Active private customer router sIPs6egzIwOY1GNv reads a **synthetic** Shop B Bot registry and QA catalog; returns previews, not live automated customer replies. Do not promote it without real trusted tenant binding.
- Previous Shop B dialogue QA workflow HOTkruOTMmat24eT ran 20/20 PASS at execution 3827; external sends 0 and Orders writes 0.
- New manual-only QA workflow bvk9TtedP5rxtj4u embeds the pure state machine from GitHub and ran 19/19 PASS at execution 3829; no HTTP, DB, outgoing messages or credentials. Execution 3828 had a syntax error, fixed before the successful 3829.

**Supabase staging** (read-only SQL only)
- Existing public.conversations columns: id, tenant_id, channel, external_reference, created_at. RLS enabled.
- Existing public.messages columns: id, tenant_id, conversation_id, sender, body, created_at. RLS enabled.
- public.tenant_memberships and public.tenants exist, with RLS enabled.
- Current conversations_manager_read and messages_manager_read policies permit SELECT by authenticated, active tenant owner/manager membership. They check tenant_id but do NOT prove Shop A/Shop B isolation under a shared tenant; there is no store_id on these two conversation tables.
- NO schema, data, RLS, credential, storage, subscription, Orders or payment changes were made.

**Zalo**
- Official Bot Creator supports receiving Webhooks and sending replies via sendMessage: https://docs.zaloplatforms.com/docs/BOT/create_bot
- Prior bounded V13.7 QA, n8n execution 3826: sendPhoto, sendChatAction, sendVoice, sendSticker each API_ACCEPTED; Owner subsequently confirmed receipt of test messages. Previous four-message send quota fully used. Existing Worker general ZALO_SEND_ENABLED remains false.

## Future backend pipeline (DESIGN ONLY)

1. Authenticated Bot Webhook receives incoming event. Verify transport integrity and replay; do not trust tenant_id/store_id/user role from request body.
2. Trusted backend Bot→Tenant→Store resolver binds verified chat and customer session. No cross-tenant/shop lookup from a caller-supplied ID.
3. Use the existing conversations/messages table family, with additive store-level fields and server-side outbox to be designed. Require event uniqueness, a transaction and CAS state revision.
4. AI_ACTIVE: create a response candidate using an authoritative read-only catalog; do not invent prices or stock.
5. HANDOFF: customer asks for human support, return/refund/complaint, or safety policy escalates. Transition WAITING_STAFF, queue a staff task and suppress subsequent AI auto responses.
6. A verified SHOP_OPERATOR or scoped TIEN404_SUPPORT staff member can accept a single shop's pending conversation. STAFF_REPLY creates a draft first. Only a separately approved dispatcher can send through Zalo Bot sendMessage.
7. HUMAN_ACTIVE suppresses AI to avoid duplicate or contradictory replies. STAFF_RETURN_AI explicitly returns control. STAFF_CLOSE resolves the conversation. Customer may reopen after verified new contact.
8. Shop temporary pause is a scoped policy, not a global workflow switch. It must not affect other shops.
9. The adapter-specific transport layer can later support Messenger and Website without duplicating Sales Core state machine logic.

### Proposed API routes, NOT implemented

- GET /internal/conversations — read only after staff session and strict tenant/store membership.
- GET /internal/conversations/:id/messages — store-scoped, paginated, sanitized.
- POST /internal/conversations/:id/claim — staff assignment with optimistic revision.
- POST /internal/conversations/:id/reply-draft — stage content only, NO Zalo send.
- POST /internal/conversations/:id/send — BLOCKED until a new approval, secure outbox, recipient binding, no retries.
- POST /internal/conversations/:id/release and /close — audited authorization.
- POST /internal/shops/:id/pause and /resume — authorized staff only.

### Proposed additive DB changes — NOT applied

Add verified store_id/bot_id and conversation status/revision/assignee to existing conversation records; append provider event idempotency and role-specific sender markers to messages, with audited outbox and index/unique keys. Backfill and enable strict store-level RLS for Shop A/B, preserving tenant isolation. Requires backup, migration plan and **separate explicit approval for auth/RLS changes** before any SQL DDL or data writes. Do not create duplicate replacement conversation tables.

## Offline implementation and tests

- qa/conversation-v138/conversation-core.cjs: immutable-style state machine for AI_ACTIVE, WAITING_STAFF, HUMAN_ACTIVE, RESOLVED; shop pause flag; customer messages, staff accept/reply/close/return AI, pause/resume.
- Binding: trusted server-derived bot, tenant, store, customer, expiry; verified authenticated staff role, permission whitelist, exact shop, assigned operator. Authorizes BEFORE replay handling.
- Optimistic revision and event ID deduplication; no message dispatch, paid model calls, DB writes, orders, email/Telegram sends, platform admin actions or Bot design controls.
- Catalog query creates CATALOG_DELEGATION_ONLY; order asks generate ORDER_REQUEST_DRAFT_ONLY. Never invent a price or order number.
- Browser-only UI at qa/conversation-v138/ui: two panels for simulated Zalo customer and staff inbox. Data in memory only, no real logins or customer PII; clicking Send does NOT send to Zalo.
- GitHub Actions QA: 44 conversation safety tests and existing menu/gateway/Zalo regression, plus Chromium 5 widths and closure/reopen test.
- n8n manual-only workflow bvk9TtedP5rxtj4u validates the same core logic with synthetic fixtures. No existing active workflow was edited.

## Production gates

BLOCKED until separately approved: per-store hosted RLS; real staff auth/assignment; secure persistent state, CAS/idempotency and outbox; authenticated recipient mapping; separate provider send authorization; external customer QA session distinct from Shop B Owner QA; live reply and handoff on Zalo with authorized bounded sends and actual screenshots; subscription expiration and shop pause tests. Do NOT use the exhausted V13.7 send quota or re-enable general sending.

## Rollback

Close the new V13.8 Draft PR and archive the isolated manual QA workflow if necessary. No Supabase migrations or Cloudflare deployments were made in V13.8. Do not blindly roll back the V13.7 media Worker because previously sent test messages might reference its static QA media endpoints.
