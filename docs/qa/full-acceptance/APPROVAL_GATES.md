# APPROVAL_GATES — việc Claude KHÔNG tự làm

Mỗi dòng cần phê duyệt cụ thể của chủ dự án. Không dòng nào đã được thực hiện trong V21.0 Round 1–2.

| Gate | Thao tác | Vì sao bị chặn | Ảnh hưởng nếu làm sai | Rollback |
|---|---|---|---|---|
| G-01 | Chạy backup/restore Supabase | Cần mật khẩu DB | Không (chỉ đọc staging, ghi restore-test) | Xóa restore-test |
| G-02 | Áp migration #482 lên restore-test | Hosted migration | Thấp (project dùng-một-lần) | Reset restore-test |
| G-03 | Áp bất kỳ migration nào lên staging `ifxlvrhyjhbzbrkdsida` | Hosted migration, staging đang phục vụ bot/tester | Cao | Chưa có backup → không rollback được |
| G-04 | Cutover #481 (unpublish `OgDZ` + REVOKE anon) | Đổi grant + toggle n8n | Ghép Shop B Zalo lỗi âm thầm | Rollback SQL trong #481 + republish |
| G-05 | Unpublish / sửa bot Messenger `Z7Fd` | Workflow production, khách thật | Page ngừng trả lời | Republish version `1064b1b3` |
| G-06 | Publish Draft của `KrSn`, `fDB9`, `BkAi`, `U2DJ`, `iyfG` | Publish n8n | Đổi hành vi tạo/sửa đơn live | Restore version Published hiện tại |
| G-07 | Tắt lưu execution / bật redaction n8n | Sửa workflow live | Mất khả năng debug | Bật lại |
| G-08 | Sửa mô tả, ghi chú workflow | Sửa workflow live (metadata) | Thấp | Lịch sử version |
| G-09 | Branch protection, Dependabot, đổi #478 sang draft | Quyền admin repo | Thấp | Gỡ rule |
| G-10 | Merge #477, #478, #468, #479–#482 | Merge PR | Cao | Revert |
| G-11 | Gọi webhook n8n production bằng dữ liệu tổng hợp | Có node gửi thật / ghi Sheet | Gửi tin hoặc tạo đơn giả trên Sheet thật | Xóa dòng thủ công |
| G-12 | Tạo workflow clone trên n8n để chạy AI eval | Tạo tài nguyên + chi phí OpenAI | Chi phí token | Archive workflow |
| G-13 | UAT Page installation Messenger, Zalo deep link/QR, gửi tin thật | Provider send | Tin thật tới người dùng | — |
| G-14 | Bật leaked password protection, đổi cấu hình Auth | Cấu hình Auth | Thấp | Tắt lại |
| G-15 | Chọn workspace Render, cấp quyền Cloudflare cho kiểm toán | Credential/IAM | — | Thu hồi |
| G-16 | Thanh toán, billing, đổi gói Supabase/n8n | Chi phí | Chi phí | — |
