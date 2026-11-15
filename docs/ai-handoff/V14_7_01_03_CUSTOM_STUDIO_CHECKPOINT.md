# TIEN404 AI V14.7 — Custom Bot Studio Foundation checkpoint

**Checkpoint 2026-11-16 JST. Status: IMPLEMENTED in isolated Draft branch, initial QA awaiting CI.**
**Base:** V14.6-01 PR #114 HEAD `afe1b16cb37dbd758399c0c0768e4681bc008fe2`.

## 1. Current verified state

- GitHub PR #114 still OPEN DRAFT; inherited source-only Messenger composition QA at exact base SHA, not real L2.
- Other related PRs #86 Store Knowledge/RLS, #94 Unified Channel/Widget, #95 Messenger Replay, #99 locked Worker, #103 Zalo UAT01, #110 Messenger 4-flow all OPEN DRAFT; #103 has moved to HEAD `6378ba0a6bdd6d25adb8e2d4116ad5926cb6f078`.
- n8n read-only scan: **101 total workflows / 19 active** (prior 100/19 stale); Messenger published `Z7FdV7uDvApfbURQ` version `d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92`, 27 nodes. Zalo ingress `yIJk8LvJoLF40Z62` version `8ca4a6f6-ab3f-42f1-8637-d4f5db790a3e`, 10 nodes. Both active and Draft=Published.
- Hosted Store RLS, full Auth-dependent restore, trusted real Shop A/B same-tenant identity, live Meta tester entitlement, and provider sends not verified here.
- Official docs surveyed and recorded in `V14_7_01_CHANNEL_CAPABILITY_MATRIX.md`; Zalo Bot and Zalo OA are **different products**.

## 2. Implemented (source only)

- `qa/v147-custom-studio/studio-core.js`: reusable in-memory, versioned configuration per shop/channel, synthetic A/B same tenant and C other tenant, same SKU/different VND, allowlisted role/fields/actions, Global Policy locked, never publish or write hosted. Works in browser and node:test. `CONTRACT_FIELDS` suggests future schema but **no DDL/DML**.
- `qa/v147-custom-studio/studio-core.test.cjs`: 36 security and behavior tests including scopes, XSS-like form input, order confirmation, quote correctness and no-send.
- `qa/v147-custom-studio/index.html` + `studio-ui.js`: Vietnamese mobile-first preview UI; 3 shops × 4 channels; editable assistant name, greeting, tone, color, menu, stock display; four simulated flows (Consult / Quote / Order Request / Support), auto text fallback for Zalo Bot/OA, JSON export with no real secrets; resets on reload; no browser storage, network API, AI, customer data or provider send.
- `qa/v147-custom-studio/browser.test.cjs`: Playwright 320/360/390/430/768/1280 and export; tests isolation, UI updates, Zalo numbered fallback, no external requests / HTTP writes.
- `.github/workflows/v147-custom-studio-no-send-qa.yml`: Node source/contract QA, inherited bridge/Messenger/Channel tests and Playwright Chromium. No secrets.

## 3. Capability and actual scope

See official-sourced matrix. Documented capability does **not** certify current Page/Bot/OA permission or send. In preview, Messenger product card UI is a TIEN404 mock; Zalo Bot native carousel/buttons remain UNKNOWN; Zalo OA is separate. Web Widget is only TIEN404-owned synthetic UI.

## 4. Tests / evidence

Prior verified baseline: PR #114 CI run 43753325981 at base HEAD was SUCCESS. New V14.7 CI must be checked at final commit before claiming TESTED. No service credential, provider token, transaction, order or hosted data is modified.

## 5. P0/P1 blockers

P0: full recovery + row-level independent Store ownership; hosted Store RLS and JWT signed identity A/B/C; trusted Meta Page→Store and Zalo Bot→Store→Owner independent mapping.
P1: real bounded AI, Catalog readback, atomic Order Request and durable unsent Outbox integration; live providers; release entitlements and reviewer signoff; real Staff Inbox/handoff.

## 6. Owner review / next steps

Manual test after CI: open static preview `qa/v147-custom-studio/index.html` from the isolated staging preview server or downloadable local file; pick shops A/B/C and channels Messenger/Zalo Bot/OA/Web Widget, edit greeting/theme, click "Lưu bản nháp", test 4 flows, download JSON. **No public staging URL claimed until separately verified/deployed.**

Next phases: V14.7-04 Messenger Rich UI component-level reuse; V14.7-05 Zalo Bot/OA Adapter capability gate; V14.7-06 Industry templates; V14.7-07 Real AI bounded no-send only after required scope and approval. Merchant self-service and hosted publish remain gated.

## 7. Rollback

Close this isolated stacked Draft PR or revert only V14.7 files. No hosted rollback required because **no live service was changed**.

## 8. Approval scope

The current request authorizes source-only staging, QA and Draft PR. It **does not** authorize Meta/Zalo sends, hosted Store migrations, credential/GRANT updates, n8n Published changes, billing actions or production promotion.

## 9. Hosted synthetic preview — VERIFIED

A **new isolated Cloudflare Worker** was created for owner visual QA:

- Worker name: `tien404-v147-custom-studio-synthetic-nosend-staging`
- URL: https://tien404-v147-custom-studio-synthetic-nosend-staging.tienmobi208.workers.dev/
- Deployment ID: `1b16388b-369b-4c88-8936-beb19db7b60a`
- Version ID: `64dba962-42c1-4e58-b1d7-f4169e3f4705` (100% deployment)
- Account-level Workers subdomain enabled **only for this new Worker**; no custom production routes changed.
- Verified settings: **zero bindings**, no D1, R2, Supabase, AI model, Meta/Zalo tokens, or customer Orders.
- Worker static GET endpoints are `/`, `/studio-core.js`, `/studio-ui.js`; `GET /health` reports synthetic no-send zeros. **All POST and other non-GET/HEAD return HTTP 423**. Unknown paths 404; CSP blocks external connect.
- GitHub Actions [43756529465](https://github.com/ngoctien20/demo-git/actions/runs/43756529465) verified all three jobs SUCCESS at source HEAD `8cec8e389d36923faf5a027a37f81343a6ce53a4`: Node contract/security, Chromium six viewports, live HTTP GET health/assets and POST 423.
- Any future updates to this Worker must be pinned to verified GitHub source and re-run smoke; the Worker is not part of commercial product release.

### Owner manual checklist for synthetic demo

1. Open the isolated staging URL; verify **EXPERIMENTAL** and **KHÔNG GỬI TIN THẬT** labels.
2. Select Shop A and Shop B (same tenant), then C (other tenant); observe unique product name/price.
3. Choose Messenger; verify card and preview actions. Choose Zalo Bot; see numbered **text fallback**, no imaginary native buttons.
4. Switch Zalo OA and Website Widget; check distinct provider label and preview.
5. Change assistant name, greeting, tone, theme, menu; press **Lưu bản nháp**, then check visual output. Switch to another shop/channel and confirm it retains independent settings.
6. Try **Tư vấn / Báo giá / Yêu cầu đơn / Hỗ trợ**, then **Kiểm tra 4 luồng thử nghiệm**; this tests only scripted fixtures.
7. Export JSON to inspect synthetic draft. Reload to confirm no backend/persistent storage; optionally use **Khôi phục mẫu QA**.
8. Confirm no genuine Messenger/Zalo messages or Orders are produced; only a user-visible simulation.

### Security note

The worker URL is publicly reachable and **has no authentication**; only synthetic data and in-memory per-browser drafts may be used. Never insert merchant secrets or real customer information. Internal Studio authentication, Store JWT/RLS, real AI inference, provider account permissions, subscription enforcement and merchant release UI remain BLOCKED.

### QA evidence caveat

The run above applies to source head `8cec8e389d36923faf5a027a37f81343a6ce53a4`; this documentation-only commit will have a newer SHA. Re-verify the new HEAD workflow before claiming final QA.
