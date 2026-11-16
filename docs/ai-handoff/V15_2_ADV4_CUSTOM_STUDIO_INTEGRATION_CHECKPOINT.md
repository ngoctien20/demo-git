# TIEN404 AI — V15.2 ADV.4 Advanced Custom Bot Studio Integration × Safe Channel Adapter Contracts

Checkpoint: 2026-11-16 JST. **Source-only DRAFT / EXPERIMENTAL / NO SEND / NO HOSTED WRITE / NOT SALES LITE DEFAULT.**

## 1. Actual audit before implementation

- Parent [PR #156](https://github.com/ngoctien20/demo-git/pull/156) OPEN DRAFT, exact audited HEAD \`d652e36cfbf3b75ef6d9846e5c131954383d3f67\`; 6/6 GitHub Actions SUCCESS.
- Ancestors #148 (ADV.3), #144 (ADV.1/ADV.2), #134, #118 (V14.7 Custom Bot Studio) remain OPEN DRAFT, not merged or released.
- V14.7 source \`qa/v147-custom-studio/studio-core.js\` already has \`createStudio\`, per Store/Channel in-memory drafts, safe editable fields and synthetic previews; \`studio-ui.js\` drives existing UI. Work MUST extend rather than replace V14.7.
- ADV3B independent 68-case diagnostic shows deterministic heuristic **15/68** exact and **11/20 high-risk misrouted**. This is not AI model accuracy. ADV3B demonstrates the exact same HMAC QA action can be consumed on two instances with separate in-memory nonce maps. Both findings are **NO-GO for production**. ADV4 does not claim to fix them.
- Live n8n Messenger Rich UI \`X0MwwQ7LRUqfOVjM\` and Zalo RichText \`qWMu4n1wLkTZBNpI\` remain inactive. No writes or activation here.
- Supabase staging \`ifxlvrhyjhbzbrkdsida\`: public tables reviewed read-only; no hosted Store-level ownership/RLS write or migration. No \`public.stores\` / \`public.store_memberships\` present in the latest public table list.
- All real provider sends and paid model inference remain gated and unapproved for this change.

## 2. ADV4 implementation

**Extend the existing Studio, not a new dashboard.**

1. \`qa/v147-custom-studio/advanced-studio-integration.js\`: an optional Advanced-only controller and immutable per-\`tenant_id + store_id + channel\` QA revision history. Uses current V14.7 base Draft through a read-only bridge. Controls \`presentationPreset\`, selected inactive \`ctaAction\`, safe QA \`mediaRef\` and \`linkRef\`. Shop A/B/C synthetic assets contain NO approved URLs, external URLs, secrets, verified identity or entitlement.
2. Explicit expected revision + expected base Bot version checks. On V14.7 parent change, advanced preview/save fails closed until explicitly rebased by internal QA. Rollback restores historical content as a NEW increasing revision; no overwriting earlier snapshots.
3. \`qa/v147-custom-studio/advanced-adapter-contracts.js\`: 4-channel **conceptual** Messenger/Zalo Bot/Zalo OA/Website Widget envelopes. They reuse the certified ADV.1/ADV.2 presentation policy and registry; output only text, QA media/link references, inactive CTA intent and provider capability/fallback evidence. \`nativeProviderPayload:null\`, \`canSend:false\`, \`canExecute:false\`; no sender IDs or real provider API schema claims.
4. \`studio-ui.js\`: additive read-only \`T404AdvancedLabBridge\` to existing V14.7 Studio state. Does not grant hosted authorization or modify merchant credentials.
5. \`index.html\` and \`advanced-studio-ui.js\`: Vietnamese mobile-first ADV4 panel INSIDE the existing Studio. Chooses shop/channel from existing controls, supports save/rollback/rebase/export preview and shows disabled CTA. No independent data store, fetch, browser storage, external media or live send.
6. Tests \`advanced-studio-integration.test.cjs\` (50 tests), \`advanced-adapter-contracts.test.cjs\` (20 tests), \`advanced-studio-browser.test.cjs\` (6 responsive widths, cross-store/channel switching, base rebase, no network/writes).
7. CI \`.github/workflows/v152-adv4-custom-studio-nosend.yml\`: syntax, security static checks, inherited ADV3/3B/ADV2/ADV1/V14.7, new browser and JSON/visual artifact.

## 3. Explicit product boundary

Advanced/Custom Experience add-on is **NOT Sales Lite default**. Since no real subscriptions or verified Merchant entitlements exist in this source-only lab, it is an internal staff-only test control. It MUST NOT be displayed as a paid feature already enabled for real shops. No merchant account identity or entitlement is asserted from synthetic staff UI.

**No real capabilities:**
- No Meta Messenger Page Generic Template/quick reply/action postbacks issued.
- No Zalo Bot real text styles/photo/quick buttons sent.
- No Zalo OA template approval, ZBS or spend verified; paid/eligibility gate stays LOCKED.
- No real Website Chat Widget publishing, customer identity, Commerce Orders, Knowledge retrieval or cross-channel E2E.
- No model fine-tuning or low-cost real model inference in this PR.
- No signed tokens created in browser. ADV3 HMAC module stays in Node-only QA with an in-memory nonce ledger that is proven unsuitable for distributed action execution.

## 4. QA evidence and acceptance

To call **TESTED** require GitHub Actions SUCCESS at exact final child PR HEAD. Verify:
- 50 new versioning & store security tests,
- 20 new provider adapter contract tests,
- 6 browser viewport widths with A/B/C, all 4 channels, draft save/rebase/rollback, blocked CTA & network,
- inherited ADV3 53 action tests and 68-case diagnostic,
- independent NO-SEND checks.

Green offline/visual tests certify Draft QA behavior ONLY. Merchant UAT, real model benchmark, hosted RLS, provider permissions, official platform templates, backend atomic replay and actual first customer remain blocked.

## 5. Next gates

**ADV.5 — Safe Channel Adapter Integration × Signed Action Backend Design**
- Independent backend Store/Owner/JWT/RLS gate and provider channel binding verified.
- Versioned approved media/link registry with real allowed HTTPS URLs, signed postbacks and quota limits.
- Atomic durable nonce & business transaction idempotency designed and approved for hosted staging; no check-then-insert.
- Source-only No-Send protocol contract validation first, then explicitly approved one-shot send.
- Real model benchmarking with capped budget separately approved, report hallucinations, false intent/unsafe actions, P50/P95 and actual token cost.

**NO-GO until those gates are proven**, regardless of source CI.

## 6. Rollback / checkpoint

Rollback by closing this new child Draft PR (or reverting its additive changes); PR #156/#148/#144/#134/#118 untouched, Sales Lite, n8n Published, Supabase Auth/RLS/GRANT/Orders, Cloudflare sites and merchant billing unchanged. No hosted migration/backups are needed for these source-only changes. Do not claim the PR has been merged.
