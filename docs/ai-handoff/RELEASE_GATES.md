# Điều kiện phát hành và hoàn tác

| Điều kiện pilot | Kết quả Work V9 |
|---|---|
| JWT thật A/B, refresh/logout/recovery, nonmember và truy cập chéo đọc/ghi | BLOCKED |
| Mobile login → tenant → catalog → cấu hình bot → test chat → logout | IN_PROGRESS |
| Giao dịch DB và HTTP fixture chịu retry/concurrency | VERIFIED_DONE trong DB thử; tích hợp tenant thật và n8n còn mở |
| Quota chống trùng/giới hạn | VERIFIED_DONE trong môi trường Admin cô lập; chưa nối provider |
| Restore dữ liệu có kiểm và audit | VERIFIED_DONE trong PostgreSQL CI; diễn tập trên bản sao Supabase còn mở |
| 4 workflow có Draft khác Published | DEFERRED Publish. Cần kiểm fixture lịch sử, quyết định chủ dự án và phương án revert. |

Trước triển khai, đối chiếu SHA đang phục vụ với HEAD, CI, phạm vi diff, cấu hình tự deploy và phương án phục hồi. Auth rollback về artifact dep-dbpu1qajnfac73efpjr0 của d25d683. Data rollback về dep-dbpifqbbc2fs73aa1ab0 của 9745dd18. Với bảng bot mới, tạm dừng hiển thị ở UI hoặc thu hồi SELECT bằng migration đã duyệt, giữ nguyên bản ghi. PR Admin, Website, Commerce và Lab có thể revert commit trên branch phát triển tương ứng.

Chủ dự án duyệt việc mở quyền ghi merchant, thay đổi quyền quản trị/credential, Publish workflow phục vụ thật, promote Core Bot, production merge hoặc thanh toán/chi phí mới. Các việc QA chỉ đọc và bảo trì fixture tiếp tục theo quyền đã giao.
