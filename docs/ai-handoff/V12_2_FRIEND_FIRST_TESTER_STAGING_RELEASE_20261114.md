# TIEN404 AI V12.2 — Friend-first Tester Portal Staging Release

**Checkpoint:** 2026-11-14 JST  
**Phạm vi:** Render `tien404-auth-staging` / Supabase `tien404-staging` / nhánh GitHub `work/supabase-auth-staging-v1`; tuyệt đối không phải production.

## 1. Trạng thái thực tế (VERIFIED)
- Trước thay đổi: Tester Admin được owner chấp nhận; màn Tester có 6 mục và 15 case với checklist dài, gây khó hiểu cho bạn bè.
- 1 Tester đã approved còn hạn, 1 assignment `sheets`, 15 `sheets` READY cases, 0 báo cáo tester lưu thực tế.
- AI SALES, Messenger, Zalo, Telegram, Commerce **không được gọi như chatbot live** từ Portal. Các case AI SALES còn pending không được promote.
- Không dùng thông tin của người dùng/khách thật trong UI mô phỏng.

## 2. Những gì đã thay đổi (IMPLEMENTED)
- Friend-facing `tester.html` chuyển sang bố cục **giới thiệu ngắn → chọn tình huống → cho ý kiến**; giải thích bằng ngôn ngữ thân thiện lý do xây TIEN404 AI, nhấn mạnh đây là hướng sản phẩm đang phát triển.
- 3 tình huống 1 chạm dùng helper local `calculateDemo` đã có, ánh xạ riêng case READY:
  - `SHEET-SIM-002`: 2 áo -> 318.000đ mẫu
  - `SHEET-SIM-004`: vượt tồn -> chặn
  - `SHEET-SIM-009`: giá khách thấp hơn giá mẫu -> từ chối
- Phản hồi nhanh: **Dễ hiểu** (một nút), **Cần cải thiện** (mở ghi chú), **Không thử được**. Lưu vào bảng `tien404_tester_runs` qua Supabase RLS, đọc lại trước khi báo đã lưu, giữ `self_reported=true`.
- Giữ nguyên 6 chức năng cũ nhưng gom trong `details#tp-more` không mở mặc định; tiến độ chi tiết cũng gói trong `details`.
- CSS được giới hạn bởi class `tp-friends` chỉ trên Tester Portal. **Không sửa HTML/JS Tester Admin**.
- Không chỉnh Supabase RLS/schema/đơn thật, n8n, credential hay workflow Published.

## 3. Deploy (VERIFIED)
- PR #46 merged; staging deploy commit `10fdf7108ada585dcca8a4f231b230613aa5c6e9`.
- Render deploy `dep-dbs6fck9v7es73bqvb30`, status **LIVE**, finished `2026-11-14T13:52:59.07316Z`.
- Runtime: https://tien404-auth-staging.onrender.com/tester.html
- Admin (unchanged): https://tien404-auth-staging.onrender.com/tester-admin.html
- QA-only PR #47 merged after live: `aeab82a3571099a77c590a2504b595da16d1348b`, không yêu cầu thêm deploy.

## 4. Kết quả QA (TESTED)
- CI #43601821175 SUCCESS: 34 source/security/unit tests PASS, 18 build tests PASS, Chromium anonymous default-closed + approved tester mock friend flow PASS.
- GitHub website navigation regression #43601821156 SUCCESS.
- CI #43602087422 SUCCESS: postdeploy 13 public routes/assets HTTP 200, 4 private resources HTTP 404, new friend-first markers, unchanged Admin, all tests PASS.
- Approved Tester Chromium mock: giới thiệu dự án, chọn 3 tình huống, lưu từng kết quả (mô phỏng Auth và DB), quay lại sử dụng phần thực hành nâng cao -> PASS. Không có requests ngoài mock local; không có dữ liệu QA giả lưu thực tế.
- Readback Supabase hậu deploy: admin=1, tester approved=1, Sheets assignment=1, Sheets READY=15, báo cáo thực=0.
- **Thử trình duyệt bằng phiên đăng nhập thật của một người bạn và một báo cáo lưu thật vẫn chưa nghiệm thu**.

## 5. Cổng an toàn / blocker
- Portal không thực thi LLM hoặc chatbot thực tế; chỉ là mô phỏng quy tắc bán hàng trên client, ghi rõ cho bạn bè.
- Chỉ Auth đã xác minh và tester được duyệt/còn hạn/đã gán Sheets mới thao tác/lưu feedback; DB RLS là quyền cuối.
- Mở Real AI Tester Lab cần endpoint QA riêng có xác minh JWT và tenant, hạn mức chi phí, tắt tool ghi đơn và quota/rate-limit, duyệt trước khi triển khai.
- Chưa mở self-signup tự do, kênh Messenger/Zalo thật hoặc gửi notification.

## 6. Rollback / checkpoint
- Rollback source branch: `checkpoint/v12-2-before-friend-first-tester-20261114`.
- Runtime trước: commit `f0df9bea1056f65179170adf3abec25200a93c45`, Render deploy `dep-dbs5tflg1s2s73e90ni0`.
- Rollback chỉ cần phục hồi giao diện staging bằng deploy cũ, không xóa bảng/role/cases.
- Repo production `gh-pages` và n8n Published không bị thay đổi.

## 7. Hướng dẫn nghiệm thu 2 bước cho bạn bè
1. Đăng nhập đúng tài khoản được duyệt tại https://tien404-auth-staging.onrender.com/login.html, mở https://tien404-auth-staging.onrender.com/tester.html. Đọc 2 câu giới thiệu và nhấn một trong ba tình huống.
2. Kiểm tra kết quả mô phỏng; chọn **Dễ hiểu**, **Cần cải thiện** hoặc **Không thử được**. Admin mở https://tien404-auth-staging.onrender.com/tester-admin.html xác minh báo cáo thực được lưu; phần bài kiểm tra nâng cao là tùy chọn.

## 8. Khuyến nghị tiếp theo
- P0: nghiệm thu trải nghiệm bạn bè thật trên điện thoại và readback feedback từ Supabase Tester Admin.
- P1: Real AI Tester Lab tách khỏi AI_SALES_DEMO và Messenger live; chỉ mở sau cổng bảo mật/chi phí được phê duyệt.
- P1: thu thập góc nhìn người không rành kỹ thuật: họ hiểu dự án trong 20–30 giây hay không, dễ gửi góp ý không, chỗ nào gây nhầm.
