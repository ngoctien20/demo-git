# TIEN404 AI

Trợ lý AI chốt đơn / đặt lịch cho shop nhỏ Việt Nam qua Messenger, Zalo và web.
Web công khai + App chủ shop chạy trên GitHub Pages (nhánh `gh-pages`). Bot chạy trên n8n + Cloudflare Worker + Supabase.

## Đọc gì trước

| Thư mục | Là gì | Trạng thái |
|---|---|---|
| `sales/` | Lõi bán hàng: luật tạo đơn, giữ tồn, báo đơn cho chủ shop | Ưu tiên số 1 (PR #502) |
| `booking/` | Đặt lịch + cọc VietQR + nhắc lịch (ngành thử spa/nail) | Code + test, chưa bật |
| `setup/` | Tự dựng trợ lý từ ảnh bảng giá / link | Code + test, chưa bật |
| `apps/owner/` | App chủ shop (React + Vite), build ra `app/` | Đang chạy |
| `config-core/` | Cấu hình trợ lý: menu, biểu cảm, hồ sơ ngành | Đang chạy một phần |
| `db/` | Migration Supabase theo đợt (mỗi đợt có README + rollback) | Đã áp staging |
| `site-src/`, `scripts/`, `*.html`, `assets/` | Web công khai (sinh bằng `scripts/build-site.mjs`) | Đang chạy |
| `ops/supabase-backup/` | Sao lưu + thử khôi phục Supabase hằng tuần | Đang chạy |
| `qa/`, `tests/`, `.github/workflows/` | Kiểm thử tự động (offline là chính) | |
| `docs/` | Ghi chép kiểm tra, bàn giao từng đợt | Tham khảo |

## Quy tắc an toàn

- Không bao giờ để khóa/mật khẩu trong repo. Khóa nằm trong secret của Worker, credential n8n, GitHub Secrets.
- AI không tự đặt giá, tồn kho, tiền cọc hay giờ trống: luôn lấy từ Sheet/DB qua các hàm có test.
- Mỗi thay đổi chạm dữ liệu thật, n8n, Worker, Supabase hay merge PR đều cần chủ dự án duyệt riêng.

## Chạy test nhanh

```bash
node --test booking/test/*.test.mjs setup/test/*.test.mjs   # + sales/test/*.test.mjs sau khi PR #502 vào
python3 -m pytest -q && python3 qa_static.py
```
