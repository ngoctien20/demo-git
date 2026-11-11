# Công việc đang mở · WORK V9 → GPT V9.1

| Ưu tiên | Phụ trách | Điểm tiếp tục |
|---|---|---|
| P0 | Integration + QA | Dùng hai phiên bảo mật của hai account QA đã tồn tại. Chạy live_auth_acceptance.py tại PR5 với bộ cấu hình QA riêng, kiểm A/B qua Auth → gateway và PostgREST, refresh và session-local logout. Chỉ ghi mã HTTP, số dòng và PASS/FAIL. |
| P0 | Website | Kiểm recovery thực, mobile và sau logout với hai phiên độc lập. Kiểm trang Merchant có hiện đúng dữ liệu Shop A và màn hình trống tương ứng Shop B. |
| P0 | Data + Security | Trình duyệt riêng quyền chạy RPC tạo/sửa sản phẩm. Chờ duyệt thay đổi quyền ghi trước khi mở cho merchant. |
| P1 | Commerce | Kết nối giao dịch với identity DB giới hạn, xác minh quyền trên đường HTTP thật; sau đó kiểm n8n trong sandbox. |
| P1 | Messenger Lab | Phủ các ca còn thiếu trong scorer, giữ trace, version và loại nguồn; thêm hội thoại nhiều lượt và thiếu thông tin. |
| P1 | Admin + Ops | Nối quota vào adapter pilot sau kiểm chữ ký; thử tenant hết hạn, retries, sự cố, restore và cảnh báo. |

Khi bắt đầu mỗi phiên, fetch trước; ghi agent, version, branch, PR, start/end SHA, files, tests, deploy và blockers. Nếu nhánh đổi thì đọc diff và đối chiếu kết quả trước khi ghi checkpoint mới.
