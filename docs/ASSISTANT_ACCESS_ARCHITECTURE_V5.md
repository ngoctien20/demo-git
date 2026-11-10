# TIEN404 AI V5 — Unified Public Chat & Secure Assistant Architecture

**Status:** DESIGN APPROVED FOR STAGING PROTOTYPE ONLY; no customer order permission or production backend was created. 2026-11-10 JST.

## Product decision

**One centrally managed assistant platform, different permission surfaces.** Do not give the anonymous marketing bot customer database access. Use three frontends/security contexts without necessarily running three separate model deployments:

| Surface | User | Primary job | Data authority | Access |
|---|---|---|---|---|
| Public Website Consultant | Anonymous visitors | Explain TIEN404 features, pricing status, demo, product advice | Approved PUBLIC knowledge | No credentials, order tools or real tenant data |
| Merchant Copilot | Authenticated TIEN404 subscribing store owner/staff | Help configure the merchant bot, inspect their own store's orders/usage, answer shop-specific questions | Server-validated tenant membership, role, subscription, RLS | Read-only first; writes require explicit confirmation, audits and per-tool authorization |
| Shopper Order Support | End-consumer buying from a merchant tenant's store | Track own order status, shipping, support request | Verified customer identity and order ownership within *one specific tenant* | Return minimal permitted information, no global order search |

**Clarification:** The TIEN404 **merchant** logging into the SaaS dashboard is not the same person as the **buyer** placing an order with that merchant. A merchant dashboard AI does not automatically verify the buyer. External channels (Messenger/website store widget) must establish a shop-scoped buyer identity independently.

## Current source truth
- Public floating widget is implemented only in index/demo production HTML; other marketing tabs lack it. A branch-only centralized loader `assets/website-chat-loader.js` is now included in 15 public marketing HTML pages; this is **not deployed**.
- `login.html` explicitly uses arbitrary email for browser-only demonstration. `dashboard.html` and checkout are also browser mock experiences. They CANNOT support authenticated order tools.
- PR #5 is a Supabase/RLS reference and read-only stage gateway; PR #2 is Super Admin FastAPI/SQLite reference. Neither is a live login backend. Do not connect one to production by assumption.
- The public Marketing AI `wgkkmT7q4lm4HyuA` is not a store-specific order agent. `AI_SALES_DEMO` tools use separate legacy Sheets and may write; never grant them to public users or Commerce.

## Public marketing widget V5
- Single source of mounting markup and initialization on public pages, not duplicated HTML fragments.
- Target 15 public marketing pages: index, demo, solutions, pricing, contact, industries, onboarding, about, FAQ, five industry details and impact.
- Explicitly exclude login/register/dashboard/billing/checkout and payment/account pages, to avoid promoting anonymous chat as authenticated help.
- Existing chat webhooks and native n8n transcript preserved; no credential or token is copied to front-end.
- QA release gate: browser renders on each of six primary navigation routes; Android night mode text visible, keyboard does not hide send button, chat opens/collapses, page scroll works, no extra widget mount, contact/links function, and safe fallback on chat error.
- A cross-page chat history guarantee is NOT established. Add tested session restore only if privacy and history retention policy permit.

## Secure post-login design (do not rush)
```text
Merchant dashboard / store support UI
     |
  Verified session and server-side identity
     |
  Role/tenant membership entitlement + verified channel ownership
     |
  Authorized API gateway, rate-limits, audit, per-tool policy
     |
  Read-only tenant-scoped data service / RLS
     |
  AI orchestration with tool outputs, not unrestricted DB credentials
```

All sensitive data is fetched by a backend **after** authorization. The model never receives database service keys. Supabase publishable keys are not authorization. The server derives tenant identity from verified session/token/channel mapping, not from chatbot text or an arbitrary user-provided `tenant_id`.

## Buyer order lookup example
1. Buyer accesses a specific shop's signed/tenant-scoped widget or verified Messenger channel.
2. They provide an order reference. The system responds neutrally, not whether an unknown order exists.
3. Buyer completes a short-lived, rate-limited verification challenge delivered to an independently verified phone/email or uses a previously authenticated customer account.
4. Backend verifies tenant ID + buyer identity + specific order ownership; logs access and enforces least privilege.
5. AI returns only permitted order status, eligible ETA if sourced, and safe support steps. No full address, phone or payment details exposed by default.
6. Any cancel/address change/refund requires dedicated authorization, business policy and explicit confirmation; no blanket AI write privilege.

Never accept order ID alone as proof of ownership. Avoid cross-tenant enumeration, leaking order existence, credentials, prompt-based authorization or reusing legacy DEMO sheets.

## Suggested internal gateway contracts (DESIGN — not active endpoints)

`POST /api/v1/ai/merchant/chat` — authenticated merchant session, verified role/tenant, server-allocated tools. Output response with policy metadata; tool calls are server-enforced and logged.

`POST /api/v1/shop/{shop_public_slug}/order-support/challenge` — request buyer verification with anti-abuse throttle and neutral responses; tenant slug does not constitute authentication.

`POST /api/v1/shop/{shop_public_slug}/order-support/verify` — exchange short-lived verification challenge for limited order-scope capability.

`POST /api/v1/shop/{shop_public_slug}/order-support/chat` — verified scoped capability only; minimal order fields, server-side auth and row security.

These are **proposed interfaces**, not deployed services, and must be reconciled with existing Sites/D1, PR #2 and PR #5 contracts before implementation.

## Phased delivery
- **Phase A (now):** unify anonymous marketing widget on all public product pages; QA on preview branch; no live customer data.
- **Phase B:** choose authoritative identity and persistent tenant/order database, integrate PR #2 and #5 after source audit and security tests; deliver authenticated merchant dashboard without AI tool writes.
- **Phase C:** add merchant Copilot read-only scoped product/order/usage lookup, verified tool traces and human handoff.
- **Phase D:** pilot shopper order-status support for one test tenant, verified identity, read-only, no real shipping/payment mutations; prove anti-enumeration and cross-tenant negative tests.
- **Phase E:** optional confirmed actions, e.g. address edit/ticket, with RBAC, explicit user consent, idempotency and audit.

## Release blockers
No real login provider/session, no authorized source for Sites/D1, no verified tenant data store, no identity bridge or provider-approved shopper verification, no real-device chat QA. **None of these should be marked Done by static website code.**

## Key acceptance criteria
- Anonymous marketing chat cannot call any authenticated or mutating data tool.
- Merchant owner from tenant A is denied access to tenant B even via prompt injection or forged tenant IDs.
- Buyer from order A cannot read order B (including another buyer in same tenant).
- Expired/replayed OTP/session/entitlement is denied; no difference in response timing/text that leaks order existence.
- No customer PII or secrets in front-end bundles, logs, public GitHub, error traces or AI prompts beyond minimum authorized facts.
- Human support and version rollback remain available.
