# TIEN404 SALES LITE V1.1 — Zalo Menu Capability Audit

**Ngày kiểm tra:** 15/11/2026 JST. **Bản sản phẩm:** V13.1 EXPERIMENTAL.  
**Đối tượng phân biệt bắt buộc:** `Zalo Bot Creator API` ≠ `Zalo Official Account (OA) Menu/OpenAPI` ≠ `Zalo Business Solutions (ZBS)` ≠ `Zalo Mini App` ≠ `zBusiness Basic`. Không dùng payload của nền tảng này cho nền tảng khác.

## Tài liệu chính thức đã kiểm tra

1. Zalo Bot overview: https://docs.zaloplatforms.com/docs/BOT — trang tổng quan liệt kê nút/quick reply nhưng mô tả **khái quát**, không công bố schema request tương ứng.
2. Zalo Bot `sendMessage`: https://docs.zaloplatforms.com/docs/BOT/apis/sendMessage — POST `/bot{TOKEN}/sendMessage`; parameters `chat_id`, `text` (1–2000), `parse_mode` và `text_styles`. **Không có** trường `buttons`/`keyboard`/`reply_markup`/`callback_data` trong schema công khai đã xem.
3. Zalo Bot create: https://docs.zaloplatforms.com/docs/BOT/create_bot — Creator, Bot Token, webhook hoặc polling. Không phải chứng nhận quyền OA.
4. OA thanh menu: https://oa.zalo.me/home/documents/vie/guides/thanh-menu_29 — menu OA có thể gồm mở website, gọi điện, menu con, truy vấn, quét QR; cần gói OA phù hợp, **không phải Bot API**.
5. OA API: https://docs.zaloplatforms.com/open-apis và https://oa.zalo.me/home/documents/guides/Khoi-tao-ung-dung-va-cap-quyen_117071366476220195 — cần cấp quyền App/OA khác bot token.
6. ZBS quick-response callback: https://docs.zaloplatforms.com/docs/ZBS/quan-ly-template/template-webhook/su-kien-nguoi-dung-phan-hoi-template-phan-hoi-nhanh — webhook của template ZBS, **không áp dụng tự động cho Zalo Bot Creator**.
7. OA pricing: https://zalo.solutions/oa/pricing — OA/OpenAPI có yêu cầu gói phù hợp; không suy diễn chi phí Bot API.

## Ma trận khả năng (Zalo Bot Creator)

| Khả năng | Trạng thái | Bằng chứng & kết luận |
|---|---|---|
| Persistent menu của Bot | UNKNOWN | Overview đề cập UX tương tác nhưng chưa thấy endpoint/schema thiết lập menu Bot |
| Quick Reply của Bot | UNKNOWN | Overview quảng bá quick reply; không có schema `sendMessage` public xác minh |
| Inline Buttons của Bot | UNKNOWN | Không có field nút trong `sendMessage` đã kiểm |
| Keyboard Buttons của Bot | UNKNOWN | Không thấy reply keyboard Bot API |
| Callback Query của Bot | UNKNOWN | Không có event callback Bot với payload/secret đã xác minh |
| Danh sách lựa chọn Bot | UNKNOWN | Chưa xác minh template schema list/menu Bot |
| Nội dung tin nhắn văn bản | OFFICIALLY_DOCUMENTED | `sendMessage` có `chat_id` và `text`, 1–2000 ký tự |
| Định dạng rich text Bot | OFFICIALLY_DOCUMENTED | `parse_mode`, `text_styles` trong sendMessage |
| Fallback menu số 1–6/1–7 | MOCK_TESTED | `TEXT_NUMBERED` được kết xuất trong Menu Engine và kiểm thử Node; chưa gửi menu thật |
| Link văn bản trong Bot | UNKNOWN | Trường text cho phép chuỗi ký tự; hành vi link preview/click chưa kiểm chứng |
| Nút mở website của Bot | UNKNOWN | Chức năng có trên **OA Menu**, không suy ra cho Bot |
| Nút gọi điện của Bot | UNKNOWN | Chức năng có trên **OA Menu**, không suy ra cho Bot |
| Menu trong Bot Creator | UNKNOWN | Tài liệu tạo Bot hướng dẫn thông tin bot và webhook; chưa tìm được schema menu |
| SDK menu methods của Bot | UNKNOWN | SDK được giới thiệu nhưng chưa xác nhận API method menu tương thích |
| Webhook nhận tin nhắn văn bản Bot | OFFICIALLY_DOCUMENTED | Cơ chế webhook chính thức và Owner Bot ingress đã nghiệm thu từ dự án cũ |
| Webhook callback **chọn menu Bot** | UNKNOWN | Chưa có event spec riêng; không dùng ZBS callback |
| Giới hạn số nút/độ dài nhãn **Bot** | UNKNOWN | Không áp giới hạn **OA Menu** lên Bot |
| Menu OA | OFFICIALLY_DOCUMENTED | Có tài liệu và cấu hình riêng; yêu cầu tài khoản OA và gói phù hợp, không phải Bot Creator |
| Callback mẫu phản hồi nhanh **ZBS** | OFFICIALLY_DOCUMENTED | Thuộc ZBS template; không thuộc Zalo Bot callback |
| Mini App UI Button | OFFICIALLY_DOCUMENTED | UI của Mini App là sản phẩm khác Bot API; không dùng làm payload Bot |
| zBusiness Basic tự cấp Bot/OA OpenAPI | UNKNOWN | Không có bằng chứng gói zBusiness Basic tự cấp OA OpenAPI hoặc interactive Bot menu |

**Không kết luận UNSUPPORTED** cho Bot Buttons, vì thiếu tài liệu không đồng nghĩa nhà cung cấp khẳng định không hỗ trợ. Không kết luận PROVIDER_TESTED vì **không gọi sendMessage menu**, không dùng token và không gửi bất kỳ tin nào trong V13.1.

## Lựa chọn đã IMPLEMENTED

- `MenuRegistry` và Action ID cố định `CUS_*`, `OWN_*`, `SUP_*`, không dựa vị trí nút.
- `MenuRenderer` chỉ cho phép `TEXT_NUMBERED`, `TEXT_COMMAND`, `MOCK_TESTED`; bất kỳ `NATIVE_MENU`, `QUICK_REPLY`, `INLINE_BUTTONS` đều fail-closed.
- `ChannelMenuAdapter` không gửi API. `send()` trả `ZALO_OUTBOUND_DISABLED`.
- `MOCK_WEB` callback chỉ dùng phép thử nội bộ với verifier QA; `ZALO_BOT` callback luôn bị chặn cho tới khi xác minh spec thật.
- Trang mock `qa/sales-lite/v131/mock/index.html` chỉ chạy client-side, dùng chung `menu-registry.json`. Thay vai trò trong UI **không cấp quyền backend**.
- `TEXT_NUMBERED`: khách dùng 1–6; chủ shop 1–7; cùng số là action khác nhau tùy actor do trusted resolver cung cấp.

## Tiêu chí xem xét PROVIDER_TESTED

Cần tài liệu endpoint/schema Bot chính thức hoặc phản hồi xác nhận có thể kiểm tra từ Zalo về payload menu. Sau đó cần **phê duyệt riêng** người nhận QA, loại menu, số lần gửi, chi phí, rollback và giới hạn thử nghiệm. Không chỉnh webhook đã Published. Lưu request **đã redacted** + response status/message ID, không log secret hoặc PII. Không gửi không có phê duyệt.

## Đánh giá thương mại

Gói thử `Lite 199.000đ/tháng` và `Plus 349.000đ/tháng` là GIẢ THUYẾT, không cập nhật hệ thống Billing. Biên lợi nhuận/shop chỉ có thể ước tính sau khi có quota Zalo, giới hạn API thương mại, chi phí AI và chi phí vận hành/chăm sóc thực tế. Không tuyên bố kinh doanh Bot API được phép chỉ vì Owner đã nâng cấp zBusiness Basic.

**Kết luận:** Text menu Candidate là lựa chọn MVP ít phụ thuộc nền tảng; native interactive buttons vẫn UNKNOWN/khóa. Giữ kiến trúc sẵn sàng nâng cấp, không đánh cược vào payload chưa được xác minh.
