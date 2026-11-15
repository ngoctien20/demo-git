# TIEN404 Sales Lite V1.2 — UI staging candidate

**Release:** EXPERIMENTAL · no Zalo send, no order writes, no billing. All data are fixtures or unavailable states; this is not a commercial release.

## Architecture

- v132/studio/index.html + studio/app.js: separate internal Studio route, menu draft editor, customer/owner/support preview, UTF-16 rich-message draft, local validation and JSON export. Do not expose unprotected to merchants.
- v132/account/index.html + account/app.js: merchant-facing portal with five tabs, clearly labeled UI fixtures, empty/error/expired states. No real login or shop data.
- v132/design-system.css: shared mobile-first tokens/components, no framework or external assets.
- Canonical source stays v131/menu-registry.json and v131/menu-engine.cjs. No duplicate authoritative registry. The Studio loads JSON only; browser UI is not authorization.
- Existing v131/mock files are unchanged.

## Run from repo root

Start a local HTTP server at port 8080, e.g. python -m http.server 8080.
- Studio: http://127.0.0.1:8080/qa/sales-lite/v132/studio/
- Merchant: http://127.0.0.1:8080/qa/sales-lite/v132/account/

Avoid file://; Studio loads ../../v131/menu-registry.json.

## QA commands

- node --check qa/sales-lite/v132/studio/app.js
- node --check qa/sales-lite/v132/account/app.js
- node --test qa/sales-lite/v132/v132-ui.test.cjs
- node --test qa/sales-lite/v131/*.test.cjs

GitHub Actions: .github/workflows/v132-sales-lite-ui-qa.yml.
These tests cover source contracts and legacy unit cases, not full browser, hosted RLS or live provider QA.

## Deployment and security gates

Target logical routes /sales-lite/studio and /sales-lite/account have not been deployed. Source pages live under qa/sales-lite/v132. Staging routes may map there only after routing checks and staff-only Cloudflare Access or equivalent server-side authorization for Studio. noindex is not access control. Never expose operational data, bot keys, tenant identity or admin capabilities on a public preview.

Merchant Portal remains read-only until the authenticated backend contract in API_READONLY_CONTRACT.md passes review. No service-role key in assets; never trust client-selected tenant_id, store_id or role.

## Limits

- Studio menu edits are local draft-only, not persisted; Action IDs read-only. Export JSON does not auto-deploy.
- Rich text JSON is a draft preview: confirm provider schema for text_styles before any real send. JS string positions are UTF-16.
- Role and Shop A/B selectors are visual QA controls, never authorization.
- Plan prices are hypotheses, not active Billing.
- PR #41 Owner and PR #52 Customer remain independent.
- Cloudflare Pages staging project currently uses production branch gh-pages; do not modify its production branch.
- No new paid infrastructure requested; account billing was not inspected.

## Acceptance next

1. Verify GitHub CI and browser responsive QA at 360/390/430/768/1280.
2. Verify staging authenticated read-only API and Shop A/B isolation under server checks.
3. Verify staff-protected Studio preview and safe account staging route.
4. Record evidence, CI, commit SHA, screenshots, rollback and approvals.
5. Request separate approval for Zalo send, Orders, billing, credentials, important RLS/permissions and production merge.

**Rollback:** close/revert V1.2 Draft PR or branch; retain V1.1 registry, PR #41/#52 and published n8n unchanged.
