# TIEN404 AI — V15.2 ADV.5D: P0 Hosted RPC Security Review × Store Ownership/JWT-RLS Evidence Intake

**Ngày:** 16/11/2026 JST.  
**Chế độ:** Chỉ đọc hosted → mã nguồn **DRAFT / NO-SEND / NO-SQL-MUTATION**.  
**Nhánh:** `work/v152adv5d-hosted-rpc-store-jwt-proof-intake-nosend-20261116`.  
**Nguồn nền:** PR #170 (ADV.5C) OPEN DRAFT, HEAD `735862d9560391a8fe1f62afca11740337c3172d`. Không merge hoặc publish.

## 1. VERIFY — RPC đã kiểm tra mã, ACL, schema chỉ-đọc

Supabase staging: `tien404-staging`, project ref `ifxlvrhyjhbzbrkdsida`, PostgreSQL 17.11; trạng thái `ACTIVE_HEALTHY` khi kiểm tra.

RPC: `public.qa_shop_b_zalo_claim(uuid,text,text,text) RETURNS boolean`.

| Thuộc tính | Bằng chứng trực tiếp |
|---|---|
| Chủ sở hữu | `postgres` |
| Ngôn ngữ / mode | PL/pgSQL, SECURITY DEFINER=true |
| ACL | `postgres=X/postgres,anon=X/postgres` — **GRANT EXECUTE trực tiếp cho anon** |
| Quyền của role PUBLIC | Không có EXECUTE |
| Quyền authenticated | Không có EXECUTE |
| Quyền schema public của anon | Có USAGE |
| Search path riêng hàm | Giới hạn rỗng (`search_path=""` trong PostgreSQL) |
| Kích thước source | 1.181 ký tự |
| MD5 source do PostgreSQL tính | `37f127c1475378b2810197961398d945` |
| Kiểm soát đã thấy trong mã (đã che mọi literal) | Đọc giá trị bí mật được giải mã từ Vault; lấy claim request; đối chiếu hash/digest; kiểm tra định dạng/thời lượng tham số; tạo HMAC của sender và event; chuyển tiếp sang một hàm ở schema QA riêng |
| Hàm xử lý được gọi phía sau | `tien404_r1_qa.claim_owner_pairing_v3_synthetic(text,text,text,uuid,text,text,text)`, SECURITY INVOKER; schema riêng và hàm đều không callable trực tiếp bởi anon |
| Bằng chứng thực thi ngoài mạng | **KHÔNG CÓ**. Không gọi RPC, không gửi request forged, không dùng credential, không truy vấn OTP hoặc Vault value |

**Đánh giá đúng mức:** Quyền EXECUTE cho anon là một bề mặt đáng chú ý do hàm có quyền owner; tuy nhiên lớp kiểm soát bí mật, kiểm tra request claim và HMAC cho thấy **không thể từ ACL suy ra endpoint tự động cho phép chiếm Shop hoặc truy cập thông tin**. Cần thẩm định nguồn và tính xác thực của claim khi gọi qua Data API, quy trình cấp/đổi/revoke bí mật, rate limit, chống brute-force, replay, expiration của challenge, idempotency và tác động của hàm tiếp theo. Việc endpoint có mở ra ngoài mạng phải được xác minh độc lập theo Data API settings và bằng chứng operator; chưa làm phép thử truy cập công khai.

**Không tự thu hồi GRANT:** Hàm này có thể là giao diện claim một lần dựa vào callback được xác thực. Hành động REVOKE hoặc thay đổi source có thể làm đứt workflow hiện hành. Chỉ cân nhắc thay đổi khi xác định caller, có backup, đánh giá tác động, SOP rollback, QA và **phê duyệt riêng của người có thẩm quyền**.

Bước kiểm kê caller đã thực hiện: soát read-only workflow n8n `yIJk8LvJoLF40Z62` và `qWMu4n1wLkTZBNpI`; không thấy node có trường cấu hình nhắc tên RPC. Search index code của default branch GitHub không trả kết quả. **Không chứng minh RPC không được gọi ở các Worker/nhánh/private integration khác.**

## 2. VERIFY — Hosted Store Ownership/JWT-RLS

- `public.orders`, `public.order_items`, `public.products` có `tenant_id`, **không có `store_id`**.
- Không có bảng `public.stores` hoặc `public.store_memberships`.
- RLS đã bật và FORCE trên các bảng tenant-scoped. Policy SELECT `orders_manager_read`, `order_items_manager_read`, `products_member_read` dựa trên membership theo tenant và `auth.uid()`; **không có predicate store membership**.
- QA `tien404_r1_qa.owner_bindings` có **2 bản ghi trạng thái paired chưa hết hạn** khi kiểm tra; dữ liệu pairing QA không xác thực Owner G2.3 của bất kỳ shop thật.
- **Chưa chạy JWT thật / signed Data API negative proof** vì thiếu schema store, private Owner authorization và kế hoạch kiểm thử hosted được phê duyệt.

Không thể nghiệm thu cùng-Tenant Store A/B nếu chỉ kiểm tra cross-Tenant. Đặc biệt phải chứng minh **Owner/Manager Shop A không đọc Shop B**, kể cả khi chung tenant, và token của Shop C ở tenant khác không đọc Shop A/B.

## 3. Private evidence intake — SOP, không chứa dữ liệu thật trong GitHub

`advanced-hosted-rpc-store-private-intake.cjs` chỉ nhận metadata và bản kê **SHA-256** của bằng chứng đã được giữ riêng. Mọi receipt vẫn là **untrusted self assertion**, không xác minh chữ ký, owner, backup, consent, JWT, mã OTP, session hay quyền gì.

**Chỉ sử dụng kho bằng chứng riêng tư được đơn vị quản lý cho phép**, mã hóa khi lưu và truyền, quyền truy cập tối thiểu, ghi audit, tách người gửi và người xét duyệt. GitHub Draft/PR chỉ lưu loại bằng chứng, hash fingerprint, trạng thái `PENDING_PRIVATE_REVIEW`, **không upload bản gốc**.

Bộ chứng cứ phải thu ngoài cuộc trò chuyện, với quyền phù hợp:

1. **RPC_AUTHORITY_REVIEW:** người rà soát bảo mật độc lập kiểm tra hàm theo source hash, call graph, JWT claim trust, Vault secret access, OTP validation, no rate-limit/replay abuse.
2. **RPC_CALLER_DEPENDENCY:** xác định và lập danh sách caller thật ở Worker, API, n8n, backend; xác minh tác động của phương án giữ-harden/thu hồi quyền.
3. **STORE_MERCHANT_OWNERSHIP:** Merchant/Owner G2.3 được xác minh qua kênh tin cậy, rõ Tenant → Store → role, merchant consent, độc lập với tài khoản QA.
4. **SHOP_A_JWT_RLS / SHOP_B_JWT_RLS / SHOP_C_NEGATIVE_JWT_RLS:** session JWT được Supabase Auth cấp thật qua private operator; không dùng `service_role` làm quyền người dùng; không đưa JWT vào chat hay GitHub.
5. **SAME_TENANT_CROSS_STORE_DENY / CROSS_TENANT_DENY:** bên kiểm thử chứng minh cả negative cases. Phân biệt `200 []` (RLS zero rows) với `401/403` (lỗi xác thực/quyền); không xem mã HTTP là chứng nhận duy nhất.
6. **BACKUP_RESTORE_APPROVAL:** backup mã hóa và restore rehearsal có người được ủy quyền, idempotent, có manifest, đã kiểm chi phí, thời gian lưu và rollback.
7. **INDEPENDENT_SECURITY_REVIEW:** reviewer khác người tạo/cấu hình chứng minh source và RLS policy được ký duyệt theo quy trình nội bộ.

Chỉ ghi `receiptNonce` và `evidenceSha256` ngẫu nhiên; **không đặt JWT hash nếu điều này tạo liên kết với token thật**, không lưu URL kho riêng tư, provider account identifiers, tên/chứng minh thư/chữ ký cá nhân, OTP, SĐT, order ID hoặc nội dung hội thoại. Receipt dù đánh dấu `reviewedByIndependentAuthority:true` vẫn **không có quyền phát hành**.

## 4. Hosted JWT/RLS test matrix — kế hoạch, CHƯA THỰC HIỆN

| Case | Subject | Đối tượng | Kỳ vọng |
|---|---|---|---|
| JWT01 | JWT Shop A được cấp thật | Shop A Products/Orders | Đúng các row Shop A thử nghiệm |
| JWT02 | JWT Shop A | Shop B, **cùng tenant** | Deny, không lộ metadata riêng |
| JWT03 | JWT Shop B | Shop A, cùng tenant | Deny hai chiều |
| JWT04 | JWT Shop C, khác tenant | Shop A/B | Deny |
| JWT05 | JWT Owner A đã bị thu hồi membership | Shop A | Deny sau khi revocation có hiệu lực; lưu ý JWT claims cache |
| JWT06 | Hết hạn/sai chữ ký/anonymous JWT | Products/Orders | 401/403 hoặc no rows theo chính sách |
| JWT07 | Chủ Shop A cố thay `store_id` | CRUD thử nghiệm | WITH CHECK/authorization deny |
| JWT08 | RPC callback replay cùng challenge đã dùng | Claim QA được ủy quyền | Không thể claim lại; cần lock/idempotency thực |
| JWT09 | RPC brute force rate-limit | Chỉ kiểm trên môi trường thử nghiệm | Bị giới hạn, không ghi dữ liệu thật |
| JWT10 | Service-role abuse guard | Frontend/AI tools | Không lộ service-role; tool không chấp nhận raw SQL |

**Điều kiện trước JWT01–JWT10:** thiết kế Store migration đã được review; backup hợp lệ; có consent của merchant, danh tính signer và tester độc lập, phạm vi QA dữ liệu tổng hợp, ngân sách và phê duyệt thời điểm; trên staging dùng Data API với session JWT đã xác minh và khóa public phù hợp, **không dùng `service_role` cho người dùng**. Chỉ lưu response code, kết quả pass/deny, trace IDs phi nhạy cảm và policy version; không lưu JWT/PII, thông tin hàng thật hay full HTTP bodies.

## 5. Phương án xử lý RPC — PROPOSED ONLY

- **Phương án A — giữ và harden RPC:** giữ chức năng một lần nếu bắt buộc dùng anon webhook; đặt API server-side trust và kiểm tra nghiêm nguồn request; rate limiting + atomic nonce, constant-time comparison, expiration, key rotation, monitoring, allowlist; security review; chỉ khi có bằng chứng các lớp guard thực tế.
- **Phương án B — chuyển sang private authenticated gateway:** bỏ gọi trực tiếp anon tới SECURITY DEFINER, xác thực và authorize ở server gateway, có scoped signer và idempotency, hạn chế quyền EXECUTE; chỉ sau khi caller migration, backup, dự phòng và phê duyệt.
- **Phương án C — tạm cô lập:** vô hiệu hóa bề mặt RPC nếu phát hiện đường khai thác khả thi, nhưng cần xác định tác động, operator và phê duyệt cấp P0 riêng. Không tự thực hiện do có thể phá vỡ pairing hiện hành.

Mọi tùy chọn đều yêu cầu rollback và QA sau thay đổi. **Chưa chọn phương án, chưa REVOKE/GRANT, chưa sửa RLS/schema/credential.**

## 6. Kết quả QA và cổng release

- Code mới: `advanced-hosted-rpc-store-private-intake.cjs` (chỉ receipt metadata, fail closed) + `advanced-hosted-rpc-store-private-intake.test.cjs` (30 test).
- SQL chỉ đọc: `advanced-hosted-rpc-readonly-metadata.sql` (không chạy RPC, không truy xuất giá trị Secret/JWT/Orders).
- Workflow `v152-adv5d-hosted-rpc-private-intake-nosend.yml`: chạy unit gate mới và hồi quy ADV.5C, ADV.5, Secure Action; cấm static SQL mutation, HTTP send.
- Không sửa business policies hay PR #170. Các bộ Chromium mobile ADV.5B tiếp tục được kế thừa qua workflow cũ.
- **Status:** BLOCKED P0 RPC / BLOCKED P0 Store JWT-RLS / BLOCKED Owner consent; **NO_GO_HOSTED_OR_PRODUCTION**. QA source passing không tự dỡ các gate.

## 7. Rollback / checkpoint tiếp theo

Rollback draft: đóng PR con mới, không cần rollback hosted vì **không có thay đổi nào trên hosted**. Phạm vi kiểm tra chỉ đọc, không gọi model có phí, không publish hoặc merge.

**PROPOSED V15.2 ADV.5E — Authorized RPC Remediation Decision × Signed JWT/RLS Hosted Execution Gate**, chỉ quyết định phương án sau bằng chứng riêng tư. Không mặc định phê duyệt thay đổi quyền, JWT test thật, backup hoặc chi phí.

## 8. Bổ sung kiểm toán replay/OTP của hàm xử lý phía sau (read-only)

Đã đọc `pg_get_functiondef` ở dạng **che tất cả chuỗi literal**, và truy vấn chỉ-đọc `pg_constraint` / `pg_trigger` trên `tien404_r1_qa.owner_pairing_challenges` và `owner_pairing_claims_v3`. **Không đọc code_hash, p_code, OTP hay bản ghi cá nhân.**

- Hàm riêng `claim_owner_pairing_v3_synthetic` kiểm tra challenge đúng Tenant/Store/Bot, `requester_user_id IS NOT NULL`, `used_at IS NULL`, `expires_at > now()`, `failed_attempts < 5`, trạng thái bot hợp lệ và **FOR UPDATE OF c** trên challenge.
- Nếu mã không khớp digest, hàm tăng bộ đếm `failed_attempts` có giới hạn 5 rồi trả về false.
- Nhánh hợp lệ ghi vào `owner_pairing_claims_v3` với `ON CONFLICT DO NOTHING`; bảng có **PRIMARY KEY (tenant_key,store_key,bot_key,challenge_id)** và UNIQUE trên `inbound_event_ref` trong phạm vi Tenant/Store/Bot. Đây là các lớp giảm nguy cơ ghi claim trùng.
- Không thấy trigger không nội bộ trên hai bảng. Hàm private này không tự cập nhật `used_at` trong đoạn đã đọc; primary key claim hiện bảo vệ khỏi ghi claim mới trùng cùng challenge, nhưng **chưa chứng nhận toàn bộ vòng đời xác nhận/thu hồi**, vì có thể nằm trong hàm hoặc worker khác.
- Chỉ có định dạng QA synthetic (`qa-recipient-%`, `qa-event-%`) cho recipient và event theo CHECK constraints; **không áp dụng giả định này cho webhook thương mại thật**.
- `anon` không có USAGE của schema `tien404_r1_qa` và không có EXECUTE trực tiếp hàm riêng.

Kết luận: **guard chống sai OTP và replay có thiết kế cụ thể hơn so với giả định ban đầu**, nhưng P0 vẫn BLOCKED cho đến khi có bằng chứng tin cậy về claim nguồn (request JWT/session), caller chính thức, rate limit ở gateway, trạng thái revoke và kiểm chứng hosted thông qua người kiểm toán được phép. Không thử brute-force hoặc khởi tạo claim thật.
