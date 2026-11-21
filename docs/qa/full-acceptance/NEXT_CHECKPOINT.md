# NEXT_CHECKPOINT — tiếp tục V21.0 mà không lặp thao tác

## Checkpoint đã đo (2026-11-21 ~12:00 UTC)

```
main 2ddf013 | gh-pages ff2daf9 | develop 00aff9b
PR draft: #468 63f22af | #476 504e71d | #477 00aff9b | #479 174e834 | #480 b46bf8a | #481 a7f6261 | #482 89e7d90 | #478 d4c1424 (không draft)
Supabase staging: 21 migration, max 20261117074559; 0 store_id; restore-test rỗng
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
| R2 | Đọc nội dung Published vs Draft của `fDB9`, `BkAi`, `iyfG`; mở rộng test drift | Không cần duyệt |
| R2 | Review authz Super Admin Python (`ops/super-admin-v4-staging-20261110`) | Không cần duyệt |
| R2 | Quét secret toàn bộ 502 nhánh (cần fetch blob) | Không cần duyệt; cần quyền chạy git grep |
| R2 | Sửa 2 contract test lỗi thời | Không cần duyệt |
| R3 | Restore-test + Store #482 + Owner A/B | G-01, G-02 |
| R3 | AI eval trên clone | G-12 + bộ case |
| R4 | Browser E2E trang public (desktop/mobile) bằng trình duyệt trên máy chủ dự án | Không cần duyệt (chỉ đọc trang public) |
| R4 | Render/Cloudflare deployed commit | G-15 |
| R6 | Đánh giá lại quyết định phát hành | Sau R3 |

## Cách bắt đầu phiên sau

1. `git fetch origin claude/project-thread-2rqcm1` và đọc `docs/qa/full-acceptance/*`.
2. So checkpoint trên với trạng thái mới (SQL `max(version)`, n8n versionId); nếu khác → ghi delta trước khi test.
3. Chọn việc theo bảng trên; không gọi webhook production.
