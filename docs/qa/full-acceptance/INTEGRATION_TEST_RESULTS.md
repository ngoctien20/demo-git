# INTEGRATION_TEST_RESULTS — Round 1–2 (OFFLINE)

Môi trường: container cloud, Node 22.23.5, Python 3.13.18, checkout `develop` `00aff9b`. Không gọi host nào ngoài GitHub REST, Supabase SELECT và n8n đọc.

## 1. Bộ test có sẵn trên `develop`

| Test ID | Lệnh | Kết quả | Mức |
|---|---|---|---|
| T-A01 | `python qa_static.py` | PASS: 26 trang, 795 link/resource, 0 lỗi | OFFLINE |
| T-A02 | `node scripts/check-site-navigation.mjs` | PASS: 24 trang dùng chung điều hướng | OFFLINE |
| T-A03 | `pytest tests/` | Round 1: 11 PASS, **2 FAIL**; Round 2b sau khi sửa test: **14/14 PASS**. Lỗi ban đầu: `test_nav_on_all_pages` (login.html không còn menu), `test_six_pages_and_semantics` (login.html không còn `data-saas-page`) | OFFLINE |
| T-QA | `node --test` trên 39 file `qa/**/*.test.{mjs,cjs}` | **631 PASS / 3 FAIL**; 3 FAIL đều là test trình duyệt cần `python -m http.server 8080` như trong CI | OFFLINE |
| T-CI | GitHub check runs trên `00aff9b` | 46 check, không failure | OFFLINE (CI) |

Phân tích T-A03: `login.html` được thay bằng trang chuyển hướng sang Supabase Auth trên Render từ V13.4, nhưng `tests/test_saas_contract.py` vẫn kỳ vọng trang mô phỏng cũ. Đây là **test drift**, không phải lỗi sản phẩm. CI không phát hiện vì `quality.yml` chỉ chạy khi push `gh-pages`. Đề xuất: cập nhật test (P3).

3 test trình duyệt (`channel-v143/browser`, `channel-v185/browser`, `messenger-rich-v136m/preview`) không chạy lại được vì môi trường này không cho khởi động server nền. CI đã chạy chúng trong 46 check (BLOCKED môi trường, không tính là FAIL sản phẩm).

Chi tiết theo file: `EVIDENCE_MANIFEST.md` mục E-04.

## 2. Test mới của V21 (Round 2)

| Test ID | File | Kết quả | Ý nghĩa |
|---|---|---|---|
| T-N01…T-N10 | `qa/v21-full-acceptance/n8n-published-drift.test.mjs` | 10/10 PASS (test khẳng định lỗi tồn tại) | Published vs Draft của `KrSn`, `U2DJ`, `fDB9` |

Kết quả chính:

| Đầu vào | Published (đang chạy) | Draft (chưa publish) | Kỳ vọng |
|---|---|---|---|
| giá `"1.2tr"` | nhận **1,2 đ** | từ chối | từ chối hoặc 1.200.000 |
| giá `"12.5k"` | nhận **12,5 đ** | từ chối | từ chối |
| giá `"1,5"` / ô số `159000.7` | nhận số lẻ | từ chối | số nguyên VND |
| số lượng `1e20` | qua `Number.isInteger` | từ chối | từ chối |
| doanh thu `["987000","1.200.000","987.000₫"]` | **987.000** | 3.174.000 | 3.174.000 |
| tồn kho `"10 cái"` | 10 | từ chối | cần quyết định (draft có thể từ chối nhầm) |

Giới hạn: test tái tạo code đã copy nguyên văn từ n8n, không thực thi workflow. Việc giá sai có thực sự đi vào đơn còn phụ thuộc dữ liệu thật trong cột giá của Sheet (không đọc Sheet để tránh dữ liệu khách).

## 3. Code Render auth / merchant / tester portal (nhánh checkpoint)

`checkpoint/render-auth-staging-pre-v12-2-admin-csv-20261114` (`6324b778`):

| File | Kết quả |
|---|---|
| auth-helpers | 6/6 PASS |
| auth-recovery-guard | 3/3 PASS |
| auth-runtime | 4/4 PASS |
| merchant-portal-v12-2 | 12/12 PASS |
| tester-portal-staging | 10/10 PASS |
| auth-preview-build | 0/3 (cần chạy bước build tạo `auth-preview-dist/` trước) |

Không xác định được đây có đúng commit đang chạy trên Render hay không (BLOCKED: không truy cập Render).

## 3b. Round 2b (bổ sung)

| Test | Kết quả |
|---|---|
| T-N09 manage_order với Sheet 2 đơn | Trả `multiple_orders` cho mọi yêu cầu (lỗi ở cả Published và Draft) |
| T-N10 apply thiếu `expected_total` | Published cho qua, Draft từ chối |
| Diff `BkAi` Update Order | Draft chỉ siết SĐT (`^0[35789]\d{8}$`) và địa chỉ phải có chữ; Published nhận mọi số 10 chữ số |
| Diff `iyfG` Commerce Sandbox | Chỉ khác ở serialization (không đổi logic) |
| Super Admin `ops/super-admin-v4-staging-20261110` | 68/68 PASS (backend SQLite staging) |
| Control Hub | 14/14 PASS |
| Quét secret 503 nhánh | Không có secret thật trong git |

## 4. Chưa chạy (để Round 3)

- Auth → Store → Products trên Supabase hosted: BLOCKED (chưa có Store schema hosted, chưa có restore-test).
- Product → AI Core → Cart → Order trên Supabase: NOT_IMPLEMENTED (không có đường ghi đơn).
- Order → Notification: NOT_IMPLEMENTED.
- Channel → Identity → Protected Tool: chỉ có offline (V19.8.x), hosted BLOCKED.
- Subscription → Entitlements: NOT_IMPLEMENTED.
- Gọi thử webhook n8n bằng dữ liệu tổng hợp: KHÔNG làm vì các workflow này là production và có node gửi thật hoặc ghi Sheet; cần môi trường clone.

## Round 2c (2026-11-21 ~13:40 UTC)

| ID | Bộ | Kết quả | Mức |
|---|---|---|---|
| T-S18 | Bản sửa đề xuất `manage_order` S-18 + gate S-19 | 4/4 PASS (tổng thư mục `qa/v21-full-acceptance` 14/14) | OFFLINE |
| T-WEB | Browser E2E GitHub Pages, desktop + mobile 390px | PASS: 20 trang 200, không tràn ngang, 0 lỗi console (E-29) | PUBLIC |
| T-STORE | Catalog Store V20 trên staging | PASS (E-27) | STAGING |
| T-OWNER-AB | UAT Owner A/B + manager Store 2 (claims mô phỏng PostgREST, rollback) | 27/27 kỳ vọng PASS (E-30) | STAGING |
