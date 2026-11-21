# TIEN404 AI V14.3 — UNIFIED CHANNEL EXPERIENCE / WIDGET LAB

**STATUS: EXPERIMENTAL / SOURCE + QA, NO LIVE MESSAGING, NO CUSTOMER INSTALL.**

## Product scope

TIEN404 remains a MANAGED MULTICHANNEL AI SALES SAAS. Zalo, Messenger, and a website AI Chat Widget reuse Shop Knowledge, Sales Core, Commerce Core, and Conversation Core.

The Website component is ONLY a chatbot embedded into an existing merchant website. There is NO Website Builder, storefront factory, merchant-site CMS, checkout, or self-service AI Studio.

## Implemented in this branch

1. Channel response contract: qa/channel-v143/channel-core.cjs — validates an explicitly trusted server-derived tenant/store/channel scope, published public Knowledge, trusted current catalog SKU/price/stock, and no-send response intents.
2. Messenger adapter bridge: qa/channel-v143/renderers.cjs — calls the pre-existing V13.6M signed carousel and Quick Reply primitives, not a new incompatible renderer. Fallback text also supported. ALL outputs are preview-only.
3. Website private gateway contracts: qa/channel-v143/widget-gateway.cjs — exact domain allowlist, private verified install, anonymous HMAC session, reviewed theme. It does NOT deploy an online gateway, query DB, authenticate customers, rate limit or create a hosted replay ledger.
4. Website demo: qa/channel-v143/widget/embed.js + frame.html + host.html — isolated embedded iframe Widget; explicit qa-offline mode, three synthetic brand names, no network or AI/Orders calls. host.html is only a fixture proving integration into an existing-looking site, NOT a merchant website service.
5. Staff preview UI: qa/channel-v143/staff.html — three shop fixture previews, Messenger product cards, Widget in a website sample, clear NO SEND status.
6. Node contracts: qa/channel-v143/channel-core.test.cjs — 36 security/behavior scenarios, including cross-store, fake scope, fake price, action spoof, token/session tamper, Knowledge Draft blocking, and no external sends.
7. Browser test: qa/channel-v143/browser.test.cjs — five viewport widths and iframe embed.
8. Manual n8n QA source: qa/channel-v143/n8n-v143-offline-sdk.mjs, workflow KjcnFcdg3lDQcZyW in Personal / 90_QA - DIAGNOSTICS, inactive, manual trigger + two Code nodes, NO HTTP, credentials, storage or order writes. Execution 3838 PASS 13/13, 0 provider sends, 0 Orders writes.

## Baseline verified before writing

- Published Messenger Z7FdV7uDvApfbURQ: 27 nodes, version d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92, still connected to AI_SALES_DEMO and one QA Page. Unchanged.
- Messenger Rich UI / Page-Store / replay chain is already in draft PRs #87–#92. V14.3 branch starts from PR #92 head 9aa08520525d746121194143e521a89393cd3988 and reuses that code.
- PR #86 (V14.2 Shop Onboarding / Store RLS) is a separate Draft on V14.1; do not assume hosted RLS implementation from its source-only proposal.
- Supabase staging public products/conversations/messages did NOT contain store_id during read-only inspection. No database migrations here.
- Existing Cloudflare, Render and Messenger production were left untouched. No Meta/Zalo API sends, credentials, real customer data, order mutation or payments.

## Trust contract and restrictions

- tenant/store/Page/PSID from customer body or LLM output is NOT identity; only server-verified mapping may authorize a readback.
- Prices and stock come only from the current verified catalog row under the same tenant/store. If missing, fail-closed or respond that price cannot be confirmed.
- Public Knowledge must be published and merchant-approved. Draft/STAFF_ONLY/RESTRICTED is forbidden as customer-facing context.
- Messenger Postback needs exact raw body Meta HMAC verification, trusted Page/PSID binding, signed actions and hosted durable replay before live sends. Page permissions and conversation window are not inferred.
- Public Widget ID + Origin/Referer are NOT human authentication; production must verify domain ownership, active entitlement and origin, issue a tightly scoped session, control abuse/rate, authenticate any private order lookup separately, and use hosted durable event ledger.
- The QA Embed SDK only works with an explicit QA flag and synthetic shop identifiers. It is not a production install script. The iframe QA composer is sandboxed; CSP form-action and connect-src disallow external access.

## Releasing to real shops: P0 BLOCKED

1. Hosted canonical Store model/RLS isolation for same-tenant and cross-tenant shops, authorized staff memberships, trusted private Page registry and domain/install registry.
2. Meta App Review/rights for multiple Pages, verified Page owner authorization, current Send API policy, 24h window and Webhook subscriptions.
3. Durable outbox/replay and safe outbound; accurate live SKU/prices/stock and confirmation gate.
4. Widget hosted gateway, domain ownership proof, per-shop quotas/rate limiting, CSRF/session control, retention/privacy/accessibility, CSP/third-party CMS tests.
5. Real Staff Inbox auth/handoff and AI suppression during human control.
6. No real Messenger or Zalo sends until a separate bounded authorization.

## QA commands

- Node source: node --test qa/channel-v143/channel-core.test.cjs
- Inherited messenger: find qa/messenger-rich-v136m* -name '*.test.cjs' ! -name 'preview.test.cjs' -print0 | xargs -0 -r node --test
- UI: start python3 -m http.server 8080; run node qa/channel-v143/browser.test.cjs after installing Playwright Chromium.
- Open QA UI: /qa/channel-v143/staff.html
- Open synthetic host: /qa/channel-v143/widget/host.html?shop=qa_shop_b

## Commercial evaluation

Keep Lite/Plus/Enterprise as product concepts without changing prices. Measure integration time, AI cost per chat, Meta support costs, widget theme setup minutes, actual hosting/AI usage and support ticket volume per shop before publishing a commercial tariff. Separate initial setup/custom styling fees from recurring core AI subscription.

## Rollback

Close/revert the V14.3 Draft PR; archive only the isolated inactive QA workflow after independent approval if necessary. No rollback of production/DB/credentials is necessary for this source-only change. Do NOT delete V13.6M Messenger or V14.2 Store/RLS work.
