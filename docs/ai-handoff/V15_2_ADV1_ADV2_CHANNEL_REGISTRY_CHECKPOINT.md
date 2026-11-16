# TIEN404 V15.2 ADV.1 → ADV.2 — Advanced Presentation Lab / Channel Capability Registry

Checkpoint date: 2026-11-16 JST. Status: **EXPERIMENTAL / Draft / No-Send / No-Production / NOT Sales Lite default**.

## 1. Audit: actual predecessor evidence

- PR #118: \`work/v14704-05-messenger-zalo-no-send-lab-20261116\`, HEAD \`1bdc6f7d74e2e8ea2b2b15651831e50c6b8c980e\`, OPEN DRAFT. V14.7 source-only Messenger and Zalo preview; provider account entitlement not certified.
- PR #134: \`work/v152-advanced-channel-presentation-nosend-20261116\`, HEAD \`867a0232af5be8a20f93555c62ba43f7e64ed214\`, OPEN DRAFT, parent of this child Draft. 3/3 CI SUCCESS at exact PR #134 head: 43792228376, 43792228429, 43792228394. 30 advanced presentation policy tests; real model accuracy not proven.
- n8n RICH UI candidate \`X0MwwQ7LRUqfOVjM\` remains inactive and provider Zalo V13.5 RichText workflow \`qWMu4n1wLkTZBNpI\` remains inactive. No workflow actions performed.
- Sales Lite PR #128 and hosted Store Ownership PR #131/#133 are parallel, unmerged, **NO GO**. This child does not change them or claim Store-level hosted JWT/RLS proof.
- Provider APIs: Meta documented Generic Templates/quick replies, Zalo Bot sendMessage text_styles and sendPhoto, Zalo OA messaging/CTA/ZBS. Documentation NEVER proves account entitlement, message eligibility, approved template, legal usage or charge approval.

## 2. ADV.1 completed as implementation (pending exact-head CI)

Retain V15.2 existing \`advanced-presentation-policy.js\`, local heuristic test UI \`advanced-preview.js\`/HTML, no fake model inference. Extend HTML with a Vietnamese capability inspector for the selected Shop/channel/intent, 13 components and fallback label; dynamically rerender on Shop, channel or intent change. Uses DOM \`textContent\` only, no dangerous HTML or executable CTA, no browser persistence, CSP \`connect-src 'none'\`, image/network forbidden.

Added \`advanced-registry-view.js\` to show current provider capability and design fallback inside ADV.1. Existing V14.7 editing workflow and PR #134 remain unchanged.

## 3. ADV.2 — Implemented source-only registry

- \`qa/v147-custom-studio/advanced-channel-registry.js\`: 4 channels × 13 component identifiers; explicit state (DOCUMENTED, ACCOUNT_GATED, LOCAL_PREVIEW, UNVERIFIED, UNSUPPORTED, APPROVAL_SPEND), provider documentation URL, trusted capability copy, approval dependencies, fixed TEXT fallback, \`canSend:false\` always.
- \`registry.compose()\`: reuses authoritative scoped fixture through \`T404AdvancedPresentation.compile\`, determines preferred component, validates source and action invariants, picks structured preview or plain-text fallback. For Zalo Bot image without approved asset, forces text. Does not interpret model-supplied price/color/URL/action/store ID.
- Zalo Bot native buttons/carousel remain UNVERIFIED; OA ZBS template APPROVAL_SPEND and fallback TEXT; Meta Messenger arbitrary rich text UNSUPPORTED; Website Widget LOCAL_PREVIEW only. Never permit real send from a synthetic capability receipt.
- \`qa/v147-custom-studio/advanced-channel-registry.test.cjs\`: 40 registry and security tests, including 96 combinations (3 Shops × 4 channels × 8 intents), same-Tenant Store A/B isolation, zero server action.
- \`qa/v147-custom-studio/advanced-registry-browser.test.cjs\`: Playwright local QA 320/390/768/1280 px, no external calls/no writes, correct Shop A/B pricing and Zalo Bot/OA fallbacks, screenshot.
- \`.github/workflows/v152-adv1-adv2-registry-qa.yml\`: Node syntax+unit/inherited regressions, safety/static scans, Chromium browser job on isolated loopback.

## 4. Release and quality limitations

- No real AI model calls in this phase. Heuristic intent routing is NOT model training.
- No real Meta Graph/Zalo Bot/OA provider sends, no approved buttons, no provider entitlement screenshots; preview only.
- No supplied Catalog media URLs, links, Merchant channel credentials, or live Customer Order data.
- No real JWT/Store RLS certification from this UI fixture. Synthetic test PASS does not authorize Commerce read/write or cross-channel identity.
- No GitHub merge, deployed Cloudflare artifact, n8n Published mutation, Supabase Auth/RLS/GRANT/DDL/DML, paid model usage or billing change.

## 5. Acceptance conditions

- [ ] Latest child Draft head CI unit, legacy regressions and browser QA SUCCESS (record exact SHA, action run IDs).
- [ ] Studio A/B/C display and per-channel fallback correct at 320–1280 px.
- [ ] Strict allowlist and No-Send static tests PASS.
- [ ] Owner UAT separate self-report after reviewing preview/screenshots.
- [ ] Independently verified provider account permission & Store ownership before API integration.
- [ ] Signed Action Registry and approved Media/Link assets before enabling buttons/images.
- [ ] After independently approved paid QA budget, benchmark actual low-cost model on labeled Presentation Dataset.
- [ ] Merchant consent and cost review before approved real send; production remains NO-GO.

## 6. Upcoming milestone

**V15.2 ADV.3 — AI Presentation Evaluation Corpus × Signed Action Interface (Draft)**:
- Label enough examples to learn when verified price needs bold, low stock red only where supported, notes italic, product cards/links where grounded, and sensitive Order lookup must demand verification.
- Define strict model classification JSON schema; use existing low-cost model only with explicit budget.
- Signed action interface/nonce expiry, Store actor roles, idempotency and media-domain allowlist; initially NO-SEND and read-only.
- Add visual Merchant Studio approval workflow, keep Sales Lite untouched.

## 7. Rollback

Close child Draft or revert its new registry, browser QA, workflow and additive UI changes. Parent PR #134 and original V14.7 PR #118 remain intact. No hosted operational rollback is required because no deployment or production change occurred.

**Evidence gate:** Until latest exact-head GitHub Actions finish SUCCESS, mark these items **IMPLEMENTED, not TESTED**.
