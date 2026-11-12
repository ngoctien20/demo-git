# Bàn giao cho phiên sau

Fetch các branch của PR #13–20 và ref staging, đối chiếu deployment LIVE trước khi sửa. PR #20 phụ trách cơ chế phối hợp agent, #14 là bàn giao sản phẩm. Release Auth đã chứa #16 và #17; kiểm ancestry trước khi hợp nhất.

**Control Hub:** Có thể ghi nhận bài kiểm Render ẩn danh, RLS PostgreSQL hai chiều, và regression Commerce sandbox ở cấp nhiệm vụ con. Chưa tích mục cô lập E2E, trừ/hoàn kho giao dịch hoặc hành trình demo → nghiệp vụ. Việc kiểm phiên bản workflow ghi nhận theo từng ID/version; bốn draft đang lệch.

**Pilot đề xuất**

| Quy mô | Điều kiện vào | Điều kiện mở rộng |
|---|---|---|
| 1 shop | Auth/RLS signed HTTP và restore đạt, cử đầu mối hỗ trợ, duyệt kênh và dữ liệu | Đối soát từng đơn/tồn kho, bàn giao nhân viên và chi phí; dừng nếu sai quyền hoặc lệch kho |
| 3 shop | Một shop đã đối soát, giới hạn tool/quota theo tenant | Phân biệt đúng dữ liệu, sự cố và chi phí từng shop; thử rollback một tenant |
| 5 shop | Có cảnh báo, kiểm tải đồng thời, ca trực hỗ trợ và quy trình sự cố | Đo độ trễ, tỷ lệ lỗi, chi phí/đơn trước khi quyết định mở rộng |

Ước chi phí mỗi shop từ số lượt chat × token vào/ra thực đo × đơn giá model đã chọn, cộng phần hạ tầng và hỗ trợ. Chưa có dữ liệu để báo con số tiền. Domain: chọn tên, kiểm khả dụng và báo giá Mắt Bão tại thời điểm quyết định, duyệt chi phí, sau đó mới cấu hình Cloudflare DNS và kiểm TLS/rollback.

Điểm chạy QA danh tính đã có sẵn tại ops/data-platform/scripts/live_auth_acceptance.py trên nhánh ops/tenant-data-platform-v1-staging-20261110. Chạy với hai tài khoản QA trong môi trường bí mật để xác minh gateway, PostgREST, refresh và local logout. Script hiện kiểm đọc; tiếp tục bộ test write-denial riêng trước khi bật chức năng ghi.


## 12/11/2026 — Ordered next handoff

1. Reuse [Draft PR #26](https://github.com/ngoctien20/demo-git/pull/26) as verified conflict fix stacked on Work V11 #22. Base Work PR #22 CI was still failing due 40001. Do not merge unreviewed branches or revert PT409 with an older SQL candidate.
2. Verify staging SQL migration history contains `v11_qa_merchant_product_stale_conflict_pt409` and `public.save_merchant_product` retains two shop UUID+slug allowlist, owner/manager check, anon-deny and direct product-table-write deny. Never reapply migration blindly.
3. Run actual Supabase Auth login/recovery/refresh with two controlled QA accounts through private CI secrets; preserve RLS, no token logging. **This remains the P0 production blocker.**
4. Complete merchant product editor gate only after real signed JWT positive/negative and owner review. No customer/real-order writes.
5. Verify on-demand public provider health CI and store outcome without asserting cloud deployment SHA from an HTTP status code.
6. Build/review Super Admin hosted identity adapter, backup/restore isolated rehearsal, quota/AI monitoring, Messenger QA with owner-chosen approved channel.
7. Draft production readiness checklist for 1→3→5 merchant pilots. Continue to forbid DNS/domain purchase, billing activation and production merge without owner's approval.


### Verified follow-up from 12/11/2026 CTO continuation

- Public staging health and hosted anonymous Auth SHA checks are now **PASS** at [43116766699](https://github.com/ngoctien20/demo-git/actions/runs/43116766699) and [43116766858](https://github.com/ngoctien20/demo-git/actions/runs/43116766858); do not repeat the stale default SHA `32669aba...` when validating the current Render Auth release `deaa5e1c...`. Work #25 independently tracks the related QA workflow correction; avoid duplicate PR merges.
- Render Free cold start must be monitored as a transient 503/recovery event, not silently classified as uptime. Persistent 503 must fail the release gate and be escalated.
- P0 remains signed-in, independent Supabase Auth sessions A/B with tenant negative writes/reopen/refresh/logout. Anonymous-only PASS is not sufficient for release.

### Tiếp quản bản LIVE sau #28/#29

1. Cấp bốn repository Actions secrets dành riêng cho hai shop thử nghiệm: TIEN404_QA_A_EMAIL, TIEN404_QA_A_PASSWORD, TIEN404_QA_B_EMAIL, TIEN404_QA_B_PASSWORD. Chạy lại failed job [43149990296](https://github.com/ngoctien20/demo-git/actions/runs/43149990296). Workflow tự sử dụng public key từ build staging và đúng hai tenant đã duyệt.
2. Đọc riêng kết quả gateway/PostgREST, refresh, local logout, mobile reopen và membership. Nếu thiếu một shop, giữ trạng thái BLOCKED. Sau khi các bước này đạt, còn phải nghiệm thu staff/nonmember trên host và test ghi dữ liệu QA được phép trước khi bật editor.
3. Theo dõi lỗi và đối soát đơn/tồn kho trong fixture, chuẩn bị restore Supabase cô lập và hosted Super Admin. Không đưa bot Messenger đang phục vụ vào kiểm thử có tác dụng ghi.
