# Phòng thử shop • 28/11/2026 JST
Base #519, 7539ab76f650bac6ff6c707e0c6a7f547dbadbe8. Messenger Z7FdV7uDvApfbURQ, published V27.7 5e6e7e90-3b1c-4ea2-ba5e-80458df3334c. Staging kiểm tra chỉ đọc chưa có cặp Page–shop QA hoạt động khớp shop và tenant. Chưa ghi dữ liệu lên hệ thống bán hàng. Hoa Mai thuộc phạm vi Zalo đã xác định riêng.

| Ca | Adapter offline | Preview QA | Staging với chủ đăng nhập và DB | Meta | Messenger Android | Messenger iOS | Messenger web |
|---|---|---|---|---|---|---|---|
| A001 đổi M → L → 2, hỏi lại, xác nhận, phát lại, duyệt lặp, đổi tồn, rút yêu cầu, gọi nhân viên | TESTED SQLite, xem journey.json | Xem bản ghi từ lượt chạy, đã mở bằng Chrome | BLOCKED | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN |
| Thử làm khách | TESTED giá A/B, sửa giá, 5 câu, ca thiếu dữ liệu | Đã mở trên Chrome, kiểm tra tổng 318.000đ | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN |
| Dạy bot | TESTED điều kiện và ngoại lệ A/B | Nguyên mẫu riêng từng shop trong phiên | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN |
| Gợi ý thay thế | TESTED hai/một/không, đổi giá hoặc tồn | Nguyên mẫu danh mục mô phỏng | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN |

Nút thử trong Products dùng dòng sản phẩm đang hoạt động của shop. Schema thiếu thuộc tính sẽ hiện chưa có dữ liệu. Nguyên mẫu chính sách chỉ nhận hai mẫu câu, lịch sử trong bộ nhớ. Gợi ý thay thế chưa nối đường ghi đơn. Bằng chứng đơn xem ở phòng thử được tái tạo từ SQLite. Hộp duyệt thật và giảm tồn trong DB staging còn chờ cấu hình QA.

Chạy lại từ gốc repo với Node có node:sqlite và Python 3:
```sh
node --test qa/shop-lab/*.test.mjs qa/messenger-shop/*.test.mjs config-core/test/*.test.mjs
node qa/shop-lab/journey.mjs
node qa/messenger-shop/replay-dialogue.mjs /path/to/AI_SALES_36_MULTI_TURN_FOR_LATER.csv
```
320 test đạt. Bộ hội thoại riêng đạt 36/36 ca, 71 lượt. Quan sát giao diện Chrome bản preview cục bộ với Shop A, A001 đen L, tổng 318.000đ và một thẻ đơn nháp. Chưa thử thiết bị thật. Bản dựng dành riêng cho Tiến yêu cầu đăng nhập ChatGPT. https://tien404-phong-thu-shop.fairflounder1.chatgpt.site

Khôi phục bằng cách đóng draft PR nếu chưa merge, hoặc revert commit trên nhánh thử nếu đã lấy thay đổi. Với site riêng có thể rút bản preview. Không có thay đổi production để hoàn tác. Bước kế tiếp là xác minh Page QA, shop QA và tài khoản chủ được phép trước khi kiểm tra toàn tuyến; chưa có quyết định mở pilot.
