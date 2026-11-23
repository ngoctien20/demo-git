# TIEN404 AI

Trợ lý AI bán hàng cho shop nhỏ (Zalo, Messenger, web). Repo này giữ trang web công khai, App chủ shop và phần kiểm thử.
Không có khoá bí mật nào trong repo: khoá Supabase ở đây chỉ là khoá *publishable* (dùng được trên trình duyệt, quyền do RLS kiểm soát).

## Thư mục chính

| Thư mục | Nội dung |
|---|---|
| `site-src/` → `*.html` ở gốc | Trang web công khai. Sửa trong `site-src/pages`, rồi chạy `node scripts/build-site.mjs`. |
| `assets/` | CSS/JS của trang web (`site.css`, `site.js`, `site-config.js`). |
| `apps/owner/` → `app/` | App chủ shop (React). `app/` là bản đã build để đăng lên GitHub Pages. |
| `config-core/` | Lõi cấu hình bot + mã dựng code cho n8n, kèm test. |
| `db/` | Migration SQL theo từng phần (chỉ áp khi chủ dự án duyệt). |
| `ops/supabase-backup/` | SQL hỗ trợ sao lưu + khôi phục thử hằng tuần. |
| `qa/` | Kiểm thử offline (V13.6 Messenger, V20 Store Authority, V21–V25, reactions, config-core). |
| `docs/` | Ghi chú kỹ thuật và checkpoint. |

## Để dành dùng sau (chưa chạy trên web hiện tại)

| Thứ | Dùng cho |
|---|---|
| `qa/channel-v143`, `v144`, `v185`, `v1851`–`v1855` + `assets/widget-v185-*`, `ai-consultant.js`, `live-chat.css` | Khung chat nhúng vào web của shop + cổng bảo vệ Cloudflare (đã có test). |
| `qa/channel-v19811` | Kiểm tra Zalo OA chính chủ (chỉ đọc). |
| `qa/v201-p0-s1` | Ghép chủ shop qua mã QR (offline). |
| `src/scss/` + `MOTION_GUIDE.md` + `assets/style.css` | Hệ hiệu ứng chuyển động bản cũ (dựng lại bằng `npm run build:css`). |

Bản trước khi dọn (QA cũ V13–V20.1, tài sản web cũ) vẫn nằm trong lịch sử git ở commit `9355974`; lấy lại file bằng `git checkout 9355974 -- <đường-dẫn>`.

## Kiểm tra nhanh

```bash
node scripts/build-site.mjs && git diff --exit-code -- '*.html' sitemap.xml
python qa_static.py
python -m unittest discover -s tests -v
```
