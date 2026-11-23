# TIEN404 · bảng điều khiển terminal (chỉ đọc)

Bảng điều khiển nền đen chữ xanh, xem nhanh trạng thái dự án ngay trong terminal:

- **Repo**: commit mới nhất của nhánh `develop` và kết quả CI.
- **PR đang mở**: 8 PR mới nhất, Draft hay chưa, tuổi, CI của 5 PR đầu.
- **Việc đang chờ**: đọc từ `data/tasks.json` (sửa tay).
- **Dịch vụ**: n8n, Worker, Supabase, Web. Hiện là **dữ liệu mẫu** (gắn nhãn `[MẪU]`).

Chỉ dùng thư viện chuẩn của Python 3.8 trở lên. Không cần cài gì thêm.

## Chạy

```powershell
cd tools\terminal-dashboard
python tien404_dash.py              # đọc GitHub thật (API công khai)
python tien404_dash.py --watch 60   # tự làm mới mỗi 60 giây (tối thiểu 30)
python tien404_dash.py --offline    # không gọi mạng, dùng data/sample_github.json
```

Hoặc bấm đúp `chay.bat` trên Windows.

Tuỳ chọn khác: `--ascii` (terminal cũ không hiện ký tự khung), `--no-color`, `--no-anim`,
`--width 100`, `--branch main`, `--prs 12`, `--pr-checks 3`.

Không cần token: repo công khai cho đọc 60 lượt/giờ. Nếu muốn nhiều lượt hơn, đặt biến
môi trường `GITHUB_TOKEN` (token chỉ đọc). Token chỉ nằm trong header gửi GitHub,
không bao giờ được in ra hay ghi xuống đĩa.

## Cắm trạng thái thật cho n8n / Worker / Supabase

Sửa `data/services.json`, đổi `"source": "sample"` thành `"source": "http"` và thêm
`"health_url": "https://..."` là một địa chỉ **công khai, không cần khoá**. Bảng chỉ gửi
GET và đọc mã HTTP (2xx/3xx = CHẠY, còn lại = DỪNG); chỉ chấp nhận `https://`.
Không đặt khoá, token hay URL có chứa khoá vào file này.

## An toàn

- Chỉ đọc: mọi yêu cầu mạng đều là GET; không ghi gì lên GitHub, n8n, Supabase hay Worker.
- Mọi dòng in ra đều qua bộ lọc che chuỗi giống token (`ghp_…`, `github_pat_…`, JWT, `sbp_…`).

## Test (offline, không gọi mạng)

```powershell
cd tools\terminal-dashboard
python -m unittest discover -s tests -v
```
