# TIEN404 AI — MASTER FULL SYSTEM ACCEPTANCE V21.0 (Round 1–2)

**Kết luận hiện tại: NOT READY.** Round 1 (Discovery) và Round 2 (Static/Contract) đã thực hiện; Round 5 (review độc lập) đã chạy cho P0/P1; Round 3–4 bị chặn bởi approval gate; Round 6 sơ bộ. Báo cáo này **không** tuyên bố đã nghiệm thu xong toàn bộ.

## 1. Trạng thái thực tế

- **VERIFIED** Repo public, `develop` `00aff9b` chưa merge vào `main`; không branch protection. Code đang chạy trên Render (auth, merchant/tester portal), Super Admin, n8n và migration Supabase **không nằm trong develop/main**.
- **VERIFIED** Supabase staging: RLS mức tenant, 0 Store, 2 tenant QA, 2 sản phẩm, 2 đơn; không có bảng billing/outbox; không backup.
- **VERIFIED** n8n 174/23 active. Đường bán hàng duy nhất chạy thật là **bot Messenger `TIEN404_MESSENGER_TEST`** trên một Page: AI gpt-5-mini trả lời thật và ghi đơn vào **Google Sheet AI_SALES_DEMO** (execution 4498 ngày 17/11 tạo đơn và gửi tin thành công).
- **VERIFIED** 5 workflow Draft ≠ Published; 3 trong đó là tool ghi đơn mà bot live đang gọi.

## 2. Đã kiểm tra

GitHub (PR #468–#482, nhánh, CI, protection), Supabase (catalog, grants, SECDEF, advisors, số dòng), n8n (inventory, 18 workflow chi tiết, executions, lỗi), Google Drive (tìm bộ CSV), test offline trên develop và nhánh Render checkpoint, review độc lập read-only.

## 3. Đã thay đổi

Chỉ nhánh `claude/project-thread-2rqcm1`: 13 tài liệu trong `docs/qa/full-acceptance/` và `qa/v21-full-acceptance/n8n-published-drift.test.mjs`. Không thay đổi n8n, Supabase, Render, Cloudflare, Sheet.

## 4. QA và bằng chứng

| Bộ | Kết quả | Mức |
|---|---|---|
| Static/nav website | PASS | OFFLINE |
| Contract SaaS pytest | 11/13 (2 test lỗi thời) | OFFLINE |
| 39 file QA kênh | 631 PASS / 3 BLOCKED môi trường | OFFLINE |
| CI develop | 46 xanh | OFFLINE |
| Render checkpoint | 35/38 (3 cần build) | OFFLINE |
| Drift n8n (mới) | 8/8, xác nhận lỗi bản Published | OFFLINE |
| Hosted UAT | 0 — toàn bộ BLOCKED | — |

Chi tiết: `INTEGRATION_TEST_RESULTS.md`, `EVIDENCE_MANIFEST.md`.

## 5. Lỗi/rủi ro còn lại

Cập nhật Round 2c (13:40 UTC): **S-01 đã đóng** (backup/restore VERIFIED); **S-02 đã áp lên staging**, catalog PASS, còn thiếu UAT Owner A/B bằng JWT; bản sửa S-18 PROPOSED (chưa publish); browser E2E trang public PASS (E-29). Round 3a: **UAT Owner A/B Store PASS trên staging** (E-30). Round 3b: không thấy đăng nhập DB lạ (E-31); thêm S-20..S-22. Round 6 (22/11): giữ **NOT READY**, xem `FINAL_RELEASE_DECISION.md`.

P0 (ban đầu): backup/restore (S-01); Store Authority hosted (S-02); **sự cố lộ một phần mật khẩu DB staging trong log Actions công khai (S-17), đang đổi mật khẩu**.
P1 bổ sung Round 2b: sửa đơn qua chat hỏng khi Sheet có ≥2 đơn (S-18); bản Published cho sửa đơn không cần `expected_total` (S-19).
P1: bot live "TEST" ngoài Supabase (S-03); PII trong execution n8n (S-04); nhãn/ghi chú sai (S-05); repo public không protection (S-06); anon SECDEF Zalo (S-07); runtime ngoài repo; không trừ kho/không thông báo đơn.
P2–P3: S-08…S-16. Đầy đủ: `SECURITY_FINDINGS.md`.

## 6. Cần chủ dự án phê duyệt

Xem `APPROVAL_GATES.md` (G-01…G-16). Ba quyết định quan trọng nhất: chạy backup/restore (G-01), số phận bot Messenger live (G-05), publish bản Draft của tool đơn hàng (G-06).

## 7. Checkpoint và rollback

Xem `NEXT_CHECKPOINT.md`. Không có thay đổi runtime nên không cần rollback.

## 8. Bước tiếp theo (tối đa 3 việc P0/P1)

1. B-00: chủ dự án chạy backup + restore; Claude kiểm chứng.
2. Store Authority #482 trên restore-test + UAT Owner A/B hosted.
3. Quyết định bot Messenger live + giảm PII + đồng bộ Draft/Published.

## Trả lời 6 câu hỏi

1. **Đã xây dựng:** website marketing, website AI consultant, bot Messenger bán hàng trên Google Sheet, Supabase Auth + RLS tenant + RPC sản phẩm, nhiều workflow sandbox/shadow cho Zalo và Commerce core, hàng trăm test offline.
2. **Hoạt động thực tế:** website + AI consultant; bot Messenger trên 1 Page với đơn ghi vào Sheet DEMO; đăng nhập Supabase Auth (theo checkpoint trước, chưa kiểm lại hôm nay).
3. **Chỉ có code/mock/QA:** Store Authority, Commerce trên Supabase, Zalo bán hàng, notification, billing, onboarding, Page installation đa merchant, shared AI core (shadow).
4. **Chặn khách thật:** S-01, S-02, Commerce chưa có trên Supabase, PII, không trừ kho/thông báo.
5. **Pilot cửa hàng đầu tiên:** **chưa** (NOT READY).
6. **Thứ tự hoàn thiện:** `P0_P1_REMEDIATION_BACKLOG.md` mục 1→14, rồi billing/onboarding.

Reviewer: không có Codex Worker; dùng subagent Claude độc lập read-only, mọi kết luận của reviewer đã được đối chiếu lại.
