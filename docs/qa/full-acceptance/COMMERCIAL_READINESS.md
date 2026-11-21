# COMMERCIAL_READINESS — Round 1

## 1. Trải nghiệm chủ shop nhỏ

| Câu hỏi | Trả lời theo bằng chứng |
|---|---|
| Dễ tạo cửa hàng? | **Không tự làm được.** `register.html` là mô phỏng; tạo tenant cần workflow nội bộ `splyaeQtV719OuAu` có admin duyệt. |
| Dễ thêm sản phẩm? | Có RPC `save_merchant_product` + Merchant Portal (checkpoint Render) nhưng giới hạn tenant QA. Bot live đọc sản phẩm từ Google Sheet. |
| Kết nối kênh bán? | Không tự phục vụ. Messenger hard-code 1 Page; Zalo chỉ receipt/shadow; Zalo OA chưa có. |
| Hiểu trạng thái đơn? | Không có dashboard đơn thật. Trạng thái nằm trong Google Sheet. |
| Nhận thông báo phù hợp? | Không có thông báo đơn mới; chỉ email tổng hợp 21:00 (bản đang chạy tính sai doanh thu khi tổng có dấu chấm). |
| AI xử lý câu hỏi khách VN? | Prompt thiết kế tốt (không dấu, viết tắt, xác nhận đơn). Chưa có đánh giá định lượng. |
| Người không biết công nghệ tự dùng được? | Chưa. Cần người kỹ thuật cấu hình Sheet, n8n, Page. |
| Onboarding ít hỗ trợ? | NOT_IMPLEMENTED. |

## 2. Kịch bản ngành

| Ngành | Có gì | Thiếu gì | Kết luận |
|---|---|---|---|
| Tạp hóa | Tư vấn + đơn 1 SKU/đơn | Giỏ nhiều món trong 1 đơn (live), đơn vị tính, tồn kho thực | NOT READY |
| Vật liệu xây dựng | Cart preview có cờ "materials quote" (sandbox, chỉ đọc) | Báo giá theo khối/m², phí vận chuyển, công nợ | NOT_IMPLEMENTED ở live |
| Đại lý sỉ/lẻ | Tier pricing preview trong `Y0WLykMtNAldbgL0` (sandbox) | Giá sỉ trong luồng live, công nợ | NOT_IMPLEMENTED ở live |
| Thời trang | Sheet DEMO có SKU áo/size; bot live tư vấn được | Biến thể size/màu chuẩn hóa, đổi trả | Chỉ DEMO |

Công nợ: không tìm thấy module → NOT_IMPLEMENTED. Chế độ tạm nghỉ: có preview "store hours" trong sandbox V3, không có ở live.

## 3. Điều kiện thương mại còn thiếu

1. Billing/subscription và điều khoản dịch vụ gắn với gói (NOT_IMPLEMENTED; bảng giá ghi "Liên hệ báo giá").
2. Hợp đồng xử lý dữ liệu khách hàng (PII đang nằm trong Google Sheet và lịch sử execution n8n).
3. Quy trình hỗ trợ: phiếu hỗ trợ chỉ ghi vào bảng, không có người trực.
