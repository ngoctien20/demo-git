# TIEN404 V14.7-04/05 — Owner Receipt, Messenger Rich UI + Zalo Bot/OA Lab

**2026-11-16 JST.** Lifecycle: **EXPERIMENTAL / DRAFT / NO-SEND**.

## 1. Owner acceptance from V14.7-03

User explicitly reported **5/5 PASS** for:
1. Switching Shop A/B/C with correct synthetic products and isolated prices.
2. Switching Messenger, Zalo Bot, Zalo OA and Website Widget.
3. Changing bot name, greeting, color and saving an in-memory draft.
4. Exercising CONSULT, QUOTE, ORDER REQUEST and SUPPORT.
5. Checking per-store/channel draft separation and exporting JSON.

Receipt recorded as a GitHub PR #117 conversation comment. Classification: **OWNER_SELF_REPORTED_SYNTHETIC_UAT**; not a cryptographically signed attestation, a provider send or a real AI/RLS test. Independent automated browser/Worker QA from V14.7-03: CI [43756659860](https://github.com/ngoctien20/demo-git/actions/runs/43756659860), 3/3 SUCCESS at `585b8cb3d37833e1aa84150bdcf0c4456771e3c4`.

## 2. Verified starting point

- Parent #117 remains **OPEN DRAFT**, HEAD `585b8cb3d37833e1aa84150bdcf0c4456771e3c4`, based on #114.
- Zalo PR #103 advanced independently to `0f869fd5c928d34162e11756ac47d3f598abfeb4`; do not merge or reuse its unverified account-level bindings.
- Isolated Cloudflare visual staging worker `tien404-v147-custom-studio-synthetic-nosend-staging`, previous deployment `1b16388b-369b-4c88-8936-beb19db7b60a`, version `64dba962-42c1-4e58-b1d7-f4169e3f4705`, subdomain enabled; **0 bindings**. This is a public synthetic-only UI; no real data or secrets.
- No Supabase hosted writes, n8n Published changes or Meta/Zalo live send authorized.

## 3. Capability facts, not inference

- Meta official Messenger Quick Start describes Generic Template with title, subtitle, image, buttons, and other message templates: https://developers.facebook.com/docs/messenger-platform/getting-started/quick-start
- Existing V13.6M source adapter `qa/messenger-rich-v136m/adapter.cjs` already provides signed synthetic carousel, quick replies, Page persistent menu and public webview contracts. It is reused by component tests; new browser Lab is **visual only**, not an outgoing Graph API payload.
- Zalo Bot official `sendMessage`: text max 2,000 characters, `parse_mode` or `text_styles` alternative; style run offsets/lengths use **UTF-16**, approved style codes are a closed set. Ref: https://docs.zaloplatforms.com/docs/BOT/apis/sendMessage
- Zalo Bot official `sendPhoto`: photo URL required, caption optional max 2,000 chars: https://docs.zaloplatforms.com/docs/BOT/apis/sendPhoto
- OA official documentation 2026 separates conversational messages (subject to OA interaction rules) from ZBS Template Message. It describes OA message CTA and other formats but does not prove currently connected merchant permissions, API scopes or approved template IDs: https://oa.zalo.me/home/documents/guides/tong-quan-cac-loai-tin-nhan-tren-zalo-official-account-_3651713298729094511?tab=library and https://oa.zalo.me/home/function/interaction
- **Zalo Bot Carousel, native inline buttons, OA template send permission are not VERIFIED on current account.** The Lab must never call them.

## 4. Implemented in this isolated child Draft

1. `qa/v147-custom-studio/experience-lab.js`: strict allowlisted channel-specific source-only preview:
   - Messenger: STANDARD / CAROUSEL / QUICK_REPLIES / PERSISTENT_MENU / WEBVIEW.
   - Zalo Bot: STANDARD / RICH_TEXT / PHOTO_CAPTION / NUMBERED_MENU.
   - Zalo OA: STANDARD / OA_CTA / OA_MENU / ZBS_TEMPLATE with cost/approval **blocked**.
   - Website Widget: STANDARD, preserving previously accepted V14.7-03.
   - Verified immutable synthetic scope Shop A/B (same tenant) and C other tenant, same SKU with different prices, no actual product images or browser authentication, zero model/provider/order calls and publish denied.
2. `experience-lab.test.cjs`: 28 new contract/negative tests.
3. `messenger-adapter-inheritance.test.cjs`: 8 reuse/negative tests on existing V13.6M signed adapter (synthetic only, not real Meta HMAC/permissions).
4. `index.html` + `studio-ui.js`: add Rich UI mode selector with carousel, menu, quick replies, Webview, Zalo Bot text style/photo placeholder, OA CTA/ZBS locked mock. DOM textContent only. All existing editor controls and four sales flows retained.
5. `experience-browser.test.cjs`: six widths and cross-shop/provider UI assertions; zero external requests, no write methods.
6. `.github/workflows/v14704-05-rich-nosend-qa.yml`: 36 new adapter/experience tests + inherited baseline + browser regression; no secrets.
7. All functionality remains **experimental in-memory synthetic preview**. No hosted schema change or provider send.

## 5. Test plan and acceptance proof

Must verify GitHub Actions at **exact final HEAD** before marking TESTED; a commit containing files is only IMPLEMENTED.

A legitimate V14.7-04/05 owner UAT may certify only the visual component. Real provider proof requires authorized Page/Bot/OA owner identity, application permission, narrowly capped test and separate approval.

## 6. P0/P1 blockers

P0: hosted full recovery and independent four-row ownership, Store A/B/C JWT/RLS, real Meta Page→Store mapping, real Zalo Bot→Store→Owner attestation. Zalo OA lacks owner entitlement/template permission proof.
P1: signed provider send under approved cap, real bounded AI/catalog/stock trace, durable Order/Outbox, rate limits, approved ZBS spend and rollback. These stages remain NO-GO.

## 7. Rollback and release gates

Preserve parent PR #117 unchanged. For code rollback, close this child Draft or revert its diff. If isolated Worker staging receives a new version later, restore prior version `64dba962-42c1-4e58-b1d7-f4169e3f4705` or disable **only** that Worker's workers.dev subdomain. Do not affect production, Zalo, Messenger, Cloudflare routes or existing customer Orders.

No merge, production publish, paid service, credential, GRANT, RLS migration or real send without independent approval.
