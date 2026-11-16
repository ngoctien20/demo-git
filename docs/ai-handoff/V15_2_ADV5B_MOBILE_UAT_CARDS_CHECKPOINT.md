# TIEN404 AI — V15.2 ADV.5B Merchant UAT Review × Mobile UX Refinement

**Checkpoint:** 16/11/2026 JST.  
**Lifecycle:** CANDIDATE for synthetic Merchant UAT only; **not APPROVED, not RELEASED**.  
**Parent:** PR #159 (`work/v152adv5-canonical-registry-merchant-uat-nosend-20261116`), self-reported UAT 16/16 PASS received earlier with no independent Owner attestation.  
**Implementation:** child [Draft PR #166](https://github.com/ngoctien20/demo-git/pull/166), `work/v152adv5b-merchant-uat-mobile-cards-nosend-20261116`. **No merge/publish.**

## 1. Objective, verified baseline and scope

The previous UAT table had four wide columns; in a narrow ChatGPT preview or on a phone it required sideways scrolling. This was **P2 usability feedback** rather than a failure of technical responsive tests.

ADV.5B uses a **single UAT source of truth**: 16 original `<tr>` rows and one set of `select`/`input` elements, the same `form.update` domain model and the existing `T404_ADV5_MERCHANT_UAT_SELF_REPORT_V1` JSON contract. **No independent mobile dataset, no duplicate outcome storage.**

## 2. Implementation

- `qa/v147-custom-studio/advanced-custom-studio.html` updated only for UAT presentation: CSS breakpoint **≤600 CSS px** displays the existing rows as vertical cards; at **≥601 CSS px**, retains table layout. UAT controls stretch to available width, stay inside the viewport and have min-height **46px**. UAT export/reset buttons min-height **44px** on mobile.
- `qa/v147-custom-studio/advanced-merchant-uat-view.js` adds **associated labels** for "Kết quả mong đợi", "Kết quả tự đánh giá", "Nhận xét" — hidden visually on desktop but visible on cards. The program still uses `textContent` and `createTextNode`, not `innerHTML`.
- `qa/v147-custom-studio/advanced-merchant-uat-mobile-cards.test.cjs`: 10 new Node.js contract/regression checks.
- `qa/v147-custom-studio/advanced-merchant-uat-mobile-cards-browser.test.cjs`: 9 viewport browser tests, verify cards vs table, touch target dimensions, no clipping, scrolling, note/result preservation after changing from mobile to desktop and back, JSON export and no live release.
- `.github/workflows/v152-adv5b-mobile-uat-nosend.yml`: isolated CI with inherited ADV.5/ADV.4/ADV.3/ADV.2/ADV.1/V14.7 regressions and offline `file://` package; artifact upload of screenshots and HTML.

**Important:** UAT state remains in **memory only**. Resizing does not lose the session; refreshing/closing the page does reset it. The prior self-report receipt is documented in the parent PR, not automatically loaded into this UI.

## 3. QA evidence

At tested code commit `53b5323ec7cb944ec76d2c0cdc2bb94b49a8c8fb`:

- [GitHub Actions #43808741387](https://github.com/ngoctien20/demo-git/actions/runs/43808741387): **2/2 jobs SUCCESS**.
- **195/195 Node tests PASS** = 10 new ADV.5B + 185 inherited tests.
- **17/17 Chromium viewport passes** = 9 dedicated ADV.5B card/table width checks at **320, 360, 375, 390, 412, 600, 601, 768, 1280 CSS px** + 4 inherited Merchant UAT browser + 4 offline `file://` UAT checks.
- Runtime/assertions: 16 UAT rows, same form data after breakpoint changes, select and notes min 44px, zero horizontal UAT scrolling ≤600px, desktop table stays intact ≥601px, zero offsite network requests, zero write HTTP methods, zero page exceptions, and no extra enabled action buttons.
- GitHub CI screenshot artifact `v152-adv5b-merchant-uat-mobile-cards-320-390-412`, screenshots checked visually in 390px crop.
- Offline HTML artifact `v152-adv5b-mobile-merchant-uat-single-html` downloaded from the exact source CI; verified **SHA-256** `699004fa3843cc620465b1df0d8c27cf1d0feafcf22bdd31b1edc188a4f70e69` (73,232 bytes), matches shipped integrity manifest. This is synthetic public-only source with hash-pinned Content Security Policy.

## 4. Real Merchant UAT acceptance

Previous user-provided self-report `T404_ADV5_MERCHANT_UAT_SELF_REPORT_V1` stated **UAT01–16 PASS**, 0 FAIL and 0 NOT_RUN, with **16 blank observations**. This is **SELF_REPORTED_PASS_RECORDED** only. No independent merchant Owner/Consent or signed evidence accepted. ADV.5B's automated tests **do not** overwrite or certify that report.

## 5. Still BLOCKED / NOT TESTED

G0 authentic merchant Owner G2.3 and consent — BLOCKED.  
G1 hosted same-tenant Store A/B JWT/RLS isolation — BLOCKED.  
G2 Meta/Zalo native capabilities and verified message send — BLOCKED.  
G3 action gateway, server signature and durable nonce — BLOCKED.  
G4 real model presentation benchmark (P50/P95/tokens/cost) — NOT TESTED by ADV.5B.  
G5 independent merchant review of updated mobile cards — NOT RECEIVED.  
G6 public Cloudflare staging — NOT DEPLOYED, as billing eligibility/cost could not be confirmed; production NO-GO.

**No customer PII, new provider messages, n8n workflow changes, Supabase Auth/RLS/Orders, website deployments, credentials, paid model API or unapproved spending.**

## 6. Risk, rollback and next phase

- Risks: UI text overflow on unusually small embed viewports (mitigated by 320px browser tests), accessibility differences between CSS table/card mode (controls additionally use explicit HTML labels), self-assessment misinterpreted as Owner proof (UI and evidence remain explicit).
- Rollback: close child Draft PR #166 or revert its UI + QA commits; parent ADV.5 PR #159 and all production systems unchanged. Previous standalone HTML bundle remains available from parent CI.
- **PROPOSED V15.2 ADV.5C:** independent mobile card UAT receipt, reconcile human evidence and provider entitlement matrix, release-blocker decision only; no automatic merge or public release.
