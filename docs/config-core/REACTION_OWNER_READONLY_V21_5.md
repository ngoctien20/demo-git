# V21.5 — Staging Registry Read-only Attestation × Owner Page Readiness (NO HOSTED WRITES)

**Ngày:** 22/11/2026 (Asia/Tokyo). **Trạng thái:** VERIFIED (Supabase staging read-only), IMPLEMENTED (Draft PR #493 only), TESTED (disposable PostgreSQL 17), NOT RELEASED.

## 1. Kiểm toán staging thực tế

Dự án: Supabase \`tien404-staging\`, project ref \`ifxlvrhyjhbzbrkdsida\`, PostgreSQL 17.11. Chỉ gọi list_projects/list_tables/list_migrations/execute_sql SELECT pg_catalog và Supabase security advisor. **Không gọi apply_migration / SQL DDL / INSERT / UPDATE / DELETE / RPC ghi lên hosted.** Không in secret hoặc PSID/Page ID thật.

Kết quả catalog:
- Có \`public.stores\`, \`public.store_memberships\`, \`public.tenant_memberships\`, \`public.assistants\`, \`public.assistant_config_versions\`, \`public.channel_connections\`, \`app_private.audit_events\`.
- **1** Messenger connection \`active\` thuộc môi trường \`demo\`; assistant liên kết \`active\` và store \`active\`, 1 tenant/store, Page identifier và display name có dữ liệu.
- \`store_memberships\`: **4** memberships \`owner/active\` trên **3** stores/tenants. Điều này **KHÔNG** chứng minh 3 store đều có Facebook Page; chỉ 1 connection Messenger được ghi nhận.
- **Không có** \`app_private.reaction_page_industries\`, \`public.page_reaction_drafts\`, hoặc RPC \`save_page_reaction_draft(uuid,jsonb,text)\`.
- Các bảng Config Core đã tồn tại ở staging. **Danh sách Supabase tracked migrations hiện chỉ đến V20 Store SKU Contract**; chưa có dòng migration tracking hiển thị cho Config Core. Không suy đoán nguồn thay đổi; phải reconcile baseline / lịch sử thực tế trước migration sau.
- \`channel_connections\`: \`RLS ENABLED + FORCED\`, \`authenticated SELECT=true\`, \`anon SELECT=false\`, \`authenticated INSERT/UPDATE/DELETE=false\`. Chính sách SELECT phụ thuộc active store membership + active tenant membership + active store. **Không giới hạn SELECT chỉ owner**, do đó UI V21.5 tự hạn chế role owner; bảo mật Owner-only cho *verified proof* phải nằm trong RPC riêng, không dựa vào UI.
- Supabase security advisor có INFO \`rls_enabled_no_policy\` trên nhiều schema private/QA. Không được tự kết luận đó là lỗi lộ dữ liệu (RLS không có policy thường chặn quyền truy cập), và không mở policy tùy tiện.
- Chưa chạy **real JWT Owner A/B negative UAT** trên hosted; mọi test impersonated JWT của offline PG17 là synthetic.

## 2. Owner App read-only implemented

Nguồn: \`apps/owner/src/pages/ReactionPageReadiness.tsx\`, nhúng vào \`ReactionSettings.tsx\`. Khi người dùng là **owner của store hiện tại**, Owner App dùng Supabase Auth client hiện có (không service_role) để **GET SELECT**:

\`channel_connections.select('id, display_name, status, environment').eq('tenant_id', store.tenant_id).eq('store_id', store.id).eq('channel','messenger')\`.

Không bao giờ tải \`external_account_id\`, credential, sender PSID, token hoặc dữ liệu khách. Nhân viên/manager không gọi query; nếu chưa có kết nối thì báo rõ. Một Page được chọn chỉ là **đối tượng xem trước**, không khẳng định Meta verified, không đổi industry/profile policy và không tạo owner consent. \`status='active'\` trong registry **không có quyền gửi reaction**.

Có thể chọn giữa nhiều kết nối của cùng shop (nếu sau này có), nhưng toàn bộ cấu hình phản ứng vẫn ở chế độ simulation, bắt đầu OFF, không có Save/Enable. Không kết nối Meta sender/Commerce.

Browser QA: \`qa/reactions/owner-preview-browser.cjs\` mock thêm Shop A connection và Shop B connection, yêu cầu chỉ hiển thị A, truy vấn phải có cả 3 điều kiện \`tenant_id/store_id/channel\`, truy cập SUPABASE chỉ GET/HEAD; kiểm thử trên Chromium desktop 1280px và mobile 390px. **Ghi kết quả mới nhất từ CI trước khi tuyên bố TESTED**.

## 3. Owner-only verified Page API CANDIDATE

- \`db/reactions/20_owner_reaction_page_list_CANDIDATE.sql\` định nghĩa \`public.list_verified_reaction_pages(p_store uuid)\` READ ONLY, \`SECURITY DEFINER\`, \`search_path=''\`, \`REVOKE FROM PUBLIC/anon\`, chỉ cấp \`authenticated\`.
- Hàm không cấp quyền bằng \`p_store\` từ client: bắt buộc \`auth.uid()\`, active \`owner\` of exact \`store/tenant\`, active tenant membership, \`t404_qa_tenant_allowed\`, active assistant + Messenger connection demo/staging, và **private Meta Page verified installation proof mới dưới 180 ngày**.
- Trả về chỉ \`connection_id, page_name, industry_id, environment, draft_sha\`. Không xuất provider Page ID/token/PSID hoặc shop khác; không cấp quyền lưu/publish.
- **Không kết nối Owner UI vào RPC mới**, vì RPC và proof registry chưa tồn tại hosted. Giao diện hiện chỉ biết raw connection; sau khi staging schema và trusted installation được phê duyệt mới chuyển sang verified listing.

CI disposable PG17 job \`pg17_page_draft_owner_ab\` qua **44/44** bài kiểm tra (bao gồm 10 bài cho listing verified Page): owner A đọc 2 Page QA, owner B đọc 1 Page QA, không lộ chéo, manager/anon bị chặn, Page chưa/stale proof không xuất hiện, owner A thấy SHA sau khi lưu, rollback xóa RPC mới và chỉ xóa các bảng reaction. Bằng chứng [GitHub Actions #45019685484](https://github.com/ngoctien20/demo-git/actions/runs/45019685484). Không phải hosted positive UAT.

## 4. Khác biệt giữa các bằng chứng

- VERIFIED Staging: có **một connection demo active**, không có proof registry, không có bảng Draft/Publisher.
- TESTED disposable PostgreSQL: mô hình quyền và transaction bằng dữ liệu tổng hợp, không có Meta OAuth proof thật.
- IMPLEMENTED Owner Draft: **read-only** list raw channel, preview ngành được chọn thủ công.
- BLOCKED thực tế: Page owner OAuth/install, industry proof secure issuance, hosted migration/backup/restore approval, authenticated user real JWT A/B, chính sách consent + publish version, automation guard và Messenger mobile/web.
- Cần phê duyệt trước mọi thay đổi hosted, grant/schema privileged, quyền Page/Meta, live auto-reaction hoặc publish.

## 5. Rollback / release

- Rollback draft code riêng: revert 2 UI files + browser QA. Không có thay đổi deployed hay Datenbank hosted.
- Candidate SQL rollback \`db/reactions/90_page_reaction_drafts_ROLLBACK_CANDIDATE.sql\` xóa cả \`list_verified_reaction_pages\`; chỉ chạy trong disposable hoặc staging được owner cho phép cùng backup/restore proof.
- PR #493 tiếp tục ở trạng thái **Draft**. Messenger Published thuộc nhánh menu, không tự sửa. Shadow code trong Messenger Draft giữ reaction OFF.
- Khuyến cáo Supabase official: bảo vệ Data API bằng **cả GRANT và RLS**, review kỹ \`SECURITY DEFINER\` trong schema exposed; xem https://supabase.com/docs/guides/api/securing-your-api .
