# TIEN404 AI — V15.0-09B CHECKPOINT
Ngày: 16/11/2026 (JST)
Môi trường: Supabase staging READ-ONLY + GitHub Draft + PostgreSQL 17 dùng tạm (GitHub Actions)
Tình trạng: IMPLEMENTED / TESTED_EPHEMERAL_PG; HOSTED_JWT_RLS NOT VERIFIED; Production NO-GO

## 1. Điểm kế thừa
- Parent: Draft PR #126 — V15.0-09, HEAD 328720b09d27a80530fbc01eaca3d825e62f7109.
- V15 security PR #125, V15 A→B→C→D PR #123, Universal AI Agent #122 và V14.8 PR #121 giữ nguyên.
- Không rebase, merge hay sửa Publisher/Production.
- Đọc checkpoint người dùng cung cấp TIEN404_V15_0_09_CHECKPOINT_2026-11-16.md để không làm lại phạm vi đã nghiệm thu.

## 2. VERIFIED qua Supabase công khai an toàn / read-only
- Project tien404-staging, PG17.11, 2 tenants, 3 auth.users, 3 active tenant_memberships.
- QA identity links = 2. QA owner_bindings paired = 2; synthetic owner_pairing_claims_v3 CONFIRMED = 3 và PENDING_OWNER_CONFIRMATION = 1.
- public.stores = KHÔNG CÓ, public.store_memberships = KHÔNG CÓ.
- Product/Order/Customer/Conversation/Message/Agent Config RLS vẫn Tenant-scoped, chưa có Store-scoped policy.
- Chứng nhận chuỗi auth.users → tenant_memberships → stores → store_memberships trên hosted: BỊ CHẶN bởi 2 bảng còn thiếu.
- Không kiểm tra token riêng tư, không thử đăng nhập thay Owner, không chạy lệnh DDL/GRANT/RPC.
- Bộ dữ liệu A/B cùng Tenant và C khác Tenant chỉ là phạm vi mong muốn của rehearsal; chưa có chứng cứ Store thực tế trên hosted.

## 3. IMPLEMENTED nguồn mới
- qa/v1509b-hosted-rls/ephemeral-postgres17-rls-rehearsal.sql — PostgreSQL 17 độc lập, dữ liệu giả lập, mô phỏng claim auth.uid() KHÔNG CÓ CHỮ KÝ JWT. Tạo Auth, Tenant, Store, Store Membership, Products, Orders, OrderItems giả lập với RLS và composite FK.
- qa/v1509b-hosted-rls/owner-proof-gate.cjs + .test.cjs — kiểm tra bằng chứng 4 hàng và chứng nhận Consent độc lập, fail-closed; kết quả "synthetic" không bao giờ cho quyền đọc hosted hay gửi/ghi đơn.
- .github/workflows/v1509b-owner-proof-pg17-no-send.yml — Postgres 17 Docker service chỉ tồn tại trong GitHub Actions, chạy QA + regression từ V15.0-09 + V15 Agent Core, không có credential Supabase/Meta/Zalo.
- docs/ai-handoff/V15_09B_PRIVATE_OWNER_EVIDENCE_INTAKE.md — biểu mẫu kiểm chứng Owner/Store; không lưu JWT, key, user ID hay PII vào GitHub công khai.
- docs/ai-handoff/V15_09B_HOSTED_JWT_RLS_TEST_PLAN.md — kế hoạch UAT JWT có chữ ký qua Auth/PostgREST trong mục tiêu cô lập, cần phê duyệt và migration riêng.

## 4. TESTED — CI disposable PG, KHÔNG hosted
- Mô phỏng Tenant-only policy trước để chứng minh Shop A nhìn thấy cả A và B khi cùng Tenant: kết quả PASS cho phép tái hiện lỗ hổng thiết kế CỦA FIXTURE. Không tuyên bố đã lấy được sản phẩm của Shop B thực trên hosted.
- Thêm chính sách RESTRICTIVE Store-scoped vào CI database: Owner A chỉ nhìn A; Owner B chỉ nhìn B; Owner C chỉ nhìn C; anonymous, User Store membership inactive, missing UID, paused Store => 0 sản phẩm.
- A không thể INSERT vào B, UPDATE B, hoặc đổi sản phẩm A thành B.
- Composite FK không cho phép OrderItem thuộc Order A tham chiếu Product B.
- Cùng SKU A002 ở A/B/C được thử dưới unique Tenant+Store+SKU trong DB tạm.
- Có source-only Owner Evidence QA: 26 trường hợp negative cộng positive/segregation; mọi kết quả đều không cấp quyền hosted.
- CI chính xác HEAD cuối cần xác minh SUCCESS trước khi ghi TESTED_FINAL; không dùng số PASS của commit cũ để đại diện commit mới.

## 5. Ranh giới & bảo mật
- PostgreSQL DB dùng trong GitHub Action hoàn toàn không truy cập Supabase. Claim JWT là session GUC mô phỏng, KHÔNG xác minh chữ ký hoặc Auth JWT thật.
- Một role có BYPASSRLS/service_role vẫn cần được kiểm soát bằng backend; chưa audit với token thực.
- Bản SQL guard từ 09 không được áp dụng.
- Không có bất kỳ thay đổi schema, dữ liệu, RLS/GRANT, RPC, credential, sản phẩm/đơn hàng, n8n Published, Cloudflare, billing, Meta/Zalo outbound hay provider API nào.

## 6. Release Gates
G0 = BLOCKED: 4 hàng ownership thực và Owner/Provider consent G2.3, phân loại mỗi Product/Order theo Store, xác minh restore backup, biên bản phê duyệt độc lập.
G1 = PROPOSED: áp dụng Store migration ở môi trường được duyệt, không dùng trực tiếp SQL RAISE EXCEPTION bản 09.
G2 = PREPARED/LOCAL_PG_TESTED, HOSTED_JWT BLOCKED: phải có Store schema, Auth test users và kiểm tra RLS read/write/revocation ngoài đời thực.
G3 = BLOCKED: Native Messenger/Zalo identity proof, durable replay, chuẩn hóa idempotency, Commerce Core + Catalog và Owner UAT.
PRODUCTION = NO-GO.

## 7. Checkpoints / approvals / rollback
- Muốn chuyển G0/G1 sang triển khai hosted: cần phê duyệt riêng cho phạm vi cụ thể, môi trường và migration từng bước; kiểm chứng sao lưu thực tế + thử khôi phục trước thao tác ghi.
- Không tạo tài khoản Owner thay người dùng khi chưa có phê duyệt.
- Rollback hiện tại: đóng Draft child PR #129; không có runtime cần rollback.
- Bước tiếp theo: V15.0-09C — Owner/G2.3 Independent Certification + Private Recovery Receipt, sau đó mới cân nhắc Staging Signed-JWT Store RLS UAT.
