# TIEN404 AI — V15.2 ADV.4 Advanced Custom Bot Studio Integration

**Ngày kiểm toán:** 2026-11-16 JST  
**Trạng thái:** IMPLEMENTED / TESTED SOURCE-ONLY QA / EXPERIMENTAL / DRAFT / NO SEND.  
**Không thuộc Sales Lite mặc định. Không có live integration, real model benchmark hoặc hosted commerce authorization.**

## 1. Baseline và cấu trúc PR

- [ADV.1 PR #134](https://github.com/ngoctien20/demo-git/pull/134): Advanced Presentation Policy, OPEN DRAFT.
- [ADV.2 canonical PR #138](https://github.com/ngoctien20/demo-git/pull/138): versioned registry with tenant/store/channel scope, HEAD baseline `2cb5128ef4ffce11fb562805b82b698fe396fed5`.
- [ADV.3 PR #142](https://github.com/ngoctien20/demo-git/pull/142): exact Structured Output Evaluator + Synthetic Secure Action Registry, HEAD baseline `96a930181f1ef2feaacb77207683cd8c4a59f54e`, OPEN DRAFT.
- [Alternative ADV.1/2 PR #144](https://github.com/ngoctien20/demo-git/pull/144): 13-component UX/capability matrix and offline browser QA. HEAD `ebc29571c389e982bdc670a85df08157b3106133`, a **parallel** sibling of #138 — not automatically merged/cherry-picked.
- [ADV.4 child PR #154](https://github.com/ngoctien20/demo-git/pull/154): base #142, `work/v152adv4-custom-studio-integration-nosend-20261116`. All changes remain unmerged and can be rolled back by closing Draft PR.

## 2. Implementation

New offline Studio entry:
`qa/v147-custom-studio/advanced-custom-studio.html`

Features:
- Synthetic Shop A/B/C and channel-specific Messenger, Zalo Bot, Zalo OA, Website Widget selector.
- Assistant name, Vietnamese greeting, tone, accent color, optional stock display; edited only in transient Studio instance (no network/database/localStorage).
- Semantic `intent`, emphasis, component, media and suggested action controls, including deterministic heuristic QA mode (**not a real AI model**).
- Live-in-browser preview from **the exact ADV.3 Structured Output Evaluator**, using UMD wrappers. Canonical prices, products, stock and messages still derived only from synthetic V14.7 fixtures, never invented from user text.
- Preview-only disabled action buttons, explicit fallback reasons, no browser signer and no business-action execution.
- QA JSON export is displayed in read-only textbox, **not sent or deployed**. Export explicitly says `releaseAuthorized:false` and action receipt `NOT_ISSUED_BROWSER`.
- 13-row capability matrix shows PR #144 UX vocabulary crosswalked into canonical ADV.2 #138 without inventing permission; link actions without exact verified target map to no capability. For ZBS/paid features, fallback TEXT stays locked.

New source:
- `advanced-studio-capability-crosswalk.js`: conservative 13-feature crosswalk using existing 20-entry-definition/registry, no commercial entitlements.
- `advanced-custom-studio.js`: offline controls and DOM preview, without unsafe HTML.
- `advanced-custom-studio.test.cjs`: 24 Node checks.
- `advanced-custom-studio-browser.test.cjs`: local Chromium QA at 320/390/768/1280px.
- `.github/workflows/v152-adv4-custom-studio-nosend.yml`: 2-job, clean-runner integration + inherited regression.

Modified existing files **without copying business logic**:
- `advanced-channel-registry.js` exposed as browser and Node UMD using the same factory.
- `advanced-ai-presentation-evaluator.js` exposed as browser and Node UMD using the same factory.
- No changes to ADV.3 signed action verifier or to V14.7 core pricing/policies.

## 3. QA evidence

At commit `bba9e57736d15dc28800237f0253c4c8d42f0fe7`:

- [ADV.4 CI #43800519494](https://github.com/ngoctien20/demo-git/actions/runs/43800519494) **SUCCESS 2/2 jobs**.
- ADV.4 crosswalk/security integration: **24/24 PASS**.
- Inherited ADV.3 structured: **18/18 PASS**.
- Inherited ADV.3 secure action: **25/25 PASS**.
- Inherited ADV.2 channel registry: **16/16 PASS**.
- Inherited ADV.1 presentation policy: **30/30 PASS**.
- V14.7 studio-core regression: **36/36 PASS**.
- **Total: 149/149 Node tests PASS**.
- Chromium: **4/4 viewport passes** at 320, 390, 768, 1280px. Tested Shop A/B/C price correctness, channel-scoped draft, save/export/reset semantics, fallback for ZBS, zero enabled action buttons, zero offsite requests and HTTP writes, zero page errors, no horizontal document overflow.
- Test output and 390px screenshot artifact are recorded by the CI run; screenshot artifact does **not** represent hosted deployment.
- CI initially found a UMD duplicate declaration; fixed before above PASS. Browser QA then identified missing ZBS-specific fallback evidence in preview; fixed to surface **original requested component** gate alongside selected TEXT fallback, without loosening authorization. Both failed runs remain visible for audit.

**Evidence boundaries:** 96 synthetic oracle cases in ADV.3 are test inputs, not 96 real AI-model answers. No GPT performance/cost/latency or actual Meta/Zalo carrier render QA. No authenticated Supabase Store JWT/RLS proof performed by this PR.

## 4. Release gates — NOT APPROVED

1. G0: resolve parallel ADV.2 registry PR #138 vs #144 into a single reviewed canonical release branch (crosswalk is a safe bridge, **not a merge**).
2. G1: Real merchant consent/Owner G2.3 and signed hosted JWT/RLS Store A/B isolation certification (current hosted schema lacked `public.stores`/`public.store_memberships` during prior audit).
3. G2: Actual provider account entitlement, Zalo Bot native UI verification, Zalo OA permissions, ZBS template and budget approvals, verified media/link allowlists.
4. G3: Private server-side action gateway, real ingress signer/verified identity, durable atomic nonce/replay store, Commerce authorization and confirmation.
5. G4: Measured low-cost real AI model presentation benchmark (intent/emphasis/action precision, confusion, P50/P95, tokens, cost).
6. G5: Mobile customer/merchant UAT, rollback/release governance, explicitly approved production switch.

Do not interpret client-side synthetic QA context, selectable Shop, localhost QA, preview-only signed-action placeholders or synthetic product data as authenticated access. Never use browser identity to authorize real actions.

## 5. Changes, risks, rollback and next checkpoint

- **Changes:** additive source and offline HTML/JS/QA; UMD wrappers on existing registry/evaluator only.
- **Risks:** diverging #138/#144 registries, wrong assumption of provider native capabilities, client-side scope spoofing if copied into production, and misuse of synthetic action preview as real authorization.
- **Rollback:** close Draft PR #154 or revert its commits. Parent PR #142 and #138 remain intact. No production or hosted rollback needed because no hosted/published mutation.
- **Next:** V15.2 ADV.5 — Canonical Registry Release Candidate × Advanced Studio Merchant UAT, after reviewing PR #138/#144 diffs and without promoting to production.
