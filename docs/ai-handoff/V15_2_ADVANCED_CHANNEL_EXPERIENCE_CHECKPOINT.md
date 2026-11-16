# TIEN404 AI — V15.2 Advanced Channel Experience & AI Presentation Lab

Date: 2026-11-16 JST. Lifecycle: **EXPERIMENTAL / DRAFT / NO-SEND / NO HOSTED WRITE / NOT SALES LITE DEFAULT**.

## User request and product scope
Develop an **optional Advanced/Custom Experience add-on**, not a core Sales Lite feature: Messenger cards/carousels/quick replies/page menu/public webview, Zalo Bot native documented rich text/photo plus safe numbered text fallback, Zalo OA CTA/menu where independently authorized, and a separately designed website chat widget. AI should decide when to emphasize a verified price, use red text for a verified low-stock/risk warning, italicize a disclaimer, propose product imagery, contextual buttons and trusted links. Never let free-form AI output create provider payloads or execute tools directly. No separate AI model per channel.

## Read-only predecessor evidence
- V14.7-03 synthetic Owner UAT **5/5 self reported**, PR #117 (not a live provider certification).
- V14.7-04/05 PR #118 HEAD \`1bdc6f7d74e2e8ea2b2b15651831e50c6b8c980e\`, source-only \`experience-lab.js\`, existing \`studio-core.js\`, visual preview, inherited V13.6M signed synthetic adapter.
- V15.0-09C PR #132 focuses independent G2.3 Owner & disposable recovery and is not a real AI benchmark or Messenger→Zalo live order continuity certification.
- V15 Sales Lite PR #128 and Store Security PR #129/#131/#133 stay **separate**. Hosted \`public.stores\` and \`public.store_memberships\` were absent in prior read-only audit. No cross-store hosted authorization certification.
- n8n Messenger Rich UI manual QA \`X0MwwQ7LRUqfOVjM\` remains inactive; existing Published Messenger and Zalo graphs remain untouched.

## Provider capability matrix / legal guard
| Feature | Messenger | Zalo Bot | Zalo OA | Website |
|---|---|---|---|---|
| Text | Documented | Documented | Account/message eligibility | Local UI |
| Red/italic/bold native | NOT guaranteed | Documented rich styles, strict codes + UTF-16 offsets | Template/account-specific | Safe styled text spans |
| Cards / carousel | Meta Generic template documented | Native unverified | Template/account-specific | Local carousel UI |
| Image | Meta template and media documented | sendPhoto documented | Account/message eligibility | Approved media only |
| Buttons/actions | Quick replies/template buttons documented | Native inline buttons **unverified**, numbered text fallback | CTA/menu permission required | Widget action renderer |
| External URL | Platform verified approved URL only | Plain vetted URL where permitted | Account/message eligibility | Allowlisted HTTPS URL |
| ZBS Template | N/A | N/A | Approval, eligibility and expense gate | N/A |

Primary references:
- Meta: https://developers.facebook.com/docs/messenger-platform/send-messages/templates
- Zalo Bot Rich Text: https://bot.zapps.me/docs/apis/sendMessage/
- Zalo Bot Photo: https://bot.zapps.me/docs/apis/sendPhoto/
- Zalo OA: https://oa.zaloapp.com/home/function/interaction

Actual account-level entitlement, render behavior, provider send rights, template approval, URL link domains and billing are **not verified** by documentation alone. Do not imply arbitrary native red/italic Messenger styling, native Zalo Bot inline buttons or entitlement to paid ZBS.

## Implemented in this isolated child Draft
1. \`qa/v147-custom-studio/advanced-presentation-policy.js\`: UMD policy module, strict allowlisted semantic AI intent, no free-form price/action/style/store/url, store-scoped synthetic fixture, product state, semantic emphasis (price/warning/note), capability-specific preview and safe fallback. Action proposals always have \`interactive:false\` and \`requiresSignedServerAction:true\`. Photo URL and link remain null. NO send/Orders/real model calls.
2. \`qa/v147-custom-studio/advanced-presentation-policy.test.cjs\`: 30+ deterministic QA cases across Shops A/B/C and four channels, low-stock red only from fixture stock, Messenger lack of native color, Zalo UTF-16 spans, OA fallback, website safe text, order lookup privacy, forged payload denial.
3. \`qa/v147-custom-studio/advanced-preview.html\` + \`advanced-preview.js\`: Vietnamese mobile-first, browser-only preview with store/channel selector, locally deterministic **heuristic QA classifier** (NOT an AI model), styled text, synthetic product card and disabled buttons. CSP connect-src none; no image requests or browser storage.
4. \`.github/workflows/v152-advanced-presentation-nosend-qa.yml\`: Node syntax and policy tests, inherited V14.7 tests, static no-send checks.

No existing sources overwritten. Parent V14.7 PR untouched. New work is intentionally **not merged** into V15 Sales Lite; integration will require dependency reconciliation and authorization gates.

## The AI training/evaluation plan (NOT completed by this source-only work)
Define model structured output: \`{intent, response_text?, visual_hints?}\` as **untrusted proposal**; decision gate must derive real price/stock/media/authorization from server-only facts. Build a privately versioned labeled presentation dataset (FAQ → text, catalog → product card/image, price → bold, verified low stock → warning red where supported, policy note → italic, link only after verified HTTPS allowlist, customer PII/order lookup → auth/denial). Use the existing affordable QA model **only after approved model/API budget and entitlements**. Evaluate structured-output agreement, provider fallback correctness, tool safety, hallucination, injection, latency and token cost. Do not call a deterministic heuristic “trained model” or present passing synthetic tests as AI accuracy.

## Gates before any LIVE channel integration
- G0: verified Store ownership & hosted Store RLS, shop/channel mapping, merchant consent and credentials approval.
- G1: independently verified Meta Page/Zalo Bot/OA permissions, message window/eligibility, template approval and costs.
- G2: server-issued short-lived signed postback/actions; nonce replay denial, role re-authorization on every sensitive action, audit, safe HTTPS asset/link registry, idempotency.
- G3: low-cost model real benchmark on authorized QA corpus, fail-closed structured output and negative tests.
- G4: staged No-Send HTTP payload inspection, synthetic browser UAT, then separate approved one-shot real provider verification with rollback.
- G5: production review and explicit user approval; **not automatic**.

## Test / QA evidence
Run latest exact HEAD GitHub Action before marking TESTED; until then **IMPLEMENTED SOURCE-ONLY**, not TESTED. Preview UI has not been independently browser-UAT certified by code tests. No provider messages or paid AI calls.

## Rollback
Close/revert this Draft PR or its branch, leaving V14.7-04/05 PR #118, V15 Sales Lite, n8n Published, Cloudflare workers and Supabase unchanged. No deployment or state migration to reverse.
