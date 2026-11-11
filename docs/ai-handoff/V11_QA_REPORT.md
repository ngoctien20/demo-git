# Bằng chứng QA · 11–12/11/2026 JST

| Test | Môi trường, đầu vào | Mong đợi và thực tế | Kết quả |
|---|---|---|---|
| AUTH-BUILD | Render 32669ab, so 19 file từ build độc lập | 19/19 khớp byte. Trước deploy ba file CSS, login JS, account JS lệch | PASS [CI hosted](https://github.com/ngoctien20/demo-git/actions/runs/43040113005) |
| AUTH-ANON | Chromium mobile mới, mở login rồi account và refresh | Nút login sẵn sàng, email recovery khóa, yêu cầu đăng nhập, phần riêng tư ẩn | PASS cùng CI hosted |
| AUTH-RECOVERY/CSV | 32669ab, SDK fixture, callback đổi tài khoản, báo cáo kỳ, dữ liệu sai scope | 16 unit và Chromium tích hợp đạt | PASS [CI](https://github.com/ngoctien20/demo-git/actions/runs/43039701159) |
| HTTP-ANON | Supabase publishable key, GET Auth user, products, orders | HTTP 401 cho cả ba, hai tài nguyên DB trả 42501 | PASS |
| RLS-DB | Hai giao dịch READ ONLY độc lập, SET LOCAL ROLE authenticated và sub của owner chỉ thuộc một shop | Mỗi chiều 1 tenant của mình, 0 tenant, products và orders bên kia. Có 2 products và 2 orders trong DB | PASS ở PostgreSQL |
| DIRECT-WRITE | Kiểm SELECT has_table_privilege cho authenticated trên products | INSERT=false, UPDATE=false | PASS kiểm quyền bảng |
| AUTH-LIVE | JWT độc lập A/B, staff và nonmember qua HTTP, refresh và mở lại browser có phiên | Thiếu phiên QA được cấp cho runner | BLOCKED |
| AI-STOCK | 56e1f39, 10 unit + replay 7 trace lịch sử | Suite chấm điểm đạt, không đo model mới | PASS [CI](https://github.com/ngoctien20/demo-git/actions/runs/43040223257) |
| COMMERCE | n8n catalog/cart execution 2381, core 2384, extension 2380 | 17/17 + 22/22 + 25/25, fake orders/outbox | PASS sandbox |
| ADMIN | PR #15 FastAPI/SQLite, validation và authorization | 72 test đạt, 1 warning | PASS [CI](https://github.com/ngoctien20/demo-git/actions/runs/43039505813) |
| WEB | 61cf82f, Chromium ứng viên và đọc preview cũ | 29 case đạt, cùng navigation CI | PASS [CI](https://github.com/ngoctien20/demo-git/actions/runs/43039715865) |

Chưa đo tải 100 cửa hàng, chi phí model thực, E2E giao dịch thật, WCAG toàn site, hay restore Supabase vào môi trường riêng.

**WEB-HOSTED · PASS.** Ba bài Playwright trên URL triển khai bất biến eb7edbed kiểm 4 tệp HTTPS khớp byte, header noindex/nosniff và hai trang mobile khi chặn CDN. Cả hai nút mở được fallback, Escape trả focus, không phát sinh request ghi. [CI sau deploy](https://github.com/ngoctien20/demo-git/actions/runs/43109930511) · [mã QA](https://github.com/ngoctien20/demo-git/commit/5160370c40b86dd27b63833694f19a371d59832c).
