# NEXT_CHECKPOINT — tiếp tục V21.0 mà không lặp thao tác

## Checkpoint đã đo (2026-11-21 ~12:00 UTC)

```
main 2ddf013 | gh-pages ff2daf9 | develop 00aff9b
PR draft: #468 63f22af | #476 504e71d | #477 00aff9b | #479 174e834 | #480 b46bf8a | #481 a7f6261 | #482 89e7d90 | #478 d4c1424 (không draft)
Supabase staging: 21 migration, max 20261117074559; 0 store_id; restore-test rỗng
(13:40 UTC) staging có Store V20: 2 store, 7 cột store_id; restore-test là bản sao staging (B-00, cron CN 19:00 UTC sẽ reset)
n8n: 174 wf / 23 active; Z7Fd active=1064b1b3; drift: KrSn 4740251a, fDB9 137d5689, BkAi 93cf227a, U2DJ 978b5a8d, iyfG 456862c9
Render/Cloudflare: chưa kiểm chứng
```

Không có thao tác ghi nào ngoài nhánh `claude/project-thread-2rqcm1` (tài liệu này + 1 file test offline). Không cần rollback runtime.

## Đã làm — KHÔNG làm lại

- Inventory GitHub/Supabase/n8n (SYSTEM_INVENTORY).
- 39 file test QA trên develop, test Render checkpoint, test drift n8n.
- Review độc lập read-only 6 nhận định.

## Chưa kiểm — việc của vòng sau

| Vòng | Việc | Điều kiện |
|---|---|---|
| R2b ✓ | Diff Published/Draft `fDB9`, `BkAi`, `iyfG` → S-18, S-19 | Xong 2026-11-21 |
| R2b ✓ | Super Admin 68/68, Control Hub 14/14 | Xong |
| R2b ✓ | Quét secret 503 nhánh: sạch | Xong |
| R2b ✓ | Sửa contract test: 14/14 | Xong |
| R2c | Kiểm chứng sau khi chủ dự án đổi mật khẩu (S-17): SELECT thử bằng kết nối mới do chủ dự án chạy, rà `auth`/Postgres log | Chủ dự án xác nhận đã đổi |
| R2c ✓ | Kiểm catalog Store V20 trên staging (E-27), bản sửa S-18 (E-28), browser E2E public (E-29) | Xong 13:40 UTC |
| R3 ✓ | UAT Owner A/B trên staging (E-30), dùng 2 owner sẵn có + manager tạm trong transaction rollback | Xong 2026-11-21, chủ dự án duyệt |
| R3 | Kiểm lại qua JWT do GoTrue ký (đăng nhập thật) | Cần mật khẩu user test |
| R3 | AI eval trên clone | G-12 + bộ case |
| R4 | Render/Cloudflare deployed commit | G-15 |
| R6 | Đánh giá lại quyết định phát hành | Sau R3 |

## Cách bắt đầu phiên sau

1. `git fetch origin claude/project-thread-2rqcm1` và đọc `docs/qa/full-acceptance/*`.
2. So checkpoint trên với trạng thái mới (SQL `max(version)`, n8n versionId); nếu khác → ghi delta trước khi test.
3. Chọn việc theo bảng trên; không gọi webhook production.
