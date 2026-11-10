# API contract · v0.1 PROPOSED
|Luồng|Input|Kết quả/điều kiện|
|---|---|---|
|Đọc catalog|actor từ session, shop đã cấp quyền, SKU|200 giá và đơn vị; 403 nếu không có membership|
|Preview cart|lines[{sku,qty,unit}], currency VND|Tổng tính ở server theo price list và phiên bản; 422 khi đơn vị sai|
|Ghi đơn staging|cart version, idempotency key, request ID|201 lần đầu, trả cùng kết quả khi retry; 409 nếu key cũ đi kèm payload khác|
|Nhận callback|provider event ID và xác thực phía server|Ghi nhận một lần theo shop/provider; cập nhật entitlement sau xác minh|
|Tạm nghỉ shop|admin actor, target shop, lý do, expected version|Đổi trạng thái đúng shop, 409 khi xung đột; lưu audit|
Tenant không lấy từ nội dung prompt. Fail closed khi session, scope hoặc entitlement thiếu; chỉ trả mã lỗi và correlation ID. Acceptance: hai tenant có cùng SKU/key không đọc/ghi lẫn nhau; expiry A không chặn B.

Nguồn đối chiếu: [Pages tại baseline](https://github.com/ngoctien20/demo-git/tree/7bf9c660e70a65295e80b0fba8c241590d6aa0bf) · [checkpoint monitor](https://github.com/ngoctien20/demo-git/pull/1) · [checkpoint tổng thể riêng của dự án, ngày 10/11/2026].

