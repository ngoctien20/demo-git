# Backlog nghiệm thu

| Ưu tiên / owner | Trạng thái | Đầu ra để đóng |
|---|---|---|
| P0 Identity | BLOCKED | Cấp phiên QA cho runner qua kho bí mật staging. Hai danh tính A/B phải có positive control, đọc/ghi chéo bị từ chối, nonmember/staff/anon bị từ chối, kiểm refresh/reopen/logout. |
| P0 Merchant | IMPLEMENTED_NOT_VERIFIED | Dùng phiên thật xuất CSV, đối số tiền theo ngày Việt Nam với truy vấn DB. Nghiệm thu 13 điều kiện quyền ghi trước khi bật form. |
| P0 Commerce | IN_PROGRESS | Trên giao dịch DB staging kiểm mua sản phẩm cuối, retry, hoàn kho, audit và rollback; xác minh quyền sở hữu đơn. |
| P1 Admin | IMPLEMENTED_NOT_VERIFIED | Host staging có MFA/RBAC, endpoint admin từ chối non-admin, ghi audit và giữ bí mật khi validation lỗi. |
| P1 Operations | IN_PROGRESS | Ghép giám sát health, latency, lỗi tool và usage theo tenant. Kiểm cảnh báo bằng sự cố giả. Đo token và chi phí bằng metadata không chứa nội dung chat. |
| P1 Recovery | BLOCKED | Kiểm allowlist redirect và mail QA, diễn tập restore từ backup vào đích cô lập, đo RTO/RPO. |
| P1 Onboarding/omnichannel | IN_PROGRESS | Xác minh cấp tenant, handoff có xác nhận và routing ràng buộc merchant; kiểm vòng đời hội thoại. |
| P2 Business | DEFERRED | Chốt quota, ngân sách, điều khoản, quyền riêng tư và quy trình hỗ trợ trước pilot; billing thật, domain Mắt Bão và DNS cần phê duyệt. |
