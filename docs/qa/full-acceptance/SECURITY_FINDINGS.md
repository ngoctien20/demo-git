# SECURITY_FINDINGS — Round 1 + Round 5 (reviewer độc lập)

Reviewer: **không có Codex Worker** trong môi trường này. Vai trò reviewer do một subagent Claude độc lập, chỉ đọc (n8n đọc, Supabase SELECT, đọc repo; không credential, không dữ liệu khách) đảm nhiệm. Kết luận của reviewer chỉ được ghi CONFIRMED khi Claude đối chiếu lại bằng dữ liệu thô (JSON workflow, SQL, test). Không tìm thấy P0 bảo mật đang bị khai thác.

| ID | Mức | Phát hiện | Bằng chứng | Reviewer | Trạng thái |
|---|---|---|---|---|---|
| S-01 | **P0** | Không có backup/restore đã kiểm chứng cho Supabase (Free plan, script chưa chạy, restore-test rỗng) | E-10, audit 10:36 UTC | n/a | OPEN (B-00) |
| S-02 | **P0** | Không có Store Authority trên hosted: 0 bảng Store, 0 `store_id`; RLS chỉ mức tenant → không cô lập Store A/B | E-10 | n/a | OPEN (#482 PROPOSED) |
| S-03 | **P1** | Bot Messenger LIVE chạy trong workflow tên "TEST" (`Z7FdV7uDvApfbURQ`): nhận văn bản tự do của mọi người nhắn Page, gửi trả lời thật, ghi đơn vào Google Sheet DEMO; ngoài Supabase/tenant/RLS | E-15 (exec 4498: đơn `created` + Meta message_id) | CONFIRMED | OPEN |
| S-04 | **P1** | PII khách (tên, SĐT, địa chỉ) lưu nguyên trong execution n8n (`redaction.production=false`) và trong Sheet; chưa có chính sách lưu giữ | E-19 | CONFIRMED | OPEN |
| S-05 | **P1** | Nhãn sai lệch vận hành: node "Send Messenger Reply" và "Record Successful…" ghi chú DISABLED nhưng `disabled:false`; `yIJk`, `OgDZ`, `wgkk`, `iyfG` có mô tả "inactive / no outbound / not connected" trái với thực tế (OgDZ gọi RPC Supabase; iyfG được bot live gọi) | E-18 | CONFIRMED + mở rộng | OPEN |
| S-06 | **P1** | Repo **public**, `main`/`develop` không branch protection, Dependabot tắt; #478 không phải draft, mergeable vào `main` | E-05 | CONFIRMED (một phần) | OPEN |
| S-07 | P1→P2 | `qa_shop_b_zalo_claim` SECURITY DEFINER, `anon` EXECUTE. Chặn bằng secret Vault ≥43 ký tự (so SHA-256) + challenge + code 32 hex; `search_path=''`; chỉ tác động Shop B tổng hợp. Reviewer đề xuất P2; giữ P1 hardening theo quyết định trước của chủ dự án | E-11 | PARTLY | OPEN (#481 chờ duyệt) |
| S-08 | P2 | Sửa đơn/đổi địa chỉ chỉ cần `order_id` + SĐT; cả hai xuất hiện trong tin trả lời chat → ai biết hai giá trị có thể đổi đơn người khác | Mô tả tool `manage_order`, `update_order_address` | NEW (reviewer), Claude xác nhận từ JSON workflow | OPEN |
| S-09 | P2 | Bot live định tuyến tin bắt đầu bằng `QA_CORE:` sang Commerce sandbox `iyfG`; phản hồi được chặn bởi node "Assert Demo Reply Safe to Send" | Node "V17.15 Route QA_CORE Only?" | NEW (reviewer), Claude xác nhận | OPEN |
| S-10 | P2 | Website chat `wgkk` public không auth; CORS không phải kiểm soát server; quota static data không nguyên tử, `sessionId` do client gửi → ai cũng có thể dùng hết 30 lượt/ngày (DoS demo), chi phí mỗi lượt vẫn bị chặn (650 ký tự, 1400 token, 50 s) | E-16 | PARTLY | OPEN |
| S-11 | P2 | Leaked password protection của Supabase Auth đang tắt | Advisor | n/a | OPEN |
| S-12 | P2 | Draft≠Published ở 5 workflow; parser giá Published nhận giá dạng chữ sai (`1.2tr`→1,2 đ) nếu chủ shop nhập giá dạng chữ; báo cáo doanh thu Published bỏ qua tổng có định dạng | E-14, E-17 | CONFIRMED drift; PARTLY khả năng xảy ra | OPEN |
| S-13 | P3 | Meta verify token hard-code trong node `If` (chỉ dùng cho handshake GET, không phải App Secret) | E-19 | CONFIRMED | OPEN |
| S-14 | P3 | Dedup MID ghi sau khi gửi thành công (~15 s) → 2 bản sao cùng tin trong cửa sổ đó đều đi qua; create_order có chặn trùng 30 phút | JSON workflow | NEW (reviewer) | OPEN |
| S-15 | P3 | 88/96 `uses:` trong GitHub Actions ghim tag, không ghim SHA (gồm `supabase/setup-cli@v1` bên thứ ba); mọi workflow có `permissions: contents: read`, không `pull_request_target`, không `secrets.*` | E-05 | CONFIRMED | OPEN |
| S-16 | P3 | `save_merchant_product` cho phép giá 0 | pg_get_functiondef | NEW (reviewer) | OPEN |

Không phát hiện: đường truy cập chéo tenant qua `qa_owner_pairing` / `save_merchant_product` (cả hai kiểm tra membership của `auth.uid()` và allow-list tenant QA, `search_path=''`); grant `anon` lên bảng `public`; USAGE của `anon`/`authenticated` lên schema private; secret thật trong `develop`.

Chưa kiểm tra: secret trong 500 nhánh còn lại (fetch không blob, lệnh grep toàn lịch sử bị chặn trong phiên reviewer); code Render/Cloudflare đang deploy; authz của Super Admin Python; cấu hình Meta App (quyền, App Review).
