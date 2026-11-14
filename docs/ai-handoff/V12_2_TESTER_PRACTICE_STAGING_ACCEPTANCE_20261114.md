# TIEN404 AI V12.2 — Tester Practice & Access Acceptance Checkpoint

**Ngày:** 2026-11-14 (JST)  
**Phạm vi:** Render Auth staging, Supabase `tien404-staging`, GitHub staging. Không chỉnh sửa production, workflow Published, Orders thật hoặc credentials.
**Trạng thái:** IMPLEMENTED + DEPLOYED + TESTED ở lớp source, RLS, HTTP và browser mock. **Thử nghiệm bằng phiên Auth người dùng thật vẫn cần nghiệm thu thủ công**.

## 1. Vấn đề gốc VERIFIED

Sau khi owner cấp quyền cho Tester qua V12.2: có **1 tài khoản Tester approved còn hạn**, nhưng **0 active module assignment**, nên `tester.html` chủ động ẩn toàn bộ case. Ngoài ra chỉ có 1 case mẫu Sheets READY; 132 bài AI SALES là CANDIDATE pending, không thể mở an toàn. Messenger và AI SALES chưa có endpoint QA website riêng, Zalo/Telegram/Commerce chưa qua gate triển khai cho bạn bè.

## 2. Thay đổi thực hiện

- Gán đúng một module `sheets` READY cho một Tester approved đã có trong staging. Không thay đổi hạn truy cập hoặc quyền channel khác.
- Bổ sung **14 case** `SHEET-SIM-002..015` từ SQL idempotent `qa/tester_portal/V12_2_SYNTHETIC_SHEETS_PRACTICE_CANDIDATES.sql`; giữ lại `SHEET-QA-001` trước đó. Tất cả dữ liệu này được ghi rõ là **giả lập**.
- `assets/tester-sandbox.mjs`: bộ kiểm tra SKU, số lượng nguyên dương, tồn mẫu, giá bán mẫu, từ chối giá khách và giá tiền không hợp lệ, tính tổng VND cố định. Không có network request, LLM, ghi Order, cập nhật stock hay gọi webhook.
- `assets/tester-portal.js` và `tester.html`: tab **Thực hành**; calculator trong mỗi case Sheets; hướng dẫn lưu đánh giá; thông báo rõ các kênh thật đang chờ sandbox.
- `assets/tester-admin.js`: khi duyệt hoặc cấp quyền Tester, cố gắng tự gán `sheets` READY và đọc lại kết quả; danh sách người thử có nút **Giao Sheets mẫu** khi chưa phân công, tránh người dùng phải nhập lại UUID; nếu gán không thành công hiển thị trạng thái từng phần.
- `scripts/build-auth-preview.mjs`: bổ sung đúng `assets/tester-sandbox.mjs` vào allowlist; SQL và tài liệu vẫn không deploy.

## 3. Kết quả Supabase VERIFY

- Tester Super Admin active = **1**.
- Tester access approved + unexpired = **1**.
- Sheets active assignments = **1**.
- Sheets READY cases = **15** (1 cũ + 14 mới).
- AI SALES pending cases = **132** (không mở).
- Tổng cases ở staging = **151**.
- Kết quả tester được lưu thực tế = **0** (chưa có ai gửi báo cáo thật).
- Test RLS bằng chính UID của Tester approved (trong giao dịch ROLLBACK): module visible=1; cases visible=15; assignments visible=1; ai_sales visible=0; một bản ghi `self_reported=true` được chấp nhận trong transaction và rollback.
- Test RLS bằng user không được cấp quyền: modules=0, cases=0, runs=0, access=0.

## 4. Deploy & QA

- Repo: `ngoctien20/demo-git`; nguồn Render `work/supabase-auth-staging-v1`.
- Feature merged: PR #44, source deploy commit `f0df9bea1056f65179170adf3abec25200a93c45`.
- Render static service: `tien404-auth-staging`.
- Deploy ID `dep-dbs5tflg1s2s73e90ni0` **LIVE**, finished `2026-11-14T13:14:46.379315Z` (build/deploy events succeeded).
- QA-only PR #45 merged `f6093b945e1c2ea8830a2073ff88b597cfaf06df` after deployment; no application change, no need redeploy.
- GitHub CI: `43598614637` Tester Private QA SUCCESS; `43598614575` website navigation regression SUCCESS.
- Hosted + browser CI: `43599050041` SUCCESS; 13 public routes/assets HTTP 200; 4 private paths HTTP 404; anonymous Chromium fail-closed on 390/768/1440.
- Approved-Tester **mock Auth** Chromium E2E: open assigned Sheets, calculate quote 318.000đ, reject over-stock, navigate case, save simulated self-report, PASS. All external requests blocked, no actual Supabase report persisted.
- Unit QA calculator tested: invalid/negative/decimal quantity, missing SKU, fixed VND price, mismatch, invalid price, available stock, over-stock.

## 5. Tester manual acceptance

1. Login with the **already approved** Tester account at https://tien404-auth-staging.onrender.com/login.html (no password to chat).
2. Open https://tien404-auth-staging.onrender.com/tester.html in same browser, press **Cập nhật**.
3. Expected: `Bài được giao = 15`, module **Dữ liệu mẫu (Sheets)**, tab **Thực hành**.
4. In practice: `QA-DEMO-01`, quantity `2` → `318.000đ`; change quantity to `26` → `out_of_stock`.
5. Go to **Chọn bài thử** → Sheets → one case → **Lưu kết quả tự đánh giá**; a real tester report is now needed to prove real end-to-end.
6. Owner opens https://tien404-auth-staging.onrender.com/tester-admin.html with authorized Super Admin and checks **Báo cáo tự đánh giá**; can export CSV when reports exist.
7. Do not interpret the calculator as actual AI SALES performance.

## 6. STILL BLOCKED / NEEDS SEPARATE GATES

- Actual AI SALES / Messenger chatbot execution by external tester: **BLOCKED** pending a real isolated endpoint, auth JWT verification, tenant isolation, read-only AI tools, rate limits, safe model billing and write kill-switch. Existing `AI_SALES_AGENT_TEST` inactive and Messenger live connected to AI_SALES_DEMO writing tools; no publication/exposure changes made.
- Zalo/Telegram testing requiring messages: **BLOCKED** until authorized destinations, platform policy, shadow callbacks and QA-only recipients.
- Public signup / invitation email: gated; existing approved Auth-only request form remains.
- Private screenshot uploads: BLOCKED pending Storage RLS/security, retention and privacy approvals.
- Real tester signed-in browser QA, revocation/expiry browser checks, report export with populated real data: PENDING user acceptance.
- Do not promote 132 AI SALES pending cases or manually mark QA automatic PASS.

## 7. Checkpoint / rollback

- Source rollback branch: `checkpoint/v12-2-before-tester-practice-20261114`.
- Previous Render LIVE: `dep-dbs5jbmk1f9s738b7oc0`, previous runtime commit `061863eb65ffc0d88cdf5f5f9a9ab8d401429403`.
- DB fixture insertion idempotent `ON CONFLICT DO NOTHING`; if rollback is later required, seek explicit permission to modify only 14 candidate-case rows and one Sheets assignment after verifying no genuine tester results depend on them.
- Production `gh-pages` untouched. n8n, Messenger, Zalo, Telegram and Commerce workflow versions untouched.

## 8. Suggested next V12.3

P0: authenticated Tester E2E with actual tester (real manual submission and admin readback).
P0: isolated AI SALES **read-only** testing adapter with signed Auth JWT, tenant isolation, model cost/rate cap, no order writes; separate release gate.
P1: AI scenario runner with 96 single-turn + 36 multi-turn as CANDIDATE; only enable after safe adapter QA.
P1: secure evidence upload and triage workflow.
P2: trusted invitation backend / controlled self-signup with anti-abuse.
