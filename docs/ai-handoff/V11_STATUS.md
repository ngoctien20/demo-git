# V11 · Checkpoint trước thay đổi
Ngày 11/11/2026 UTC. WORK. Nguồn điều phối 976abe3, sau cập nhật #9 và PR #10–12. Đã kiểm kê 10 tệp bàn giao.
Render Auth LIVE c728f15 (dep-dbq33krl550s739e1vfg), Data LIVE 3c29f70 (dep-dbq30a2jnfac73euucsg). Supabase có 2 tenant, 3 Auth user, 9/9 bảng public bật RLS. n8n có 32 workflow, 16 active. Các phép đếm chưa chứng minh cô lập HTTP JWT. Giữ form ghi sản phẩm tắt.
GitHub Pages ở 6bb57e6. PR #10 CSS Auth, #11 widget và #12 CSS Admin đang mở. Kế thừa 64 assertion Commerce sandbox từ V10.4. Pilot cửa hàng thật chưa đạt.

## Bàn giao V11 · đối chiếu lại ngày 12/11/2026 JST

Baseline trước sửa 988670a, tích hợp Render 32669ab, bộ xác minh Render d5df816, widget 61cf82f. Nhánh bàn giao work/v11-handoff, [PR #14](https://github.com/ngoctien20/demo-git/pull/14).
Pilot cửa hàng thật: NOT READY. Production changed: NO. Xem [QA](V11_QA_REPORT.md), [triển khai](V11_DEPLOYMENT.md) và [backlog](V11_BACKLOG.md).
Phiên song song đã mở [PR #20](https://github.com/ngoctien20/demo-git/pull/20) ở 84ba90f, CI hợp đồng điều phối đạt. Nhánh đó xuất phát từ c367e11 và chưa chứa cải tiến chấm AI #13. Khi tích hợp phải chạy lại cả hai suite.


## V11 CTO continuation — 12/11/2026 JST (verified follow-up)

- Re-audited open PRs (Work V11 #13–#25 and Agent Factory #20/#21); do not overwrite specialized branches. `docs/ai-handoff/` is maintained on `docs/cto-coordination-v2`, not website `gh-pages`.
- **P0 blocking Commerce CI diagnosed and fixed in isolated [Draft PR #26](https://github.com/ngoctien20/demo-git/pull/26)**, based on Work V11 #22. Root cause: merchant optimistic-lock RPC emitted retryable PostgreSQL SQLSTATE `40001`; PostgREST repeatedly retried stale writes until timeout. Changed to `PT409` with HTTP 409 for a terminal conflict, without widening QA tenant allowlist.
- **CI evidence**: [isolated Commerce PostgreSQL/PostgREST QA run 43114961344](https://github.com/ngoctien20/demo-git/actions/runs/43114961344) SUCCESS; [Data Platform run 43114961157](https://github.com/ngoctien20/demo-git/actions/runs/43114961157) SUCCESS. Real PostgREST synthetic JWT A/B logs show stale write `409 PT409`.
- **Supabase staging** migration `20261111225128 v11_qa_merchant_product_stale_conflict_pt409` APPLIED; two-shop QA owner role test in a rolled-back transaction PASS (stale PT409, foreign 42501, anon/no-direct-write). Post-rollback counts remain 2 tenants, 2 products, 2 orders. No real user transaction or customer data changed.
- **Cloudflare canonical** production environment deployment `2715c6e2-edc1-4a5d-9ceb-5953311b752d`, SUCCESS at `gh-pages 6bb57e6`. Its newest overall event `70e34d43-a9ea-4755-9369-612af0f8b360` is a **SKIPPED preview** (preview_deployments_disabled), NOT an active release. Never conflate these.
- **Render Auth** newer live deploy `dep-dbqeqgafngtc73fcpf9g` at commit `deaa5e1c6193a7861f6f3d1b55448a1ce1c05624`; Render Data remains live `dep-dbq30a2jnfac73euucsg` / `3c29f70e...`. Both have auto-deploy OFF; verify hosted artifact SHA before accepting code changes.
- Staging readiness remains **NOT READY for paid customers**; live signed two-Auth-session A/B and real browser persistence, Super Admin hosted identity, commerce live gateway writes, backup restore on isolated Supabase and privacy/legal/payment gates remain open. Production unchanged.
