# TIEN404 AI — V13.4 REVISED / SALES SAAS TIERED PACKAGES

**Date:** 2026-11-15 JST  
**Release status:** EXPERIMENTAL; no Candidate approval, no production deploy.  
**Branch:** `work/v134r-sales-lite-packages-staging`  
**Base:** `work/v134-sales-lite-multichannel-contracts-staging` PR #70 HEAD `e5bec2c8be4dd5c10cd7d64574a496f4f66638ba` at branch creation.  
**Related:** PR #41 Owner, #52 Customer, #67 Menu, #68 Portal, #69 secure integration, #70 multichannel. All remain Draft/open at starting audit.

## Purpose / revised architecture

TIEN404 is a **multi-channel AI Sales SaaS**, not a Zalo Bot reseller. A single Sales Core handles verified shop catalog, customers, order requests, notifications and reporting. Channel adapters (Website Chat, Messenger, Zalo Bot, Zalo OA) and Merchant/Owner surfaces remain independent.

**Three plan codes:** `SALES_LITE`, `SALES_PLUS`, `SALES_ENTERPRISE`. These are **design contracts**, not live Billing records. Lite 199,000 VND/mo and Plus 349,000 VND/mo are hypotheses; Enterprise quote-only. No AI or support unlimited claim.

### Plan policy matrix — proposed, not activated

| Capability | Lite | Plus | Enterprise |
|---|---|---|---|
| Authenticated single-shop customers/orders (read and manage entitlement; writes separately gated) | Yes | Yes | Yes |
| Basic reports, default bot, owned-channel connect request | Yes | Yes | Yes |
| Default catalog read, customer and order scopes | Yes | Yes | Yes |
| Menu/bot content customization drafts | **No** | Yes, DRAFT_ONLY | Yes, DRAFT_ONLY |
| Advanced reporting entitlement | No | Yes | Yes |
| Zalo OA integration | No | No | Contract + provider permission |
| Multi-store, staff, enterprise support | No | No | Contract-gated |
| Direct product editing entitlement | **UNDECIDED / NOT GRANTED** | NOT GRANTED | NOT GRANTED until approved |
| Internal AI Studio access | **Never from plan alone** | Never from plan alone | Never from plan alone |
| Native Zalo buttons and OA capabilities | UNKNOWN | UNKNOWN | Provider-specific verified only |

**Rationale:** Lite must be a *sales-management product*, not only chatbot replies. A Plus merchant receives only narrowly scoped customization, not unrestricted Agent/Studio rights. Enterprise does not get OA/multi-store privileges solely from a displayed subscription label.

## Implemented, offline/staging only

- `qa/sales-lite/v134r/plan-catalog.json` is the single research-only public plan manifest used by backend contract and Merchant UI preview.
- `qa/sales-lite/v134r/merchant-entitlements.cjs` evaluates permissions using injected **server-verified** session, active membership, server-selected tenant/store and authoritative subscription. Feature flags derived from browser, client roles and query strings are ignored. Stale, revoked, cross-shop or expired state **fails closed**.
- Enterprise conditional features require a verified, active tenant/store-bound contract. `zalo_oa.integration` additionally requires a provider-authorized OA capability. No token read or provider sends.
- `qa/sales-lite/v134r/enterprise-oa-contract.cjs` produces a **read-only readiness proposal**, explicitly separates OA from Bot Creator and refuses unverified shop or OA ownership.
- Existing `qa/sales-lite/v133/account/index.html` now contains a **three-plan comparison panel within its Subscription tab**. It is research-only, uses same-origin Access cookies to fetch the manifest, no session tokens or mutation; it does not confer real entitlements.
- **No extra Dashboard** was created; V13.3 Merchant Portal remains the single merchant UI. Current UI still lacks hosted customers/orders backend.
- QA files: `merchant-entitlements.test.cjs`, `enterprise-oa-contract.test.cjs`, `v134r-browser-qa.cjs`; standalone CI `.github/workflows/v134r-sales-packages-qa.yml`.

## Security boundaries and business rules

- Verified chain: session -> active membership -> server-selected shop -> subscription -> plan permission -> *additional transactional authorization* for writes.
- Permission `orders.manage_shop` is **not** approval to write or modify a real order. Real write requires backend authorization + transaction + idempotency + owner/customer confirmation.
- Plus's `menu.customize` and `bot.customize` are **DRAFT_ONLY**. No provider menu publish and no changes to system prompt safety guard.
- Enterprise OA requires ownership authorization and independent provider capability verification, separate from personal Zalo Bot Creator; credentials and sends disabled.
- Missing subscription/contract/provider/identity -> DENY. A user changing the plan selector does not change backend authorization.
- Supabase `public.qa_shop_b_zalo_claim` SECURITY DEFINER with `anon EXECUTE` remains a previously verified P0 audit concern. No ACL or SQL change.
- Existing hosted Auth API `GET /api/sales-lite/me` and signed JWT Shop A/B/RLS still require integration/real QA.

## QA acceptance and evidence

At the time of document creation, code and QA workflows have been added. **Do not claim PASS until the final HEAD GitHub Actions run completes successfully.**

Required before promotion:
1. Source/negative QA Lite denial of Menu Designer; Plus draft-only; Enterprise provider+contract gates; Shop A/B negative scope, revoked/expired membership/subscription.
2. Browser QA existing Merchant Portal at 360, 390, 430, 768, 1280 px; plan display uses research labels, never grants rights or sends mutations.
3. Inherited V13.1–V13.4 regression PASS.
4. Hosted signed-session Shop A/B RLS, login and revocation; authoritative subscription reading and no cross-tenant records.
5. Full real Sales Core, notifications and paid revenue E2E with explicit separate approvals.

## Scope and rollback

- Source-only changes on an isolated stacked Draft branch. No credentials, n8n Published versions, RLS, token, billing, customer/merchant record, Zalo/Messenger send, Cloudflare production or paid service changed.
- Rollback: close/revert the new Draft PR. PR #70 and all upstream PRs remain unchanged.
- Any real product activation requires owner approval of access/policy/DB and commercial release.

## Recommended next checkpoint

**V13.4R.1 — Merchant hosted integration:** Inspect existing Render Auth/Data in a user-confirmed workspace; connect verified shop customers/orders + `/api/sales-lite/me` read-only; test hosted A/B RLS. Separately review privileged RPC callers before any privilege change. Do not expand Studio or launch a shared discovery bot before a secure sales pilot.
