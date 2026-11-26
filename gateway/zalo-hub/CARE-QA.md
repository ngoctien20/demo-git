# Nghiệm thu Hội thoại Zalo Bot

Bản nháp kế tiếp PR #507. Kênh hỗ trợ là hội thoại riêng của khách với Zalo Bot.
Gói pilot do máy chủ cấp cho từng shop. Tính năng mặc định tắt. Liên hệ công khai
do chủ shop hoặc quản lý nhập tại Hội thoại. Gói thương mại cần nguồn thuê bao
đã xác minh; các giao dịch thanh toán demo không cấp quyền.

Khi mở menu, lưu phiên bản đã hiển thị theo từng hội thoại. Khi khách chọn số,
chuyển phiên bản đó đến bộ định tuyến. Giữ định danh tin đến xuyên suốt quá trình
xử lý và thử lại. Một phản hồi thiếu định danh không đủ điều kiện gửi cho khách pilot.

QA cục bộ dùng SQLite và bộ giả lập Zalo, n8n, Supabase. Chạy bộ kiểm thử Hub,
config-core và trình duyệt ở 390 px, 1280 px. Chưa có nghiệm thu trên Zalo thật.
Đối chiếu ở staging với hai shop QA, hai khách, số lần gửi thực tế và lịch sử trên web.

Rollback bản nháp bằng cách đóng PR. Khi đã thử trên staging riêng, ngừng gửi, xử lý
các lượt đang chờ và đối chiếu các yêu cầu đang gửi trước khi phục hồi bản trước.
Giữ lịch sử cho việc đối chiếu. Một yêu cầu gửi chưa rõ kết quả cần kiểm tra biên
nhận trước khi xử lý tiếp.
