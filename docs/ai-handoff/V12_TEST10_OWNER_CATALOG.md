# TEST 10 · Owner tra catalog qua Zalo Bot Platform
14/11/2026 JST. Đã Publish phiên bản Shadow 7f100319-b820-4f02-a52b-85cd8e0c7e25. Bản trước 25477724-ac69-4e6b-9f2f-bfc46bd319bf có thể Publish lại để rollback. V1 vẫn 9ef7342b-0623-4921-9969-7d33d112bbef và ACK trước khi gọi Shadow. Gateway send false, không thêm node gửi hoặc ghi đơn.
 
Chỉ xử lý tin riêng từ Owner được phép và chưa hết hạn với nội dung TEST 10 F01. Tra catalog fixture của agent V2.1 rồi cập nhật một hàng QA bằng điều kiện status=armed. Ghi SKU, giá, tồn và thời điểm. Không lưu chatId hay nội dung tin nhắn. Kiểm tra quyền ở Owner Gate trước lookup.

QA 2920 sai chat, 2921 sai câu thử đều không tạo kết quả. 2922 trả F01 159000 tồn 3 nhưng ghi vào slot owner-test-10 do mode test n8n không nhận diện đúng. Hàng đó là dữ liệu mô phỏng. Đã tách cờ QA và chạy lại 2923 với slot manual-control. Slot bằng chứng thật duy nhất là owner-test-10-live trong bảng AoUiFkBECbXsw0Ka. Tại thời điểm Publish, slot này armed và chưa có SKU. Không chạy test manual vào slot live. Chờ chủ dự án gửi tin. Khi nhận, đọc lại SKU, giá, tồn, thời điểm và đối chiếu xác nhận của chủ dự án. Chưa nghiệm thu tin gửi ra điện thoại hoặc model thật.

## Kết quả sau khi Owner gửi tin

VERIFIED — Owner xác nhận đã gửi. Đọc lại Data Table AoUiFkBECbXsw0Ka, hàng 3, slot owner-test-10-live, status verified. n8n ghi nhận lúc 03:50:48.341 ngày 14/11/2026 JST (2026-11-13T18:50:48.341Z). SKU F01, giá thử nghiệm 159.000đ, tồn 3. Đạt tiêu chí nhận tin thật và tra catalog sandbox. Bước tiếp theo cần duyệt riêng nếu gửi một phản hồi thật về tài khoản Owner.
