# TIEN404 AI · Bàn giao Work V9

Phiên mới nhất ngày 12/11/2026 JST: [V11_STATUS.md](V11_STATUS.md). Các phần V8–V10 bên dưới là lịch sử bàn giao.

Chốt ngày 11/11/2026, 18:15 JST. Agent WORK, bản V9. **PILOT READINESS: NOT READY. PRODUCTION CHANGED: NO.**

Điểm xuất phát [V8 e9752ea](../coordination/TIEN404_AI_V8_MASTER_CHECKPOINT.md). Đã rà tất cả remote refs, PR #1–#7 và hồ sơ V8.1 trên nhánh Auth. Tại lúc đồng bộ chưa thấy checkpoint V8.2. PR #8 mới chứa schema cấu hình bot theo tenant. Xem SHA sản phẩm và file thay đổi trong [CHANGELOG](CHANGELOG.md), kết quả thực thi trong [QA_EVIDENCE](QA_EVIDENCE.md).

| Phase | Trạng thái ngày 11/11 | Phạm vi |
|---|---|---|
| 1 Auth | BLOCKED cho nghiệm thu hai JWT | Anonymous HTTP, SQL role A/B đã kiểm. Thiếu signed HTTP A/B, nonmember, recovery email và phiên mobile thật trên bản mới. |
| 2 Merchant | IN_PROGRESS | Auth staging LIVE c728f15. Báo cáo 7/30 ngày theo ngày tạo đơn giờ Việt Nam, đọc danh mục phân trang, đơn và chi tiết, khách hàng và lịch sử mua, hội thoại và lịch sử, cấu hình AI, chuyển shop. Chưa nghiệm thu độc lập với hai tài khoản. |
| 3 Commerce | IMPLEMENTED_NOT_VERIFIED ở gateway live | Đã kiểm CRUD lệnh giới hạn trên HTTP fixture + PostgreSQL. Data runtime chỉ đọc. |
| 4 AI platform | VERIFIED_DONE cho metadata và RLS staging | Shop A có một cấu hình QA paused, B có 0. Quyền điều phối tool runtime và kích hoạt kênh còn mở. |
| 5 Training Lab | IN_PROGRESS | Scorer chạy offline, replay một trace model, 64 assertion sandbox đạt. Sáu tình huống khác chưa có trace model trong bộ chấm. |
| 6 Super Admin | IN_PROGRESS | Có metering/quota và UI usage được kiểm ở SQLite/Chromium CI. Chưa có hosted Admin đã nghiệm thu. |
| 7 Onboarding | IN_PROGRESS | Website preview nối đến login staging và yêu cầu tham gia. Chưa cấp tenant xuyên hệ thống. |
| 8 Operations | IN_PROGRESS | Đã kiểm quota và backup/restore fixture. Chi phí thực, diễn tập sự cố và hóa đơn còn mở. |

[Kiến trúc](ARCHITECTURE.md) · [Công việc đang mở](ACTIVE_WORK.md) · [Backlog V9.1](BACKLOG.md) · [Điều kiện phát hành và rollback](RELEASE_GATES.md).


## Bản thực sự phục vụ

| Môi trường | Phiên bản | Kiểm chứng |
|---|---|---|
| Auth Render | c728f153906781905ec80f06e7fef9572e9e02c9 · dep-dbq33krl550s739e1vfg | LIVE, ba file JS/module phục vụ khớp byte với commit. Form ghi sản phẩm tắt mặc định. |
| Data Render | 3c29f70eae00edd6572756c91c4a4bfa43e77d2c · dep-dbq30a2jnfac73euucsg | LIVE, health 200 CONFIGURED_NOT_VERIFIED. Runner anonymous trên gateway + Supabase đạt. Không truyền commerce_connect trong entrypoint. |
| Supabase | 20261111085750 và 20261111090920 | Metadata bot và RPC thống kê chỉ đọc. Đã kiểm hai chiều trong DB. |
| Website công khai | gh-pages 6bb57e6 | PR4 chỉ phát hành preview/CI. Không merge production. |

Form sản phẩm hiện có thể thử bằng transport fixture. Cấp quyền ghi và bật form cho QA đang chờ chủ dự án duyệt. Lúc chốt chưa có dấu hiệu V8.2 được lưu trên các nhánh đã rà.


## GPT V10.1 delta — sau Work V10 bị ngắt do credit (2026-11-11 JST)

Agent GPT; tiếp quản từ checkpoint Work V9 `266e9f66` và nhật ký Work V10 dừng sau các bước đọc/sao lưu. Nhật ký 32 commands **không đủ chứng minh** backup n8n đã được lưu bền vững; phải kiểm lại artifact trong workspace Work. Không xác nhận đã tiếp quản worktree cloud riêng của Work.

- **Catalog QA DB:** chủ dự án đã cho phép đúng Shop A/B staging tạo/sửa sản phẩm. Migration `20261111095308 v10_qa_two_shop_merchant_product_rpc` đã áp dụng; SQL trong `ops/data-platform/candidates/merchant_product_qa_allowlist_v10.sql` (nhánh `ops/tenant-data-platform-v1-staging-20261110`, commit `25accdef`). Kiểm thử owner, manager, staff, nonmember, chéo tenant A/B, anon ACL, giá âm, trùng SKU, xung đột version, audit và rollback giao dịch: PASS tại PostgreSQL. `authenticated` vẫn chỉ SELECT trực tiếp products; quyền ghi chỉ qua RPC có tenant ID+slug allowlist. File rollback thu hồi EXECUTE: `merchant_product_qa_allowlist_v10_rollback.sql` commit `8e4ae8de`.
- **Release gate chưa đạt:** HTTP JWT signed A/B, staff và nonmember qua API thật còn NOT_RUN; `PRODUCT_EDITOR_ENABLED=false` và chưa deploy Auth build mới. Không có sản phẩm QA mới được giữ lại do test dùng ROLLBACK.
- **Messenger:** workflow gốc `Z7FdV7uDvApfbURQ`, Published `450d9d60-3853-45f3-979f-20164a4adc7b` **giữ nguyên**; Draft mới `d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92` chỉ tăng cường prompt an toàn SKU/giá/ảnh/quyền riêng tư, không thay webhook, node, credential. Bot đã có năm business tools; các tool tạo/sửa đơn còn Draft khác Published. Messenger E2E thật chưa chạy, chưa Publish bot mới.
- **AI Lab:** `NvQfIffOrZokPBPW` inactive, read-only fixture catalog. Có trace thật 1909, 2041–2062. Snapshot 7-case trước hotfix: 5/7 đạt theo bộ tiêu chí; hotfix targeted `price-injection` 2061 và `unverified-order` 2062 phản hồi đúng, nhưng chưa chạy lại đủ 7 ca cùng phiên bản cuối và chưa chạy Python CI cho snapshot này. Files `qa/agent/recorded_v10_1_final.json`, `qa/agent/recorded_v10_1_hotfix.json` trên nhánh `ops/cto-autonomous-v5-20261110`.

**Pilot Readiness vẫn NOT READY.** Production không thay đổi. Bản Merchant và Messenger chỉ tăng cường staging/draft, không gộp AI_SALES_DEMO vào dữ liệu TIEN404 Commerce.


### 2026-11-11 · Messenger V10.1 OWNER-APPROVED PUBLISH

Chủ dự án đã trực tiếp phê duyệt **Publish bản Messenger V10.1 để một người bạn thử chat trên Fanpage đã kết nối**. Workflow `Z7FdV7uDvApfbURQ` đã Publish version **`d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92`**, n8n phản hồi success và read-back cho thấy `active=true`, `activeVersionId=versionId=d5c96b6b...`, 27 nodes, Send API node bật. Bản Published V3 trước đó `450d9d60-3853-45f3-979f-20164a4adc7b` còn trong version history và lấy được full graph để rollback. Diff từ V3 sang V10.1: **chỉ thay `Messenger AI Agent.parameters.options.systemMessage`**, không thêm/xóa node hoặc kết nối, không đổi credential/webhook. Không đồng nghĩa các tính năng Commerce mới đã được tích hợp. Việc thử live bằng tài khoản người bạn và xác minh execution trên phiên bản mới vẫn PENDING; metadata Meta Send API trước Publish đã có exec 2237 success. Vì đây là Page hiện hữu, không có bảo đảm cô lập chỉ tài khoản người bạn; chủ dự án cần theo dõi các hội thoại trong thời gian pilot. Chưa thay đổi tool draft của Create/Manage/Update, chưa chạy đơn thật.


## V10.3 → V10.4 CTO implementation checkpoint — 2026-11-11

**Current working reference:** [V10_3_4_IMPLEMENTATION.md](V10_3_4_IMPLEMENTATION.md). Read [Issue #9](https://github.com/ngoctien20/demo-git/issues/9) for tracked acceptance checkboxes. Older sections above preserve historical V9/V10.1 state and should **not** be treated as latest live release info.

- `gh-pages` still `6bb57e6`; Cloudflare Pages Git-connected `tien404-ai-git-staging` canonical deploy `2715c6e2-edc1-4a5d-9ceb-5953311b752d`, untouched.
- **V10.3 widget** drafted on feature branch `feature/v10.3-cloudflare-widget-qa-20261111`, [PR #11](https://github.com/ngoctien20/demo-git/pull/11), latest code SHA `37052a9e`, Cloudflare immutable preview visual deploy `5727518f-e644-4e9a-9965-e82b799e5e02` at `2a276a8`; browser test **26/26 PASS** [run 43035910218](https://github.com/ngoctien20/demo-git/actions/runs/43035910218) including live preview security headers. Cloudflare preview Git branch automation has been reset to **none**.
- **V10.3 Auth Login/Account** on feature `feature/v10.3-auth-ui-staging-20261111`, [PR #10](https://github.com/ngoctien20/demo-git/pull/10), SHA `ffca72d`; staging-isolated security/browser CI **PASS** [43035277528](https://github.com/ngoctien20/demo-git/actions/runs/43035277528). Render hosted Auth remains older `c728f15` deployment `dep-dbq33krl550s739e1vfg`. No live JWT two-session test yet; product editor remains disabled.
- **V10.3 Super Admin** isolated CSS on feature `feature/v10.3-super-admin-ui-20261111`, [PR #12](https://github.com/ngoctien20/demo-git/pull/12), SHA `1d84a4f`, **71/71 backend security tests PASS**, one warning [43035070898](https://github.com/ngoctien20/demo-git/actions/runs/43035070898). NOT deployed as hosted Super Admin; sensitive operations gated.
- **Supabase:** active healthy; public tables all RLS enabled but two Security Advisor WARN (privileged product RPC, leaked-password protection); real HTTP A/B cross-tenant QA blocked. **Render Data** deployed `3c29f70` unchanged. **n8n Messenger V10.1** existing live owner-approved pilot unchanged this workstream. **V10.4 Commerce** real multi-tenant activation NOT deployed.
- **Owner release boundary:** GitHub development and Cloudflare preview staging allowed; NO domain purchase, DNS, production SaaS deployment, new paid service, or real customer transaction until separate explicit approval.
