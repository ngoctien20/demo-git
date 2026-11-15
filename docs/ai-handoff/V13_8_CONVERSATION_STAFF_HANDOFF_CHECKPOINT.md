# TIEN404 AI — V13.8 CONVERSATION + HUMAN HANDOFF CHECKPOINT

**Ngày:** 15/11/2026 JST  
**Trạng thái:** VERIFIED + IMPLEMENTED + TESTED on staging QA source; live reply and customer/staff inbox are BLOCKED pending auth/data/recipient/send gates.  
**Phạm vi:** AI SALES multi-channel SaaS, Zalo Bot prioritized, không chỉ bán Bot Zalo.

## 1. Checkpoint V13.7 → V13.8

- V13.7 authorized four bounded Zalo Bot sends through n8n execution 3826: sendChatAction, sendPhoto, sendVoice, sendSticker returned API_ACCEPTED and consumed four D1 claims. Owner subsequently stated they received the trial messages. **No assumption that all media render, audio play or interactive controls pass additional QA from that statement alone.**
- Previous Zalo staging Worker is still version ed172d3c-e1f1-4daa-bc56-643406441091, deployment 2ce7ea81-3755-47b1-afdd-a799db3da3c8, global ZALO_SEND_ENABLED=false. No Worker changes in V13.8.
- Previous one-shot QA sender VflHQf5OQhMwOqLN remains inactive with four sending nodes disabled; old quota is exhausted.
- User requested extension to customer/shop natural conversations, AI-to-human handoff and support scenarios; do not publish or send live messages without a separate approval.

## 2. Verified existing architecture

n8n:
- yIJk8LvJoLF40Z62: active protected Zalo Webhook, ACK only, no customer reply; invokes synthetic V12.3 router and legacy shadow QA. Do NOT modify the active ingress in this PR.
- sIPs6egzIwOY1GNv: active private customer router, read-only preview with synthetic Shop B Bot registry and catalog. Do NOT assume production-ready tenant resolver.
- HOTkruOTMmat24eT: previously existing Shop B conversation fixture suite; execution **3827**, result SHOP_B_CHAT_STAGING_PASS, **20/20 PASS**, zero external sends or Orders writes; uses synthetic Shop B F01 199k/stock 5 as QA data only.
- New bvk9TtedP5rxtj4u: TIEN404_V138_CONVERSATION_STAFF_HANDOFF_QA_STAGING, personal project / 90_QA - DIAGNOSTICS, 3 nodes (Manual trigger + 2 Code), inactive/unpublished, **no HTTP, DB, credential or outgoing send nodes**. Execution **3828** failed due duplicate local symbol declaration; fixed in both versioned SDK source and n8n, then execution **3829** SUCCESS, **19/19 PASS**, 0 external sends, 0 Orders writes.

Supabase read-only SQL:
- public.conversations and public.messages exist and have RLS enabled.
- public.conversations: id, tenant_id, channel, external_reference, created_at; public.messages: id, tenant_id, conversation_id, sender, body, created_at.
- Existing manager SELECT policies rely on active tenant_memberships owner/manager and tenant_id; NOT proven to isolate different shops inside one tenant because store_id is not currently present in those two tables.
- NO schema writes, no RLS updates, no extra customer data read; P0 additional hosted store-level policies and staff role approvals are required before real inbox.

Zalo product documentation:
- Bot Creator supports Webhooks + sendMessage responses: https://docs.zaloplatforms.com/docs/BOT/create_bot
- Real shop-operator reply within a customer's Bot conversation will require an authenticated TIEN404 staff inbox and an authorized server-side outbound dispatcher. It cannot be treated as direct personal-Zalo-to-customer messaging.

## 3. Implemented GitHub source

- Repo: https://github.com/ngoctien20/demo-git
- Branch: work/v138-conversation-handoff-qa-staging
- Draft PR: https://github.com/ngoctien20/demo-git/pull/82
- Base PR #80 (V13.7 staging QA), without touching production gh-pages.
- qa/conversation-v138/conversation-core.cjs: 4 state machine phases AI_ACTIVE, WAITING_STAFF, HUMAN_ACTIVE, RESOLVED, plus shop pause flag. Inbound customer event, staff accept/reply/close/return AI, staff pause/resume.
- All server context must be trusted from backend resolver: bot, tenant, store, customer conversation, expiry; incoming message must be authenticated PRIVATE webhook, no bot echo. Staff sessions must be verified, permission-scoped and assigned to the same shop. Authorization checked BEFORE replay handling. Event IDs with CAS revision prevent duplicate drafts.
- All proposals have dispatch_authorized=false, provider_sends=0, orders_written=0, outbox_written=0, production_ready=false; catalog questions delegate to existing trusted Sales Core instead of inventing price, stock or order numbers.
- qa/conversation-v138/conversation-core.test.cjs: 44 Node unit and security cases.
- qa/conversation-v138/ui/index.html + app.js: mobile-first static synthetic QA of customer Zalo chat and staff inbox with local interactive handoff, reply draft, pause/resume, close/reopen. **No actual login, customer PII, Zalo send or backend fetch.** Clicking send only changes the browser mock.
- qa/conversation-v138/ui-browser-qa.cjs: 5 viewport browser tests (360/390/430/768/1280) + 1 closure/reopen scenario, no non-GET network, no browser errors or horizontal overflow, UI mock screenshot.
- qa/conversation-v138/n8n-v138-conversation-handoff-qa-sdk.mjs: SDK source with embedded immutable QA core for n8n manual-only workflow. Synchronize SDK after core modifications; do not splice directly into active ingress.
- qa/conversation-v138/API_SECURITY_CONTRACT.md: proposed actual backend pipeline and gaps, not deployed.
- .github/workflows/v138-conversation-handoff-qa.yml: isolated Chromium and Node regression jobs.

## 4. Test evidence

GitHub Actions **43693259579** SUCCESS at source commit **103705ea293170f086bedd17873dd33b7ec57efd**:
- V13.8 Conversation core: 44/44 PASS.
- V13.1 Menu Engine regression: 116/116 PASS.
- V13.6 Button Lab: 18/18 PASS.
- V13.5 Worker guard: 16/16 PASS.
- V13.7 five API contracts: 26/26 PASS.
- V13.7 four-call gateway: 21/21 PASS.
- V13.5 Rich Text source: 14/14 PASS.
- **TOTAL 255/255 Node tests PASS**.
- Chromium customer/staff mock: **6/6 PASS** (five widths, close/reopen). No unexpected HTTP writes. Screenshot artifact available on GitHub Actions under the run.
- Existing n8n 3827 20/20; new n8n 3829 19/19. **39/39** dry-run functional fixture checks (separate workflows).
- No new Zalo outbound, no customer Orders writes, no published Webhook change in V13.8.

## 5. What remains blocked / P0 before live customer/shop chat

1. Real externally authenticated customer test account (distinct from Shop B Owner QA), verified webhook signature/header, incoming message ID and tenant/store binding.
2. Correct store-level RLS and verified shop-employee/support memberships; existing conversations/messages tables are currently tenant-scoped only. Additive migration and policy review require separate Owner approval; do not create replacement tables or use Demo Orders.
3. Secure backend persistence with CAS, dedup, outbox and authorization. Existing V13.8 JS in source and n8n QA is a pure preview, not persistent memory.
4. Staff inbox authenticated role, store authorization, tickets, ownership and audit logs. Merchant account/plan/billing portal remains separate; bot configuration stays TIEN404 staff-only.
5. Real customer reply via sendMessage and employee manual response through the same Bot, with a separate bounded send test approval, no retry and controlled rate limits. Do NOT reuse V13.5 or V13.7 exhausted sends.
6. Live exact provider timing/limits and retention/consent obligations, shop pause, subscription expiry, duplicate/race, prompt injection, Cross-Shop A/B hosted QA.
7. Future Messenger and Website adapters reuse conversation state and multi-shop contract; do not hard-code Zalo-only business logic.

## 6. Changes, authorization, checkpoint, rollback

VERIFIED: GitHub, n8n, Supabase read-only structure, Cloudflare kill switch and provider docs.
IMPLEMENTED: V13.8 GitHub source/mock, new separate n8n manual QA workflow.
TESTED: GitHub 255/255, Browser 6/6, n8n 19/19 new + 20/20 existing.
PROPOSED: Secure staff inbox backend, store RLS, idempotent reply outbox.
BLOCKED: Live Zalo customer/staff bidirectional messaging, writes to real conversations/orders and merchant staff permissions.

**No credential changes, Cloudflare deployment, production merge, Supabase writes or real outgoing Zalo messages in V13.8.**
Rollback: close/revert PR #82 and optionally retire new QA workflow bvk9TtedP5rxtj4u. Old production/staging systems remain unchanged; do not roll back V13.7 media worker blindly as previous received test links may still reference it.

**Next checkpoint:** after separate security approval, implement a tenant/store-scoped, authenticated staff read-only inbox and durable conversation messages against existing Supabase tables in staging; QA hosted RLS Shop A/B; only after those gates request a new limited live customer reply/handoff test.
