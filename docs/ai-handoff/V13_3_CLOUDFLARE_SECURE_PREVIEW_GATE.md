# TIEN404 V13.3 — Secure Cloudflare Preview Gate (NOT DEPLOYED)

Date: 2026-11-15 JST. Cloudflare Pages project: tien404-ai-git-staging. Production branch: gh-pages (unchanged).
Build config: build_command empty, destination_dir ".", root_dir "/"; GitHub integration.

## VERIFIED

- Cloudflare Pages production canonical deployment status = success.
- Multiple V13.2/V13.3 preview deployment records have been created automatically, but latest_stage = queued and status = idle. These entries are NOT evidence that URLs serve HTML or assets.
- Direct candidate preview URLs did not return accessible pages through public web check during V13.3 audit. No working Studio/Account Cloud URLs can be claimed.
- GET /accounts/{account_id}/access/apps returned HTTP 403 (access.api.err) with currently connected Cloudflare account permissions. Cannot read existing staff policies or verify Studio is protected. No Access application/policy was created or changed.
- The v132/v133 UI files reside under qa/sales-lite; desired /sales-lite/studio and /sales-lite/account routes have NOT been mapped/deployed.

## Safe deployment plan — approval-gated

1. Identify a dedicated staging hostname/preview routing strategy. Do not alter gh-pages, production Pages branch, domain or paid resources.
2. Grant audit-only Cloudflare Access read permission to the project connection or have an Owner review existing policies. Read full Access application paths, identity providers, allowed staff groups, deny rules, session expiry and role mapping.
3. Protect ALL Studio paths at the edge BEFORE serving them: desired route, current source directories, JS, CSS, menu registry/config exports and any debug/QA endpoints. Avoid unguarded alternative previews/aliases; if protection cannot be enforced, fail closed.
4. Trusted staff verification requires identity proof + current TIEN404 staff grant. UI-only role selectors and noindex are not authorization. MERCHANT must always be denied Studio.
5. Merchant Portal can have a public login/landing page, but /api/sales-lite/me must require authenticated backend session and current membership; no service-role in assets.
6. On accessible URLs, test HTTP success/deny: authenticated staff, non-staff, unauthenticated, revoked, expired session, wrong cookie, alternate path, asset bypass. Collect redacted evidence with screenshots.
7. Verify CSP/Cache-Control/CORS/redirects, same-origin cookies, assets paths and no backend writes. Mobile Chromium 360/390/430/768/1280; physical-device QA separately.
8. Save existing config and rollback plan before any actual Access edits; check whether preview deployment consumes a paid quota.
9. After explicit security approval, perform controlled staging configuration. Do not publish live Zalo, orders, billing or production.

## Current release blocker

The two requested user-facing cloud URLs remain **BLOCKED**, not merely planned.
No bypass using public Pages preview, hidden URLs, client-side login form or localStorage is acceptable.

Rollback: revert candidate branch deployment or Access changes only after preserving prior policies. No changes made in V13.3.
