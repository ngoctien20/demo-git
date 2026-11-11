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
