# ADR V11.5-001 — Zalo-first, kênh thông báo do chủ shop chọn

**Ngày:** 2026-11-13 · **Trạng thái:** PROPOSED / STAGING · **Release:** NOT APPROVED  
**Phạm vi:** TIEN404 Commerce multi-tenant. AI_SALES_DEMO và Messenger live không được đổi.

## Quyết định sản phẩm

- **Zalo được hiển thị đầu tiên/đánh dấu đề xuất** tại *Cài đặt → Kênh thông báo*, nhưng không tự bật.
- Chủ shop có thể chọn Zalo, Telegram, Gmail, Messenger và Dashboard inbox. Không bắt buộc tạo Zalo OA mới để dùng dịch vụ khác.
- Kênh **bán hàng** (nơi khách nhắn) và kênh **thông báo** (nơi chủ shop nhận đơn) là hai mục đích khác nhau. Đơn đặt từ Messenger có thể thông báo Telegram.
- **Dashboard inbox** phải luôn có cơ chế đọc trạng thái riêng; nút “đã xem thông báo” không đổi trạng thái đơn `pending`.
- Chế độ `single`, `parallel`, `fallback` phải rõ ràng và được cấu hình riêng. Timeout/unknown không tự fallback hoặc retry vì có nguy cơ gửi trùng.

## Nghiên cứu Zalo chính thức — 13/11/2026

1. [Zalo Developers](https://developers.zalo.me/docs/) phân tách OA OpenAPI và ZBS Template Message (UID/SĐT); không thể dùng một quyền gửi cho mọi loại nội dung.
2. [Hướng dẫn khởi tạo ứng dụng và cấp quyền](https://oa.zalo.me/home/documents/guides/Khoi-tao-ung-dung-va-cap-quyen_117071366476220195) nêu OA được cấp quyền cho Zalo App, webhook từ tương tác và phân nhóm quyền; không chứng minh TIEN404 đã được cấp quyền.
3. [Xác thực OA](https://oa.zalo.me/home/documents/guides/xac-thuc-cach-1) yêu cầu hồ sơ và có thể yêu cầu giấy tờ doanh nghiệp/hộ kinh doanh. Cần xác minh tư cách của TIEN404 trước khi đăng ký OA chính thức.
4. [OA thử nghiệm kỹ thuật](https://oa.zalo.me/home/documents/guides/tao-tai-khoan-oa-thu-nghiem-ky-thuat_4023591696049457534) yêu cầu có ít nhất một OA doanh nghiệp **đã xác thực** để được hỗ trợ tạo OA Test. Do đó “dùng thử Zalo OA không cần giấy tờ” **không phải giả định an toàn**.
5. [Bảng giá OA áp dụng 01/06/2026](https://content.zalo.cloud/uploads/ZAP_Bang_gia_Dich_vu_ZOA_01062026_esigned_f340eb1ceb.pdf) ghi có chi phí gói OA và dịch vụ tin nhắn. Giá phụ thuộc loại dịch vụ, cần đọc lại tại thời điểm kích hoạt; không tự duyệt chi phí.
6. [Widget cấp tương tác](https://developers.zalo.me/docs/social/zalo-interactive-widget) có thể hỗ trợ người dùng chủ động cấp tương tác, nhưng vẫn cần đúng OA/App và chính sách gửi hiện hành.

## Mô hình kiến trúc còn cần phê duyệt

| Tiêu chí | A: TIEN404 Platform OA | B: Merchant-owned OA |
|---|---|---|
| Người sở hữu OA | TIEN404 | Từng chủ shop |
| Onboarding | Chủ shop nhận tin từ OA platform nếu được phép và đã cho phép tương tác | Chủ shop phải có OA và cấp quyền |
| Multi-tenant | Phải ánh xạ chủ shop ↔ UID được xác minh, ngăn gửi chéo | Token/OA phải cô lập từng merchant |
| Phí/rủi ro | TIEN404 quản lý phí và chính sách | Phí có thể thuộc OA merchant; quản lý OAuth phức tạp |
| Điểm chưa được xác minh | Chính sách cho phép OA platform gửi thông báo cho merchant khác | Điều kiện OA, OAuth, quyền và phí từng merchant |
| Trạng thái | **BLOCKED LIVE** | **BLOCKED LIVE** |

**Không khẳng định mô hình A hoặc B được phép** cho thông báo nội bộ “có đơn mới” khi chưa có xác nhận từ Zalo và tài khoản hợp lệ. Kiến trúc phần mềm dùng `ZaloNotificationAdapter` với các phương thức `validateConnection`, `validateRecipient`, `checkPolicy`, `estimateCost`, `preparePreview`, `send`, `normalizeAck`, `disconnect`. V11.5 chỉ triển khai các hàm kiểm tra/preflight thuần dữ liệu; **không có API gửi Zalo thật**.

## Channel Integration Center — UX contract v0.1

`GET /api/merchant/channels` trả danh sách cấu hình đã xác thực từ backend, không lấy `tenant_id` từ client. Mỗi kênh cần `enabled`, `is_primary`, `backup_enabled`, `state`, `recipient_verified`, `last_test_at`, `last_error_code`. UI hiển thị trạng thái *chưa kết nối, chờ xác minh, đã kết nối, cần kết nối lại, đang tạm ngưng, bị giới hạn*. **Zalo nằm đầu nhưng OFF khi chưa đủ điều kiện**. Test send cần xác nhận chủ shop + rate limit + QA recipient allowlist.

## Tình trạng kiểm chứng

- **VERIFIED:** Telegram V4.5 execution 2686 API accepted; Gmail 2687 API accepted, hai outbox rows accepted; Messenger QA 2688 27/27; đối soát 2691.
- **IMPLEMENTED:** module policy test độc lập trong `qa/lab/notification_v5_contract.cjs`.
- **BLOCKED:** Zalo OA/App credential, OA Test, phí, người nhận/consent, bộ gửi thật, dashboard endpoint authenticated, post-persist order event.
- **PROPOSED:** merchant choices persisted, multi-tenant outbox Postgres candidate, staged adapter, UI.

## Rủi ro & rollback

Không ghi/sửa `gh-pages`, published Messenger workflow hay đơn thật. Nếu module mới không đạt QA, revert PR nhánh V11.5; không cần rollback production. Trước release cần kiểm Auth A/B, tenant routing, provider timeout/duplicate, webhook forgery, Zalo pricing & permission và văn bản pháp lý.
