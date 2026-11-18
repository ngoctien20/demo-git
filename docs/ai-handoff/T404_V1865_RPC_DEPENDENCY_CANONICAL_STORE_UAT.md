# TIEN404 AI — V18.6.5 RPC Dependency Audit × Canonical Store Authority × Protected Owner A/B UAT

**Ngày:** 18/11/2026 (JST)  
**Trạng thái:** CANDIDATE — STAGING ONLY — NO PRODUCTION  
**Phát triển tiếp:** V18.6.4 Draft PR #424, HEAD đã xác minh `d0bb6314cfbbc3ca01724729a76dfb9195f8d9ba`.  
**Quyền hạn:** Audit read-only, viết mã test offline, Draft PR. Không thay đổi quyền thực thi RPC, RLS, dữ liệu, Auth, credential, Cloudflare, n8n, Meta, Messenger hoặc webhook.

## 1. Sự thật được xác minh trực tiếp (VERIFIED)

- Supabase staging project `tien404-staging` — `ifxlvrhyjhbzbrkdsida`, PostgreSQL 17. Bảng `public.orders`, `public.products`, `public.conversations` có `tenant_id`, không có `store_id`. Các bảng có RLS ENABLED + FORCED; policy đọc Orders/Conversations kiểm tra role owner/manager theo **tenant**, Products kiểm tra membership theo **tenant**. Điều này không đảm bảo cách ly hai Store A/B cùng một tenant.
- Hai tenant QA hiện có là hai tenant độc lập. Tổng hợp membership read-only: `qa-staging-shop-a-20261110`: 1 owner active; `qa-staging-shop-b-20261110`: 2 owners active. Đây không phải minh chứng hai store trong cùng tenant hoặc phiên đăng nhập hoạt động.
- Ba SECURITY DEFINER RPC tồn tại trong `public`, owner = `postgres`, `search_path` rỗng; quyền kiểm tra qua `has_function_privilege`:

| RPC | anon EXECUTE | authenticated EXECUTE | Phần kiểm soát thấy trong source | Quyết định |
| --- | --- | --- | --- | --- |
| `qa_shop_b_zalo_claim(uuid,text,text,text)` | true | false | So sánh header `x-tien404-pairing` với Vault secret; kiểm tra định dạng challenge/code/sender/event; gọi routine pairing QA private | P1 REVIEW: giữ nguyên quyền cho đến khi xác định caller/gateway thực |
| `qa_owner_pairing(uuid,text,uuid)` | false | true | `auth.uid()`, membership active owner, danh sách bot QA synthetic, challenge TTL | REVIEW: không biến thành authority đa store |
| `save_merchant_product(uuid,text,text,bigint,boolean,integer,timestamptz)` | false | true | `auth.uid()`, owner/manager tenant QA A/B, validate SKU/giá, optimistic timestamp, audit | REVIEW: writer staging vẫn theo tenant, không tự sửa hoặc gọi |

**Không đọc giá trị Vault secret hoặc token.** Cấu hình `anon` EXECUTE không đồng nghĩa đã có lỗ hổng khai thác; nhưng chữ ký/header bí mật không tự nó chứng minh webhook xuất phát từ provider. Endpoint phải có nguồn xác thực độc lập.

### Bằng chứng phụ thuộc: phạm vi và giới hạn

- Đã đọc **8 workflow n8n** liên quan Zalo, Messenger, Store RLS, Pairing ở cả graph draft và published khi có; không thấy tên 3 RPC trong node parameters dạng chuỗi trực tiếp. Danh sách và phiên bản trong `qa/store-authority-v1865/dependency-inventory.json`. Không suy ra RPC không có caller: vẫn có thể được gọi từ website, Render, Cloudflare Workers, Supabase REST/Edge Function, backend code khác hoặc node tham chiếu động.
- GitHub code search **trên default branch** chưa trả kết quả cho `qa_shop_b_zalo_claim` và `save_merchant_product`. Điều này không bao trùm các nhánh PR/staging.
- `pg_depend` truy vết trực tiếp function → function không trả hàng cho ba tên RPC, nhưng PostgreSQL **không** ghi nhận đầy đủ mọi lời gọi PL/pgSQL tĩnh/động trong catalog dependency. Không dùng kết quả này để khẳng định không có caller.
- **Chưa xác minh runtime traffic, ingress gateway có/không gửi header, backend source Render, Cloudflare Worker tất cả phiên bản, Supabase Edge Function hay network traces.** Cần dependency approval trước `REVOKE EXECUTE`.

## 2. Kết luận Canonical Store Authority

Tách riêng **Tenant (đơn vị đăng ký và gói thuê bao)** khỏi **Store (cửa hàng vận hành)**. Không sử dụng `tenant_memberships` một mình làm authorization cho đơn hàng, tồn kho, Page và conversation khi tenant chứa nhiều store.

Đề xuất chỉ cho review, chưa chạy migration:

1. Chọn một nguồn canonical duy nhất: `public.stores(id, tenant_id, status)` + `public.store_memberships(tenant_id, store_id, user_id, role, active)`. Không sao chép dữ liệu từ private QA làm authority thật trước khi có đối chiếu.
2. Unique key `(tenant_id, id)` cho stores, composite FK `(tenant_id, store_id)` cho Orders/Products/Conversations/Customers/Channel Connections và event/outbox. Phân biệt `store_id` server-derived và selector UI.
3. Dual-read trong migration read-only: ghi nhận số lượng legacy rows theo tenant, phát hiện hàng không gắn store và giá/đơn hàng xung đột; **không gán store mặc định cho hàng legacy mơ hồ**. Fail closed nếu có nhiều candidate store.
4. Migration DDL phải trải qua checkpoint/snapshot schema, kiểm tra constraint/index, RLS truth table, test bằng Owner A/B cùng tenant, rollback kế hoạch và phê duyệt riêng.
5. Không đổi Messenger Published từ AI_SALES_DEMO sang Commerce trong giai đoạn này. Không chuyển writer/notifications sang Core cho đến khi Store Authority đạt.
6. Sau migration, kiểm tra đồng thời owner/manager/staff, revoked, suspended store, dual-owner, Page uniqueness, cross-tenant & same-tenant Store isolation, Orders read/write + stale price & stock rollback.

Đây là phương án **PROPOSED**, không phải schema đã triển khai lên Supabase thật.

## 3. Bản hợp đồng Protected Owner A/B UAT (chưa deploy)

Mã nguồn: `qa/store-authority-v1865/protected-uat-gate.cjs`.

- **Chỉ QA giả lập**: `SYNTHETIC_QA`, `liveAuth=false`, `liveMeta=false`, `orderWrite=false`, `databaseWrite=false`, `customerDataRead=false`, `privateOrderRead=false`, `providerSend=false`.
- Nhận `privateContext` là giá trị **trusted-host-only** do server adapter cấp. Không lấy từ JSON body, localStorage, user-provided header hoặc model. Host thật phải kiểm tra native Cloudflare Access `ctx.access` và Supabase Auth qua API tin cậy, không chấp nhận client tự đánh dấu `verified`.
- Client body chỉ cho phép `selectedStoreAlias`, `probe` (`store.admission.check` hoặc `page.connection.preview`) và `pageAlias` khi cần. Store lựa chọn chỉ là selector, không phải bằng chứng quyền.
- Server kiểm tra session active/issuer/audience/expiry, membership thật (ở đây fixture synthetic) và Page cùng tenant/store. Deny khi sai quyền hoặc sai Page.
- Kết quả chỉ gồm `ALLOW/DENY`, mã lỗi whitelist và các flag false. Không xuất tenant/store/user/page/session/token, không đọc Orders hoặc chuyển yêu cầu sang Commerce Core.
- Audit chỉ chứa loại sự kiện và mã quyết định, tuyệt đối không có PII, token, store alias hoặc session. Nếu audit lỗi, UAT fail closed.
- Không dùng các kết quả synthetic làm bằng chứng `LOCAL_COMPARE_PASS` thực tế. Phải có endpoint protected host + server Auth + canonical store RLS để chuyển sang real UAT.

### Quy trình tương lai cho operator (DESIGN ONLY)

1. Trên staging riêng có Cloudflare Access, đăng nhập Owner A bằng trình duyệt A và Owner B bằng trình duyệt B; không sao chép JWT, cookies, headers, email, mã số đơn hoặc token vào ChatGPT/GitHub.
2. BFF lấy session từ cookie an toàn và xác minh với Supabase Auth. Đăng nhập thất bại/không rõ tenant phải trả `DENY`.
3. Thử A→Store A `ALLOW`, A→Store B `DENY`, B→Store B `ALLOW`, B→Store A `DENY`. Page A/B mỗi store chỉ nhìn thấy kết nối của mình. Đây phải là **hai store cùng một tenant** được xác minh trong registry thật.
4. Giả mạo `tenantId`, `storeId`, `userId`, `role`, `jwt`, `accessToken`, `pageToken` trong request phải `BAD_INPUT`. Thiếu Access hoặc session hết hạn phải từ chối. Không dùng backend service_role để đọc Orders thay owner rồi tuyên bố RLS của owner đã đạt.
5. Server QA chỉ trả kết quả không nhạy cảm và run ID ngẫu nhiên; tách biệt nhật ký backend, không cung cấp quyền đọc order thật. QA operator lưu screenshot/response đã che định danh. Owner chấp thuận chuyển gate sau khi thấy kết quả.

### Những cổng còn BLOCKED

- Canonical Store registry + membership thực tế chưa có; `public.orders/products/conversations` chưa store-scoped.
- Chưa có được hai real Owner sessions của hai store cùng tenant cho UAT.
- Chưa deploy BFF protected route, chưa xác minh session `getUser`/claims server-side hoặc Store RLS thật.
- Chưa có bản đồ đủ caller của các RPC, chưa được phép thu hồi quyền hay sửa endpoint.
- Meta OAuth thật, provider send, Orders write, Public Widget integration và production đều disabled.

## 4. Kế hoạch phụ thuộc RPC trước khi đổi quyền

| Công việc | Owner | Điều kiện |
| --- | --- | --- |
| Xác định Cloudflare/Render/Website/Zalo ingress thực sự gọi ba RPC ở đâu | Integration + DevOps | Review source/runtime config không tiết lộ secret |
| Kiểm tra webhook verify HMAC/signature của provider, replay, rate-limit, bounded body | Security + n8n | Không thay thế bởi header từ browser |
| Sau khi có caller inventory, tạo RPC privilege cutover riêng trong staging | Supabase + Security | Approval + snapshot + rollback đã xác minh |
| Kiểm thử `anon` negative, `authenticated` tenant A/B deny trên DB cách ly | QA | PostgreSQL 17 + negative evidence |
| Real browser UAT 2 Owner cùng tenant | Owner + QA | Canonical store authority và private route đã được phê duyệt |

## 5. QA / evidence / rollback

- V18.6.3 PostgreSQL 17: **28/28 PASS** ở checkpoint; V18.6.4 synthetic admission: **51/51 PASS** ở checkpoint.
- V18.6.5 synthetic protected UAT: test chạy cục bộ, phải chờ CI được xác minh mới kết luận. Code và tests mới không gọi network.
- Kế thừa CI `V18.6.3 PG17 + V18.6.4 ...`, mở rộng một step, không tạo workflow kiểm thử phụ thứ hai.
- Rollback: đóng Draft PR V18.6.5; vẫn giữ PR #424, #420, #418. Không có hạ tầng hay dữ liệu thật nào thay đổi.

**Checkpoint dự kiến**: `V18.6.5 | RPC_DEPENDENCY_PARTIAL | UAT_CONTRACT_SYNTHETIC | REAL_AUTH_AB_BLOCKED | SAME_TENANT_STORE_RLS_BLOCKED | NO_META | NO_SEND | NO_WRITE | PRODUCTION_NO_GO`.

## 6. Tài liệu tham khảo chính thức

- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase SECURITY DEFINER lint: https://supabase.com/docs/guides/observability/advisors?queryGroups=lint&lint=0029_authenticated_security_definer_function_executable
- Supabase authorization JWT guidance: https://supabase.com/docs/guides/auth/jwts
- PostgreSQL RLS: https://www.postgresql.org/docs/17/ddl-rowsecurity.html
