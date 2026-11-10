# Dependency
Backend identity → membership/shop → entitlement → tool scope → sự kiện ghi. Messenger channel ownership → tenant mapping → agent → tool → outbox. Admin thao tác theo shop; workflow dùng chung tiếp tục phục vụ shop còn quyền.

P0 cách ly Lab và contract tenant có thể chạy song song với rà diff n8n. Sau đó mới test hội thoại/giá và admin staging. Billing phụ thuộc admin + DB transaction; Core phụ thuộc QA Agent và Commerce. Industry pilot phụ thuộc Core candidate được duyệt. Hub chỉ nhập evidence đã che thông tin.

Nguồn đối chiếu: [Pages tại baseline](https://github.com/ngoctien20/demo-git/tree/7bf9c660e70a65295e80b0fba8c241590d6aa0bf) · [checkpoint monitor](https://github.com/ngoctien20/demo-git/pull/1) · [checkpoint tổng thể riêng của dự án, ngày 10/11/2026].

