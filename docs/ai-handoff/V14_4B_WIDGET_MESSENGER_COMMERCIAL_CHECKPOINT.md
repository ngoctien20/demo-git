# TIEN404 AI V14.4B — Widget Gateway LOCKED Staging × Messenger Pilot Gate × Commercial Readiness
**Checkpoint:** 2026-11-15 JST. **Status:** STAGING-ONLY, NO-SEND, NO-DATA, NOT CUSTOMER READY.

## Verified evidence
- Source predecessor V14.3 PR #94 (head 02c480d6925234631a94c9ad1c5b705b07c4128d), 43716550115 GitHub Actions SUCCESS; all QA source only.
- Existing n8n Messenger Published `Z7FdV7uDvApfbURQ` ACTIVE, 27 nodes; still uses AI_SALES_DEMO tools and HTTP send node. **Not changed**.
- V14.3 offline n8n QA `KjcnFcdg3lDQcZyW` exec 3839: 13/13 synthetic PASS, provider sends=0, orders written=0.
- Supabase Store RLS PR #86 remains separate OPEN DRAFT; no store_id in six Commerce tables. PR #95 replay PG17 tests are not hosted proof.
- Cloudflare existing Workers inventory initially had Zalo gateway and BIO services but **no Widget Gateway Worker**.
- Cloudflare Worker **tien404-widget-gateway-v144-staging** uploaded successfully (deployment version `98c8aad5-2dae-47c3-9cb0-8473065213e6`, deployment ID `a9f197fe-68c1-4321-bfb1-bc333d3093c6`).
- Worker subdomain enabled=false, previews_enabled=false, no public route enabled. No bound secrets, DB, AI, Meta, n8n or Orders integration.
- Node local offline test: `node --test qa/channel-v144/worker-staging-locked.test.mjs` → **7/7 PASS**. These tests are not a hosted HTTP QA and do not establish production safety.

## Gateway safety design
`qa/channel-v144/worker-staging-locked.mjs` is deliberately a **hard-locked gateway shell**, not actual chat:
- `GET /__v144/health` returns `state: LOCKED`, `productionReady:false`, all AI/send/order/session flags false.
- Every `/v1/widget/*` route returns HTTP **423**, including session, message, install.
- Unknown path 404; no CORS grants, no third-party calls, no HTML, no credentials, no tenant resolution.
- HTTP security headers with no-store, frame-ancestors none.
- Public availability is off. Do not enable workers.dev or preview until approved after required security/cost review.
- No Widget can currently be distributed to a shop as functional service.

## P0 conditions before enabling real Widget
1. Hosted Store RLS with SAME tenant dual-store proof and user-JWT, plus safe authoritative Store resolver.
2. Approved verified domain-ownership registry (DNS TXT or verified HTTP proof). Referer/Origin are **signals only**, never user identity or private Orders authorization.
3. Server-originated anonymous session bound to verified installation and Store; server-side replay and abuse protection.
4. Durable rate/quota by store and anonymous session; bot protection (Turnstile must use server-side Siteverify if used).
5. Staff review/versioned Shop Knowledge, subscription entitlement; signed origin and CSP/frame-ancestors plan for hosted iframe.
6. Staging-only allowlisted domain QA, negative tests, limits/budget and rollback reviewed before enabling public route.

## Messenger Pilot Security Gate
- Meta current messaging policies require relevant Page/token rights and generally a 24-hour standard messaging window, with separately authorized exceptions; independently validate current policy and permissions before any sends.
- Verify Page owner approval, `pages_messaging` and Page task, app review/access, webhook subscription, raw-body HMAC, Page-scoped PSID, consent, 24h window and signed postback.
- Durable event uniqueness across key rotation/worker instances, crash recovery and atomic claims (see PR #95). Never reuse in-memory/dedup QA as real hosted evidence.
- The existing Published Messenger workflow is **left untouched**, and one-shot send permission is NOT granted by this checkpoint.

## P1 commercial instrumentation — PROPOSED (not pricing release)
| Metric | Collection / data quality | Decision |
|---|---|---|
| Onboarding setup minutes per Shop | Start/end operator timestamps; record product/FAQ import tasks | Determine deployment labor |
| Widget installation minutes | Verified domain and mobile QA duration | Pricing support effort |
| AI inference VND cost per conversation | Provider input/output tokens and rate version | Plan quotas and gross margin |
| Channel per-message costs | Meta/Zalo published policy and provider receipt | Channel pass-through |
| Hosting and data storage per Store | Actual billed resource usage over 30 days | Minimum viable fee |
| Monthly maintenance/support minutes | Ticket and release logs | Support limits |
| Error/abuse rate and blocked requests | Sanitized security telemetry | Quotas and fraud control |

Draft packages only:
- **Lite:** simple Sales Lite order requests, basic owner alerts and reporting, standard limits.
- **Plus:** approved Shop Knowledge customization, more channels, branded Widget, richer reports.
- **Enterprise:** tailored integration, multiple Stores, stronger operations and support agreements.

Do not invent measured cost numbers, publish price changes, or adjust subscription/billing during V14.4.

## Change/QA/rollback
**Changes:** new isolated Cloudflare Worker shell and GitHub source/test/checkpoint on branch `work/v144-widget-gateway-locked-staging-20261115`. No old deployment changed.
**QA:** source 7/7 local PASS; Cloudflare upload + script deployment confirmed; external HTTP and customer integration **NOT TESTED** because public routing intentionally disabled.
**Rollback:** Delete only Worker `tien404-widget-gateway-v144-staging` after owner confirmation if desired; no routes or data to reconcile. Close this Draft PR. Do not modify existing Zalo gateway or Pages.
**Approval:** Need separate authorization to enable public staging URL, data integrations, Meta real sends, subscription changes or production.

## Architecture reconciliation
This branch inherits V14.3 PR #94 and Messenger PR #92 lineage. **It does not contain V14.2 PR #86 or V13.6M.7 PR #95.** Integration requires deliberate dependency/diff review after hosted Store Security passes. Avoid blind merging of stacked PRs.
