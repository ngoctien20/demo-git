# TIEN404 Sales Lite V1.3 — secure staging integration candidate

Date: 2026-11-15 JST. Release = EXPERIMENTAL. Draft PR #69 based on V1.2 PR #68.

## Files and responsibilities

- v133/studio/index.html + app.js — separate mobile-first Studio V1.3, offline menu draft snapshots, version diff, manual REVIEW lock, official Zalo text_styles preview. Browser role choices are QA-only, never server authorization.
- v133/account/index.html + app.js — read-only Merchant UX, attempts GET /api/sales-lite/me by default. On 401/403/timeout, returns no real data and never silently substitutes fixtures. Explicit QA fixture selector remains separate.
- v133/merchant-readonly.cjs — inject-only backend resolver; requires verified session, current owner/manager membership, server-selected shop, tenant/store/bot readback consistency; emits minimal no-store schema. Does NOT connect Supabase directly or contain service-role credentials.
- v133/staff-guard.cjs — fail-closed staff verification contract for Cloudflare Access JWT and current staff grant. Not deployed to Cloudflare, because Access API permission is 403.
- v133/menu-core-bridge.cjs — no-send Menu Engine ports to Customer/Owner Core; requires verified ingress/bot binding/session. Neither PR #41 nor PR #52 is copied or merged; injection only.
- v133/menu-drafts.cjs — memory-only snapshots, validation, change comparisons and strict release gate (no automatic APPROVED/RELEASED).
- v133/rich-text.cjs — official Zalo Bot sendMessage {start,len,st:[...]} whitelist/UTF-16, no sending.
- v133/subscription-expiry.cjs — read-only proposed expiry alert states; no email/Zalo notifications.
- v133/support-contract.cjs — no-write ticket candidate and owner-scoped readback candidate.
- v133/v133-contracts.test.cjs, v133-ui-and-security.test.cjs, v133-browser-qa.cjs — source, isolation, browser and negative QA.

Other documentation:
- docs/ai-handoff/V13_3_ZALO_BOT_CAPABILITY_RESEARCH.md
- docs/ai-handoff/V13_3_SALES_LITE_UNIT_ECONOMICS.md
- docs/ai-handoff/V13_3_SUPABASE_AUTH_RLS_READONLY_AUDIT.md
- docs/ai-handoff/V13_3_SALES_LITE_CHECKPOINT.md

## Local preview

From repository root: python -m http.server 8080.

Studio: http://127.0.0.1:8080/qa/sales-lite/v133/studio/
Merchant: http://127.0.0.1:8080/qa/sales-lite/v133/account/

CAUTION: These are localhost UI QA previews, not authenticated cloud routes. Do not publish Studio without a verified staff-only host guard covering HTML, JS, CSS, menu registry and API paths. "noindex" alone provides no access control.

## QA

- node --test qa/sales-lite/v133/*.test.cjs
- node --test qa/sales-lite/v132/v132-ui.test.cjs
- node --test qa/sales-lite/v131/*.test.cjs
- node qa/sales-lite/v133/v133-browser-qa.cjs (requires local HTTP server and pinned Playwright, see CI).

CI: .github/workflows/v133-sales-lite-secure-qa.yml; browser uses ephemeral pinned Playwright Chromium and intercepts /api/sales-lite/me in tests. This is simulated API/role QA, not authenticated hosted RLS or actual Zalo provider test.

## P0 release gates

1. Cloudflare preview deployments queued/idle; protect Studio with Access or server-side verified authentication. Connected Access audit returns 403. No public URL verified and no Access policy modified.
2. No deployed authenticated Merchant /api/sales-lite/me API, live subscription source, owner bot readback or real cross-shop hosted RLS. Endpoint remains an integration-ready server port contract.
3. Menu bridge has no signed live ingress; PR #41/#52 runtime integration requires explicit owner review and separate staging safety QA.
4. Supabase public SECURITY DEFINER QA RPC has anon EXECUTE but internal Vault-secret gate; review permissions and caller dependencies before changes.
5. Zalo native buttons/rename behavior, quota and commercial terms unverified; text_styles code follows published schema without provider send.
6. Commercial plan prices 199k/349k remain hypotheses and cost scenarios assumptions; no billing updates.

## Rollback and approval

Close/revert PR #69 / leave V1.2 PR #68, V1.1 PR #67, PR #41/#52, all published n8n workflows, existing Supabase tables and gh-pages production untouched.
Explicit owner approval required for any Cloudflare Access policy change, Supabase migration/RLS grants, credential changes, Order/Outbox write, Zalo send, actual bot rename, Billing, paid resources, production merge.
