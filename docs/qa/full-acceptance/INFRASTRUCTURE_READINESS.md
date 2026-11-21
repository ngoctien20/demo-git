# INFRASTRUCTURE_READINESS — Round 1

| Hạng mục | Thực tế | Trạng thái |
|---|---|---|
| Backup Supabase | Free plan, không backup tự động; script `backup.ps1`/`restore-test.ps1` đã có nhưng **chưa chạy**; restore-test rỗng | **FAIL (P0-01)** |
| Môi trường tách biệt | Chỉ có 1 project Supabase "staging" mà bot live, QA và tester cùng dùng; n8n chỉ 1 instance cho cả production và QA | FAIL |
| Source ↔ runtime | Migrations, Render app, Super Admin, n8n không nằm trong `develop`/`main` | FAIL (P1) |
| Rollback | n8n có lịch sử version; Supabase không có backup; Render/Cloudflare không kiểm tra được | BLOCKED |
| GitHub | Repo public; không branch protection; Dependabot tắt; workflow không dùng secret; #478 không phải draft | FAIL (P1) |
| CI | 46 check xanh trên develop, toàn offline/synthetic | PASS (offline) |
| Secrets trong repo `develop` | Grep JWT/sb_*/sk-/EAA: chỉ thấy chuỗi giả `…test_qa_only`, `…local_fake` | PASS (develop); 500 nhánh khác NOT_TESTED |
| Secrets trong n8n | Meta verify token hard-code trong node `If` của `Z7Fd` (không phải App Secret) | P2 |
| Auth | Leaked password protection tắt | P2 |
| Logging/monitoring | Không có cảnh báo lỗi; n8n execution lưu PII (Messenger); một số workflow tắt lưu execution | FAIL |
| Render | Không truy cập được (proxy + connector lỗi) | BLOCKED |
| Cloudflare | Không có connector, proxy chặn | BLOCKED |
| Chi phí | n8n Cloud + OpenAI: website chat giới hạn 30 lượt/ngày; Messenger không có giới hạn tốc độ riêng ngoài dedup | Rủi ro thấp–trung bình |

Điều kiện tối thiểu cho pilot có kiểm soát: B-00 PASS (restore thật khớp baseline), tách project production khỏi staging/QA, đưa source runtime vào nhánh có protection, bật thông báo lỗi n8n.
