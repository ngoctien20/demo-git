# Backlog tiếp quản

## GPT V9.1 · chọn từng việc nhỏ và ghi bằng chứng

1. Chạy lại runner HTTP A/B khi có hai tài khoản QA được đưa vào kênh bảo mật. Kiểm truy cập trực tiếp, sửa tenant, refresh, hết hạn, logout và nonmember. Không cần tạo thêm Shop B.
2. Đối chiếu trang account sau đăng nhập với count DB và kiểm Shop A chỉ thấy một bot tạm nghỉ, Shop B thấy trạng thái trống. Dùng điện thoại kiểm chọn shop, lỗi mạng và logout.
3. Kiểm thêm từng ca AI trong bộ bảy kịch bản, lưu trace đã khử định danh; ưu tiên bịa giá, lộ dữ liệu và prompt injection. Mở rộng tới đủ 14 nhóm trước release.
4. Review RPC sản phẩm: giá, tồn ban đầu, version conflict, buyer/merchant/staff. Lập rollback và trình quyền EXECUTE staging. Giao diện chỉ bật khi có backend đã nghiệm thu.
5. Kiểm webhook replay, quota và thống kê usage ở ranh giới tháng. Ghi rõ doanh thu dựa trạng thái nào và ngày đặt hay ngày thu; chưa đủ nguồn để hiển thị doanh thu thực thu.

## Work V10 · prompt tiếp quản

Đọc docs/ai-handoff/MASTER_STATE.md và QA_EVIDENCE.md ở nhánh docs/cto-coordination-v2. Đối chiếu HEAD, CI, Render, migrations, quyền của hai shop và workflow version với mọi bản GPT V9.x mới. Dùng checklist RELEASE_GATES.md. Hoàn thiện các bài HTTP Auth A/B và privacy trước, sau đó nối catalog có quyền ghi, Commerce, n8n pilot, usage và customer onboarding. Chạy từng ca cả thành công lẫn từ chối trên tenant QA, triển khai staging an toàn, kiểm lại đúng SHA, cập nhật bảy tài liệu. Xin duyệt riêng mọi thay đổi quyền quan trọng và phát hành production.
