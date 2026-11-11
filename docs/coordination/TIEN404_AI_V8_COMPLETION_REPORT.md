# Trạng thái nghiệm thu · 11/11/2026 JST

| Mục nghiệm thu | Trạng thái | Bằng chứng và phần còn thiếu |
|---|---|---|
| Đối chiếu Published 7 workflow | VERIFIED_DONE | [7 cặp version](TIEN404_AI_V8_QA_EVIDENCE.md). 4 draft khác. |
| Login staging chuyển sang sẵn sàng | VERIFIED_DONE | AU-01 trực tiếp trên bản d25d683. Email/password và recovery ghi riêng. |
| Merchant overview, catalog và danh sách đơn | IMPLEMENTED_NOT_VERIFIED | Đã triển khai phân quyền theo vai trò, lọc và đếm; AU-02 đạt. Thiếu nghiệm thu bằng phiên A/B trên artifact này. |
| Cô lập A/B tại PostgreSQL | VERIFIED_DONE | DB-01 và DB-02. Phạm vi SELECT và từ chối quyền trực tiếp. |
| Hai JWT và vòng đời session | BLOCKED | AU-05. Hai shop đã có tài khoản. Runner chưa có thông tin QA qua kênh bảo mật. |
| Transaction tồn kho và restore trên fixture | VERIFIED_DONE | TX-01, DR-01. Chưa nối API checkout trên Render. |
| Merchant tạo/sửa sản phẩm | IN_PROGRESS | [RPC ứng viên](https://github.com/ngoctien20/demo-git/blob/f4b465f/ops/data-platform/candidates/merchant_product.sql). Chờ duyệt quyền và UI nghiệm thu. |
| Registry và AI Training Lab | IN_PROGRESS | [Registry 6 bot](https://github.com/ngoctien20/demo-git/blob/0a65513/data/workflow-registry.v5.json), AI-01, LAB-01. Thiếu tenant assignment, kết quả theo đủ 14 nhóm, benchmark chi phí và handoff. |
| Website, Super Admin và Commerce E2E | IN_PROGRESS | NAV-01, ADM-01, GW-01. Thiếu luồng website đến shop, owner đến bot, phân quyền quản trị liên hệ thống. |
| Doanh thu theo thanh toán, hoạt động AI và usage trên dashboard | NOT_STARTED | [Account hiện hành](https://github.com/ngoctien20/demo-git/blob/d25d683/assets/auth-account.js) chỉ có 4 bộ đếm. Chưa có định nghĩa và nguồn sự kiện đã nghiệm thu. |
| Phát hành bot, thanh toán thật, rollout sản xuất | DEFERRED | Chờ nghiệm thu P0 và quyết định riêng của chủ dự án. |

**Bốn mục gốc của Control Hub:** 1 đủ điều kiện đánh dấu, 3 còn mở. Các kết quả PASS theo phạm vi ở trên là nhiệm vụ con. [Chi tiết](TIEN404_CONTROL_HUB_MANUAL_CHECKLIST.md).
