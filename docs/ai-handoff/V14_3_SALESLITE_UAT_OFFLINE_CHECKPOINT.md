# TIEN404 AI — V14.3 Sales Lite User Acceptance Pilot (Offline)
**Date:** 2026-11-15 JST. **Lifecycle:** EXPERIMENTAL / DRAFT / TESTABLE OFFLINE / NO SEND.
**Base:** PR #94, SHA 02c480d6925234631a94c9ad1c5b705b07c4128d.
**Branch:** work/v143-saleslite-uat-standalone-pilot-20261115.

## Objective
Give the shop owner a manual test that can be opened immediately on Windows/Mac/phone as a self-contained offline HTML file, without needing an unapproved hosted Store/RLS migration or a Meta/Zalo token. This is a **manual UX simulation of TIEN404 Sales Lite**, not a live backend. Reuses V14.3 three-shop profiles and preserves the existing Staff/Widget source.

## Implemented
- `qa/channel-v143/saleslite-uat-pilot.html`: standalone, responsive Vietnamese Shop A/B/C customer + owner simulator. Each shop has separate synthetic catalog, cart, order requests, shop pause and mock completed revenue. The customer must explicitly confirm a QA order; no stock deduction, external API, real AI model, real person data, persistent storage or sends.
- `qa/channel-v143/saleslite-uat-pilot.browser.cjs`: Playwright QA at widths 360/390/430/768/1280, shop isolation, order lifecycle, price injection refusal, owner pause, XSS-safe rendering, reset and zero outbound traffic.
- `.github/workflows/v143-saleslite-uat-pilot-qa.yml`: separate Draft CI test and screenshot artifact.
- A verified identical offline HTML was delivered to the owner as a conversation download. No deployment required for this type of trial.

## Current verified infrastructure
- Existing Messenger Published n8n `Z7FdV7uDvApfbURQ`: active, version `d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92`; untouched.
- The V14.3 Widget Lab in PR #94 already has three-shop staff and iframe QA but no real connected AI gateway, live Messenger or hosted Order Core.
- Supabase staging still lacks canonical `stores`, `store_memberships`, `products.store_id` and private Page bindings. Its replay event store is not approved or migrated.
- Cloudflare Pages `tien404-ai-git-staging` has preview deployment records for Draft branches but the inspected preview stage is still `queued/idle`, not verified externally available. Do not advertise a live pilot URL before GET browser QA confirms.
- Separate V13.6M.7 PR #95 has disposable PostgreSQL atomic QA but does NOT authorize hosted RLS or provider send.

## QA evidence
- Local Chromium 144 smoke: **5 responsive viewports PASS**; add product, confirm QA order, owner sees exactly own-shop order, Shop B sees no Shop A order, mock revenue after marking done, shop paused blocks new order, markup injection shown safely, no JS errors, zero network requests and no horizontal overflow. Additional Shop C, price spoofing and reset PASS.
- **TESTED GitHub Actions:** [run 43718756040](https://github.com/ngoctien20/demo-git/actions/runs/43718756040) SUCCESS on source HEAD 584809caac6d454f6364a9a351865b6ea0628eb0. Chromium Playwright 5 responsive viewports plus Shop C price/refusal/reset PASS; zero cross-shop order leaks, zero external network requests, no browser JavaScript errors, static no-credential/no-storage/no-send security gate PASS. Screenshot artifact uploaded. Keep distinction between offline UI and hosted Messenger/Supabase acceptance.
- No real user JWT, Meta delivery, Zalo notification, AI inference or Supabase write was attempted.

## One-minute owner test
1. Download and open `TIEN404_SALES_LITE_DUNG_THU_OFFLINE.html` in Chrome/Edge.
2. Choose Shop A. Add Gạo túi 5 kg, click Create request, confirm QA, switch to **Chủ shop**. Expect order `QA-A-001`.
3. Switch Shop B, Owner. Expect **0 orders**. Go back to A, mark order completed. Expect mock revenue 125.000đ.
4. Turn on **Tạm nghỉ**, switch to Customer. Adding product and new checkout are blocked.
5. Click **Xóa dữ liệu thử**; all shop data clears. This data exists only in browser memory.

## Security and release boundaries
- Do not enter actual PII, do not use this as a customer storefront or published chatbot.
- The three-shop isolation here is **in-memory UI state**, not hosted Supabase RLS or server-side auth.
- Real Messenger/Zalo/Website AI trial requires separate approval and P0 gates: restorable backup, V14.2 Store/RLS with owner/JWT proof, owner-approved Page/Widget installs, durable replay and outbox, provider permissions and restricted staging traffic.
- Existing V14.3 files, published workflows, production website and credentials were not altered.

## Rollback
Close the new Draft PR; revert the additive HTML, QA script and workflow. Parent PR #94 remains unchanged. No database restore or Meta recall required.

## Next priority
Obtain owner feedback from the working pilot: which flow is incorrect, what owner/shop information is missing, how order confirmation should behave; then prioritize **real hosted RLS/backup** and a bounded single-shop staging integration without sending customer messages until approved.

## Acceptance / checkpoint
- **VERIFIED:** project stays on independent V14.3 Draft lineage, does not modify published n8n, production Pages, credentials or Supabase.
- **IMPLEMENTED:** owner-operated offline Sales Lite Lab and additive GitHub sources, test.
- **TESTED:** local Chromium 144 in 5 widths; GitHub Actions #43718756040 SUCCESS.
- **BLOCKED:** hosted Shop RLS/real JWT, actual AI inference, real Page binding + Messenger send, Supabase real orders/stock, durable replay. Requires owner approvals.
- **Rollback:** close Draft PR #96; parent PR #94 unchanged. The local HTML is a standalone user artifact and cannot cause DB mutation.

## Owner acceptance — 2026-11-15 JST (user-confirmed)

**OWNER ACCEPTED / UAT OFFLINE UI FLOW**. The owner explicitly accepted this Sales Lite pilot after using its locally opened HTML in the Cốc Cốc browser, as shown by an owner-provided screenshot in the conversation. Screenshot review supports the following observed facts only:

- Selected synthetic Shop A, **Tạp hóa An**, in **Chủ shop** mode.
- Order **QA-A-001** visible with SKU **QA-A01 × 1** and displayed total **125.000 ₫**.
- Order badge shows **Đã hoàn tất (QA)**; waiting-order count shows **0**.
- Mock revenue from completed QA orders shows **125.000 ₫**.
- The UI identifies itself as simulated, no API, with fictional products/orders.

**Acceptance boundary:** This is owner's acceptance of the **local/offline three-shop Sales Lite UX and mock order-management flow** only. The user screenshot does NOT independently prove hosted multi-tenant RLS, Page ownership, Messenger/Zalo sending, AI inference, real price/stock, authenticated staff, durable orders, or recovery. Automated Shop A/B isolation and 5 viewport checks were previously verified separately by GitHub Actions #43718756040. Do not mark those as human-observed from the screenshot. The screenshot contains browser/account context and is intentionally **not uploaded** to a public GitHub repository.

**Release state:** UAT_OFFLINE_OWNER_ACCEPTED; DRAFT_NOT_MERGED; HOSTED_P0_BLOCKED; REAL_PROVIDER_SEND_NOT_APPROVED. No changes to n8n Published, Supabase, credentials, payments or customer records. No promotion to production/Core Bot.

**Next safe engineering gate:** prioritize V14.2 backup/restore evidence + Store ownership/RLS before a hosted, single-shop, no-send candidate, followed by separate explicit bounded Meta/Zalo pilot approval. Close PR #96 to roll back the additive source-only UAT pilot.
