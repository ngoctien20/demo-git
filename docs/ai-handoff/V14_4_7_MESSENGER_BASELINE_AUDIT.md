# TIEN404 AI V14.4.7 — Messenger Integration Baseline (read-only verified)

Checkpoint: 16 November 2026 JST
Scope: live n8n read-only inspection + Supabase read-only inventory + Draft GitHub source.
Source lineage: V14.4.6 Draft PR #108 HEAD b23ac8e724ce738c70778ffb3e5d082560185893.
Lifecycle: EXPERIMENTAL; no existing Published workflow, real Messenger Page, credential, data, RLS, grant or production change.

## 1. Current n8n Messenger system — VERIFIED on connector

- Active workflow TIEN404_MESSENGER_TEST: Z7FdV7uDvApfbURQ, version d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92, Draft matches Published.
- Nodes present: Meta GET/POST Webhooks, signature crypto and timing-safe verification, message extractor, duplicate MID lookup and successful MID record, one-message loop, Messenger AI Agent, OpenAI Chat Model, conversation memory, read-only Google Sheets Products tool, Prepare Reply, Send Messenger Reply HTTP Request, and workflow tools create_order, update_order_address, manage_order, get_order_status, create_support_ticket.
- The three order write tool targets are LEGACY AI_SALES_DEMO: Create KrSn4DNR9ALX5ng4, Update BkAi6TVUKAjCnI7v, Manage fDB9dvs1qPPVt9Sp. The status tool points to 4DFFCk60exrzaIl6; support to KqSuGxCHixc6fsiu. These are not a trusted Store RLS Commerce engine.
- Rich UI candidate X0MwwQ7LRUqfOVjM is INACTIVE; 5 nodes, Manual Trigger, Synthetic Shop A catalog, Tenant Gate, Offline Rich UI Proposal, Terminal No Send assertion. Preserve it; do not silently promote to Published.
- Status and support workflows 4DFFCk60exrzaIl6 and KqSuGxCHixc6fsiu are ACTIVE. No changes.
- Recent Messenger Published executions 2239–2246 were successful webhook executions, latest #2246 at 2026-11-11T11:50:42.706Z. This confirms historical webhook execution metadata, NOT a new live Messenger test or verified current Page token/grants.
- V14.4.6 previous QA workflow BAOYcw4U9VCkSMdX remains INACTIVE; separate order/stock mock test execution 3861 8/8.
- New V14.4.8 manual QA jeLqAGOlG06LanDv is INACTIVE, folder 90_QA - DIAGNOSTICS, no assigned credentials, 3 nodes; manual execution 3862 successful, eight output items all PASS.

## 2. Current Supabase staging baseline — VERIFIED read-only

- Ref ifxlvrhyjhbzbrkdsida, PG 17.11, public.products=2 and public.orders=2.
- Canonical public.stores and public.store_memberships ABSENT.
- 6 old PERMISSIVE tenant SELECT policies remain, so real same-tenant Store A/B RLS acceptance is NOT POSSIBLE yet.
- V14.4.6 PostgreSQL 17 CI tests REAL atomic order transaction semantics but only in disposable ephemeral database with synthetic identities; NOT a migration or signed Auth validation.
- Local operator backup TOC readable, but isolated restore drill DEFERRED and UNTESTED. Required before hosted Store/RLS migration.

## 3. Feature status and required linkages

| Feature | Current observation | Can user test now? |
|---|---|---|
| Messenger AI consultation on legacy DEMO | Present in existing active workflow | Historical webhook success; new live 4-case verification still pending |
| Product quote / stock | Google Sheets DEMO in Published | Offline synthetic 4-flow QA available |
| Order request confirmation | Existing DEMO tools; no canonical Store Order core | Offline synthetic only |
| Order status + support | Active tools | Offline synthetic only for new multi-Store scope |
| Owner notification | Existing notification staging outbox variants | No authorized true owner send in this release |
| Rich UI | Inactive V13.6M candidate | Offline source/mock, no real Meta visual acceptance |
| Store A/B same tenant | V14.4.6 disposable PG17 fixture | No hosted JWT acceptance |
| Real Messenger Page owner QA | Existing Published Messenger historical webhook exec | Page token/role/permission verification not completed this turn |

## 4. Critical integration hazards

P0: Published Messenger still calls Google Sheets DEMO order writer. Never route multi-tenant SaaS orders into DEMO or reuse DEMO credentials/Products/Orders. Do not redirect Published toolWorkflow nodes.
P0: No canonical Page→Tenant→Store binding or live scoped JWT acceptance is verified on Supabase staging. Existing Messenger Page sender ID is not an authorization grant for customer Orders in a multi-Store Commerce database.
P0: Do not interpret a JavaScript mock's synthetic branded envelope as Meta signature verification. Real webhook must verify raw bytes with X-Hub-Signature-256 and App Secret, enforce replay and resolve Page server-side before trusting payload.
P0: Owner notification must be downstream of durable successful Order Request commit and idempotent Outbox; currently only mock event exists in offline lab.
P1: Draft/Published divergence in legacy n8n Create/Manage/Revenue workflows must be independently considered before any migration.
P1: Messenger Rich UI candidate requires payload limits/postback/permissions and actual Page UI visual checks. Fallback to safe text.
P1: Current Meta developer policy includes permissions and messaging window rules. Do not send without Page owner authority and a user-initiated eligible conversation.

## 5. Next safe implementation

Build V14.4.8 offline four-flow transcript tests with synthetic Page A/B/C and no network. Integrate proposed mock outbox only after in-memory request persistence. Keep real Meta send, production webhook and hosted migration explicitly blocked. Test credential-free manual n8n QA and github offline Node + disposable PG17. Once owner provides explicit separate authorization to connect a QA Page and provider permissions are independently verified, prepare V14.4.10 real Page readiness and a narrow live pilot only for tester accounts.

Rollback this phase: revert/close Draft source branch. New standalone inactive n8n lab may be archived ONLY with separate owner approval. Existing production/published pathways unchanged.
