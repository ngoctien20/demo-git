# V12.0 · Zalo Sales Lab V2 · EXPERIMENTAL

Kiểm tra ngày 13/11/2026 UTC. Nhánh work/v12-zalo-sales-lab, gốc 8c7bef52324dae073479646fd983832c2c2ab20e. Phạm vi là hội thoại thử. Bot Platform V1 tiếp tục nhận sự kiện. Lab chưa được định tuyến từ webhook.

| Thành phần | Trạng thái | Bằng chứng |
|---|---|---|
| Webhook V1 | VERIFIED cấu hình Published | yIJk8LvJoLF40Z62, phiên bản 25f910ce-d576-437b-ba5c-cc7247272d0f. Header Auth, normalize, ACK. Tắt lưu execution thành công, lỗi, manual và tiến độ. |
| TEST 08 | VERIFIED bằng chứng đã lưu | Bảng iu4YwmjRzW1SDGMg có hai hàng accepted, một SIMULATED_MANUAL và một WEBHOOK_PRODUCTION, cùng message.text.received. getWebhookInfo hiện thời chưa chạy lại. |
| Messenger | VERIFIED phiên bản | Z7FdV7uDvApfbURQ ở d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92. Agent thử 3MzEyZgbwkRmO4NI inactive có tools ghi, loại khỏi lab. |
| QA n8n | TESTED 27/27 | [Execution 2849](https://ngoctien20.app.n8n.cloud/workflow/7ilAB2bfIvh81H8j/executions/2849), draft eb568836-8a3d-40a1-9e40-00f37c5d2d56. |
| Chat Editor | TESTED ba lượt | [Execution 2850](https://ngoctien20.app.n8n.cloud/workflow/Dy4DYbsL059MLXUi/executions/2850), draft 2a0cc328-f981-45f5-a8f5-eee6b6935c37. Hai workflow trong Personal → 90_QA - DIAGNOSTICS. |
| Session, model adapter | TESTED cục bộ | Node 24, SQLite, 3/3 bài test. Session TTL 30 phút, dedup 24 giờ theo shop, bot và khách giả lập. Hai worker cùng event cho một catalog, một duplicate. Adapter chặn sai shop, trường thừa và timeout. |
| Bốn bộ CSV | TESTED replay an toàn | 97 hàng lịch sử có một hàng lặp. Hai bản 96 single giống nhau. 36 kịch bản khác gồm 9 kịch bản chỉ một lượt. Replay 132 case, 167 lượt kiểm tra độ dài, phạm vi SKU, trường session và mã thiếu QA05. Chất lượng từng câu theo expected_behavior chưa chấm đủ. |
| Sender | IMPLEMENTED mô phỏng | Chặn sai người nhận, hết quota, replay và kill switch. Timeout/5xx cần đối soát. 429 dừng. Chưa có transport thật hoặc quota phân tán. |

## Cách chạy và giới hạn

Mở workflow Editor, chọn Chat trong trình biên tập. Dùng hội thoại giả lập tối đa tám dòng trong cùng một lần gửi. Ví dụ “Shop còn áo đen không?”, “Size L.”, “Lấy 2”. Catalog thời trang trả 159.000đ, tồn 3, dự toán 318.000đ. Các số này thuộc fixture. UI hiện tại chưa lưu ngữ cảnh giữa hai lần bấm gửi. Bốn ngành có fixture riêng trong suite.

Bộ xử lý offline truy hồi ý định từ ví dụ tiếng Việt. Chỉ dữ liệu fixture quyết định SKU, giá, tồn và tổng. Prompt vi-sales-lab-2.0 và adapter nhận đề xuất SKU đã kiểm thử bằng model giả. Chưa gắn LLM vào n8n. Mã session SQLite dành cho QA bằng định danh giả. Đối với giao tiếp giữa các execution thật cần xác thực ánh xạ shop/bot/khách tại gateway và datastore được cấp riêng. Chưa thẩm định RLS, lỗi gửi cạnh tranh qua provider hoặc chất lượng model thực.

Chạy tại gốc nhánh với Node 24 và Python 3.

    node qa/zalo/suite.cjs
    node --test qa/zalo/*.test.cjs
    python -B qa/zalo/corpus.py HISTORY.csv MULTI.csv SINGLE.csv COPY.csv
    node qa/zalo/build.cjs editor
    node qa/zalo/build.cjs

Hai lệnh cuối sinh mã n8n SDK để kiểm tra hoặc tái tạo workflow QA trên bản nháp độc lập.

## Kiểm soát và rollback

Checkpoint khôi phục V1 là phiên bản Published nêu trong bảng. V12 đứng riêng. Để dừng thử nghiệm, dừng manual runs và giữ hai workflow V2 inactive. Nếu sau này định tuyến thử nghiệm được duyệt, ngắt định tuyến sang V2 trước khi kiểm tra lại ACK V1. Chưa diễn tập phục hồi V1 trên webhook đang hoạt động.

P0 trước thử thật: khóa identity theo binding phía server, triển khai TTL và dedup bền vững tại n8n, quota nguyên tử, xử lý crash sau accepted, chặn log nội dung thật, kiểm thử sai xác thực và replay trên endpoint V2 riêng. P1: nối model đã duyệt, đánh giá chất lượng bằng CSV, xử lý biến thể khẩu ngữ, khách đổi sản phẩm và ý định phủ định. Chưa nghiệm thu việc hiểu đúng mọi phủ định hoặc lựa chọn nhiều thuộc tính. Chưa chuyển lưu lượng, cấp quyền, gửi tin, dùng model tính phí hay ghi đơn.

## Điều kiện nền tảng

Hướng dẫn chính thức mô tả tạo Bot và thử từ local bằng getUpdates. Tài liệu OA có điều kiện sản phẩm riêng. Chưa xác minh quyền thương mại nhiều merchant, BASIC quota, biểu phí và quyền gửi tới từng đối tượng của tài khoản cụ thể. Trước Milestone 5 cần đối chiếu điều khoản và hạn mức của tài khoản, có người nhận QA đã duyệt, budget và nơi quản lý bí mật phía server. Chưa đủ điều kiện CANDIDATE.

- https://docs.zaloplatforms.com/docs/BOT/create_bot
- https://docs.zaloplatforms.com/docs/BOT/best-practices/build-your-bot
- https://oa.zalo.me/home/documents/guides/huong-dan-su-dung-zalo-chatbot
