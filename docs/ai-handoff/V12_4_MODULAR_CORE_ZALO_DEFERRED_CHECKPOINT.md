# TIEN404 AI V12.4 — MODULAR CORE / ZALO LATER CHECKPOINT

**Date:** 15 Nov 2026 JST. **Stage:** IMPLEMENTED + TESTED (source / synthetic QA); NOT DEPLOYED / NOT RELEASED.

## 1. Phạm vi đã triển khai
- Tiếp tục Draft PR #52 (không sửa PR #41 Shop B Owner, Postgres sessions, tenant QA).
- Đã tạo lõi tái sử dụng trong `qa/commerce/v124-core/`: signed internal QA ingress, trusted fixture tenant mapping, fresh scoped catalog, intent-only reply core, in-memory fixture dedupe/rate limiter, disabled channel ports, test cases, README và index.
- `index.cjs` chỉ xuất hàm read-only QA; không xuất `sendMessage`, `commitOrder`, `createOrder` hoặc quyền truy cập credential.
- Zalo, Messenger, Website và Telegram được giữ ở trạng thái `RESERVED_NOT_CONNECTED`, `send()` luôn từ chối.
- Mọi dữ liệu Catalog Shop A/B trong unit tests là **fixture**, không phải giá bán hiện hành từ Supabase.
- Không tạo credential, không bật AI inference, không thay đổi n8n Published, không gửi Zalo, không ghi Orders/Outbox và không merge.

## 2. Source files
| File | QA purpose |
|---|---|
| qa/commerce/v124-core/ingress.cjs | Signed QA fixture envelope; derive trusted tenant/store from server registry and HMAC, no raw senderRef in output |
| qa/commerce/v124-core/catalog.cjs | Tenant/store/sku scoped repository port; freshness & price/stock validation |
| qa/commerce/v124-core/core.cjs | Pure read-only AI Sales reply guard and preview |
| qa/commerce/v124-core/ports.cjs | Disabled channel adapters; blocked paid AI model; QA memory dedupe/rate, fixtures |
| qa/commerce/v124-core/index.cjs | Channel-neutral read-only package export |
| qa/commerce/v124-core/core.test.cjs | 48 independent security, isolation, pricing, outbox/no-send QA cases |
| qa/commerce/v124-core/README.md | API contract and future channel adapter integration gates |

## 3. QA evidence
- GitHub Actions run `43619873004`, job `132522900418`: `83 tests`, `83 pass`, `0 fail`, fully inspected job logs.
- Composition = 48 new tests in `qa/commerce/v124-core/core.test.cjs` + 35 existing tests in `qa/zalo/public-reply-pilot.test.cjs`.
- Prior n8n manual-only reply guard QA: execution `3666`, 25/25 synthetic PASS.
- Prior AI intent workflow `uGesZLvNkhY4ZO6l` remains unpublishable for this release without budget proof: real paid GPT calls in this workstream = 0.

## 4. What PASS does not mean
- The QA HMAC key is ephemeral in tests. It is **NOT** a provider-origin Zalo signature. The actual trusted server ingress/HMAC bridge is still not deployed.
- No persistent PostgreSQL receipt lock, replay guarantee or distributed rate limit; single-process memory fixture only.
- Tests do not prove real Supabase RLS / two-connection concurrency or use fresh authenticated live Shop A/B catalog.
- No real LLM inference, measured model correctness, budget cap, token limit or customer-facing reply.
- No live Zalo (or Messenger/Website) integration, sender allowlist, orders or notification outbox.

## 5. Future integration plan
1. Integrate core into an isolated server-side backend sandbox and prove server-origin ingress auth; keep QA-only hard-disabled channel ports.
2. Connect authorized, tenant-scoped read-only catalog to Supabase staging using least-privilege credentials after review.
3. Replace test memory ports with persistent receipt/idempotency CAS and a distributed rate-limit policy, with concurrent workers QA.
4. Implement enforceable n8n AI inference budget gate; only then test GPT-5.4 nano up to the approved 10 calls/$0.10 cap. No model call if cap cannot be enforced.
5. Review channel adapter contract and wire Zalo to the approved core only after the core is QA-passed and Owner explicitly approves sending. Distinct approval for Messenger/Website and all Orders writes.

## 6. Rollback
- Revert / close unmerged Draft PR #52 for source-only changes; no schema migration or live workflow update needs rollback.
- PR #41 is independent. V12.3 published V1 ingress and Customer Router must not be overwritten by branch source code.

**Checkpoint status:** IMPLEMENTED source / TESTED synthetic 83/83 / BLOCKED real provider+DB+LLM / PROPOSED later Zalo integration.