# TIEN404 AI V12 R1 — Bổ sung PostgreSQL Staging QA (14/11/2026 JST)

**Mode:** EXPERIMENTAL / STAGING-ONLY / NO SEND / NO LIVE ORDERS.  
**Repo:** ngoctien20/demo-git, draft PR #34, branch `work/v12-r1-shop-owned`.  
**Supabase:** `tien404-staging` (ref `ifxlvrhyjhbzbrkdsida`).  
**Scope:** bổ sung bằng chứng Postgres thực trên môi trường staging, kế thừa SQLite QA từ `qa/shop_owned`. Không thay đổi code V12 R1 SQLite, Webhook Zalo hay Messenger.

## Audit trước khi thay đổi
- n8n đã tồn tại bảng `TIEN404_R1_SHOP_BOT_REGISTRY_QA` ID `qLf19z9QjEaIHk00`: 2 bản ghi QA Shop A/B; workflow `kKIlgIX5olx0CSz5`, executions 3057 và 3058 SUCCESS.
- Supabase staging có 2 tenant trong public; public.orders/products đã bật RLS. Không thay đổi các bảng đó.
- Trước khi tạo, schema `tien404_r1_qa` chưa tồn tại. Các schema hiện có `app_private` và `factory_private` được giữ nguyên.
- Cloudflare `tien404-zalo-outbound-v1-staging`: `ZALO_SEND_ENABLED=false`, D1 claim/quota từ TEST 09 = 1/1. Không gửi thêm tin; không xóa claim TEST 09.

## IMPLEMENTED
Đã tạo schema PostgreSQL riêng `tien404_r1_qa` trên **Supabase staging**:
1. `shop_bots`: QA-only tenant/store/bot registry, fixture credential refs, mode `dry_run|disabled`.
2. `catalog`: SKU/price/stock được khóa theo đúng tenant, store, bot.
3. `owner_pairing_challenges`: SHA-256 code hash, TTL, one-time, max 5 failed attempts.
4. `owner_bindings`: Owner/recipient fixture, state `paired|revoked`, thời hạn.
5. `sandbox_orders`: confirmed-only, VND exact total, idempotency và confirmation uniqueness.
6. `owner_outbox`: cùng giao dịch với đơn, `state=HELD`, `hold_reason=SEND_DISABLED`, nhãn `[SANDBOX-ONLY]`.

Hai routine restricted `SECURITY INVOKER`:
- `tien404_r1_qa.pair_owner_qa`: chỉ cho thử với QA fixture, kiểm tra hash, TTL và scope; **chưa tích hợp backend JWT**.
- `tien404_r1_qa.commit_order_qa`: xác nhận bắt buộc, kiểm tra đúng Bot + SKU + stock + giá; tạo order/outbox nguyên tử; xử lý duplicate và thay đổi payload.

**Bảo mật:** RLS bật trên cả 6 bảng, không có grant `USAGE` trên schema và không có quyền EXECUTE RPC cho `anon`, `authenticated`, `service_role`. Schema không được expose ra Data API. Hàm chỉ chạy qua privileged staging SQL với fixture QA; không phải API sản xuất.

## TESTED — SQL staging readback
- Pair A và B: PASS; sai code, cross-shop challenge, replay: DENIED.
- 5 negative order cases (chưa confirm, cross-bot, sai tổng, vượt tồn, SKU lạ): DENIED; order/outbox 0/0.
- Trường hợp cố ý làm Outbox INSERT thất bại phát hiện rollback nguyên tử: order/outbox 0/0. Đã sửa constraint chỉ trong schema QA và chạy lại PASS.
- Shop A: F01 159.000 VND × 2 → order 318.000 VND, outbox HELD đúng Owner A.
- Shop B: F01 199.000 VND × 1 → order 199.000 VND, outbox HELD đúng Owner B.
- Gửi lại cùng khóa: `DUPLICATE`; không tạo thêm order/outbox.
- 3 negative replay cases (đổi payload cùng idempotency, tái sử dụng confirmation, cross-store bot): DENIED.
- Hai yêu cầu PostgreSQL **đồng thời** cùng idempotency mới: một `CREATED`, một `DUPLICATE`; chỉ một order được lưu.
- Đọc lại 3 order và 3 outbox: 3/3 `correct_owner=true`, `state=HELD`, `channel=zalo_bot`, `hold_reason=SEND_DISABLED`, nhãn sandbox đúng.
- Security permission QA: `anon_schema_access=false`, `authenticated_schema_access=false`, `service_role_schema_access=false`, `anon_commit_access=false`, `authenticated_pair_access=false`, `tables_without_rls=0`.

Không có real sender, gateway dispatch, published workflow, API endpoint, credential thật hay khách hàng thật trong schema.

## Rủi ro, giới hạn và release gates
1. **Chưa kết nối HTTP/Webhook vào Supabase:** Test SQL chứng minh persistence và isolation ở lớp fixture, **không chứng minh end-to-end có signed JWT**, không đồng nghĩa production-ready.
2. **Chưa có backend xác thực Owner thực:** tham số `p_owner` QA chỉ được chạy bởi admin SQL; phải tích hợp Supabase JWT + membership server-side trước API.
3. **Chưa có migration file được kiểm duyệt/áp dụng qua CI:** thay đổi được thực hiện trực tiếp trên staging bằng SQL, chưa ghi vào `supabase_migrations`. Cần versioned migration và drift review.
4. **Không có sender:** outbox HELD; phải kiểm tra binding/revocation/expiry, quota, unknown-delivery và Kill Switch ở thời điểm gửi trước bất kỳ real send nào.
5. **Advisor Supabase có WARN tồn tại từ trước:** `public.save_merchant_product` là SECURITY DEFINER callable bởi authenticated (cần review API contract, không tự revoke); leaked-password protection chưa bật.
6. Render workspace có thể liệt kê nhưng chưa được chọn qua kết nối: không thao tác Render.
7. `ZALO_SEND_ENABLED=false` đã được giữ, Messenger live và TEST 09 không bị động chạm.

## Checkpoint và rollback
- Nguồn code trước đó: draft PR #34 commit `550bd8112c492012dca2289144db456804746a6b` — giữ nguyên; bản bổ sung chỉ là evidence.
- SQL staging schema: `tien404_r1_qa` là namespace mới độc lập. Rollback cuối cùng (nếu được phê duyệt sau kiểm tra dependency): `DROP SCHEMA tien404_r1_qa CASCADE`. **KHÔNG tự chạy lệnh xóa**. An toàn hiện tại: không có quyền truy cập từ public app, không có sender.
- Không merge PR, không promote workflow, không gắn domain, không thay đổi live auth hoặc credential.

## NEXT
P0: xây backend contract và signed-JWT Owner authorization; thử negative JWT tenant A/B.
P1: chuẩn hóa migration ứng dụng, xuất diff SQL và đưa lifecycle pairing/revoke vào API thật (staging), hạn chế replay và concurrency.
P1: thêm staging-only n8n/Supabase integration QA, test atomic event → outbox với failure injection.
P2: Merchant Dashboard minimal pairing UI và observer; chỉ đề xuất gửi một tin thật sau gate/approval mới.

**TRẠNG THÁI:** IMPLEMENTED (isolated staging schema) / TESTED (SQL QA) / BLOCKED (real auth, channel integration, approved send).