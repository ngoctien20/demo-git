# Registry kết nối · 10/11/2026 JST
|Kết nối|Thao tác được xác minh|Giới hạn|
|---|---|---|
|GitHub|Đọc PR/repo/issues|PR #1 draft; trước phiên không có issue qua truy vấn repo|
|n8n|List workflow và đọc graph Messenger|29 workflow; chưa gọi live webhook|
|Supabase|list projects → 0|Không có project nhìn thấy trong tài khoản; auth/RLS/index/backup UNKNOWN|
|Drive|Search tên và tạo thư mục quản trị|Dữ liệu bị giới hạn theo tài khoản được cấp quyền|
|Linear|Đọc team/project/issues và tạo backlog|Dùng một project, owner theo Work, phụ thuộc qua issue|
|PostHog|projects-get có một Default project, ingested_event=false|Chưa có bằng chứng tracking TIEN404 hoặc funnel; chưa cài SDK|
|Gmail|Đọc profile thành công|Chưa thử gửi hoặc đọc hộp thư; chưa xác minh delivery|
Đề xuất analytics opt-in với event demo_open, onboarding_step, registration_completed, chat_result, subscription_verified, error_class. Chỉ gửi mã tính năng và kết quả; loại text chat, email, token, payment payload. Flag/experiment chỉ sau baseline. [Tài liệu kiểm soát dữ liệu](https://posthog.com/docs/privacy/data-collection).

Nguồn đối chiếu: [Pages tại baseline](https://github.com/ngoctien20/demo-git/tree/7bf9c660e70a65295e80b0fba8c241590d6aa0bf) · [checkpoint monitor](https://github.com/ngoctien20/demo-git/pull/1) · [checkpoint tổng thể riêng của dự án, ngày 10/11/2026].

