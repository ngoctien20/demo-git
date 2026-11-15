# TIEN404 AI — SALES LITE V1.1 V13.1 Staging Checkpoint

**Thời điểm:** 15/11/2026 JST. **Sản phẩm:** TIEN404 SALES LITE V1.1.  
**Trạng thái:** EXPERIMENTAL, **Menu & Operations Candidate in GitHub staging only**. Không live menu, không gửi tin, không ghi Orders, không merge production.  
**Nhánh mới:** `work/v131-sales-lite-menu-staging`, xuất phát từ baseline `work/v12-r1-shop-owned` SHA `9875f15ffe6dcf80c4c76aec4cb150d518d159fb`.  
**Draft PR:** [#67](https://github.com/ngoctien20/demo-git/pull/67). Không merge #41/#52.

## 1. VERIFIED — Checkpoint và hệ thống trước/sau

| Component | ID/version cuối đã kiểm | Trạng thái |
|---|---|---|
| GitHub Owner PR | #41 HEAD `2ce3eeb046b317b3ea1ec3e70e617b843a2e8881` | OPEN DRAFT, không sửa |
| GitHub Customer PR | #52 HEAD `6277c5af6664bc5a8fa16d648be64c3672bfa5d6` | OPEN DRAFT, không sửa |
| n8n Zalo V1 ingress | `yIJk8LvJoLF40Z62` / `8ca4a6f6-ab3f-42f1-8637-d4f5db790a3e` | ACTIVE, không sửa |
| n8n Customer Router | `sIPs6egzIwOY1GNv` / `8d91d23c-cd87-462f-a112-9cca2340bec8` | ACTIVE, không sửa |
| n8n Owner Shadow | `OgDZNSAvKEvhnAvn` / `f00ba506-c52a-4340-9a0c-809fd9c6ea9a` | ACTIVE, không sửa |
| n8n Reply Guard QA | `nKNKDLO4l2PXL4tx` / draft `48d0e00c-3b3a-42ca-8551-ae7de6410f44` | INACTIVE |
| n8n AI Intent Draft | `uGesZLvNkhY4ZO6l` / draft `27f8744a-229a-4da3-9ccf-1325e2d1cf89` | INACTIVE |
| n8n Commerce Sandbox | `iyfGUiEsZlNTBWOR` / draft `ddc3ce5b-365e-47e2-a06d-08daffceb9a8` | INACTIVE |
| Supabase staging | `ifxlvrhyjhbzbrkdsida` | ACTIVE_HEALTHY, không migration V13.1 |
| Cloudflare Zalo Worker | `ef7b7a33-5551-48e0-954b-646c047b5c6d` | `ZALO_SEND_ENABLED=false` |
| NEW n8n Menu Smoke QA | `2JUqVjPToWUmLfPL` / `d7ac8f92-ffe7-4502-8349-a05040473e88` | INACTIVE, no credential |

**Supabase readback:** Shop B `F01` 199000 VND/stock 5; 2 sandbox orders; 2 outbox `HELD`; `0` non-HELD. Private Shop B sessions `0`, receipts `0`. Không có thay đổi Supabase/Orders.

## 2. OFFICIAL PROVIDER AUDIT — verified vs unknown

- [Zalo Bot Overview](https://docs.zaloplatforms.com/docs/BOT) quảng bá nút, quick reply, carousel ở mức khái quát.
- [Zalo Bot sendMessage](https://docs.zaloplatforms.com/docs/BOT/apis/sendMessage): công bố `chat_id`, `text` (1–2000), `parse_mode`, `text_styles`. Không có schema payload nút bấm/callback trong tài liệu đã kiểm.
- [Zalo OA Menu](https://oa.zalo.me/home/documents/vie/guides/thanh-menu_29) chính thức có menu, link, gọi điện nhưng là sản phẩm OA và cần gói dịch vụ phù hợp, không phải Bot Creator.
- zBusiness Basic không được coi là quyền mặc định Bot interactive menu hoặc OA OpenAPI.
- Ma trận đầy đủ: `docs/ai-handoff/V13_1_ZALO_MENU_CAPABILITY_AUDIT.md`. Native Bot buttons/quick reply/callback **UNKNOWN**, not UNSUPPORTED and not PROVIDER_TESTED. Fallback text menu **MOCK_TESTED**; Bot text primitive **OFFICIALLY_DOCUMENTED**.

## 3. IMPLEMENTED — GitHub source

- `qa/sales-lite/v131/menu-registry.json`: 17 hành động ID ổn định (Customer 6, Owner 7, TIEN404 Support 4), required permissions, confirmation, idempotency, channel capability and fallback commands.
- `qa/sales-lite/v131/menu-engine.cjs`: Registry, TemplateService, ActionRouter, Renderer, PermissionGuard, QA SessionManager, Analytics, ChannelAdapter. Bắt buộc trusted backend context; Customer không giả Owner bằng text; menu button/callback real Zalo fail-closed. Role-local numbered text fallback. UI mock-only callback verifier.
- `qa/sales-lite/v131/business-contracts.cjs`: adapters to existing Customer Core `preview()` port (PR #52, **not connected**), Owner state transition proposals (PR #41, **not connected**), Notification HELD candidate after verified persisted order, support ticket draft, subscription read-only.
- `qa/sales-lite/v131/mock/index.html`: responsive phone mock, role Customer/Owner/Support, shared registry; role switch only frontend demo, **not authorization**.
- `qa/sales-lite/v131/mock/subscription-lite.html`: mobile-first website mock (login, shop, subscription, bot state, guides, support) with disabled payment and placeholders.
- `.github/workflows/v131-sales-lite-menu-qa.yml`: Node 22 no-network automated QA.
- `docs/ai-handoff/V13_1_MENU_ORDER_API_CONTRACT.md`: contracts, trusted resolver integration gates, state machine and responsibilities.
- `docs/ai-handoff/V13_1_MENU_AND_ORDER_QA_REPORT.md`: test evidence.
- **NEW n8n manual QA workflow** in Personal project folder `90_QA - DIAGNOSTICS`; Manual Trigger → Code, no credentials, HTTP, database or Zalo send nodes.

## 4. TESTED — Actual evidence

- GitHub [PR run **43665998817**](https://github.com/ngoctien20/demo-git/actions/runs/43665998817) at head `bafcf1c3d20db18cd4f63df4aa258dad5ceb47e4` **SUCCESS** (after files, docs and PR opened). [Push run **43665786546**](https://github.com/ngoctien20/demo-git/actions/runs/43665786546) job `132664707203`: exactly **116/116** Node tests pass, 0 failed, 0 skipped. Includes 68 Menu, 38 Business, 10 Mock UI.
- n8n workflow `2JUqVjPToWUmLfPL` manual execution **3809 SUCCESS** at `2026-11-15T01:58:37.653Z`; 16/16 synthetic smoke; `external_sends=orders_written=outbox_written=paid_model_calls=0`; no provider test.
- Existing published workflows and current Supabase state unchanged after new code/workflow.
- CI is unit/mock/fixture; **no actual Zalo button response or paid model tests** in V13.1.

## 5. Risks / BLOCKED

**P0 — Live native Zalo menu**: no verified Bot sendMessage buttons payload/callback schema; disabled. OA Menu cannot be substituted. Provider-specific test requires separate user approval for target, volume, cost and no webhook modifications.

**P0 — Runtime trust boundary:** the fixture `BACKEND_AUTHENTICATED_CONTEXT` flag in tests is not provider signature. Real ingress must derive Bot→Tenant→Shop→Role server-side with signed event; do not trust request body. Merge/coordinate Owner PR #41 and Customer PR #52 through explicit API contract. No collision or rewrite.

**P0 — Persistent state:** MenuSessionManager in-memory is single-process QA. Must use transactional receipt and SQL CAS in trusted store for multi-shop; current private Shop B store on Supabase remains inaccessible to new backend until backup/credential gate approved.

**P0 — Order engine & notification:** no live Order Requests, no total-paid evidence, no stock decrement and no Owner notifications. Notification candidate never writes and cannot prove delivery. `commit_order_qa` not invoked. No auto-replies.

**P1 — Subscription:** website mock is not a login/billing deployment; price hypotheses (Lite 199k, Plus 349k) are not active subscription prices. Payment/renewals blocked until approval.

**P1 — Support Bot:** ticket creation only draft; no real helpdesk created.

**P1 — AI budget:** zero paid inference calls; no hard 0.10 USD/10-call cap verified, so keep AI port disabled.

**P1 — Platform commercial feasibility:** Bot provider terms, quotas, zBusiness Basic entitlements, operational costs/support and unit economics not provider-verified.

## 6. COST

No verified new paid inference, provider messaging, Supabase migration, paid hosting or Billing operation. Existing GitHub Actions/n8n resources were used; platform-account charges were not independently inspected, so do not claim total cost exactly zero.

## 7. RELEASE GATES & APPROVAL

- [x] Audit current GitHub PRs, n8n published versions, Supabase staging data.
- [x] Bot API vs OA Menu documentation, conservative capability matrix.
- [x] Stable MenuRegistry + MenuTemplateService + ActionRouter.
- [x] Customer menu, Owner menu, Support menu and numbered-text fallback.
- [x] Mock frontend, callback guard, disabled send adapter.
- [x] Unit QA 116/116 and independent n8n QA 16/16.
- [x] Customer Core/Order Request and Notification Outbox contracts prepared without writes.
- [x] Cross-tenant and subscription negative tests in fixtures.
- [x] Draft PR #67 and rollback/checkpoint docs.
- [ ] Official interactive Bot callback/payload proof and provider permission.
- [ ] Runtime multi-shop signed resolver, persistent sessions/receipts and hosted RLS/E2E.
- [ ] Actual Customer Order save + Outbox after explicit confirmation.
- [ ] Owner action write, notification, Support Bot ticket persistence.
- [ ] Website login/subscription integration with verified backend.
- [ ] Commercial rights/quota + paid model hard cap + revenue economics.
- [ ] Owner approval to send test Zalo, to merge or to deploy production.

**Status:** `EXPERIMENTAL`. Menu & Operations code **IMPLEMENTED+TESTED**. Full commercial MVP **NOT APPROVED/NOT RELEASED**.

## 8. ROLLBACK & NEXT CHECKPOINT

1. Rollback code: close/revert changes on Draft PR #67 branch; it is independent of PR #41 and #52 and does not touch `gh-pages` or live application.
2. n8n new QA workflow is INACTIVE; keep as evidence. If retracted, disable/leave inactive, do not delete without approval. No live webhook rollback required.
3. No new database migration/credential/role; no Supabase restore needed from V13.1. Backup gate from V12.4 still applies before future backend secrets or RLS writes.
4. Next iteration recommendation: run provider-origin capability documentation escalation, build signed context adapter in isolated QA, integrate read-only Customer Core and Owner menu behind trusted resolver, then parallel hosted multi-tenant QA. Distinct approvals for provider send/Orders/production.

## 9. Product evolution options for Owner

- A. Validate native Bot interactive buttons/persistent menu with provider (documentation first; send test only after approval).
- B. Read-only Customer/Owner Menu integration in n8n QA with signed resolver and no outbound.
- C. Subscription Lite backend-to-website read-only integration while keeping billing disabled.
- D. Support TIEN404 ticket lifecycle mock and authenticated ticket port.
- E. Live commercial Pilot only after provider policy, QA, cost, send + order permissions explicitly approved.

**Avoid spending on full AI Studio/ERP Dashboard at this stage.**


## 10. Additional existing Reply Guard regression

On 15/11/2026, the existing n8n `TIEN404_ZALO_V124_REPLY_GUARD_QA_STAGING` (`nKNKDLO4l2PXL4tx`) was audited and manually executed **3810 SUCCESS**, `25/25 PASS`, `orders_written=0`, `external_sends=0`, `real_llm_tested=false`. This adds independent evidence that the prior read-only Customer reply safety logic still passes its own fixtures. It does **not** demonstrate deployed V13.1 Menu Engine integration or production E2E.

Commerce AI Sandbox was not executed due provider/LLM cost and nested-workflow side-effect risk. No direct testing of Owner Shadow Published workflow was performed in V13.1; it stayed unchanged.
