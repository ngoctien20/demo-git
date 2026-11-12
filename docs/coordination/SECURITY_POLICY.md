# Chính sách quyền và phát hành
Dữ liệu production, credential, billing, phân quyền quan trọng, xóa dữ liệu, promote Core, rollout và chi phí mới cần chủ dự án phê duyệt. Secrets nằm ở vault phía server; hồ sơ kiểm toán chỉ lưu tham chiếu. Không đặt nội dung khách hàng hoặc dữ liệu thanh toán trong CI/Linear/analytics.

PROPOSED staging: tách tenant bằng membership, kiểm server cho mọi route/tool; khóa unique scoped theo tenant. Thử actor chưa đăng nhập, sai vai trò, shop A/B, expired, revoke. Với Messenger chỉ dùng fixture trước khi có bằng chứng cách ly. Rollback pin bản trước và dừng entitlement của shop thử.

Nguồn đối chiếu: [Pages tại baseline](https://github.com/ngoctien20/demo-git/tree/7bf9c660e70a65295e80b0fba8c241590d6aa0bf) · [checkpoint monitor](https://github.com/ngoctien20/demo-git/pull/1) · [checkpoint tổng thể riêng của dự án, ngày 10/11/2026].

