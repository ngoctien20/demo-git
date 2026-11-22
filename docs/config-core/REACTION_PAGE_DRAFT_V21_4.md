# V21.4 — Owner A/B verified Page reaction draft (CANDIDATE, NO HOSTED)

**Ngày:** 2026-11-22 (JST). **Trạng thái:** IMPLEMENTED ở PR #493, TESTED trên **disposable PostgreSQL 17**, NOT APPLIED HOSTED, NOT RELEASED.

## Mục đích và phụ thuộc

Tiếp tục V21.3 (UI xem trước), V21.2 (industry profiles) và V21.1 (reaction admission / atomic dispatch). Owner có thể chuẩn bị một bản **draft** cho mỗi Messenger Page đã được một adapter tin cậy xác minh. Draft không thể tự phát hành, không được dùng làm phản ứng live và không thay đổi workflow Messenger/Commerce.

Phụ thuộc trên hệ thống **chưa phê duyệt áp dụng hosted**: V20 Store Authority 10/20/30, Config Core `db/config-core/10_config_core.sql` (bao gồm `channel_connections` và `auth.uid()`). Không suy luận các bảng này đã tồn tại trên Supabase hosted từ code trong repo.

## Artifacts

- **Migration ứng viên (không tự áp dụng):** `db/reactions/10_page_reaction_drafts_CANDIDATE.sql`.
- **Rollback ứng viên:** `db/reactions/90_page_reaction_drafts_ROLLBACK_CANDIDATE.sql`.
- **QA PostgreSQL 17:** `qa/reactions/owner-page-draft-pg17-uat.sh`.
- **CI độc lập:** job `pg17_page_draft_owner_ab` của `.github/workflows/tien404-social-reactions-qa.yml`.
- **Bằng chứng:** [GitHub Actions run #45018627796](https://github.com/ngoctien20/demo-git/actions/runs/45018627796), job `pg17_page_draft_owner_ab` **SUCCESS — 34/34 assertions**.

## Hợp đồng quyền

`app_private.reaction_page_industries` chỉ có thể được ghi bởi hệ thống quản trị có thẩm quyền, không cấp quyền `anon/authenticated`. Bảng chứa `connection_id`, ngành đã xác minh và bằng chứng cài đặt Page. Test dùng dữ liệu giả lập; trường `proof_kind` **không phải chữ ký Meta**, phải có quy trình xác minh thật trước khi áp dụng hosted.

`public.page_reaction_drafts` chỉ có một dòng/connection (khóa chính `connection_id`), chứa tenant/store lấy từ `public.channel_connections`, ngành lấy từ registry private, config JSON v2, SHA, người sửa, thời gian. Bật `RLS + FORCE RLS`; người đăng nhập chỉ có quyền **SELECT** khi là owner đang hoạt động trong chính store/tenant đó. Không có quyền client direct INSERT/UPDATE/DELETE.

`public.save_page_reaction_draft(p_connection,p_config,p_expected_sha)` có `SECURITY DEFINER`, `search_path=''`, `REVOKE EXECUTE FROM PUBLIC/anon` và chỉ grant `authenticated`. Hàm tự kiểm tra `auth.uid()`, owner role (không manager/staff), tenant/store, shop active, Page đã bind với assistant active, Messenger channel active, environment `demo/staging`, QA tenant allowlist, proof `meta_page_verified_installation` còn hạn dưới 180 ngày. Không tin client tự khai tenant, Page ID hay ngành.

Validate config **đúng 5 khóa**: `schemaVersion:2`, `profileId`, `intents:{thanks,praise}`, `cooldownSeconds`, `maxPerHour`. Không chấp nhận `enabled`, `ownerConsent`, `sendAllowed`, publish state hay extra keys. Ngành sensitive chỉ được `silent`, wholesale/retail giới hạn mức, artist có thể expressive; cooldown/quota không thể vượt preset. Với profile silent: cờ intents đều false, 3600 giây, 0 reaction/giờ. Với các profile khác: phải có ít nhất một intent hợp lệ.

Lưu mới yêu cầu `p_expected_sha=NULL`; sửa bản nháp phải gửi đúng SHA hiện tại, nếu sai trả `PT409 draft_changed`. Hàm khóa row `channel_connections FOR UPDATE` để bảo vệ cập nhật đồng thời; mọi lưu hợp lệ ghi `app_private.audit_events` với `connection_id/sha/industry`, không ghi PSID/MID khách. **Không có RPC publish** và không có trường enabled/published/sendAllowed trên bảng. Không có live sender được kết nối với bảng này.

## QA UAT chính xác

**34/34 PASS** gồm setup baseline V20 + Config Core, migration candidate, quyền Owner A/B, anon/manager denied, không cho client trực tiếp update, Page chưa được xác minh hoặc proof hết hạn, tenant B không sửa A, schema invalid/extra enabled field, hạn mức bất hợp lệ, ngành pháp lý silent-only, artist Page riêng, CAS stale-SHA, audit, và **hai phiên đồng thời sửa cùng Page/SHA (một thắng, một thua)**. Test rollback đúng các đối tượng reaction và giữ nguyên `channel_connections` của Config Core.

QA dùng Postgres 17 khởi tạo riêng trong GitHub Actions, dữ liệu synthetic. `auth.uid()` được mô phỏng qua `request.jwt.claims`; **chưa chứng minh JWT thật, hosted RLS hay Meta owner permission**. Giai đoạn này KHÔNG gọi Supabase API hosted, không tạo/cập nhật tenant/credential thật, không chạy Messenger live.

## Chưa đạt / NO-GO

- Chưa có xác minh cài đặt Meta Page/tenant/store/industry thật và đồng ý của chủ Page theo revision.
- Chưa có chính sách published policy và trust adapter tương ứng cho bot. **Bản draft không được xem là consent cho gửi reaction**.
- Chưa apply schema lên hosted; chưa đối soát GRANT, RLS, SECURITY DEFINER trong môi trường Supabase thực tế, chưa backup/restore host.
- Owner App vẫn là **preview-only**, không gọi RPC mới. Chưa thiết kế luồng authenticated API list bound Pages + chọn đúng Page + lưu bản nháp khi backend được duyệt.
- Chưa nghiệm thu dùng Meta multi-Page A/B, thread control, human handoff, Commerce, Messenger web theo bot tự động.

## Cổng phê duyệt trước hosted

1. Chốt cấu hình pháp lý/Meta permission và trusted owner install flow.
2. Kiểm tra trạng thái thực tế V20 + Config Core hosted (read-only), backup và restore readiness.
3. Kiểm toán SQL candidate + quyền tối thiểu + nguồn cấp dữ liệu `reaction_page_industries`, review không thể tự gán proof.
4. Chạy Auth JWT/Owner A/B negative UAT trên disposable + staging đã được duyệt.
5. Phê duyệt migration staging, đăng ký API, kết nối Owner UI; Publish và Meta auto-send là các quyết định/phê duyệt riêng.

**Rollback:** `90_page_reaction_drafts_ROLLBACK_CANDIDATE.sql` chỉ tác động hai bảng và một RPC của tính năng này. Đã thử nghiệm offline PASS; không chạy lệnh xóa trên hosted nếu chưa phê duyệt dữ liệu/backup. PR #493 vẫn Draft, Messenger Published giữ nguyên.
