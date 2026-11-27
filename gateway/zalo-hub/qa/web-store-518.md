## Checkpoint 27/11/2026 JST — PR 518

Hub staging đang có hai kết nối active, trong đó một kết nối khớp qa-zalo-bot / own. D1 đã áp migration 0005 và ghi d1_migrations. Đã đọc lại bảng zh_web_stores và hai trigger zh_web_reset, zh_web_occupied. Bookmark ngay trước migration: 00000025-00000000-00005130-b3f1260869581f41668de5cef531220d.

Worker be196a39-ed2b-4cbb-a1e2-7e656d9a3078 đã upload. So với version đang phục vụ, tất cả binding cũ khớp, gồm sáu secret bindings. Lưu lượng vẫn 100% trên 0d6b4b5e-8999-4096-a275-acfb32b4b997. Automatic approval review đã từ chối chuyển lưu lượng do chưa xác định workspace QA.

Bản mới định tuyến các endpoint web-store qua xác thực chủ shop/quản lý trên Supabase và giới hạn đúng ZH_QA_WEB_STORE_ID. Thiếu giá trị này thì yêu cầu web-store của mọi cửa hàng bị chặn. Endpoint nối bot thông thường giữ cờ cũ. Giao diện pilot tại /qa-store/ trong bản đã upload dùng mã public của Dashboard, xác thực qua Supabase và chỉ có chức năng liên kết, đối chiếu sản phẩm.

Kiểm thử 87/87 với fixture legacy đúng hash, build TypeScript/Vite đạt. Chưa ghép workspace, chưa đổi giá thật, chưa có UAT thiết bị. Bước tiếp theo: đối chiếu tên và UUID cửa hàng QA với chủ shop, gắn đúng workspace vào version mới rồi đánh giá lại trước chuyển lưu lượng. Sau khi bật mới kiểm tra đăng nhập, ghép và đối chiếu SP01 trên thiết bị. Rollback Worker về phiên bản trước và giữ D1 cho đối chiếu; không phục hồi toàn DB.
