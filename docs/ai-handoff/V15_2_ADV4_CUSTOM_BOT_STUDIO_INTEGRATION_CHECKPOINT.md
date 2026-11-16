# TIEN404 AI — V15.2-ADV.4 CHECKPOINT

Date: 2026-11-16 JST
Stage: EXPERIMENTAL — DRAFT — NO SEND — NO PAID MODEL — NO HOSTED WRITE
Product: Advanced / Custom Experience Add-on; not part of Sales Lite default.

## 1. Verified dependencies
- Parent PR #142 was open Draft, HEAD 29d4758b4c59dc65e1a11c9dda2e92560369c6bb.
- Parent PR #138 was open Draft, HEAD 2cb5128ef4ffce11fb562805b82b698fe396fed5.
- Parent PR #134 was open Draft, HEAD 867a0232af5be8a20f93555c62ba43f7e64ed214.
- Existing V14.7 #117/#118 remained Draft. PR #145 is a separate child of #142, not merged.
- Existing V14.7 Studio is preserved with only a link to the child Advanced Studio.

## 2. Implementation
- advanced-channel-registry.js and advanced-ai-presentation-evaluator.js: browser/Node compatibility through small UMD adapter, same single source of policy logic. No other branch modified.
- advanced-studio.html: Vietnamese responsive UI, self-contained local assets and strict Content Security Policy: no connect, image, iframe, or form action.
- advanced-studio-ui.js: Shop A/B/C, four channel selection, eight manually selected intent scenarios, semantic emphasis and approved-component previews, safe DOM text renderer, disabled actions, device switch, QA preview.
- Store branding draft fields use existing V14.7 Studio in-memory contract. No system prompt, credential, privileged role or tenant ownership editing.
- Draft version history isolated per Shop and channel. Restoring an earlier snapshot creates a new in-memory draft version; no persistent revision history is claimed.
- Local JSON export is a user-initiated QA artifact, NOT signed or approved configuration.
- Approval and Publish actions are disabled. No API calls, external assets or provider send pathways exist in the new frontend.

## 3. Safety invariants
- Model/user presentation proposal is strictly validated by ADV.3 evaluator. No arbitrary HTML, SQL, price, stock, URL, postback or order creation accepted.
- Canonical demo catalog truth from signed-like synthetic fixtures only; not hosted Commerce data or real authorization evidence.
- Unsupported provider affordances gracefully fall back to text.
- Zalo OA ZBS paid template remains locked; native Zalo Bot buttons/carousel not claimed.
- Suspicious merchant branding text fails closed; all dynamic DOM uses textContent or createTextNode.
- Action buttons remain disabled, and Store/customer/order permissions must be rechecked by a future authenticated backend.
- Consumer data must not be entered into this public-source QA demo; tenant isolation shown is synthetic and not real hosted RLS.

## 4. QA evidence
- New GitHub workflow v152-adv4-studio-nosend-qa.yml:
  a) Node syntax, existing ADV.3/ADV.2/V15.2/V14.7 contract regression.
  b) CSP, static no-send, no-storage, no-network and no-credential scan.
  c) Playwright 320/360/390/430/768/1280 px: Shop A/B/C price isolation, Zalo rich text stock warning grounded in fixtures, OA template denial, Shop-channel draft save and rollback, malicious markup denial, disabled controls, local export and zero external requests/writes.
- CI PASS must be verified on PR #145 exact HEAD before calling this browser TESTED.
- CI does not certify actual production responsiveness, model inference, API acknowledgements or hosted Auth/JWT/RLS.

## 5. Outstanding P0/P1
P0: Independently prove Store Ownership and JWT/RLS on hosted Shop A/B, including cross-store denial.
P0: Shared Commerce persisted order lookup and authorized Messenger-to-Zalo identity continuity.
P0: Review hosted elevated RPC EXECUTE exposures without changing security permissions in this PR.
P1: Authorized low-cost model benchmark against PRIVATE labeled dataset.
P1: Verified media/link allowlist, signed action registry, replay/expiry/idempotency, provider entitlements and templates.
P1: Real cross-channel latency/performance measurement and Owner UAT.

## 6. Approval gates and rollback
- User approval required before live Messenger/Zalo sends, paid model runs, hosted writes/migrations, security rights, credential changes, billing or production publish.
- Advanced is optional and must not break Sales Lite.
- Rollback is closing Draft PR #145 or reverting branch work/v152adv4-advanced-studio-integrated-nosend-20261116. No database backup restore or workflow rollback needed because no hosted mutation occurred.

## 7. Next milestone
V15.2-ADV.5 — No-Send Channel Adapter Integration:
verify independently per-account Meta/Zalo Bot/Zalo OA capabilities; map proposals into strictly validated provider preview payloads; implement signed backend Action Registry draft; test feature flags, iframe/widget CSP, mobile Owner UAT, fail-closed channel fallback. No LIVE send until separate Owner and provider approval.
