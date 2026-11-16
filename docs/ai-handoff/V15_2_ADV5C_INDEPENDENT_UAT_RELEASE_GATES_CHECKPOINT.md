# TIEN404 AI — V15.2 ADV.5C Independent Merchant UAT Review × Release Readiness Gate

**Kiểm toán:** 16/11/2026 JST  
**Lifecycle:** CANDIDATE, source-only, No-Send, Draft PR #170 (child of #166).  
**Decision:** **NO_GO_HOSTED_OR_PRODUCTION**. Không phải phê duyệt triển khai.

## I. Trạng thái thực tế (đã truy vấn trực tiếp chỉ-đọc)

| Thành phần | Kết quả | Evidence boundary |
|---|---|---|
| GitHub | PR #166 OPEN DRAFT HEAD `9ccefacdfb3ab9fbbac43b9bbb2e4d59adf93ccc`; PR #159 và PR #143, #137 đều OPEN DRAFT | Không merge |
| Supabase staging | `tien404-staging` / `ifxlvrhyjhbzbrkdsida` ACTIVE_HEALTHY, PostgreSQL 17.11 | Project status |
| Store schema | `public.orders`, `public.order_items`, `public.products` có tenant_id nhưng **không có store_id**; `public.stores` và `public.store_memberships` chưa tồn tại | `information_schema.columns` read-only |
| RLS | `orders`, `products`, `tenant_memberships` đều `relrowsecurity=true`, `relforcerowsecurity=true` | **Không** chứng minh Shop A/B isolation |
| Public SECURITY DEFINER | `public.qa_shop_b_zalo_claim(p_challenge uuid, p_code text, p_sender text, p_event text) returns boolean`: `SECURITY DEFINER=true`, `anon_execute=true`, `anon_schema_usage=true`. Các SECURITY DEFINER public khác được ghi nhận: `qa_owner_pairing`, `save_merchant_product`, `tien404_tester_track_change` | **P0 quyền công khai cần thẩm định**; chưa kết luận có khai thác/IDOR, không chạy hàm |
| QA Owner bindings | `tien404_r1_qa.owner_bindings` có 2 bản ghi, `owner_pairing_claims_v3` có 4 bản ghi | Chỉ là dữ liệu QA; không phải xác nhận Owner G2.3 |
| Supabase advisors | Có thông báo INFO `rls_enabled_no_policy` trên một số bảng private/RLS-only | Không suy diễn tự động là public exposure |
| Messenger n8n | `TIEN404_MESSENGER_TEST` `Z7FdV7uDvApfbURQ`, active true, version `d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92`; workflow metadata xác nhận còn dùng các tool DEMO | **Không** phải Store-isolated Commerce |
| Zalo lab n8n | `TIEN404_ZALO_BOT_LAB_V1_STAGING` `yIJk8LvJoLF40Z62` trả `active=true`, version `8ca4a6f6-ab3f-42f1-8637-d4f5db790a3e`; phần description ghi là staging protected read-only. Hai trường metadata active/description chưa đồng nhất về nhãn, không suy đoán hành vi gửi | Không có bằng chứng UI native đa kênh LIVE |
| Rich UI candidates | `X0MwwQ7LRUqfOVjM` Messenger và `qWMu4n1wLkTZBNpI` Zalo RichText đều `active=false` | Không cho phép bật lại |

**P0 đặc biệt:** Chức năng `public.qa_shop_b_zalo_claim` có thể được role `anon` gọi ở mức SQL privilege. Vì dùng `SECURITY DEFINER`, cần kiểm tra code, search_path, ownership, challenge/OTP lifecycle, rate limit, replay protection và tác động nếu thu hồi GRANT. **Không thực hiện CALL thử, UPDATE, REVOKE, sửa credential hoặc production.** Không sửa quyền trước khi đánh giá độc lập và phê duyệt thay đổi.

## II. Merchant UAT received vs independent proof

- Đã nhận báo cáo `T404_ADV5_MERCHANT_UAT_SELF_REPORT_V1`: **16/16 PASS**, FAIL=0, NOT_RUN=0; cả 16 observation rỗng, `renderCount=111` do browser báo.
- Báo cáo được nhận bằng trò chuyện và hợp lệ về cấu trúc; **không có quyền Owner được xác minh**, không có chữ ký bên đánh giá, không có bằng chứng độc lập cho từng thao tác và không được phép tự cấp `APPROVED`.
- PR #166 ADV.5B 195/195 Node + 17/17 viewport browser QA đã PASS trước đó; **người thử chưa gửi UAT của bản mobile cards mới**.
- UAT độc lập cần 4 phần **ngoài phiên ChatGPT**: (1) xác minh reviewer riêng tư, không dùng checkbox tự khai; (2) xác minh merchant owner và phạm vi Shop/kênh; (3) thực hiện fresh mobile-card tests bằng dữ liệu QA, không PII, ít nhất kiểm tra 320/390/412 px, kèm ghi chú hoặc screenshot được chia sẻ có kiểm soát; (4) reviewer độc lập lập biên bản và ký/duyệt theo quy trình có audit. Không yêu cầu credential/token/OTP gửi vào chat.

## III. Thay đổi trên nhánh ADV.5C

- `advanced-merchant-uat-independent-review.cjs`: strict 16-case schema, báo cáo nguồn tin tự khai, kiểm tra input/claims chống giả mạo, trạng thái `PENDING_VERIFIED_INDEPENDENT_REVIEW`.
- `decideRelease`: **10 cổng** P0/P1 riêng biệt, mọi trạng thái đều chưa đạt `VERIFIED`; release quyết định `NO_GO_HOSTED_OR_PRODUCTION`, `publicStagingReleaseAuthorized=false`, `productionReleaseAuthorized=false`.
- `advanced-merchant-uat-independent-review.test.cjs`: **30 bài kiểm thử an toàn**.
- `.github/workflows/v152-adv5c-review-release-gates-nosend.yml`: test mới + 195 bài cũ và 17 lượt Chromium ở 9/4/4 viewport, không HTTP write/provider send.

## IV. Gate Matrix (không tự chứng nhận)

| Cổng | Ưu tiên | Trạng thái | Điều kiện nghiệm thu thực |
|---|---|---|---|
| Public SECURITY DEFINER anon RPC | P0 | BLOCKED | Thẩm định/khắc phục có phê duyệt và QA negative |
| Hosted Store A/B JWT-RLS | P0 | BLOCKED | Store schema, JWT thật từng shop, deny same-tenant và cross-tenant |
| Owner G2.3 và consent | P0 | BLOCKED | Reviewer độc lập, quyền sở hữu và cho phép kênh được xác minh |
| Secure Action Gateway / durable nonce | P0 | BLOCKED | Server-bound identity, atomic replay/idempotency, xác nhận trước ghi |
| Private Commerce Messenger→Zalo | P0 | BLOCKED | Đơn/tra đơn trên cùng backend, quyền Shop và sự kiện trùng |
| Messenger/Zalo capabilities | P1 | NOT TESTED | Account-native permission/template/media/ZBS cost |
| AI presentation model thật | P1 | NOT TESTED | Accuracy, P50/P95, tokens, cost, chi phí đã duyệt |
| Independent UAT ADV.5B | P1 | NOT VERIFIED | Biên bản independent & fresh mobile-card feedback |
| Hosted backup/rollback | P1 | BLOCKED | Backup encrypted và restore proof theo approval riêng |
| Hosting/public staging/billing | P1 | BLOCKED | Quyền Billing Read và phạm vi chi phí rõ ràng trước deploy |

**Không thể đổi từ CANDIDATE sang APPROVED hay RELEASED bằng passing unit tests hoặc self-attested JSON.**

## V. QA, rollback và bước kế tiếp

- QA bằng GitHub Actions được liên kết trong [PR #170](https://github.com/ngoctien20/demo-git/pull/170); chỉ gắn trạng thái SUCCESS khi kiểm tra exact HEAD.
- Các bản ADV.1–5B, Messenger DEMO và toàn bộ workflow Published vẫn giữ nguyên. Không có SQL mutation, GRANT/revoke, workflow publish, credential hay dữ liệu khách hàng được thực hiện.
- Rollback: đóng Draft PR #170 hoặc revert các commit source-only; không có hosted/production rollback.
- **PROPOSED — V15.2 ADV.5D: P0 Hosted RPC Exposure Private Review × Signed Shop Ownership/JWT-RLS Evidence Intake.** Tách phê duyệt bảo mật ra khỏi công tác nghiệm thu giao diện. Không tự thay đổi RLS/permissions/credentials/Published.
