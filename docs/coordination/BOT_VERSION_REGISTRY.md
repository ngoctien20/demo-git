# Sổ phiên bản bot
|Thành phần|Trạng thái|Mốc cần pin|
|---|---|---|
|Messenger hiện hành|VERIFIED active, 27 node|Lưu riêng workflow ID + draft/live theo checkpoint, không dùng làm Lab ghi|
|Messenger Lab V4|EXPERIMENTAL, E2E BLOCKED|Dataset hiện hữu; cần version cho fixture, prompt, knowledge, memory và tools|
|Core Bot|PROPOSED|Chưa có bản APPROVED/RELEASED xác minh|
Mỗi bản ghi gồm bot/version, prompt SHA, knowledge digest, workflow/tool versions, suite, số ca đạt, changelog, owner, approval, rollback target. EXPERIMENTAL → EVALUATED → CANDIDATE → APPROVED → RELEASED. Gate: lỗi sai giá, đơn, tồn, cross-tenant hoặc gửi nhầm đều chặn candidate.

Nguồn đối chiếu: [Pages tại baseline](https://github.com/ngoctien20/demo-git/tree/7bf9c660e70a65295e80b0fba8c241590d6aa0bf) · [checkpoint monitor](https://github.com/ngoctien20/demo-git/pull/1) · [checkpoint tổng thể riêng của dự án, ngày 10/11/2026].

