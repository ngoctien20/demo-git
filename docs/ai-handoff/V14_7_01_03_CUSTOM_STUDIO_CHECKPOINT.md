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
