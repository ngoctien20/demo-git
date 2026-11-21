# P0_P1_REMEDIATION_BACKLOG

Thứ tự theo ưu tiên chủ dự án (P0 bảo mật/Store/backup > P1 bán hàng). Không tạo issue GitHub trùng; các mục đã có PR được tham chiếu.

| # | Mức | Việc | Phụ thuộc | Ai làm | Cần phê duyệt | Tiêu chí đóng |
|---|---|---|---|---|---|---|
| 1 | P0 | B-00: chạy `backup.ps1` + `restore-test.ps1`, đối chiếu baseline (46 bảng, 37 policy, 19 hàm, 21 migration) | Mật khẩu DB trên máy chủ dự án | Chủ dự án chạy, Claude kiểm chứng SQL | Có (credential) | restore-test khớp baseline |
| 2 | P0 | Áp #482 Store Authority lên **restore-test** (không phải staging), chạy UAT Owner A/B bằng JWT GoTrue hosted | #1 | Thread #482 | Có (hosted migration) | 64/64 + Owner A/B hosted PASS |
| 3 | P1 | Quyết định số phận bot Messenger live `Z7Fd`: (a) giữ làm DEMO có nhãn rõ, giới hạn người thử; hoặc (b) tạm unpublish tới khi chuyển sang Commerce Supabase | — | Chủ dự án | Có (toggle n8n) | Quyết định ghi lại; nhãn đúng thực tế |
| 4 | P1 | Publish bản Draft đã sửa của `KrSn`, `fDB9`, `BkAi`, `U2DJ` **sau khi** review diff `fDB9`/`BkAi` (chưa đọc nội dung) và chạy test drift; hoặc ghi rõ lý do giữ bản cũ | #3 | Claude chuẩn bị diff, chủ dự án publish | Có (publish n8n) | versionId = activeVersionId; T-N test cập nhật sang kỳ vọng mới |
| 5 | P1 | Giảm PII: bật redaction production hoặc tắt lưu dữ liệu execution thành công cho `Z7Fd` + sub-workflow; đặt thời hạn xóa | #3 | Chủ dự án | Có (sửa workflow live) | Execution mới không còn PII |
| 6 | P1 | Sửa mô tả/ghi chú sai lệch của `Z7Fd`, `yIJk`, `OgDZ`, `wgkk`, `iyfG` | — | Claude soạn, chủ dự án duyệt | Có (sửa workflow live, chỉ metadata) | Mô tả khớp active/caller thật |
| 7 | P1 | Cutover Zalo #481 (unpublish Shadow rồi REVOKE anon) | Quyết định chủ dự án | Thread #481 | Có | Advisor không còn anon SECDEF |
| 8 | P1 | GitHub: branch protection `main`/`develop` (bắt buộc PR + CI), chuyển #478 về draft, bật Dependabot | — | Chủ dự án (quyền admin) | Có | API protection ≠ 404 |
| 9 | P1 | Đưa source runtime vào repo có kiểm soát: Supabase migrations (`supabase db pull` hoặc dump schema), export n8n workflow JSON (đã redact), nhánh Render auth/Super Admin → một nhánh tích hợp | — | Claude (Draft PR) | Không cho phần offline | `develop` chứa đủ source để dựng lại runtime |
| 10 | P1 | Commerce trên Supabase: RPC tạo đơn có idempotency key, trừ/giữ kho nguyên tử, Store scope | #2 | Claude (Draft PR + test PG17) | Có khi áp hosted | Test cạnh tranh tồn kho PASS offline + hosted |
| 11 | P1 | Thông báo đơn mới cho chủ shop qua outbox (sau khi đơn commit) | #10 | Claude | Có khi gửi thật | Không gửi khi ghi đơn lỗi; chống trùng |
| 12 | P2 | Bảo vệ sửa đơn: thêm OTP/đối chiếu sender PSID của người tạo đơn (S-08) | #10 | Claude | — | Test từ chối PSID khác |
| 13 | P2 | Bật leaked password protection | — | Chủ dự án | Có (cấu hình Auth) | Advisor sạch |
| 14 | P3 | Cập nhật `tests/test_saas_contract.py` theo login V13.4; ghim SHA cho actions | — | Claude | Không | `pytest tests/` 13/13 |

Ước lượng: chưa có backlog đo được để tính % hoàn thành; không công bố phần trăm.
