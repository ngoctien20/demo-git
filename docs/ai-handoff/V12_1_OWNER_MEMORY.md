# Work V12.1 — Bộ nhớ V2.2 và adapter LLM
14/11/2026 JST. EXPERIMENTAL. Gốc 7377d2a0b8d05a99b43697624c20ea91a41806b0. Phạm vi thay đổi ở Personal / 90_QA - DIAGNOSTICS và nhánh work/v12-zalo-sales-lab.

| Kiểm tra | Bằng chứng |
|---|---|
| V1 yIJk8LvJoLF40Z62 và Shadow OgDZNSAvKEvhnAvn | Active, Published lần lượt 9ef7342b-0623-4921-9969-7d33d112bbef và 25477724-ac69-4e6b-9f2f-bfc46bd319bf |
| OReQin69kAguuw1q | Draft 40faa4ff-93b0-4d40-9d07-7ac6bcb0baf6, inactive. Guard đọc allowlist, xác minh chat và hạn nhưng bỏ messageId trước khi xử lý, dùng scope cố định. Không dùng đường này cho nhiều Owner. |
| Allowlist | Một hàng ALLOWED_STAGING_OWNER, đến 20/11/2026 22:17 JST. Không xuất định danh. |
| Worker tien404-zalo-outbound-v1-staging | ZALO_SEND_ENABLED có giá trị false. D1 outbound_claims đếm được một hàng. TEST 09 được chủ dự án xác nhận trước đó. |
| QA V2.1 | Workflow 9Lmb5f00pOtCNX48 execution 2897 ghi nhận 72/72 bằng engine quy tắc. |
| Memory QA | NZi7gF5B59M1RVlU, draft 30f09980-4a30-41f6-a566-494d01713d93, inactive. Bảng F0wLSGbSROn2PsWT chỉ dùng hai scope giả lập đã cấp trước. |
| 2904/2905 | Hai execution khác nhau, chọn áo đen rồi size L, nhận F01 giá fixture 159.000đ. |
| 2906/2907/2908 | Hai lệnh đồng thời cùng ID và một replay sau đó chỉ có một preview 318.000đ. Scope B vẫn revision 0. |
| 2909/2910 | Đổi ý xóa lựa chọn. Khi pin dữ liệu đọc cũ ở revision 3 sau commit revision 4, bước UPDATE thực không ghi và không trả preview. |
| QA cục bộ | 8/8 Node tests, suite 29/29, replay 132 case/167 lượt kiểm tra giới hạn đầu ra. Không chấm giá DEMO làm giá fixture. |
| LLM | Adapter Ollama HTTP chỉ loopback, giới hạn input 512 ký tự, output 48 token, context 2048, timeout 1,5s, không retry. Chỉ nhận đề xuất SKU có trong catalog. Có test HTTP giả và fallback khi endpoint thật từ chối kết nối. Không có model chạy, không đo token/cost/độ tự nhiên thực. |

Bảng QA chỉ lưu scope giả, facts, revision, thời điểm hết hạn và receipt ID giả trong 24h. Khi có đủ 128 receipt còn hiệu lực, chặn thêm. TTL facts 30 phút. Update dựa trên cả scope và revision, chỉ trả preview sau khi xác minh ghi thành công. Phép thử revision cũ có pin bước đọc để tạo thứ tự cạnh tranh lặp lại được. Khi hai tin khác ID tranh cùng revision, bên thua phải được điều phối xử lý lại từ phiên bản mới. Chưa nghiệm thu sắp thứ tự theo thời gian của Zalo, ACL dữ liệu nhiều merchant hoặc binding chat thật cho V2.2. Trước live, cần alias riêng theo Owner và biên nhận đã băm, xác thực ở biên, thời hạn lưu vật lý và khóa gọi workflow. Không chuyển ngữ cảnh giữa Owner khi thay allowlist.

Cách tái kiểm: node --test qa/zalo/*.test.cjs ; node qa/zalo/suite.cjs ; python -B qa/zalo/corpus.py HISTORY MULTI SINGLE COPY. Memory workflow source ở qa/zalo/memory-workflow.sdk.js. Nếu dựng lại, phải chọn đúng bảng QA. Adapter consultLocal trong ollama.cjs dùng model cài trước, không tải model. n8n có danh mục Gateway credits nhưng quyền gọi model, ngân sách còn lại và giá cho tài khoản chưa xác minh. Chỉ dùng model khi có runtime được cấp hoặc hạn mức cụ thể. Không gắn credential từ DEMO.

Rollback bằng cách giữ candidate inactive và ngừng manual runs. Không thay đổi workflow V1, Shadow V2, agent V2.1 hoặc claim cũ. Trước khi định tuyến thật, chạy thử đầu cuối bằng Owner đã xác thực, kiểm tra replay và thứ tự tin, kiểm tra ACK và kill switch, xin phê duyệt riêng cho thay đổi live.