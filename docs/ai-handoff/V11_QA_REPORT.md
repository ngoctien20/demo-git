# Bằng chứng QA · 11–12/11/2026 JST

| Test | Môi trường, đầu vào | Mong đợi và thực tế | Kết quả |
|---|---|---|---|
| AUTH-BUILD | Render 32669ab, so 19 file từ build độc lập | 19/19 khớp byte. Trước deploy ba file CSS, login JS, account JS lệch | PASS [CI hosted](https://github.com/ngoctien20/demo-git/actions/runs/43040113005) |
| AUTH-ANON | Chromium mobile mới, mở login rồi account và refresh | Nút login sẵn sàng, email recovery khóa, yêu cầu đăng nhập, phần riêng tư ẩn | PASS cùng CI hosted |
| AUTH-RECOVERY/CSV | 32669ab, SDK fixture, callback đổi tài khoản, báo cáo kỳ, dữ liệu sai scope | 16 unit và Chromium tích hợp đạt | PASS [CI](https://github.com/ngoctien20/demo-git/actions/runs/43039701159) |
| HTTP-ANON | Supabase publishable key, GET Auth user, products, orders | HTTP 401 cho cả ba, hai tài nguyên DB trả 42501 | PASS |
| RLS-DB | Hai giao dịch READ ONLY độc lập, SET LOCAL ROLE authenticated và sub của owner chỉ thuộc một shop | Mỗi chiều 1 tenant của mình, 0 tenant, products và orders bên kia. Có 2 products và 2 orders trong DB | PASS ở PostgreSQL |
| DIRECT-WRITE | Kiểm SELECT has_table_privilege cho authenticated trên products | INSERT=false, UPDATE=false | PASS kiểm quyền bảng |
| AUTH-LIVE | JWT độc lập A/B, staff và nonmember qua HTTP, refresh và mở lại browser có phiên | Thiếu phiên QA được cấp cho runner | BLOCKED |
| AI-STOCK | 56e1f39, 10 unit + replay 7 trace lịch sử | Suite chấm điểm đạt, không đo model mới | PASS [CI](https://github.com/ngoctien20/demo-git/actions/runs/43040223257) |
| COMMERCE | n8n catalog/cart execution 2381, core 2384, extension 2380 | 17/17 + 22/22 + 25/25, fake orders/outbox | PASS sandbox |
| ADMIN | PR #15 FastAPI/SQLite, validation và authorization | 72 test đạt, 1 warning | PASS [CI](https://github.com/ngoctien20/demo-git/actions/runs/43039505813) |
| WEB | 61cf82f, Chromium ứng viên và đọc preview cũ | 29 case đạt, cùng navigation CI | PASS [CI](https://github.com/ngoctien20/demo-git/actions/runs/43039715865) |

Chưa đo tải 100 cửa hàng, chi phí model thực, E2E giao dịch thật, WCAG toàn site, hay restore Supabase vào môi trường riêng.

**WEB-HOSTED · PASS.** Ba bài Playwright trên URL triển khai bất biến eb7edbed kiểm 4 tệp HTTPS khớp byte, header noindex/nosniff và hai trang mobile khi chặn CDN. Cả hai nút mở được fallback, Escape trả focus, không phát sinh request ghi. [CI sau deploy](https://github.com/ngoctien20/demo-git/actions/runs/43109930511) · [mã QA](https://github.com/ngoctien20/demo-git/commit/5160370c40b86dd27b63833694f19a371d59832c).


## 12/11/2026 — new verified evidence

| QA gate | Source | Result and scope |
|---|---|---|
| Stale merchant RPC before fix | [Commerce run 43113215829](https://github.com/ngoctien20/demo-git/actions/runs/43113215829) | **FAIL**: synthetic JWT HTTP stale update hung and timed out at 20s; old PostgreSQL `40001` caused retry storm. |
| PostgreSQL/PostgREST after fix | [run 43114961344](https://github.com/ngoctien20/demo-git/actions/runs/43114961344) | **PASS**: all job steps including signed JWT fixture A/B; stale product update returns `409 PT409` promptly, not indefinite retry. |
| Data Platform static/mock QA | [run 43114961157](https://github.com/ngoctien20/demo-git/actions/runs/43114961157) | **PASS** isolated, no real customer Auth. |
| Real staging PostgreSQL RPC | Migration `20261111225128` | **PASS** transaction/ROLLBACK: create/update QA product, reject stale version PT409, reject foreign tenant, confirm anon/direct-update disabled. No QA record remains. |
| Public multi-provider health | `.github/workflows/v11-public-staging-health.yml` | **Test introduced**; do not call PASS until the new CI run is verified. Proves public HTTPS and anonymous 401 only. |

**Still NOT_RUN:** two real Supabase Auth user sessions A/B including refresh/logout and forbidden writes, end-to-end merchant transactions through a deploy with trusted gateway identity, actual Messenger live order tool, independent live restore. Existing mock JWT A/B is not a live Auth token verification.


### Latest independent on-host QA — 12/11/2026 JST

| Test | Latest evidence | State |
|---|---|---|
| Public staging / anonymous deny | [GitHub Actions 43116766699](https://github.com/ngoctien20/demo-git/actions/runs/43116766699) | **PASS**. 7 fixture tests + six live read-only HTTP checks (Cloudflare 200, GitHub Pages 200, Render Auth login 200, Render Data health 200, anon tenants 401, forged bearer 401). Cold-start HTTP 503 logged and recovered on attempt 3. |
| Hosted Render Auth deployed SHA | [GitHub Actions 43116766858](https://github.com/ngoctien20/demo-git/actions/runs/43116766858) | **PASS**. Pinned candidate updated to actual deployed Render commit `deaa5e1c6...`; built artifacts matched hosted and mobile anonymous Chromium smoke verified account protected after refresh. |
| Previous hosted Auth default SHA | [GitHub Actions 43116409568](https://github.com/ngoctien20/demo-git/actions/runs/43116409568) | **FAIL expected from stale comparison** `32669aba...` vs current deployed Render `deaa5e1c6...`; corrected without modifying service deployment. |
| Initial public Render Free warmup | [GitHub Actions 43115725125](https://github.com/ngoctien20/demo-git/actions/runs/43115725125) | **FAIL**: health 503 during Render Free cold start before 7s Uvicorn startup; bounded retries now preserve this incident evidence and fail on sustained 503. |

Neither public health smoke nor anonymous browser tests verifies a real signed-in A/B session. Pilot gate remains BLOCKED.

### Nghiệm thu bản tích hợp · 12/11

| Phép thử | Đầu vào và kết quả | Bằng chứng |
|---|---|---|
| Commerce CI | Hai phiên DB tranh sản phẩm cuối, retry, hoàn kho hai lần, rollback, đối soát tiền, khôi phục DB fixture thứ hai, PostgREST thật với JWT ký trong CI cho owner/manager/staff/nonmember và HTTP 409 cho version cũ. PASS | [Commerce QA](https://github.com/ngoctien20/demo-git/actions/runs/43149543214) |
| Data CI | Contract mới buộc đúng cặp HTTP/SQLSTATE của shop mình và shop khác, kiểm cả trường hợp cho qua sai. PASS | [Data QA](https://github.com/ngoctien20/demo-git/actions/runs/43149543498) |
| Auth/Render | 16 unit và Chromium cô lập. Trên host, 19 tài nguyên đúng build, login sẵn sàng và account ẩn danh bị khóa sau refresh. PASS | [Auth CI](https://github.com/ngoctien20/demo-git/actions/runs/43149675318) · [Hosted](https://github.com/ngoctien20/demo-git/actions/runs/43149990246) |
| Public health | Website, Auth và Data public/anonymous cùng chữ ký giả; kiểm độc lập. PASS | [Hosted public](https://github.com/ngoctien20/demo-git/actions/runs/43149990241) |
| Signed hosted | Job riêng dừng ở kiểm cấu hình đầu vào; không có kết quả login/refresh/reopen/logout của hai user trên host. BLOCKED | [Private acceptance](https://github.com/ngoctien20/demo-git/actions/runs/43149990296) |

SQL staging xác nhận 2 tenant, function chứa PT409, anon không EXECUTE và authenticated không UPDATE trực tiếp. Không áp dụng lại migration của #26.

## 12/11/2026 · kiểm thử có xác thực sau khi cấu hình secrets

Runner đã nhận đủ bốn secret. Shop A đạt HTTP JWT qua gateway và PostgREST, refresh và logout. Shop B bị từ chối ở bước đăng nhập HTTP 400. Chromium chưa chạy. [Actions · lần 3](https://github.com/ngoctien20/demo-git/actions/runs/43149990296/attempts/3).

Lần 2 dừng do ReadTimeout. Lần 3 vượt qua kiểm tra ẩn danh. Shop A đọc được sản phẩm và đơn fixture của A, bị từ chối khi đọc B. RPC nhận payload cố ý sai và từ chối truy cập tenant B. Runner đọc lại sau refresh và xác minh refresh token bị từ chối sau local logout. Supabase có một sự kiện thông tin đăng nhập không hợp lệ trong cửa sổ chẩn đoán 10 phút. Chưa nghiệm thu chiều B → A, phiên trình duyệt hoặc quyền ghi hợp lệ. Form ghi chưa được phê duyệt bật.

## 12/11/2026 · kiểm thử lại sau cập nhật tài khoản QA

Lần 4 dừng ở ReadTimeout. [Actions · lần 5](https://github.com/ngoctien20/demo-git/actions/runs/43149990296/attempts/5) đạt. Render Auth 219dd086, Data ab940a95. Hai tài khoản QA đạt đăng nhập, đọc đúng tenant, chặn đọc chéo qua gateway và PostgREST, kiểm quyền RPC sản phẩm bằng payload sai, refresh token và logout. Chromium 360 × 780 đạt cho cả hai shop khi tải lại, đóng/mở lại và chặn trang account sau logout. Kiểm tra ẩn danh đạt. Các phép thử RPC dùng đầu vào bị từ chối, chưa nghiệm thu vòng đời ghi hợp lệ, staff và nonmember.

## 12/11/2026 JST · Merchant, danh mục và báo cáo

WORK, nền bàn giao 7fe4a5a. Mã kiểm thử [PR #31](https://github.com/ngoctien20/demo-git/pull/31). Auth 219dd086, Data ab940a95.

| Bài thử | Môi trường và đầu vào | Nghiệm thu và kết quả |
|---|---|---|
| PRODUCT-RPC-DB | Supabase staging, hai owner giả lập claim SQL, hai SKU tạm cùng mã ở hai tenant | PASS. Tạo ở giá 100 và tồn 3, sửa giá thành 200 và ngừng bán. Đọc lại đúng giá và tồn. Mỗi tenant có một audit tạo, một audit sửa và đúng actor. Xung đột bản cũ trả PT409. Giá âm, tồn âm, ghi chéo, UPDATE trực tiếp và UID ngoài membership bị từ chối. |
| PRODUCT-ROLLBACK | ROLLBACK toàn bộ transaction trên staging, truy vấn mới tìm SKU tiền tố của bài thử | PASS. Còn 0 sản phẩm và 0 audit của bài thử. Kiểm tra grant cho thấy authenticated thiếu INSERT/DELETE trực tiếp, anon thiếu EXECUTE. Khôi phục backup staging là bài riêng. |
| PRODUCT-ROLES | PostgreSQL 16.2 cô lập, schema/candidate tại ab940a95, danh tính tổng hợp | PASS. Manager tạo thành công, staff, manager bất hoạt và nonmember bị từ chối. Owner của tenant ngoài allowlist bị từ chối. Trên staging hiện chỉ thấy membership active vai trò owner ở hai shop QA. |
| REPORT-DB | Supabase staging, hai shop × 7/30 ngày, cùng snapshot, ngày Việt Nam, có đơn ở mỗi kỳ | PASS. Mọi ngày, số đơn, số đơn paid và tổng VND do RPC trả khớp truy vấn độc lập trên orders. |
| REPORT-CSV | Render staging, hai JWT thật, Chromium 360×780, tải 4 CSV | PASS. Kiểm tham số tenant/kỳ, tên file, tiêu đề, từng dòng và tổng tiền so với response. Refresh, mở lại, logout và từ chối route cũng đạt cho cả hai. [Actions](https://github.com/ngoctien20/demo-git/actions/runs/43194173398). |
| AUTH-RELEASE | Render staging | PASS. [Hosted verification](https://github.com/ngoctien20/demo-git/actions/runs/43194173182). |

Regression cục bộ gồm 7 bài health và 10 bài lab đạt. Chưa kiểm staff/nonmember bằng JWT riêng trên host, ghi hợp lệ qua HTTP, cạnh tranh hai request thực hoặc phục hồi bản sao lưu Supabase sang đích cô lập. Form ghi sản phẩm tiếp tục tắt.

Commit cuối của PR là 832a64bd. [Private acceptance](https://github.com/ngoctien20/demo-git/actions/runs/43194528530) và [hosted release verification](https://github.com/ngoctien20/demo-git/actions/runs/43194528538) đều đạt.
