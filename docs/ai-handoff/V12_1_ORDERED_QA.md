# Tiếp nối V12.1 · Thứ tự tin và cô lập phiên thử

Ngày 14/11/2026 JST. Gốc fb73140a4d2e5c36d646c883b897c818ab9536ea. QA staging Personal / 90_QA - DIAGNOSTICS, workflow PLtOVTGYJTcI55I5, inactive, version 631500ef-d15b-4056-ad8a-bf8a0e0d1c99, bảng ZNh5jvPEVU3SWG7z. SDK chứa logic chạy. Ba nhóm node trong Editor tương ứng tối đa ba lần thử ghi theo revision.

Mỗi binding giả lập nhận chuỗi số nguyên liên tiếp từ 1. Trước khi lưu, chuyển tin thành thao tác có cấu trúc. Lưu tối đa 16 thao tác đang chờ và 64 biên nhận gần nhất, TTL ngữ cảnh 30 phút. Khi có đủ tin, áp dụng lần lượt theo số và xuất bản nháp cuối sau khi ghi. Khoảng trống chưa lấp thì chưa xuất preview. Khi tranh ghi, đọc lại revision rồi tính lại. Khi cả ba lượt lỗi, caller nhận lỗi. Hết TTL khi còn gap yêu cầu cấp binding mới.

| Bằng chứng | Kết quả |
|---|---|
| 2911, 2912, 2913 | Chọn F01. Tin số 3 đến trước số 2, preview trống. Khi nhận số 2, lưu số lượng cuối 1 và tính 159.000đ. |
| 2914, 2915 | A có F01, B hỏi size L phải cung cấp mẫu. Hai phiên có thể dùng cùng ID thử và số thứ tự riêng. |
| 2916 | Pin bản đọc cũ ở lượt 1, update theo revision không khớp. Lượt 2 đọc thật và ghi được. |
| 2917 | Phát lại cùng ID không trả thêm preview. |
| 2918, 2919 | Hai execution cùng scope khởi chạy song song. Tin 7 đến trước tin 6. Đọc lại DB thấy cursor 7, F01 số lượng 1, buffer trống. Scope B vẫn không có SKU. |
| Node 24 | node --test qa/zalo/*.test.cjs đạt 9/9. Bao gồm stale, replay, conflict, đổi ý, giới hạn gap và phân tách scope. |

Giới hạn: khóa và thứ tự đầu vào là fixture tin cậy của manual QA. Chưa xác nhận Zalo cung cấp chuỗi liên tiếp hoặc bảo đảm thứ tự người dùng bấm gửi. Không lấy số thứ tự tùy ý từ người gửi khi tích hợp thật. Cần chốt quy tắc đối với tin thiếu, nguồn thứ tự tại ingress và cấp namespace mới khi thay Owner (kể cả Owner được ghép lại). Giới hạn bộ phân tích ở một số thao tác thời trang chuẩn hóa. Workflow chưa nối live, không gửi tin hoặc ghi đơn. Chưa có model thật trong phép thử này. Rollback bằng cách dừng manual QA và giữ workflow inactive, bản V2.2 trước vẫn độc lập.
