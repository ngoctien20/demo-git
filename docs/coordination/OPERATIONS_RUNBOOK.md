# Bàn giao và tự sửa an toàn
DISCOVER → AUDIT → PLAN → ASSIGN → IMPLEMENT → TEST → REVIEW → APPROVE → RELEASE → MONITOR.

Đầu phiên: đọc issue và checkpoint, so SHA/draft/live, nhận owner component. Trước ghi: snapshot đã che dữ liệu; nếu version đã đổi thì đối chiếu lại. Khi kết thúc: cập nhật issue, CURRENT_STATUS, QA_REPORT, NEXT_ACTIONS; ghi expected/actual, suite/run, thay đổi, rủi ro và rollback. Dedupe theo component/version/case/error class.

PROPOSED: tái sử dụng các lịch Commerce, AI SALES, Website; CI/exec/DB/API/runtime/security đẩy metadata đã lọc vào Hub. Một nơi chạy mỗi suite. Cho tối đa một lần retry đọc/mock; tối đa một patch staging mỗi lỗi/version. Dừng khi tái lỗi, thiếu ngân sách hoặc thiếu quyền. Thiếu dữ liệu → UNKNOWN/STALE. Gmail chỉ gửi khi đã xác định người nhận, scope và chính sách. Test không gửi khách. Không tự chạy sau khi phiên Work kết thúc ngoài lịch đã cấu hình.

Nguồn đối chiếu: [Pages tại baseline](https://github.com/ngoctien20/demo-git/tree/7bf9c660e70a65295e80b0fba8c241590d6aa0bf) · [checkpoint monitor](https://github.com/ngoctien20/demo-git/pull/1) · [checkpoint tổng thể riêng của dự án, ngày 10/11/2026].

