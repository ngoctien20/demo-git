# TIEN404 AI — V14.5Z-LIVE-01 LIMITED REAL AI UAT CHECKPOINT
**Checkpoint date:** 2026-11-15 JST
**Owner request:** proceed V14.5Z-LIVE-01 limited real AI pilot
**Status:** REAL_AI_MODEL_PREVIEW_TESTED / LIVE_ZALO_NOT_AUTHORIZED / NO SEND
**Branch:** work/v145z-live01-limited-uat-gate, stacked on V14.5Z PR #100
**Production:** DO NOT MERGE OR DEPLOY

## 1. Verified read-only baseline
- Active Zalo Bot Creator webhook: n8n `yIJk8LvJoLF40Z62`, active 10 nodes, header-protected and ACK-only; exact published runtime not modified.
- Private Customer Router: `sIPs6egzIwOY1GNv`, active 6 nodes; synthetic Shop B readback, preview only, no provider sender.
- AI Intent Draft: `uGesZLvNkhY4ZO6l`, inactive; execution 3665 prior real model intent classification, NOT real Zalo reply.
- Zalo one-shot send quota from V13.7 already consumed; cannot reuse prior approval.
- Existing Supabase staging hosted Store RLS and PostgreSQL isolated restore unverified, so live commercial catalog/orders remain blocked.
- GitHub V14.5Z PR #100, 28/28 adapter plus 44/44 V13.8 conversation tests succeeded.
- n8n preferences honored: DEMO data and credentials are isolated; no changes to Published workflows.

## 2. Created new manual real-AI QA workflow
- Workflow `OMV22pdETQFVU9ru`, `TIEN404_V145Z_LIVE01_REAL_AI_MANUAL_QA_NO_SEND`.
- URL: https://ngoctien20.app.n8n.cloud/workflow/OMV22pdETQFVU9ru
- Location: Personal project → `90_QA - DIAGNOSTICS`.
- Inactive, manual trigger, 5 total nodes: synthetic fixture → AI Agent + Gateway-managed OpenAI chat model → sanitized no-send preview.
- Gateway-managed credits were automatically assigned to the **new QA workflow's model node**; no existing webhook, secret value or production credential was modified.
- No Zalo sender node, no webhook trigger, no Orders/Products data table write, no customer PII.
- The fixture F01 = fictional "Áo thun QA mẫu", price 199000 VND, stock 5. It is NOT a verified real merchant record.

## 3. Actual model execution evidence (NO ZALO SEND)
- n8n workflow `OMV22pdETQFVU9ru`, execution **3841**, manual, **SUCCESS**.
- Execution timing 2026-11-15T14:57:49.447Z – 14:57:53.608Z.
- AI Agent ran an OpenAI gateway model and returned: "Chào bạn! (Thông tin QA mô phỏng, không phải cửa hàng thật.) Mã F01 là Áo thun QA mẫu, giá 199.000đ, tồn 5 chiếc."
- Execution trace: estimated token usage 156 input + 42 output = 198 tokens. This is a token usage estimate, not a measured invoice cost or agreed future budget.
- Final sanitized audit node: status REAL_AI_MODEL_PREVIEW_ONLY, `model_called=true`, `provider_sends=0`, `orders_written=0`, `stock_changed=0`, `webhook_modified=false`, `live_zalo_verified=false`, `ready_for_send=false`.
- **Do not confuse:** one real synthetic model response DOES NOT prove real Zalo ingress, 3-turn memory, provider delivery, staff handoff, or multi-shop hosted Store RLS.

## 4. Source-only bounded pilot security gate
- `qa/zalo-live-v145z/live01-preflight.cjs`: HMAC-SHA256 grant verification using server-injected secret, 10-minute upper bound, max 3 responses, max 3 model calls, max 2500 tokens, one signed Bot/tenant/store/recipient digest, forbid Orders and real catalog.
- Mandatory security evidence: Bot Creator ownership, protected webhook, independently issued Bot→Store binding, private QA recipient, durable replay, ordered session, hard quota, kill switch, owner approved budget, separately approved provider dispatch.
- **Important:** source-only contract requires an authoritative server to supply real proofs. Attacker-supplied JSON booleans or arbitrary 'verified' values are NOT proof. No production gate has been integrated with a real authenticated backend.
- `assess()` deliberately returns `can_send:false`, `provider_request:null`, `provider_sends:0` even when all fixtures indicate ready; it contains no sending implementation.

## 5. Acceptance gates remaining
- Verify Zalo Bot Creator ownership and exact current getWebhookInfo/getMe via approved read-only channel, with token never exposed.
- Identify and validate ONE owner QA recipient from private allowlist; do not post raw recipient ID to GitHub/chat.
- Wire **a server-issued** immutable Bot→Tenant→Store binding to real webhook, not client-asserted source markers.
- Build/verify durable event claim, per-chat ordering/CAS, idempotent outbox, quota & cost enforcement, emergency disable.
- Perform a specific owner approval of exact Bot, recipient, cap, time window and spend limit; live dispatcher still requires separate rollout review.
- Only then send bounded test replies and collect provider message IDs plus owner phone receipts. Need 3 sequential real messages to claim AI_MULTI_TURN_VERIFIED.
- Hosted Store RLS remains required before using real multi-store products, customer or Orders records.

## 6. Proposed approval envelope, NOT YET AUTHORIZED
- Bot: existing verified Shop B Bot Creator QA only, exact identity to be read back.
- Recipient: previously paired verified QA owner account only, exact digest verified privately.
- Window: 10 minutes from explicitly approved activation.
- Max responses: 3; max model calls: 3; model token ceiling: 2500 total.
- Synthetic store/cat: one Shop B fixture; zero real order writes, zero inventory mutations, zero customer data writes, zero notifications to others.
- Expired/unverified/duplicate/out-of-quota events must fail closed.
- Global `ZALO_SEND_ENABLED` remains false; no published webhook mutation or general send switch allowed.

## 7. QA and rollback
- GitHub CI for this new branch must be inspected after PR creation; never claim tests passed from committed files alone.
- No staging Supabase writes; no actual Zalo dispatch or real-message reception occurred in LIVE-01 so far.
- Rollback source: close draft PR / remove new branch; rollback n8n: keep inactive or archive only new workflow `OMV22pdETQFVU9ru` after owner's approval. Existing Zalo webhook and Private Router remain unchanged.
- For safety in case of unexpected live behavior: keep outbound general gateway locked and do not connect QA model to a public webhook without separate approval.

## 8. Next single decision
Present exact bounded QA recipient/Bot and budget cap to owner for explicit approval; only after verified hosted security prerequisites and a distinct release gate may the limited outgoing Zalo pilot be enabled.
