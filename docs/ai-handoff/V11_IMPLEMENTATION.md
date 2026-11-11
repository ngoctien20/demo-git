# Thay đổi và ownership

| Owner | Thay đổi có thể kiểm tra | Trạng thái |
|---|---|---|
| Auth | #17 b4763a1 gắn sự kiện khôi phục PKCE với user hiện tại, hủy biểu mẫu khi đổi danh tính | Deployed staging qua #18 |
| Merchant | #16 593db7c xuất CSV UTF-8 cho kỳ 7/30 ngày từ báo cáo theo cửa hàng. Khóa tải khi lỗi, rỗng hoặc dữ liệu sai tenant | Deployed staging, cần phiên thật để nghiệm thu dữ liệu |
| Web | #19 61cf82f tải widget khi cần, mở được fallback khi SDK lỗi, trả focus sau Escape | Cloudflare preview |
| Super Admin | #15 10dd3b6 loại giá trị đầu vào như mật khẩu và mã MFA ra khỏi phản hồi 422 | Tested, chưa host |
| AI Lab | #13 56e1f39 kiểm SKU, bằng chứng tồn kho, cả lượng âm, và xử lý tool trace thiếu trường | Tested trên fixture và trace lưu |
| DevOps | #14 d5df816 kiểm SHA-256 từng asset Render, kiểm anonymous Chromium trước/sau refresh. Nhánh qa/v11-widget-deployment kiểm preview Cloudflare | Xem QA |
