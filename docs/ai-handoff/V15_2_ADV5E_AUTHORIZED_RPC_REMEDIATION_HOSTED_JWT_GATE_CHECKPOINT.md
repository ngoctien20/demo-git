# TIEN404 AI — V15.2 ADV.5E Authorized RPC Remediation Decision × Hosted JWT/RLS Execution Gate

**Ngày:** 16/11/2026 JST  
**Lifecycle:** EXPERIMENTAL / CANDIDATE / DRAFT / NO EXECUTION / NO SEND  
**Source baseline:** ADV.5D Draft PR #175, HEAD `e851bb5748c0a8da79f2c848a03863e3f70b9f30`.  
**Decision:** **NO_GO_HOSTED_EXECUTION_OR_PRODUCTION**. Mọi ý kiến/phê duyệt tự khai trong JSON đều không phải quyền vận hành thực.

## I. Trạng thái thực tế — VERIFIED READ ONLY

**Supabase:** `tien404-staging`, ref `ifxlvrhyjhbzbrkdsida`, PG17.11, ACTIVE_HEALTHY.

RPC `public.qa_shop_b_zalo_claim(uuid,text,text,text)`:
- `SECURITY DEFINER=true`; owner=`postgres`; `search_path=""`.
- PostgreSQL ACL: `anon` được `EXECUTE` **trực tiếp**, `authenticated` không được, `PUBLIC` không được. Có `USAGE` trên schema public.
- MD5 `pg_get_functiondef`: `37f127c1475378b2810197961398d945`, khớp baseline ADV.5D; **chưa sửa hàm**.
- Đọc mã đã lược bỏ literal ở ADV.5D: secret gate đọc từ Vault, kiểm tra request claim/đầu vào, HMAC. Hàm xử lý private là `tien404_r1_qa.claim_owner_pairing_v3_synthetic(...)`, SECURITY INVOKER; `anon` không có USAGE trên private schema và không thể gọi trực tiếp.
- Private claim logic có `FOR UPDATE OF c` trên challenge, `used_at IS NULL`, `expires_at>now()`, `failed_attempts<5`, ràng buộc UNIQUE theo challenge và inbound event, `ON CONFLICT DO NOTHING`.
- **Không kết luận an toàn/khai thác thành công:** chưa biết source trust thật của claim HTTP, caller trên các Worker/nhánh, rate-limit ở gateway, năng lực replay ngoài DB. Không chạy RPC, thử brute-force, đọc Vault values/OTP/JWT hoặc thao tác người dùng.

**Hosted Store:** `public.orders`, `public.products`, `public.order_items` có `tenant_id` nhưng **không có `store_id`**; không tồn tại `public.stores`, `public.store_memberships`. RLS trên bảng hiện tại là **theo Tenant**. Chưa chứng minh isolation Shop A/B cùng Tenant bằng JWT Auth đã ký.

**Supabase Advisor:** xuất hiện `rls_enabled_no_policy` INFO ở nhiều bảng private — đây không phải bằng chứng tự động lộ dữ liệu. Phải đọc quyền schema/API và policy riêng.

## II. RPC Remediation Decision — chọn hướng thiết kế, CHƯA phê duyệt vận hành

| Phương án | Lợi ích | Rủi ro | Trạng thái |
|---|---|---|---|
| A. Giữ `anon` RPC và harden | Ít thay đổi luồng hiện tại | Duy trì entrypoint quyền cao cho anon; phụ thuộc vào claim secret/header, rate limit | PROPOSED ALTERNATIVE |
| **B. Di chuyển dần sang private server gateway** | Cô lập provider verification, IAM, nonce/idempotency và quyền ghi; loại bỏ nhu cầu public caller trực tiếp | Có thể làm hỏng Owner pairing nếu còn caller; phải có giai đoạn thử và rollback | **PREFERRED DESIGN ONLY — NOT APPROVED** |
| C. Cô lập/khóa cấp tốc | Có thể giảm mặt tấn công nếu xác minh có khai thác | Có thể khiến kết nối Zalo/Owner không sử dụng được; cần thẩm quyền incident | EMERGENCY OPTION, NOT APPROVED |

**Khuyến nghị thiết kế:** B, triển khai theo nhiều cổng; **không REVOKE ngay**. Đây là phương án ưu tiên nghiên cứu, không phải quyết định chuyển production. Trước cutover phải có chứng cứ rõ từng caller, hồ sơ phụ thuộc, tính tương thích, người phụ trách, bản sao lưu/rollback và phê duyệt bảo mật riêng.

### Các pha thiết kế đề xuất

1. **Gate 0: Khóa baseline (READ ONLY).** Xác nhận source hash, ACL, Data API exposure thực tế, caller n8n, Worker, backend và provider routes. Nếu hash đổi, bắt buộc kiểm toán lại.
2. **Gate 1: Approval package.** Security reviewer độc lập + verified Owner/tenant/store scope + backup/restore operator. Tiếp nhận trong kho riêng tư mã hóa, không đưa JWT/OTP/credential/PII vào GitHub/ChatGPT.
3. **Gate 2: Synthetic parallel gateway.** Tạo gateway backend tách biệt trong nhánh/staging an toàn (khi được duyệt), xác minh chữ ký provider độc lập, tenant/store resolver server-side, nonce/idempotency bền vững, giới hạn số lần và logging phi nhạy cảm; **không cho bot thực hiện action commerce trước Store RLS**.
4. **Gate 3: Hosted Store schema/RLS migration.** Chỉ khi backup, dependency/contract và Owner phê duyệt; tạo `stores`/`store_memberships`, `store_id` với FK composite hoặc xác thực tenant/store, dữ liệu giả lập; thêm `USING` và `WITH CHECK` theo *membership của Store*, không chỉ tenant.
5. **Gate 4: JWT actual testing.** Operator dùng Supabase Auth cấp JWT thật trong môi trường QA được ủy quyền và tài khoản Shop A/B/C; không tự ký JWT, không dùng `service_role` để mô phỏng người dùng. Test cả same-tenant deny và cross-tenant deny.
6. **Gate 5: Cutover approval.** Chỉ sau khi đạt kiểm thử, xác nhận rollback, đóng các P0 và bảo đảm callback không mất tin; quyền `anon` được xem xét lại theo phương án phê duyệt **sau** khi caller đã chuyển. Không tự làm bước này trong ADV.5E.

### Rollback/rủi ro bắt buộc

- Backup mã hóa riêng có manifest và thử khôi phục: cần operator, reviewer và scope duyệt cụ thể; không dựa vào dấu tick tự khai.
- Chốt chính xác version hàm, ACL, policy, tenant/store schema, n8n workflow Published và connector caller **trước** thay đổi.
- Sau mỗi giai đoạn: chạy negative tests, theo dõi webhook delivery, Owner pairing, checkout, tenant leakage và có thao tác đảo ngược đã thử; không sử dụng rollback chỉ là đoạn SQL dự đoán.
- Nếu phát hiện khai thác có thể xảy ra: mở nhánh incident security, đánh giá tác động rồi xin quyền cô lập khẩn cấp; không ngầm lấy quyền từ tên ADV.5E.

## III. Hosted JWT/RLS Execution Gate — test matrix (NOT EXECUTED)

`qa/v147-custom-studio/advanced-authorized-rpc-remediation-gate.cjs` định nghĩa **12 trường hợp** và **15 điều kiện**. Kết quả kỳ vọng chỉ là thiết kế; không phải chứng nhận Data API:

| Case | Tình huống | Kỳ vọng |
|---|---|---|
| JWT01 | Shop A Manager → catalog của A | ALLOW đúng fixture A |
| JWT02 | Shop A Manager → catalog B, cùng Tenant | **DENY** |
| JWT03 | Shop B Manager → orders A, cùng Tenant | **DENY** |
| JWT04 | Shop C khác Tenant → orders A | **DENY** |
| JWT05 | Shop A user đã bị thu hồi membership | DENY khi revocation đã có hiệu lực |
| JWT06 | JWT hết hạn / sai chữ ký | AUTH REJECT hoặc không trả hàng |
| JWT07 | `anon` không có membership → Orders A | DENY |
| JWT08 | Shop A tự INSERT order sang Shop B | `WITH CHECK` DENY |
| JWT09 | Shop A cố UPDATE sản phẩm Shop B | `USING` và `WITH CHECK` DENY |
| JWT10 | Thử dùng lại challenge QA Owner | Durable replay DENY |
| JWT11 | Cross-Store RPC → private receipt | DENY |
| JWT12 | Frontend có thể lấy service-role? | KHÔNG lộ secret |

**Điều kiện bắt buộc của RLS:** Server phải xác thực member Store từ **bảng cấp quyền đáng tin cậy**, dùng `auth.uid()` của JWT thật, không tin `store_id`/role gửi trong body hoặc `user_metadata`. Định nghĩa RLS phải kiểm tra không truy cập chéo Store kể cả khi cùng tenant. Với UPDATE cần cả `USING` và `WITH CHECK`. Với DELETE/SELECT/INSERT kiểm riêng. Xác minh hành vi no rows/401/403 theo policy, không suy từ một HTTP status duy nhất. Không kiểm thử trên đơn thật.

## IV. Operation-specific approvals — phạm vi không thể suy diễn

Các thao tác yêu cầu **năm phê duyệt riêng**, không gộp: (a) sửa RPC/GRANT; (b) thay đổi Store schema/RLS; (c) kiểm thử Auth JWT thật; (d) backup/restore; (e) triển khai public channel/live send. Xác nhận ngân sách và những chi phí liên quan trước mọi thao tác có thể phát sinh phí.

**Không tiếp nhận JWT thật, OTP, secret, Vault key, file sao lưu, số điện thoại, ảnh CMND hay đường dẫn kho bí mật trong ChatGPT/PR.** Chỉ nhận receipt metadata vô hại, nhận xét và mã digest của bản chứng cứ đã được bảo vệ theo cơ chế nội bộ. Việc tự khai `independentSecuritySignerVerified=true` không cấp quyền.

## V. Triển khai ADV.5E — Draft only

- `advanced-authorized-rpc-remediation-gate.cjs`: tách options A/B/C; phương án B ưu tiên nghiên cứu; 15 prerequisite và 5 operation scopes; mọi flag `authorized/executable/released=false`; 12-case JWT matrix; không có DB client/HTTP/JWT signer.
- `advanced-authorized-rpc-remediation-gate.test.cjs`: 32 bài chống ghi sai trạng thái/giả mạo và hồi quy an toàn.
- `.github/workflows/v152-adv5e-authorized-rpc-jwt-noexec.yml`: unit tests ADV.5E + inherited 5D/5C và static No-Execution.
- Tất cả chạy trên GitHub Draft No-Send; không thao tác `GRANT/REVOKE`, Auth, RLS, n8n Published, Orders, backup hoặc sản phẩm thật.

## VI. Release checklist

| Gate | Hiện trạng | Bằng chứng cần |
|---|---|---|
| RPC P0 entitlement và caller attribution | **BLOCKED** | Reviewer, call graph, trusted claim source, rate-limit/replay abuse QA |
| Owner G2.3 / consent | **BLOCKED** | Private verified merchant Owner, Store/Channel authorization |
| Hosted Store isolation | **BLOCKED** | Store migration + signed JWT A/B/C tests, same-tenant deny |
| Backup/rollback | **BLOCKED** | Verified encrypted backup and actual restore QA |
| Provider capability / ZBS spend | **BLOCKED** | Per account permission, budget, template grant |
| Independent Merchant UAT ADV.5B | **NOT VERIFIED** | Reviewer and fresh card-layout acceptance |
| ADV.5E code-level gates | **TESTED when CI completes** | GitHub exact HEAD checks |
| Hosted/Production approval | **NO-GO** | Separate explicit release authorization and all P0 cleared |

**Rollback:** close child Draft PR ADV.5E or revert its additive code/doc commits. Không có hosted rollback vì **không có hosted mutation**.

**PROPOSED V15.2 ADV.5F:** Independent RPC Caller Evidence × Hosted Store Migration Dry-Run & Private Approval Ledger. Tuyệt đối không tự gộp/merge các Draft PR, không bật kênh LIVE.

Nguồn tài liệu Supabase: [Securing your API](https://supabase.com/docs/guides/api/securing-your-api), [Postgres RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
