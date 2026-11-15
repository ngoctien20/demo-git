# TIEN404 V13.5 — PRODUCT SCOPE (2026-11-15 JST)

**Authoritative scope:** V13.5 Revised provided by owner, superseding the narrower PR #73 account-only interpretation where they conflict. Product is multi-channel AI SALES SaaS; Zalo is a channel and AI Studio is **FUTURE — PRESERVED**.

## Actual customer-facing responsibilities
- **Customer Account Portal:** Overview; own-shop order read/status and, after independent backend QA, controlled owner order handling; shop payment/revenue verification; TIEN404 service billing; subscription; profile/security; support; read-only channel health as needed.
- **No customer catalog/Bot editor:** No direct Products/Prices/Stock editing, prompt/menu/webhook/token edits, cross-shop CRM, system users, internal QA, or Studio. Data still exists on backend.
- **Staff Console:** TIEN404 staff deploy/manage shop-specific catalog, bot/menu, channel, ticket, technical order support only with independent time-bounded assignment.
- **Admin Platform:** users/tenants/subscriptions/channel registry/audit and staff assignments, without automatic owner role.
- **Platform Owner:** executive audit, release approvals, staff security, costs, incident oversight with MFA, least privilege and no raw secret display.

## Plans: hypotheses, not live Billing
- Lite: base AI Sales Core, shop orders, owner notification, basic reporting and TIEN404-managed onboarding. Proposed 199,000 VND/month.
- Plus: Lite + TIEN404 staff-managed custom greetings/menus/content via request/review, **no unrestricted merchant bot editor**. Proposed 349,000 VND/month.
- Enterprise: contract-bound multi-store/team, Zalo OA only with verified provider rights, custom integrations/support; quote-only.

## Single Sales Core
Website Chat, Messenger and Zalo adapters -> provider authentication -> trusted bot/channel-to-shop resolver -> subscriptions -> shared Sales Core -> transactional order request/owner notifications -> shop-owned records/RLS -> authorized Merchant.
Never infer tenant ownership from browser fields or channel usernames.

## V13.5 implementation slice
PR #73 is the audited authenticated customer account base. V13.5 adds a **strict read-only Orders panel** (own selected shop, owner/manager membership, RLS and tenant readback) without order writes. The payment state displayed by an order is not verified financial settlement. Reuse existing Render Auth; no duplicate Auth/CRM website.
