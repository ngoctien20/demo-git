# TIEN404 AI V11.5 — Zalo-first Notification QA

**Ngày:** 13/11/2026 · **Release:** EXPERIMENTAL → CANDIDATE chưa được phê duyệt.

## Bằng chứng mới

| Loại | Bằng chứng | Kết quả |
|---|---|---|
| GitHub module no-send | `qa/lab/notification_v5_contract.cjs` | IMPLEMENTED, no credentials/API/network |
| GitHub unit tests | `qa/lab/test_notification_v5.cjs` | 28 test cases |
| GitHub Actions | https://github.com/ngoctien20/demo-git/actions/runs/43319210988 | SUCCESS, 13/11/2026 JST, run SHA `b16c994eba71cd14ce98ca566e17dd07c00c9378` |
| n8n Zalo policy QA | workflow `hkZzAmv86NoiTFHh` execution `2693` | SUCCESS 27/27, zero provider sends |
| V4.5 Telegram | execution `2686`, message ID 6 | API ACCEPTED, staging fake order |
| V4.5 Gmail | execution `2687`, Gmail ACK `1a1d1b33efbd7243` | API ACCEPTED, staging fake order |
| V4.5 no-duplicate | executions `2689`, `2690` | Both stopped before send |
| V4.5 reconcile | execution `2691` | Two `accepted`, one attempt each |
| V4.5 Messenger policy | `2688` | 27/27 simulated |
| V4.5 Messenger no recipient | `2692` | BLOCKED as designed |

## Ranh giới chứng cứ

- Zalo 27/27 và GitHub 28 tests đều là kiểm tra logic **sử dụng dữ liệu giả lập**. Chưa có OA ID, OAuth, template được duyệt, quota hoặc Zalo API ACK.
- GitHub module chỉ chuẩn bị kế hoạch; không chứng minh exactly-once với nhiều worker; SQL candidate chưa áp dụng.
- Telegram/Gmail `accepted` là nhà cung cấp chấp nhận thông báo, **không phải đã đọc**; không áp dụng cho khách thật.
- Messenger live không thay đổi.
- Không có tiền, đơn, người nhận thật nào bị sửa bởi V11.5.

## QA còn bắt buộc

P0: hai tenant signed JWT A/B; replay ký webhook; concurrent atomic claim; transaction order outbox; unknown timeout; multi-tenant recipient hijack; invoice/privacy. P1: owner consent Zalo OA/App; phí, quyền, template; negative provider tests; backup restore; hosted UI mobile accessibility. Khi thiếu điều kiện, giữ trạng thái BLOCKED, không hạ chuẩn QA.
