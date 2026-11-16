# TIEN404 AI — V15.2 ADV.5 Canonical Registry RC × Merchant UAT

**Checkpoint:** 16/11/2026 JST.  
**Lifecycle:** `CANDIDATE` for **synthetic Merchant UAT only**, NOT `APPROVED` or `RELEASED`.  
**Branch:** `work/v152adv5-canonical-registry-merchant-uat-nosend-20261116`. **PR:** #159 OPEN DRAFT (child of PR #154).  
**QA HEAD before this documentation commit:** `28098f278f5ff81914d04f134faa76d7a8217c95`.

## 1. VERIFIED — Baseline and registry decision

- Existing ADV.2 PR #138: `work/v152adv2-channel-registry-nosend-20261116` HEAD `2cb5128ef4ffce11fb562805b82b698fe396fed5`. Keep this versioned, tenant/store/channel-scoped registry as the canonical technical source.
- Separate ADV.2 UX PR #144: `work/v152-adv1-adv2-capability-registry-nosend-20261116` HEAD `ebc29571c389e982bdc670a85df08157b3106133`. 13-feature *descriptive presentation* grid, not an entitlement authority.
- ADV.3 PR #142: `96a930181f1ef2feaacb77207683cd8c4a59f54e` baseline, Structured Output Evaluator and synthetic Ed25519 Secure Action Registry (disabled preview only).
- ADV.4 PR #154: `2feea7600631da0595a3666368cb6237d83e16b8`, 3 shops × 4 channels, mobile Studio with offline-only draft state.
- All four predecessor PRs checked OPEN DRAFT, not merged. ADV.5 is add-only to a separate Draft child.
- The ADV.5 `advanced-canonical-registry-rc.cjs` pins PR #138 as canonical, PR #144 as UX vocabulary, and audits 13 × 4 = 52 feature/channel cells. If version/contract drift or a privileged/provider-gated capability is detected, throw or fall back to TEXT; **never** grant real channel access.

## 2. IMPLEMENTED — Advanced Merchant UAT

- `qa/v147-custom-studio/advanced-merchant-uat.js`: 16 Vietnamese manual acceptance cases (mobile, Shop A/B/C prices, scope isolation across shops/channels, configuration edits/reset, AI heuristic preview, Messenger/Zalo fallback, Zalo OA/ZBS cost guard, order lookup privacy, stock signal, disabled actions, JSON QA).
- `advanced-merchant-uat-view.js`: responsive table, status `NOT_RUN/PASS/FAIL/NOT_APPLICABLE`, notes, reset and JSON export, all only in browser memory. **Any** self-reported pass (even 16/16) retains `merchantUatApproved:false`, `merchantIdentityIndependentlyVerified:false`, `releaseAuthorized:false`.
- Same ADV.4 HTML extended with UAT section. All storefront/pricing data are **synthetic** and locally scoped. No real credential, message send, payment, order creation, Google Sheet or hosted DB.
- `advanced-canonical-registry-rc.test.cjs`: 16 security/contract unit cases.
- `advanced-merchant-uat.test.cjs`: 20 UAT evidence/state tests.
- `advanced-merchant-uat-browser.test.cjs`: 4-width responsive and human-report gate QA.
- `build-adv5-standalone.py` creates an **offline single HTML** containing exact source JS, with strict `Content-Security-Policy` hash for its sole inline script. Browser does not need a web server to use this artifact.
- `advanced-merchant-uat-standalone-browser.test.cjs` tests **file://** execution across four viewports, no offsite requests or HTTP writes.
- `.github/workflows/v152-adv5-merchant-uat-nosend.yml` runs code/security unit + Chromium QA + isolated source/staging artifact uploads. No database/network send or deploy steps.
- Standalone HTML tested from CI artifact had SHA256 `3d4b2dfeeb62dd1b6d58f7bb83b426bedde02b6e9f87d01ce73d444b399527c7` (70,900 bytes).

## 3. TESTED — Verified evidence

[GitHub Actions #43802833380](https://github.com/ngoctien20/demo-git/actions/runs/43802833380) at exact source commit `28098f278f5ff81914d04f134faa76d7a8217c95`: **3/3 jobs SUCCESS**.

- **185/185** Node.js unit tests PASS: 16 canonical RC + 20 merchant UAT + 24 ADV.4 + 18 ADV.3 presentation + 25 ADV.3 secure action + 16 ADV.2 registry + 30 ADV.1 policy + 36 inherited V14.7 Studio.
- **12/12** Chromium viewport passes: ADV.4 Studio × 4, in-browser Merchant UAT × 4, downloaded single-file offline `file://` × 4 (320/390/768/1280 px).
- Verified 16 UAT rows, 13 channel-feature rows, correct synthetic shop prices, scope separation, disabled actions, UAT JSON report, absent network writes/requests, no page JS error, no horizontal document overflow.
- Verified the exact standalone HTML bytes match CI upload SHA256 above. Bundle ZIP and screenshot artifact attached to GitHub Actions run.
- **Not performed**: human merchant UAT (no actual reviewer results submitted), live model inference/cost/accuracy, actual provider UI/entitlements, authenticated hosted JWT/RLS Store proof, live cross-channel Commerce flow or any live message send.

## 4. Cloudflare staging readiness and safety gate

- Cloudflare account access read-only verified with subdomain `tienmobi208.workers.dev` and existing staging Workers. Did not overwrite `tien404-v147-custom-studio-synthetic-nosend-staging`.
- Workers account setting returns `default_usage_model=standard`. Account subscription/billing API returned **403 Billing Read unavailable**. Incremental spending cannot be verified.
- Therefore **NO PUBLIC CLOUDFLARE DEPLOYMENT** was performed. A synthetic offline single-file artifact is available as an immediate, no-server Merchant UAT path without new hosted requests. A dedicated, isolated hosted UAT address requires budget/account permission review and explicit approval if any additional charges arise.

## 5. Gates (not auto-approved)

- G0 `Owner/Consent`: genuine merchant Owner G2.3 evidence and explicit consent — **BLOCKED**.
- G1 `Store JWT/RLS`: same-Tenant Shop A/B real signed JWT hosted isolation — **BLOCKED**.
- G2 `Provider Entitlements`: Meta/Zalo account grants, native buttons, OA ZBS templates, approved media/link sources — **BLOCKED**.
- G3 `Trusted Actions`: production server signer, real verified ingress, durable atomic replay nonce store, Commerce authorization — **BLOCKED**.
- G4 `AI Benchmark`: actual model calls, cost, precision/recall, latency, structured output — **NOT TESTED** for ADV.5.
- G5 `Human Merchant UAT`: **NOT RUN**, pending self-report JSON + independent review.
- G6 `Hosted staging/public release`: **BLOCKED pending verified billing and approvals**; production remains **NO-GO**.

**Status labels:** VERIFIED = source/CI/account inspection; IMPLEMENTED = Draft only; TESTED = Node/Chromium synthetic; PROPOSED = owner/provider integrations; BLOCKED = real hosted/permitted operations.

## 6. Merchant UAT instructions

1. Download `TIEN404_ADV5_Merchant_UAT_Offline.html` from the verified CI artifact or handoff. Open with Chrome/Edge on desktop or mobile; no Supabase/n8n login or API keys are needed. The `file://` offline route was tested on GitHub Actions Chromium.
2. Choose Shop A/B/C and one of Messenger, Zalo Bot, Zalo OA, Website Widget. Change bot name/greeting/tone, save local draft and inspect price/stock and fallback; do not use real customer data.
3. In **“Chủ cửa hàng tự kiểm tra — UAT thử nghiệm”**, assess 16 questions. Choose `Đạt / Chưa đạt / Không áp dụng`, and optionally add non-sensitive observations.
4. Click **“Xuất kết quả UAT JSON”**; copy that JSON back to the project/chat for an independent technical review. Export is local; it is not submitted automatically or proof of Owner authority.
5. New browser session/reset wipes in-memory draft and UAT statuses. Nothing is published.

## 7. Rollback and next phase

Close Draft PR #159 or revert add-only branch commits. No production rollback is needed since there were **no n8n, Cloudflare, Supabase, GitHub Pages, credential, billing, order, stock, Meta/Zalo or production release modifications**.

Next: collect one actual independent Merchant UAT report, fix P1 usability defects, reconcile final provider-native feature entitlement and decide staging billing/approval. **Do not merge/release automatically.**


## 8. UAT self-report receipt — nhận 16/11/2026 JST

**RECEIVED / STRUCTURALLY CHECKED / SELF_REPORTED_PASS** — đã nhận JSON qua cuộc trò chuyện từ người thử, `generatedAt=2026-11-16T05:02:01.952Z` (14:02 JST). Hợp đồng, 16 ID UAT01–UAT16 và bộ đếm nhất quán: **PASS 16, FAIL 0, NOT_RUN 0, NOT_APPLICABLE 0**. Cả 16 trường observation để trống. UI preview tự báo `renderCount=111`, không phải bằng chứng AI inference hay network execution.

**Lưu ý sửa checkpoint trước đó:** Mệnh đề “chưa có UAT thật được gửi” trong §3/§5 là trạng thái tại thời điểm checkpoint đầu tiên; **nay đã nhận một lượt UAT tự đánh giá qua chat**, nhưng `independentMerchantAcceptance=false`, `merchantIdentityIndependentlyVerified=false`, `merchantUatApproved=false`, `releaseAuthorized=false` và chưa có chứng cứ độc lập cho từng thao tác. Không chuyển Release Candidate sang Approved/Released.

[Báo cáo tiếp nhận đã ẩn danh, không chứa dữ liệu khách hàng](./V15_2_ADV5_MERCHANT_UAT_SELF_REPORT_RECEIPT_20261116.md). Không thay đổi code sản phẩm, quyền Owner/GRANT, Published, hosted DB hay billing. **Bước tiếp:** xem xét UX Mobile UAT card-vs-table như cải tiến P2 riêng, tiếp tục thu phản hồi và chứng nhận các cổng Owner/JWT-RLS/Provider/Action Gateway.
