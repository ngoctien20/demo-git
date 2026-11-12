# TIEN404 AI · Checkpoint bàn giao Work V7.1

**11/11/2026 JST · Pilot NOT READY · Production changed: NO.** Snapshot nguồn trong khoảng 06:04–06:13 JST. Bản này kế tiếp Master V6 (171 dòng), V7 (192 dòng), [checklist 05:48](https://github.com/ngoctien20/demo-git/blob/8ff253b/docs/CONTROL_HUB_CHECKLIST_20261111.md) và [checkpoint Render 05:59](https://github.com/ngoctien20/demo-git/blob/8ff253b/docs/RENDER_AUTH_STAGING_PREVIEW.md). Đối chiếu kết quả với [báo cáo hoàn thành](TIEN404_AI_V7_1_COMPLETION_REPORT.md), [QA](TIEN404_AI_V7_1_QA_EVIDENCE.md) và [checklist chủ dự án](TIEN404_CONTROL_HUB_MANUAL_CHECKLIST.md).

## Kiến trúc và nguồn đang phục vụ

| Bề mặt | Nguồn, môi trường và giới hạn |
|---|---|
| Khách truy cập | [GitHub Pages](https://ngoctien20.github.io/demo-git/login.html), gh-pages tại 6bb57e6. Sáu liên kết menu. Trang đăng nhập và portal mô phỏng dùng phiên trình duyệt. Chat AI marketing có workflow riêng. |
| Chủ cửa hàng | [Render Auth](https://tien404-auth-staging.onrender.com/login.html) → Supabase Auth → getUser → membership → tenants → products. Danh mục dùng PostgREST trực tiếp, tối đa 20 dòng hiển thị. Account chưa nối endpoint Orders của gateway. |
| API dữ liệu | [Render Data](https://tien404-data-staging.onrender.com/health) → xác minh bearer ở Supabase Auth → membership/RLS → GET tenants/products/orders. Products cho thành viên active, Orders chỉ owner/manager. /health là trạng thái cấu hình. |
| Người mua | Thiết kế Shopper Order Support cần xác minh chủ đơn. Mã đơn đơn thuần không cấp quyền. Merchant Copilot chờ nghiệm thu truy cập dữ liệu theo shop. [Kiến trúc AI](https://github.com/ngoctien20/demo-git/blob/e911758/docs/ASSISTANT_ACCESS_ARCHITECTURE_V5.md) |
| Quản trị | Super Admin FastAPI/SQLite có MFA/RBAC; adapter staging chỉ đọc trạng thái gateway. [Control Hub Sites](https://tien404-control-hub.fairflounder1.chatgpt.site) active, phiên bản lưu mới nhất 2. Chưa chứng minh SSO, quyền admin liên hệ thống hoặc V2 là bản đang phát hành. |
| Tự động hóa | n8n Cloud tách Legacy Sheets, Messenger TEST, AI marketing, Commerce sandbox và handshake HMAC. Replay cache gateway ở cấp process. [Hợp đồng và checkpoint Data](https://github.com/ngoctien20/demo-git/blob/9508321/ops/data-platform/checkpoints/LIVE_INTEGRATION_QA_20261110.md) |
| Bot & Lab | [Registry](https://github.com/ngoctien20/demo-git/blob/e911758/data/workflow-registry.v5.json) có 6 bot cùng workflow phụ thuộc. Lab offline ở PR #3 có truy xuất knowledge đã duyệt theo shop/ngành. Usage, chi phí và chất lượng hội thoại thực tế chưa được nghiệm thu. |

## GitHub và Render

PR #1–#7 đều **open, draft, chưa merge** khi kiểm tra. SHA là bản nhánh tại cuối phần thay đổi kỹ thuật, trước commit tài liệu V7.1 trên #3.

| PR | Nhánh | SHA | Phạm vi |
|---|---|---|---|
| [1](https://github.com/ngoctien20/demo-git/pull/1) | ops/control-hub-audit-v2-20261110 | 385782a | Kiểm toán Hub |
| [2](https://github.com/ngoctien20/demo-git/pull/2) | ops/super-admin-v4-staging-20261110 | b76d704 | Super Admin staging |
| [3](https://github.com/ngoctien20/demo-git/pull/3) | docs/cto-coordination-v2 | 6cbb6d0 trước bàn giao | Lab và hồ sơ CTO |
| [4](https://github.com/ngoctien20/demo-git/pull/4) | work/website-v4-1-simplify-navigation | 612f609 | Preview và knowledge website. Trước sửa, gh-pages có 47 commit riêng, PR có 9 commit riêng |
| [5](https://github.com/ngoctien20/demo-git/pull/5) | ops/tenant-data-platform-v1-staging-20261110 | 83c390c | Data gateway và công cụ acceptance |
| [6](https://github.com/ngoctien20/demo-git/pull/6) | ops/cto-autonomous-v5-20261110 | e911758 | Widget chung, registry và release gates |
| [7](https://github.com/ngoctien20/demo-git/pull/7) | work/supabase-auth-staging-v1 | cb9d187 | Auth/account Render staging |

Workspace Render **tea-dbphgh0n74is73dvsnng**. Auth **srv-dbpj4irm8hqs73e2h2rg**, auto-deploy OFF. Chuỗi triển khai 404b63b / dep-dbpo69u1egvs7390iv80 → 2b16ac7 / dep-dbpob0vf3r2c738ps6rg → **cb9d187 / dep-dbpoftmgekts73elrhc0 LIVE**. Data **srv-dbphtas9v7es73bursrg**, **9745dd18 / dep-dbpifqbbc2fs73aa1ab0 LIVE**. PR #5 V7.1 chỉ thay công cụ kiểm thử. Hoàn tác Auth bằng redeploy artifact dep-dbpob0vf3r2c738ps6rg. Hoàn tác thay đổi branch bằng revert commit tương ứng.

## Supabase staging

Project **ifxlvrhyjhbzbrkdsida**, Singapore. Truy vấn tổng hợp đếm 1 Auth user, 1 hàng auth.sessions, 2 tenant, 1 membership active. Mỗi shop QA có 1 sản phẩm và 1 đơn. Chỉ A có owner active. Một hàng session không chứng minh trình duyệt có thể đăng nhập. Kiểm tra role authenticated tại DB cho A thấy 1 tenant, đọc 1 sản phẩm/1 đơn A và 0/0 B. Danh tính thử không có membership đọc 0 hàng. Xem điều kiện thử tại QA.

| Schema | Bảng và chính sách SELECT hiện tại |
|---|---|
| public | tenant_memberships chỉ chính user active; tenants, products theo membership; customers, orders, order_items, conversations, messages yêu cầu owner/manager cùng tenant |
| app_private | audit_events, channel_secrets, order_idempotency bật RLS; không có table grant trực tiếp cho PUBLIC/anon/authenticated. Không cấp quyền browser |

Cả 11 bảng bật RLS. Security Advisor có 3 INFO về bảng private không policy và 1 WARN về leaked-password protection. [Hướng xử lý Auth](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) · [RLS linter](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

## n8n · inventory theo phiên bản

31 workflow, 16 active. Dấu — là không có activeVersionId khi đọc. Bảy workflow cần đánh dấu và bốn chênh lệch được phân tích trong QA. Đối chiếu lại ID ngay trước mọi phát hành.

| Workflow | ID | Active | Published | Draft |
|---|---|---|---|---|
| [TIEN404 STAGING — n8n Signed HMAC QA (INACTIVE)](https://ngoctien20.app.n8n.cloud/workflow/fWp1fBImX6K8ihOa) | fWp1fBImX6K8ihOa | Không | — | 39a2f6d2-95b9-4d31-8bd7-7240286ac0cb |
| [TIEN404 STAGING — Render data bridge QA (READ-ONLY)](https://ngoctien20.app.n8n.cloud/workflow/E3He3Kr602j2B0wC) | E3He3Kr602j2B0wC | Không | — | 9eb41a85-5c70-4704-8a8e-9d1e53a29dd1 |
| [TIEN404 WEBSITE — DEMO & MARKETING AI (QA ISOLATED)](https://ngoctien20.app.n8n.cloud/workflow/wgkkmT7q4lm4HyuA) | wgkkmT7q4lm4HyuA | Có | fcda12f3-35c6-473e-bc9d-2359ada3989c | fcda12f3-35c6-473e-bc9d-2359ada3989c |
| [TIEN404_COMMERCE_V3_QA_EXTENSION_25](https://ngoctien20.app.n8n.cloud/workflow/QR7aYMpLfKDLVgyH) | QR7aYMpLfKDLVgyH | Không | — | 730dbb04-f1de-4075-b199-77216fae5eb7 |
| [TIEN404_COMMERCE_V3_RULES_EXTENSION_LAB](https://ngoctien20.app.n8n.cloud/workflow/VBEns4KfWEz9AFgM) | VBEns4KfWEz9AFgM | Có | 6d63911a-6c0f-4e90-9581-5dd014e2fafe | 6d63911a-6c0f-4e90-9581-5dd014e2fafe |
| [TIEN404_COMMERCE_V3_BUSINESS_CORE_SANDBOX](https://ngoctien20.app.n8n.cloud/workflow/Y0WLykMtNAldbgL0) | Y0WLykMtNAldbgL0 | Có | 3d8b7f89-2058-4a2a-8919-e5ff92c3c484 | 3d8b7f89-2058-4a2a-8919-e5ff92c3c484 |
| [TIEN404_COMMERCE_00_START_HERE](https://ngoctien20.app.n8n.cloud/workflow/gpDYCp4sEzaVvPlb) | gpDYCp4sEzaVvPlb | Không | — | 18633812-46da-4ac5-b4b9-bca9b8d98f43 |
| [TIEN404_COMMERCE_AI_AGENT_SANDBOX](https://ngoctien20.app.n8n.cloud/workflow/iyfGUiEsZlNTBWOR) | iyfGUiEsZlNTBWOR | Không | — | ddc3ce5b-365e-47e2-a06d-08daffceb9a8 |
| [TIEN404_COMMERCE_V3_REGRESSION_QA](https://ngoctien20.app.n8n.cloud/workflow/tjsVobfjKLnv0o6b) | tjsVobfjKLnv0o6b | Không | — | 4c8d7dfe-6572-4aa5-b145-a3563ea797e4 |
| [AI_SALES_AGENT_TEST](https://ngoctien20.app.n8n.cloud/workflow/3MzEyZgbwkRmO4NI) | 3MzEyZgbwkRmO4NI | Không | — | a7bf9c44-499c-4925-acc6-f7b046cfd2a7 |
| [TIEN404_AI_SALES_REVENUE_V2_STAGING](https://ngoctien20.app.n8n.cloud/workflow/6sdM8zacoYQP1g5X) | 6sdM8zacoYQP1g5X | Không | — | 9a8f2378-a16f-442f-97b7-dd9271b73383 |
| [AI SALES - Manage Order](https://ngoctien20.app.n8n.cloud/workflow/fDB9dvs1qPPVt9Sp) | fDB9dvs1qPPVt9Sp | Có | 137d5689-40c5-4147-9bbc-b22809ad5908 | 2e8786fd-e5c5-410f-9d6c-655653c32278 |
| [Create Order Tool (AI_SALES_DEMO)](https://ngoctien20.app.n8n.cloud/workflow/KrSn4DNR9ALX5ng4) | KrSn4DNR9ALX5ng4 | Có | 4740251a-cd01-4f7f-b8e1-e300a8393151 | af9ee686-2a9f-483e-9622-6e449500ac5e |
| [TIEN404_COMMERCE_01_SHOP_PREFLIGHT](https://ngoctien20.app.n8n.cloud/workflow/Ax9P0JQlQu3gafZw) | Ax9P0JQlQu3gafZw | Không | — | de145dc1-63c3-443c-a4c8-57ee4fbaaa5a |
| [TIEN404_COMMERCE_00_WIZARD_NEW_SHOP](https://ngoctien20.app.n8n.cloud/workflow/Bc7UQjTIthfFB0PT) | Bc7UQjTIthfFB0PT | Không | — | ef715c87-666c-4968-9305-26c200957a04 |
| [TIEN404_COMMERCE_REGRESSION_QA](https://ngoctien20.app.n8n.cloud/workflow/ZVmMlwe2g0bPjVEq) | ZVmMlwe2g0bPjVEq | Không | — | f2748a3f-c788-433f-adf4-5eb0eda8386c |
| [TIEN404_COMMERCE_SHOP_ONBOARDING](https://ngoctien20.app.n8n.cloud/workflow/splyaeQtV719OuAu) | splyaeQtV719OuAu | Có | ae8f65de-4325-4e83-97be-4945a3abaffd | ae8f65de-4325-4e83-97be-4945a3abaffd |
| [TIEN404_COMMERCE_SUPPORT_TICKETS_QA](https://ngoctien20.app.n8n.cloud/workflow/jirkuVts1AjIhnPJ) | jirkuVts1AjIhnPJ | Có | d7d1d80d-38f3-49cd-8290-6930072cc231 | d7d1d80d-38f3-49cd-8290-6930072cc231 |
| [TIEN404_COMMERCE_CART_PREVIEW](https://ngoctien20.app.n8n.cloud/workflow/igPOsSbEgd4NgtRA) | igPOsSbEgd4NgtRA | Có | eff32e20-a6d0-4975-88b8-107eae752b4b | eff32e20-a6d0-4975-88b8-107eae752b4b |
| [TIEN404_COMMERCE_CATALOG_QUERY](https://ngoctien20.app.n8n.cloud/workflow/oOOXicKXGkBskKqh) | oOOXicKXGkBskKqh | Có | e0f1e345-8e6c-40cb-8e6a-d7ad2eb92696 | e0f1e345-8e6c-40cb-8e6a-d7ad2eb92696 |
| [TIEN404_COMMERCE_TENANT_RESOLVER](https://ngoctien20.app.n8n.cloud/workflow/5Eeh8hbpsoNhuiVo) | 5Eeh8hbpsoNhuiVo | Có | a99c7350-7aea-446d-bdc5-4b10f52c3ad1 | a99c7350-7aea-446d-bdc5-4b10f52c3ad1 |
| [TIEN404_MESSENGER_TEST](https://ngoctien20.app.n8n.cloud/workflow/Z7FdV7uDvApfbURQ) | Z7FdV7uDvApfbURQ | Có | 450d9d60-3853-45f3-979f-20164a4adc7b | 450d9d60-3853-45f3-979f-20164a4adc7b |
| [AI_SALES_DEMO - Main Agent](https://ngoctien20.app.n8n.cloud/workflow/v6PBwcqSapVzACMW) | v6PBwcqSapVzACMW | Có | c0f04eb1-9e2b-4b42-bf70-0ce12d5b0c30 | c0f04eb1-9e2b-4b42-bf70-0ce12d5b0c30 |
| [TIEN404_QA_SIGNATURE_ISOLATED](https://ngoctien20.app.n8n.cloud/workflow/KKqVV8CtmyXBmI1s) | KKqVV8CtmyXBmI1s | Không | — | 96a301d7-e3e3-48f4-9e72-00716ffa8347 |
| [TIEN404_QA_HTTP_CLIENT](https://ngoctien20.app.n8n.cloud/workflow/ZXcKOgawwYPhDUBZ) | ZXcKOgawwYPhDUBZ | Không | — | 61ac2af8-d560-48ba-a6d4-60879759b434 |
| [TIEN404_META_TOKEN_CHECK](https://ngoctien20.app.n8n.cloud/workflow/8gA4A8TM3Z9waloB) | 8gA4A8TM3Z9waloB | Không | — | 7cc04b75-2e7b-4d44-a620-767db2a902ba |
| [TIEN404_MESSENGER_SUPPORT_REQUESTS](https://ngoctien20.app.n8n.cloud/workflow/KqSuGxCHixc6fsiu) | KqSuGxCHixc6fsiu | Có | ad55961f-2663-403f-b9b8-e110d4a44a18 | ad55961f-2663-403f-b9b8-e110d4a44a18 |
| [TIEN404_MESSENGER_ORDER_STATUS](https://ngoctien20.app.n8n.cloud/workflow/4DFFCk60exrzaIl6) | 4DFFCk60exrzaIl6 | Có | 1faaa1ee-a45c-4bf0-8e3f-f197051f33f8 | 1faaa1ee-a45c-4bf0-8e3f-f197051f33f8 |
| [AI_SALES_AGENT_ISOLATED_READONLY](https://ngoctien20.app.n8n.cloud/workflow/NvQfIffOrZokPBPW) | NvQfIffOrZokPBPW | Không | — | 4c2575de-5a92-41aa-88ab-c84f7e2e7e9f |
| [AI SALES - Revenue Report](https://ngoctien20.app.n8n.cloud/workflow/U2DJsxzSYPH5hRop) | U2DJsxzSYPH5hRop | Có | 978b5a8d-d47b-4783-b27e-96fbc96d5262 | e4e16b90-1c66-48b9-a9e0-9d8fb6dbc6df |
| [AI SALES - Update Order.](https://ngoctien20.app.n8n.cloud/workflow/BkAi6TVUKAjCnI7v) | BkAi6TVUKAjCnI7v | Có | 93cf227a-ab8a-42c6-9185-7ec44f7aeb00 | 3bd7043f-78e7-4a1c-93e5-2bc9d60ac767 |

## Bàn giao V8

1. **P0 Auth và phân quyền.** Dùng phiên QA A qua kênh bảo mật, chạy công cụ PR #5 với `--shop-a-only` nếu chỉ có A. Hai tenant phải có fixture. Duyệt cấp danh tính QA riêng cho B rồi chạy chế độ mặc định hai chiều. Kiểm tra UI refresh/logout, API thật, lỗi token hết hạn, thu hồi và hai tab. Xác minh chính xác hai callback Render trong Supabase Auth trước khi mở recovery.
2. **P0 báo cáo tiền và đơn.** Published Revenue sai 6/9 fixture. Lưu version đang phục vụ, chạy hồi quy trên snapshot khử định danh, xác nhận chủ nghiệp vụ rồi mới quyết định publish. Create/Manage/Update cần kiểm dữ liệu cũ và nhánh từ chối. Không dùng workflow ghi đơn/email/Messenger để chạy thử.
3. **P1 giao dịch kho.** Kiểm hàm giao dịch staging qua hai kết nối đồng thời, retry cùng khóa, cùng khóa khác payload, rollback giữa chừng, hủy/hoàn hai lần; đối chiếu order, stock và audit. Khoá duy nhất trên tenant/request_key riêng lẻ chưa chứng minh cả giao dịch.
4. **P1 hành trình shop.** Hoàn thiện Products/Orders/Conversations chỉ đọc có quyền, nguồn dữ liệu, trạng thái lỗi/trống; kiểm website, Android IME/dark và iOS Safari. Sau đó nối tool Merchant Copilot qua API, phân biệt shopper bằng ownership.
5. **P1/P2 vận hành.** Chạy benchmark 96 + 36 theo transport cô lập, hoàn thiện registry, support/handoff, entitlement/usage, audit, cảnh báo, diễn tập restore Data Platform, shared replay protection và luồng onboarding. Quyết định pilot sau E2E. Chủ dự án duyệt riêng thanh toán, quyền quản trị, release production, thay credential hoặc phát sinh phí.

Giữ nguyên dữ liệu thật, gh-pages, Published n8n, cấu hình quyền, secret và checkbox Control Hub trong đợt này. Không lấy Sheets demo làm nguồn SaaS, không cấp Orders cho widget công khai, không tự chuyển thử nghiệm vào Core Bot.
