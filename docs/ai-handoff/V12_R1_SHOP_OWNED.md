# Work V12.0 R1 · Shop-owned Bot
14/11/2026 JST. Agent WORK. EXPERIMENTAL. Gốc fe958bcb57b3b35e9c2af8087c0e465a01f65a2b. Nhánh work/v12-r1-shop-owned. Mốc trước TEST 10 đã xác minh F01 qua tin Zalo thật. R1 chỉ chạy mô phỏng có kiểm soát.

## Bằng chứng

| Môi trường | Thao tác | Mong đợi và quan sát |
|---|---|---|
| n8n Personal / 90_QA - DIAGNOSTICS | Registry qLf19z9QjEaIHk00, workflow kKIlgIX5olx0CSz5, version 31c8fb33-3ad2-4612-8afc-fc8293f5e16d, execution 3057 | Đúng hai cấu hình shop tách route, credential ref và catalog. Cả hai dry_run. Chỉ là identity fixture. |
| SQLite tạm trên mỗi test | test_chat_webhook_end_to_end | Hội thoại cùng actor và SKU F01 ở hai route. Hủy báo giá không lưu đơn. Xác nhận mới lưu một đơn pending, đọc lại, tạo event và outbox HELD. Hai áo A 318.000đ, B 420.000đ. |
| SQLite | test_two_shop_journey, test_concurrent_replay | Đọc chéo thông báo bị từ chối. Hai kết nối đồng thời xác nhận cùng quote trả cùng order ID, tồn QA chỉ giảm một lần. |
| SQLite | test_identity_subscription_and_injection, test_pairing_security | Sai credential, số lượng sai, bot disabled, subscription hết hạn bị chặn. Mã ngẫu nhiên 18 byte, hash SHA-256, TTL 5 phút, khóa sau 5 lần sai. Từ chối chéo, replay, hết hạn. Revoke/re-pair đổi generation, preview cũ bị từ chối. |
| SQLite | test_price_stock_scope_and_rollback | Đổi giá, thiếu tồn, quote khác bot bị chặn. Trigger cố ý gây lỗi outbox khiến toàn giao dịch rollback. |
| n8n Commerce | 2926, 2927, 2930 | 7/7 catalog + 10/10 cart, 22/22 core, 25/25 extension. |
| Regression Zalo | Node + Python | 9/9 bài Node, 29/29 assertion, 132 case/167 lượt replay giới hạn đầu ra. Chưa chấm chất lượng model thật. |

## Hạ tầng và phạm vi
Render Auth LIVE dep-dbr8irtckfvc73di0edg, SHA d7bcf864d1dddde2e98dff2f1a70411c1fe0f6bc. Supabase có 7 migration đến 20261113034916. Đọc pg_catalog xác nhận RLS bật và không cấp SELECT cho anon trên tenants, tenant_memberships, orders, products. Chưa chạy signed JWT qua HTTP cho R1. Worker ZALO_SEND_ENABLED=false, chưa thấy binding AUTO_REPLY_ENABLED. Không có sender trong R1. Đã tạm dừng lịch TEST 11 trước lần chạy để giữ khóa gửi theo yêu cầu mới. V1 9ef7342b-0623-4921-9969-7d33d112bbef; Shadow 7f100319-b820-4f02-a52b-85cd8e0c7e25; Messenger d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92. Không chỉnh hoặc publish ba workflow này.

## Contract Dashboard → backend → bot
Chủ shop mở Cài đặt → Bot của cửa hàng. Backend phải xác minh JWT và active owner membership trước khi gọi issue. UI hiển thị mã một lần trong năm phút, tên bot đúng shop, trạng thái ghép và thao tác thu hồi. pair chỉ nhận webhook đã xác minh qua route phía server. notification kiểm tra lại membership, bot, generation và recipient. Hiện các method này dùng opaque session do fixture cấp trong SQLite. Chưa nối form, Supabase JWT hay webhook Zalo thật. Registry n8n là bản cấu hình QA độc lập với fixture SQLite. Cả hai chỉ lưu ref hoặc bằng chứng xác thực QA. Bản R1 chưa thay engine hội thoại live. Chưa dùng model tính phí.

## Chạy lại, rollback và backlog
Chạy từ qa/shop_owned bằng python3 -B -m unittest -v test_shop. Chỉ dùng DB tạm. R1 tái dùng bộ format thông báo đã có. Không có endpoint public, migration staging, sender, phí dịch vụ mới hay billing. Rollback bằng cách giữ workflow registry inactive, ngừng QA và đóng nhánh. Không cần xóa bảng QA hoặc bản ghi TEST 09.
- P0: đưa cấu hình registry về một nguồn server duy nhất, xác thực ingress theo provider, ràng buộc tenant/store thật và signed JWT A/B; rate limit cả issuance lẫn redemption, TTL/revocation xuyên hệ thống.
- P1: nối API/UI pairing, QA trên điện thoại, đưa order/readback/outbox sang PostgreSQL staging cô lập; xử lý lại sự kiện thiếu binding, quota và timeout-unknown trước bất kỳ sender nào.
- P2: dashboard và Super Admin đọc trạng thái registry/audit; chạy browser và authorization riêng; revenue/billing/Control Hub chưa nghiệm thu R1.
- P3: xác minh điều khoản quản lý bot thương mại cho merchant. Hướng dẫn tạo bot chính thức: https://docs.zaloplatforms.com/docs/BOT/create_bot . Tách OA/ZBS khỏi Zalo Bot Platform.
