# B-P1-05 — Trusted Order Ownership Gateway (contract)

**Trạng thái: DRAFT / PROPOSED. Migration chưa áp ở đâu. Áp hosted cần chủ dự án duyệt (migration + quyền).**
Files: `10_order_ownership_gateway.DRAFT.sql`, `90_order_ownership_gateway_rollback.DRAFT.sql`, `offline-uat.sh` (56 ca).

## Nguyên tắc

1. **Mã đơn không phải bằng chứng sở hữu.** Ai biết `order_id` (hoặc mã đơn hiển thị) vẫn không xem/sửa được đơn.
2. Bằng chứng = **mã OTP 6 số** được gửi tới **liên hệ đã lưu của khách đặt đơn** (SĐT trên `customers`), và được nhập lại bởi **đúng người yêu cầu** (danh tính kênh đã xác minh).
3. Chỉ backend tin cậy (n8n/Worker **sau khi kiểm chữ ký webhook**) được gọi; `anon`/`authenticated` không bao giờ có EXECUTE.
4. Không lộ thông tin: đơn không tồn tại / thuộc store khác / không có SĐT đều trả **cùng một dạng** `accepted`.

## Định danh người yêu cầu (`p_requester`)

`<channel>:<installation>:<provider_user_id>` — ví dụ `messenger:<PAGE_ID>:<PSID>`. Backend tự ghép từ payload **đã xác minh chữ ký**; tuyệt đối không lấy từ nội dung khách gõ. DB chỉ lưu `sha256`.

## RPC (chỉ `service_role`)

| RPC | Vào | Ra | Lỗi |
|---|---|---|---|
| `order_ownership_request_otp(p_store, p_order, p_requester, p_nonce)` | store, đơn, người yêu cầu, nonce | `{status:'accepted', challenge_id, code, expires_at, deliver_to}`; `code`/`deliver_to` = `NULL` khi không phát mã | `rate_limited`, `replay_detected`, `invalid_requester`, `invalid_nonce`, `pepper_missing` |
| `order_ownership_verify_otp(p_challenge, p_code, p_requester, p_nonce)` | | `{ok:true, grant_id, order_id, expires_at}` hoặc `{ok:false, reason:'wrong_code'|'locked', attempts_left}` | `challenge_invalid` (không tồn tại / khác người yêu cầu / hết hạn / bị khóa / bị thay thế), `challenge_used`, `replay_detected` |
| `order_ownership_check(p_grant, p_order, p_requester)` | | `boolean` | — |
| `order_ownership_revoke(p_grant)` | | `boolean` | — |

Quy tắc backend:
- `code` chỉ được gửi tới `deliver_to.phone` (SMS/ZNS); **không bao giờ** trả về chính khung chat đang hỏi, không ghi log.
- Bot trả lời giống nhau cho mọi trường hợp `accepted`: "Nếu mã đơn đúng, mã xác nhận đã được gửi tới SĐT đặt hàng."
- Mọi thao tác xem chi tiết/sửa đơn phải gọi `order_ownership_check` ngay trước đó; không cache kết quả quá `expires_at`.
- `p_nonce` = id sự kiện của nhà cung cấp (Meta `mid`, Zalo `msg_id`) hoặc UUID request; dùng một lần trong 24 giờ.

## Tham số an toàn

| Tham số | Giá trị |
|---|---|
| Độ dài mã | 6 chữ số, sinh từ CSPRNG (`gen_random_uuid`) |
| Lưu mã | chỉ `sha256(pepper:challenge_id:code)`; pepper trong Vault `t404_order_gateway_pepper` (≥ 32 ký tự) |
| TTL mã | 5 phút (ràng buộc cứng ≤ 10 phút) |
| Số lần nhập sai | 5 → khóa challenge; mã đúng sau đó vẫn bị từ chối |
| Giới hạn yêu cầu | 3 mã / đơn / giờ; 5 mã / người yêu cầu / giờ |
| Mã mới | thu hồi mã cũ đang chờ của cùng đơn + người yêu cầu |
| Grant | 30 phút, gắn với 1 đơn + 1 người yêu cầu, 1 grant / challenge, thu hồi được |
| Replay | nonce một lần (24 h); challenge đã dùng → `challenge_used` |
| Audit | `order_otp_issued / failed / verified / request_noop` vào `app_private.audit_events` (không lưu mã, không lưu SĐT) |

## Quan hệ với hạ tầng có sẵn

- Staging có schema QA `tien404_v175_qa` (order_ownership, otp_challenges, replay_claims…) — **chỉ QA, không hàm, không nối Commerce**. Gateway này dùng thẳng `public.orders/customers/stores` (V20 Store Authority) nên không phụ thuộc schema QA đó; có thể nghỉ hưu schema QA sau khi gateway được duyệt.
- Giai đoạn sau (không nằm trong draft): danh tính kênh đã gắn với khách (`channel_identity` đã xác minh) có thể được miễn OTP cho đơn của chính khách đó.

## Điều kiện để áp (cần duyệt)

1. Tạo secret Vault `t404_order_gateway_pepper` (≥ 32 ký tự ngẫu nhiên) — đổi credential → cần duyệt.
2. `apply_migration` file 10 trên staging; hậu kiểm: `anon`/`authenticated` không EXECUTE, advisor không có finding mới.
3. Kênh gửi OTP (SMS/ZNS) — chưa có; trước khi có, gateway chỉ dùng được trong UAT có kiểm soát.
4. Rollback: file 90 (xóa 4 RPC + 3 bảng private; đơn/khách/audit giữ nguyên).
