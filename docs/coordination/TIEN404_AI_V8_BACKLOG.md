# Backlog theo phụ thuộc · 11/11/2026 JST

| Ưu tiên | Bước có thể tiếp quản | Phụ thuộc và tiêu chí đóng |
|---|---|---|
| P0 | Đăng nhập QA A/B trong hai phiên độc lập, kiểm sau refresh/logout và gọi gateway bằng tenant đối diện | Hai tài khoản đã tồn tại. Cấp thông tin cho runner qua kho bảo mật hiện có hoặc nhập trực tiếp vào hai phiên QA. Chỉ lưu mã test, HTTP status và số dòng. [Runner](https://github.com/ngoctien20/demo-git/blob/f4b465f/ops/data-platform/scripts/live_auth_acceptance.py). |
| P0 | Recovery, expiry, mobile Android | Kiểm allowlist callback, không redirect ngoài origin; thử link hợp lệ/hết hạn/dùng lại trong tài khoản QA. Xác minh timeout, đăng xuất và refresh trên điện thoại. |
| P0 | Catalog có quyền ghi | Review RPC, backup, duyệt thay đổi quyền staging; chạy create/edit thử theo owner/manager, staff và tenant đối diện. UI cần xử lý bản ghi cũ, tồn đầu, lỗi/refresh. Không mở quyền ghi trực tiếp bảng. |
| P0 | Đơn, dashboard, bot theo shop | Bổ sung chi tiết dòng đơn, lịch sử, tổng tiền theo trạng thái thanh toán có định nghĩa, thiên về dữ liệu có nguồn. Tạo assignment bot/knowledge có version và audit cho từng tenant. Nghiệm thu hành trình từ login tới logout. |
| P1 | Checkout và buyer support | Nối route với actor đã xác minh, test retry/timeout HTTP, đổi số lượng, thanh toán và proof-of-ownership trước tiết lộ đơn. Kiểm replay phân tán trước nhân bản dịch vụ. |
| P1 | Training Lab và Messenger | Chạy đủ 14 nhóm hội thoại trên fixture đa tenant, lưu phiên bản prompt/knowledge, rubric, tool trace, latency và chi phí. Kiểm chính sách từ chối, injection, handoff; duyệt riêng trước promote Core Bot. |
| P1 | Bốn draft n8n | Kiểm 4 diff với dữ liệu đã khử định danh, shadow Revenue, rà webhook và chống phát lại. Quyết định Publish riêng với người phụ trách. |
| P1 | Marketing và Admin | Test widget dark mode/bàn phím thật, SEO/a11y, login từ Pages đến tenant; admin MFA/RBAC, audit và chống tự nâng quyền trên môi trường tích hợp. |
| P2 | SaaS vận hành | Onboarding, quota, usage, chi phí, entitlement và hết hạn gói. Dry run backup/restore trên bản sao Supabase, xác lập RTO/RPO, cảnh báo và quy trình sự cố. Billing thật cần duyệt. |

Mốc bắt đầu tiếp theo nằm ở [QA](TIEN404_AI_V8_QA_EVIDENCE.md) và [bản LIVE](TIEN404_AI_V8_MASTER_CHECKPOINT.md).
