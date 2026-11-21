# TIEN404 AI — V14.3 UNIFIED CHANNEL CHECKPOINT
**Date: 2026-11-15 JST. Status: IMPLEMENTED/OFFLINE TESTED, OPEN DRAFT; hosted/live BLOCKED.**

## A. Product and scope

TIEN404 is managed AI Sales SaaS. A single Sales Core and Shop Knowledge/Commerce/Conversation core serve Zalo Bot, Messenger and a website AI Chat Widget. The website deliverable is ONLY the AI Chat Widget embedded into a merchant's existing site, NOT a site builder, storefront, checkout or full-site design service. Customer-facing AI Studio is OUT_OF_SCOPE; preserve internal QA and staff design tools.

The user submitted V14.3 implementation instructions as an attached paste, with safety gates on real sends, Supabase/credentials, payments, production and release promotion. No new permission was granted for any live Meta/Zalo send or hosted RLS migration.

## B. Baseline verified via connected systems (read-only)

**GitHub:** repo ngoctien20/demo-git. Previous Messenger candidate PR chain #87–#92 contains signed carousel/quick replies, canonical verified Page/Store pipeline, synthetic replay isolation and PostgreSQL transaction simulator. PR #92 head was 9aa08520525d746121194143e521a89393cd3988 and is an OPEN DRAFT. It has no hosted durable Page Event Store yet. V14.3 branch was created FROM that exact commit; no rebuild or overwrite of earlier PRs.

**V14.2:** PR #86 head was 477baf57fde0526bfb824cc7705d3719ff5fa766, an OPEN DRAFT on the V14.1 Shop Knowledge lineage, separate from the Messenger PR chain. No assumption it is deployed or merged. A coordinated integration PR and review will be needed when hosted Store/RLS is approved.

**Published n8n:** TIEN404_MESSENGER_TEST ID Z7FdV7uDvApfbURQ, version d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92, 27 nodes, active and uses QA Page + AI_SALES_DEMO tools. Not modified. Demo Orders/Products/credentials remain separate.

**Supabase staging:** ref ifxlvrhyjhbzbrkdsida read-only information_schema audit: public.products, public.conversations, public.messages lacked store_id. This is P0 blocker to same-tenant multi-store isolation, not evidence RLS has passed.

**Render:** workspace My Workspace, auth static site and data Python web service both existed; autoDeploy disabled for both, no changes.

**Cloudflare:** Zalo staging worker tien404-zalo-outbound-v1-staging version ed172d3c-e1f1-4daa-bc56-643406441091, global ZALO_SEND_ENABLED=false, unchanged. No Zalo sends during this work.

**Meta:** official Messenger Platform Quick Start documents messages/postbacks and Generic Templates. That is documentation support, NOT evidence of TIEN404's Meta App Review, Page authorization or production policy approvals. Verified live permissions were NOT available for this offline scope.

## C. Implementation

GitHub branch: work/v143-unified-channel-widget-staging-20261115
Draft PR: https://github.com/ngoctien20/demo-git/pull/94
Base: work/v136m5-private-event-store-readiness-offline-20261115 (PR #92)

- qa/channel-v143/channel-core.cjs — pure validated Response Intent; server-verified tenant/store/channel source, current verified shop SKU/price/stock, published public Knowledge only; no Orders or sends.
- qa/channel-v143/renderers.cjs — reuses V13.6M signed Carousel/Quick Replies with fixed Page scope; widget presentation and Zalo fallback; no provider requests.
- qa/channel-v143/widget-gateway.cjs — offline private install registry, exact HTTPS origin allowlist, HMAC anonymous session, staff-reviewed branding. It is a contract, NOT a deployable gateway.
- qa/channel-v143/widget/embed.js, frame.html, host.html — QA-only, iframe-contained, synthetic per-shop UI with a public embed flag restricted to QA names. No API keys; no HTTP writes.
- qa/channel-v143/staff.html — Staff Channel Designer MOCK with three-shop Messenger and Website previews; no login or customer data.
- qa/channel-v143/channel-core.test.cjs — 36 Node tests including cross-shop, unauthorized actions, credential-like URLs, invalid money, expired subscription, draft knowledge, session expiry/MAC.
- qa/channel-v143/browser.test.cjs — 360/390/430/768/1280 viewport tests + independent embedded host test; non-GET/network guard and screenshot artifact.
- .github/workflows/v143-unified-channel-widget-qa.yml — independent source+browser QA.
- qa/channel-v143/n8n-v143-offline-sdk.mjs — versioned n8n QA source.

## D. QA evidence

GitHub Actions **run 43716189689**, commit **b8517e24b30eb5ac0d33f3ed0aff97e60d254c51**, SUCCESS:
- New V14.3 Node tests **36/36 PASS**.
- Inherited V13.6M Messenger tests **244/244 PASS**.
- Chromium 5 viewports + 1 existing-site embed scenario **6/6 PASS**. No unexpected network writes and no browser JS errors. Existing-site widget button was clicked normally in the standalone host scenario; the nested Staff mock used a forced click due Chromium nested scroll positioning, not evidence of a real hosted CMS integration.
- Browser artifact at https://github.com/ngoctien20/demo-git/actions/runs/43716189689, synthetic only.

n8n Personal / 90_QA - DIAGNOSTICS: new inactive workflow **KjcnFcdg3lDQcZyW** has manual trigger + 2 Code nodes, no HTTP, external tools, DB, credentials or provider send; execution **3838 SUCCESS, 13/13 PASS, 0 sends and 0 Orders writes**.

Earlier failed exploratory runs (n8n 3836/3837; early CI) were corrected. Do not mistake them for the final evidence. Source and n8n assertion were updated consistently.

**No hosted RLS, real Messenger Send API, real Widget Chat Gateway, live Site install, real Sales Core read or customer account authentication has been tested.**

## E. Release and security blockers (P0 first)

P0: Canonical Store/Membership and hosted Supabase same-tenant shop RLS; backend Page→Tenant→Store mapping and Meta permission/App Review; durable event uniqueness/outbox and 24-hour message policy; Widget domain ownership proof, private registry, session/rate limit and data retention; staff authorization/handoff; real SKU price stock readback before customer-facing cards; no duplicate order or wrong-store read.

P1: CSP compatibility in actual partner CMS, proper iframe accessibility/keyboard on mobile, Web Vitals/Widget load effect, plan usage quotas, uploaded media handling/AI Vision cost controls, hosted monitoring.

P2: Visual template library, advanced branding presets, channel operations dashboards.

Origin/Referer + public Widget ID **cannot authenticate a visitor or authorize private Orders**. The demo issuer and HMAC are SOURCE-ONLY and cannot prevent a real attacker without host-backed session, quota, database replay guard and correct production network configuration.

## F. Commercial view (model, not a sales forecast)

Keep Lite / Plus / Enterprise concepts. Price and limits are NOT changed in this version. Separate initial branding/setup fee, recurring managed AI subscription, per-channel activation and optional support SLA. For each pilot shop measure staff minutes for Messenger Page setup, Widget installation time, QA/review time, n8n execution volume, AI cost per conversation, abuse rejected, maintenance requests, site compatibility. Do not infer profitability or authorize spend from synthetic tests.

## G. What changed / what did not change

**IMPLEMENTED:** GitHub source, local QA HTML Widget and Staff demo, no-send adapter core, n8n manual QA workflow.

**TESTED:** 36/36 + 244/244 Node, 6/6 Chromium synthetic, 13/13 n8n manual.

**VERIFIED:** published Messenger graph baseline, Supabase column blockers, Render staging service metadata, Cloudflare send switch state.

**PROPOSED:** hosted widget gateway, staff authentication, production multi-Page resolver, published cross-channel Sales Core integration, commercial pilot.

**BLOCKED:** sending messages to real Messenger/Zalo recipients, publishing Widget on actual shop sites, Supabase RLS migration, real Orders writes, modifying Page profile or credentials, production releases.

## H. Rollback / approval

Rollback for current change: close Draft PR #94. If later approved, archive isolated inactive n8n QA workflow KjcnFcdg3lDQcZyW; do not delete without approval. No production, DB, Cloudflare or Render rollback needed because none was modified.

For any hosted step: snapshot schema/graphs, collect real Meta App permissions, verify backend Staff/Store security, create approval record, apply only bounded staging changes, run hostile same-tenant Shop A/B cases and E2E. Separate approval is required for customer data mutation, RLS grants/migrations, Page profile edits, credentials, paid AI activity, live message sends and public deployment.

## I. Next checkpoint

V14.3 CANDIDATE only AFTER hosted RLS/Store binding and permission proof. Proposed next:
- Review and safely integrate V14.2 Store/RLS + Shop Knowledge as independent dependency, without rewriting Messenger.
- Implement private Widget Gateway / domain owner proof / per-shop session + rate limiting in staging after approval.
- Build authenticated Staff Channel Designer on the canonical Staff Console when backend ready.
- Run controlled QA Page Messenger cards and one authorized Widget domain E2E only with new separately bounded owner approval.
- Later V14.4 should harden the Widget production path, not create a full website factory.
