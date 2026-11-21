# FINAL_RELEASE_DECISION — V21.0 (sau Round 1–2, chưa hoàn tất mọi vòng)

## Kết luận: **NOT READY**

TIEN404 AI chưa đủ điều kiện chạy pilot với cửa hàng đầu tiên, kể cả pilot cô lập trên nền tảng SaaS.

## Lý do (theo bằng chứng)

1. ~~P0-01 Backup/restore chưa chạy~~ → **đã đóng 13:20 UTC** (S-01 VERIFIED, fingerprint 113/113, cron hằng tuần).
2. **P0-02 Store Authority**: đã áp lên STAGING, catalog PASS và UAT Owner A/B PASS (E-30). Còn: kiểm qua JWT do GoTrue ký và ghi migration vào lịch sử.
2b. **P0 sự cố S-17**: chờ xác nhận đã đổi mật khẩu DB.
3. **Commerce production chưa tồn tại trên Supabase.** Đơn hàng duy nhất đang chạy thật đi qua Google Sheet DEMO từ một bot Messenger mang tên "TEST", với code Published cũ hơn Draft, PII không redact, không trừ kho, không thông báo chủ shop.
4. **Subscription/billing NOT_IMPLEMENTED**, onboarding tự phục vụ NOT_IMPLEMENTED.
5. Runtime (Render, Super Admin, n8n, migrations) không nằm trong nhánh có kiểm soát; Render/Cloudflare không kiểm chứng được.

## Đã sẵn sàng (ở mức đã kiểm)

- Website marketing tĩnh: link/điều hướng PASS offline.
- Website AI consultant: chạy thật, không có tool, chỉ đọc (rủi ro DoS quota P2).
- Thiết kế bảo vệ Messenger: HMAC timing-safe, allowlist Page, lọc echo, xác nhận đơn bằng prompt, expected_total khi sửa đơn.
- Các hàm SECURITY DEFINER hiện có không mở đường chéo tenant (reviewer + SQL).
- 631 test offline + 46 CI check xanh (chỉ OFFLINE).

## Chưa sẵn sàng

Store isolation hosted, Commerce ghi trên Supabase, tồn kho, thông báo đơn, billing, onboarding, Page installation đa merchant, Zalo deep link/QR, Zalo OA, AI eval định lượng, backup.

## Lộ trình tới khách hàng đầu tiên (đề xuất, chưa phê duyệt)

1. ✓ B-00 backup + restore (xong 2026-11-21).
2. Store Authority: ✓ áp staging, ✓ UAT Owner A/B (E-30). 
3. Quyết định bot Messenger live (giữ DEMO có nhãn đúng hay tạm dừng) + redaction PII.
4. RPC tạo đơn Supabase có idempotency + giữ kho + outbox thông báo; nối Messenger của **một** Page merchant thử nghiệm vào RPC này.
5. Đánh giá AI bằng 137 case có sẵn trên bản clone.
6. Khi 1–5 PASS ở HOSTED UAT: xem xét **READY FOR CONTROLLED MERCHANT PILOT**.

Billing/subscription (P2) chỉ bắt đầu sau khi P0 đóng.
