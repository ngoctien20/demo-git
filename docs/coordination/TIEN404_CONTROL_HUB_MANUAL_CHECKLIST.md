# Control Hub · Chủ dự án tự đánh dấu

Cập nhật Work V8 ngày 11/11/2026 JST. Trong bốn mục gốc, **1 được đánh dấu, 3 còn mở**. [Bằng chứng từng phép thử](TIEN404_AI_V8_QA_EVIDENCE.md) · [checklist V7.1 lưu nguyên bản](https://github.com/ngoctien20/demo-git/blob/e73a580/docs/coordination/TIEN404_CONTROL_HUB_MANUAL_CHECKLIST.md).

## A. Có thể đánh dấu hoàn thành

| Mục | Phạm vi và bằng chứng |
|---|---|
| **1. Xác minh Published của 7 workflow** | VERIFIED_DONE. Bảng version trực tiếp n8n xác nhận cả 7 có Published và 4 cặp khác Draft. |
| Nhiệm vụ con nếu Hub theo dõi riêng | DB-01 cách ly đọc A/B tại PostgreSQL; TX-01 trừ/hoàn và chống trùng trong DB kiểm thử; DR-01 khôi phục DB fixture; AI-01 đúng giá/tồn T-A trong catalog QA. |

## B. Đã làm nhưng chưa nên đánh dấu

| Mục gốc | Trạng thái | Đã chứng minh | Điều kiện còn thiếu |
|---|---|---|---|
| **2. Cô lập dữ liệu giữa các cửa hàng** | BLOCKED ở E2E | DB-01/02, Shop B đã hiển thị owner | Hai JWT thật, HTTP đọc/ghi được phép, sửa tenant ID, refresh/logout trên bản đang chạy |
| **3. Trừ/hoàn kho và chống đơn trùng** | IN_PROGRESS | TX-01 chạy PostgreSQL thật với dữ liệu dùng một lần, có tranh chấp/rollback/audit | Route staging được xác thực, QA xuyên API với retry và hai chủ shop |
| **4. Đối chiếu demo website với backend** | IN_PROGRESS | Kiểm điều hướng, phân biệt public demo, Render merchant, gateway; dashboard đã triển khai | Hành trình website → login → dữ liệu → cấu hình và thử AI → logout |

## C. Chưa thực hiện hoặc cần phê duyệt

1. P0 đưa tài khoản QA hiện có vào hai phiên kiểm thử bảo mật. Shop B đã có hai membership active. Không cần tạo thêm.
2. P0 duyệt quyền thực thi RPC sản phẩm sau review và kiểm rollback, nếu muốn mở ghi staging. Chưa có đề nghị cấp Super Admin.
3. P1 duyệt riêng việc publish workflow, merge gh-pages, triển khai khách hàng và mọi thay đổi dữ liệu quan trọng.
4. P2 duyệt ngân sách và thanh toán thực sau khi nghiệm thu usage và quyền gói.

Phiên này không thao tác checkbox trên Control Hub.
